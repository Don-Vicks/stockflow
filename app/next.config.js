/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@stockflow/sdk", "@stockflow/common"],
};
module.exports = nextConfig;
