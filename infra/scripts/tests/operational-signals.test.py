#!/usr/bin/env python3
"""Local-only contract tests for the bounded operational signal collector."""

import contextlib
import datetime as dt
import http.server
import importlib.util
import json
import os
from pathlib import Path
import socket
import ssl
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
import urllib.parse


RUNNER = Path(__file__).resolve().parents[1] / "operational-signals.py"
UTC = dt.timezone.utc
SOURCE_PATHS = {
    "verification": "/v1/admin/verification/operational-signal",
    "settle": "/v1/admin/payments/operational-signal",
    "push": "/v1/admin/notifications/push-observation",
    "noshow": "/v1/admin/consultations/no-show-observation",
}
TOKENS = {
    "verification": "verify-fixture-token",
    "settle": "settle-fixture-token",
    "push": "push-fixture-token",
    "noshow": "noshow-fixture-token",
}


def utc_text(value):
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def valid_payloads(window_from, window_to, observed_at=None):
    observed_at = observed_at or utc_text(dt.datetime.now(UTC))
    return {
        "verification": {
            "signal": "verification.queue_over_24h",
            "state": "ok",
            "thresholdHours": 24,
            "overdueCount": 0,
            "oldestPendingAgeSeconds": None,
            "missingSubmittedAtCount": 1,
            "observedAt": observed_at,
        },
        "settle": {
            "signal": "payment.settle_exhausted",
            "state": "ok",
            "maxAttempts": 10,
            "currentExhaustedCount": 0,
            "unexpectedContextCount": 0,
            "providerOutcome": "not_determined_by_source",
            "observedAt": observed_at,
        },
        "push": {
            "signal": "push.offer_observation",
            "state": "observed",
            "window": {"from": window_from, "to": window_to},
            "observedAt": observed_at,
            "completedFanoutCount": 7,
            "deviceAckCount": 5,
            "unacknowledgedCount": 2,
            "latencySampleCount": 4,
            "negativeLatencyCount": 1,
            "ackLatencyP95Ms": 1250.5,
            "outboxDeadCount": 0,
            "closedWithoutRecordedFanoutCount": 1,
            "missingNotificationForClosedOutboxCount": 0,
            "providerAcceptance": "not_observed",
            "delivery": "not_determined_by_source",
        },
        "noshow": {
            "signal": "consultation.client_no_show_observation",
            "state": "observed",
            "window": {"from": window_from, "to": window_to},
            "observedAt": observed_at,
            "cohortCompletedCount": 10,
            "clientNoShowOutcomeCount": 2,
            "outcomeCounts": {
                "COMPLETED": 5,
                "CLIENT_CANCELLED": 1,
                "TECH_ISSUE": 1,
                "EXPERT_CANCELLED": 0,
            },
            "completedWithoutOutcomeCount": 1,
            "completedWithoutEndedAtCountAllTime": 0,
        },
    }


class FixtureServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


@contextlib.contextmanager
def fixture_server(responder, *, tls_context=None):
    requests = []

    class Handler(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            requests.append(
                {
                    "method": self.command,
                    "path": self.path,
                    "authorization": self.headers.get("Authorization"),
                    "accept": self.headers.get("Accept"),
                    "cookie": self.headers.get("Cookie"),
                }
            )
            status, headers, body, header_delay, body_delay = responder(self)
            if header_delay:
                time.sleep(header_delay)
            self.send_response(status)
            for name, value in headers.items():
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body_delay:
                self.wfile.flush()
                time.sleep(body_delay)
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
                pass

        def log_message(self, _format, *_args):
            pass

    server = FixtureServer(("127.0.0.1", 0), Handler)
    if tls_context is not None:
        server.socket = tls_context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        scheme = "https" if tls_context is not None else "http"
        yield f"{scheme}://{host}:{port}", requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        if thread.is_alive():
            raise AssertionError("fixture server thread leaked")


def json_responder(payloads, overrides=None):
    overrides = overrides or {}

    def respond(handler):
        parsed = urllib.parse.urlsplit(handler.path)
        source = next((name for name, path in SOURCE_PATHS.items() if path == parsed.path), None)
        override = overrides.get(source)
        if override is not None:
            if callable(override):
                return override(handler)
            return override
        if source is None:
            return 404, {"Content-Type": "text/plain"}, b"not found", 0, 0
        return (
            200,
            {"Content-Type": "application/json"},
            json.dumps(payloads[source], separators=(",", ":")).encode("utf-8"),
            0,
            0,
        )

    return respond


def load_collector():
    module_name = "operational_signals_test_module"
    spec = importlib.util.spec_from_file_location(module_name, RUNNER)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


class OperationalSignalsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="qoldau-signals-test-")
        self.work = Path(self.temporary.name)
        now = dt.datetime.now(UTC)
        self.window_from = utc_text(now - dt.timedelta(hours=1))
        self.window_to = utc_text(now - dt.timedelta(minutes=1))
        self.credential_paths = {}
        for source, token in TOKENS.items():
            path = self.work / f"{source}.bearer"
            path.write_text(token + "\n", encoding="ascii")
            path.chmod(0o600)
            self.credential_paths[source] = path

    def tearDown(self):
        self.temporary.cleanup()

    def arguments(self, origin, *extra):
        arguments = [
            "--base-url",
            origin,
            "--from",
            self.window_from,
            "--to",
            self.window_to,
            "--verification-bearer-file",
            str(self.credential_paths["verification"]),
            "--settle-bearer-file",
            str(self.credential_paths["settle"]),
            "--push-bearer-file",
            str(self.credential_paths["push"]),
            "--noshow-bearer-file",
            str(self.credential_paths["noshow"]),
        ]
        if origin.startswith("http://"):
            arguments.append("--allow-http-loopback")
        arguments.extend(extra)
        return arguments

    def run_collector(self, origin, *extra, environment=None, timeout=12):
        clean_environment = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONDONTWRITEBYTECODE": "1",
            "LC_ALL": "C.UTF-8",
        }
        if environment:
            clean_environment.update(environment)
        return subprocess.run(
            [sys.executable, str(RUNNER), *self.arguments(origin, *extra)],
            env=clean_environment,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )

    def assert_config_failure(self, arguments, *, secret=None):
        result = subprocess.run(
            [sys.executable, str(RUNNER), *arguments],
            env={"PATH": os.environ.get("PATH", ""), "PYTHONDONTWRITEBYTECODE": "1"},
            text=True,
            capture_output=True,
            timeout=3,
            check=False,
        )
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(result.stderr, "collector: configuration_error\n")
        record = json.loads(result.stdout)
        self.assertEqual(
            set(record), {"schema", "collectedAt", "overall", "code"}
        )
        self.assertEqual(record["schema"], "qoldau-operational-signals/config-error/v1")
        self.assertEqual(record["overall"], "unknown")
        self.assertEqual(record["code"], "configuration_error")
        if secret:
            self.assertNotIn(secret, result.stdout + result.stderr)

    def test_success_uses_four_fixed_gets_matching_credentials_and_exact_window(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        with fixture_server(json_responder(payloads)) as (origin, requests):
            result = self.run_collector(
                origin,
                environment={
                    "HTTP_PROXY": "http://127.0.0.1:1",
                    "HTTPS_PROXY": "http://127.0.0.1:1",
                    "NETRC": str(self.work / "must-not-be-read"),
                    "VERIFICATION_BEARER": "environment-token-must-not-be-used",
                },
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        self.assertTrue(result.stdout.endswith("\n"))
        self.assertEqual(result.stdout.count("\n"), 1)
        record = json.loads(result.stdout)
        self.assertEqual(
            list(record), ["schema", "collectedAt", "window", "overall", "sources"]
        )
        self.assertEqual(record["schema"], "qoldau-operational-signals/v1")
        self.assertEqual(record["window"], {"from": self.window_from, "to": self.window_to})
        self.assertEqual(record["overall"], "ok")
        self.assertEqual(list(record["sources"]), ["verification", "settle", "push", "noshow"])
        self.assertEqual(len(requests), 4)
        for request, source in zip(requests, SOURCE_PATHS):
            parsed = urllib.parse.urlsplit(request["path"])
            self.assertEqual(request["method"], "GET")
            self.assertEqual(parsed.path, SOURCE_PATHS[source])
            self.assertEqual(request["authorization"], f"Bearer {TOKENS[source]}")
            self.assertEqual(request["accept"], "application/json")
            self.assertIsNone(request["cookie"])
            if source in {"push", "noshow"}:
                self.assertEqual(
                    urllib.parse.parse_qs(parsed.query, strict_parsing=True),
                    {"from": [self.window_from], "to": [self.window_to]},
                )
            else:
                self.assertEqual(parsed.query, "")
        for sensitive in (*TOKENS.values(), "environment-token-must-not-be-used"):
            self.assertNotIn(sensitive, result.stdout + result.stderr)

        verification = record["sources"]["verification"]
        self.assertEqual(verification["collection"], "observed")
        self.assertEqual(verification["state"], "ok")
        self.assertEqual(
            verification["metrics"],
            {
                "thresholdHours": 24,
                "overdueCount": 0,
                "oldestPendingAgeSeconds": None,
                "missingSubmittedAtCount": 1,
            },
        )
        self.assertEqual(
            record["sources"]["settle"]["metrics"],
            {
                "maxAttempts": 10,
                "currentExhaustedCount": 0,
                "unexpectedContextCount": 0,
                "providerOutcome": "not_determined_by_source",
            },
        )
        self.assertEqual(
            record["sources"]["push"]["metrics"],
            {
                "completedFanoutCount": 7,
                "deviceAckCount": 5,
                "unacknowledgedCount": 2,
                "latencySampleCount": 4,
                "negativeLatencyCount": 1,
                "ackLatencyP95Ms": 1250.5,
                "outboxDeadCount": 0,
                "closedWithoutRecordedFanoutCount": 1,
                "missingNotificationForClosedOutboxCount": 0,
                "providerAcceptance": "not_observed",
                "delivery": "not_determined_by_source",
            },
        )
        self.assertEqual(
            record["sources"]["noshow"]["metrics"],
            {
                "cohortCompletedCount": 10,
                "clientNoShowOutcomeCount": 2,
                "outcomeCounts": {
                    "COMPLETED": 5,
                    "CLIENT_CANCELLED": 1,
                    "TECH_ISSUE": 1,
                    "EXPERT_CANCELLED": 0,
                },
                "completedWithoutOutcomeCount": 1,
                "completedWithoutEndedAtCountAllTime": 0,
            },
        )

    def test_alert_states_pass_through_and_verification_alerts_overall(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        payloads["verification"].update(
            state="alerting", overdueCount=2, oldestPendingAgeSeconds=90000
        )
        payloads["settle"].update(
            state="alerting", currentExhaustedCount=1, unexpectedContextCount=2
        )
        with fixture_server(json_responder(payloads)) as (origin, _requests):
            result = self.run_collector(origin)

        record = json.loads(result.stdout)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(record["overall"], "alerting")
        self.assertEqual(record["sources"]["verification"]["state"], "alerting")
        self.assertEqual(record["sources"]["settle"]["state"], "alerting")

    def test_settle_unknown_dominates_alerting(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        payloads["verification"].update(
            state="alerting", overdueCount=1, oldestPendingAgeSeconds=86401
        )
        payloads["settle"].update(state="unknown", unexpectedContextCount=1)
        with fixture_server(json_responder(payloads)) as (origin, _requests):
            result = self.run_collector(origin)

        record = json.loads(result.stdout)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(record["overall"], "unknown")
        self.assertEqual(record["sources"]["verification"]["state"], "alerting")
        self.assertEqual(record["sources"]["settle"]["state"], "unknown")

    def test_push_and_noshow_counts_never_create_alerting(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        payloads["push"].update(
            completedFanoutCount=100,
            deviceAckCount=0,
            unacknowledgedCount=100,
            latencySampleCount=0,
            negativeLatencyCount=0,
            ackLatencyP95Ms=None,
            outboxDeadCount=100,
            closedWithoutRecordedFanoutCount=100,
            missingNotificationForClosedOutboxCount=100,
        )
        payloads["noshow"].update(
            cohortCompletedCount=100,
            clientNoShowOutcomeCount=99,
            outcomeCounts={
                "COMPLETED": 0,
                "CLIENT_CANCELLED": 0,
                "TECH_ISSUE": 0,
                "EXPERT_CANCELLED": 0,
            },
            completedWithoutOutcomeCount=1,
        )
        with fixture_server(json_responder(payloads)) as (origin, _requests):
            result = self.run_collector(origin)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["overall"], "ok")

    def test_http_status_redirect_and_oversize_are_fail_closed_and_private(self):
        secret = "private-response-body-identifier-and-amount-9000"
        cases = {
            "status": (401, {"Content-Type": "application/json"}, secret.encode(), 0, 0),
            "redirect": (302, {"Location": "/v1/login"}, b"redirect-secret", 0, 0),
            "oversize": (200, {"Content-Type": "application/json"}, b"x" * (64 * 1024 + 1), 0, 0),
        }
        for name, override in cases.items():
            with self.subTest(name=name):
                payloads = valid_payloads(self.window_from, self.window_to)
                with fixture_server(json_responder(payloads, {"verification": override})) as (
                    origin,
                    requests,
                ):
                    result = self.run_collector(origin)
                record = json.loads(result.stdout)
                source = record["sources"]["verification"]
                self.assertEqual(result.returncode, 2)
                self.assertEqual(record["overall"], "unknown")
                self.assertEqual(
                    source,
                    {"collection": "error", "state": None, "observedAt": None, "metrics": {}},
                )
                self.assertNotIn(secret, result.stdout + result.stderr)
                if name == "redirect":
                    self.assertEqual(len(requests), 4)
                    self.assertFalse(any(r["path"] == "/v1/login" for r in requests))
                expected = "http_status" if name in {"status", "redirect"} else "contract_mismatch"
                self.assertIn(f"verification: {expected}", result.stderr)

    def test_contract_rejects_wrong_fields_duplicates_nonfinite_bool_and_invariants(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        cases = []
        cases.append(("missing", {k: v for k, v in payloads["verification"].items() if k != "overdueCount"}))
        cases.append(("extra", {**payloads["settle"], "paymentId": "private-id"}))
        cases.append(("wrong_signal", {**payloads["push"], "signal": "push.other"}))
        cases.append(("bool_count", {**payloads["noshow"], "clientNoShowOutcomeCount": True}))
        cases.append(("verification_state", {**payloads["verification"], "state": "ok", "overdueCount": 1, "oldestPendingAgeSeconds": 90000}))
        cases.append(("verification_oldest", {**payloads["verification"], "state": "ok", "overdueCount": 0, "oldestPendingAgeSeconds": 90000}))
        cases.append(("verification_utc", {**payloads["verification"], "observedAt": "2026-01-01T00:00:00+00:00"}))
        cases.append(("settle_state", {**payloads["settle"], "state": "ok", "unexpectedContextCount": 1}))
        cases.append(("push_sum", {**payloads["push"], "unacknowledgedCount": 3}))
        cases.append(("noshow_sum", {**payloads["noshow"], "cohortCompletedCount": 11}))
        cases.append(("window", {**payloads["push"], "window": {"from": self.window_from, "to": self.window_from}}))
        for name, bad_payload in cases:
            with self.subTest(name=name):
                source = (
                    "verification" if "verification" in name or name == "missing" else
                    "settle" if "settle" in name or name == "extra" else
                    "push" if "push" in name or name == "window" or name == "wrong_signal" else
                    "noshow"
                )
                current = valid_payloads(self.window_from, self.window_to)
                current[source] = bad_payload
                with fixture_server(json_responder(current)) as (origin, _requests):
                    result = self.run_collector(origin)
                record = json.loads(result.stdout)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(record["sources"][source]["collection"], "error")
                self.assertEqual(record["sources"][source]["metrics"], {})
                self.assertIn(f"{source}: contract_mismatch", result.stderr)
                self.assertNotIn("private-id", result.stdout + result.stderr)

        duplicate = b'{"signal":"payment.settle_exhausted","signal":"private-duplicate","state":"ok","maxAttempts":10,"currentExhaustedCount":0,"unexpectedContextCount":0,"providerOutcome":"not_determined_by_source","observedAt":"2026-01-01T00:00:00Z"}'
        current = valid_payloads(self.window_from, self.window_to)
        with fixture_server(
            json_responder(current, {"settle": (200, {"Content-Type": "application/json"}, duplicate, 0, 0)})
        ) as (origin, _requests):
            result = self.run_collector(origin)
        self.assertEqual(result.returncode, 2)
        self.assertIn("settle: contract_mismatch", result.stderr)
        self.assertNotIn("private-duplicate", result.stdout + result.stderr)

        nonfinite = json.dumps(current["push"]).replace("1250.5", "NaN").encode()
        with fixture_server(
            json_responder(current, {"push": (200, {"Content-Type": "application/json"}, nonfinite, 0, 0)})
        ) as (origin, _requests):
            result = self.run_collector(origin)
        self.assertEqual(result.returncode, 2)
        self.assertIn("push: contract_mismatch", result.stderr)

    def test_malformed_json_utf8_and_all_common_http_failures_are_safe(self):
        cases = [
            (403, b'{"error":"forbidden-freeform"}', "http_status"),
            (429, b'{"error":"rate-freeform"}', "http_status"),
            (500, b'{"error":"server-freeform"}', "http_status"),
            (200, b'{"signal":', "contract_mismatch"),
            (200, b'\xff\xfe', "contract_mismatch"),
        ]
        for status, body, error_code in cases:
            with self.subTest(status=status, body=body[:10]):
                payloads = valid_payloads(self.window_from, self.window_to)
                override = (status, {"Content-Type": "application/json"}, body, 0, 0)
                with fixture_server(json_responder(payloads, {"noshow": override})) as (
                    origin,
                    _requests,
                ):
                    result = self.run_collector(origin)
                self.assertEqual(result.returncode, 2)
                self.assertIn(f"noshow: {error_code}", result.stderr)
                for fragment in ("forbidden-freeform", "rate-freeform", "server-freeform"):
                    self.assertNotIn(fragment, result.stdout + result.stderr)

    def test_response_limit_accepts_exactly_64_kib(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        encoded = json.dumps(payloads["verification"], separators=(",", ":")).encode()
        exact = encoded + b" " * (64 * 1024 - len(encoded))
        override = (200, {"Content-Type": "application/json"}, exact, 0, 0)
        with fixture_server(json_responder(payloads, {"verification": override})) as (
            origin,
            _requests,
        ):
            result = self.run_collector(origin)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_stale_and_future_observations_hide_state_and_metrics(self):
        for name, offset in (("stale", -120), ("future", 120)):
            with self.subTest(name=name):
                observed_at = utc_text(dt.datetime.now(UTC) + dt.timedelta(seconds=offset))
                payloads = valid_payloads(self.window_from, self.window_to)
                payloads["verification"].update(
                    state="alerting",
                    overdueCount=1,
                    oldestPendingAgeSeconds=90000,
                    observedAt=observed_at,
                )
                with fixture_server(json_responder(payloads)) as (origin, _requests):
                    result = self.run_collector(origin)
                source = json.loads(result.stdout)["sources"]["verification"]
                self.assertEqual(result.returncode, 2)
                self.assertEqual(
                    source,
                    {"collection": "stale", "state": None, "observedAt": None, "metrics": {}},
                )
                self.assertEqual(result.stderr, "verification: stale\n")

    def test_mixed_alert_and_failure_preserves_alert_source_but_overall_unknown(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        payloads["verification"].update(
            state="alerting", overdueCount=3, oldestPendingAgeSeconds=100000
        )
        secret = b'{"error":"do-not-copy"}'
        override = (503, {"Content-Type": "application/json"}, secret, 0, 0)
        with fixture_server(json_responder(payloads, {"push": override})) as (origin, _requests):
            result = self.run_collector(origin)
        record = json.loads(result.stdout)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(record["overall"], "unknown")
        self.assertEqual(record["sources"]["verification"]["state"], "alerting")
        self.assertEqual(record["sources"]["push"]["state"], None)
        self.assertNotIn("do-not-copy", result.stdout + result.stderr)

    def test_all_configuration_and_credentials_are_validated_before_network(self):
        payloads = valid_payloads(self.window_from, self.window_to)
        with fixture_server(json_responder(payloads)) as (origin, requests):
            bad = self.credential_paths["noshow"]
            bad.chmod(0o640)
            self.assert_config_failure(self.arguments(origin), secret=TOKENS["noshow"])
            self.assertEqual(requests, [])

        bad_cases = []
        directory = self.work / "directory-token"
        directory.mkdir()
        directory.chmod(0o600)
        bad_cases.append(directory)
        symlink = self.work / "symlink-token"
        symlink.symlink_to(self.credential_paths["push"])
        bad_cases.append(symlink)
        oversize = self.work / "oversize-token"
        oversize.write_bytes(b"x" * (8 * 1024 + 1))
        oversize.chmod(0o600)
        bad_cases.append(oversize)
        multiline = self.work / "multiline-token"
        multiline.write_text("first\nsecond\n", encoding="ascii")
        multiline.chmod(0o600)
        bad_cases.append(multiline)
        nonascii = self.work / "nonascii-token"
        nonascii.write_bytes("секрет".encode("utf-8"))
        nonascii.chmod(0o600)
        bad_cases.append(nonascii)

        for bad in bad_cases:
            with self.subTest(path=bad.name):
                arguments = self.arguments("http://127.0.0.1:9")
                index = arguments.index("--verification-bearer-file") + 1
                arguments[index] = str(bad)
                self.assert_config_failure(arguments)

    def test_invalid_origins_and_windows_fail_without_network_or_secret_echo(self):
        secret = "argv-secret-must-not-echo"
        collector = load_collector()
        for origin in (
            "http://example.com",
            "https://bad_host.example",
            "https://-bad.example",
        ):
            with self.subTest(origin=origin):
                with self.assertRaises(collector.ConfigurationError):
                    collector.parse_origin(origin, True)

        origins = [
            "http://localhost:1234",
            "https://user:password@127.0.0.1:9",
            "https://127.0.0.1:9/path",
            "https://127.0.0.1:9?query=1",
            "https://127.0.0.1:9?",
            "https://127.0.0.1:9/#fragment",
            "https://127.0.0.1:9#",
            "https://127.0.0.1:99999",
            "https://2001:db8::1",
            "https://[fe80::1%25eth0]",
        ]
        for origin in origins:
            with self.subTest(origin=origin):
                self.assert_config_failure(self.arguments(origin), secret="password")

        windows = [
            (self.window_to, self.window_from),
            ("2026-01-01T00:00:00+00:00", self.window_to),
            ("not-a-date", self.window_to),
            (utc_text(dt.datetime.now(UTC) - dt.timedelta(hours=25)), self.window_to),
            (self.window_from, utc_text(dt.datetime.now(UTC) + dt.timedelta(minutes=5))),
        ]
        payloads = valid_payloads(self.window_from, self.window_to)
        with fixture_server(json_responder(payloads)) as (origin, requests):
            for window_from, window_to in windows:
                with self.subTest(window=(window_from, window_to)):
                    arguments = self.arguments(origin)
                    arguments[arguments.index("--from") + 1] = window_from
                    arguments[arguments.index("--to") + 1] = window_to
                    self.assert_config_failure(arguments)
            self.assertEqual(requests, [])

        with fixture_server(json_responder(payloads)) as (origin, requests):
            duplicated = self.arguments(origin)
            duplicated.extend(["--from", self.window_from])
            self.assert_config_failure(duplicated)
            self.assertEqual(requests, [])

        self.assert_config_failure(
            self.arguments("https://127.0.0.1:9", "--bearer", secret),
            secret=secret,
        )

    def test_connection_failure_is_unknown_without_exception_text(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        host, port = sock.getsockname()
        sock.close()
        result = self.run_collector(f"http://{host}:{port}")
        record = json.loads(result.stdout)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(record["overall"], "unknown")
        self.assertEqual(result.stderr.count("request_failed"), 4)
        self.assertNotIn("Connection refused", result.stderr)

    def test_transport_deadline_bounds_dns_headers_and_body(self):
        collector = load_collector()

        def stalled_dns(*_args, **_kwargs):
            time.sleep(0.8)

        started = time.monotonic()
        with mock.patch.object(socket, "getaddrinfo", side_effect=stalled_dns):
            with self.assertRaises(collector.RequestDeadlineExceeded):
                collector.get_response(
                    "http", "127.0.0.1", 9, "/", "token", 0.1, 0.2
                )
        self.assertLess(time.monotonic() - started, 0.6)

        def stalled_connect(*_args, **_kwargs):
            time.sleep(0.8)

        started = time.monotonic()
        with mock.patch.object(socket, "create_connection", side_effect=stalled_connect):
            with self.assertRaises(collector.RequestDeadlineExceeded):
                collector.get_response(
                    "http", "127.0.0.1", 9, "/", "token", 0.1, 0.2
                )
        self.assertLess(time.monotonic() - started, 0.6)

        with mock.patch.object(collector, "get_response") as request:
            configuration = collector.Configuration(
                collector.Origin("http", "127.0.0.1", 9),
                self.window_from,
                self.window_to,
                dict(TOKENS),
            )
            source, error = collector.collect_source(
                "verification", configuration, time.monotonic() - 1
            )
        self.assertEqual(source["collection"], "error")
        self.assertEqual(error, "request_failed")
        request.assert_not_called()

        for name, header_delay, body_delay in (("headers", 0.8, 0), ("body", 0, 0.8)):
            with self.subTest(name=name):
                def responder(_handler):
                    return 200, {"Content-Type": "application/json"}, b"{}", header_delay, body_delay

                with fixture_server(responder) as (origin, _requests):
                    parts = urllib.parse.urlsplit(origin)
                    started = time.monotonic()
                    with self.assertRaises(collector.RequestDeadlineExceeded):
                        collector.get_response(
                            parts.scheme,
                            parts.hostname,
                            parts.port,
                            "/",
                            "token",
                            0.1,
                            0.2,
                        )
                    self.assertLess(time.monotonic() - started, 0.6)

    def test_https_verifies_certificates_and_accepts_a_trusted_local_fixture(self):
        cert = self.work / "cert.pem"
        key = self.work / "key.pem"
        openssl = subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(key), "-out", str(cert), "-days", "1",
                "-subj", "/CN=127.0.0.1",
                "-addext", "subjectAltName=IP:127.0.0.1",
            ],
            text=True,
            capture_output=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(openssl.returncode, 0, openssl.stderr)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert, key)
        payloads = valid_payloads(self.window_from, self.window_to)
        with fixture_server(json_responder(payloads), tls_context=context) as (origin, _requests):
            untrusted = self.run_collector(origin)
            trusted = self.run_collector(origin, environment={"SSL_CERT_FILE": str(cert)})

        self.assertEqual(untrusted.returncode, 2)
        self.assertEqual(untrusted.stderr.count("request_failed"), 4)
        self.assertEqual(trusted.returncode, 0, trusted.stderr)
        self.assertEqual(json.loads(trusted.stdout)["overall"], "ok")


if __name__ == "__main__":
    unittest.main(verbosity=2)
