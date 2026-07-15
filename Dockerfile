# syntax=docker/dockerfile:1.7

FROM node:24.14.0-alpine3.22@sha256:76db75ca7e7da9148ae42c92d9be12d12a8d7b03e171f18339355d8078d644a0 AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN apk upgrade --no-cache \
    && corepack enable \
    && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

ARG APP_VERSION=0.1.0-staging
ARG BUILD_TIMESTAMP=unknown
ARG GIT_SHA=unknown

ENV APP_VERSION=$APP_VERSION \
    BUILD_TIMESTAMP=$BUILD_TIMESTAMP \
    DATABASE_URL=postgresql://build-only:build-only@127.0.0.1:5432/build-only \
    GIT_SHA=$GIT_SHA \
    NEXTAUTH_SECRET=build-only-placeholder-not-a-runtime-secret \
    NEXTAUTH_URL=https://build.invalid

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm build

FROM node:24.14.0-alpine3.22@sha256:76db75ca7e7da9148ae42c92d9be12d12a8d7b03e171f18339355d8078d644a0 AS runtime

ARG APP_VERSION=0.1.0-staging
ARG BUILD_TIMESTAMP=unknown
ARG GIT_SHA=unknown

LABEL org.opencontainers.image.created=$BUILD_TIMESTAMP \
      org.opencontainers.image.description="247 Home staging application" \
      org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.title="247 Home" \
      org.opencontainers.image.version=$APP_VERSION

ENV HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000

RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/corepack /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "server.js"]
