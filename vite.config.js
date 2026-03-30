import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(String(packageJson.version || "0.0.0")),
  },
  server: {
    proxy: {
      "/search": "http://localhost:3000",
      "/getdramacards": "http://localhost:3000",
      "/getdramas": "http://localhost:3000",
      "/getsoundsummary": "http://localhost:3000",
      "/getrewardsummary": "http://localhost:3000",
      "/getrewardmeta": "http://localhost:3000",
      "/getsounddanmaku": "http://localhost:3000",
      "/getdanmaku": "http://localhost:3000",
      "/image-proxy": "http://localhost:3000",
      "/app-config": "http://localhost:3000",
      "/manbo/getdramas": "http://localhost:3000",
      "/manbo/getsetdanmaku": "http://localhost:3000",
      "/manbo/getsetsummary": "http://localhost:3000",
      "/manbo/stat-tasks": "http://localhost:3000",
    },
  },
});
