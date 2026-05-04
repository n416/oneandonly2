import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { Buffer } from "node:buffer";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'global-logger',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          console.log(`[Vite Req] ${req.method} ${req.url}`);
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
