#!/usr/bin/env python3
"""Wait for a copied OCI graph to become readable, without writing to the registry."""

import hashlib
import json
from functools import lru_cache
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.request import parse_http_list, parse_keqv_list


IMAGE = "ghcr.io/stellwerk-labs/platform-orchestrator-frontend"
MEDIA = "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json"


class Missing(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


OPENER = build_opener(NoRedirect)


def descriptors(layout, digest):
    root = json.loads((layout / "index.json").read_bytes())["manifests"]
    if len(root) != 1 or root[0]["digest"] != digest:
        raise ValueError("local index differs from the approved digest")
    pending, objects = [(root[0], "manifests")], {}
    while pending:
        descriptor, kind = pending.pop()
        name, size = descriptor["digest"], descriptor["size"]
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", name) or type(size) is not int or size < 0:
            raise ValueError("invalid local descriptor")
        if name in objects:
            if objects[name] != (kind, size):
                raise ValueError("conflicting local descriptor")
            continue
        data = (layout / "blobs/sha256" / name[7:]).read_bytes()
        if len(data) != size or "sha256:" + hashlib.sha256(data).hexdigest() != name:
            raise ValueError("local OCI graph differs from its descriptors")
        objects[name] = (kind, size)
        if kind == "manifests":
            value = json.loads(data)
            if value["schemaVersion"] != 2 or value["mediaType"] != descriptor["mediaType"]:
                raise ValueError("local OCI media type differs")
            if value["mediaType"] == "application/vnd.oci.image.index.v1+json":
                pending.extend((child, "manifests") for child in value["manifests"])
            elif value["mediaType"] == "application/vnd.oci.image.manifest.v1+json":
                pending.extend((child, "blobs") for child in [value["config"], *value["layers"]])
            else:
                raise ValueError("unexpected OCI manifest media type")
    return objects


def request(url, token=None):
    headers = {"Accept": MEDIA}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with OPENER.open(Request(url, headers=headers, method="HEAD"), timeout=10) as response:
            if response.status != 200:
                raise ValueError(f"unexpected registry status {response.status}")
            return response.headers
    except HTTPError as error:
        if error.code == 404:
            raise Missing from error
        if error.code == 401 and token is None:
            challenge = error.headers.get("WWW-Authenticate", "")
            if not challenge.startswith("Bearer "):
                raise ValueError("registry authentication challenge differs") from error
            fields = parse_keqv_list(parse_http_list(challenge[7:]))
            if fields.get("realm") != "https://ghcr.io/token" or fields.get("service") != "ghcr.io":
                raise ValueError("registry token service differs") from error
            scope = fields.get("scope")
            if scope != "repository:stellwerk-labs/platform-orchestrator-frontend:pull":
                raise ValueError("registry token scope differs") from error
            return request(url, anonymous_token(scope))
        raise ValueError(f"registry HTTP status {error.code}") from error
    except URLError as error:
        raise ValueError("registry transport error") from error


@lru_cache(maxsize=2)
def anonymous_token(scope, token_service="https://ghcr.io/token"):
    try:
        with OPENER.open(token_service + "?" + urlencode({"service": "ghcr.io", "scope": scope}), timeout=10) as answer:
            value = json.load(answer)
    except HTTPError as error:
        raise ValueError(f"registry token HTTP status {error.code}") from error
    except URLError as error:
        raise ValueError("registry token transport error") from error
    bearer = value.get("token") or value.get("access_token")
    if not isinstance(bearer, str) or not bearer:
        raise ValueError("registry did not issue anonymous pull token")
    return bearer


def check_once(base, repository, tag, digest, objects):
    endpoints = [("manifests", tag, digest, objects[digest][1])]
    endpoints += [(kind, name, name, size) for name, (kind, size) in sorted(objects.items())]
    for kind, reference, expected, size in endpoints:
        headers = request(f"{base}/v2/{repository}/{kind}/{reference}")
        if headers.get("Docker-Content-Digest") != expected or headers.get("Content-Length") != str(size):
            raise ValueError(f"registry {kind} identity or size differs for {reference}")


def wait_visible(layout, base, repository, tag, digest, *, seconds=60, interval=3):
    objects = descriptors(layout, digest)
    deadline = time.monotonic() + seconds
    attempts = 0
    while True:
        attempts += 1
        try:
            check_once(base, repository, tag, digest, objects)
            return {"attempts": attempts, "graphObjects": len(objects), "digest": digest}
        except Missing:
            if time.monotonic() >= deadline:
                raise ValueError("approved OCI graph never became visible") from None
            time.sleep(min(interval, max(0, deadline - time.monotonic())))


def main():
    if len(sys.argv) != 4:
        raise ValueError("usage: registry_visibility.py LAYOUT IMAGE:TAG EXPECTED_DIGEST")
    layout, reference, digest = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    if not layout.is_absolute() or not reference.startswith(IMAGE + ":") or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise ValueError("invalid approved OCI reference")
    tag = reference[len(IMAGE) + 1:]
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", tag):
        raise ValueError("invalid OCI tag")
    print(json.dumps(wait_visible(layout, "https://ghcr.io", "stellwerk-labs/platform-orchestrator-frontend", tag, digest)))


if __name__ == "__main__":
    main()
