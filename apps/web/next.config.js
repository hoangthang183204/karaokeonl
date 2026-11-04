/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@karaoke/shared"],
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

module.exports = nextConfig;
