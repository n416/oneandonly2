import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// https://vite.dev/config/
export default defineConfig({
    plugins: [
        {
            name: 'global-logger',
            enforce: 'pre',
            configureServer: function (server) {
                server.middlewares.use(function (req, res, next) {
                    console.log("[Vite Req] ".concat(req.method, " ").concat(req.url));
                    next();
                });
            }
        },
        react()
    ],
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        proxy: {
            '/cloudflare-api': {
                target: 'https://api.cloudflare.com',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/cloudflare-api/, ''); }
            }
        },
        host: process.env.TAURI_DEV_HOST || false,
        hmr: process.env.TAURI_DEV_HOST
            ? {
                protocol: "ws",
                host: process.env.TAURI_DEV_HOST,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        }
    },
});
