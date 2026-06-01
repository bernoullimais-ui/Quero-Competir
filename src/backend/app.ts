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
import { optionalAuth } from "./middleware/auth.ts";
import { validateEnv } from "./lib/validateEnv.ts";

// ─── Load env vars first (ESM-safe: called in module body, not hoisted) ────────
// This ensures env vars are available even when app.ts is imported before
// the parent module (server.ts) runs its own dotenv.config() call.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();

const isProduction = process.env.NODE_ENV === "production";

// Validate environment variables early — throws if required vars are missing
validateEnv();

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
const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL, "http://localhost:3000", "http://localhost:5173"]
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || !isProduction) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
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

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(optionalAuth);
app.use("/api/institutions", institutionRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/memberships", membershipRoutes);

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
