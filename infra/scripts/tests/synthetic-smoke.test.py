#!/usr/bin/env python3

import contextlib
import http.server
import socket
import subprocess
import threading
import time
import unittest
from pathlib import Path


RUNNER = Path(__file__).resolve().parents[1] / "synthetic-smoke.py"
HEALTHY = b'{"status":"ok","db":"ok","redis":"ok"}'


class FixtureServer(http.server.ThreadingHTTPServer):
    daemon_threads = True


@contextlib.contextmanager
def fixture_server(routes):
    requests = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            status, headers, body, delay = routes.get(
                self.path,
                (404, {"Content-Type": "text/plain"}, b"not found", 0),
            )
            if delay:
                time.sleep(delay)
            self.send_response(status)
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
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


def run_smoke(*args):
    return subprocess.run(
        [str(RUNNER), *args],
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
            result = run_smoke("--base-url", origin)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "synthetic-smoke: OK health=ok web=skipped\n")
        self.assertEqual(requests, ["/v1/health"])

    def test_dependency_failure_is_not_reported_as_healthy(self):
        secret_body = b'{"status":"unhealthy","detail":"do-not-print"}'
        with fixture_server(
            {"/v1/health": (503, {"Content-Type": "application/json"}, secret_body, 0)}
        ) as (origin, _requests):
            result = run_smoke("--base-url", origin)

        self.assertEqual(result.returncode, 4)
        self.assertIn("health=http_status expected=200 actual=503", result.stderr)
        self.assertNotIn("do-not-print", result.stdout + result.stderr)

    def test_total_timeout_bounds_a_stalled_response(self):
        with fixture_server(
            {"/v1/health": (200, {"Content-Type": "application/json"}, HEALTHY, 0.8)}
        ) as (origin, _requests):
            started = time.monotonic()
            result = run_smoke(
                "--base-url",
                origin,
                "--connect-timeout",
                "0.1",
                "--total-timeout",
                "0.2",
            )
            elapsed = time.monotonic() - started

        self.assertEqual(result.returncode, 3)
        self.assertIn("health=request_failed", result.stderr)
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
                    result = run_smoke("--base-url", origin)

                self.assertEqual(result.returncode, 5)
                self.assertIn("health=contract_mismatch", result.stderr)
                self.assertNotIn(body.decode("utf-8", errors="ignore"), result.stderr)

    def test_redirect_is_not_followed(self):
        with fixture_server(
            {
                "/v1/health": (302, {"Location": "/redirected"}, b"", 0),
                "/redirected": (200, {"Content-Type": "application/json"}, HEALTHY, 0),
            }
        ) as (origin, requests):
            result = run_smoke("--base-url", origin)

        self.assertEqual(result.returncode, 4)
        self.assertIn("health=http_status expected=200 actual=302", result.stderr)
        self.assertEqual(requests, ["/v1/health"])

    def test_refused_connection_is_a_transport_failure(self):
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        host, port = sock.getsockname()
        sock.close()

        result = run_smoke(
            "--base-url",
            f"http://{host}:{port}",
            "--connect-timeout",
            "0.1",
            "--total-timeout",
            "0.2",
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
                "--base-url",
                origin,
                "--web-url",
                f"{origin}/ru",
                "--web-marker",
                "SMART_QOLDAU",
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
                "--base-url",
                origin,
                "--web-url",
                f"{origin}/ru",
                "--web-marker",
                "PUBLIC_MARKER",
            )

        self.assertEqual(result.returncode, 8)
        self.assertIn("web=marker_missing", result.stderr)
        self.assertNotIn("private-body", result.stdout + result.stderr)

    def test_bad_input_is_rejected_without_leaking_credentials(self):
        credential_url = "http://operator:super-secret@127.0.0.1:1"
        cases = [
            ["--base-url", "ftp://example.invalid"],
            ["--base-url", credential_url],
            ["--base-url", "http://127.0.0.1:1/path"],
            ["--base-url", "http://127.0.0.1:1", "--web-url", "http://127.0.0.1:1/"],
            [
                "--base-url",
                "http://127.0.0.1:1",
                "--web-url",
                "http://example.invalid/неэкранировано",
                "--web-marker",
                "PUBLIC_MARKER",
            ],
        ]
        for args in cases:
            with self.subTest(args=args):
                result = run_smoke(*args)
                self.assertEqual(result.returncode, 2)
                self.assertIn("configuration_error", result.stderr)
                self.assertNotIn("super-secret", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
