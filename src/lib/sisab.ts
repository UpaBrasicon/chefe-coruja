// Aba SISAB em Integrações (percurso da UBS, U15, PR 5). Tipos do retorno de
// public.ledi_painel e public.ledi_itens (migration 20270415000024) e as regras
// da tela: o que falta para ligar o envio e a ação de cada ficha.
import { ROTULO_STATUS, VARIANTE_STATUS, type StatusItem } from './rnds.ts'

export type PainelSisab = {
  ubs: boolean
  cnes: string | null
  config: { codigo_ibge: string | null; ine: string | null; pec_url: string | null; envio_ligado: boolean; atualizado_em: string } | null
  contagem: Record<StatusItem, number>
}

export type ItemSisab = {
  id: string
  tipo: 'fai' | 'fp'
  uuid_ficha: string
  status: StatusItem
  tentativas: number
  ultimo_erro: string | null
  criado_em: string
  enviado_em: string | null
  proxima_tentativa_em: string | null
}

export const ROTULO_FICHA: Record<ItemSisab['tipo'], string> = { fai: 'Atendimento individual', fp: 'Procedimento' }
export { ROTULO_STATUS, VARIANTE_STATUS }

/** O que falta para ligar o envio (ledi_ligar_envio exige os três). */
export function faltaParaLigar(p: PainelSisab): string[] {
  const falta: string[] = []
  if (!p.cnes || p.cnes.length !== 7) falta.push('o CNES da unidade (no cadastro da unidade)')
  if (!p.config?.codigo_ibge) falta.push('o código IBGE do município')
  if (!p.config?.pec_url) falta.push('o endereço do PEC e-SUS APS do município')
  return falta
}

/** Campos da configuração: o que a tela aceita antes de mandar ao banco. */
export function conferirConfig(ibge: string, ine: string, url: string): string | null {
  const so = (s: string) => s.replace(/\D/g, '')
  if (ibge.trim() && so(ibge).length !== 7) return 'O código IBGE do município tem 7 dígitos.'
  if (ine.trim() && so(ine).length !== 10) return 'O INE da equipe tem 10 dígitos.'
  if (url.trim() && !/^https:\/\/[^\s/]+/.test(url.trim())) return 'O endereço do PEC começa com https://.'
  return null
}

/** Ficha com erro volta à fila; retida tenta agora. */
export function acaoDaFicha(i: ItemSisab): string | null {
  return i.status === 'erro' ? 'Reenviar' : i.status === 'retido' ? 'Tentar agora' : null
}

/** O motivo sem o prefixo técnico "retido: ". */
export function motivoDaFicha(i: ItemSisab): string | null {
  if (!i.ultimo_erro) return null
  const m = i.ultimo_erro.replace(/^retido: /, '')
  return m.charAt(0).toUpperCase() + m.slice(1)
}
