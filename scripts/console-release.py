#!/usr/bin/env python3
"""Exact-artifact checks used by the existing candidate/stable release jobs."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "stellwerk-labs/platform-orchestrator-frontend"
WORKFLOW = REPOSITORY + "/.github/workflows/tests.yml@refs/heads/main"


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / "scripts" / (name + ".py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


candidate = module("candidate-release")
stable = module("stable-release-preflight")
content = module("release_content")


def inputs(env):
    if (env.get("GITHUB_REPOSITORY") != REPOSITORY or env.get("GITHUB_REF") != "refs/heads/main"
            or env.get("GITHUB_WORKFLOW_REF") != WORKFLOW
            or env.get("CONSOLE_PUBLIC_RELEASES_ENABLED") != "true"
            or env.get("GITHUB_EVENT_NAME") not in ("push", "workflow_dispatch")):
        raise ValueError("publication is dormant outside explicitly enabled public main release events")
    for key in ("RELEASE_SOURCE_SHA", "GITHUB_SHA", "GITHUB_WORKFLOW_SHA"):
        if not re.fullmatch(r"[0-9a-f]{40}", env.get(key, "")):
            raise ValueError("exact source, event and workflow commit identities are required")
    if env["GITHUB_EVENT_NAME"] == "push" and env["RELEASE_SOURCE_SHA"] != env["GITHUB_SHA"]:
        raise ValueError("stable source must equal the main push commit")
    if not env.get("RELEASE_FORBIDDEN_LITERAL", "").strip():
        raise ValueError("the private-reference literal must be configured as a repository secret")
    if any(not re.fullmatch(r"[1-9][0-9]*", env.get(key, "")) for key in ("GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")):
        raise ValueError("immutable workflow run/attempt identity is required")


def environment_name(env):
    return "public-release-candidate" if env["GITHUB_EVENT_NAME"] == "workflow_dispatch" else "public-release"


def identities(env, repository, environment, commit, package):
    inputs(env)
    if (repository.get("full_name") != REPOSITORY or repository.get("private") is not False
            or repository.get("default_branch") != "main"):
        raise ValueError("only the reviewed public repository with default main is supported")
    if environment.get("name") != environment_name(env) or not any(
        rule.get("type") == "required_reviewers" and any(
            reviewer.get("type") == "User" and reviewer.get("reviewer", {}).get("type") == "User"
            and reviewer["reviewer"].get("login") for reviewer in rule.get("reviewers", [])
        ) for rule in environment.get("protection_rules", [])
    ):
        raise ValueError("the named human-review environment must already exist, without an ungated fallback")
    if commit.get("sha") != env["RELEASE_SOURCE_SHA"] or commit.get("commit", {}).get("verification", {}).get("verified") is not True:
        raise ValueError("the exact source commit must have a verified signature")
    if package.get("visibility") != "public":
        raise ValueError("the existing image package must be publicly visible before publication")


def api(path, env, missing=False):
    token = env.get("GH_TOKEN")
    if not token:
        raise ValueError("authenticated read-only checks require GH_TOKEN")
    request = Request("https://api.github.com/" + path, headers={
        "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        if missing and error.code == 404:
            return None
        raise


def preflight(env):
    inputs(env)  # Before API calls, tag assignment, environment jobs or writes.
    base = "repos/" + REPOSITORY
    identities(env, api(base, env), api(base + "/environments/" + environment_name(env), env),
               api(base + "/commits/" + env["RELEASE_SOURCE_SHA"], env),
               api("orgs/stellwerk-labs/packages/container/" + quote("platform-orchestrator-frontend", safe=""), env))
    if subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() != env["RELEASE_SOURCE_SHA"]:
        raise ValueError("checkout does not identify the approved source")
    # Older candidate source is allowed only when its release workflow is byte
    # identical to the workflow actually dispatched from main. Both SHAs remain
    # distinct in provenance and artifact producer checks.
    workflow = subprocess.check_output(["git", "show", env["GITHUB_WORKFLOW_SHA"] + ":.github/workflows/tests.yml"])
    if workflow != (ROOT / ".github/workflows/tests.yml").read_bytes():
        raise ValueError("candidate release workflow differs from dispatched main workflow")


def version(env):
    value = env["RELEASE_VERSION"]
    if env["GITHUB_EVENT_NAME"] == "workflow_dispatch":
        candidate.validate_identity(value, env["RELEASE_SOURCE_SHA"], env["RELEASE_SOURCE_SHA"], env["RELEASE_SOURCE_SHA"])
    else:
        stable.validate_stable_identity(value, env["RELEASE_SOURCE_SHA"], env["RELEASE_SOURCE_SHA"], env["RELEASE_SOURCE_SHA"])
    return value


def source_identity(env):
    inputs(env)
    return {"commit": env["RELEASE_SOURCE_SHA"], "workflowCommit": env["GITHUB_WORKFLOW_SHA"],
            "workflowRef": env["GITHUB_WORKFLOW_REF"], "eventCommit": env["GITHUB_SHA"],
            "runId": env["GITHUB_RUN_ID"], "runAttempt": env["GITHUB_RUN_ATTEMPT"], "dirty": False}


def provenance(env):
    return {"buildDefinition": {
        "buildType": "https://stellwerk.dev/build/console-image/v1",
        "externalParameters": {"version": version(env)},
        "resolvedDependencies": [{"uri": "git+https://github.com/" + REPOSITORY,
                                  "digest": {"gitCommit": env["RELEASE_SOURCE_SHA"]}},
                                 {"uri": "git+https://github.com/" + REPOSITORY + "/.github/workflows/tests.yml",
                                  "digest": {"gitCommit": env["GITHUB_WORKFLOW_SHA"]}}]},
        "runDetails": {"builder": {"id": "https://github.com/" + WORKFLOW},
                       "metadata": {"invocationId": "https://github.com/" + REPOSITORY + "/actions/runs/"
                                    + env["GITHUB_RUN_ID"] + "/attempts/" + env["GITHUB_RUN_ATTEMPT"]}}}


def latest_order(tag, latest):
    if latest is None:
        return
    current = latest.get("tag_name", "")
    if (not stable.STABLE.fullmatch(current) or latest.get("draft") is not False
            or latest.get("prerelease") is not False):
        raise ValueError("unexpected latest stable release identity")
    numbers = lambda value: tuple(map(int, value[1:].split(".")))
    if numbers(current) >= numbers(tag):
        raise ValueError("refusing to move latest backwards or repeat a stable publication")


def image_identity(layout, report, env):
    for payload in report["payloads"].values():
        data = (Path(layout) / "blobs/sha256" / payload["config"].split(":")[1]).read_bytes()
        if content.digest(data) != payload["config"]:
            raise ValueError("image config changed since inspection")
        labels = json.loads(data)["config"].get("Labels", {})
        if (labels.get("org.opencontainers.image.revision") != env["RELEASE_SOURCE_SHA"]
                or labels.get("org.opencontainers.image.version") != version(env)
                or labels.get("org.opencontainers.image.source") != "https://github.com/" + REPOSITORY):
            raise ValueError("image labels differ from exact approved source/version")


def sbom_identity(output, report):
    for arch, payload in report["payloads"].items():
        document = json.loads((Path(output) / ("console-linux-" + arch + ".spdx.json")).read_bytes())
        expected = "https://stellwerk.dev/sbom/console/" + payload["manifest"].replace(":", "/") + "/linux/" + arch
        if (document.get("spdxVersion") != "SPDX-2.3" or document.get("SPDXID") != "SPDXRef-DOCUMENT"
                or document.get("documentNamespace") != expected):
            raise ValueError("SBOM platform subject differs from inspected image")


def stage(output, layout, report_path, env):
    output = Path(output)
    report = json.loads(Path(report_path).read_bytes())
    image_identity(layout, report, env)
    sbom_identity(output, report)
    if set(report["payloads"]) != {"amd64", "arm64"}:
        raise ValueError("both Console platform payloads are required")
    if json.loads((output / "reproducibility.json").read_bytes()).get("platformPayloadsIdentical") is not True:
        raise ValueError("independent platform payload comparison must pass")
    notes = ROOT / "docs/releases" / (version(env) + ".md")
    if not notes.is_file() or not notes.read_text().strip():
        raise ValueError("reviewed version-specific release notes are required")
    (output / "release-notes.md").write_bytes(notes.read_bytes())
    (output / "inspection.json").write_bytes(Path(report_path).read_bytes())
    (output / "source-provenance.json").write_text(json.dumps(provenance(env), sort_keys=True, indent=2) + "\n")
    (output / "release.json").write_text(json.dumps({"schemaVersion": 1, "version": version(env),
        "source": source_identity(env), "image": {"digest": report["index"], "payloads": report["payloads"]},
        "notesSHA256": hashlib.sha256(notes.read_bytes()).hexdigest()}, sort_keys=True, indent=2) + "\n")
    paths = sorted(output.iterdir())
    if any(not path.is_file() or path.is_symlink() for path in paths):
        raise ValueError("staged release files must be regular files")
    (output / "SHA256SUMS").write_text("".join(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name + "\n" for path in paths))


def verify(output, env):
    output = Path(output)
    source = source_identity(env)
    checksums = (output / "SHA256SUMS").read_bytes()
    if hashlib.sha256(checksums).hexdigest() != env["RELEASE_CHECKSUMS_SHA256"]:
        raise ValueError("shipping manifest differs from the exact artifact approved for this run")
    listed = set()
    for line in checksums.decode().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  ([a-zA-Z0-9_.-]+)", line)
        if not match or match[2] in listed or match[2] == "SHA256SUMS":
            raise ValueError("invalid shipping checksum manifest")
        listed.add(match[2])
        path = output / match[2]
        if not path.is_file() or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != match[1]:
            raise ValueError("shipping bytes differ from immutable build output")
    required = {"console-image.oci.tar", "console-linux-amd64.spdx.json", "console-linux-arm64.spdx.json",
                "inspection.json", "reproducibility.json", "release-notes.md", "release.json", "source-provenance.json"}
    if listed != required or {path.name for path in output.iterdir()} != required | {"SHA256SUMS"}:
        raise ValueError("unexpected or missing release files")
    release = json.loads((output / "release.json").read_bytes())
    inspection = json.loads((output / "inspection.json").read_bytes())
    sbom_identity(output, inspection)
    if (release.get("source") != source or release.get("version") != version(env)
            or release.get("image") != {"digest": inspection["index"], "payloads": inspection["payloads"]}
            or json.loads((output / "source-provenance.json").read_bytes()) != provenance(env)
            or release.get("notesSHA256") != hashlib.sha256((output / "release-notes.md").read_bytes()).hexdigest()
            or (output / "release-notes.md").read_bytes() != (ROOT / "docs/releases" / (version(env) + ".md")).read_bytes()):
        raise ValueError("artifact source/version/producer/notes binding differs")


def artifact(record, artifact_id, digest, env):
    inputs(env)
    if not re.fullmatch(r"[1-9][0-9]*", artifact_id) or not re.fullmatch(r"(?:sha256:)?[0-9a-f]{64}", digest):
        raise ValueError("invalid immutable artifact identity")
    if (record.get("id") != int(artifact_id) or record.get("expired") is not False
            or record.get("digest") != "sha256:" + digest.removeprefix("sha256:")
            or record.get("name") != "console-release-" + env["GITHUB_RUN_ID"] + "-" + env["GITHUB_RUN_ATTEMPT"]
            or record.get("workflow_run", {}).get("id") != int(env["GITHUB_RUN_ID"])
            or record.get("workflow_run", {}).get("head_sha") != env["GITHUB_SHA"]):
        raise ValueError("immutable artifact is not from this exact producer run")


def statement(path, digest, predicate_type, predicate_path):
    raw, values = Path(path).read_text().strip(), []
    decoder = json.JSONDecoder()
    while raw:
        value, end = decoder.raw_decode(raw)
        values.extend(value if isinstance(value, list) else [value])
        raw = raw[end:].lstrip()
    predicate = json.loads(Path(predicate_path).read_bytes())
    for value in values:
        payload = value.get("payload") or value.get("Payload") or value.get("dsseEnvelope", {}).get("payload")
        if payload:
            decoded = json.loads(base64.b64decode(payload, validate=True))
            if (decoded.get("predicateType") == predicate_type and decoded.get("predicate") == predicate
                    and len(decoded.get("subject", [])) == 1
                    and decoded["subject"][0].get("digest") == {"sha256": digest.removeprefix("sha256:")}):
                return
    raise ValueError("verified signature does not bind the exact subject and predicate")


if __name__ == "__main__":
    try:
        command, *args = sys.argv[1:]
        if command == "preflight":
            preflight(os.environ)
        elif command == "stage":
            stage(*args, os.environ)
        elif command == "verify":
            verify(*args, os.environ)
        elif command == "artifact":
            artifact(json.loads(Path(args[0]).read_bytes()), *args[1:], os.environ)
        elif command == "image":
            image_identity(args[0], json.loads(Path(args[1]).read_bytes()), os.environ)
        elif command == "order":
            inputs(os.environ)
            if os.environ["GITHUB_EVENT_NAME"] == "push":
                latest_order(version(os.environ), api("repos/" + REPOSITORY + "/releases/latest", os.environ, missing=True))
        elif command == "statement":
            statement(*args)
        else:
            raise ValueError("unknown Console release check")
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
