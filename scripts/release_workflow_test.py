#!/usr/bin/env python3
"""Bounded checks of actual release job conditions, never publication or hosted CI."""
import ast
import importlib.util
import itertools
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / ".github/workflows/tests.yml").read_text()
JOBS = dict(re.findall(r"^  ([a-z][a-z0-9-]*):\n(.*?)(?=^  [a-z][a-z0-9-]*:\n|\Z)",
                       WORKFLOW.split("\njobs:\n", 1)[1], re.M | re.S))
SPEC = importlib.util.spec_from_file_location("console_release", ROOT / "scripts/console-release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
PUBLISHERS = {"workflow_dispatch": "candidate-release", "push": "stable-publish"}


def dependencies(job):
    inline = re.search(r"^    needs: \[([^]]+)\]$", JOBS[job], re.M)
    if inline:
        return tuple(name.strip() for name in inline[1].split(","))
    multiline = re.search(r"^    needs:\n((?:      - [a-z-]+\n)+)", JOBS[job], re.M)
    if multiline:
        return tuple(re.findall(r"      - ([a-z-]+)", multiline[1]))
    scalar = re.search(r"^    needs: ([a-z-]+)$", JOBS[job], re.M)
    if scalar:
        return (scalar[1],)
    if "    needs:" in JOBS[job]:
        raise ValueError("unexpected dependency syntax")
    return ()


def builder_configuration(job):
    steps = re.findall(r"^      - uses: docker/setup-buildx-action@([0-9a-f]{40})[^\n]*\n"
                       r"((?: {8,}[^\n]*\n)+)", job, re.M)
    if len(steps) != 1 or steps[0][0] != "37fe631027851001ddb9b187196cc803df7f5f0e":
        raise ValueError("expected the single pinned Buildx setup step")
    body = steps[0][1]
    versions = re.findall(r"^          version: (.+)$", body, re.M)
    options = re.search(r"^          driver-opts: \|\n((?:            [^\n]+\n)+)", body, re.M)
    if versions != ["v0.38.0"] or not options:
        raise ValueError("explicit supported Buildx version and creation options required")
    values = [line.strip() for line in options[1].splitlines()]
    if values != ["image=moby/buildkit@sha256:cec9f139f45e93c5c69c60f8b07cfad9f43f4ef6b6a6cd917527fea5ff2e3dea",
                  "provenance-add-gha=false"]:
        raise ValueError("keep pinned BuildKit and omit only auxiliary GHA context at builder creation")
    return versions[0], values


def ancestors(job):
    found, pending = set(), list(dependencies(job))
    while pending:
        dependency = pending.pop()
        if dependency not in found:
            found.add(dependency)
            pending.extend(dependencies(dependency))
    return found


def expression(job):
    match = re.search(r"^    if: (.+)\n", JOBS[job], re.M)
    if not match:
        return "success()"
    value = match[1]
    if value == ">-":
        folded = re.match(r"(?:      [^\n]+\n)+", JOBS[job][match.end():])
        if not folded:
            raise ValueError("missing folded condition")
        value = " ".join(line.strip() for line in folded[0].splitlines())
    return value.removeprefix("${{").removesuffix("}}").strip()


def condition(job, values, changed=None):
    value = expression(job) if changed is None else changed
    # GitHub's default success() includes skipped transitive ancestors, even
    # when an intermediate job used a status function and then succeeded.
    # This closed Boolean subset is a wiring check, not an Actions scheduler.
    values = dict(values)
    values["success()"] = all(values["needs." + name + ".result"] == "success"
                              for name in ancestors(job))
    values["failure()"] = any(values["needs." + name + ".result"] == "failure"
                              for name in ancestors(job))
    values["always()"] = True
    if not re.search(r"\b(?:always|success|failure|cancelled)\s*\(", value):
        value = "success() && (" + value + ")"
    for name, replacement in sorted(values.items(), key=lambda item: -len(item[0])):
        value = value.replace(name, repr(replacement))
    value = re.sub(r"!(?!=)", " not ", value).replace("&&", " and ").replace("||", " or ").strip()
    tree = ast.parse(value, mode="eval")
    allowed = (ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not,
               ast.Compare, ast.Eq, ast.NotEq, ast.Constant)
    if any(not isinstance(node, allowed) for node in ast.walk(tree)):
        raise ValueError("unexpected expression in the bounded Boolean check")
    return bool(eval(compile(tree, "<workflow condition>", "eval"), {"__builtins__": {}}, {}))


class ReleaseWorkflowTests(unittest.TestCase):
    def test_builder_omits_auxiliary_gha_context_without_dropping_attestations(self):
        version, options = builder_configuration(JOBS["build-release-image"])
        self.assertEqual(version, "v0.38.0")
        self.assertIn("provenance-add-gha=false", options)
        builder = (ROOT / "scripts/build-console-image.sh").read_text()
        for required in ("--provenance=mode=max", '--sbom="generator=$buildkit_sbom_generator"',
                         "--no-cache", "--platform linux/amd64,linux/arm64", "timeout -k 5s 300s"):
            self.assertIn(required, builder)
        self.assertNotIn("BUILDX_GIT_INFO", builder)
        self.assertNotIn("BUILDX_NO_DEFAULT_ATTESTATIONS", JOBS["build-release-image"])

    def test_missing_moved_enabled_or_unsupported_builder_option_is_refused(self):
        job = JOBS["build-release-image"]
        for changed in (job.replace("v0.38.0", "v0.37.2"),
                        job.replace("            provenance-add-gha=false\n", ""),
                        job.replace("provenance-add-gha=false", "provenance-add-gha=true"),
                        job.replace("            provenance-add-gha=false", "          provenance-add-gha: false")):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                builder_configuration(changed)

    def values(self, event, **overrides):
        values = {"needs." + name + ".result": "success" for name in JOBS}
        values.update({"github.repository": release.REPOSITORY, "github.event_name": event,
                       "github.ref": "refs/heads/main", "vars.CONSOLE_PUBLIC_RELEASES_ENABLED": "true",
                       "needs.release.outputs.version": "v1.4.0", "cancelled()": False})
        unused = ("stable-preflight", "release") if event == "workflow_dispatch" else ("candidate-preflight",)
        values.update({"needs." + name + ".result": "skipped" for name in unused})
        values.update(overrides)
        return values

    def required(self, job, event):
        if job == "build-release-image":
            return ("check-all-jobs-success", "candidate-preflight" if event == "workflow_dispatch" else "release")
        return dependencies(job)

    def assert_successful_route(self, event):
        values = self.values(event)
        for job in ("build-release-image", PUBLISHERS[event]):
            self.assertTrue(condition(job, values), job)

    def assert_required_result(self, job, event, dependency, changed=None):
        for result in ("failure", "skipped", "cancelled"):
            values = self.values(event, **{"needs." + dependency + ".result": result})
            self.assertFalse(condition(job, values, changed), (job, dependency, result))

    def replace_once(self, value, old, new):
        self.assertEqual(value.count(old), 1, (old, value))
        return value.replace(old, new, 1)

    def test_candidate_reaches_review_after_stable_ancestors_skip(self):
        self.assertNotIn("release", dependencies("candidate-release"))
        self.assertIn("release", ancestors("candidate-release"))
        self.assertIn("stable-preflight", ancestors("candidate-release"))
        self.assert_successful_route("workflow_dispatch")

    def test_stable_reaches_review_after_candidate_ancestor_skips(self):
        self.assertNotIn("candidate-preflight", dependencies("stable-publish"))
        self.assertIn("candidate-preflight", ancestors("stable-publish"))
        self.assert_successful_route("push")

    def test_every_mandatory_result_must_succeed(self):
        for event, publisher in PUBLISHERS.items():
            for job in ("build-release-image", publisher):
                for dependency in self.required(job, event):
                    with self.subTest(event=event, job=job, dependency=dependency):
                        self.assert_required_result(job, event, dependency)

    def test_cancellation_blocks_build_and_both_publishers(self):
        for event, publisher in PUBLISHERS.items():
            values = self.values(event, **{"cancelled()": True})
            for job in ("build-release-image", publisher):
                self.assertFalse(condition(job, values), job)

    def test_empty_stable_version_and_opposite_events_do_not_publish(self):
        for job in ("build-release-image", "stable-publish"):
            self.assertFalse(condition(job, self.values("push", **{"needs.release.outputs.version": ""})), job)
        for event, publisher in PUBLISHERS.items():
            opposite = "push" if event == "workflow_dispatch" else "workflow_dispatch"
            values = self.values(opposite)
            values.update({"needs." + name + ".result": "success" for name in JOBS})
            self.assertFalse(condition(publisher, values), publisher)

    def test_publication_identity_and_dormancy_fail_before_build(self):
        for event, (key, value) in itertools.product(PUBLISHERS, (
                ("github.repository", "example/fork"), ("github.event_name", "pull_request"),
                ("github.ref", "refs/heads/other"), ("github.ref", "refs/tags/v1.4.0"),
                ("vars.CONSOLE_PUBLIC_RELEASES_ENABLED", "false"),
                ("vars.CONSOLE_PUBLIC_RELEASES_ENABLED", ""))):
            with self.subTest(event=event, key=key, value=value):
                values = self.values(event, **{key: value})
                env = {"GITHUB_REPOSITORY": values["github.repository"], "GITHUB_REF": values["github.ref"],
                       "GITHUB_EVENT_NAME": values["github.event_name"], "GITHUB_WORKFLOW_REF": release.WORKFLOW,
                       "CONSOLE_PUBLIC_RELEASES_ENABLED": values["vars.CONSOLE_PUBLIC_RELEASES_ENABLED"],
                       "RELEASE_SOURCE_SHA": "a" * 40, "GITHUB_SHA": "a" * 40, "GITHUB_WORKFLOW_SHA": "a" * 40,
                       "GITHUB_RUN_ID": "1", "GITHUB_RUN_ATTEMPT": "1", "RELEASE_FORBIDDEN_LITERAL": "private-fixture"}
                with self.assertRaises(ValueError):
                    release.inputs(env)
                # Both real preflights invoke this helper before side effects.
                # Its refusal makes the selected route's required result red.
                preflight = "candidate-preflight" if event == "workflow_dispatch" else "stable-preflight"
                self.assertIn("python3 scripts/console-release.py preflight", JOBS[preflight])
                values["needs." + preflight + ".result"] = "failure"
                if event == "push":
                    self.assertFalse(condition("release", values))
                    values["needs.release.result"] = "skipped"
                self.assertFalse(condition("build-release-image", values))
                values["needs.build-release-image.result"] = "skipped"
                self.assertFalse(condition(PUBLISHERS[event], values))

    def test_missing_status_function_mutations_restore_the_skip_bug(self):
        for event, publisher in PUBLISHERS.items():
            for job in ("build-release-image", publisher):
                with self.subTest(event=event, job=job):
                    changed = self.replace_once(expression(job), "!cancelled() &&", "")
                    self.assertTrue(condition(job, self.values(event)))
                    with self.assertRaises(AssertionError):
                        self.assertTrue(condition(job, self.values(event), changed))

    def test_each_missing_mandatory_check_mutation_is_rejected(self):
        for event, publisher in PUBLISHERS.items():
            for job in ("build-release-image", publisher):
                for dependency in self.required(job, event):
                    with self.subTest(event=event, job=job, dependency=dependency):
                        guard = "needs." + dependency + ".result == 'success'"
                        changed = self.replace_once(expression(job), guard, "True")
                        self.assert_required_result(job, event, dependency)
                        with self.assertRaises(AssertionError):
                            self.assert_required_result(job, event, dependency, changed)

    def test_always_mutations_cannot_bypass_cancellation(self):
        for event, publisher in PUBLISHERS.items():
            for job in ("build-release-image", publisher):
                with self.subTest(event=event, job=job):
                    changed = self.replace_once(expression(job), "!cancelled()", "always()")
                    values = self.values(event, **{"cancelled()": True})
                    self.assertFalse(condition(job, values))
                    with self.assertRaises(AssertionError):
                        self.assertFalse(condition(job, values, changed))

    def test_product_gates_reviewers_and_immutable_artifact_path_remain_required(self):
        expected = {"candidate-preflight": (), "stable-preflight": (), "code-quality": (),
                    "tests": ("code-quality",), "check-all-jobs-success": ("code-quality", "tests"),
                    "release": ("stable-preflight", "check-all-jobs-success"),
                    "build-release-image": ("candidate-preflight", "release", "check-all-jobs-success"),
                    "candidate-release": ("candidate-preflight", "check-all-jobs-success", "build-release-image"),
                    "stable-publish": ("release", "build-release-image")}
        self.assertEqual({job: dependencies(job) for job in JOBS}, expected)
        for gate in ("code-quality", "tests"):
            self.assertIn("needs." + gate + ".result != 'success'", JOBS["check-all-jobs-success"])
        self.assertIn("uses: ./.github/workflows/callable_automated-tests.yml", JOBS["tests"])
        for job, environment in (("release", "public-release"), ("stable-publish", "public-release"),
                                 ("candidate-release", "public-release-candidate")):
            self.assertIn("    environment: " + environment + "\n", JOBS[job])
        for publisher in PUBLISHERS.values():
            job = JOBS[publisher]
            self.assertIn("python3 scripts/console-release.py artifact", job)
            self.assertIn("artifact-ids: ${{ needs.build-release-image.outputs.artifact_id }}", job)
            self.assertIn("RELEASE_CHECKSUMS_SHA256: ${{ needs.build-release-image.outputs.checksums_sha256 }}", job)
            self.assertIn("run: bash scripts/publish-console-artifact.sh", job)
        self.assertIn("python3 scripts/release_workflow_test.py", JOBS["code-quality"])


if __name__ == "__main__":
    unittest.main()
