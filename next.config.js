/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // Temporarily disabled for Railway debugging
  poweredByHeader: false,
  compress: true,
  
  // Disable type checking during build (temporary workaround)
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  // Disable ESLint during build (warnings should not fail production builds)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Environment variable validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'JobEye Control Tower',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '3.2.1',
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle ESM modules
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    
    // Exclude ONNX runtime node module from client bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }
    
    return config;
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
  
  // Redirects configuration
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;