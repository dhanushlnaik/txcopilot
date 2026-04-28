import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry
  {
    entry: { index: "src/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    external: ["@solana/web3.js", "react", "react-dom", "server-only"],
    treeshake: true,
    splitting: false,
    esbuildOptions(options) {
      // Mark Node.js built-ins external
      options.platform = "node";
    },
  },
  // React subpath — browser-safe, no Node built-ins
  {
    entry: { "react/index": "src/react/index.ts" },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist",
    external: ["@solana/web3.js", "react", "react-dom", "soltrac-sdk"],
    treeshake: true,
    splitting: false,
    esbuildOptions(options) {
      options.platform = "browser";
    },
  },
]);
