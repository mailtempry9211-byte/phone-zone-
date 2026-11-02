import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      ignored: [
        "**/*.md",
        "**/*.log",
        "**/*.db*",
        "**/backend/**",
        "**/database/**",
        "**/.git/**",
        "**/_backup*/**",
        "**/dist/**",
        "**/dist-electron/**",
      ],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:47713",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    cssMinify: true,
    chunkSizeWarningLimit: 2000,
  },
  define: {
    "import.meta.env.VITE_PHONEZONE_OFFLINE": JSON.stringify("true"),
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
