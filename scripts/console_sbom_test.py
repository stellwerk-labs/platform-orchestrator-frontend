#!/usr/bin/env python3
"""Coverage and identity tests. Real Syft execution is a separate image gate."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("console_sbom", Path(__file__).with_name("console_sbom.py"))
sbom = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sbom)
MANIFEST = "sha256:" + "a" * 64


class SBOMTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "lib/apk/db").mkdir(parents=True)
        (self.root / "lib/apk/db/installed").write_text("P:nginx\nV:1.0-r0\n\nP:bash\nV:5.3-r1\n")
        (self.root / "licenses").mkdir()
        (self.root / "licenses/dependencies.json").write_text(json.dumps([
            {"name": "@example/bundled", "version": "2.0.0", "identifier": "MIT", "text": "original license"}
        ]))
        self.document = {"spdxVersion": "SPDX-2.3", "SPDXID": "SPDXRef-DOCUMENT", "creationInfo": {},
                         "packages": [{"name": "nginx", "versionInfo": "1.0-r0", "SPDXID": "SPDXRef-nginx"},
                                      {"name": "bash", "versionInfo": "5.3-r1", "SPDXID": "SPDXRef-bash"}]}
        self.path = self.root / "sbom.json"

    def complete(self, document=None, manifest=MANIFEST, arch="arm64"):
        self.path.write_text(json.dumps(document or self.document))
        sbom.complete(self.path, self.root, manifest, "0", arch)
        return json.loads(self.path.read_text())

    def test_exact_os_coverage_and_vite_inventory_subject(self):
        result = self.complete()
        self.assertEqual(len(result["packages"]), 3)
        bundled = result["packages"][-1]
        self.assertEqual(bundled["name"], "@example/bundled")
        self.assertEqual(bundled["licenseDeclared"], "MIT")
        self.assertEqual(bundled["licenseConcluded"], "NOASSERTION")
        self.assertFalse(bundled["filesAnalyzed"])
        self.assertEqual(bundled["externalRefs"][0]["referenceLocator"], "pkg:npm/%40example/bundled@2.0.0")
        self.assertIn(MANIFEST.replace(":", "/"), result["documentNamespace"])
        self.assertEqual(result["creationInfo"]["created"], "1970-01-01T00:00:00Z")
        self.assertIn("not inferred by Syft", result["documentComment"])
        first = self.path.read_bytes()
        self.complete()
        self.assertEqual(self.path.read_bytes(), first)

    def test_missing_or_different_os_package_refused(self):
        for packages in (self.document["packages"][:1],
                         [dict(item, versionInfo="different") for item in self.document["packages"]]):
            with self.assertRaises(ValueError):
                self.complete(dict(self.document, packages=packages))

    def test_duplicate_or_missing_js_notice_refused(self):
        path = self.root / "licenses/dependencies.json"
        catalogue = json.loads(path.read_text())
        for entries in (catalogue * 2, [dict(catalogue[0], text="")]):
            path.write_text(json.dumps(entries))
            with self.assertRaises(ValueError):
                self.complete()

    def test_invalid_subject_and_wrong_spdx_version_refused(self):
        for manifest, arch in (("sha256:bad", "arm64"), (MANIFEST, "unknown")):
            with self.assertRaises(ValueError):
                self.complete(manifest=manifest, arch=arch)
        document = copy.deepcopy(self.document)
        document["spdxVersion"] = "SPDX-2.2"
        with self.assertRaises(ValueError):
            self.complete(document)


if __name__ == "__main__":
    unittest.main()
