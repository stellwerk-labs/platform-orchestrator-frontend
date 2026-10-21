#!/usr/bin/env bash
set -euo pipefail
image="${1:?usage: test-console-image.sh LOADED_IMAGE INSPECTION_REPORT}"
report="${2:?inspection report required}"
actual="$(docker image inspect --format '{{.Os}}/{{.Architecture}} {{.Id}}' "$image")"
python3 - "$report" "$actual" <<'PY'
import json, sys
platform, identity = sys.argv[2].split()
os, arch = platform.split("/")
report = json.load(open(sys.argv[1]))
payloads = report["payloads"]
# Classic Docker identifies images by config; the containerd image store uses
# the complete loaded OCI index. Both must be exact inspected identities.
if os != "linux" or arch not in payloads or identity not in (report["index"], payloads[arch]["config"]):
    raise SystemExit("loaded image differs from inspected OCI identity")
PY
timeout -k 5s 30s docker run --rm --pull=never --network none --cpus 1 --memory 256m \
  --pids-limit 128 --entrypoint nginx "$image" -t
container="$(timeout -k 5s 30s docker run -d --pull=never --cpus 1 --memory 256m \
  --pids-limit 128 --publish 127.0.0.1::9000 \
  --env BASE_URL=https://api.example.org --env ENVIRONMENT_NAME=qualification-regression \
  --env DEPLOYMENT_MODE=enterprise --env PRODUCT_NAME=Console "$image")"
[[ "$container" =~ ^[0-9a-f]{64}$ ]] || { echo "invalid disposable container identity" >&2; exit 1; }
trap 'docker rm -f "$container" >/dev/null' EXIT
port="$(docker port "$container" 9000/tcp)"
[[ "$port" =~ ^127\.0\.0\.1:[0-9]+$ ]]
python3 - "$port" <<'PY'
import json, re, sys, time
from urllib.error import URLError
from urllib.request import urlopen
base = "http://" + sys.argv[1]
for attempt in range(30):
    try:
        with urlopen(base + "/", timeout=2) as response:
            body, headers = response.read(2 * 1024 * 1024).decode(), response.headers
        break
    except URLError:
        time.sleep(1)
else:
    raise SystemExit("Console did not start within bounded wait")
assert "let ENV_CONFIG" not in body
config = json.JSONDecoder().raw_decode(body.split("window.env = ", 1)[1])[0]
assert config["BASE_URL"] == "https://api.example.org"
assert config["ENVIRONMENT_NAME"] == "qualification-regression"
assert config["DEPLOYMENT_MODE"] == "enterprise" and config["PRODUCT_NAME"] == "Console"
assert "no-store" in ",".join(headers.get_all("Cache-Control", []))
with urlopen(base + "/projects/deep/route", timeout=5) as response:
    assert response.read().decode() == body
asset = re.search(r'src="(/assets/[^" ]+\.js)"', body)[1]
with urlopen(base + asset, timeout=5) as response:
    assert response.status == 200 and response.read(1)
    assert "public" in ",".join(response.headers.get_all("Cache-Control", []))
with urlopen(base + "/licenses/dependencies.json", timeout=5) as response:
    assert json.load(response)
print("Exact loaded Console image: nginx configuration, startup injection, SPA fallback, assets and notices passed")
PY
