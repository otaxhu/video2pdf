import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  base: "/video2pdf",
});
