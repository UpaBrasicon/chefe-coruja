// Catálogo de exames (Fase 5C, tarefa 1, etapa 1.1): formatos das RPCs e a
// escolha dos botões de pedido rápido. A lista da unidade é do gestor, sobre o
// grupo 02.02 do SIGTAP; o pedido em texto livre continua, sem código.

export type ExameUnidade = {
  id: string; procedimento: string; nome_curto: string; nome_sigtap: string | null
  loinc: string | null; botao: boolean; ordem: number; definido_por: string | null; definido_em: string
}
export type ListaExamesUnidade = { exames: ExameUnidade[]; pode_definir: boolean }
export type ExameBuscado = { procedimento: string; nome: string; nome_sigtap: string | null }
export type Urgencia = 'rotina' | 'urgente'

/** Botão de pedido rápido: do catálogo (com código) ou de texto livre. */
export type BotaoExame = { rotulo: string; procedimento: string | null }

/** Sem lista da unidade, os botões de antes (texto livre). Imagem e ECG ficam até a etapa de imagem (5C-2). */
export const EXAMES_LIVRES_LAB = ['Hemograma completo', 'PCR', 'Ureia e creatinina', 'Sódio e potássio', 'Gasometria arterial', 'Lactato',
  'TGO / TGP', 'Troponina', 'Urina tipo I', 'Hemocultura']
export const EXAMES_LIVRES_OUTROS = ['Radiografia de tórax', 'ECG']

/** 3a: com lista da unidade, os botões de laboratório vêm dos exames marcados pelo gestor. */
export function botoesDeExame(lista: ExameUnidade[] | undefined): BotaoExame[] {
  const marcados = (lista ?? []).filter((e) => e.botao).sort((a, b) => a.ordem - b.ordem || a.nome_curto.localeCompare(b.nome_curto))
  const lab: BotaoExame[] = (lista ?? []).length > 0
    ? marcados.map((e) => ({ rotulo: e.nome_curto, procedimento: e.procedimento }))
    : EXAMES_LIVRES_LAB.map((rotulo) => ({ rotulo, procedimento: null }))
  return [...lab, ...EXAMES_LIVRES_OUTROS.map((rotulo) => ({ rotulo, procedimento: null }))]
}

/** O exame do botão já está pedido (e não cancelado) neste atendimento? Pelo código, senão pelo nome. */
export function jaPedido(b: BotaoExame, pedidos: { exame: string; procedimento?: string | null; situacao: string }[]): boolean {
  return pedidos.some((x) => x.situacao !== 'cancelado'
    && (b.procedimento ? x.procedimento === b.procedimento : x.exame.toLowerCase() === b.rotulo.toLowerCase()))
}

/** Código SIGTAP 0202010040 como 02.02.01.004-0. */
export const codigoExameNaTela = (c: string) =>
  /^\d{10}$/.test(c) ? `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c

/** LOINC no formato 12345-6 (vazio é aceito: a implantação preenche quando o LIS pedir). */
export const loincValido = (t: string) => t.trim() === '' || /^\d{1,7}-\d$/.test(t.trim())

// ── Fase 5C, etapa 1.2: situação e resultado em versões ─────────────────────
export type SituacaoExame = 'pedido' | 'coletado' | 'em_analise' | 'resultado' | 'cancelado'
export const SITUACAO_EXAME: Record<SituacaoExame, string> = {
  pedido: 'Pedido', coletado: 'Coletado', em_analise: 'Em análise', resultado: 'Resultado', cancelado: 'Cancelado',
}
export const PENDENTE: SituacaoExame[] = ['pedido', 'coletado', 'em_analise']

/** Analito como o laboratório mandou: o sistema não interpreta nem marca nada. */
export type ItemResultado = {
  analito: string; loinc: string | null; valor: string | null; valor_num: number | null
  unidade: string | null; referencia: string | null; marca: string | null; critico: boolean
}
export type VersaoResultado = {
  id: string; versao: number; origem: 'manual' | 'laboratorio'; texto: string | null; tem_pdf: boolean; pdf_nome: string | null
  critico: boolean; liberado_em: string; registrado_por: string | null; vigente: boolean
  retificado_em: string | null; motivo_retificacao: string | null
  itens: ItemResultado[]; cientes: { por: string; em: string }[]
}
export type ExameDetalhe = {
  id: string; exame: string; procedimento: string | null; situacao: SituacaoExame; urgencia: Urgencia; observacao: string | null
  pedido_em: string; pedido_por: string | null; coletado_em: string | null; coletado_por: string | null; em_analise_em: string | null
  critico: boolean; origem: 'manual' | 'laboratorio' | null; visto_em: string | null; visto_por: string | null
  versoes: VersaoResultado[]
  pode_registrar: boolean; pode_coletar: boolean; pode_dar_ciencia: boolean; ja_ciente: boolean
}

export const LAUDO_MAX_BYTES = 10 * 1024 * 1024
/** 4a: laudo só em PDF, até 10 MB. */
export function erroLaudo(arquivo: { name: string; type: string; size: number }): string | null {
  if (arquivo.type !== 'application/pdf' || !arquivo.name.toLowerCase().endsWith('.pdf')) return 'O laudo precisa ser PDF.'
  if (arquivo.size > LAUDO_MAX_BYTES) return 'O laudo passa de 10 MB.'
  return null
}
/** Caminho do laudo na área privada: <exame>/<marca de tempo>-<nome limpo>.pdf */
export function caminhoLaudo(exameId: string, nome: string, agora: number): string {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-80)
  return `${exameId}/${agora}-${limpo.toLowerCase().endsWith('.pdf') ? limpo : `${limpo}.pdf`}`
}
