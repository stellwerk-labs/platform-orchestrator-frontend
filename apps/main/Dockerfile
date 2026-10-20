FROM --platform=$BUILDPLATFORM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ARG SOURCE_DATE_EPOCH
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ADD --checksum=sha256:bd9ec5417641391e0acb3912b2912bd5b0385407a82da94744a7407b567fdb4f https://registry.npmjs.org/pnpm/-/pnpm-10.17.0.tgz /tmp/pnpm.tgz
RUN --network=none npm install --global --ignore-scripts --offline --no-audit --no-fund /tmp/pnpm.tgz && \
    rm /tmp/pnpm.tgz && test "$(pnpm --version)" = 10.17.0
COPY . /app
WORKDIR /app

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN node scripts/verify-runtime-notices.mjs
RUN pnpm run build --force

FROM nginx:1.30.5-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 AS apk-inputs
ARG TARGETARCH
COPY scripts/download-runtime-apks.sh scripts/runtime-apks.sha256 /inputs/
RUN sh /inputs/download-runtime-apks.sh "$TARGETARCH" /apks

FROM nginx:1.30.5-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c
ARG SOURCE_DATE_EPOCH

LABEL org.opencontainers.image.source="https://github.com/stellwerk-labs/platform-orchestrator-frontend"

RUN --network=none --mount=type=bind,from=apk-inputs,source=/apks,target=/apks,ro \
    apk --no-logfile add --no-network --no-cache /apks/*.apk

RUN sed -i '/^pid/d' /etc/nginx/nginx.conf && \
    echo 'pid /tmp/nginx.pid;' >> /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx

COPY --chmod=0644 apps/main/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/main/docker/ /app/docker
COPY --from=build /app/apps/main/dist /app/build
COPY --from=build /app/apps/main/dist/licenses /licenses
COPY --from=build /app/scripts/runtime-notices /licenses/runtime-apks
COPY --from=apk-inputs /usr/share/licenses/nginx /licenses/base/nginx
WORKDIR /app

RUN chown -R nginx:nginx /app

ARG VERSION
ENV VERSION=${VERSION}

EXPOSE 9000

# 101 - nginx
USER 101

CMD ["./docker/entry-point.sh"]
