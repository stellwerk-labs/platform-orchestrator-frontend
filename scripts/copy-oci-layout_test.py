#!/usr/bin/env python3
"""copy-oci-layout.sh with the pinned ORAS against a real loopback registry.

The registry can lag like GHCR did for Data Plane v4.5.0-rc.3 (404 for the first read of a manifest it
has just accepted) or deny every push. ORAS talks plain HTTP to localhost, so no TLS fixture is needed.
"""

import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import unittest


SCRIPT = Path(__file__).with_name("copy-oci-layout.sh")
INDEX = "application/vnd.oci.image.index.v1+json"
MANIFEST = "application/vnd.oci.image.manifest.v1+json"
UNKNOWN = b'{"errors":[{"code":"MANIFEST_UNKNOWN","message":"manifest unknown"}]}'
DENIED = b'{"errors":[{"code":"DENIED","message":"denied"}]}'


def encoded(value):
    return json.dumps(value, separators=(",", ":")).encode()


def fixture(root):
    """A minimal index -> manifest -> config + layer layout tagged v1; returns the index digest."""
    blobs = root / "blobs/sha256"
    blobs.mkdir(parents=True)

    def add(data, media):
        digest = "sha256:" + hashlib.sha256(data).hexdigest()
        (blobs / digest[7:]).write_bytes(data)
        return {"mediaType": media, "digest": digest, "size": len(data)}

    config = add(b'{"architecture":"amd64","os":"linux"}', "application/vnd.oci.image.config.v1+json")
    layer = add(b"layer", "application/vnd.oci.image.layer.v1.tar+gzip")
    manifest = add(encoded({"schemaVersion": 2, "mediaType": MANIFEST,
                            "config": config, "layers": [layer]}), MANIFEST)
    manifest["platform"] = {"architecture": "amd64", "os": "linux"}
    index = add(encoded({"schemaVersion": 2, "mediaType": INDEX, "manifests": [manifest]}), INDEX)
    index["annotations"] = {"org.opencontainers.image.ref.name": "v1"}
    (root / "index.json").write_bytes(encoded({"schemaVersion": 2, "manifests": [index]}))
    (root / "oci-layout").write_text('{"imageLayoutVersion":"1.0.0"}')
    return index["digest"]


class RegistryHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def reply(self, code, headers=None, body=b""):
        self.send_response(code)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(length) if length else b""

    def route(self):
        state, path = self.server.state, self.path.split("?")[0]
        if path == "/v2/":
            return self.reply(200)
        if state["mode"] == "deny" and self.command in ("POST", "PUT"):
            self.read_body()
            return self.reply(403, {"Content-Type": "application/json"}, DENIED)
        upload = re.fullmatch(r"/v2/(.+)/blobs/uploads/(.*)", path)
        if upload and self.command == "POST":
            self.read_body()
            return self.reply(202, {"Location": f"/v2/{upload[1]}/blobs/uploads/session"})
        if upload and self.command == "PUT":
            data, digest = self.read_body(), re.search(r"digest=([^&]+)", self.path)[1].replace("%3A", ":")
            state["blobs"][digest] = data
            return self.reply(201, {"Docker-Content-Digest": digest})
        match = re.fullmatch(r"/v2/(.+)/(blobs|manifests)/(.+)", path)
        if not match:
            return self.reply(404)
        kind, reference = match[2], match[3]
        if kind == "blobs":
            if reference not in state["blobs"]:
                return self.reply(404)
            return self.reply(200, {"Docker-Content-Digest": reference}, state["blobs"][reference])
        if self.command == "PUT":
            data = self.read_body()
            digest = "sha256:" + hashlib.sha256(data).hexdigest()
            state["manifests"][digest] = (self.headers["Content-Type"], data)
            if not reference.startswith("sha256:"):
                state["tags"][reference] = digest
            if state["mode"] == "lag":
                state["lagging"].add(digest)
            return self.reply(201, {"Docker-Content-Digest": digest})
        digest = state["tags"].get(reference, reference)
        if digest not in state["manifests"] or (self.command == "GET" and digest in state["lagging"]):
            state["lagging"].discard(digest)
            return self.reply(404, {"Content-Type": "application/json"}, UNKNOWN)
        media, data = state["manifests"][digest]
        return self.reply(200, {"Docker-Content-Digest": digest, "Content-Type": media}, data)

    do_GET = do_HEAD = do_PUT = do_POST = route

    def log_message(self, *_args):
        pass


class CopyTests(unittest.TestCase):
    def copy(self, mode, source_tag="v1"):
        server = ThreadingHTTPServer(("127.0.0.1", 0), RegistryHandler)
        server.state = {"mode": mode, "blobs": {}, "manifests": {}, "tags": {}, "lagging": set()}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 2)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        with tempfile.TemporaryDirectory() as directory:
            root = fixture(Path(directory))
            destination = f"localhost:{server.server_port}/local/console:v1"
            result = subprocess.run(["bash", str(SCRIPT), f"{directory}:{source_tag}", destination],
                                    env=dict(os.environ, PUBLISH_RETRY_PAUSE_SECONDS="0"),
                                    capture_output=True, text=True, timeout=120)
        return server.state, root, result

    def test_copy_repeats_while_the_registry_lags_behind_its_push(self):
        state, root, result = self.copy("lag")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(state["tags"], {"v1": root})
        self.assertIn("copy attempt 1 of 6, retrying", result.stderr)

    def test_denied_push_is_not_repeated(self):
        state, _, result = self.copy("deny")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn("denied", result.stderr)
        self.assertNotIn("retrying", result.stderr)
        self.assertEqual(state["tags"], {})

    def test_missing_layout_tag_is_not_mistaken_for_registry_lag(self):
        # ORAS also ends this deterministic source error with "not found"; only the registry form retries.
        state, _, result = self.copy("normal", source_tag="v2")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertNotIn("retrying", result.stderr)
        self.assertEqual(state["tags"], {})


if __name__ == "__main__":
    unittest.main()
