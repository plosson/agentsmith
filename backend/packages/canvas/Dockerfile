FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/canvas/package.json packages/canvas/
RUN bun install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/canvas/ packages/canvas/

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/canvas ./packages/canvas
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3002

ENV CANVAS_PORT=3002
ENV AGENTSMITH_API_URL=

WORKDIR /app/packages/canvas
CMD ["bun", "run", "src/index.ts"]
