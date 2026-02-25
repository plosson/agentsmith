FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN bun install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/api ./packages/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

VOLUME /data
EXPOSE 3000

ENV DATABASE_PATH=/data/agentsmith.db
ENV AUTH0_DOMAIN=
ENV AUTH0_AUDIENCE=
ENV AUTH0_CLIENT_ID=
ENV AUTH0_CLIENT_SECRET=
ENV PORT=3000

CMD ["bun", "run", "packages/api/src/index.ts"]
