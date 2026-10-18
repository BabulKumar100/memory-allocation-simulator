import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const sharedDir = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": sharedDir } },
  // shared/ client/ ke bahar hai, isliye dev server ko uska access dena padta hai.
  server: { port: 5173, fs: { allow: [".", ".."] } }
});
