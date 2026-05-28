# Stage 1: build UI
FROM node:22-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Stage 2: compile Deno binary
FROM denoland/deno:2.7.3 AS deno-builder
WORKDIR /app
COPY deno.json deno.lock* ./
COPY server/ ./server/
COPY main.ts ./
COPY --from=ui-builder /app/ui/dist ./ui/dist
RUN deno cache main.ts
RUN deno task compile

# Stage 3: distroless
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
# Copy binary and UI dist so serveStatic({ root: "./ui/dist" }) resolves from /app
COPY --from=deno-builder /app/sso ./
COPY --from=ui-builder /app/ui/dist ./ui/dist
EXPOSE 3000
ENTRYPOINT ["/app/sso"]
