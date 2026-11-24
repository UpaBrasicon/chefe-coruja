// Unificação de pacientes duplicados (Fase 1, tarefa 9): formatos das RPCs e
// a sugestão de qual cadastro fica como principal.

export type Cadastro = {
  id: string; nome: string; nome_mae: string | null; data_nascimento: string | null
  prontuario: string | null; cpf: string | null; cns: string | null; criado_em: string
  atendimentos: number; aberto: boolean; ultimo_atendimento: string | null
}
export type Candidato = { regras: ('nome_nascimento' | 'mae_nascimento' | 'documento' | 'nome_conferir')[]; pedido_pendente: boolean; cadastros: Cadastro[] }

type Resumo = { id: string; nome: string; prontuario: string | null; data_nascimento: string | null; nome_mae: string | null }
export type PedidoUnificacao = {
  id: string; status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'desfeito'; motivo: string
  pedido_em: string; pedido_por: string | null; meu: boolean
  decidido_por: string | null; decidido_em: string | null; motivo_decisao: string | null
  desfeito_em: string | null; motivo_desfazer: string | null
  /** Portão 2, tarefa 3: documentos diferentes (CPF, CNS) e as confirmações */
  divergencias: string[]; confirmado_no_pedido: boolean; confirmado_na_decisao: boolean
  principal: Resumo; absorvido: Resumo
}

/**
 * "São pessoas diferentes" gravado (migration 20270421000076): o par não volta
 * a ser sugerido enquanto a marca estiver ativa (desfeito_em nulo).
 */
export type MarcaPessoasDiferentes = {
  id: string; motivo: string
  decidido_por: string | null; decidido_em: string
  desfeito_por: string | null; desfeito_em: string | null
  a: Resumo; b: Resumo
}
/** Motivo curto de "Deixar separados" (o servidor confere o mesmo mínimo). */
export const MOTIVO_MINIMO_SEPARADOS = 5

export const ROTULO_REGRA: Record<Candidato['regras'][number], string> = {
  nome_nascimento: 'mesmo nome e nascimento',
  mae_nascimento: 'mesma mãe e nascimento',
  documento: 'mesmo CPF ou CNS',
  nome_conferir: 'mesmo nome, nascimento diferente ou em branco: conferir',
}

/**
 * Sugestão de principal: o cadastro com atendimento aberto (é nele que a equipe
 * está trabalhando); depois o com mais atendimentos; empate, o mais antigo.
 */
export function sugerirPrincipal(cadastros: Cadastro[]): string {
  const ordem = [...cadastros].sort((a, b) =>
    Number(b.aberto) - Number(a.aberto) || b.atendimentos - a.atendimentos || a.criado_em.localeCompare(b.criado_em))
  return ordem[0].id
}

const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '')

/**
 * Documentos diferentes entre dois cadastros (Portão 2, tarefa 3, decisão 1a do
 * RT): CPF ou CNS preenchidos nos dois e diferentes. A mesma regra está no
 * servidor (private.documentos_divergentes), que é quem trava.
 */
export function documentosDivergentes(cadastros: Pick<Cadastro, 'cpf' | 'cns'>[]): string[] {
  const [a, b] = cadastros
  if (!a || !b) return []
  return ([['CPF', a.cpf, b.cpf], ['CNS', a.cns, b.cns]] as const)
    .filter(([, x, y]) => digitos(x) !== '' && digitos(y) !== '' && digitos(x) !== digitos(y))
    .map(([nome]) => nome)
}

/** Motivo mínimo do pedido: 30 letras com documento diferente, 10 sem. */
export const motivoMinimo = (divergencias: string[]) => (divergencias.length > 0 ? 30 : 10)

/**
 * Por que o sistema sugere este cadastro como o que fica (revisão do gestor,
 * RT 24/11/2026, M3): a mesma ordem de sugerirPrincipal, em português.
 */
export function porQueSugerido(cadastros: Cadastro[]): string {
  const id = sugerirPrincipal(cadastros)
  const c = cadastros.find((x) => x.id === id)!
  const outros = cadastros.filter((x) => x.id !== id)
  if (c.aberto && outros.every((o) => !o.aberto)) return 'tem atendimento aberto agora; é nele que a equipe está trabalhando'
  if (outros.every((o) => c.atendimentos > o.atendimentos)) {
    return `tem mais atendimentos (${c.atendimentos} contra ${outros.map((o) => o.atendimentos).join(', ')})`
  }
  return 'é o cadastro mais antigo'
}

export type SituacaoCampo = 'igual' | 'diferente' | 'so_um' | 'vazio'
export type LinhaComparacao = { chave: string; rotulo: string; a: string | null; b: string | null; situacao: SituacaoCampo }
type CamposComparados = Partial<Pick<Cadastro, 'data_nascimento' | 'nome_mae' | 'cpf' | 'cns' | 'prontuario'>> & Pick<Cadastro, 'nome'>

const semAcento = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Comparação campo a campo de dois cadastros (revisão do gestor, RT
 * 24/11/2026, M1): nome e mãe sem diferença de acento, caixa ou espaço; CPF e
 * CNS só pelos dígitos. O valor volta cru; a tela formata. Campo que não veio
 * da consulta (o pedido não traz CPF) fica de fora.
 */
export function compararCampos(a: CamposComparados, b: CamposComparados): LinhaComparacao[] {
  const campos: { chave: keyof CamposComparados; rotulo: string; norm: (v: string) => string }[] = [
    { chave: 'nome', rotulo: 'Nome', norm: semAcento },
    { chave: 'data_nascimento', rotulo: 'Nascimento', norm: (v) => v.slice(0, 10) },
    { chave: 'nome_mae', rotulo: 'Mãe', norm: semAcento },
    { chave: 'cpf', rotulo: 'CPF', norm: digitos },
    { chave: 'cns', rotulo: 'CNS', norm: digitos },
    { chave: 'prontuario', rotulo: 'Prontuário', norm: (v) => v.trim() },
  ]
  return campos
    .filter((c) => c.chave in a || c.chave in b)
    .map((c) => {
      const va = a[c.chave] == null || a[c.chave] === '' ? null : String(a[c.chave])
      const vb = b[c.chave] == null || b[c.chave] === '' ? null : String(b[c.chave])
      const situacao: SituacaoCampo = va === null && vb === null ? 'vazio'
        : va === null || vb === null ? 'so_um'
        : c.norm(va) === c.norm(vb) ? 'igual' : 'diferente'
      return { chave: c.chave, rotulo: c.rotulo, a: va, b: vb, situacao }
    })
}

/** Chave do par, na mesma forma para o candidato e para o pedido. */
export const chavePar = (ids: string[]) => [...ids].sort().join('|')

export type ItemHistorico =
  | { tipo: 'pedido'; em: string; pedido: PedidoUnificacao }
  | { tipo: 'marca'; em: string; marca: MarcaPessoasDiferentes }

/**
 * Histórico da tela: pedidos já decididos e marcas de "pessoas diferentes" numa
 * lista só, do mais recente para o mais antigo (a data é a da última mudança).
 */
export function juntarHistorico(pedidos: PedidoUnificacao[], marcas: MarcaPessoasDiferentes[]): ItemHistorico[] {
  const itens: ItemHistorico[] = [
    ...pedidos.filter((p) => p.status !== 'pendente')
      .map((p) => ({ tipo: 'pedido' as const, em: p.desfeito_em ?? p.decidido_em ?? p.pedido_em, pedido: p })),
    ...marcas.map((m) => ({ tipo: 'marca' as const, em: m.desfeito_em ?? m.decidido_em, marca: m })),
  ]
  return itens.sort((x, y) => new Date(y.em).getTime() - new Date(x.em).getTime())
}
