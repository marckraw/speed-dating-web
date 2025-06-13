import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { config } from "../../config.env";
import audioRouter from "./audio";
import elevenlabsRouter from "./elevenlabs";

// Main API Router
const apiRouter = new Hono();

const token = config.X_API_KEY; // Token for authorization get from .env
apiRouter.use("/audio/*", bearerAuth({ token }));
apiRouter.use("/elevenlabs/*", bearerAuth({ token }));

apiRouter.route("/audio", audioRouter);
apiRouter.route("/elevenlabs", elevenlabsRouter);

export default apiRouter;
