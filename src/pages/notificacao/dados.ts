// Notificação compulsória: tipos, consultas e as regras da ficha do SINAN.
// Banco: supabase/migrations/20261005000004_notificacao_compulsoria.sql.
// Protótipo: index.html, `notifVals` (~30800) e `sinanVals`/`sinanCampos`
// (~30057). O catálogo é a LNNC (Portaria GM/MS nº 10.175, de 23/01/2026,
// como o protótipo cita); o mapeamento CID → agravo aguarda a vigilância.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export const FONTE_LNNC = 'Portaria GM/MS nº 10.175, de 23/01/2026'

export type Situacao = 'sugerido' | 'a_registrar' | 'reaberto' | 'notificado' | 'descartado'

export type Caso = {
  chave: string
  atendimento_em: string
  paciente_id: string
  paciente_nome: string
  local: string | null
  origem: string
  episodio_id: string | null
  internacao_id: string | null
  cid: string | null
  cid_descricao: string | null
  item: string | null
  item_numero: number | null
  agravo: string
  imediata: boolean
  destino: string | null
  condicao: string | null
  conferido: boolean
  agravo_id: string | null
  situacao: Situacao
  numero_sinan: string | null
  registrado_por: string | null
  registrado_em: string | null
  reaberto_em: string | null
  motivo_reabertura: string | null
  pendencias: string[] | null
  no_acesso: boolean
}

export type Ficha = Record<string, string>

export type FichaAberta = {
  id: string
  paciente_id: string
  paciente_nome: string
  episodio_id: string | null
  internacao_id: string | null
  agravo: string
  cid: string | null
  situacao: 'suspeito' | 'notificado' | 'descartado'
  origem: string
  ficha: Ficha
  numero_sinan: string | null
  suspeito_em: string
  registrado_em: string | null
  registrado_por: string | null
  reaberto_em: string | null
  reaberto_por: string | null
  motivo_reabertura: string | null
  motivo_descarte: string | null
  item: string | null
  imediata: boolean | null
  destino: string | null
  condicao: string | null
  conferido: boolean
  unidade: { nome: string; cnes: string | null; municipio: string | null; uf: string | null }
  notificador: { nome: string | null; conselho: string | null; registro: string | null; registro_uf: string | null }
  pendencias: string[]
  pode_abrir_paciente: boolean
}

export const PENDENTE: Situacao[] = ['sugerido', 'a_registrar', 'reaberto']

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  sugerido: 'Sugerido pelo CID',
  a_registrar: 'A registrar',
  reaberto: 'Reaberto',
  notificado: 'Notificado',
  descartado: 'Descartado',
}

export const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
export const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('en-CA')
}
export const ddmm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
export const diaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : ''
/** "A90 — Dengue" → "A90". */
export const codigoCid = (t: string) => t.trim().split(/\s|—/)[0].toUpperCase()

export const chaveLista = ['notificacao-periodo'] as const

export function useCasos(unidadeId: string | undefined, de: string, ate: string, cids: string[]) {
  return useQuery({
    queryKey: [...chaveLista, unidadeId, de, ate, cids],
    enabled: !!unidadeId,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('notificacao_compulsoria_periodo', {
        p_unidade: unidadeId!, p_de: de || undefined, p_ate: ate || undefined, p_cids: cids.length ? cids : undefined,
      })
      if (error) throw error
      return (data ?? []) as unknown as Caso[]
    },
  })
}

/** Quantos itens da LNNC ainda aguardam a conferência da vigilância. */
export function useConferencia() {
  return useQuery({
    queryKey: ['lnnc-conferencia'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [a, c] = await Promise.all([
        supabase.from('lnnc_agravos').select('item', { count: 'exact', head: true }).is('conferido_em', null),
        supabase.from('lnnc_cids').select('item', { count: 'exact', head: true }).is('conferido_em', null),
      ])
      if (a.error) throw a.error
      if (c.error) throw c.error
      return { itens: a.count ?? 0, regras: c.count ?? 0 }
    },
  })
}

export function useFicha(agravoId: string | null) {
  return useQuery({
    queryKey: ['notificacao-ficha', agravoId],
    enabled: !!agravoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('notificacao_ficha', { p_agravo: agravoId! })
      if (error) throw error
      return data as unknown as FichaAberta
    },
  })
}

// ── Ficha Individual de Notificação (SINAN), campos do protótipo ───────────
type Opcoes = readonly (readonly [string, string])[]
export const SEXO: Opcoes = [['M', 'M – Masculino'], ['F', 'F – Feminino'], ['I', 'I – Ignorado']]
export const GESTANTE: Opcoes = [['1', '1 – 1º tri'], ['2', '2 – 2º tri'], ['3', '3 – 3º tri'], ['4', '4 – IG ignorada'], ['5', '5 – Não'], ['6', '6 – Não se aplica'], ['9', '9 – Ignorado']]
export const RACA: Opcoes = [['1', '1 – Branca'], ['2', '2 – Preta'], ['3', '3 – Amarela'], ['4', '4 – Parda'], ['5', '5 – Indígena'], ['9', '9 – Ignorado']]
export const ZONA: Opcoes = [['1', '1 – Urbana'], ['2', '2 – Rural'], ['3', '3 – Periurbana'], ['9', '9 – Ignorado']]
export const ESCOLARIDADE: Opcoes = [
  ['0', '0 – Analfabeto'], ['1', '1 – 1ª a 4ª série incompleta'], ['2', '2 – 4ª série completa'], ['3', '3 – 5ª a 8ª série incompleta'],
  ['4', '4 – Fundamental completo'], ['5', '5 – Médio incompleto'], ['6', '6 – Médio completo'], ['7', '7 – Superior incompleto'],
  ['8', '8 – Superior completo'], ['9', '9 – Ignorado'], ['10', '10 – Não se aplica'],
]

export type Campo = { k: string; num: string; rotulo: string; tipo: 'texto' | 'data' | 'opc'; largura: number; opcoes?: Opcoes }
export const SECOES: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Dados gerais', campos: [{ k: 'data_sintomas', num: '7', rotulo: 'Data dos primeiros sintomas', tipo: 'data', largura: 4 }] },
  {
    titulo: 'Notificação individual',
    campos: [
      { k: 'nome', num: '8', rotulo: 'Nome do paciente', tipo: 'texto', largura: 8 },
      { k: 'nascimento', num: '9', rotulo: 'Data de nascimento', tipo: 'data', largura: 4 },
      { k: 'idade', num: '10', rotulo: 'Idade', tipo: 'texto', largura: 3 },
      { k: 'sexo', num: '11', rotulo: 'Sexo', tipo: 'opc', largura: 9, opcoes: SEXO },
      { k: 'gestante', num: '12', rotulo: 'Gestante', tipo: 'opc', largura: 12, opcoes: GESTANTE },
      { k: 'raca', num: '13', rotulo: 'Raça/cor', tipo: 'opc', largura: 12, opcoes: RACA },
      { k: 'escolaridade', num: '14', rotulo: 'Escolaridade', tipo: 'opc', largura: 12, opcoes: ESCOLARIDADE },
      { k: 'cns', num: '15', rotulo: 'Cartão SUS', tipo: 'texto', largura: 6 },
      { k: 'mae', num: '16', rotulo: 'Nome da mãe', tipo: 'texto', largura: 6 },
    ],
  },
  {
    titulo: 'Dados de residência',
    campos: [
      { k: 'uf', num: '20', rotulo: 'UF', tipo: 'texto', largura: 2 },
      { k: 'municipio', num: '21', rotulo: 'Município de residência', tipo: 'texto', largura: 6 },
      { k: 'ibge', num: '', rotulo: 'Código IBGE', tipo: 'texto', largura: 4 },
      { k: 'distrito', num: '22', rotulo: 'Distrito', tipo: 'texto', largura: 4 },
      { k: 'bairro', num: '23', rotulo: 'Bairro', tipo: 'texto', largura: 8 },
      { k: 'logradouro', num: '24', rotulo: 'Logradouro (rua, avenida…)', tipo: 'texto', largura: 9 },
      { k: 'numero', num: '25', rotulo: 'Número', tipo: 'texto', largura: 3 },
      { k: 'complemento', num: '26', rotulo: 'Complemento', tipo: 'texto', largura: 6 },
      { k: 'referencia', num: '29', rotulo: 'Ponto de referência', tipo: 'texto', largura: 6 },
      { k: 'cep', num: '30', rotulo: 'CEP', tipo: 'texto', largura: 4 },
      { k: 'telefone', num: '31', rotulo: '(DDD) Telefone', tipo: 'texto', largura: 4 },
      { k: 'pais', num: '33', rotulo: 'País (se residente fora do Brasil)', tipo: 'texto', largura: 4 },
      { k: 'zona', num: '32', rotulo: 'Zona', tipo: 'opc', largura: 12, opcoes: ZONA },
    ],
  },
]

const dataOk = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T12:00:00`)
  return !Number.isNaN(d.getTime()) && d.toLocaleDateString('en-CA') === s && s <= hojeSP() && s >= '1900-01-01'
}

/** "Falta para registrar" — as mesmas regras de private.ficha_sinan_pendencias. */
export function pendenciasFicha(f: Ficha): string[] {
  const v = (k: string) => (f[k] ?? '').trim()
  const p: string[] = []
  if (!v('nome')) p.push('Campo 8: nome do paciente.')
  if (!v('data_sintomas')) p.push('Campo 7: data dos primeiros sintomas.')
  else if (!dataOk(v('data_sintomas'))) p.push('Campo 7: data dos primeiros sintomas inválida ou no futuro.')
  if (!v('nascimento') && !v('idade')) p.push('Campos 9 e 10: data de nascimento ou idade.')
  if (v('nascimento') && !dataOk(v('nascimento'))) p.push('Campo 9: data de nascimento inválida ou no futuro.')
  if (!['M', 'F', 'I'].includes(v('sexo'))) p.push('Campo 11: sexo.')
  if (v('sexo') === 'F' && !v('gestante')) p.push('Campo 12: gestante (obrigatório para o sexo feminino).')
  return p
}

/** "Completar se tiver o dado" (protótipo, `sinanConferir`). */
export function avisosFicha(f: Ficha): string[] {
  const v = (k: string) => (f[k] ?? '').trim()
  const a: string[] = []
  if (v('nome') && /(^|\s)[A-Za-zÀ-ú]\.(\s|$)/.test(v('nome'))) a.push('Campo 8: nome abreviado. O SINAN pede nome completo.')
  if (!v('raca')) a.push('Campo 13: raça/cor.')
  if (!v('cns')) a.push('Campo 15: Cartão SUS.')
  if (!v('mae')) a.push('Campo 16: nome da mãe.')
  if (!v('municipio') || !v('logradouro')) a.push('Campos 21 a 25: endereço de residência.')
  return a
}

export const prazo = (c: { imediata: boolean | null; condicao: string | null }) =>
  c.imediata ? 'Imediata · 24 h' : c.condicao ? `Semanal · imediata se ${c.condicao}` : 'Semanal'
