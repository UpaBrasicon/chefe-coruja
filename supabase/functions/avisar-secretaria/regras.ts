// Perfil Gestor da secretaria (pedido do RT, 24/11/2026): quem o administrador
// designa para a secretaria recebe um e-mail. Regras puras (sem Deno),
// testadas em node: o assunto, o texto, o HTML e o remetente. Sem dado de
// paciente: a secretaria, a organização, as unidades e quem designou.

export type DadosAviso = {
  email: string
  nome: string | null
  pendente: boolean
  secretaria: string
  organizacao: string | null
  designado_por: string | null
  unidades: string[]
}

export const LIMITE_UNIDADES_EMAIL = 20

export function assunto(d: DadosAviso): string {
  return `Você cuida da ${d.secretaria} no Chefe Coruja`
}

const primeiroNome = (nome: string | null) => (nome ?? '').trim().split(/\s+/)[0] ?? ''

/** As unidades em uma linha; passou de 20, diz quantas faltam. */
export function listaUnidades(unidades: string[]): string {
  if (unidades.length === 0) return 'nenhuma unidade ligada ainda'
  const mostradas = unidades.slice(0, LIMITE_UNIDADES_EMAIL)
  const resto = unidades.length - mostradas.length
  return mostradas.join(', ') + (resto > 0 ? ` e mais ${resto}` : '')
}

/** O que a pessoa faz agora: com conta, só entrar; sem conta, criar com este e-mail. */
export function proximoPasso(d: DadosAviso, origem: string): { texto: string; botao: string; href: string } {
  if (d.pendente) {
    return {
      texto: `Crie sua conta no Chefe Coruja com este e-mail (${d.email}) e confirme o endereço. A secretaria aparece no seu menu quando você entrar.`,
      botao: 'Criar conta',
      href: `${origem}/cadastro`,
    }
  }
  return {
    texto: 'Entre no Chefe Coruja: a secretaria já aparece no seu menu, com a rede, as unidades, a escala e os indicadores.',
    botao: 'Entrar',
    href: `${origem}/secretaria`,
  }
}

function linhas(d: DadosAviso): { rotulo: string; valor: string }[] {
  const l = [{ rotulo: 'Secretaria', valor: d.secretaria }]
  if (d.organizacao) l.push({ rotulo: 'Organização', valor: d.organizacao })
  l.push({ rotulo: 'Unidades', valor: listaUnidades(d.unidades) })
  l.push({ rotulo: 'Quem escolheu', valor: d.designado_por?.trim() || 'a administração da rede' })
  return l
}

const ABERTURA = 'A administração da rede escolheu você para cuidar de uma secretaria no Chefe Coruja, com o perfil Gestor da secretaria: dados das unidades, setores e leitos, escala, pessoas e indicadores. Nada de dado de paciente.'

export function texto(d: DadosAviso, origem: string): string {
  const ola = primeiroNome(d.nome)
  const passo = proximoPasso(d, origem)
  return [
    ola ? `Olá, ${ola}.` : 'Olá.',
    '',
    ABERTURA,
    '',
    ...linhas(d).map((x) => `${x.rotulo}: ${x.valor}`),
    '',
    passo.texto,
    `${passo.botao}: ${passo.href}`,
    '',
    'Se você não esperava este e-mail, avise a administração da rede.',
    'Este e-mail foi enviado automaticamente; não responda. Não traz dado de paciente.',
  ].join('\n')
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function html(d: DadosAviso, origem: string): string {
  const ola = primeiroNome(d.nome)
  const passo = proximoPasso(d, origem)
  const celula = 'padding:4px 12px 4px 0;vertical-align:top'
  const corpo = linhas(d)
    .map((x) => `<tr><td style="${celula};color:#555">${esc(x.rotulo)}</td><td style="${celula}">${esc(x.valor)}</td></tr>`)
    .join('')
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1d">',
    `<p>${esc(ola ? `Olá, ${ola}.` : 'Olá.')}</p>`,
    `<p>${esc(ABERTURA)}</p>`,
    `<table role="presentation" style="border-collapse:collapse">${corpo}</table>`,
    `<p>${esc(passo.texto)}</p>`,
    `<p><a href="${esc(passo.href)}" style="display:inline-block;padding:6px 14px;background:#1f5f8b;color:#ffffff;border-radius:6px;text-decoration:none">${esc(passo.botao)}</a></p>`,
    '<p style="font-size:12px;color:#777">Se você não esperava este e-mail, avise a administração da rede. Este e-mail foi enviado automaticamente; não responda. Não traz dado de paciente.</p>',
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
