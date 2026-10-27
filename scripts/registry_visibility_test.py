#!/usr/bin/env python3
"""Exercise OCI HEAD response handling over a real loopback HTTP connection."""

import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest

import registry_visibility as visibility


REPO = "local/console"
INDEX = "application/vnd.oci.image.index.v1+json"
MANIFEST = "application/vnd.oci.image.manifest.v1+json"


def encoded(value):
    return json.dumps(value, separators=(",", ":")).encode()


def fixture(root):
    blobs = root / "blobs/sha256"
    blobs.mkdir(parents=True)

    def add(data, media):
        digest = "sha256:" + hashlib.sha256(data).hexdigest()
        (blobs / digest[7:]).write_bytes(data)
        return {"digest": digest, "size": len(data), "mediaType": media}

    config = add(b"{}", "application/vnd.oci.image.config.v1+json")
    manifest = add(encoded({"schemaVersion": 2, "mediaType": MANIFEST,
                            "config": config, "layers": []}), MANIFEST)
    index = add(encoded({"schemaVersion": 2, "mediaType": INDEX,
                         "manifests": [manifest]}), INDEX)
    (root / "index.json").write_bytes(encoded({"schemaVersion": 2, "manifests": [index]}))
    return index["digest"], {"manifests": {index["digest"]: index, manifest["digest"]: manifest},
                             "blobs": {config["digest"]: config}}


class RegistryHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        state = self.server.state
        if self.path == "/capture":
            state["redirectTargetContacts"] += 1
            self.send_response(200)
            self.end_headers()
            return
        if state["mode"] == "redirect":
            self.send_response(302)
            self.send_header("Location", f"http://127.0.0.1:{self.server.server_port}/capture")
            self.end_headers()
            return
        if state["mode"] == "auth":
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="fixture"')
            self.end_headers()
            return
        prefix = f"/v2/{REPO}/"
        if not self.path.startswith(prefix):
            self.send_error(404)
            return
        kind, _, name = self.path[len(prefix):].partition("/")
        if kind == "manifests" and name == "good":
            if state["mode"] == "first_missing" and state["first"]:
                state["first"] = False
                self.send_error(404)
                return
            name = state["wrong"] if state["mode"] == "wrong_tag" else state["expected"]
        if state["mode"] == "missing" or name not in state["entries"].get(kind, {}):
            self.send_error(404)
            return
        descriptor = state["entries"][kind][name]
        self.send_response(200)
        self.send_header("Docker-Content-Digest", descriptor["digest"])
        self.send_header("Content-Length", str(descriptor["size"]))
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/token-redirect?"):
            self.send_response(302)
            self.send_header("Location", f"http://127.0.0.1:{self.server.server_port}/capture")
            self.end_headers()
            return
        if self.path == "/capture":
            self.server.state["redirectTargetContacts"] += 1
        self.send_error(404)

    def log_message(self, *_args):
        pass


class VisibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.layout = Path(self.temp.name)
        self.digest, entries = fixture(self.layout)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), RegistryHandler)
        self.server.state = {"mode": "normal", "first": True, "expected": self.digest,
                             "wrong": next(d for d in entries["manifests"] if d != self.digest),
                             "entries": entries, "redirectTargetContacts": 0}
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 2)
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def test_exact_graph_and_temporary_not_found(self):
        self.server.state["mode"] = "first_missing"
        result = visibility.wait_visible(self.layout, self.base, REPO, "good", self.digest,
                                         seconds=1, interval=0.01)
        self.assertEqual((result["attempts"], result["graphObjects"]), (2, 3))

    def test_never_visible(self):
        self.server.state["mode"] = "missing"
        with self.assertRaisesRegex(ValueError, "never became visible"):
            visibility.wait_visible(self.layout, self.base, REPO, "good", self.digest, seconds=0)

    def test_wrong_digest_is_not_retried(self):
        self.server.state["mode"] = "wrong_tag"
        with self.assertRaisesRegex(ValueError, "identity or size differs"):
            visibility.wait_visible(self.layout, self.base, REPO, "good", self.digest, seconds=1)

    def test_authentication_error_is_not_retried(self):
        self.server.state["mode"] = "auth"
        with self.assertRaisesRegex(ValueError, "authentication challenge differs"):
            visibility.wait_visible(self.layout, self.base, REPO, "good", self.digest, seconds=1)

    def test_transport_error_is_not_retried(self):
        port = self.server.server_port
        self.server.shutdown()
        self.server.server_close()
        with self.assertRaisesRegex(ValueError, "transport error"):
            visibility.wait_visible(self.layout, f"http://127.0.0.1:{port}", REPO, "good", self.digest, seconds=1)

    def test_local_graph_change_is_refused(self):
        (self.layout / "blobs/sha256" / self.digest[7:]).write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "local OCI graph differs"):
            visibility.wait_visible(self.layout, self.base, REPO, "good", self.digest, seconds=1)

    def test_registry_redirect_does_not_forward_bearer(self):
        self.server.state["mode"] = "redirect"
        with self.assertRaisesRegex(ValueError, "registry HTTP status 302"):
            visibility.request(f"{self.base}/v2/{REPO}/manifests/good", token="fixture-bearer")
        self.assertEqual(self.server.state["redirectTargetContacts"], 0)

    def test_token_service_redirect_is_refused(self):
        with self.assertRaisesRegex(ValueError, "registry token HTTP status 302"):
            visibility.anonymous_token("repository:local/console:pull", self.base + "/token-redirect")
        self.assertEqual(self.server.state["redirectTargetContacts"], 0)


if __name__ == "__main__":
    unittest.main()
