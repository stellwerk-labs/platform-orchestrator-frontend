#!/bin/sh
# Exact official Alpine inputs. Installation is a separate, networkless step.
set -eu
arch="${1:?target architecture required}"
output="${2:?new APK directory required}"
case "$arch" in amd64) alpine_arch=x86_64 ;; arm64) alpine_arch=aarch64 ;; *) exit 1 ;; esac
test ! -e "$output"
mkdir "$output"
count=0
while read -r checksum url; do
  case "$url" in
    "https://dl-cdn.alpinelinux.org/alpine/v3.24/main/$alpine_arch/"*.apk)
      file="$output/${url##*/}"
      test ! -e "$file"
      curl --fail --silent --show-error --location --max-time 120 "$url" -o "$file"
      printf '%s  %s\n' "$checksum" "$file" | sha256sum -c -
      count=$((count + 1))
      ;;
  esac
done < "$(dirname "$0")/runtime-apks.sha256"
test "$count" = 6
