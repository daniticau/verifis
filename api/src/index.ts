import "./config";
import { serve } from "@hono/node-server";
import { createRouter } from "./router";

const port = parseInt(process.env.PORT || "3000", 10);

const app = createRouter();

console.log(`Server running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

