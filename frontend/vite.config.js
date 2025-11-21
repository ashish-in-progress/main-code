import { defineConfig } from 'vite'
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/n8n': {
        target: 'https://local.codestore.co',   
        changeOrigin: true,
        secure: false,
        // Optionally, rewrite path if needed:
        // rewrite: (path) => path.replace(/^\/n8n/, '/n8n')
      }
    }
  }
})

