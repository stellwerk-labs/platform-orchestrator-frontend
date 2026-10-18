#!/usr/bin/env python3
"""Bind Syft's real OS inventory and Vite's real bundled JS inventory to one subject."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys


def complete(path, inspection, manifest, epoch, arch):
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", manifest) or arch not in ("amd64", "arm64"):
        raise ValueError("invalid SBOM platform subject")
    path, inspection = Path(path), Path(inspection)
    document = json.loads(path.read_bytes())
    if document.get("spdxVersion") != "SPDX-2.3" or document.get("SPDXID") != "SPDXRef-DOCUMENT":
        raise ValueError("expected SPDX 2.3 document")
    packages = document["packages"]
    actual = {(package.get("name"), package.get("versionInfo")) for package in packages}
    expected = set()
    for block in (inspection / "lib/apk/db/installed").read_text().split("\n\n"):
        rows = dict(line.split(":", 1) for line in block.splitlines() if line.startswith(("P:", "V:")))
        if rows:
            expected.add((rows["P"], rows["V"]))
    if not expected or not expected <= actual:
        raise ValueError("Syft inventory omits installed OS package identities")
    catalogue = json.loads((inspection / "licenses/dependencies.json").read_bytes())
    relationships = document.setdefault("relationships", [])
    ids = {package["SPDXID"] for package in packages}
    for entry in catalogue:
        identity = entry["name"] + "@" + entry["version"]
        identifier = "SPDXRef-BundledJS-" + hashlib.sha256(identity.encode()).hexdigest()
        if identifier in ids or not entry.get("identifier") or not entry.get("text", "").strip():
            raise ValueError("invalid bundled dependency inventory")
        ids.add(identifier)
        packages.append({
            "SPDXID": identifier, "name": entry["name"], "versionInfo": entry["version"],
            "downloadLocation": "NOASSERTION", "filesAnalyzed": False,
            "licenseConcluded": "NOASSERTION", "licenseDeclared": entry["identifier"],
            "copyrightText": "NOASSERTION",
            "externalRefs": [{"referenceCategory": "PACKAGE-MANAGER", "referenceType": "purl",
                              "referenceLocator": "pkg:npm/" + entry["name"].replace("@", "%40") + "@" + entry["version"]}],
            "sourceInfo": "Bundled JavaScript inventory from Vite build. Original notices and package provenance are shipped under /licenses/packages/" + identity,
        })
        relationships.append({"spdxElementId": "SPDXRef-DOCUMENT", "relationshipType": "DESCRIBES",
                              "relatedSpdxElement": identifier})
    document["name"] = "console-linux-" + arch
    document["documentNamespace"] = "https://stellwerk.dev/sbom/console/" + manifest.replace(":", "/") + "/linux/" + arch
    document["creationInfo"]["created"] = datetime.datetime.fromtimestamp(int(epoch), datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    document["documentComment"] = "OS packages catalogued by pinned Syft from the exact OCI platform. Bundled JS packages catalogued by Vite, not inferred by Syft from minified assets. License inventory does not assert legal compliance."
    path.write_text(json.dumps(document, sort_keys=True, indent=2) + "\n")


if __name__ == "__main__":
    try:
        complete(*sys.argv[1:])
    except (ValueError, OSError, KeyError, TypeError):
        print("Console SBOM identity/coverage validation failed", file=sys.stderr)
        sys.exit(1)
