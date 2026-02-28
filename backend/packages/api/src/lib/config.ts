export const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  databasePath: process.env.DATABASE_PATH || "./data/agentsmith.db",
  authDisabled: process.env.AUTH_DISABLED === "true",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
  },
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpirySeconds: Number.parseInt(process.env.JWT_EXPIRY_SECONDS || "604800", 10), // 7 days
  payloadMaxBytes: Number.parseInt(process.env.PAYLOAD_MAX_BYTES || "65536", 10),
  cleanupIntervalMs: Number.parseInt(process.env.CLEANUP_INTERVAL_MS || "300000", 10),
};
