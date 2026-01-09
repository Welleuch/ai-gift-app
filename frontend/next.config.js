/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',      // This tells Next.js to generate a static 'out' folder
  images: {
    unoptimized: true,   // Required for static export mode
  },
};

module.exports = nextConfig;