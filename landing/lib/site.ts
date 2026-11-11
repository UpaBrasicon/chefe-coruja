// Constantes globais do site — centralizadas para reuso em SEO e UI.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://chefecoruja.com.br'
export const SITE_NAME = 'Chefe Coruja'
export const SITE_TAGLINE = 'Gestão hospitalar para hospitais, UPAs e clínicas'

// Telefone e WhatsApp só aparecem quando o número real estiver configurado na
// Vercel (NEXT_PUBLIC_TELEFONE e NEXT_PUBLIC_WHATSAPP). Sem eles, o site não
// mostra número nenhum (pedido do RT em 09/11/2026: tirar os provisórios).
const telefone = process.env.NEXT_PUBLIC_TELEFONE?.trim() || null
const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP?.replace(/\D/g, '') || null

// Dados do negócio (Schema.org LocalBusiness / MedicalBusiness)
export const BUSINESS = {
  name: 'Chefe Coruja',
  description:
    'Plataforma web de gestão hospitalar: prontuário eletrônico, gestão de leitos, prescrição e escala médica, com conformidade CFM e LGPD.',
  telephone: telefone,
  email: 'contato@chefecoruja.com.br',
  address: {
    city: 'Aparecida de Goiânia',
    region: 'GO',
    country: 'BR',
  },
  openingHours: 'Mo-Fr 08:00-18:00',
  whatsapp,
}
