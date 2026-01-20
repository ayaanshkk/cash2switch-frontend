/** @type {import('next').NextConfig} */
const nextConfig = {
  // ====================================================
  // SUBDIRECTORY DEPLOYMENT
  // ====================================================
  // basePath: '/streemlyne',
  // assetPrefix: '/streemlyne/',
  trailingSlash: true,
  
  // ====================================================
  // ESLINT & COMPILER
  // ====================================================
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // ====================================================
  // REDIRECTS
  // ====================================================
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login/',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/dashboard/default/',
        permanent: false,
      },
    ];
  },
  
  // ====================================================
  // REWRITES: /auth/* → /api/auth/*
  // ====================================================
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ];
  },
  
  // ====================================================
  // IMAGE OPTIMIZATION
  // ====================================================
  images: {
    domains: ['techmynt.com'],
    unoptimized: true,
  },
  
  // ====================================================
  // OPTIONAL: Fixes double-slash issues
  // ====================================================
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;