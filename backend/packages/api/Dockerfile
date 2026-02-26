FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/canvas/package.json packages/canvas/
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
ENV AUTH_DISABLED=
ENV AUTH0_DOMAIN=
ENV AUTH0_AUDIENCE=
ENV AUTH0_CLIENT_ID=
# AUTH0_CLIENT_SECRET should be passed at runtime via docker run -e or compose
ENV PORT=3000

CMD ["bun", "run", "packages/api/src/index.ts"]
