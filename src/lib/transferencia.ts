// Documento e checklist de transferência externa (lacuna 7; decisão do RT em
// 10/11/2026, A em T1 a T9; migration 20270329000001). O servidor monta a
// fotografia (dados_transferencia), grava o documento
// (emitir_documento_transferencia) e o checklist (marcar_item_transferencia),
// e recusa a transferência sem documento emitido. Aqui ficam só as regras que
// a tela mostra antes de enviar, iguais às do servidor.
//
// Fontes (texto conferido em 10/11/2026):
// - Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1: (a) vaga na Central
//   e contato prévio com quem recebe; (b) estabilizar antes de remover; (d) a
//   decisão é do médico; (f) o documento de transferência acompanha o
//   paciente, com diagnóstico de entrada, exames, condutas, nome, CRM e
//   assinatura; (g) autorização escrita do paciente ou do responsável, salvo
//   quando não for possível; (h) o médico que transfere responde até o
//   paciente ser recebido; (l) nenhuma transferência sem contato com a Central.
//   Item 3.3 (e): intercorrências do transporte registradas no documento.
// - Resolução CFM nº 1.672/2003, Art. 1º: II (estabilização), IV (contato e
//   concordância de quem recebe), VI (relatório assinado com CRM, também
//   assinado por quem recebe), VII (consentimento escrito), IX (neonato em
//   ambulância com incubadora).
// - Resolução CFM nº 2.079/2014 (UPA) e nº 2.110/2014, Art. 18.

import { ITENS_TRANSFERENCIA, ROTULO_ACOMPANHANTE, ROTULO_AUTORIZACAO, ROTULO_TRANSPORTE } from './folhas.ts'

export { ITENS_TRANSFERENCIA, ROTULO_ACOMPANHANTE, ROTULO_ATENDIMENTO, ROTULO_AUTORIZACAO, ROTULO_TRANSPORTE, rotuloSinal, textoItemTransferencia } from './folhas.ts'

export type ItemTransferencia =
  | 'contato_destino' | 'regulacao' | 'autorizacao' | 'estabilizado' | 'transporte'
  | 'acompanhante_equipe' | 'isolamento_informado' | 'incubadora'
export type SituacaoItem = 'feito' | 'nao_se_aplica'

export type ItemChecklist = {
  item: ItemTransferencia; quem: 'medico' | 'enfermagem'; situacao: SituacaoItem | null
  detalhe?: string | null; motivo?: string | null; por?: string | null; em?: string | null; automatico?: boolean
}
export type TextosTransferencia = { resumo_clinico: string; condutas: string; motivo: string }

/** O que a tela recebe de public.dados_transferencia. */
export type DadosTransferencia = {
  contexto: { origem: 'porta' | 'observacao' | 'internacao'; episodio_id: string; internacao_id: string | null } | null
  dados?: FotografiaTransferencia
  documento?: DocumentoTransferencia | null
  checklist?: ItemChecklist[]
  neonato?: boolean
  eu?: { nome: string | null; registro: string | null }
  pode?: { emitir: boolean; enfermagem: boolean }
}
export type DocumentoTransferencia = {
  id: string; numero: string | null; versao: number; estado: string; emitido_em: string
  autor: string | null; autor_registro: string | null; meu?: boolean
  conteudo: { formato: string; textos?: TextosTransferencia; dados?: FotografiaTransferencia; medico?: { nome?: string; registro?: string } }
}
export type FotografiaTransferencia = {
  tirado_em?: string
  identificacao?: { nome?: string; nome_social?: string; nascimento?: string; sexo?: string; cns?: string; prontuario?: string; neonato?: boolean }
  origem?: { atendimento?: string; unidade?: string; cnes?: string; setor?: string; leito?: string; entrada_em?: string }
  diagnostico_entrada?: { hipotese?: string; cid?: string; cid_descricao?: string; em?: string } | null
  cid_internacao?: string | null
  alergias?: { estado: string; itens: { substancia: string; tipo?: string; gravidade?: string; reacao?: string }[] }
  sinais_vitais?: { conceito: string; valor?: string; unidade?: string; aferido_em?: string }[]
  prescricao?: { descricao: string; tipo?: string; dose?: string; via?: string; posologia?: string; se_necessario?: boolean; valida_ate?: string; vencido?: boolean; controlado?: string }[]
  controlados?: { descricao: string; lista: string }[]
  exames?: { exame: string; situacao: string; pedido_em?: string; resultado?: string; liberado_em?: string; itens?: { analito?: string; valor?: string; unidade?: string; referencia?: string }[] }[]
  dispositivos?: { tipo: string; local?: string; calibre?: string; inserido_em?: string }[]
  isolamento?: { tipo: string; desde?: string }[]
  contencao?: { desde: string; locais?: string[]; motivo?: string }[]
  regulacao?: {
    id: string; numero?: number; status?: string; sistema_externo?: string; protocolo_externo?: string; destino?: string
    destino_na_rede?: boolean; transporte?: string; incubadora?: boolean; isolamento?: string
    aceite?: { em?: string; por?: string; registro?: string; meio?: string } | null
  } | null
}

export const MIN_RESUMO = 15
export const MIN_CONDUTAS = 10
export const MIN_MOTIVO = 10
export const MIN_NAO_SE_APLICA = 10
export const MAX_TEXTO = 4000

/** Itens do checklist de quem marca: o médico os dele, o enfermeiro os da enfermagem. */
export function itensDe(quem: 'medico' | 'enfermagem') {
  return ITENS_TRANSFERENCIA.filter((i) => i.quem === quem)
}

/** Opções do detalhe, quando o item tem escolha fechada. */
export function opcoesDoItem(item: string): { valor: string; rotulo: string }[] | null {
  const de = (r: Record<string, string>) => Object.entries(r).map(([valor, rotulo]) => ({ valor, rotulo }))
  if (item === 'transporte') return de(ROTULO_TRANSPORTE)
  if (item === 'acompanhante_equipe') return de(ROTULO_ACOMPANHANTE)
  if (item === 'autorizacao') return de(ROTULO_AUTORIZACAO)
  return null
}

/** Rótulo do campo de detalhe quando o item é marcado "feito" (null: sem detalhe). */
export function rotuloDetalhe(item: string): string | null {
  switch (item) {
    case 'contato_destino': return 'Nome de quem aceitou no destino'
    case 'regulacao': return 'Número ou protocolo da regulação'
    case 'autorizacao': return 'Quem assinou'
    case 'transporte': return 'Tipo de transporte'
    case 'acompanhante_equipe': return 'Quem da equipe vai junto'
    default: return null
  }
}

/** O que falta para salvar o item (a mesma regra de marcar_item_transferencia); null: pode salvar. */
export function faltaNoItem(item: string, situacao: SituacaoItem | null, detalhe: string, motivo: string, neonato = false): string | null {
  if (!situacao) return 'Marque como feito ou como "não se aplica".'
  if (item === 'incubadora' && !neonato) return 'Incubadora: só no recém-nascido (até 27 dias de vida).'
  if (situacao === 'nao_se_aplica') return motivo.trim().length < MIN_NAO_SE_APLICA ? `Diga por que não se aplica (mínimo de ${MIN_NAO_SE_APLICA} letras).` : null
  const d = detalhe.trim()
  const opcoes = opcoesDoItem(item)
  if (opcoes) return opcoes.some((o) => o.valor === d) ? null : `Escolha: ${rotuloDetalhe(item)?.toLowerCase()}.`
  if (item === 'contato_destino' && d.length < 3) return 'Diga o nome de quem aceitou o paciente.'
  if (item === 'regulacao' && !d) return 'Informe o número ou o protocolo da regulação.'
  return null
}

/** Os textos do médico: o que falta para emitir (vazio: pode emitir). */
export function faltasDosTextos(t: TextosTransferencia): string[] {
  const f: string[] = []
  if (t.resumo_clinico.trim().length < MIN_RESUMO) f.push(`Resumo clínico (mínimo de ${MIN_RESUMO} letras)`)
  if (t.condutas.trim().length < MIN_CONDUTAS) f.push(`Condutas adotadas (mínimo de ${MIN_CONDUTAS} letras)`)
  if (t.motivo.trim().length < MIN_MOTIVO) f.push(`Motivo da transferência (mínimo de ${MIN_MOTIVO} letras)`)
  if ([t.resumo_clinico, t.condutas, t.motivo].some((x) => x.trim().length > MAX_TEXTO)) f.push(`Cada texto cabe em ${MAX_TEXTO} letras`)
  return f
}

/** Itens ainda sem marca (registram, não travam). */
export function pendentesDoChecklist(ck: readonly ItemChecklist[] | undefined): string[] {
  return (ck ?? []).filter((c) => c.situacao == null)
    .map((c) => ITENS_TRANSFERENCIA.find((i) => i.item === c.item)?.rotulo ?? c.item)
}

/** A transferência só sai com o documento emitido e em vigor (T5); o servidor confere de novo. */
export function documentoEmitido(d: Pick<DadosTransferencia, 'documento'> | null | undefined): boolean {
  return !!d?.documento && ['ativo', 'assinado'].includes(d.documento.estado)
}

/** Textos do documento em vigor, para a nova versão começar do que foi emitido. */
export function textosIniciais(d: Pick<DadosTransferencia, 'documento'> | null | undefined): TextosTransferencia {
  const t = d?.documento?.conteudo?.textos
  return { resumo_clinico: t?.resumo_clinico ?? '', condutas: t?.condutas ?? '', motivo: t?.motivo ?? '' }
}
