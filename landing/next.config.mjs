/** @type {import('next').NextConfig} */
// Cabeçalhos de segurança da landing (red-team V7): o vercel.json da raiz cobre
// o SPA, não a landing. CSP conservadora (só frame-ancestors/object-src/base-uri)
// para não quebrar a hidratação do Next nem o GA4; clickjacking via X-Frame-Options.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
]

const nextConfig = {
  reactStrictMode: true,
  // Pedido 8, J5 (decisão K3 do RT, 12/11/2026): a página inicial e as
  // funcionalidades repetem a página de entrada do app, que é a da marca.
  async redirects() {
    return [
      { source: '/', destination: 'https://www.chefecoruja.com.br/', permanent: false },
      { source: '/funcionalidades', destination: 'https://www.chefecoruja.com.br/#registro', permanent: false },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // { protocol: 'https', hostname: 'images.unsplash.com' }, // TODO: liberar hosts reais das imagens
    ],
  },
}

export default nextConfig
