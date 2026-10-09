#!/usr/bin/env python3
"""Pure release policy and real staged-filesystem identity tests; no publication."""
import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / "scripts" / (name + ".py"))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


release = module("console-release")
fixtures = module("release_content_test")
SHA = "a" * 40
ENV = {"GITHUB_REPOSITORY": release.REPOSITORY, "GITHUB_REF": "refs/heads/main",
       "GITHUB_WORKFLOW_REF": release.WORKFLOW, "CONSOLE_PUBLIC_RELEASES_ENABLED": "true",
       "GITHUB_EVENT_NAME": "workflow_dispatch", "RELEASE_SOURCE_SHA": SHA,
       "GITHUB_SHA": "b" * 40, "GITHUB_WORKFLOW_SHA": "b" * 40,
       "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1", "RELEASE_VERSION": "v1.3.0-rc.1",
       "RELEASE_FORBIDDEN_LITERAL": "private-owner-fixture"}


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        original = release.ROOT
        release.ROOT = self.root
        self.addCleanup(setattr, release, "ROOT", original)
        notes = self.root / "docs/releases"
        notes.mkdir(parents=True)
        (notes / (ENV["RELEASE_VERSION"] + ".md")).write_text("Reviewed release notes.\n")
        self.env = dict(ENV)

    def staged(self):
        image, inspection, output = (self.root / name for name in ("image", "inspection", "output"))
        def labels(arch, manifest, config, store):
            config["config"]["Labels"] = {"org.opencontainers.image.revision": SHA,
                "org.opencontainers.image.version": self.env["RELEASE_VERSION"],
                "org.opencontainers.image.source": "https://github.com/" + release.REPOSITORY}
            manifest["config"] = store(fixtures.encoded(config), "application/vnd.oci.image.config.v1+json")
        fixtures.layout(image, mutate=labels)
        report = release.content.export(image, inspection, ["amd64", "arm64"])
        output.mkdir()
        with tarfile.open(output / "console-image.oci.tar", "w") as archive:
            for path in image.rglob("*"):
                archive.add(path, arcname=str(path.relative_to(image)), recursive=False)
        for arch, payload in report["payloads"].items():
            document = {"spdxVersion": "SPDX-2.3", "SPDXID": "SPDXRef-DOCUMENT",
                        "documentNamespace": "https://stellwerk.dev/sbom/console/" + payload["manifest"].replace(":", "/") + "/linux/" + arch}
            (output / ("console-linux-" + arch + ".spdx.json")).write_text(json.dumps(document))
        (output / "reproducibility.json").write_text('{"platformPayloadsIdentical": true}\n')
        release.stage(output, image, inspection / "report.json", self.env)
        self.env["RELEASE_CHECKSUMS_SHA256"] = hashlib.sha256((output / "SHA256SUMS").read_bytes()).hexdigest()
        return output, image, inspection, report

    def test_dormancy_public_main_event_and_exact_identities(self):
        release.inputs(self.env)
        for key, value in (("CONSOLE_PUBLIC_RELEASES_ENABLED", "false"), ("GITHUB_REPOSITORY", "other/repo"),
                           ("GITHUB_REF", "refs/heads/feature"), ("GITHUB_EVENT_NAME", "pull_request"),
                           ("GITHUB_WORKFLOW_REF", release.WORKFLOW + "-other"), ("RELEASE_SOURCE_SHA", "bad"),
                           ("GITHUB_WORKFLOW_SHA", "bad"), ("RELEASE_FORBIDDEN_LITERAL", ""), ("GITHUB_RUN_ATTEMPT", "0")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.inputs(dict(self.env, **{key: value}))
        with self.assertRaises(ValueError):
            release.inputs(dict(self.env, GITHUB_EVENT_NAME="push"))
        release.inputs(dict(self.env, GITHUB_EVENT_NAME="push", RELEASE_SOURCE_SHA=self.env["GITHUB_SHA"]))

    def test_real_named_human_gate_public_repo_signed_source_public_package(self):
        repository = {"full_name": release.REPOSITORY, "private": False, "default_branch": "main"}
        environment = {"name": "public-release-candidate", "can_admins_bypass": True, "protection_rules": [
            {"type": "required_reviewers", "prevent_self_review": False,
             "reviewers": [{"type": "User", "reviewer": {"type": "User", "login": "human-reviewer"}}]}]}
        commit = {"sha": SHA, "commit": {"verification": {"verified": True}}}
        package = {"visibility": "public"}
        release.identities(self.env, repository, environment, commit, package)
        for values in ((dict(repository, private=True), environment, commit, package),
                       (repository, dict(environment, name="wrong"), commit, package),
                       (repository, dict(environment, protection_rules=[]), commit, package),
                       (repository, environment, dict(commit, sha="c" * 40), package),
                       (repository, environment, {"sha": SHA, "commit": {"verification": {"verified": False}}}, package),
                       (repository, environment, commit, {"visibility": "private"})):
            with self.subTest(values=values), self.assertRaises(ValueError):
                release.identities(self.env, *values)
        bot = copy.deepcopy(environment)
        bot["protection_rules"][0]["reviewers"][0]["reviewer"]["type"] = "Bot"
        with self.assertRaises(ValueError):
            release.identities(self.env, repository, bot, commit, package)

    def test_staged_source_producer_labels_sbom_and_all_bytes(self):
        output, image, inspection, report = self.staged()
        release.verify(output, self.env)
        release.image_identity(image, report, self.env)
        for key in ("RELEASE_SOURCE_SHA", "GITHUB_WORKFLOW_SHA", "GITHUB_SHA"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                release.verify(output, dict(self.env, **{key: "c" * 40}))
        with self.assertRaises(ValueError):
            release.image_identity(image, report, dict(self.env, RELEASE_VERSION="v1.3.0-rc.2"))
        file = output / "release-notes.md"
        file.write_text("Changed after review.\n")
        with self.assertRaises(ValueError):
            release.verify(output, self.env)

    def test_extra_file_symlink_missing_file_and_checksum_swap_fail(self):
        output, *_ = self.staged()
        extra = output / "unreviewed.txt"
        extra.write_text("extra")
        with self.assertRaises(ValueError):
            release.verify(output, self.env)
        extra.unlink()
        notes = output / "release-notes.md"
        original = notes.read_bytes()
        notes.unlink()
        with self.assertRaises(ValueError):
            release.verify(output, self.env)
        target = self.root / "original-notes"
        target.write_bytes(original)
        notes.symlink_to(target)
        with self.assertRaises(ValueError):
            release.verify(output, self.env)
        notes.unlink()
        notes.write_bytes(original)
        (output / "SHA256SUMS").write_text("changed checksum list")
        with self.assertRaises(ValueError):
            release.verify(output, self.env)

    def test_wrong_sbom_platform_is_refused(self):
        output, image, inspection, report = self.staged()
        path = output / "console-linux-arm64.spdx.json"
        document = json.loads(path.read_bytes())
        document["documentNamespace"] += "-other"
        path.write_text(json.dumps(document))
        with self.assertRaises(ValueError):
            release.sbom_identity(output, report)

    def test_artifact_api_id_digest_run_attempt_name_event_commit_are_bound(self):
        digest = "c" * 64
        record = {"id": 42, "expired": False, "digest": "sha256:" + digest,
                  "name": "console-release-123-1", "workflow_run": {"id": 123, "head_sha": self.env["GITHUB_SHA"]}}
        release.artifact(record, "42", digest, self.env)
        for changed in (dict(record, expired=True), dict(record, id=43), dict(record, digest="sha256:" + "d" * 64),
                        dict(record, name="console-release-123-2"), dict(record, workflow_run={"id": 124, "head_sha": self.env["GITHUB_SHA"]}),
                        dict(record, workflow_run={"id": 123, "head_sha": SHA})):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                release.artifact(changed, "42", digest, self.env)

    def test_verified_statement_requires_exact_subject_type_and_predicate(self):
        digest, predicate = "d" * 64, release.provenance(self.env)
        source, proof = self.root / "predicate.json", self.root / "proof.json"
        source.write_text(json.dumps(predicate))
        statement = {"predicateType": "https://slsa.dev/provenance/v1", "predicate": predicate,
                     "subject": [{"digest": {"sha256": digest}}]}
        def write(value):
            proof.write_text(json.dumps({"payload": base64.b64encode(json.dumps(value).encode()).decode()}))
        write(statement)
        release.statement(proof, "sha256:" + digest, statement["predicateType"], source)
        for changed in (dict(statement, predicateType="other"), dict(statement, predicate={}),
                        dict(statement, subject=[{"digest": {"sha256": "e" * 64}}]),
                        dict(statement, subject=statement["subject"] * 2)):
            write(changed)
            with self.assertRaises(ValueError):
                release.statement(proof, "sha256:" + digest, statement["predicateType"], source)

    def test_split_stable_jobs_cannot_move_latest_backwards(self):
        release.latest_order("v1.3.0", None)
        release.latest_order("v1.3.0", {"tag_name": "v1.2.9", "draft": False, "prerelease": False})
        release.latest_order("v1.10.0", {"tag_name": "v1.9.9", "draft": False, "prerelease": False})
        for latest in ({"tag_name": "v1.3.0", "draft": False, "prerelease": False},
                       {"tag_name": "v1.4.0", "draft": False, "prerelease": False},
                       {"tag_name": "v2.0.0", "draft": False, "prerelease": False},
                       {"tag_name": "v1.3.0-rc.1", "draft": False, "prerelease": True},
                       {"tag_name": "v1.2.0", "draft": True, "prerelease": False}, {}):
            with self.subTest(latest=latest), self.assertRaises(ValueError):
                release.latest_order("v1.3.0", latest)


if __name__ == "__main__":
    unittest.main()
