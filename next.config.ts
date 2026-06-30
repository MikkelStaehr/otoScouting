import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We read scouting.db through Node's built-in node:sqlite (no native dep).
  // node: builtins are externalized automatically; nothing extra needed here.
};

export default nextConfig;
