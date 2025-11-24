import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    experimental: {
      websocket: true,
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.svg",
          "favicon-32x32.png",
          "favicon-16x16.png",
          "apple-touch-icon.png",
          "zault.wasm",
        ],
        manifest: {
          name: "Zault Chat",
          short_name: "Zault",
          description: "Post-quantum encrypted P2P messaging",
          start_url: "/",
          scope: "/",
          theme_color: "#1a1a2e",
          background_color: "#0f0f1a",
          display: "standalone",
          orientation: "portrait-primary",
          categories: ["social", "communication", "security"],
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          shortcuts: [
            {
              name: "New Chat",
              short_name: "Chat",
              url: "/add",
              icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
            },
          ],
        },
        workbox: {
          // Offline-first: cache everything aggressively
          globPatterns: ["**/*.{js,css,html,wasm,ico,png,svg,woff,woff2}"],
          
          // Navigation fallback for SPA
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/_ws/, /^\/api/],
          
          runtimeCaching: [
            // WASM - cache forever
            {
              urlPattern: /\.wasm$/,
              handler: "CacheFirst",
              options: {
                cacheName: "wasm-cache",
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            // Static assets - cache first
            {
              urlPattern: /\.(png|jpg|jpeg|svg|gif|ico|webp)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "image-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            // JS/CSS - stale while revalidate
            {
              urlPattern: /\.(js|css)$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
              },
            },
          ],
        },
        // Dev options
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ],
  },
}).addRouter({
  name: "ws",
  type: "http",
  handler: "./src/ws.ts",
  target: "server",
  base: "/_ws",
});
