/**
 * Vercel Serverless Function entry point.
 * Uses export = app so esbuild generates direct module.exports = app for Vercel.
 */
import app from "./app";

export = app;
