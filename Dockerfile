# Copyright Sunbeam Studios 2026
# SPDX-License-Identifier: AGPL-3.0-or-later

# Stage 1: Build the Vite SPA.
# This stage always runs on the native build platform because Node/Deno
# postinstall scripts (esbuild, protobufjs) fail under QEMU emulation.
FROM --platform=$BUILDPLATFORM denoland/deno:2.7.3 AS ui-builder
ARG VERSION=unknown
ENV VERSION=${VERSION}
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

# Stage 2: Build the Rust SSO server for the target architecture.
# The server embeds the compiled dist folder from stage 1 so the final image
# only needs the single static binary.
FROM --platform=$TARGETPLATFORM rust:1.96-slim-bookworm AS rust-builder
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ curl ca-certificates cmake pkg-config make protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/ ./api/
COPY --from=ui-builder /app/dist ./dist
RUN cd api && cargo build --release
RUN cp /app/api/target/release/sso /sso

# Pin tini to a released version and verify its checksum before copying into
# the final image.
RUN case "${TARGETARCH}" in \
      "amd64") TINI_ARCH="amd64" ;; \
      "arm64") TINI_ARCH="arm64" ;; \
      *) TINI_ARCH="$(uname -m)" ;; \
    esac && \
    curl -fsSL -o /tini \
      "https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-${TINI_ARCH}" && \
    case "${TINI_ARCH}" in \
      "amd64") echo "c5b0666b4cb676901f90dfcb37106783c5fe2077b04590973b885950611b30ee  /tini" ;; \
      "arm64") echo "eae1d3aa50c48fb23b8cbdf4e369d0910dfc538566bfd09df89a774aa84a48b9  /tini" ;; \
    esac | sha256sum -c - && \
    chmod +x /tini

# Stage 3: distroless final image.
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=rust-builder --chown=65532:65532 /tini                       /tini
COPY --from=rust-builder --chown=65532:65532 /sso                        /app/sso
USER 65532:65532
EXPOSE 3102
ENTRYPOINT ["/tini", "--", "/app/sso"]
