/**
 * Vercel Serverless Function entry point.
 * Explicitly wraps Express app into standard Vercel serverless handler (req, res) => app(req, res).
 */
import app from "./app.ts";

export default function handler(req: any, res: any) {
  return app(req, res);
}
