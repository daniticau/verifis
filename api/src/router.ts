import { Hono } from "hono";
import { factcheckText } from "./factcheck";
import { FactcheckRequestSchema } from "./schema";
import type { FactcheckRequest } from "@verifis/shared-types";

const SHARED_SECRET = process.env.EXTENSION_SHARED_SECRET || "";

export function createRouter() {
  const app = new Hono();

  // Middleware to check shared secret
  app.use("/factcheck", async (c, next) => {
    const token = c.req.header("X-EXTENSION-TOKEN");
    if (!SHARED_SECRET || token !== SHARED_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.post("/factcheck", async (c) => {
    try {
      const body = await c.req.json();
      const validationResult = FactcheckRequestSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Invalid request",
            details: validationResult.error.errors,
          },
          400
        );
      }

      const request: FactcheckRequest = validationResult.data;
      const result = await factcheckText(request.text);

      return c.json(result);
    } catch (error) {
      console.error("Factcheck error:", error);
      return c.json(
        {
          error: "Internal server error",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        500
      );
    }
  });

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  return app;
}

