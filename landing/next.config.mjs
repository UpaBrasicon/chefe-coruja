/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // { protocol: 'https', hostname: 'images.unsplash.com' }, // TODO: liberar hosts reais das imagens
    ],
  },
}

export default nextConfig
