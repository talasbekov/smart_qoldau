#!/usr/bin/env python3

import contextlib
import http.server
import importlib.util
import os
import socket
import subprocess
import sys
import threading
import time
import unittest
from unittest import mock
from pathlib import Path


RUNNER = Path(__file__).resolve().parents[1] / "synthetic-smoke.py"
HEALTHY = b'{"status":"ok","db":"ok","redis":"ok"}'
SMOKE_ENVIRONMENT_KEYS = {
    "SMOKE_BASE_URL",
    "SMOKE_WEB_URL",
    "SMOKE_WEB_MARKER",
    "SMOKE_CONNECT_TIMEOUT",
    "SMOKE_TOTAL_TIMEOUT",
}


class FixtureServer(http.server.ThreadingHTTPServer):
    daemon_threads = True


@contextlib.contextmanager
def fixture_server(routes):
    requests = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            route = routes.get(
                self.path,
                (404, {"Content-Type": "text/plain"}, b"not found", 0),
            )
            status, headers, body, delay = route[:4]
            body_delay = route[4] if len(route) == 5 else 0
            if delay:
                time.sleep(delay)
            self.send_response(status)
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            if body_delay:
                self.wfile.flush()
                time.sleep(body_delay)
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, _format, *_args):
            pass

    server = FixtureServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}", requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def run_smoke(configuration, *args):
    environment = os.environ.copy()
    for name in SMOKE_ENVIRONMENT_KEYS:
        environment.pop(name, None)
    environment.update(configuration)
    return subprocess.run(
        [str(RUNNER), *args],
        env=environment,
        text=True,
        capture_output=True,
        timeout=4,
        check=False,
    )


class SyntheticSmokeTest(unittest.TestCase):
    def test_healthy_contract_succeeds(self):
        with fixture_server(
            {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0)}
        ) as (origin, requests):
            result = run_smoke({"SMOKE_BASE_URL": origin})

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "synthetic-smoke: OK health=ok web=skipped\n")
        self.assertEqual(requests, ["/v1/health"])

    def test_dependency_failure_is_not_reported_as_healthy(self):
        secret_body = b'{"status":"unhealthy","detail":"do-not-print"}'
        with fixture_server(
            {"/v1/health": (503, {"Content-Type": "application/json"}, secret_body, 0)}
        ) as (origin, _requests):
            result = run_smoke({"SMOKE_BASE_URL": origin})

        self.assertEqual(result.returncode, 4)
        self.assertIn("health=http_status expected=200 actual=503", result.stderr)
        self.assertNotIn("do-not-print", result.stdout + result.stderr)

    def test_total_timeout_bounds_a_stalled_response(self):
        with fixture_server(
            {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0.8)}
        ) as (origin, _requests):
            started = time.monotonic()
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_CONNECT_TIMEOUT": "0.1",
                    "SMOKE_TOTAL_TIMEOUT": "0.2",
                }
            )
            elapsed = time.monotonic() - started

        self.assertEqual(result.returncode, 3)
        self.assertIn("health=request_failed", result.stderr)
        self.assertLess(elapsed, 0.7)

    def test_total_timeout_bounds_a_stalled_response_body(self):
        with fixture_server(
            {
                "/v1/health": (
                    200,
                    {"Content-Type": "application/json"},
                    HEALTHY,
                    0,
                    0.8,
                )
            }
        ) as (origin, _requests):
            started = time.monotonic()
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_CONNECT_TIMEOUT": "0.1",
                    "SMOKE_TOTAL_TIMEOUT": "0.2",
                }
            )
            elapsed = time.monotonic() - started

        self.assertEqual(result.returncode, 3)
        self.assertIn("health=request_failed", result.stderr)
        self.assertLess(elapsed, 0.7)

    def test_total_timeout_bounds_dns_resolution(self):
        module_name = "synthetic_smoke_deadline_test"
        spec = importlib.util.spec_from_file_location(module_name, RUNNER)
        smoke = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = smoke
        previous_bytecode_setting = sys.dont_write_bytecode
        sys.dont_write_bytecode = True
        try:
            spec.loader.exec_module(smoke)
        finally:
            sys.dont_write_bytecode = previous_bytecode_setting

        def stall_resolution(*_args, **_kwargs):
            time.sleep(0.8)

        started = time.monotonic()
        try:
            with mock.patch.object(socket, "getaddrinfo", side_effect=stall_resolution):
                with self.assertRaises(smoke.RequestDeadlineExceeded):
                    smoke.get("http://example.invalid/v1/health", 0.1, 0.2)
        finally:
            sys.modules.pop(module_name, None)
        elapsed = time.monotonic() - started

        self.assertLess(elapsed, 0.7)

    def test_non_contract_bodies_fail_closed(self):
        cases = {
            "malformed": b'{"status":',
            "html": b"<html>healthy</html>",
            "incomplete": b'{"status":"ok","db":"ok"}',
            "extra_field": b'{"status":"ok","db":"ok","redis":"ok","debug":true}',
        }
        for name, body in cases.items():
            with self.subTest(name=name):
                with fixture_server(
                    {"/v1/health": (200, {"Content-Type": "application/json"}, body, 0)}
                ) as (origin, _requests):
                    result = run_smoke({"SMOKE_BASE_URL": origin})

                self.assertEqual(result.returncode, 5)
                self.assertIn("health=contract_mismatch", result.stderr)
                self.assertNotIn(body.decode("utf-8", errors="ignore"), result.stderr)

    def test_duplicate_health_member_names_fail_closed(self):
        ambiguous = b'{"status":"bad","status":"ok","db":"ok","redis":"ok"}'
        with fixture_server(
            {"/v1/health": (200, {"Content-Type": "application/json"}, ambiguous, 0)}
        ) as (origin, _requests):
            result = run_smoke({"SMOKE_BASE_URL": origin})

        self.assertEqual(result.returncode, 5)
        self.assertIn("health=contract_mismatch", result.stderr)
        self.assertNotIn("bad", result.stdout + result.stderr)

    def test_redirect_is_not_followed(self):
        with fixture_server(
            {
                "/v1/health": (302, {"Location": "/redirected"}, b"", 0),
                "/redirected": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
            }
        ) as (origin, requests):
            result = run_smoke({"SMOKE_BASE_URL": origin})

        self.assertEqual(result.returncode, 4)
        self.assertIn("health=http_status expected=200 actual=302", result.stderr)
        self.assertEqual(requests, ["/v1/health"])

    def test_refused_connection_is_a_transport_failure(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        host, port = sock.getsockname()
        sock.close()

        result = run_smoke(
            {
                "SMOKE_BASE_URL": f"http://{host}:{port}",
                "SMOKE_CONNECT_TIMEOUT": "0.1",
                "SMOKE_TOTAL_TIMEOUT": "0.2",
            }
        )

        self.assertEqual(result.returncode, 3)
        self.assertIn("health=request_failed", result.stderr)

    def test_optional_web_marker_is_checked(self):
        with fixture_server(
            {
                "/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
                "/ru": (200, {"Content-Type": "text/html"}, b"<main>SMART_QOLDAU</main>", 0),
            }
        ) as (origin, requests):
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_WEB_URL": f"{origin}/ru",
                    "SMOKE_WEB_MARKER": "SMART_QOLDAU",
                }
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "synthetic-smoke: OK health=ok web=ok\n")
        self.assertEqual(requests, ["/v1/health", "/ru"])

    def test_missing_web_marker_fails_without_echoing_body(self):
        with fixture_server(
            {
                "/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
                "/ru": (200, {"Content-Type": "text/html"}, b"private-body", 0),
            }
        ) as (origin, _requests):
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_WEB_URL": f"{origin}/ru",
                    "SMOKE_WEB_MARKER": "PUBLIC_MARKER",
                }
            )

        self.assertEqual(result.returncode, 8)
        self.assertIn("web=marker_missing", result.stderr)
        self.assertNotIn("private-body", result.stdout + result.stderr)
        self.assertNotIn("PUBLIC_MARKER", result.stdout + result.stderr)

    def test_web_response_limit_is_exactly_256_kib(self):
        marker = b"PUBLIC_MARKER"
        cases = [
            ("at_limit", b"x" * (256 * 1024 - len(marker)) + marker, 0),
            ("over_limit", marker + b"x" * (256 * 1024 + 1 - len(marker)), 8),
        ]
        for name, body, expected_exit in cases:
            with self.subTest(name=name):
                with fixture_server(
                    {
                        "/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
                        "/ru": (200, {"Content-Type": "text/html"}, body, 0),
                    }
                ) as (origin, _requests):
                    result = run_smoke(
                        {
                            "SMOKE_BASE_URL": origin,
                            "SMOKE_WEB_URL": f"{origin}/ru",
                            "SMOKE_WEB_MARKER": marker.decode("ascii"),
                        }
                    )

                self.assertEqual(result.returncode, expected_exit, result.stderr)

    def test_bad_input_is_rejected_without_leaking_credentials(self):
        credential_url = "http://operator:super-secret@127.0.0.1:1"
        cases = [
            {"SMOKE_BASE_URL": "ftp://example.invalid"},
            {"SMOKE_BASE_URL": credential_url},
            {"SMOKE_BASE_URL": "http://127.0.0.1:1/path"},
            {
                "SMOKE_BASE_URL": "http://127.0.0.1:1",
                "SMOKE_WEB_URL": "http://127.0.0.1:1/",
            },
            {
                "SMOKE_BASE_URL": "http://127.0.0.1:1",
                "SMOKE_WEB_URL": "http://example.invalid/неэкранировано",
                "SMOKE_WEB_MARKER": "PUBLIC_MARKER",
            },
        ]
        for configuration in cases:
            with self.subTest(configuration=configuration):
                result = run_smoke(configuration)
                self.assertEqual(result.returncode, 2)
                self.assertIn("configuration_error", result.stderr)
                self.assertNotIn("super-secret", result.stdout + result.stderr)

    def test_malformed_web_urls_are_rejected_before_health_request(self):
        malformed_paths = [
            "/%ZZ",
            "/literal space",
            "/control\x7f",
            "/bad\\path",
            '/bad"quote',
            "/bad<less",
            "/bad>greater",
            "/bad{open",
            "/bad}close",
            "/bad|pipe",
            "/bad^caret",
            "/bad`tick",
            "/page#",
        ]
        for path in malformed_paths:
            with self.subTest(path=repr(path)):
                with fixture_server(
                    {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0)}
                ) as (origin, requests):
                    result = run_smoke(
                        {
                            "SMOKE_BASE_URL": origin,
                            "SMOKE_WEB_URL": f"{origin}{path}",
                            "SMOKE_WEB_MARKER": "PUBLIC_MARKER",
                        }
                    )

                self.assertEqual(result.returncode, 2)
                self.assertIn("configuration_error", result.stderr)
                self.assertNotIn(path, result.stdout + result.stderr)
                self.assertEqual(requests, [])

    def test_base_origin_with_empty_query_is_rejected_before_request(self):
        with fixture_server(
            {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0)}
        ) as (origin, requests):
            configured_origin = f"{origin}?"
            result = run_smoke({"SMOKE_BASE_URL": configured_origin})

        self.assertEqual(result.returncode, 2)
        self.assertIn("configuration_error", result.stderr)
        self.assertNotIn(configured_origin, result.stdout + result.stderr)
        self.assertEqual(requests, [])

    def test_percent_encoded_web_path_and_query_are_preserved(self):
        target = (
            "/caf%C3%A9/a%2Fb/%5C%22%3C%3E%7B%7D%7C%5E%60"
            "?next=%2Fok&label=a%20b"
        )
        with fixture_server(
            {
                "/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
                target: (200, {"Content-Type": "text/html"}, b"PUBLIC_MARKER", 0),
            }
        ) as (origin, requests):
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_WEB_URL": f"{origin}{target}",
                    "SMOKE_WEB_MARKER": "PUBLIC_MARKER",
                }
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(requests, ["/v1/health", target])

    def test_bracketed_ipv6_origin_is_not_rejected_when_ipv6_is_available(self):
        try:
            sock = socket.socket(socket.AF_INET6)
            sock.bind(("::1", 0))
        except OSError as error:
            self.skipTest(f"IPv6 loopback unavailable: {error}")
        host, port, *_rest = sock.getsockname()
        sock.close()

        result = run_smoke(
            {
                "SMOKE_BASE_URL": f"http://[{host}]:{port}",
                "SMOKE_CONNECT_TIMEOUT": "0.1",
                "SMOKE_TOTAL_TIMEOUT": "0.2",
            }
        )

        self.assertEqual(result.returncode, 3)
        self.assertIn("health=request_failed", result.stderr)

    def test_non_utf8_web_marker_is_rejected_before_health_request(self):
        with fixture_server(
            {
                "/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
                "/ru": (200, {"Content-Type": "text/html"}, b"PUBLIC_MARKER", 0),
            }
        ) as (origin, requests):
            result = run_smoke(
                {
                    "SMOKE_BASE_URL": origin,
                    "SMOKE_WEB_URL": f"{origin}/ru",
                    "SMOKE_WEB_MARKER": "PUBLIC_MARKER\udcff",
                }
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("configuration_error", result.stderr)
        self.assertNotIn("Traceback", result.stdout + result.stderr)
        self.assertEqual(requests, [])

    def test_timeout_values_above_scheduler_budget_are_rejected_before_request(self):
        for name in ("SMOKE_CONNECT_TIMEOUT", "SMOKE_TOTAL_TIMEOUT"):
            with self.subTest(name=name):
                with fixture_server(
                    {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0)}
                ) as (origin, requests):
                    result = run_smoke({"SMOKE_BASE_URL": origin, name: "5.1"})

                self.assertEqual(result.returncode, 2)
                self.assertIn("configuration_error", result.stderr)
                self.assertEqual(requests, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
