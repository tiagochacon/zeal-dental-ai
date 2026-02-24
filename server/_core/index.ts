import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { SERVER_CONFIG, HTTP_STATUS } from "../constants";
import stripeWebhook from "../stripe/webhook";
import audioUploadRouter from "../routes/audioUpload";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = SERVER_CONFIG.DEFAULT_PORT): Promise<number> {
  for (let port = startPort; port < startPort + SERVER_CONFIG.PORT_SCAN_RANGE; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook needs raw body for signature verification
  // MUST be registered BEFORE express.json()
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
  
  // Configure body parser with reasonable limits for security
  // 10MB is sufficient for audio files while preventing DoS attacks
  app.use(express.json({ limit: SERVER_CONFIG.MAX_UPLOAD_SIZE }));
  app.use(express.urlencoded({ limit: SERVER_CONFIG.MAX_UPLOAD_SIZE, extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Audio upload route (multipart, supports large files up to 100MB)
  app.use("/api/calls/upload-audio", audioUploadRouter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(
    process.env[SERVER_CONFIG.PORT_ENV_KEY] || 
    String(SERVER_CONFIG.DEFAULT_PORT)
  );
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Global error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const isDev = process.env.NODE_ENV === "development";
    
    // Log error securely (don't expose in production)
    console.error("[Server Error]", isDev ? err : err.message);
    
    // Send appropriate error response
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: isDev ? err.message : "Erro interno do servidor",
      ...(isDev && { stack: err.stack }),
    });
  });

  server.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}/`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error.message);
  process.exit(1);
});
