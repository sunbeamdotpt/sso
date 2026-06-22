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

# Stage 2: Build the Rust SSO server.
# Cross-compile both amd64 and arm64 binaries from the native build platform to
# avoid running the Rust compiler under QEMU emulation, which is pathologically
# slow and can hang on larger dependency graphs.
FROM --platform=$BUILDPLATFORM rust:1.96-slim-bookworm AS rust-builder
ARG TARGETARCH
ARG BUILDARCH
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ gcc-aarch64-linux-gnu \
      curl ca-certificates cmake pkg-config make protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*
RUN rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu
WORKDIR /app
COPY api/ ./api/
COPY --from=ui-builder /app/dist ./dist

# Build amd64 binary.
RUN cd api && \
    CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=gcc \
    cargo build --release --target x86_64-unknown-linux-gnu && \
    cp target/x86_64-unknown-linux-gnu/release/sso /sso-amd64

# Build arm64 binary.
RUN cd api && \
    CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
    cargo build --release --target aarch64-unknown-linux-gnu && \
    cp target/aarch64-unknown-linux-gnu/release/sso /sso-arm64

# Pin tini to a released version, fetch both architectures, and verify checksums.
RUN curl -fsSL -o /tini-amd64 \
      "https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-amd64" && \
    curl -fsSL -o /tini-arm64 \
      "https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-arm64" && \
    echo "c5b0666b4cb676901f90dfcb37106783c5fe2077b04590973b885950611b30ee  /tini-amd64" | sha256sum -c - && \
    echo "eae1d3aa50c48fb23b8cbdf4e369d0910dfc538566bfd09df89a774aa84a48b9  /tini-arm64" | sha256sum -c - && \
    chmod +x /tini-amd64 /tini-arm64

# Stage 3: distroless final image.
FROM gcr.io/distroless/cc-debian12:nonroot
ARG TARGETARCH
WORKDIR /app
COPY --from=rust-builder --chown=65532:65532 /tini-${TARGETARCH} /tini
COPY --from=rust-builder --chown=65532:65532 /sso-${TARGETARCH} /app/sso
USER 65532:65532
EXPOSE 3102
ENTRYPOINT ["/tini", "--", "/app/sso"]
