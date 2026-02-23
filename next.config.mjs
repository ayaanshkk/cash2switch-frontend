/** @type {import('next').NextConfig} */
const nextConfig = {
  // ====================================================
  // SUBDIRECTORY DEPLOYMENT
  // ====================================================
  // basePath: '/streemlyne',
  // assetPrefix: '/streemlyne/',
  trailingSlash: false,
  
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
  // REWRITES: Backend Proxy + Auth Routes
  // ====================================================
  async rewrites() {
    return [
      // Backend API proxy - REMOVE trailing slashes before sending to backend
      {
        source: '/backend-api/:path*/',  // ← Matches with trailing slash
        destination: process.env.NEXT_PUBLIC_BACKEND_URL 
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*`  // ← Sends WITHOUT trailing slash
          : 'http://127.0.0.1:5000/:path*',
      },
      {
        source: '/backend-api/:path*',  // ← Matches without trailing slash
        destination: process.env.NEXT_PUBLIC_BACKEND_URL 
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*`
          : 'http://127.0.0.1:5000/:path*',
      },
      // Internal Next.js auth routes
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