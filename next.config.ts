import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [
      70, 96, 160, 200, 280, 400, 680, 750, 828, 1080, 1200, 1920, 2048, 3840,
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
