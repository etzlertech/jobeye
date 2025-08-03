/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  
  // Control Tower route group configuration
  experimental: {
    // Ensure route groups work properly
    appDir: true,
  },
  
  // Environment variable validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'JobEye Control Tower',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '3.2.1',
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  
  // Redirect root to control tower if developer
  async redirects() {
    return [
      {
        source: '/control-tower',
        destination: '/(control-tower)',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;