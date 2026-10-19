#!/usr/bin/env python3
"""Inspect exact Console OCI bytes, preserving original layers and metadata."""
import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile
import zipfile
import zlib


def decode_gzip_members(data, *, max_output=256 * 1024 * 1024,
                        max_metadata=1024 * 1024, max_members=1024):
    """Validate bounded RFC 1952 members and retain their non-payload bytes."""
    if min(max_output, max_metadata, max_members) < 1:
        raise ValueError("invalid gzip bounds")
    payloads, metadata, offset, output_size, metadata_size, members = [], [], 0, 0, 0, 0

    def retain(value):
        nonlocal metadata_size
        metadata_size += len(value)
        if metadata_size > max_metadata:
            raise ValueError("gzip metadata exceeds bound")
        metadata.append(value)

    while offset < len(data):
        padding_end = offset
        while padding_end < len(data) and data[padding_end] == 0:
            padding_end += 1
        if padding_end != offset:
            if not members:
                raise ValueError("gzip starts with padding")
            retain(data[offset:padding_end])
            offset = padding_end
        if offset == len(data):
            break
        members += 1
        if members > max_members:
            raise ValueError("gzip member count exceeds bound")
        if data[offset:offset + 3] != b"\x1f\x8b\x08" or offset + 10 > len(data):
            raise ValueError("invalid gzip member header or trailing bytes")
        flags, header_end = data[offset + 3], offset + 10
        if flags & 0xe0:
            raise ValueError("reserved gzip header flags")
        if flags & 4:
            if header_end + 2 > len(data):
                raise ValueError("truncated gzip extra length")
            size = int.from_bytes(data[header_end:header_end + 2], "little")
            header_end += 2 + size
        if header_end > len(data):
            raise ValueError("truncated gzip extra field")
        for flag in (8, 16):
            if flags & flag:
                end = data.find(b"\0", header_end,
                                min(len(data), offset + max_metadata - metadata_size + 1))
                if end < 0:
                    raise ValueError("unterminated or oversized gzip metadata")
                header_end = end + 1
        if flags & 2:
            header_end += 2
        if header_end > len(data):
            raise ValueError("truncated gzip header checksum")
        retain(data[offset:header_end])
        decoder = zlib.decompressobj(wbits=31)
        try:
            payload = decoder.decompress(memoryview(data)[offset:], max_output - output_size + 1)
        except zlib.error as error:
            raise ValueError("gzip member checksum or compression invalid") from error
        output_size += len(payload)
        if output_size > max_output:
            raise ValueError("gzip decompressed bytes exceed bound")
        if not decoder.eof or decoder.unconsumed_tail:
            raise ValueError("truncated or oversized gzip member")
        member_end = len(data) - len(decoder.unused_data)
        if member_end < header_end + 8:
            raise ValueError("invalid gzip member bounds")
        retain(data[member_end - 8:member_end])
        payloads.append(payload)
        offset = member_end
    if not members:
        raise ValueError("gzip has no members")
    return b"".join(payloads), b"".join(metadata)


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def blob(layout, descriptor):
    value, size = descriptor.get("digest", ""), descriptor.get("size")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", value) or type(size) is not int or size < 0:
        raise ValueError("invalid OCI descriptor")
    path = layout / "blobs" / "sha256" / value[7:]
    if (layout / "blobs").is_symlink() or path.parent.is_symlink() or path.is_symlink() or not path.is_file():
        raise ValueError("missing or symlinked OCI blob")
    data = path.read_bytes()
    if len(data) != size or digest(data) != value:
        raise ValueError("OCI blob digest or size mismatch")
    return data


def oci_reference(directory, expected):
    layout = Path(directory)
    index_file = layout / "index.json"
    if index_file.is_symlink() or not index_file.is_file():
        raise ValueError("missing or symlinked OCI index")
    descriptors = json.loads(index_file.read_bytes()).get("manifests", [])
    if (len(descriptors) != 1 or descriptors[0].get("digest") != expected
            or descriptors[0].get("mediaType") != "application/vnd.oci.image.index.v1+json"):
        raise ValueError("OCI reference differs from inspected index")
    blob(layout, descriptors[0])
    tag = descriptors[0].get("annotations", {}).get("org.opencontainers.image.ref.name", "")
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", tag):
        raise ValueError("missing or invalid verified OCI tag")
    return tag


def validate_sbom_layout(directory, expected):
    layout = Path(directory)
    index_file = layout / "index.json"
    if index_file.is_symlink() or not index_file.is_file():
        raise ValueError("missing or symlinked SBOM OCI index")
    descriptors = json.loads(index_file.read_bytes()).get("manifests", [])
    if (len(descriptors) != 1 or descriptors[0].get("digest") != expected
            or descriptors[0].get("mediaType") != "application/vnd.oci.image.manifest.v1+json"):
        raise ValueError("SBOM source differs from inspected platform manifest")
    manifest = json.loads(blob(layout, descriptors[0]))
    for descriptor in [manifest["config"]] + manifest["layers"]:
        blob(layout, descriptor)


def safe_name(name):
    path = PurePosixPath(name)
    normalized = str(path)
    if path.is_absolute() or ".." in path.parts or not path.parts or "\\" in name:
        raise ValueError("unsafe OCI layer path")
    return normalized


def notices(files):
    all_notices = {name[9:]: data for name, data in files.items() if name.startswith("licenses/")}
    bundle = {name: data for name, data in all_notices.items() if not name.startswith(("runtime-apks/", "base/"))}
    duplicate = {name[len("app/build/licenses/"):]: data for name, data in files.items()
                 if name.startswith("app/build/licenses/")}
    if bundle != duplicate or not bundle or any(not isinstance(data, bytes) for data in bundle.values()):
        raise ValueError("both shipped notice bundles must be identical regular files")
    if not bundle.get("platform-orchestrator-frontend/LICENSE", b"").strip():
        raise ValueError("own application license is absent")
    listed = {}
    for line in bundle.get("manifest.sha256", b"").decode().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match or match[2] in listed:
            raise ValueError("invalid notice manifest")
        listed[match[2]] = match[1]
    actual = {name: hashlib.sha256(data).hexdigest() for name, data in bundle.items() if name != "manifest.sha256"}
    if not listed or listed != actual:
        raise ValueError("notice manifest must cover exactly the shipped files")
    catalogue = json.loads(bundle["dependencies.json"])
    identities = set()
    reviewed = {"0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "ISC", "MIT", "Unlicense"}
    for entry in catalogue:
        name, version = entry.get("name", ""), entry.get("version", "")
        if not re.fullmatch(r"(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+", name) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.+_-]*", version):
            raise ValueError("invalid bundled package identity")
        key = name + "@" + version
        if key in identities or entry.get("identifier") not in reviewed or not entry.get("text", "").strip():
            raise ValueError("missing or unknown bundled package license")
        identities.add(key)
        prefix = "packages/" + key + "/"
        candidates = [data for path, data in bundle.items() if path.startswith(prefix)
                      and re.match(r"(?i)(LICENSE|LICENCE|COPYING)(?:$|[._-])", PurePosixPath(path).name)]
        if not any(data.decode().strip() == entry["text"].strip() for data in candidates):
            raise ValueError("catalogued license lacks its original shipped text")
    packaged = set()
    for name in bundle:
        if name.startswith("packages/"):
            parts = name[len("packages/"):].split("/")
            key = "/".join(parts[:2]) if parts[0].startswith("@") else parts[0]
            packaged.add(key)
    if not identities or packaged != identities:
        raise ValueError("notice package set differs from actual bundle catalogue")
    runtime = {name[len("runtime-apks/"):]: data for name, data in all_notices.items() if name.startswith("runtime-apks/")}
    manifest = json.loads(runtime["manifest.json"])
    expected = {"manifest.json"}
    origins = set()
    for source in manifest["sources"]:
        if source["origin"] in origins:
            raise ValueError("duplicate runtime notice origin")
        origins.add(source["origin"])
        for notice in source["notices"]:
            name = notice["file"]
            if (name in expected or not name.startswith(source["origin"] + "/")
                    or not isinstance(runtime.get(name), bytes)
                    or not runtime[name].strip() or hashlib.sha256(runtime[name]).hexdigest() != notice["sha256"]):
                raise ValueError("runtime notice hash or source identity mismatch")
            expected.add(name)
    if set(runtime) != expected:
        raise ValueError("runtime notice manifest does not cover exact files")
    installed = set()
    for block in files["lib/apk/db/installed"].decode().split("\n\n"):
        package = dict(line.split(":", 1) for line in block.splitlines() if line.startswith(("P:", "V:")))
        if package:
            installed.add((package["P"], package["V"]))
    if (not manifest["packages"] or any((package["name"], package["version"]) not in installed
            or package["origin"] not in origins for package in manifest["packages"])
            or not isinstance(all_notices.get("base/nginx/COPYRIGHT"), bytes)
            or not all_notices["base/nginx/COPYRIGHT"].strip()):
        raise ValueError("runtime notices do not bind installed packages or base nginx notice")
    return {name: digest(data) for name, data in sorted(all_notices.items())}


def export(layout, output, architectures):
    layout, output = Path(layout), Path(output)
    if output.exists() or layout.is_symlink():
        raise ValueError("inspection output must be new")
    if (layout / "oci-layout").is_symlink() or (layout / "index.json").is_symlink():
        raise ValueError("symlinked OCI metadata")
    if json.loads((layout / "oci-layout").read_text()) != {"imageLayoutVersion": "1.0.0"}:
        raise ValueError("unsupported OCI layout")
    index = json.loads((layout / "index.json").read_text())
    if len(index["manifests"]) != 1:
        raise ValueError("layout must contain one release index")
    top = index["manifests"][0]
    image_index = json.loads(blob(layout, top))
    manifests = image_index.get("manifests")
    if image_index.get("schemaVersion") != 2 or not isinstance(manifests, list):
        raise ValueError("release must be an OCI image index")
    payloads = {}
    attestations = []
    output.mkdir()
    metadata = output / "metadata"
    metadata.mkdir()
    (metadata / "index.json").write_text(json.dumps(image_index, sort_keys=True))
    for descriptor in manifests:
        platform = descriptor.get("platform", {})
        manifest = json.loads(blob(layout, descriptor))
        config_bytes = blob(layout, manifest["config"])
        config = json.loads(config_bytes)
        identity = descriptor["digest"][7:]
        (metadata / (identity + ".json")).write_text(json.dumps({"descriptor": descriptor, "manifest": manifest, "config": config}, sort_keys=True))
        if platform.get("os") == "unknown" and platform.get("architecture") == "unknown":
            if descriptor.get("annotations", {}).get("vnd.docker.reference.type") != "attestation-manifest":
                raise ValueError("unknown non-attestation platform")
            reference = descriptor["annotations"].get("vnd.docker.reference.digest", "")
            predicates = set()
            for number, layer in enumerate(manifest["layers"]):
                data = blob(layout, layer)
                if layer["mediaType"] != "application/vnd.in-toto+json":
                    raise ValueError("unexpected attestation layer")
                statement = json.loads(data)
                if statement.get("_type") not in ("https://in-toto.io/Statement/v0.1", "https://in-toto.io/Statement/v1"):
                    raise ValueError("unsupported attestation statement")
                predicates.add(statement.get("predicateType"))
                if not any(subject.get("digest", {}).get("sha256") == reference.removeprefix("sha256:")
                           for subject in statement.get("subject", [])):
                    raise ValueError("attestation subject does not bind platform manifest")
                (metadata / (identity + "-" + str(number) + ".json")).write_bytes(data)
            if "https://spdx.dev/Document" not in predicates or not predicates.intersection(
                    {"https://slsa.dev/provenance/v0.2", "https://slsa.dev/provenance/v1"}):
                raise ValueError("platform lacks SPDX SBOM or SLSA provenance")
            attestations.append(descriptor["digest"])
            continue
        arch = platform.get("architecture")
        if platform.get("os") != "linux" or arch not in architectures or arch in payloads:
            raise ValueError("unexpected or duplicate platform")
        image_config = config.get("config", {})
        if (config.get("os"), config.get("architecture")) != ("linux", arch):
            raise ValueError("image config architecture mismatch")
        if (image_config.get("Entrypoint") != ["/docker-entrypoint.sh"]
                or image_config.get("Cmd") != ["./docker/entry-point.sh"]
                or image_config.get("User") != "101" or image_config.get("WorkingDir") != "/app"):
            raise ValueError("unexpected Console startup configuration")
        files, modes, diff_ids, layers = {}, {}, [], []
        for number, layer in enumerate(manifest["layers"]):
            data = blob(layout, layer)
            media = layer["mediaType"]
            if media in ("application/vnd.oci.image.layer.v1.tar+gzip", "application/vnd.docker.image.rootfs.diff.tar.gzip"):
                raw, gzip_metadata = decode_gzip_members(data)
            elif media == "application/vnd.oci.image.layer.v1.tar":
                raw = data
                gzip_metadata = b""
            else:
                raise ValueError("unsupported image layer compression")
            diff_ids.append(digest(raw))
            layers.append(layer["digest"])
            raw_root = output / "layers" / arch / str(number)
            raw_root.mkdir(parents=True)
            (raw_root / "gzip-metadata.bin").write_bytes(gzip_metadata)
            entries, seen, metadata_chunks, cursor = [], set(), [], 0
            with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
                for entry_number, entry in enumerate(archive):
                    if entry.size < 0:
                        raise ValueError("negative layer member size")
                    if entry.isdir() and entry.name in (".", "./"):
                        continue
                    name = safe_name(entry.name)
                    if name in seen:
                        raise ValueError("duplicate layer entry")
                    seen.add(name)
                    record = {"name": name, "mode": entry.mode, "type": entry.type.decode("ascii"), "link": entry.linkname}
                    entries.append(record)
                    if entry.isfile():
                        start, end = entry.offset_data, entry.offset_data + entry.size
                        if start < cursor or end > len(raw):
                            raise ValueError("invalid layer content offsets")
                        metadata_chunks.append(raw[cursor:start])
                        cursor = end
                    path = PurePosixPath(name)
                    if path.name.startswith(".wh."):
                        if not entry.isfile() or entry.size:
                            raise ValueError("invalid whiteout")
                        if path.name == ".wh..wh..opq":
                            removed = "" if str(path.parent) == "." else str(path.parent) + "/"
                            files = {key: value for key, value in files.items() if not key.startswith(removed)}
                        else:
                            removed = str(path.with_name(path.name[4:]))
                            files = {key: value for key, value in files.items() if key != removed and not key.startswith(removed + "/")}
                    elif entry.isfile():
                        content = archive.extractfile(entry).read()
                        if len(content) != entry.size:
                            raise ValueError("layer member size mismatch")
                        # Retain original bytes, including files hidden by later whiteouts.
                        (raw_root / str(entry_number)).write_bytes(content)
                        files[name] = content
                        modes[name] = entry.mode
                    elif entry.isdir():
                        files.pop(name, None)
                        continue
                    elif entry.issym() or entry.islnk():
                        # Never create attacker-controlled links on the host. Their
                        # names/targets remain in scanned metadata; required payloads
                        # below must resolve to actual regular files, not links.
                        files[name] = None
                    else:
                        raise ValueError("unsupported non-file OCI entry")
            (raw_root / "entries.json").write_text(json.dumps(entries, sort_keys=True))
            metadata_chunks.append(raw[cursor:])
            (raw_root / "metadata-bytes.bin").write_bytes(b"".join(metadata_chunks))
        if config.get("rootfs") != {"type": "layers", "diff_ids": diff_ids}:
            raise ValueError("layer diff ID mismatch")
        destination = output / arch
        required = [name for name in files if name.startswith(("app/build/", "app/docker/", "licenses/"))]
        required += ["lib/apk/db/installed", "etc/nginx/conf.d/default.conf"]
        required += [name for name in files if name.startswith("usr/share/licenses/")]
        for name in required:
            if any(str(parent) in files for parent in PurePosixPath(name).parents):
                raise ValueError("required payload has a non-directory ancestor")
            content = files.get(name)
            if not isinstance(content, bytes):
                raise ValueError("required Console payload must be a regular file")
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        for name in ("app/build/index.html", "app/docker/entry-point.sh", "app/docker/init-env.sh"):
            if not isinstance(files.get(name), bytes) or not files[name].strip():
                raise ValueError("required Console startup file missing")
        for name in ("app/docker/entry-point.sh", "app/docker/init-env.sh"):
            if not modes.get(name, 0) & 0o111:
                raise ValueError("Console startup script is not executable")
        license_hashes = notices(files)
        payloads[arch] = {"manifest": descriptor["digest"], "config": manifest["config"]["digest"],
                          "layers": layers, "diffIds": diff_ids, "licenses": license_hashes}
    if set(payloads) != set(architectures):
        raise ValueError("missing required image platform")
    # SBOM/provenance stay attached. Presence is checked here; their predicates
    # are scanned but are not claimed cryptographically verified by this helper.
    subjects = {d.get("annotations", {}).get("vnd.docker.reference.digest") for d in manifests
                if d.get("annotations", {}).get("vnd.docker.reference.type") == "attestation-manifest"}
    if subjects != {value["manifest"] for value in payloads.values()}:
        raise ValueError("missing platform BuildKit attestations")
    report = {"schemaVersion": 1, "index": top["digest"], "payloads": payloads, "attestations": sorted(attestations),
              "reproducibilityBoundary": "Compare platform manifests/configs/layers/notices. Attestations and full index may vary; they are preserved, not removed."}
    (output / "report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    return report


def compare(first, second):
    a, b = (json.loads(Path(path).read_text()) for path in (first, second))
    if a["payloads"] != b["payloads"]:
        raise ValueError("platform payload reproducibility mismatch")
    print(json.dumps({"platformPayloadsIdentical": True, "fullIndexIdentical": a["index"] == b["index"],
                      "attestationsIdentical": a["attestations"] == b["attestations"]}, sort_keys=True))
def svg_path(value):
    """Recognize complete numeric SVG paths, not arbitrary quoted prose."""
    if len(value) > 1024 * 1024:
        return False
    tokens = list(re.finditer(rb"[MmZzLlHhVvCcSsQqTtAa]|[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?", value))
    if not tokens or tokens[0].group() not in (b"M", b"m"):
        return False
    arities = {b"M": 2, b"L": 2, b"H": 1, b"V": 1, b"C": 6, b"S": 4, b"Q": 4, b"T": 2, b"A": 7, b"Z": 0}
    command, numbers, previous_end = None, [], 0
    def complete():
        arity = arities[command]
        if not arity:
            return not numbers
        if not numbers or len(numbers) % arity:
            return False
        return command != b"A" or all(numbers[index] in (b"0", b"1") for index in range(len(numbers)) if index % 7 in (3, 4))
    for token in tokens:
        gap, word = value[previous_end:token.start()], token.group()
        if re.fullmatch(rb"[ \t\r\n,]*", gap) is None or gap.count(b",") > 1:
            return False
        is_command = word.upper() in arities
        if b"," in gap and (is_command or not numbers):
            return False
        if is_command:
            if command is not None and not complete():
                return False
            command, numbers = word.upper(), []
        else:
            if command is None or arities[command] == 0:
                return False
            numbers.append(word)
        previous_end = token.end()
    return complete() and re.fullmatch(rb"[ \t\r\n]*", value[previous_end:]) is not None


def text_views(data):
    """Only short identifiers ignore valid rendering syntax. Raw scans remain."""
    values = [data]
    try:
        value = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        pass
    else:
        values = []
        def strings(item):
            if isinstance(item, str):
                values.append(item.encode())
            elif isinstance(item, list):
                for child in item:
                    strings(child)
            elif isinstance(item, dict):
                for key, child in item.items():
                    values.append(key.encode())
                    strings(child)
        strings(value)
    short, images = [], []
    for value in values:
        def image(match):
            kind, encoded = match[1], match[2]
            if len(encoded) > 24 * 1024 * 1024:
                raise ValueError("embedded image exceeds scan limit")
            try:
                decoded = base64.b64decode(encoded, validate=True)
            except ValueError:
                raise ValueError("invalid embedded image") from None
            valid = ((kind == b"png" and decoded.startswith(b"\x89PNG\r\n\x1a\n") and decoded.endswith(b"IEND\xaeB\x60\x82"))
                     or (kind == b"jpeg" and decoded.startswith(b"\xff\xd8\xff") and decoded.endswith(b"\xff\xd9"))
                     or (kind == b"gif" and decoded.startswith((b"GIF87a", b"GIF89a")) and decoded.endswith(b";"))
                     or (kind == b"webp" and decoded.startswith(b"RIFF") and decoded[8:12] == b"WEBP"
                         and int.from_bytes(decoded[4:8], "little") + 8 == len(decoded)))
            if not valid or len(decoded) < 16 or len(decoded) > 16 * 1024 * 1024:
                raise ValueError("invalid embedded image type or size")
            images.append(decoded)
            return b""
        cleaned = re.sub(rb"""data:image/(png|jpeg|gif|webp);base64,([^"'`\\\s<>]*)""", image, value)
        cleaned = re.sub(rb"""(["'`])([Mm][MmZzLlHhVvCcSsQqTtAa0-9eE.,+\- \t\r\n]+)\1""",
                         lambda match: b"" if svg_path(match[2]) else match[0], cleaned)
        def apk_checksum(match):
            decoded = base64.b64decode(match[1], validate=True)
            return b"" if len(decoded) == 20 and base64.b64encode(decoded) == match[1] else match[0]
        cleaned = re.sub(rb"(?m)^Z:Q1([A-Za-z0-9+/]{27}=)$", apk_checksum, cleaned)
        short.append(cleaned)
    return values, short, images


def apk_markers(data):
    # Artifact policy, not a claim that Gitleaks detects low-entropy mutations.
    # Only these complete public vendor records are permitted. See the pinned
    # source and patch identity in gitleaks.toml; never exempt a whole binary.
    for match in re.finditer(rb"APK_(?:PREUPGRADE|SELFUPGRADE)_TOKEN=", data):
        start, end = match.start(), match.end() + 16
        if (data[match.end():end] != b"laiNgeiThu6ip1Tf"
                or start > 0 and 32 <= data[start - 1] <= 126
                or end < len(data) and 32 <= data[end] <= 126):
            raise ValueError("unrecognized public APK cache-version record")


def scan(directory, forbidden=()):
    directory = Path(directory)
    common_patterns = [
        rb"/(?:Users|home)/[A-Za-z0-9_.-]+/",
        rb"github\.com/[^\s\"'<>]+-enterprise\b",
        rb"\bhttps?://[a-z0-9.-]+\.(?:internal|localdomain)\b",
    ] + [re.escape(value.encode()) for value in forbidden if value]
    text_patterns = [rb"\bWX[0-9]+\b", rb"\b(?:S1\.[0-9]+|PM[0-9]{2}|MO[0-9]{2}|[QCD][0-9]{2})\b"]
    for path in directory.rglob("*"):
        if path.name == ".gitleaksignore":
            raise ValueError("shipping content cannot supply scanner exemptions")
        if path.is_symlink():
            raise ValueError("refusing symlinked scan content")
        if any(re.search(pattern, path.relative_to(directory).as_posix().encode())
               for pattern in common_patterns + text_patterns):
            raise ValueError("private reference scan found prohibited content")
        if path.is_file():
            data = path.read_bytes()
            apk_markers(data)
            # Three-character planning identifiers collide with ELF machine
            # instructions. Apply them to text; binary content still gets the
            # complete secret scan and all concrete path/owner/URL patterns.
            values, short, images = text_views(data) if b"\0" not in data else ([data], [], [])
            if (any(re.search(pattern, value) for value in [data] + values + images for pattern in common_patterns)
                    or any(re.search(pattern, value) for value in short for pattern in text_patterns)):
                # Do not print the match or path: either can itself hold a secret.
                raise ValueError("private reference scan found prohibited content")


def binary_strings(directory):
    directory = Path(directory)
    for path in directory.rglob("*"):
        if path.is_symlink():
            raise ValueError("refusing symlinked scan content")
        # Filenames ship too, and can contain credentials independently of bytes.
        sys.stdout.buffer.write(path.relative_to(directory).as_posix().encode() + b"\n")
        if path.is_file():
            data = path.read_bytes()
            if b"\0" in data:
                for value in re.findall(rb"[\x20-\x7e]{4,}", data):
                    sys.stdout.buffer.write(value + b"\n")
            else:
                _, _, images = text_views(data)
                for value in images:
                    for printable in re.findall(rb"[\x20-\x7e]{4,}", value):
                        sys.stdout.buffer.write(printable + b"\n")


def unpack(directory, output, metadata_output=None, max_members=20000, max_bytes=512 * 1024 * 1024, max_depth=3):
    """Expose archive members for scanning without trusting archive paths/types."""
    directory, output = Path(directory), Path(output)
    if not directory.is_dir() or directory.is_symlink() or output.exists():
        raise ValueError("archive scan input must exist and output must be new")
    remaining_members, remaining_bytes = max_members, max_bytes
    archive_limit = min(max_bytes, 256 * 1024 * 1024)
    output.mkdir()
    metadata_output = Path(metadata_output) if metadata_output is not None else None
    if metadata_output is not None:
        metadata_output.mkdir()
    metadata_count = 0

    def archive_path(path):
        return path.name.endswith((".tar.gz", ".tgz", ".tar", ".zip"))

    def extract(source, destination, depth):
        nonlocal remaining_members, remaining_bytes, metadata_count
        if depth > max_depth:
            raise ValueError("archive nesting exceeds scan limit")
        if source.stat().st_size > archive_limit:
            raise ValueError("archive source exceeds scan limit")
        destination.mkdir(parents=True)
        seen = set()

        def write(name, size, is_directory, stream):
            nonlocal remaining_members, remaining_bytes
            path = PurePosixPath(name.rstrip("/") if is_directory else name)
            if (not name or path.is_absolute() or ".." in path.parts or not path.parts
                    or str(path) != (name.rstrip("/") if is_directory else name)
                    or "\\" in name or any(ord(char) < 32 for char in name) or str(path) in seen):
                raise ValueError("unsafe or duplicate archive scan path")
            seen.add(str(path))
            remaining_members -= 1
            remaining_bytes -= size
            if remaining_members < 0 or remaining_bytes < 0 or size < 0:
                raise ValueError("archive content exceeds scan limit")
            target = destination / str(path)
            if is_directory:
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                data = stream.read(size + 1)
                if len(data) != size:
                    raise ValueError("archive scan member size mismatch")
                target.write_bytes(data)

        if source.name.endswith(".zip"):
            with zipfile.ZipFile(source) as archive:
                for entry in archive.infolist():
                    mode = entry.external_attr >> 16
                    if mode & 0o170000 not in (0, 0o100000, 0o040000) or entry.flag_bits & 1:
                        raise ValueError("unsupported archive scan entry")
                    with archive.open(entry) as stream:
                        write(entry.filename, entry.file_size, entry.is_dir(), stream)
        else:
            # Bound decompression before tarfile parses PAX/GNU headers too.
            # Header sizes are attacker-controlled, not just member sizes.
            data = source.read_bytes()
            if source.name.endswith((".tar.gz", ".tgz")):
                raw, gzip_metadata = decode_gzip_members(data, max_output=archive_limit)
            else:
                raw, gzip_metadata = data, b""
            if len(raw) > archive_limit:
                raise ValueError("archive decompression exceeds scan limit")
            metadata_chunks, cursor = [gzip_metadata], 0
            with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
                for entry in archive:
                    if not (entry.isfile() or entry.isdir()):
                        raise ValueError("unsupported archive scan entry")
                    if entry.isfile():
                        start, end = entry.offset_data, entry.offset_data + entry.size
                        if start < cursor or end > len(raw):
                            raise ValueError("invalid archive content offsets")
                        metadata_chunks.append(raw[cursor:start])
                        cursor = end
                    write(entry.name, entry.size, entry.isdir(), archive.extractfile(entry) if entry.isfile() else None)
            if metadata_output is not None:
                metadata_chunks.append(raw[cursor:])
                retained = b"".join(metadata_chunks)
                remaining_bytes -= len(retained)
                if remaining_bytes < 0:
                    raise ValueError("archive metadata exceeds scan limit")
                (metadata_output / str(metadata_count)).write_bytes(retained)
                metadata_count += 1
        for number, nested in enumerate(sorted(destination.rglob("*"))):
            if nested.is_file() and archive_path(nested):
                extract(nested, output / f"nested-{depth}-{remaining_members}-{number}", depth + 1)

    for number, source in enumerate(sorted(directory.rglob("*"))):
        if source.is_symlink():
            raise ValueError("refusing symlinked archive scan input")
        if source.is_file() and archive_path(source):
            extract(source, output / str(number), 1)


def main():
    command, *args = sys.argv[1:]
    if command == "export":
        export(args[0], args[1], args[2].split(","))
    elif command == "compare":
        compare(*args)
    elif command == "oci-reference":
        print(oci_reference(*args))
    elif command == "sbom-layout":
        validate_sbom_layout(*args)
    elif command == "scan":
        scan(args[0], args[1:])
    elif command == "strings":
        binary_strings(*args)
    elif command == "unpack":
        unpack(*args)
    else:
        raise ValueError("unknown content command")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, tarfile.TarError, zipfile.BadZipFile, EOFError):
        print("release content validation failed; inspect locally without exposing findings", file=sys.stderr)
        sys.exit(1)
