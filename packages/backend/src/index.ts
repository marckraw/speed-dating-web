import { serve } from "@hono/node-server";
import { Context, Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config.env";
import { pinoLogger } from "./middleware/pino-logger";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { bodyLimit } from "./middleware/upload";
import { rateLimit } from "./middleware/rate-limit";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  speedDatingSignaling,
  type SignalingMessage,
} from "./services/websocket-signaling";

// ✅ Now import API router - services are already registered
import apiRouter from "./routes/api";

const app = new Hono();

// Create WebSocket support
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", pinoLogger());
app.use(
  "/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:4000",
      "http://localhost:3333",
    ], // Add frontend and backend URLs
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PUT", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 600,
    credentials: true,
  })
);
app.use("*", errorHandler());
app.use(
  "*", // Limit of the upload file size
  bodyLimit({
    maxSize: 50 * 1024 * 1024, // 50MB
    onError: (c: Context) => c.text("File too large", 413),
  })
);
app.use(
  "*",
  rateLimit({
    max: 100, // 100 requests
    window: 60, // per 60 seconds
    message: "Rate limit exceeded. Please try again later.",
  })
);

// WebSocket route for speed dating signaling
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    // Extract userId from query params or generate one
    const userId =
      c.req.query("userId") ||
      `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      onOpen(_event, ws) {
        console.log(`WebSocket connection opened for user: ${userId}`);
        if (ws.raw) {
          speedDatingSignaling.addConnection(userId, ws.raw);
        }
      },

      onMessage(event, ws) {
        try {
          const message: SignalingMessage = JSON.parse(event.data.toString());
          console.log(`Message from ${userId}:`, message.type);
          speedDatingSignaling.handleSignalingMessage(userId, message);
        } catch (error) {
          console.error(`Error parsing message from ${userId}:`, error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            })
          );
        }
      },

      onClose() {
        console.log(`WebSocket connection closed for user: ${userId}`);
        speedDatingSignaling.removeConnection(userId);
      },

      onError(event) {
        console.error(`WebSocket error for user ${userId}:`, event);
        speedDatingSignaling.removeConnection(userId);
      },
    };
  })
);

// API route for getting queue status (for debugging/admin)
app.get("/api/queue-status", (c) => {
  const status = speedDatingSignaling.getQueueStatus();
  return c.json(status);
});

app.route("/api", apiRouter); // api router - this is the route with Authorization header

export type AppType = typeof app;

const port = parseInt(config.PORT) || 3000;

const server = serve({
  fetch: app.fetch,
  port,
});

// Inject WebSocket support into the server
injectWebSocket(server);

console.log(`🚀 Speed Dating Server is running on port ${port}`);
console.log(`📹 WebSocket endpoint: ws://localhost:${port}/ws`);
console.log(`📊 Queue status: http://localhost:${port}/api/queue-status`);
