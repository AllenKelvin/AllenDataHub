import express, { type Express } from "express";

export function serveStatic(app: Express) {
  // Frontend is now served separately from Vercel
  // This function is a no-op for the backend-only setup
}
