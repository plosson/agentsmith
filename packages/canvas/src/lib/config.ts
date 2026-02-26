export const config = {
  port: Number.parseInt(process.env.CANVAS_PORT || "3002", 10),
  apiUrl: process.env.AGENTSMITH_API_URL || "http://localhost:3000",
};
