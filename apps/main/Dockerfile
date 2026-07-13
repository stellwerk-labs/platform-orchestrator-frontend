FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@0.31.0
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM nginx:stable-alpine

RUN apk add --no-cache bash jq

RUN sed -i '/^pid/d' /etc/nginx/nginx.conf && \
    echo 'pid /tmp/nginx.pid;' >> /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx

COPY apps/main/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/main/docker/ /app/docker
COPY --from=build /app/apps/main/dist /app/build
WORKDIR /app

RUN chown -R nginx:nginx /app

ARG VERSION
ENV VERSION=${VERSION}

EXPOSE 9000

# 101 - nginx
USER 101

CMD ["./docker/entry-point.sh"]
