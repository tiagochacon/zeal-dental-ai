import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { nanoid } from "nanoid";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { SERVER_CONFIG, HTTP_STATUS } from "../constants";
import stripeWebhook from "../stripe/webhook";
import audioUploadRouter from "../routes/audioUpload";
import consultationAudioUploadRouter from "../routes/consultationAudioUpload";
import { registerConsultationStreamingWs } from "../routes/consultationStreaming.route";
import { getConsultationStreamingStatus } from "../helpers/consultationStreamingAvailability";
import { transcribeRouter } from "../routes/transcribe.route";
import whatsappUploadRouter from "../routes/whatsappUpload";

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
  registerConsultationStreamingWs(server);
  
  // Stripe webhook needs raw body for signature verification
  // MUST be registered BEFORE express.json()
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
  
  // Transcribe endpoint needs large body limit for base64 audio chunks (up to 50MB)
  // MUST be registered BEFORE the global express.json() to use its own parser
  app.use("/api/transcribe-chunk", express.json({ limit: "50mb" }), transcribeRouter);
  
  // Configure body parser with reasonable limits for security
  // 10MB for JSON (includes base64 audio chunks in tRPC), 10MB for other uploads
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: SERVER_CONFIG.MAX_UPLOAD_SIZE, extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Audio upload route for calls (multipart, supports large files up to 100MB)
  app.use("/api/calls/upload-audio", audioUploadRouter);
  // Audio upload route for consultations (multipart, supports large files up to 1.5GB)
  app.use("/api/consultations/upload-audio", consultationAudioUploadRouter);
  // WhatsApp export upload route (multipart, .zip up to 100MB)
  app.use("/api/calls/upload-whatsapp-export", whatsappUploadRouter);
  // tRPC API with request tracing for RCA in proxy/CDN environments
  app.use(
    "/api/trpc",
    (req, res, next) => {
      const requestId = String(req.headers["x-request-id"] || `trpc-${nanoid(10)}`);
      const startedAt = Date.now();
      res.setHeader("x-request-id", requestId);
      (req as any).requestId = requestId;
      console.log(`[tRPC][${requestId}] ${req.method} ${req.originalUrl} start`);
      res.on("finish", () => {
        console.log(
          `[tRPC][${requestId}] ${req.method} ${req.originalUrl} done status=${res.statusCode} durationMs=${Date.now() - startedAt}`
        );
      });
      next();
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Ensure every unknown API route returns JSON (never HTML fallback)
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      error: "API route not found",
      path: req.originalUrl,
      requestId: String((req as any).requestId || ""),
    });
  });
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

    const streamingStatus = getConsultationStreamingStatus();
    if (streamingStatus.enabled && !streamingStatus.ready) {
      console.warn(
        `[ConsultationStreaming] Live ASR indisponível (${streamingStatus.provider}): ${streamingStatus.reason}`
      );
      console.warn(
        "[ConsultationStreaming] Consultas usarão gravação progressiva até o provider estar configurado."
      );
    } else if (streamingStatus.ready) {
      console.log(
        `[ConsultationStreaming] Live ASR ativo (${streamingStatus.provider}).`
      );
    }

    // Verificação de conexão Supabase (não-blocante — roda após o servidor subir)
    (async () => {
      try {
        const { supabase } = await import("../lib/supabaseClient");
        const { error } = await supabase.from("Users").select("id").limit(1);
        if (error) {
          console.error("❌ [Supabase] Falha na conexão ou RLS bloqueando:", error.message);
          console.error("   Verifique se o RLS está desabilitado no Supabase Dashboard.");
        } else {
          console.log("✅ [Supabase] Conexão OK.");
        }
      } catch (err: any) {
        console.error("❌ [Supabase] Erro ao testar conexão:", err?.message ?? err);
      }
    })();
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error.message);
  process.exit(1);
});
