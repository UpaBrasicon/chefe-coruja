// Pulseira de identificação (lacuna 2 do Portão de 11/10/2026; decisão do RT
// em 10/11/2026, A em P1–P8). Fonte: Protocolo de Identificação do Paciente
// (Anexo 02 da Portaria MS/GM nº 2.095/2013).
//
// Os dados vêm do servidor (registrar_impressao_pulseira), já sem o leito e
// sem a data estimada. Aqui só se arrumam as linhas da etiqueta, na mesma
// ordem em toda a unidade:
//  - comum (P1): nome completo; nome social numa linha abaixo; nascimento e
//    prontuário; nome da mãe;
//  - não identificado (P2): nome provisório; prontuário e idade estimada;
//    sexo aparente e raça/cor; sinais resumidos;
//  - recém-nascido (P3): "RN N de <mãe>"; prontuário; nascimento e sexo.
// Sem código de barras (P4), sem alergia ou risco (P5).

import { RACAS_COR } from '../lib/cadastro.ts'

export type DadosPulseira = {
  nome: string
  nome_social: string | null
  /** só a data real; a estimada não vem */
  data_nascimento: string | null
  /** idade em meses completos, quando o nascimento é estimado */
  idade_estimada_meses: number | null
  prontuario: string | null
  nome_mae: string | null
  sexo: string | null
  raca_cor: string | null
  identidade_desconhecida: boolean
  sinais_identificacao: string | null
  /** até 27 dias de vida e ligado à mãe */
  rn: boolean
  rn_ordem: number | null
}

export type LinhaPulseira = { texto: string; destaque?: boolean }
export type FormatoPulseira = 'comum' | 'rn'
export type Pulseira = { formato: FormatoPulseira; linhas: LinhaPulseira[] }

/** Sinais do não identificado: cabem em cerca de duas linhas da etiqueta. */
export const SINAIS_PULSEIRA_MAX = 80

const limpo = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** 'AAAA-MM-DD' (ou o começo de um instante) em DD/MM/AAAA; inválido = ''. */
export function dataPulseira(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  const [, a, mes, d] = m
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return ''
  return `${d}/${mes}/${a}`
}

/** "Idade estimada: 40 anos" (1 ano, 6 meses, menos de 1 mês); sem número = ''. */
export function idadeEstimadaTexto(meses: number | null | undefined): string {
  if (meses == null || !Number.isFinite(meses) || meses < 0) return ''
  const m = Math.floor(meses)
  if (m >= 24) return `Idade estimada: ${Math.floor(m / 12)} anos`
  if (m >= 12) return 'Idade estimada: 1 ano'
  if (m >= 2) return `Idade estimada: ${m} meses`
  if (m === 1) return 'Idade estimada: 1 mês'
  return 'Idade estimada: menos de 1 mês'
}

/** Corta no fim de uma palavra e marca com reticências quando não cabe. */
export function resumirSinais(sinais: string | null | undefined, max = SINAIS_PULSEIRA_MAX): string {
  const s = limpo(sinais)
  if (s.length <= max) return s
  const corte = s.slice(0, max - 1)
  const espaco = corte.lastIndexOf(' ')
  const base = (espaco > max / 2 ? corte.slice(0, espaco) : corte).replace(/[\s,;.:-]+$/, '')
  return `${base}…`
}

/** "RN de Maria da Silva" ou, com gêmeos, "RN 2 de Maria da Silva". */
export function cabecalhoRn(mae: string | null | undefined, ordem: number | null | undefined): string {
  const nome = limpo(mae)
  return `RN ${ordem ? `${ordem} ` : ''}de ${nome || 'mãe sem nome no cadastro'}`
}

const sexoTexto = (s: string | null | undefined) => (s === 'F' ? 'feminino' : s === 'M' ? 'masculino' : '')

const racaTexto = (r: string | null | undefined) => {
  if (!r || r === 'sem_informacao') return ''
  return RACAS_COR.find((x) => x.valor === r)?.rotulo.toLowerCase() ?? ''
}

const juntar = (...xs: string[]) => xs.filter(Boolean).join(' · ')

/** As linhas da etiqueta, na ordem fixa de cada formato. */
export function montarPulseira(d: DadosPulseira): Pulseira {
  const nasc = dataPulseira(d.data_nascimento)
  const estimada = nasc ? '' : idadeEstimadaTexto(d.idade_estimada_meses)
  const pront = limpo(d.prontuario) ? `Pront. ${limpo(d.prontuario)}` : ''
  const linhas: LinhaPulseira[] = []
  const por = (texto: string, destaque = false) => { if (texto) linhas.push(destaque ? { texto, destaque } : { texto }) }

  if (d.rn) {
    const cabecalho = cabecalhoRn(d.nome_mae, d.rn_ordem)
    por(cabecalho, true)
    // o RN que já ganhou nome próprio mostra o nome abaixo
    const nome = limpo(d.nome)
    if (nome && !/^RN\b/i.test(nome) && nome !== cabecalho) por(nome)
    por(pront)
    const sexo = sexoTexto(d.sexo)
    por(juntar(nasc ? `Nasc. ${nasc}` : estimada, sexo ? `Sexo: ${sexo}` : ''))
    return { formato: 'rn', linhas }
  }

  if (d.identidade_desconhecida) {
    por(limpo(d.nome), true)
    por(juntar(pront, nasc ? `Nasc. ${nasc}` : estimada))
    const sexo = sexoTexto(d.sexo)
    const raca = racaTexto(d.raca_cor)
    por(juntar(sexo ? `Sexo aparente: ${sexo}` : '', raca ? `Raça/cor: ${raca}` : ''))
    const sinais = resumirSinais(d.sinais_identificacao)
    por(sinais ? `Sinais: ${sinais}` : '')
    return { formato: 'comum', linhas }
  }

  por(limpo(d.nome), true)
  const social = limpo(d.nome_social)
  if (social && social !== limpo(d.nome)) por(`Nome social: ${social}`)
  por(juntar(nasc ? `Nasc. ${nasc}` : estimada, pront))
  const mae = limpo(d.nome_mae)
  por(mae ? `Mãe: ${mae}` : '')
  return { formato: 'comum', linhas }
}

// ── reimpressão (P8) ────────────────────────────────────────────────────────
export const MOTIVOS_REIMPRESSAO = [
  { valor: 'caiu', rotulo: 'Caiu' },
  { valor: 'ilegivel', rotulo: 'Ilegível' },
  { valor: 'paciente_identificado', rotulo: 'Paciente identificado' },
  { valor: 'dados_corrigidos', rotulo: 'Dados corrigidos' },
  { valor: 'outro', rotulo: 'Outro' },
] as const
export type MotivoReimpressao = (typeof MOTIVOS_REIMPRESSAO)[number]['valor']

export const DETALHE_MAX = 200

/** O que impede reimprimir (as mesmas recusas do servidor). */
export function erroMotivo(motivo: string, detalhe: string): string | null {
  if (!motivo) return 'Escolha o motivo da reimpressão.'
  if (!MOTIVOS_REIMPRESSAO.some((m) => m.valor === motivo)) return 'Escolha um dos motivos da lista.'
  if (motivo === 'outro') {
    const t = limpo(detalhe)
    if (t.length < 3) return 'Escreva qual é o motivo (ao menos 3 letras).'
    if (t.length > DETALHE_MAX) return `Motivo: no máximo ${DETALHE_MAX} letras.`
  }
  return null
}
