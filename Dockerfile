# Copyright Sunbeam Studios 2026
# SPDX-License-Identifier: AGPL-3.0-or-later
# syntax=docker/dockerfile:1
# Multi-stage, multi-architecture build for the SSO portal.
#
# Build for a single platform:
#   docker buildx build --platform linux/amd64 -f Dockerfile -t ghcr.io/sunbeamdotpt/sso:v1.0.0-rc13 .
#
# Build for both platforms:
#   docker buildx build --platform linux/amd64,linux/arm64 -f Dockerfile -t ghcr.io/sunbeamdotpt/sso:v1.0.0-rc13 .

ARG VERSION=unknown

FROM --platform=$BUILDPLATFORM tonistiigi/xx AS xx

# Stage 1: Build the Vite SPA on the native build platform.
# Deno postinstall scripts (esbuild, protobufjs) do not run reliably under QEMU,
# so this stage is always built natively and the resulting dist/ is copied into
# the Rust stage.
FROM --platform=$BUILDPLATFORM denoland/deno:2.7.3 AS ui-builder

WORKDIR /app

COPY deno.json deno.lock* ./
COPY src/ ./src/
COPY index.html ./
COPY panda.config.ts ./
COPY postcss.config.cjs ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY styled-system/ ./styled-system/
COPY scripts/ ./scripts/

RUN deno task build

# Stage 2: Build the Rust SSO server with xx cross-compilation helpers.
FROM --platform=$BUILDPLATFORM rust:1.96-slim-bookworm AS rust-builder

# Bring in xx cross-compilation helpers.
COPY --from=xx / /

# clang + lld are used by xx-cargo for cross-compilation linking;
# protobuf-compiler is needed by sunbeam-g2v's build script.
RUN apt-get update \
    && apt-get install -y clang lld protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the backend crate and the compiled SPA into the build tree.
# static_files.rs expects the SPA at ../dist relative to api/src/.
COPY api/ ./api/
COPY --from=ui-builder /app/dist ./dist

WORKDIR /app/api

# Fetch dependencies once, before TARGETPLATFORM is exposed, so the registry
# cache is shared across target architectures.
RUN --mount=type=cache,target=/root/.cargo/git/db \
    --mount=type=cache,target=/root/.cargo/registry/cache \
    --mount=type=cache,target=/root/.cargo/registry/index \
    cargo fetch --locked

ARG TARGETPLATFORM

# Install the target C library headers and build the release binary.
# xx-cargo selects the correct Rust target triple from TARGETPLATFORM.
RUN --mount=type=cache,target=/root/.cargo/git/db \
    --mount=type=cache,target=/root/.cargo/registry/cache \
    --mount=type=cache,target=/root/.cargo/registry/index \
    xx-apt-get install -y gcc libc6-dev \
    && xx-cargo build --release --locked --bin sso \
    && cp /app/api/target/$(xx-cargo --print-target-triple)/release/sso /app/sso \
    && xx-verify /app/sso

# Stage 3: distroless final image.
FROM gcr.io/distroless/cc-debian12:nonroot

ARG VERSION

# OCI annotations so GHCR autolinks the image to the repository.
LABEL org.opencontainers.image.title="sso" \
      org.opencontainers.image.description="Sunbeam SSO portal" \
      org.opencontainers.image.url="https://github.com/sunbeamdotpt/sso" \
      org.opencontainers.image.source="https://github.com/sunbeamdotpt/sso.git" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"

COPY --from=rust-builder --chown=65532:65532 /app/sso /app/sso

USER 65532:65532
EXPOSE 3102
ENTRYPOINT ["/app/sso"]
