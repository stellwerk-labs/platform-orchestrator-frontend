#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import re
import unittest

spec = importlib.util.spec_from_file_location("candidate", Path(__file__).with_name("candidate-release.py"))
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)
SHA = "a" * 40


class CandidateReleaseTests(unittest.TestCase):
    def test_canonical_candidate_and_exact_commit(self):
        for tag in ("v1.3.0-rc.1", "v1.3.0-rc.12", "v0.7.0-rc.1"):
            with self.subTest(tag=tag):
                candidate.validate_identity(tag, SHA, SHA, SHA)

    def test_stable_tags_and_noncanonical_or_injected_input_fail(self):
        for tag in ("v1.3.0", "latest", "v01.3.0-rc.1", "v1.3.0-rc.0", "v1.3.0-rc.01",
                    "v1.3.0-rc.1+build", "../notes", "v1.3.0-rc.1\nother", "v1.3.0-rc.1;echo unsafe"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                candidate.validate_identity(tag, SHA, SHA, SHA)

    def test_retargeted_tags_and_mismatched_checkout_fail(self):
        for values in (("a" * 39, SHA, SHA), (SHA, "b" * 40, SHA),
                       (SHA, SHA, "b" * 40), ("A" * 40, SHA, SHA)):
            with self.subTest(values=values), self.assertRaises(ValueError):
                candidate.validate_identity("v1.3.0-rc.1", *values)

    def test_preexisting_environment_requires_reviewers(self):
        candidate.validate_environment({
            "name": "public-release-candidate",
            "protection_rules": [{"type": "required_reviewers", "reviewers": [{"type": "User", "reviewer": {"id": 1}}]}],
        })
        for environment in ({}, {"name": "public-release-candidate"},
                            {"name": "public-release-candidate", "protection_rules": [{"type": "required_reviewers", "reviewers": []}]},
                            {"name": "public-release-candidate", "protection_rules": [{"type": "wait_timer", "wait_timer": 5}]}):
            with self.subTest(environment=environment), self.assertRaises(ValueError):
                candidate.validate_environment(environment)

    def test_release_and_image_absence_fail_closed(self):
        candidate.validate_absence_status(404)
        for status in (200, 401, 403, 429, 500, 503):
            with self.subTest(status=status), self.assertRaises(ValueError):
                candidate.validate_absence_status(status)
        candidate.validate_release_page("v1.3.0-rc.1", [])
        candidate.validate_release_page("v1.3.0-rc.1", [{"tag_name": "v1.2.2", "draft": False}])
        for draft in (True, False):
            with self.subTest(draft=draft), self.assertRaises(ValueError):
                candidate.validate_release_page("v1.3.0-rc.1", [{"tag_name": "v1.3.0-rc.1", "draft": draft}])
        for page in ({"message": "not found"}, [None], [{}], [{"tag_name": "v1.2.2", "draft": "false"}],
                     [{"tag_name": "v1.2.2", "draft": False}] * 101):
            with self.subTest(page=page), self.assertRaises(ValueError):
                candidate.validate_release_page("v1.3.0-rc.1", page)

    def test_workflow_is_manual_repository_guarded_and_approval_gated(self):
        text = Path(__file__).parents[1].joinpath(".github/workflows/tests.yml").read_text()
        jobs = dict(re.findall(r"^  ([a-z-]+):\n(.*?)(?=^  [a-z-]+:\n|\Z)", text, re.M | re.S))
        publication = jobs["candidate-release"]
        image_step = next(step for step in publication.split("\n      - ")
                          if "uses: docker/build-push-action@" in step)
        self.assertIn("\n          context: .\n", image_step,
                      "Build the checked-out approved SHA, not the workflow event's default Git context")
        for required in ("github.repository == 'stellwerk-labs/platform-orchestrator-frontend'",
                         "github.event_name == 'workflow_dispatch'", "environment: public-release-candidate",
                         "- candidate-preflight", "- check-all-jobs-success",
                         "--verify-tag --prerelease --latest=false",
                         "ref: ${{ inputs.candidate_sha }}", "--check-image-absent \"$GITHUB_REPOSITORY\""):
            self.assertIn(required, publication)
        for forbidden in ("semantic-release-action@", "git tag ", ":latest"):
            self.assertNotIn(forbidden, publication)
        self.assertIn("/environments/public-release-candidate", jobs["candidate-preflight"])

    def test_existing_gates_test_candidate_sha_and_stable_path_stays_separate(self):
        tests = Path(__file__).parents[1].joinpath(".github/workflows/tests.yml").read_text()
        callable_tests = Path(__file__).parents[1].joinpath(".github/workflows/callable_automated-tests.yml").read_text()
        jobs = dict(re.findall(r"^  ([a-z-]+):\n(.*?)(?=^  [a-z-]+:\n|\Z)", tests, re.M | re.S))
        self.assertIn("inputs.candidate_sha || github.ref", jobs["code-quality"])
        self.assertIn("candidate_sha: ${{ inputs.candidate_sha }}", jobs["tests"])
        self.assertIn("inputs.candidate_sha || github.ref", callable_tests)
        stable_condition = next(line for line in jobs["release"].splitlines() if line.strip().startswith("if:"))
        self.assertIn("github.event_name == 'push'", stable_condition)
        self.assertIn("github.ref == 'refs/heads/main'", stable_condition)
        self.assertNotIn("workflow_dispatch", stable_condition)


if __name__ == "__main__":
    unittest.main()
