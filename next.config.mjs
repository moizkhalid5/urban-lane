/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ESLint is a devDependency and isn't installed in production-only installs
  // (e.g. Hostinger builds with NODE_ENV=production). Linting runs separately
  // via `npm run lint`, so it must never gate the production build.
  eslint: { ignoreDuringBuilds: true },
  // Hostinger's shared servers cap how many threads an account may run, and the live site keeps
  // running during a build. By default `next build` starts one helper process per CPU of the (large)
  // server plus a separate compile worker, and every Node process starts one V8 thread per CPU. On
  // 22 Oct 2026 that hit the cap: "Assertion failed: uv_thread_create" / "build worker exited ...
  // SIGABRT". Build in a single process with one page-generation worker instead (see the end of this
  // file for the per-process thread limits). Only affects how the site is built, not how it runs.
  experimental: {
    webpackBuildWorker: false,
    cpus: 1,
    workerThreads: false,
  },
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
      {
        // Homepage brand film. Cached for a week; give a replacement video a new file name.
        source: "/videos/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

// `next build` only (`next start` is unaffected): fewer threads in every process the build starts
// (they inherit these): 2 V8 helper threads instead of one per CPU, and a 2-thread libuv pool.
// Detected from the command line because Next.js loads this file before it sets NEXT_PHASE.
// The config must stay a plain exported object: Hostinger's deploy reads it to find the build output,
// and a function export made it report "Next.js build produced no standalone server or static output".
if (process.argv.includes("build")) {
  const nodeOptions = process.env.NODE_OPTIONS ?? "";
  if (!nodeOptions.includes("--v8-pool-size")) process.env.NODE_OPTIONS = `${nodeOptions} --v8-pool-size=2`.trim();
  process.env.UV_THREADPOOL_SIZE ??= "2";
}

export default nextConfig;
