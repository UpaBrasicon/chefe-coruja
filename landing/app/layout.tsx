import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'

import './globals.css'
import { SITE_NAME, SITE_URL, SITE_TAGLINE, BUSINESS } from '@/lib/site'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { StickyCta } from '@/components/StickyCta'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Prontuário eletrônico, gestão de leitos, prescrição e escala médica em uma única plataforma, com conformidade CFM e LGPD. Feito por médico coordenador de UPA.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      'Prontuário eletrônico, gestão de leitos, prescrição e escala médica com conformidade CFM e LGPD.',
    images: [{ url: '/og-home.svg', width: 1200, height: 630, alt: `${SITE_NAME} — gestão hospitalar` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: 'Gestão hospitalar com conformidade CFM e LGPD.',
    images: ['/og-home.svg'],
  },
}

// Schema.org LocalBusiness / MedicalBusiness (JSON-LD) — home
const businessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  name: BUSINESS.name,
  description: BUSINESS.description,
  url: SITE_URL,
  telephone: BUSINESS.telephone,
  email: BUSINESS.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address.street,
    addressLocality: BUSINESS.address.city,
    addressRegion: BUSINESS.address.region,
    postalCode: BUSINESS.address.postalCode,
    addressCountry: BUSINESS.address.country,
  },
  geo: { '@type': 'GeoCoordinates', latitude: BUSINESS.geo.lat, longitude: BUSINESS.geo.lng },
  openingHours: BUSINESS.openingHours,
  priceRange: '$$',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans">
        <Header />
        <main>{children}</main>
        <Footer />
        <StickyCta />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
        />
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  )
}
