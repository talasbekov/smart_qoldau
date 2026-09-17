#!/usr/bin/env python3
"""Bounded, read-only availability smoke check for Smart Qoldau."""

import argparse
import http.client
import json
import os
import re
import signal
import ssl
import string
import sys
import time
import urllib.parse
from dataclasses import dataclass


EXIT_CONFIG = 2
EXIT_HEALTH_REQUEST = 3
EXIT_HEALTH_STATUS = 4
EXIT_HEALTH_CONTRACT = 5
EXIT_WEB_REQUEST = 6
EXIT_WEB_STATUS = 7
EXIT_WEB_MARKER = 8
MAX_BODY_BYTES = 256 * 1024
MAX_REQUEST_TIMEOUT_SECONDS = 5.0
EXPECTED_HEALTH = {"status": "ok", "db": "ok", "redis": "ok"}
URI_UNRESERVED = frozenset(string.ascii_letters + string.digits + "-._~")
URI_SUB_DELIMITERS = frozenset("!$&'()*+,;=")


class ConfigurationError(Exception):
    pass


class RequestDeadlineExceeded(Exception):
    pass


class DuplicateJsonMember(ValueError):
    pass


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, _message):
        raise ConfigurationError("invalid arguments")


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes
    body_too_large: bool


def positive_timeout(value):
    try:
        parsed = float(value)
    except ValueError as error:
        raise ConfigurationError("invalid timeout") from error
    if not 0 < parsed <= MAX_REQUEST_TIMEOUT_SECONDS:
        raise ConfigurationError("invalid timeout")
    return parsed


def parse_args(argv):
    parser = SafeArgumentParser(
        description=(
            "Read-only Smart Qoldau availability smoke. Configuration is read "
            "from SMOKE_BASE_URL, optional SMOKE_WEB_URL/SMOKE_WEB_MARKER, and "
            "optional SMOKE_CONNECT_TIMEOUT/SMOKE_TOTAL_TIMEOUT environment "
            "variables. Exit codes: 0 success, 2 configuration, 3-5 health, "
            "6-8 web."
        )
    )
    return parser.parse_args(argv)


def valid_uri_component(value, extra_characters):
    allowed = URI_UNRESERVED | URI_SUB_DELIMITERS | frozenset(extra_characters)
    index = 0
    while index < len(value):
        if value[index] == "%":
            if not re.fullmatch(r"[0-9A-Fa-f]{2}", value[index + 1 : index + 3]):
                return False
            index += 3
            continue
        if value[index] not in allowed:
            return False
        index += 1
    return True


def validate_url(value, *, origin_only):
    if (
        not value
        or len(value) > 2048
        or any(ord(character) <= 0x20 or ord(character) == 0x7F for character in value)
        or re.search(r"%(?![0-9A-Fa-f]{2})", value)
        or "#" in value
        or (origin_only and "?" in value)
    ):
        raise ConfigurationError("invalid URL")
    try:
        value.encode("ascii")
    except UnicodeEncodeError as error:
        raise ConfigurationError("URL must be ASCII with non-ASCII characters percent-encoded") from error
    try:
        parts = urllib.parse.urlsplit(value)
        hostname = parts.hostname
        _port = parts.port
    except ValueError as error:
        raise ConfigurationError("invalid URL") from error
    if parts.scheme not in {"http", "https"} or not parts.netloc or not hostname:
        raise ConfigurationError("invalid URL")
    if parts.username is not None or parts.password is not None:
        raise ConfigurationError("URL credentials are forbidden")
    if not valid_uri_component(parts.netloc, ":[]"):
        raise ConfigurationError("invalid URL authority")
    if not valid_uri_component(parts.path, "/:@"):
        raise ConfigurationError("invalid URL path")
    if not valid_uri_component(parts.query, "/:@?"):
        raise ConfigurationError("invalid URL query")
    if origin_only and (parts.path not in {"", "/"} or parts.query):
        raise ConfigurationError("base URL must contain only an origin")
    return parts


def health_url(base_parts):
    return urllib.parse.urlunsplit(
        (base_parts.scheme, base_parts.netloc, "/v1/health", "", "")
    )


def deadline_handler(_signum, _frame):
    raise RequestDeadlineExceeded()


def get(url, connect_timeout, total_timeout):
    parts = validate_url(url, origin_only=False)
    port = parts.port
    connection_type = (
        http.client.HTTPSConnection if parts.scheme == "https" else http.client.HTTPConnection
    )
    connection_args = {"host": parts.hostname, "port": port, "timeout": min(connect_timeout, total_timeout)}
    if parts.scheme == "https":
        connection_args["context"] = ssl.create_default_context()
    connection = connection_type(**connection_args)
    target = urllib.parse.urlunsplit(("", "", parts.path or "/", parts.query, ""))
    deadline = time.monotonic() + total_timeout
    previous_handler = signal.signal(signal.SIGALRM, deadline_handler)
    signal.setitimer(signal.ITIMER_REAL, total_timeout)
    try:
        connection.request(
            "GET",
            target,
            headers={
                "Accept": "application/json, text/html;q=0.8",
                "Connection": "close",
                "User-Agent": "smart-qoldau-synthetic-smoke/1",
            },
        )
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RequestDeadlineExceeded()
        if connection.sock is not None:
            connection.sock.settimeout(remaining)
        response = connection.getresponse()
        body = response.read(MAX_BODY_BYTES + 1)
        return Response(
            status=response.status,
            body=body[:MAX_BODY_BYTES],
            body_too_large=len(body) > MAX_BODY_BYTES,
        )
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        connection.close()


def fail(message, exit_code):
    print(f"synthetic-smoke: FAIL {message}", file=sys.stderr)
    return exit_code


def reject_duplicate_json_members(pairs):
    result = {}
    for name, value in pairs:
        if name in result:
            raise DuplicateJsonMember()
        result[name] = value
    return result


def check_health(url, connect_timeout, total_timeout):
    try:
        response = get(url, connect_timeout, total_timeout)
    except (OSError, http.client.HTTPException, ssl.SSLError, RequestDeadlineExceeded, TimeoutError):
        return fail("health=request_failed", EXIT_HEALTH_REQUEST)
    if response.status != 200:
        return fail(
            f"health=http_status expected=200 actual={response.status}",
            EXIT_HEALTH_STATUS,
        )
    if response.body_too_large:
        return fail("health=contract_mismatch", EXIT_HEALTH_CONTRACT)
    try:
        payload = json.loads(response.body, object_pairs_hook=reject_duplicate_json_members)
    except (json.JSONDecodeError, UnicodeDecodeError, DuplicateJsonMember):
        return fail("health=contract_mismatch", EXIT_HEALTH_CONTRACT)
    if payload != EXPECTED_HEALTH:
        return fail("health=contract_mismatch", EXIT_HEALTH_CONTRACT)
    return 0


def check_web(url, marker, connect_timeout, total_timeout):
    try:
        response = get(url, connect_timeout, total_timeout)
    except (OSError, http.client.HTTPException, ssl.SSLError, RequestDeadlineExceeded, TimeoutError):
        return fail("web=request_failed", EXIT_WEB_REQUEST)
    if response.status != 200:
        return fail(
            f"web=http_status expected=200 actual={response.status}",
            EXIT_WEB_STATUS,
        )
    if response.body_too_large or marker not in response.body:
        return fail("web=marker_missing", EXIT_WEB_MARKER)
    return 0


def main(argv=None, environ=None):
    environment = os.environ if environ is None else environ
    try:
        parse_args(argv)
        base_url = environment.get("SMOKE_BASE_URL")
        web_url = environment.get("SMOKE_WEB_URL")
        web_marker = environment.get("SMOKE_WEB_MARKER")
        connect_timeout = positive_timeout(environment.get("SMOKE_CONNECT_TIMEOUT", "2"))
        total_timeout = positive_timeout(environment.get("SMOKE_TOTAL_TIMEOUT", "5"))
        base_parts = validate_url(base_url, origin_only=True)
        web_marker_bytes = None
        if (web_url is None) != (web_marker is None):
            raise ConfigurationError("web URL and marker must be configured together")
        if web_marker is not None:
            if not web_marker or len(web_marker) > 256:
                raise ConfigurationError("invalid web marker")
            try:
                web_marker_bytes = web_marker.encode("utf-8")
            except UnicodeEncodeError as error:
                raise ConfigurationError("web marker must be UTF-8") from error
            validate_url(web_url, origin_only=False)
    except ConfigurationError:
        return fail("configuration_error", EXIT_CONFIG)

    result = check_health(
        health_url(base_parts),
        connect_timeout,
        total_timeout,
    )
    if result:
        return result

    web_status = "skipped"
    if web_url is not None:
        result = check_web(
            web_url,
            web_marker_bytes,
            connect_timeout,
            total_timeout,
        )
        if result:
            return result
        web_status = "ok"

    print(f"synthetic-smoke: OK health=ok web={web_status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
