import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT_EXPORT === 'true';

const nextConfig: NextConfig = {
  output: isExport ? 'export' : undefined,
  images: { unoptimized: true },
  transpilePackages: ['@momoney/parsers', '@momoney/db', '@momoney/types', '@momoney/utils'],
  ...(isExport
    ? {}
    : {
        async rewrites() {
          const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
          return [
            { source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` },
            { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
            { source: '/health', destination: `${apiUrl}/health` },
          ]
        },
      }),
};

export default nextConfig;
