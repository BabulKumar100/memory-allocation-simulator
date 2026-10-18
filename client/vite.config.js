import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Server ka shared module client/ ke bahar hai, isliye alias + fs access dono chahiye.
const sharedDir = fileURLToPath(new URL("../server/shared", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": sharedDir } },
  server: { port: 5173, fs: { allow: [".", ".."] } }
});
