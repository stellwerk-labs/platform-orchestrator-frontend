#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("stable", Path(__file__).with_name("stable-release-preflight.py"))
stable = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stable)
SHA = "a" * 40


class StableReleaseTests(unittest.TestCase):
    def test_exact_canonical_stable_source(self):
        stable.validate_stable_identity("v1.3.0", SHA, SHA, SHA)
        for tag in ("v01.3.0", "v1.3.0-rc.1", "latest", "v1.3.0+build", "../notes"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                stable.validate_stable_identity(tag, SHA, SHA, SHA)
        for values in ((SHA, "b" * 40, SHA), (SHA, SHA, "b" * 40), ("abc", "abc", "abc")):
            with self.subTest(values=values), self.assertRaises(ValueError):
                stable.validate_stable_identity("v1.3.0", *values)

    def test_reviewed_notes_are_nonempty_in_checked_out_source(self):
        previous_directory = Path.cwd()
        with tempfile.TemporaryDirectory() as temporary_directory:
            notes = Path(temporary_directory, "docs/releases")
            notes.mkdir(parents=True)
            (notes / "v1.3.0.md").write_text("Reviewed notes.\n")
            (notes / "v1.3.1.md").write_text("")
            (notes / "v1.3.2.md").write_text(" \n\t")
            try:
                os.chdir(temporary_directory)
                stable.validate_release_notes("v1.3.0")
                for tag in ("v1.3.1", "v1.3.2", "v1.3.3"):
                    with self.subTest(tag=tag), self.assertRaises(ValueError):
                        stable.validate_release_notes(tag)
            finally:
                os.chdir(previous_directory)

    def test_publication_destinations_fail_closed(self):
        stable.candidate.validate_absence_status(404)
        for status in (200, 401, 403, 429, 500, 503):
            with self.subTest(status=status), self.assertRaises(ValueError):
                stable.candidate.validate_absence_status(status)
        for draft in (True, False):
            with self.subTest(draft=draft), self.assertRaises(ValueError):
                stable.candidate.validate_release_page(
                    "v1.3.0", [{"tag_name": "v1.3.0", "draft": draft}]
                )

    def test_semantic_release_only_assigns_versions_with_existing_rules(self):
        config = json.loads(Path(__file__).parents[1].joinpath(".releaserc.json").read_text())
        self.assertEqual([plugin[0] for plugin in config["plugins"]], ["@semantic-release/commit-analyzer"])
        rules = config["plugins"][0][1]["releaseRules"]
        self.assertEqual(
            rules,
            [
                {"breaking": True, "release": "major"},
                {"revert": True, "release": "patch"},
                {"type": "feat", "release": "minor"},
                {"type": "fix", "release": "patch"},
                {"type": "build", "scope": "deps", "release": "patch"},
                {"type": "*", "release": "patch"},
            ],
        )

    def test_workflow_reserves_builds_verifies_then_publishes(self):
        text = Path(__file__).parents[1].joinpath(".github/workflows/tests.yml").read_text()
        jobs = dict(re.findall(r"^  ([a-z-]+):\n(.*?)(?=^  [a-z-]+:\n|\Z)", text, re.M | re.S))
        release = jobs["release"]
        build, publish = jobs["build-release-image"], jobs["stable-publish"]
        builder = Path(__file__).with_name("build-console-image.sh").read_text()
        publisher = Path(__file__).with_name("publish-console-artifact.sh").read_text()
        for required in (
            "python3 scripts/stable-release-preflight.py",
            "semantic-release-action@b1269e93b486873118eef1646bfcd46a9d23d3a3",
            "environment: public-release",
            "needs: [stable-preflight, check-all-jobs-success]",
            "persist-credentials: false",
        ):
            self.assertIn(required, release)
        self.assertLess(release.index("console-release.py preflight"), release.index("semantic-release-action@"))
        self.assertIn('needs.release.outputs.version', build)
        self.assertIn('needs: [release, build-release-image]', publish)
        self.assertIn('environment: public-release', publish)
        self.assertIn('console-release.py artifact', publish)
        for required in ('--no-cache', '--sbom="generator=$buildkit_sbom_generator"', '--provenance=mode=max',
                         'org.opencontainers.image.version=$version', 'org.opencontainers.image.revision=$source_sha'):
            self.assertIn(required, builder)
        for required in ('uses: docker/setup-qemu-action@', 'uses: docker/setup-buildx-action@',
                         'release_content.py compare', 'generate-console-sbom.sh', 'scan-release-content.sh'):
            self.assertIn(required, build)
        self.assertLess(publisher.index('console-release.py" verify'), publisher.index('gh release create'))
        self.assertLess(publisher.index('stable-release-preflight.py'), publisher.index('gh release create'))
        self.assertLess(publisher.index('gh release create'), publisher.index('oras cp --no-tty'))
        self.assertLess(publisher.index('oras cp --no-tty'), publisher.index('cosign_release verify '))
        self.assertLess(publisher.index('cosign_release verify '), publisher.index('gh release upload'))
        self.assertLess(publisher.index('gh release upload'), publisher.index('gh release edit'))
        self.assertIn('if [[ "$GITHUB_EVENT_NAME" == push ]]; then latest=true; fi', publisher)
        self.assertNotIn('gh release create', release)
        self.assertNotIn('push: true', text)
        self.assertIn("scripts/test-release-versioning.sh", jobs["code-quality"])


if __name__ == "__main__":
    unittest.main()
