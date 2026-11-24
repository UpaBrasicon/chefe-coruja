// Agenda do administrador (pedido do RT, 24/11/2026): e-mail aos convidados da
// reunião. Regras puras (sem Deno), testadas em node: quem recebe o quê, o
// assunto, o texto e o HTML. Sem dado de paciente: título, dia e hora de
// Brasília, plataforma, link "Entrar", pauta curta e quem marcou.

export type Evento = 'convite' | 'alterada' | 'cancelada' | 'retirado'
export const EVENTOS: readonly Evento[] = ['convite', 'alterada', 'cancelada', 'retirado']

export type DadosReuniao = {
  titulo: string
  inicio: string
  fim: string
  link: string | null
  plataforma: string | null
  pauta: string | null
  cancelada: boolean
  criador_nome: string | null
}

export type Pendente = { id: number; perfil_id: string; evento: Evento; nome: string | null; email: string | null }

export type Envio = { perfil_id: string; evento: Evento; ids: number[]; email: string; nome: string | null }

/** Evento pedido pela tela: aceita o nome do banco e o do pedido (mudança, cancelamento, retirada). */
export function eventoPedido(valor: unknown): Evento | null | undefined {
  if (valor === undefined || valor === null || valor === '') return null
  const v = String(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const mapa: Record<string, Evento> = {
    convite: 'convite', alterada: 'alterada', mudanca: 'alterada', cancelada: 'cancelada',
    cancelamento: 'cancelada', retirado: 'retirado', retirada: 'retirado',
  }
  return mapa[v] // undefined = inválido
}

/**
 * Uma mensagem por pessoa, pelo estado final da fila dela:
 * - convite ainda não entregue + mudança: vai só o convite (com os dados de agora);
 * - convite ainda não entregue + retirada ou cancelamento: não vai nada (a pessoa nem soube);
 * - senão, vai o último evento.
 * Quem não tem e-mail fica em semEmail.
 */
export function escolherEnvios(pendentes: Pendente[]): {
  envios: Envio[]; semEmail: number[]; descartados: number[]; pessoasSemEmail: number
} {
  const porPessoa = new Map<string, Pendente[]>()
  for (const p of [...pendentes].sort((a, b) => a.id - b.id)) {
    const lista = porPessoa.get(p.perfil_id) ?? []
    lista.push(p)
    porPessoa.set(p.perfil_id, lista)
  }
  const envios: Envio[] = []
  const semEmail: number[] = []
  const descartados: number[] = []
  let pessoasSemEmail = 0
  for (const [perfil_id, lista] of porPessoa) {
    const ids = lista.map((p) => p.id)
    const ultimo = lista[lista.length - 1].evento
    const convitePendente = lista.some((p) => p.evento === 'convite')
    let evento: Evento | null = ultimo
    if (convitePendente && (ultimo === 'retirado' || ultimo === 'cancelada')) evento = null
    else if (convitePendente) evento = 'convite'
    if (!evento) { descartados.push(...ids); continue }
    const email = lista.find((p) => p.email)?.email ?? null
    if (!email) { semEmail.push(...ids); pessoasSemEmail++; continue }
    envios.push({ perfil_id, evento, ids, email, nome: lista[lista.length - 1].nome })
  }
  return { envios, semEmail, descartados, pessoasSemEmail }
}

const BR = 'America/Sao_Paulo'
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: BR, ...o })
const diaCurto = (iso: string) => fmt({ day: '2-digit', month: '2-digit' }).format(new Date(iso))
const horaDe = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const diaLongo = (iso: string) =>
  fmt({ weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))

/** "quarta-feira, 25/11/2026, das 09:00 às 10:00 (horário de Brasília)" */
export function quando(r: Pick<DadosReuniao, 'inicio' | 'fim'>): string {
  return `${diaLongo(r.inicio)}, das ${horaDe(r.inicio)} às ${horaDe(r.fim)} (horário de Brasília)`
}

export const LIMITE_PAUTA_EMAIL = 300

/** Pauta curta: espaços juntados e no máximo 300 letras. */
export function pautaCurta(pauta: string | null): string | null {
  const p = (pauta ?? '').replace(/\s+/g, ' ').trim()
  if (!p) return null
  return p.length <= LIMITE_PAUTA_EMAIL ? p : p.slice(0, LIMITE_PAUTA_EMAIL - 3).trimEnd() + '...'
}

export function assunto(evento: Evento, r: DadosReuniao): string {
  const dia = `${diaCurto(r.inicio)} às ${horaDe(r.inicio)}`
  switch (evento) {
    case 'convite': return `Convite para reunião: ${r.titulo}, ${dia}`
    case 'alterada': return `Reunião alterada: ${r.titulo}, agora ${dia}`
    case 'cancelada': return `Reunião cancelada: ${r.titulo}, ${dia}`
    case 'retirado': return `Você não está mais na reunião: ${r.titulo}`
  }
}

const ABERTURA: Record<Evento, string> = {
  convite: 'Você recebeu um convite para uma reunião.',
  alterada: 'A reunião mudou. Confira o horário e o link.',
  cancelada: 'A reunião foi cancelada.',
  retirado: 'Você não está mais na lista desta reunião.',
}

/** Linhas do e-mail (rótulo, valor, link opcional); o texto e o HTML saem daqui. */
function linhas(evento: Evento, r: DadosReuniao): { rotulo: string; valor: string; href?: string }[] {
  const ativa = evento === 'convite' || evento === 'alterada'
  const l: { rotulo: string; valor: string; href?: string }[] = [
    { rotulo: 'Reunião', valor: r.titulo },
    { rotulo: 'Quando', valor: quando(r) },
  ]
  if (ativa) {
    l.push({ rotulo: 'Onde', valor: r.link ? (r.plataforma ?? 'Link') : 'Presencial ou a combinar' })
    if (r.link) l.push({ rotulo: 'Entrar', valor: r.link, href: r.link })
    const pauta = pautaCurta(r.pauta)
    if (pauta) l.push({ rotulo: 'Pauta', valor: pauta })
  }
  l.push({ rotulo: 'Marcada por', valor: r.criador_nome?.trim() || 'a administração' })
  return l
}

const primeiroNome = (nome: string | null) => (nome ?? '').trim().split(/\s+/)[0] ?? ''

export function texto(evento: Evento, r: DadosReuniao, nome: string | null, origem: string): string {
  const ola = primeiroNome(nome)
  return [
    ola ? `Olá, ${ola}.` : 'Olá.',
    '',
    ABERTURA[evento],
    '',
    ...linhas(evento, r).map((x) => `${x.rotulo}: ${x.valor}`),
    '',
    `O aviso também está no Chefe Coruja: ${origem}/notificacoes`,
    '',
    'Este e-mail foi enviado automaticamente; não responda. Não traz dado de paciente.',
  ].join('\n')
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function html(evento: Evento, r: DadosReuniao, nome: string | null, origem: string): string {
  const ola = primeiroNome(nome)
  const celula = 'padding:4px 12px 4px 0;vertical-align:top'
  const corpo = linhas(evento, r).map((x) => {
    const valor = x.href
      ? `<a href="${esc(x.href)}" style="display:inline-block;padding:6px 14px;background:#1f5f8b;color:#ffffff;border-radius:6px;text-decoration:none">Entrar</a>`
      : esc(x.valor)
    return `<tr><td style="${celula};color:#555">${esc(x.rotulo)}</td><td style="${celula}">${valor}</td></tr>`
  }).join('')
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1d">',
    `<p>${esc(ola ? `Olá, ${ola}.` : 'Olá.')}</p>`,
    `<p>${esc(ABERTURA[evento])}</p>`,
    `<table role="presentation" style="border-collapse:collapse">${corpo}</table>`,
    `<p>O aviso também está no <a href="${esc(origem)}/notificacoes">Chefe Coruja</a>.</p>`,
    '<p style="font-size:12px;color:#777">Este e-mail foi enviado automaticamente; não responda. Não traz dado de paciente.</p>',
    '</div>',
  ].join('')
}

const REMETENTE_OK = /^([^<>]+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/
export const REMETENTE_PADRAO = 'Chefe Coruja <nao-responda@chefecoruja.com.br>'

/**
 * Remetente: EMAIL_FROM quando existe e tem formato de e-mail; senão o padrão
 * (o mesmo do 2FA, da tecnovigilância e do pedido de demonstração).
 */
export function remetente(emailFrom: string | undefined): { de: string; motivo: 'configurado' | 'ausente' | 'malformado' } {
  const v = (emailFrom ?? '').trim()
  if (!v) return { de: REMETENTE_PADRAO, motivo: 'ausente' }
  return REMETENTE_OK.test(v) ? { de: v, motivo: 'configurado' } : { de: REMETENTE_PADRAO, motivo: 'malformado' }
}

/** JSON só com ASCII (acentos chegam certos na Resend; ver enviar-codigo-2fa). */
export function jsonAscii(valor: unknown): string {
  return JSON.stringify(valor).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}
