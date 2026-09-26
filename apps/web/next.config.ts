import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT_EXPORT === 'true';

const nextConfig: NextConfig = {
  output: isExport ? 'export' : undefined,
  images: { unoptimized: true },
  transpilePackages: ['@momoney/parsers', '@momoney/db', '@momoney/types', '@momoney/utils'],
};

export default nextConfig;
