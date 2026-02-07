import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Create Server using our new Routes logic
  // This fixes the VS Code error by matching the new signature
  const server = await registerRoutes(app);

  // 2. Global Error Handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // 3. Setup Vite (Dev) or Static Files (Prod)
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(server, app);
  } else {
    serveStatic(app);
  }

  // --- SMART CONFIGURATION (Works Locally & On Railway) ---
  
  // PORT: Railway gives us 'process.env.PORT'. Localhost defaults to 5000.
  const PORT = process.env.PORT || 5000;

  // HOST: 
  // - On Railway (Production), we MUST use "0.0.0.0" to be accessible.
  // - On Localhost (Development), "127.0.0.1" is safer/cleaner for Windows.
  const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

  server.listen(Number(PORT), HOST, () => {
    const env = process.env.NODE_ENV === "production" ? "Production" : "Development";
    console.log(`🚀 Server running in ${env} mode on http://${HOST}:${PORT}`);
  });
})();