/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ESLint is a devDependency and isn't installed in production-only installs
  // (e.g. Hostinger builds with NODE_ENV=production). Linting runs separately
  // via `npm run lint`, so it must never gate the production build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Local images live under /public/uploads.
    // Remote loaders (Cloudinary, S3, R2) can be added here when configured.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
    formats: ["image/avif", "image/webp"],
    // Keep resized images for a year instead of the default 60 seconds. Image files never change
    // in place (admin uploads get unique names), so re-processing them only slows pages down.
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
