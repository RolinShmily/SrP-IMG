/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
};
export default nextConfig
