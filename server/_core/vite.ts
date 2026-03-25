import type { Express } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Try multiple possible locations for the static files.
  // In production the bundle is at dist/index.js and static files are at dist/public/.
  // __dirname resolves to the directory containing the running bundle (dist/).
  // process.cwd() is the working directory (typically the project root or /app in Docker).
  const candidates = [
    path.resolve(__dirname, "public"),           // dist/public (relative to bundle)
    path.resolve(process.cwd(), "dist/public"),  // dist/public (relative to cwd)
    path.resolve(process.cwd(), "public"),       // public (if cwd is dist/)
  ];

  let distPath = candidates[0]; // default fallback
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      distPath = candidate;
      break;
    }
  }

  console.log(`[Static] __dirname: ${__dirname}`);
  console.log(`[Static] process.cwd(): ${process.cwd()}`);
  console.log(`[Static] Serving files from: ${distPath}`);
  console.log(`[Static] index.html exists: ${fs.existsSync(path.join(distPath, "index.html"))}`);

  app.use(express.static(distPath));

  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (req, res) => {
    // Skip API routes (already handled by tRPC middleware above)
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send("index.html not found at " + indexPath);
    }
  });
}
