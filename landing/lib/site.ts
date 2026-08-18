// Constantes globais do site — centralizadas para reuso em SEO e UI.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://chefecoruja.com.br'
export const SITE_NAME = 'Chefe Coruja'
export const SITE_TAGLINE = 'Gestão hospitalar para hospitais, UPAs e clínicas'

// Dados do negócio (Schema.org LocalBusiness / MedicalBusiness)
export const BUSINESS = {
  name: 'Chefe Coruja',
  description:
    'Plataforma web de gestão hospitalar: prontuário eletrônico, gestão de leitos, prescrição e escala médica, com conformidade CFM e LGPD.',
  telephone: '+55 62 99999-9999', // TODO: telefone real do negócio
  email: 'contato@chefecoruja.com.br', // TODO: e-mail real
  address: {
    street: 'Av. Rio Verde, 1234', // TODO: endereço real
    city: 'Aparecida de Goiânia',
    region: 'GO',
    postalCode: '74900-000', // TODO: CEP real
    country: 'BR',
  },
  geo: {
    lat: -16.8233,
    lng: -49.2467,
  },
  openingHours: 'Mo-Fr 08:00-18:00',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || '5562999999999',
}

export const TEMPO_RESPOSTA = 'Respondemos em até 4 horas úteis'
