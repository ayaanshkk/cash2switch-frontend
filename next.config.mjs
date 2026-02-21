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
  // REWRITES
  // ====================================================
  async rewrites() {
    const backendUrl = process.env.LOCAL_BACKEND_URL || 'http://127.0.0.1:5000';
    return [
      {
        source: '/auth/:path*',
        destination: '/api/auth/:path*',
      },
      // Proxy API to backend (avoids CORS / "Failed to fetch" in dev)
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/:path*`,
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