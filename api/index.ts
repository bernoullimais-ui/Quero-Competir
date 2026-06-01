/**
 * Vercel Serverless Function entry point.
 *
 * The Vercel platform routes all /api/* requests to this file.
 * We export the configured Express app — Vercel wraps it as a serverless handler.
 *
 * @see https://vercel.com/docs/functions/runtimes/node-js
 */
import app from "../src/backend/app.ts";

export default app;
