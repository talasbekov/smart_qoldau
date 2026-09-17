#!/usr/bin/env python3
"""Bounded, read-only collector for four aggregate operational signals.

This is intentionally a one-shot local tool.  It does not log in, refresh
credentials, schedule itself, retain state, deliver notifications, or infer
product/business health from the source observations.
"""

import argparse
import contextlib
from dataclasses import dataclass
import datetime as dt
import http.client
import ipaddress
import json
import math
import os
import re
import signal
import ssl
import stat
import sys
import time
import urllib.parse


SCHEMA = "qoldau-operational-signals/v1"
MAX_CREDENTIAL_BYTES = 8 * 1024
MAX_RESPONSE_BYTES = 64 * 1024
CONNECT_TIMEOUT_SECONDS = 2.0
SOURCE_TIMEOUT_SECONDS = 5.0
WHOLE_RUN_TIMEOUT_SECONDS = 22.0
# Consumer-side clock/transport tolerance only; this is not a source SLA.
FRESHNESS_TOLERANCE = dt.timedelta(seconds=60)
MAX_WINDOW = dt.timedelta(hours=24)
UTC = dt.timezone.utc
UTC_PATTERN = re.compile(
    r"^(?P<date>[0-9]{4}-[0-9]{2}-[0-9]{2})T"
    r"(?P<time>[0-9]{2}:[0-9]{2}:[0-9]{2})"
    r"(?P<fraction>\.[0-9]{1,6})?Z$"
)
DNS_LABEL_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
BEARER_PATTERN = re.compile(r"^[A-Za-z0-9._~+/=-]+$")


class ConfigurationError(Exception):
    """An input failed before any request was allowed."""


class ContractError(Exception):
    """A response was not exactly the accepted aggregate contract."""


class DuplicateJsonMember(ContractError):
    """A JSON object contained an ambiguous repeated member."""


class RequestDeadlineExceeded(Exception):
    """The wall-clock request deadline expired."""


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, _message):
        raise ConfigurationError()


@dataclass(frozen=True)
class Origin:
    scheme: str
    host: str
    port: int | None


@dataclass(frozen=True)
class Configuration:
    origin: Origin
    window_from: str
    window_to: str
    tokens: dict


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes
    too_large: bool


SOURCE_ORDER = ("verification", "settle", "push", "noshow")
SOURCE_PATHS = {
    "verification": "/v1/admin/verification/operational-signal",
    "settle": "/v1/admin/payments/operational-signal",
    "push": "/v1/admin/notifications/push-observation",
    "noshow": "/v1/admin/consultations/no-show-observation",
}


def utc_now():
    return dt.datetime.now(UTC)


def format_utc(value):
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_utc(value):
    if not isinstance(value, str):
        raise ContractError()
    match = UTC_PATTERN.fullmatch(value)
    if not match:
        raise ContractError()
    try:
        return dt.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as error:
        raise ContractError() from error


def parse_window_utc(value):
    try:
        return parse_utc(value)
    except ContractError as error:
        raise ConfigurationError() from error


def parse_arguments(argv):
    try:
        arguments = list(sys.argv[1:] if argv is None else argv)
    except TypeError as error:
        raise ConfigurationError() from error
    value_options = (
        "--base-url",
        "--from",
        "--to",
        "--verification-bearer-file",
        "--settle-bearer-file",
        "--push-bearer-file",
        "--noshow-bearer-file",
    )
    for option in value_options:
        occurrences = sum(
            item == option or item.startswith(option + "=") for item in arguments
        )
        if occurrences != 1:
            raise ConfigurationError()
    if arguments.count("--allow-http-loopback") > 1:
        raise ConfigurationError()

    parser = SafeArgumentParser(add_help=False, allow_abbrev=False)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--from", dest="window_from", required=True)
    parser.add_argument("--to", dest="window_to", required=True)
    parser.add_argument("--verification-bearer-file", required=True)
    parser.add_argument("--settle-bearer-file", required=True)
    parser.add_argument("--push-bearer-file", required=True)
    parser.add_argument("--noshow-bearer-file", required=True)
    parser.add_argument("--allow-http-loopback", action="store_true")
    try:
        return parser.parse_args(arguments)
    except (TypeError, ValueError) as error:
        raise ConfigurationError() from error


def validate_dns_name(host):
    if len(host) > 253 or host.endswith("."):
        raise ConfigurationError()
    labels = host.split(".")
    if not labels or any(not DNS_LABEL_PATTERN.fullmatch(label) for label in labels):
        raise ConfigurationError()


def parse_origin(value, allow_http_loopback):
    if (
        not isinstance(value, str)
        or not value
        or len(value) > 2048
        or any(ord(character) <= 0x20 or ord(character) == 0x7F for character in value)
    ):
        raise ConfigurationError()
    try:
        value.encode("ascii")
        parts = urllib.parse.urlsplit(value)
        port = parts.port
    except (UnicodeEncodeError, ValueError) as error:
        raise ConfigurationError() from error
    if (
        parts.scheme not in {"https", "http"}
        or not parts.netloc
        or parts.username is not None
        or parts.password is not None
        or parts.path not in {"", "/"}
        or parts.query
        or parts.fragment
        or "?" in value
        or "#" in value
        or "%" in parts.netloc
        or "\\" in parts.netloc
    ):
        raise ConfigurationError()

    authority = parts.netloc
    host = parts.hostname
    if not host:
        raise ConfigurationError()
    literal_ip = None
    if authority.startswith("["):
        match = re.fullmatch(r"\[([0-9A-Fa-f:.]+)\](?::([0-9]+))?", authority)
        if not match:
            raise ConfigurationError()
        try:
            literal_ip = ipaddress.IPv6Address(match.group(1))
        except ValueError as error:
            raise ConfigurationError() from error
    else:
        if "[" in authority or "]" in authority or authority.count(":") > 1:
            raise ConfigurationError()
        if ":" in authority:
            raw_host, separator, raw_port = authority.rpartition(":")
            if not separator or not raw_host or not raw_port or not raw_port.isdigit():
                raise ConfigurationError()
        try:
            literal_ip = ipaddress.IPv4Address(host)
        except ValueError:
            validate_dns_name(host)

    if port is not None and not 1 <= port <= 65535:
        raise ConfigurationError()
    if parts.scheme == "http":
        if not allow_http_loopback or literal_ip is None or not literal_ip.is_loopback:
            raise ConfigurationError()
    return Origin(parts.scheme, host, port)


def read_bearer_file(path):
    if not isinstance(path, str) or not path or "\x00" in path:
        raise ConfigurationError()
    try:
        path_details = os.lstat(path)
    except OSError as error:
        raise ConfigurationError() from error
    if not stat.S_ISREG(path_details.st_mode):
        raise ConfigurationError()
    nonblock = getattr(os, "O_NONBLOCK", None)
    nofollow = getattr(os, "O_NOFOLLOW", None)
    if nonblock is None or nofollow is None:
        raise ConfigurationError()
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | nonblock | nofollow
    descriptor = None
    try:
        descriptor = os.open(path, flags)
        details = os.fstat(descriptor)
        if (
            not stat.S_ISREG(details.st_mode)
            or (details.st_dev, details.st_ino)
            != (path_details.st_dev, path_details.st_ino)
            or details.st_uid != os.geteuid()
            or stat.S_IMODE(details.st_mode) != 0o600
            or details.st_size > MAX_CREDENTIAL_BYTES
        ):
            raise ConfigurationError()
        data = os.read(descriptor, MAX_CREDENTIAL_BYTES + 1)
        if len(data) > MAX_CREDENTIAL_BYTES or os.read(descriptor, 1):
            raise ConfigurationError()
    except (OSError, ValueError) as error:
        raise ConfigurationError() from error
    finally:
        if descriptor is not None:
            os.close(descriptor)
    if data.endswith(b"\n"):
        data = data[:-1]
    if not data or b"\n" in data or b"\r" in data:
        raise ConfigurationError()
    try:
        token = data.decode("ascii")
    except UnicodeDecodeError as error:
        raise ConfigurationError() from error
    if not BEARER_PATTERN.fullmatch(token):
        raise ConfigurationError()
    return token


def build_configuration(argv, collector_now):
    arguments = parse_arguments(argv)
    origin = parse_origin(arguments.base_url, arguments.allow_http_loopback)
    window_from_value = parse_window_utc(arguments.window_from)
    window_to_value = parse_window_utc(arguments.window_to)
    if (
        window_from_value >= window_to_value
        or window_to_value > collector_now
        or window_to_value - window_from_value > MAX_WINDOW
    ):
        raise ConfigurationError()

    # Read every credential before the first network operation.  No source has
    # a role/token fallback, and no token is accepted through argv or environ.
    tokens = {
        "verification": read_bearer_file(arguments.verification_bearer_file),
        "settle": read_bearer_file(arguments.settle_bearer_file),
        "push": read_bearer_file(arguments.push_bearer_file),
        "noshow": read_bearer_file(arguments.noshow_bearer_file),
    }
    return Configuration(
        origin=origin,
        window_from=arguments.window_from,
        window_to=arguments.window_to,
        tokens=tokens,
    )


def deadline_handler(_signum, _frame):
    raise RequestDeadlineExceeded()


@contextlib.contextmanager
def wall_clock_deadline(seconds):
    if seconds <= 0:
        raise RequestDeadlineExceeded()
    previous_handler = signal.signal(signal.SIGALRM, deadline_handler)
    previous_delay, previous_interval = signal.setitimer(signal.ITIMER_REAL, seconds)
    started = time.monotonic()
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_delay > 0:
            remaining = max(0.000001, previous_delay - (time.monotonic() - started))
            signal.setitimer(signal.ITIMER_REAL, remaining, previous_interval)


def verified_client_context():
    # Do not use create_default_context(): it enables environment-directed TLS
    # secret logging through SSLKEYLOGFILE.  This context retains certificate
    # and hostname verification and still loads the operator/system trust store.
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.verify_mode = ssl.CERT_REQUIRED
    context.check_hostname = True
    if hasattr(context, "keylog_filename"):
        context.keylog_filename = None
    context.load_default_certs(ssl.Purpose.SERVER_AUTH)
    return context


def get_response(scheme, host, port, target, token, connect_timeout, total_timeout):
    started = time.monotonic()
    connection = None
    with wall_clock_deadline(total_timeout):
        try:
            connection_type = (
                http.client.HTTPSConnection
                if scheme == "https"
                else http.client.HTTPConnection
            )
            parameters = {
                "host": host,
                "port": port,
                "timeout": connect_timeout,
            }
            if scheme == "https":
                parameters["context"] = verified_client_context()
            connection = connection_type(**parameters)
            # Socket connect/TLS use the 2s socket timeout.  Python's blocking
            # resolver cannot enforce that sub-bound; DNS remains covered by
            # the 5s wall-clock source deadline.
            connection.connect()
            remaining = total_timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise RequestDeadlineExceeded()
            if connection.sock is not None:
                connection.sock.settimeout(remaining)
            connection.request(
                "GET",
                target,
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Connection": "close",
                    "User-Agent": "smart-qoldau-operational-signals/1",
                },
            )
            response = connection.getresponse()
            body = response.read(MAX_RESPONSE_BYTES + 1)
            return Response(
                status=response.status,
                body=body[:MAX_RESPONSE_BYTES],
                too_large=len(body) > MAX_RESPONSE_BYTES,
            )
        finally:
            if connection is not None:
                connection.close()


def reject_duplicate_members(pairs):
    result = {}
    for name, value in pairs:
        if name in result:
            raise DuplicateJsonMember()
        result[name] = value
    return result


def reject_nonfinite(_value):
    raise ContractError()


def decode_json(body):
    try:
        text = body.decode("utf-8", errors="strict")
        value = json.loads(
            text,
            object_pairs_hook=reject_duplicate_members,
            parse_constant=reject_nonfinite,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ContractError) as error:
        raise ContractError() from error
    if not isinstance(value, dict):
        raise ContractError()
    return value


def require_exact_fields(value, expected):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ContractError()


def require_choice(value, choices):
    if not isinstance(value, str) or value not in choices:
        raise ContractError()
    return value


def require_nonnegative_int(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ContractError()
    return value


def require_nonnegative_number(value):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < 0
    ):
        raise ContractError()
    return value


def validate_verification(payload):
    fields = {
        "signal", "state", "thresholdHours", "overdueCount",
        "oldestPendingAgeSeconds", "missingSubmittedAtCount", "observedAt",
    }
    require_exact_fields(payload, fields)
    if payload["signal"] != "verification.queue_over_24h":
        raise ContractError()
    state = require_choice(payload["state"], {"ok", "alerting"})
    threshold = require_nonnegative_int(payload["thresholdHours"])
    overdue = require_nonnegative_int(payload["overdueCount"])
    missing = require_nonnegative_int(payload["missingSubmittedAtCount"])
    oldest = payload["oldestPendingAgeSeconds"]
    if oldest is not None:
        oldest = require_nonnegative_int(oldest)
    if (
        threshold != 24
        or (state == "alerting") != (overdue > 0)
        or (overdue > 0 and (oldest is None or oldest < threshold * 3600))
        or (oldest is None and overdue != 0)
        or (oldest is not None and oldest > threshold * 3600 and overdue == 0)
    ):
        raise ContractError()
    return state, parse_utc(payload["observedAt"]), {
        "thresholdHours": threshold,
        "overdueCount": overdue,
        "oldestPendingAgeSeconds": oldest,
        "missingSubmittedAtCount": missing,
    }


def validate_settle(payload):
    fields = {
        "signal", "state", "maxAttempts", "currentExhaustedCount",
        "unexpectedContextCount", "providerOutcome", "observedAt",
    }
    require_exact_fields(payload, fields)
    if payload["signal"] != "payment.settle_exhausted":
        raise ContractError()
    state = require_choice(payload["state"], {"ok", "alerting", "unknown"})
    maximum = require_nonnegative_int(payload["maxAttempts"])
    exhausted = require_nonnegative_int(payload["currentExhaustedCount"])
    unexpected = require_nonnegative_int(payload["unexpectedContextCount"])
    expected_state = "alerting" if exhausted > 0 else "unknown" if unexpected > 0 else "ok"
    if (
        maximum != 10
        or state != expected_state
        or payload["providerOutcome"] != "not_determined_by_source"
    ):
        raise ContractError()
    return state, parse_utc(payload["observedAt"]), {
        "maxAttempts": maximum,
        "currentExhaustedCount": exhausted,
        "unexpectedContextCount": unexpected,
        "providerOutcome": "not_determined_by_source",
    }


def validate_push(payload, configuration):
    count_fields = (
        "completedFanoutCount", "deviceAckCount", "unacknowledgedCount",
        "latencySampleCount", "negativeLatencyCount", "outboxDeadCount",
        "closedWithoutRecordedFanoutCount", "missingNotificationForClosedOutboxCount",
    )
    fields = {
        "signal", "state", "window", "observedAt", "ackLatencyP95Ms",
        "providerAcceptance", "delivery", *count_fields,
    }
    require_exact_fields(payload, fields)
    if payload["signal"] != "push.offer_observation" or payload["state"] != "observed":
        raise ContractError()
    require_exact_fields(payload["window"], {"from", "to"})
    if payload["window"] != {"from": configuration.window_from, "to": configuration.window_to}:
        raise ContractError()
    counts = {field: require_nonnegative_int(payload[field]) for field in count_fields}
    p95 = payload["ackLatencyP95Ms"]
    if p95 is not None:
        p95 = require_nonnegative_number(p95)
    if (
        counts["deviceAckCount"] + counts["unacknowledgedCount"]
        != counts["completedFanoutCount"]
        or counts["latencySampleCount"] + counts["negativeLatencyCount"]
        != counts["deviceAckCount"]
        or (counts["latencySampleCount"] == 0) != (p95 is None)
        or payload["providerAcceptance"] != "not_observed"
        or payload["delivery"] != "not_determined_by_source"
    ):
        raise ContractError()
    metrics = {field: counts[field] for field in count_fields[:5]}
    metrics["ackLatencyP95Ms"] = p95
    for field in count_fields[5:]:
        metrics[field] = counts[field]
    metrics["providerAcceptance"] = "not_observed"
    metrics["delivery"] = "not_determined_by_source"
    return "observed", parse_utc(payload["observedAt"]), metrics


def validate_noshow(payload, configuration):
    fields = {
        "signal", "state", "window", "observedAt", "cohortCompletedCount",
        "clientNoShowOutcomeCount", "outcomeCounts", "completedWithoutOutcomeCount",
        "completedWithoutEndedAtCountAllTime",
    }
    require_exact_fields(payload, fields)
    if payload["signal"] != "consultation.client_no_show_observation" or payload["state"] != "observed":
        raise ContractError()
    require_exact_fields(payload["window"], {"from", "to"})
    if payload["window"] != {"from": configuration.window_from, "to": configuration.window_to}:
        raise ContractError()
    outcome_fields = ("COMPLETED", "CLIENT_CANCELLED", "TECH_ISSUE", "EXPERT_CANCELLED")
    require_exact_fields(payload["outcomeCounts"], outcome_fields)
    cohort = require_nonnegative_int(payload["cohortCompletedCount"])
    client_no_show = require_nonnegative_int(payload["clientNoShowOutcomeCount"])
    outcomes = {
        field: require_nonnegative_int(payload["outcomeCounts"][field])
        for field in outcome_fields
    }
    missing = require_nonnegative_int(payload["completedWithoutOutcomeCount"])
    missing_ended = require_nonnegative_int(payload["completedWithoutEndedAtCountAllTime"])
    if client_no_show + sum(outcomes.values()) + missing != cohort:
        raise ContractError()
    return "observed", parse_utc(payload["observedAt"]), {
        "cohortCompletedCount": cohort,
        "clientNoShowOutcomeCount": client_no_show,
        "outcomeCounts": outcomes,
        "completedWithoutOutcomeCount": missing,
        "completedWithoutEndedAtCountAllTime": missing_ended,
    }


VALIDATORS = {
    "verification": validate_verification,
    "settle": validate_settle,
    "push": validate_push,
    "noshow": validate_noshow,
}


def empty_source(collection):
    return {"collection": collection, "state": None, "observedAt": None, "metrics": {}}


def request_target(source, configuration):
    path = SOURCE_PATHS[source]
    if source not in {"push", "noshow"}:
        return path
    query = urllib.parse.urlencode(
        (("from", configuration.window_from), ("to", configuration.window_to))
    )
    return f"{path}?{query}"


def collect_source(source, configuration, whole_deadline):
    remaining = whole_deadline - time.monotonic()
    if remaining <= 0:
        return empty_source("error"), "request_failed"
    request_started = utc_now()
    try:
        response = get_response(
            configuration.origin.scheme,
            configuration.origin.host,
            configuration.origin.port,
            request_target(source, configuration),
            configuration.tokens[source],
            CONNECT_TIMEOUT_SECONDS,
            min(SOURCE_TIMEOUT_SECONDS, remaining),
        )
        response_received = utc_now()
    except (
        OSError,
        http.client.HTTPException,
        ssl.SSLError,
        TimeoutError,
        RequestDeadlineExceeded,
    ):
        return empty_source("error"), "request_failed"
    except Exception:
        return empty_source("error"), "request_failed"
    if response.status != 200:
        return empty_source("error"), "http_status"
    if response.too_large:
        return empty_source("error"), "contract_mismatch"
    try:
        payload = decode_json(response.body)
        validator = VALIDATORS[source]
        if source in {"push", "noshow"}:
            state, observed_at, metrics = validator(payload, configuration)
        else:
            state, observed_at, metrics = validator(payload)
    except (ContractError, KeyError, TypeError, ValueError, OverflowError):
        return empty_source("error"), "contract_mismatch"
    if not (
        request_started - FRESHNESS_TOLERANCE
        <= observed_at
        <= response_received + FRESHNESS_TOLERANCE
    ):
        return empty_source("stale"), "stale"
    return {
        "collection": "observed",
        "state": state,
        "observedAt": payload["observedAt"],
        "metrics": metrics,
    }, None


def emit(record):
    print(json.dumps(record, ensure_ascii=True, allow_nan=False, separators=(",", ":")))


def configuration_failure(collected_at):
    emit(
        {
            "schema": SCHEMA,
            "collectedAt": format_utc(collected_at),
            "window": None,
            "overall": "unknown",
            "sources": {
                source: empty_source("error") for source in SOURCE_ORDER
            },
        }
    )
    print("collector: configuration_error", file=sys.stderr)
    return 2


def main(argv=None):
    collector_now = utc_now()
    whole_deadline = time.monotonic() + WHOLE_RUN_TIMEOUT_SECONDS
    configuration = None
    sources = {}
    errors = []
    try:
        with wall_clock_deadline(WHOLE_RUN_TIMEOUT_SECONDS):
            configuration = build_configuration(argv, collector_now)
            for source in SOURCE_ORDER:
                result, error_code = collect_source(
                    source, configuration, whole_deadline
                )
                sources[source] = result
                if error_code is not None:
                    errors.append((source, error_code))
    except ConfigurationError:
        return configuration_failure(collector_now)
    except RequestDeadlineExceeded:
        if configuration is None:
            return configuration_failure(collector_now)
        for source in SOURCE_ORDER:
            if source not in sources:
                sources[source] = empty_source("error")
                errors.append((source, "request_failed"))

    unknown = any(value["collection"] != "observed" for value in sources.values())
    unknown = unknown or sources["settle"]["state"] == "unknown"
    alerting = any(sources[name]["state"] == "alerting" for name in ("verification", "settle"))
    overall = "unknown" if unknown else "alerting" if alerting else "ok"
    record = {
        "schema": SCHEMA,
        "collectedAt": format_utc(utc_now()),
        "window": {"from": configuration.window_from, "to": configuration.window_to},
        "overall": overall,
        "sources": sources,
    }
    emit(record)
    for source, error_code in errors:
        print(f"{source}: {error_code}", file=sys.stderr)
    return {"ok": 0, "alerting": 1, "unknown": 2}[overall]


if __name__ == "__main__":
    sys.exit(main())
