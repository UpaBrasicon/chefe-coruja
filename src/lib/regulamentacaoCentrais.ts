// Regulamentação das centrais pelo administrador (pedido do RT de 24/11/2026):
// tipos da leitura, modelos prontos do que a unidade tem, prazo em minutos
// para a tela e a lista que vai ao banco.
// Migration 20270421000010_regulacao_centrais_admin.sql.
import { TIPOS_LEITO } from './regulacao.ts'

export type CategoriaCapacidade = 'leito' | 'exame' | 'especialidade'
export type Capacidade = { categoria: CategoriaCapacidade; codigo: string; nome: string; quantidade: number | null; observacao: string | null }
export type TipoPedido = 'consulta' | 'exame' | 'leito' | 'transferencia'
export type CentralReg = {
  id: string; nome: string; tipo: string; principal: boolean
  unidades: string[]; prazos: Partial<Record<TipoPedido, number>>; prazos_atualizado_em: string | null
}
export type UnidadeReg = {
  id: string; nome: string; tipo: string; central_id: string | null; eh_central: boolean
  capacidades: Capacidade[]; capacidades_atualizado_em: string | null
}
export type OrganizacaoReg = { organizacao_id: string; organizacao: string; principal: string | null; centrais: CentralReg[]; unidades: UnidadeReg[] }

/** Os tipos que o sistema já usa, com o nome que o RT deu. */
export const TIPOS_PEDIDO: { tipo: TipoPedido; rotulo: string; ajuda: string }[] = [
  { tipo: 'leito', rotulo: 'Internação (leito)', ajuda: 'Pedido de leito de internação, enfermaria ou UTI' },
  { tipo: 'consulta', rotulo: 'Encaminhamento (consulta)', ajuda: 'Consulta com especialista' },
  { tipo: 'exame', rotulo: 'Exame', ajuda: 'Raio-X, tomografia, laboratório e os mais complexos' },
  { tipo: 'transferencia', rotulo: 'Transferência', ajuda: 'Remoção entre serviços' },
]

/** Exames mais pedidos à regulação; o administrador pode escrever outro. */
export const EXAMES_MODELO = [
  'Raio-X', 'Laboratório', 'Eletrocardiograma', 'Ultrassonografia', 'Tomografia', 'Ressonância magnética',
  'Ecocardiograma', 'Doppler vascular', 'Endoscopia digestiva', 'Colonoscopia', 'Mamografia',
  'Cateterismo cardíaco (hemodinâmica)', 'Eletroencefalograma', 'Densitometria óssea', 'Cintilografia',
]

export const CATEGORIAS: { categoria: CategoriaCapacidade; rotulo: string; vazio: string }[] = [
  { categoria: 'leito', rotulo: 'Tipos de leito', vazio: 'Sem leito de internação informado.' },
  { categoria: 'exame', rotulo: 'Exames', vazio: 'Nenhum exame informado.' },
  { categoria: 'especialidade', rotulo: 'Especialidades', vazio: 'Nenhuma especialidade informada.' },
]

/** Sem acento e em minúsculas, para buscar. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Código guardado no banco: letras, números e "_" (2 a 60). */
export function codigoDe(nome: string): string {
  return semAcento(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
}

export type Opcao = { codigo: string; nome: string }

/** Modelos prontos de cada categoria. */
export function opcoesDaCategoria(categoria: CategoriaCapacidade, especialidades: readonly string[]): Opcao[] {
  if (categoria === 'leito') return Object.entries(TIPOS_LEITO).map(([codigo, nome]) => ({ codigo, nome }))
  const nomes = categoria === 'exame' ? EXAMES_MODELO : especialidades
  return nomes.map((nome) => ({ codigo: codigoDe(nome), nome }))
}

/** Busca sem acento pelo começo de qualquer palavra ou trecho do nome. */
export function filtrarOpcoes<T extends { nome: string }>(opcoes: T[], termo: string, limite = 8): T[] {
  const t = semAcento(termo)
  if (!t) return opcoes.slice(0, limite)
  return opcoes.filter((o) => semAcento(o.nome).includes(t)).slice(0, limite)
}

// ── prazo: minutos no banco, horas ou dias na tela ──────────────────────────
export type UnidadePrazo = 'min' | 'h' | 'd'
export const UNIDADES_PRAZO: Record<UnidadePrazo, { rotulo: string; minutos: number }> = {
  min: { rotulo: 'minutos', minutos: 1 }, h: { rotulo: 'horas', minutos: 60 }, d: { rotulo: 'dias', minutos: 1440 },
}
export const PRAZO_MAXIMO_MIN = 525600

/** Minutos para a maior unidade que fica inteira. */
export function prazoParaTela(minutos: number | null | undefined): { valor: string; unidade: UnidadePrazo } {
  if (minutos == null) return { valor: '', unidade: 'h' }
  if (minutos % 1440 === 0) return { valor: String(minutos / 1440), unidade: 'd' }
  if (minutos % 60 === 0) return { valor: String(minutos / 60), unidade: 'h' }
  return { valor: String(minutos), unidade: 'min' }
}

/** Valor da tela em minutos; vazio = sem prazo; erro em texto. */
export function prazoEmMinutos(valor: string, unidade: UnidadePrazo): { minutos: number | null; erro: string | null } {
  const v = valor.trim().replace(',', '.')
  if (!v) return { minutos: null, erro: null }
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return { minutos: null, erro: 'Use um número maior que zero.' }
  const minutos = Math.round(n * UNIDADES_PRAZO[unidade].minutos)
  if (minutos < 1 || minutos > PRAZO_MAXIMO_MIN) return { minutos: null, erro: 'De 1 minuto a 365 dias.' }
  return { minutos, erro: null }
}

/** Prazo legível ("2 dias", "6 h", "90 min"); "sem prazo" quando vazio. */
export function prazoLegivel(minutos: number | null | undefined): string {
  if (minutos == null) return 'sem prazo'
  const { valor, unidade } = prazoParaTela(minutos)
  if (unidade === 'd') return `${valor} ${valor === '1' ? 'dia' : 'dias'}`
  if (unidade === 'h') return `${valor} h`
  return `${valor} min`
}

// ── capacidades ─────────────────────────────────────────────────────────────
/** A lista que vai ao banco: sem repetidos, quantidade só no leito. */
export function capacidadesParaEnvio(itens: Capacidade[]): Capacidade[] {
  const vistos = new Set<string>()
  const saida: Capacidade[] = []
  for (const i of itens) {
    const chave = `${i.categoria}:${i.codigo}`
    if (vistos.has(chave) || !i.codigo) continue
    vistos.add(chave)
    saida.push({
      categoria: i.categoria, codigo: i.codigo, nome: i.nome.trim(),
      quantidade: i.categoria === 'leito' && i.quantidade != null && Number.isFinite(i.quantidade) ? Math.trunc(i.quantidade) : null,
      observacao: i.observacao?.trim() || null,
    })
  }
  return saida
}

/** Resumo curto do que a unidade tem, para a lista. */
export function resumoCapacidades(itens: Capacidade[]): string {
  const leitos = itens.filter((i) => i.categoria === 'leito')
  const total = leitos.reduce((s, i) => s + (i.quantidade ?? 0), 0)
  const exames = itens.filter((i) => i.categoria === 'exame').length
  const esp = itens.filter((i) => i.categoria === 'especialidade').length
  if (!itens.length) return 'nada informado'
  const partes = [
    leitos.length ? `${leitos.length} ${leitos.length === 1 ? 'tipo de leito' : 'tipos de leito'}${total ? ` (${total} leitos)` : ''}` : 'sem internação',
    `${exames} ${exames === 1 ? 'exame' : 'exames'}`,
    `${esp} ${esp === 1 ? 'especialidade' : 'especialidades'}`,
  ]
  return partes.join(' · ')
}
