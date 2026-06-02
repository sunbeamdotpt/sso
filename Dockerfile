# Stage 1: Build UI and compile Deno binary
FROM denoland/deno:2.7.3 AS deno-builder
WORKDIR /app
COPY deno.json deno.lock* ./
COPY src/ ./src/
COPY server/ ./server/
COPY main.ts ./
COPY index.html ./
COPY panda.config.ts ./
COPY postcss.config.cjs ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY styled-system/ ./styled-system/
COPY .kratos/ ./.kratos/
COPY identity.schema.json ./
COPY kratos.yaml ./
COPY openapi.json ./
COPY sunbeam.yaml ./
COPY scripts/ ./scripts/
RUN deno task build
RUN deno compile -o sso --allow-net --allow-read --allow-env main.ts

# Stage 2: distroless
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=deno-builder /app/sso ./
COPY --from=deno-builder /app/dist ./dist
EXPOSE 3000
ENTRYPOINT ["/app/sso"]
