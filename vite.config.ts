import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // Build optimization
  build: {
    minify: "esbuild",
    target: "esnext",
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Optimized manual chunks for better code splitting
        manualChunks: {
          // React core - loaded immediately
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // MUI core components - loaded on demand
          "mui-core": ["@mui/material", "@emotion/react", "@emotion/styled"],
          // MUI icons - separate chunk since it's large
          "mui-icons": ["@mui/icons-material"],
          // MUI data grid - heavy component
          "mui-datagrid": ["@mui/x-data-grid"],
          // CodeMirror editor - only for JSON/code editing tools
          "codemirror": [
            "@uiw/react-codemirror",
            "@uiw/codemirror-theme-vscode",
            "@codemirror/lang-json",
          ],
          // Charts - only for visualization tools
          "charts": ["recharts"],
          // Animation library
          "animation": ["framer-motion"],
          // i18n
          "i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          // QR code tools
          "qrcode": ["qrcode", "jsqr"],
          // Markdown
          "markdown": ["react-markdown"],
        },
      },
    },
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
  // 2. use dynamic port, automatically find available port if occupied
  server: {
    port: 1420,
    strictPort: false,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
