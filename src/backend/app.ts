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

const app = express();

const isProduction = process.env.NODE_ENV === "production";

// Validate environment variables early — exits with clear messages if missing
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

export default app;
