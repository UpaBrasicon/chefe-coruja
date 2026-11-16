// Regras puras do formulário "Agendar demonstração" (pedido 8, J3), sem Deno e
// sem rede, para rodar no teste do Node (regras.test.ts).

import { ipConfiavel } from '../_shared/borda.ts'

export type Pedido = { nome: string; email: string; telefone: string; unidade: string; mensagem: string }

export type Leitura =
  | { tipo: 'isca' }
  | { tipo: 'invalido'; campo: 'nome' | 'email' | 'telefone' }
  | { tipo: 'ok'; pedido: Pedido; token: string }

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

/**
 * Origens aceitas só por esta função, além do APP_ORIGIN: o formulário de
 * contato do site público (landing/components/ContactForm.tsx), que deixou a
 * rota própria /api/contato e passou a usar esta função (S10, H3).
 */
export const ORIGENS_DO_FORMULARIO = ['https://planos.chefecoruja.com.br']

/** Site de onde veio o pedido, para o e-mail: planos quando a origem é a dele; senão, o app. */
export function siteDoPedido(origem: string | null): string {
  const o = origem ?? ''
  return ORIGENS_DO_FORMULARIO.includes(o) ? new URL(o).host : 'www.chefecoruja.com.br'
}

/**
 * Lê o corpo do pedido: nome com 2 letras ou mais, e-mail válido e telefone com
 * 10 dígitos ou mais (as mesmas regras do app e do formulário de planos). O
 * campo-isca (`website`) preenchido indica robô: a função responde "ok" e nada
 * é enviado.
 */
export function lerPedido(corpo: unknown): Leitura {
  const b = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>
  if (texto(b.website, 200)) return { tipo: 'isca' }
  const pedido: Pedido = {
    nome: texto(b.nome, 120),
    email: texto(b.email, 200),
    telefone: texto(b.telefone, 30),
    unidade: texto(b.unidade, 200),
    mensagem: texto(b.mensagem, 4000),
  }
  if (pedido.nome.length < 2) return { tipo: 'invalido', campo: 'nome' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pedido.email)) return { tipo: 'invalido', campo: 'email' }
  if (pedido.telefone.replace(/\D/g, '').length < 10) return { tipo: 'invalido', campo: 'telefone' }
  return { tipo: 'ok', pedido, token: texto(b.token, 2048) }
}

/** Corpo do e-mail em texto puro: nada do que a pessoa digita vira HTML. */
export function corpoEmail(p: Pedido, site = 'www.chefecoruja.com.br'): string {
  return [
    `Pedido de demonstração pelo site do Chefe Coruja (${site}).`,
    '',
    `Nome: ${p.nome}`,
    `E-mail: ${p.email}`,
    `Telefone: ${p.telefone}`,
    `Unidade e cargo: ${p.unidade || '(não informado)'}`,
    '',
    'Mensagem:',
    p.mensagem || '(sem mensagem)',
  ].join('\n')
}

/**
 * JSON só com ASCII: cada caractere fora do ASCII vai como \uXXXX (correção dos
 * acentos de 09/11/2026, a mesma do enviar-codigo-2fa).
 */
export function jsonAscii(valor: unknown): string {
  return JSON.stringify(valor).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}

/**
 * Endereço de rede de quem pediu: o cf-connecting-ip ou o ÚLTIMO item do
 * x-forwarded-for. O primeiro item é de quem chamou e pode ser inventado para
 * furar o limite por endereço (S6, B1).
 */
export function enderecoDaRede(cabecalhos: Headers): string {
  return ipConfiavel((n) => cabecalhos.get(n)) || 'desconhecido'
}

/** Resumo do endereço com um sal secreto: a tabela de contagem nunca guarda o endereço. */
export async function resumoDoEndereco(endereco: string, sal: string): Promise<string> {
  const dados = new TextEncoder().encode(`${sal}|${endereco}`)
  const hash = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
