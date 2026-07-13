#!/usr/bin/env bash
set -eo pipefail

# Inject env config into the app
./docker/init-env.sh
ENV_CONFIG_CONTENT=$(cat ./env-config.js);
export ENV_CONFIG_CONTENT
awk '{sub(/let ENV_CONFIG/,ENVIRON["ENV_CONFIG_CONTENT"])}1' /app/build/index.html > temp.html && mv temp.html /app/build/index.html
export -n ENV_CONFIG_CONTENT

exec nginx -g 'daemon off;'
