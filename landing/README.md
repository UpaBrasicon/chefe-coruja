# Chefe Coruja — Landing Page

Landing page pública de marketing do SaaS **Chefe Coruja** (gestão hospitalar para hospitais, UPAs e clínicas).
Construída com **Next.js 14 (App Router)** + **Tailwind CSS**, deploy na **Vercel**.

## Estrutura

```
landing/
├── app/
│   ├── layout.tsx          # Layout raiz: metadata global, GA4, JSON-LD LocalBusiness
│   ├── page.tsx            # Home (hero, confiança, case, depoimentos, equipe, FAQ, localização)
│   ├── globals.css
│   ├── not-found.tsx       # Página 404 personalizada
│   ├── robots.ts           # robots.txt (permite indexação + aponta sitemap)
│   ├── sitemap.ts          # sitemap.xml
│   ├── api/contato/route.ts# API de contato (modo demo)
│   ├── funcionalidades/    # /funcionalidades
│   ├── precos/             # /precos (evento view_pricing)
│   ├── contato/            # /contato (formulário + honeypot)
│   ├── privacidade/        # /privacidade (LGPD)
│   └── obrigado/           # /obrigado (conversão)
├── components/             # Header, Footer, StickyCta, Breadcrumbs, CtaButton, Hero,
│                           # CaseStudy, Testimonials, Team, FAQ, Location, ContactForm
├── lib/
│   ├── site.ts             # Constantes do negócio (endereço, telefone, geo)
│   └── analytics.ts        # Camada GA4 (track, trackWhatsapp, trackDemo, trackViewPricing)
└── .env.local.example      # Variáveis de ambiente
```

## Configuração

1. **Instalar dependências**
   ```bash
   cd landing
   npm install
   ```

2. **Variáveis de ambiente** — copie `.env.local.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SITE_URL` — domínio de produção (ex.: `https://chefecoruja.com.br`).
   - `NEXT_PUBLIC_GA_ID` — **Measurement ID do GA4** (ex.: `G-XXXXXXX`). Sem ele, o GA4 não carrega e os eventos são no-ops.
   - `NEXT_PUBLIC_MAPS_KEY` — **Google Maps Embed API key** (sem restrição, ou restringida por domínio). Sem ela, o mapa usa fallback sem key.
   - `NEXT_PUBLIC_WHATSAPP` — número comercial com DDI+DDD (ex.: `5562999999999`).
   - `NEXT_PUBLIC_FORM_ENDPOINT` — endpoint do formulário (Formspree/Resend). Vazio = usa a API local `/api/contato` (modo demo).

3. **Rodar local**
   ```bash
   npm run dev
   ```

4. **Build/Deploy (Vercel)**
   - Importe o diretório `landing` como projeto na Vercel.
   - Defina as variáveis acima no painel da Vercel (Production + Preview).
   - Build: `npm run build` · Output: Next.js padrão.

## Checklist implementado (20 itens)

| # | Item | Onde |
|---|---|---|
| 1 | Hero acima da dobra + CTA primário | `components/Hero.tsx` |
| 2 | Sticky bottom bar (mobile): WhatsApp + Agendar demo | `components/StickyCta.tsx` |
| 3 | Página /obrigado + evento de conversão | `app/obrigado/page.tsx` |
| 4 | Promessa de resposta (4h úteis) no formulário | `components/ContactForm.tsx` |
| 5 | UTM + data-attributes em CTAs | `components/CtaButton.tsx`, `Header.tsx` |
| 6 | Case de sucesso (problema→solução→métrica) | `components/CaseStudy.tsx` |
| 7 | Depoimentos (3 cards) | `components/Testimonials.tsx` |
| 8 | Quem somos (foto da equipe) | `components/Team.tsx` |
| 9 | FAQ 5 perguntas + Schema.org FAQPage | `components/FAQ.tsx` |
| 10 | /privacidade LGPD (art. 7º e 11º) | `app/privacidade/page.tsx` |
| 11 | robots.txt + sitemap.xml | `app/robots.ts`, `app/sitemap.ts` |
| 12 | Title único por página (metadata) | cada página via `export const metadata` |
| 13 | Meta description única (≤155 chars) | idem |
| 14 | Breadcrumbs + Schema BreadcrumbList | `components/Breadcrumbs.tsx` |
| 15 | Alt text descritivo nas imagens | `Hero.tsx`, `Team.tsx` |
| 16 | Open Graph + Twitter Cards (og:image 1200x630) | `app/layout.tsx` + páginas |
| 17 | JSON-LD LocalBusiness/MedicalBusiness | `app/layout.tsx` |
| 18 | Página 404 personalizada | `app/not-found.tsx` |
| 19 | Localização + Google Maps embed + "Como chegar" | `components/Location.tsx` |
| 20 | GA4 via @next/third-parties + eventos | `app/layout.tsx`, `lib/analytics.ts` |

## TODOs de conteúdo (marcados no código como `TODO`)

- **Logotipo** — substituir emoji 🦉 por SVG/png real (32x32). (`Header.tsx`, `Footer.tsx`)
- **Imagem do produto** no hero (`/hero-placeholder.png`) — recomendado 1200x800 webp. (`Hero.tsx`)
- **Foto da equipe** (`/equipe-placeholder.png`) — recomendado 1500x1000 webp + texto real + CRM do fundador. (`Team.tsx`)
- **Case de sucesso** — nome real da unidade e métrica real (ex.: -35% permanência). (`CaseStudy.tsx`)
- **Depoimentos** — 3 depoimentos reais com nome/cargo/unidade + autorização. (`Testimonials.tsx`)
- **Preços** — definir tabela real (mensal/anual, por unidade ou leito). (`app/precos/page.tsx`)
- **Empresa** — endereço, telefone, e-mail, CEP reais. (`lib/site.ts`)
- **Formulário** — integrar serviço de e-mail/CRM e persistência. (`app/api/contato/route.ts`)
- **Privacidade** — revisão jurídica, nome do DPO/Encarregado e prazo de retenção final. (`app/privacidade/page.tsx`)
- **GA4** — confirmar IDs e funis de conversão. (`lib/analytics.ts`)
- **OG images** — gerar 1200x630 por página (`/og-*.png`).

## Observações

- Lighthouse ≥ 90 em Performance/SEO/Accessibility é o alvo; imagens com `next/image` e lazy loading.
- Sem dependências de UI pesadas — Tailwind puro.
- O formulário usa honeypot anti-spam + validação client-side.
