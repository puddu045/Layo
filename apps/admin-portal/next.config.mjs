/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@layo/contracts', '@layo/config'],
};

export default nextConfig;
