#!/usr/bin/env bash
set -eo pipefail

obj='{}'

# Read each line in ./docker/init-env-vars and populate the value from the env vars
while read -r line || [[ -n "$line" ]];
do
  obj=$(echo "$obj" | jq ".\"$line\"=env.\"$line"\")
done < ./docker/init-env-vars

echo "window.env = $(echo "$obj" | jq -cr '.')" > ./env-config.js
