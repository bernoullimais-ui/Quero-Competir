import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import institutionRoutes from "./routes/institutionRoutes.ts";
import tournamentRoutes from "./routes/tournamentRoutes.ts";
import memberRoutes from "./routes/memberRoutes.ts";
import authRoutes from "./routes/authRoutes.ts";
import membershipRoutes from "./routes/membershipRoutes.ts";
import paymentRoutes from "./routes/paymentRoutes.ts";
import { optionalAuth } from "./middleware/auth.ts";

// ─── Load env vars first (ESM-safe: called in module body, not hoisted) ────────
// This ensures env vars are available even when app.ts is imported before
// the parent module (server.ts) runs its own dotenv.config() call.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();

const isProduction = process.env.NODE_ENV === "production";


// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
              "'self'",
              process.env.SUPABASE_URL || "",
              "https://*.supabase.co",
              "wss://*.supabase.co",
            ],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
          },
        }
      : false, // Disable CSP in development for easier debugging
  })
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Always allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow localhost
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) return callback(null, true);
      // Allow querocompetir.com.br and vercel.app domains & subdomains
      if (origin.endsWith("querocompetir.com.br") || origin.endsWith("vercel.app")) return callback(null, true);
      // Allow configured APP_URL and its www/non-www variants
      if (process.env.APP_URL) {
        const appUrl = process.env.APP_URL;
        if (
          origin === appUrl ||
          origin === appUrl.replace("https://", "https://www.") ||
          origin === appUrl.replace("https://www.", "https://")
        ) {
          return callback(null, true);
        }
      }
      // Default: allow all origins
      return callback(null, true);
    },
    credentials: true,
  })
);

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(isProduction ? "combined" : "dev"));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", env: process.env.NODE_ENV || "development" });
});

// ─── Env Diagnostic (shows which vars are SET vs MISSING, never exposes values)
app.get("/api/health/env", (_req, res) => {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];
  const optional = ["APP_URL", "PAGARME_PUBLIC_KEY", "PAGARME_SECRET_KEY", "NODE_ENV"];
  const report: Record<string, string> = {};

  for (const key of required) {
    const val = process.env[key];
    if (!val) report[key] = "❌ MISSING";
    else if (key === "JWT_SECRET") report[key] = val.length >= 32 ? `✅ SET (${val.length} chars)` : `⚠️ TOO SHORT (${val.length} chars, need ≥32)`;
    else if (key === "SUPABASE_URL") report[key] = val.startsWith("https://") ? `✅ SET` : `⚠️ INVALID (must start with https://)`;
    else report[key] = "✅ SET";
  }

  for (const key of optional) {
    report[key] = process.env[key] ? "✅ SET" : "⚪ not set (optional)";
  }

  res.json({ status: "ok", variables: report });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(optionalAuth);
app.use("/api/institutions", institutionRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/payments", paymentRoutes);

// ─── Global Error Handler (must be last) ─────────────────────────────────────
// Catches any unhandled errors and returns JSON instead of HTML/plain-text.
// This prevents the "Unexpected token" JSON parse error on the frontend.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Erro interno do servidor.";
  console.error(`[ERROR ${status}]`, message);
  res.status(status).json({ error: message });
});

export default app;
