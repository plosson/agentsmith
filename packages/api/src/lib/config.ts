export const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  databasePath: process.env.DATABASE_PATH || "./data/agentsmith.db",
  auth0: {
    domain: process.env.AUTH0_DOMAIN || "",
    audience: process.env.AUTH0_AUDIENCE || "",
    clientId: process.env.AUTH0_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
  },
  payloadMaxBytes: Number.parseInt(process.env.PAYLOAD_MAX_BYTES || "65536", 10),
  cleanupIntervalMs: Number.parseInt(process.env.CLEANUP_INTERVAL_MS || "300000", 10),
};
