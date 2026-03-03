import { logger } from "hono/logger";

export const requestLogger = logger((message: string) => {
  if (message.startsWith("-->")) {
    console.log(message);
  }
});
