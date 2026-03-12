import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@momoney/parsers', '@momoney/db', '@momoney/types', '@momoney/utils'],
};

export default nextConfig;
