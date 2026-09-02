import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [60, 65, 70, 75],
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
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.gamepix.com',
        port: '',
        pathname: '/**',
      },
      // Seidou Social: Mux serves video thumbnails and animated previews
      // straight from the playback id, so they are referenced by URL rather
      // than copied into our own storage.
      {
        protocol: 'https',
        hostname: 'image.mux.com',
        port: '',
        pathname: '/**',
      },
      // Seidou Social: custom thumbnails and channel banners in Supabase
      // Storage. Rendered with unoptimized, but listed so any future
      // optimized usage does not fail.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
