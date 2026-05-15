import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(/* turbopackIgnore: true */ process.cwd(), "../.."),
  },
};

export default nextConfig;
