import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
// Hand-written static files (served at "/" in dev, copied to dist/ on build).
const staticDir = path.join(root, "assets", "static");
// Generated image pool + counts.json: a build artifact, never next to sources.
const generatedDir = path.join(root, "assets", "generated");
const outDir = path.join(root, "dist");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

/**
 * The generated pool lives outside `publicDir` (it is git-ignored and 1 GB),
 * so both dev and build have to splice it in. URLs stay flat — `/counts.json`
 * and `/<category>/<file>` — exactly like the deployed Worker's asset paths.
 */
function generatedAssets(): Plugin[] {
  return [
    {
      name: "srp:generated-assets-dev",
      apply: "serve",
      configureServer(server) {
        // Mounted before Vite's own middlewares: a 1 GB pool must never be
        // resolved through the static/SPA fallback chain.
        server.middlewares.use((req, res, next) => {
          let pathname: string;
          try {
            pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
          } catch {
            return next();
          }
          const segments = pathname.split("/").filter(Boolean);
          const isCounts = segments.length === 1 && segments[0] === "counts.json";
          const isSlot = segments.length === 2 && /^[0-9a-f]+\.(jpe?g|png|gif|webp|avif)$/.test(segments[1]);
          if (!isCounts && !isSlot) return next();

          const file = path.join(generatedDir, ...segments);
          if (!file.startsWith(generatedDir + path.sep)) return next();
          let stat: fs.Stats;
          try {
            stat = fs.statSync(file);
          } catch {
            return next();
          }
          if (!stat.isFile()) return next();

          res.setHeader("Content-Type", CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
          res.setHeader("Content-Length", String(stat.size));
          if (isCounts) res.setHeader("Cache-Control", "no-cache");
          if (req.method === "HEAD") return res.end();
          fs.createReadStream(file)
            .on("error", (error) => {
              if (!res.headersSent) res.statusCode = 500;
              res.end(String(error));
            })
            .pipe(res);
        });
      },
    },
    {
      name: "srp:generated-assets-build",
      apply: "build",
      closeBundle() {
        if (!fs.existsSync(generatedDir)) {
          throw new Error(
            `Missing ${path.relative(root, generatedDir)}/ — run \`npm run gen\` before \`npm run build\`.`,
          );
        }
        // Same order-of-magnitude as the image pool: serial copies keep the
        // build honest on Windows instead of fanning out 1000+ parallel reads.
        for (const entry of fs.readdirSync(generatedDir, { withFileTypes: true })) {
          const from = path.join(generatedDir, entry.name);
          if (entry.isDirectory()) {
            fs.cpSync(from, path.join(outDir, entry.name), { recursive: true });
          } else if (entry.name === "counts.json") {
            fs.copyFileSync(from, path.join(outDir, entry.name));
          }
        }
      },
    },
  ];
}

export default defineConfig({
  plugins: [react(), tailwindcss(), generatedAssets()],
  publicDir: staticDir,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Cloudflare Workers assets are uploaded from ./dist (see wrangler.jsonc).
    outDir: "dist",
    // Hashed bundle lives under /static, not /assets: category rewrite rules use
    // single-letter prefixes (`/a`), and `starts_with("/a")` would also swallow
    // /assets/… — which blanks the SPA. /static collides with nothing.
    assetsDir: "static",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
        settings: fileURLToPath(new URL("./settings.html", import.meta.url)),
      },
    },
  },
});
