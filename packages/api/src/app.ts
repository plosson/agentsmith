import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { requestLogger } from "./middleware/logger";

const app = new Hono();

app.use("*", requestLogger);
app.use("*", cors());
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
