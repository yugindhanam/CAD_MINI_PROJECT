import { defineConfig, loadEnv } from "vite";
import { readConfig } from "./src/config.ts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (mode === "aws" && env.VITE_MODE !== "aws")
    throw Error(
      "Cloud builds require VITE_MODE=aws. Run the cloud configuration script first.",
    );
  readConfig(env);
  return { plugins: [react(), tailwindcss()] };
});
