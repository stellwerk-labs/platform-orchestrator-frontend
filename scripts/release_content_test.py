#!/usr/bin/env python3
"""Real filesystem/OCI fixtures and mandatory pinned scanner checks."""
import contextlib
import base64
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import random
import re
import shutil
import string
import subprocess
import tarfile
import tempfile
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("release_content", ROOT / "scripts/release_content.py")
content = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(content)
MODULE = "example.org/application"


def encoded(value):
    return json.dumps(value, sort_keys=True).encode()


def layer(entries, pax_metadata=None, trailing_bytes=b""):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w") as archive:
        for name, data in entries.items():
            entry = tarfile.TarInfo(name)
            entry.pax_headers = pax_metadata or {}
            entry.mode = 0o755 if name.startswith("app/docker/") else 0o644
            if isinstance(data, tuple):
                entry.type, entry.linkname = data
            else:
                entry.size = len(data)
            archive.addfile(entry, None if isinstance(data, tuple) else io.BytesIO(data))
    return raw.getvalue() + trailing_bytes


def gzip_member(raw, name=b"", comment=b"", extra=b"", header_crc=False):
    flags = (8 if name else 0) | (16 if comment else 0) | (4 if extra else 0) | (2 if header_crc else 0)
    header = b"\x1f\x8b\x08" + bytes([flags]) + b"\0" * 6
    if extra:
        header += len(extra).to_bytes(2, "little") + extra
    if name:
        header += name + b"\0"
    if comment:
        header += comment + b"\0"
    if header_crc:
        header += (zlib.crc32(header) & 0xffff).to_bytes(2, "little")
    compressor = zlib.compressobj(wbits=-15)
    return (header + compressor.compress(raw) + compressor.flush()
            + zlib.crc32(raw).to_bytes(4, "little") + (len(raw) & 0xffffffff).to_bytes(4, "little"))


def license_bundle():
    files = {"platform-orchestrator-frontend/LICENSE": b"application license",
             "packages/fixture@1.0.0/LICENSE": b"fixture license",
             "dependencies.json": encoded([{"name": "fixture", "version": "1.0.0",
                                            "identifier": "MIT", "text": "fixture license"}])}
    files["manifest.sha256"] = "".join(hashlib.sha256(data).hexdigest() + "  " + name + "\n"
                                      for name, data in sorted(files.items())).encode()
    result = {prefix + name: data for prefix in ("licenses/", "app/build/licenses/") for name, data in files.items()}
    runtime = b"fixture runtime license"
    result["licenses/runtime-apks/fixture/COPYING"] = runtime
    result["licenses/runtime-apks/manifest.json"] = encoded({
        "packages": [{"name": "fixture", "version": "1", "origin": "fixture"}],
        "sources": [{"origin": "fixture", "notices": [
            {"file": "fixture/COPYING", "sha256": hashlib.sha256(runtime).hexdigest()}]}],
    })
    result["licenses/base/nginx/COPYRIGHT"] = b"base nginx copyright"
    result["lib/apk/db/installed"] = b"P:fixture\nV:1\n"
    return result


def layout(root, extra=None, whiteout=False, mutate=None, missing_provenance=False,
           pax_metadata=None, trailing_bytes=b"", compress=None):
    root.mkdir()
    (root / "oci-layout").write_bytes(encoded({"imageLayoutVersion": "1.0.0"}))
    blobroot = root / "blobs/sha256"
    blobroot.mkdir(parents=True)
    def store(data, media):
        descriptor = {"mediaType": media, "digest": content.digest(data), "size": len(data)}
        (blobroot / descriptor["digest"][7:]).write_bytes(data)
        return descriptor
    manifests = []
    for arch in ("amd64", "arm64"):
        entries = license_bundle()
        entries.update({"app/build/index.html": b"application", "app/docker/entry-point.sh": b"#!/bin/sh",
                        "app/docker/init-env.sh": b"#!/bin/sh", "lib/apk/db/installed": b"P:fixture\nV:1\n",
                        "etc/nginx/conf.d/default.conf": b"server {}"})
        if extra:
            entries.update(extra)
        raws = [layer(entries, pax_metadata, trailing_bytes)]
        if whiteout:
            raws.append(layer({"app/build/.wh.removed": b""}))
        config = {"os": "linux", "architecture": arch, "config": {"User": "101", "Entrypoint": ["/docker-entrypoint.sh"], "Cmd": ["./docker/entry-point.sh"], "WorkingDir": "/app"},
                  "rootfs": {"type": "layers", "diff_ids": [content.digest(raw) for raw in raws]}}
        image = {"schemaVersion": 2, "config": store(encoded(config), "application/vnd.oci.image.config.v1+json"),
                 "layers": [store(compress(raw) if compress else gzip.compress(raw, mtime=0), "application/vnd.oci.image.layer.v1.tar+gzip") for raw in raws]}
        if mutate:
            mutate(arch, image, config, store)
        descriptor = store(encoded(image), "application/vnd.oci.image.manifest.v1+json")
        descriptor["platform"] = {"os": "linux", "architecture": arch}
        manifests.append(descriptor)
        statements = [{"_type": "https://in-toto.io/Statement/v0.1", "subject": [{"digest": {"sha256": descriptor["digest"][7:]}}],
                       "predicateType": kind, "predicate": {}} for kind in ("https://spdx.dev/Document", "https://slsa.dev/provenance/v0.2")]
        if missing_provenance:
            statements.pop()
        attestation = {"schemaVersion": 2, "config": store(b"{}", "application/vnd.oci.image.config.v1+json"),
                       "layers": [store(encoded(statement), "application/vnd.in-toto+json") for statement in statements]}
        attestation_descriptor = store(encoded(attestation), "application/vnd.oci.image.manifest.v1+json")
        attestation_descriptor.update(platform={"os": "unknown", "architecture": "unknown"},
                                      annotations={"vnd.docker.reference.type": "attestation-manifest",
                                                   "vnd.docker.reference.digest": descriptor["digest"]})
        manifests.append(attestation_descriptor)
    descriptor = store(encoded({"schemaVersion": 2, "manifests": manifests}), "application/vnd.oci.image.index.v1+json")
    descriptor["annotations"] = {"org.opencontainers.image.ref.name": "qualification"}
    (root / "index.json").write_bytes(encoded({"schemaVersion": 2, "manifests": [descriptor]}))


class ContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("gitleaks"):
            raise RuntimeError("pinned gitleaks is required, scanner checks must not skip")
        subprocess.run(["gitleaks", "version"], check=True, capture_output=True)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def export(self, **options):
        image, output = self.root / "image", self.root / "output"
        layout(image, **options)
        return content.export(image, output, ["amd64", "arm64"])

    def scanner(self, directory, source=ROOT):
        return subprocess.run(["bash", str(source / "scripts/scan-release-content.sh"), str(directory)],
                              text=True, capture_output=True, timeout=30)

    def test_platform_bytes_notices_and_attestations(self):
        report = self.export(extra={"etc/link": (tarfile.SYMTYPE, "/etc/certs"), "etc/certs": b"base certificate"})
        self.assertEqual(set(report["payloads"]), {"amd64", "arm64"})
        self.assertEqual(len(report["attestations"]), 2)
        self.assertEqual((self.root / "output/arm64/app/build/index.html").read_bytes(), b"application")
        self.assertFalse((self.root / "output/amd64/etc/link").exists())
        self.assertEqual(self.scanner(self.root / "output").returncode, 0)

    def test_traversal_fails(self):
        with self.assertRaises(ValueError):
            self.export(extra={"../escape": b"no"})

    def test_required_payload_link_ancestor_fails(self):
        with self.assertRaises(ValueError):
            self.export(extra={"app": (tarfile.SYMTYPE, "/other")})

    def test_missing_buildkit_provenance_fails(self):
        with self.assertRaises(ValueError):
            self.export(missing_provenance=True)

    def test_corrupt_blob_fails(self):
        image = self.root / "image"
        layout(image)
        next((image / "blobs/sha256").iterdir()).write_bytes(b"corrupt")
        with self.assertRaises(ValueError):
            content.export(image, self.root / "output", ["amd64", "arm64"])

    def test_notice_manifest_and_duplicate_bundle(self):
        files = license_bundle()
        self.assertTrue(content.notices(files))
        for name in ("licenses/packages/fixture@1.0.0/LICENSE", "app/build/licenses/dependencies.json"):
            broken = dict(files)
            del broken[name]
            with self.assertRaises(ValueError):
                content.notices(broken)
        files["licenses/packages/fixture@1.0.0/LICENSE"] += b"changed"
        files["app/build/licenses/packages/fixture@1.0.0/LICENSE"] += b"changed"
        with self.assertRaises(ValueError):
            content.notices(files)

    def test_runtime_notice_bytes_and_installed_version_are_bound(self):
        for name, replacement in (("licenses/runtime-apks/fixture/COPYING", b"changed"),
                                  ("lib/apk/db/installed", b"P:fixture\nV:2\n"),
                                  ("licenses/base/nginx/COPYRIGHT", b"")):
            files = license_bundle()
            files[name] = replacement
            with self.assertRaises(ValueError):
                content.notices(files)

    def test_startup_payload_link_fails(self):
        with self.assertRaises(ValueError):
            self.export(extra={"app/docker/entry-point.sh": (tarfile.SYMTYPE, "/elsewhere")})

    def test_startup_config_fails(self):
        def change(arch, image, config, store):
            config["config"]["User"] = "0"
            image["config"] = store(encoded(config), "application/vnd.oci.image.config.v1+json")
        with self.assertRaises(ValueError):
            self.export(mutate=change)

    def test_platform_compare_ignores_only_envelope_variance(self):
        report = self.export()
        other = dict(report, index="sha256:" + "f" * 64, attestations=[])
        first, second = self.root / "first.json", self.root / "second.json"
        first.write_bytes(encoded(report))
        second.write_bytes(encoded(other))
        with contextlib.redirect_stdout(io.StringIO()) as output:
            content.compare(first, second)
        self.assertIn('"fullIndexIdentical": false', output.getvalue())
        other["payloads"]["amd64"]["layers"] = []
        second.write_bytes(encoded(other))
        with self.assertRaises(ValueError):
            content.compare(first, second)

    def test_real_binary_and_whiteout_secret_scans(self):
        token = "ghp_" + "".join(random.Random(17).sample(string.ascii_letters + string.digits, 36))
        self.export(extra={"app/build/removed": b"\x7fELF\0" + token.encode() + b"\0"}, whiteout=True)
        result = self.scanner(self.root / "output")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_exact_public_apk_marker_records_only(self):
        directory = self.root / "apk-markers"
        directory.mkdir()
        file = directory / "content"
        marker = b"laiNgeiThu6ip1Tf"
        records = [key + b"=" + marker for key in (b"APK_PREUPGRADE_TOKEN", b"APK_SELFUPGRADE_TOKEN")]
        for record in records:
            for separator in (b"\n", b"\0"):
                file.write_bytes(separator + record + separator)
                self.assertEqual(self.scanner(directory).returncode, 0)
                for changed in (record[:-1], record[:-1] + b"e", record + b"x", b"X" + record):
                    file.write_bytes(separator + changed + separator)
                    self.assertNotEqual(self.scanner(directory).returncode, 0)
                file.write_bytes(separator + record + separator + b"secret=" + b"8Zp7Xa5yT2k9Nc4m" + separator)
                self.assertNotEqual(self.scanner(directory).returncode, 0)
        file.write_bytes(b"\0OTHER_TOKEN=" + marker + b"\0")
        self.assertNotEqual(self.scanner(directory).returncode, 0)

    def test_gzip_optional_metadata_in_every_oci_member_is_scanned(self):
        seed = ("ghp_" + "".join(random.Random(41).sample(string.ascii_letters + string.digits, 36))).encode()
        for field in ("name", "comment", "extra"):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def compress(raw):
                    return gzip_member(raw[:512], name=b"public-base-layer", header_crc=True) + gzip_member(
                        raw[512:], header_crc=True, **{field: seed + b" # gitleaks:allow"})
                layout(root / "image", compress=compress)
                content.export(root / "image", root / "output", ["amd64", "arm64"])
                result = self.scanner(root / "output")
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(seed.decode(), result.stdout + result.stderr)

    def test_gzip_member_validation_and_bounds(self):
        first = gzip_member(b"first", name=b"base", comment=b"public", extra=b"metadata", header_crc=True)
        second = gzip_member(b"second")
        raw, metadata = content.decode_gzip_members(first + b"\0\0" + second + b"\0")
        self.assertEqual(raw, b"firstsecond")
        self.assertIn(b"base\0public\0", metadata)
        self.assertIn(b"metadata", metadata)
        self.assertTrue(metadata.endswith(b"\0"))
        for malformed in (b"", b"\0" + first, first[:-1], first + b"not-gzip", first[:3] + b"\xe0" + first[4:],
                          first[:-8] + bytes([first[-8] ^ 1]) + first[-7:],
                          first[:-4] + bytes([first[-4] ^ 1]) + first[-3:],
                          first[:10] + b"\xff\xff" + first[12:],
                          gzip_member(b"data", name=b"name")[:12]):
            with self.subTest(malformed=hashlib.sha256(malformed).hexdigest()), self.assertRaises(ValueError):
                content.decode_gzip_members(malformed)
        for options in ({"max_output": 4}, {"max_metadata": 8}, {"max_members": 1}, {"max_members": 0}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                content.decode_gzip_members(first + second, **options)

    def test_oci_tar_pax_and_trailing_bytes_are_scanned(self):
        token = "ghp_" + "".join(random.Random(43).sample(string.ascii_letters + string.digits, 36))
        for options in ({"pax_metadata": {"public.metadata": token + " # gitleaks:allow"}},
                        {"trailing_bytes": b"\0" + token.encode() + b"\0"}):
            with self.subTest(options=tuple(options)), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                layout(root / "image", **options)
                content.export(root / "image", root / "output", ["amd64", "arm64"])
                result = self.scanner(root / "output")
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(token, result.stdout + result.stderr)

    def test_compressed_archive_tar_and_gzip_metadata_are_scanned(self):
        seed = ("ghp_" + "".join(random.Random(47).sample(string.ascii_letters + string.digits, 36))).encode()
        for kind in ("pax", "trailing", "name", "comment", "extra"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                raw = layer({"notice": b"public"},
                            pax_metadata={"public.metadata": seed.decode() + " # gitleaks:allow"} if kind == "pax" else None,
                            trailing_bytes=b"\0" + seed + b"\0" if kind == "trailing" else b"")
                options = {kind: seed} if kind in ("name", "comment", "extra") else {}
                data = gzip_member(raw[:512], header_crc=True) + gzip_member(raw[512:], header_crc=True, **options)
                (root / "payload.tar.gz").write_bytes(data)
                result = self.scanner(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn(seed.decode(), result.stdout + result.stderr)

    def test_archive_metadata_has_aggregate_byte_bound(self):
        directory = self.root / "shipping"
        directory.mkdir()
        for name in ("first.tar", "second.tar"):
            (directory / name).write_bytes(layer({}))
        with self.assertRaises(ValueError):
            content.unpack(directory, self.root / "unpacked", self.root / "metadata", max_bytes=15000)

    def test_artifact_inline_allow_directives_cannot_suppress_secrets(self):
        token = "ghp_" + "".join(random.Random(31).sample(string.ascii_letters + string.digits, 36))
        for binary in (False, True):
            directory = self.root / ("binary-directive" if binary else "text-directive")
            directory.mkdir()
            (directory / "content").write_bytes((b"\0" if binary else b"") + token.encode()
                                                + b" # gitleaks:allow\n")
            result = self.scanner(directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn(token, result.stdout + result.stderr)


    def test_artifact_ignore_file_cannot_suppress_secrets(self):
        directory = self.root / "ignore-file"
        directory.mkdir()
        token = "ghp_" + "".join(random.Random(37).sample(string.ascii_letters + string.digits, 36))
        (directory / "secret.txt").write_text(token + "\n")
        command = ["gitleaks", "dir", "--redact", "--no-banner", "--log-level", "error",
                   "--config", str(ROOT / "scripts/gitleaks.toml"), "--report-format", "json",
                   "--report-path", "-", "."]
        result = subprocess.run(command, cwd=directory, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        findings = json.loads(result.stdout)
        self.assertTrue(findings)
        (directory / ".gitleaksignore").write_text("\n".join(finding["Fingerprint"] for finding in findings) + "\n")
        self.assertEqual(subprocess.run(command, cwd=directory, capture_output=True, timeout=10).returncode, 0)
        result = self.scanner(directory)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(token, result.stdout + result.stderr)


    def test_secret_in_artifact_filename_fails_without_exception(self):
        directory = self.root / "path-secret"
        directory.mkdir()
        token = "ghp_" + "".join(random.Random(41).sample(string.ascii_letters + string.digits, 36))
        (directory / token).write_text("Harmless content.\n")
        result = self.scanner(directory)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(token, result.stdout + result.stderr)


    def test_verified_oci_references_and_sbom_platform_copy(self):
        report = self.export()
        image = self.root / "image"
        self.assertEqual(content.oci_reference(image, report["index"]), "qualification")
        with self.assertRaises(ValueError):
            content.oci_reference(image, "sha256:" + "0" * 64)
        index = json.loads((image / "index.json").read_bytes())
        changed = json.loads(encoded(index))
        changed["manifests"][0]["mediaType"] = "application/octet-stream"
        (image / "index.json").write_bytes(encoded(changed))
        with self.assertRaises(ValueError):
            content.oci_reference(image, report["index"])
        (image / "index.json").write_bytes(encoded(index))
        selected = self.root / "selected-platform"
        shutil.copytree(image, selected)
        inner = json.loads(content.blob(image, index["manifests"][0]))
        platform = next(item for item in inner["manifests"] if item["platform"] == {"os": "linux", "architecture": "amd64"})
        (selected / "index.json").write_bytes(encoded({"schemaVersion": 2, "manifests": [platform]}))
        content.validate_sbom_layout(selected, report["payloads"]["amd64"]["manifest"])
        with self.assertRaises(ValueError):
            content.validate_sbom_layout(selected, report["payloads"]["arm64"]["manifest"])
        platform["mediaType"] = "application/octet-stream"
        (selected / "index.json").write_bytes(encoded({"schemaVersion": 2, "manifests": [platform]}))
        with self.assertRaises(ValueError):
            content.validate_sbom_layout(selected, report["payloads"]["amd64"]["manifest"])


    def test_missing_input_and_private_reference_fail_closed(self):
        self.assertNotEqual(self.scanner(self.root / "absent").returncode, 0)
        directory = self.root / "scan"
        directory.mkdir()
        (directory / "text").write_text("/" + "Users/" + "private-user/project")
        self.assertNotEqual(self.scanner(directory).returncode, 0)


    def test_scanner_rejects_symlinks(self):
        directory = self.root / "scan"
        directory.mkdir()
        (directory / "link").symlink_to(self.root / "elsewhere")
        self.assertNotEqual(self.scanner(directory).returncode, 0)


    def test_private_reference_in_relative_path_fails_without_echo(self):
        directory = self.root / "scan"
        nested = directory / "seeded-private-owner-fixture"
        nested.mkdir(parents=True)
        (nested / "NOTICE").write_text("Harmless content.\\n")
        with self.assertRaises(ValueError):
            content.scan(directory, ["seeded-private-owner-fixture"])


    def test_archive_scans_metadata_paths_and_refuses_links(self):
        for number, entries in enumerate(({"notes.txt": b"/" + b"Users/private-user/work"},
                                           {"hidden": (tarfile.SYMTYPE, "/outside")},
                                           {"../escape": b"harmless"})):
            directory = self.root / str(number)
            directory.mkdir()
            (directory / "asset.tar.gz").write_bytes(gzip.compress(layer(entries), mtime=0))
            self.assertNotEqual(self.scanner(directory).returncode, 0)

    def test_only_complete_svg_rendering_paths_ignore_short_ids(self):
        coordinate = b"C" + b"13"
        valid = b"M0 0 " + coordinate + b".2,2 3,4 5,6 Q22,1 2,3 Z"
        self.assertTrue(content.svg_path(valid))
        for bad in (coordinate + b",2", b"M0 " + coordinate + b",2", b"M,0 0 " + coordinate + b",2",
                    b"M0 0 " + coordinate + b",2", b"M0 0 A1 2 0 7 9 3 4"):
            self.assertFalse(content.svg_path(bad))
        directory = self.root / "svg"
        directory.mkdir()
        file = directory / "asset.svg"
        file.write_bytes(b'<path d="' + valid + b'"/>')
        self.assertEqual(self.scanner(directory).returncode, 0)
        for suffix in (b" " + b"C" + b"01", b" /" + b"Users/private-user/source"):
            file.write_bytes(b'<path d="' + valid + b'"/>' + suffix)
            self.assertNotEqual(self.scanner(directory).returncode, 0)
        file.write_bytes(encoded({"sourcesContent": ['path = "' + valid.decode() + '";']}))
        self.assertEqual(self.scanner(directory).returncode, 0)
        file.write_bytes(encoded({"sourcesContent": ['path = "' + valid.decode() + '"; ' + "C" + "01"]}))
        self.assertNotEqual(self.scanner(directory).returncode, 0)

    def test_embedded_images_are_bounded_decoded_and_secret_scanned(self):
        directory = self.root / "images"
        directory.mkdir()
        file = directory / "asset.svg"
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF3sAAAAASUVORK5CYII=")
        def write(data):
            file.write_bytes(b'<image href="data:image/png;base64,' + base64.b64encode(data) + b'"/>')
        write(png)
        self.assertEqual(self.scanner(directory).returncode, 0)
        token = "ghp_" + "".join(random.Random(53).sample(string.ascii_letters + string.digits, 36))
        for seed in (token.encode(), b"/" + b"Users/private-user/work"):
            write(png[:-12] + seed + png[-12:])
            result = self.scanner(directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn(token, result.stdout + result.stderr)
        write(b"not an image " + b"C" + b"01")
        self.assertNotEqual(self.scanner(directory).returncode, 0)
        file.write_bytes(b'<image href="data:image/png;base64,NOT!BASE64"/>')
        self.assertNotEqual(self.scanner(directory).returncode, 0)

    def test_only_exact_apk_sha1_records_ignore_short_ids(self):
        directory = self.root / "apk-records"
        directory.mkdir()
        file = directory / "installed"
        checksum = b"AAAA/" + b"C" + b"01/" + b"A" * 18 + b"="
        self.assertEqual(len(base64.b64decode(checksum, validate=True)), 20)
        file.write_bytes(b"Z:Q1" + checksum + b"\n")
        self.assertEqual(self.scanner(directory).returncode, 0)
        for data in (b"Z:Q1" + checksum[:-1], b"P:" + checksum,
                     b"Z:Q1" + checksum + b"\n" + b"C" + b"01"):
            file.write_bytes(data)
            self.assertNotEqual(self.scanner(directory).returncode, 0)
        file.write_bytes(b"Z:Q1" + checksum + b"\n/" + b"Users/private-user/work")
        self.assertNotEqual(self.scanner(directory).returncode, 0)

    def test_bounded_archive_decompression(self):
        directory = self.root / "archive"
        directory.mkdir()
        (directory / "asset.tar.gz").write_bytes(gzip.compress(layer({"large": b"x" * 4000}), mtime=0))
        with self.assertRaises(ValueError):
            content.unpack(directory, self.root / "unpacked", max_bytes=1000)


if __name__ == "__main__":
    unittest.main()
