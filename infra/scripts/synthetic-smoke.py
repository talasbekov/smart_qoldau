#!/usr/bin/env python3
"""Bounded, read-only availability smoke check for Smart Qoldau."""

import argparse
import http.client
import json
import signal
import ssl
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
EXPECTED_HEALTH = {"status": "ok", "db": "ok", "redis": "ok"}


class ConfigurationError(Exception):
    pass


class RequestDeadlineExceeded(Exception):
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
        raise argparse.ArgumentTypeError("must be a number") from error
    if not 0 < parsed <= 60:
        raise argparse.ArgumentTypeError("must be greater than 0 and at most 60")
    return parsed


def parse_args(argv):
    parser = SafeArgumentParser(
        description=(
            "Read-only Smart Qoldau availability smoke. Exit codes: "
            "0 success, 2 configuration, 3-5 health, 6-8 web."
        )
    )
    parser.add_argument("--base-url", required=True, help="HTTP(S) origin; no path or credentials")
    parser.add_argument("--web-url", help="optional explicit public page URL")
    parser.add_argument("--web-marker", help="required static marker when --web-url is set")
    parser.add_argument("--connect-timeout", type=positive_timeout, default=2.0)
    parser.add_argument("--total-timeout", type=positive_timeout, default=5.0)
    return parser.parse_args(argv)


def validate_url(value, *, origin_only):
    if not value or len(value) > 2048 or any(ord(character) < 0x20 for character in value):
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
    if parts.fragment:
        raise ConfigurationError("URL fragments are forbidden")
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
        payload = json.loads(response.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
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
    if response.body_too_large or marker.encode("utf-8") not in response.body:
        return fail("web=marker_missing", EXIT_WEB_MARKER)
    return 0


def main(argv=None):
    try:
        args = parse_args(argv)
        base_parts = validate_url(args.base_url, origin_only=True)
        if (args.web_url is None) != (args.web_marker is None):
            raise ConfigurationError("web URL and marker must be configured together")
        if args.web_marker is not None:
            if not args.web_marker or len(args.web_marker) > 256:
                raise ConfigurationError("invalid web marker")
            validate_url(args.web_url, origin_only=False)
    except ConfigurationError:
        return fail("configuration_error", EXIT_CONFIG)

    result = check_health(
        health_url(base_parts),
        args.connect_timeout,
        args.total_timeout,
    )
    if result:
        return result

    web_status = "skipped"
    if args.web_url is not None:
        result = check_web(
            args.web_url,
            args.web_marker,
            args.connect_timeout,
            args.total_timeout,
        )
        if result:
            return result
        web_status = "ok"

    print(f"synthetic-smoke: OK health=ok web={web_status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
