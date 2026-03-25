import type { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Set up Vite dev server middleware for development,
 * or serve static files in production.
 */
export async function setupVite(app: Express) {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, "../../client"),
    });
    app.use(vite.middlewares);
  }
}

/**
 * Serve static files from the build output directory.
 */
export async function serveStatic(app: Express) {
  const { default: express } = await import("express");

  // In production, dist/index.js runs from the dist/ folder.
  // Static files are at dist/public/ — which is ./public relative to the bundle.
  const distPath = path.resolve(process.cwd(), "dist/public");

  app.use(express.static(distPath));

  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
