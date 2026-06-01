/**
 * Vercel Serverless Function entry point.
 *
 * The Vercel platform routes all /api/* requests to this file.
 * We simply re-export the configured Express app — Vercel handles
 * the conversion from its native Request/Response to Node's http.IncomingMessage.
 *
 * @see https://vercel.com/docs/functions/runtimes/node-js
 */
import "dotenv/config";
import app from "../src/backend/app.js";

export default app;
