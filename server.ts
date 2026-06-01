import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import path from "path";
import { createServer as createViteServer } from "vite";
import app from "./src/backend/app.ts";

async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Vite middleware for development (hot reload)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend build in production
    const distPath = path.join(process.cwd(), "dist");
    const { default: express } = await import("express");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Quero Competir Backend running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
