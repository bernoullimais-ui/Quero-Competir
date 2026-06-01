/**
 * Minimal diagnostic function — tests Vercel runtime WITHOUT importing
 * any of the heavy Express route files. If this works, the crash is in
 * one of the route imports. If this also crashes, the issue is in the
 * Vercel function runtime configuration itself.
 */
export default function handler(req: any, res: any) {
  const vars = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
    "NODE_ENV",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
  ];

  const report: Record<string, string> = {};
  for (const key of vars) {
    const val = process.env[key];
    if (!val) {
      report[key] = "❌ MISSING";
    } else if (key === "JWT_SECRET") {
      report[key] = val.length >= 32
        ? `✅ SET (${val.length} chars)`
        : `⚠️ TOO SHORT — only ${val.length} chars, need ≥ 32`;
    } else if (key.includes("URL")) {
      report[key] = val.startsWith("https://")
        ? `✅ SET — ${val}`
        : `⚠️ INVALID — must start with https://`;
    } else {
      report[key] = `✅ SET (${val.length} chars)`;
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    status: "ok",
    message: "Minimal Vercel function is working",
    nodeVersion: process.version,
    variables: report,
  });
}
