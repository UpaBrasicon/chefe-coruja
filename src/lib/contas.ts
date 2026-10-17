// Conta do atendimento (Fase 5B, tarefa 1): formatos das RPCs e as ações que a
// tela oferece em cada etapa. Quem decide é o servidor (public.mudar_etapa_conta);
// aqui só se escolhe o que mostrar.

export type EtapaConta = 'aberta' | 'em_conferencia' | 'fechada' | 'faturada'
export type TipoConta = 'ambulatorial' | 'internacao'
export type Pagador = 'sus' | 'convenio' | 'particular'
type Ligacao = { id: string; numero: string; status: EtapaConta }

export type Conta = {
  id: string; numero: string; tipo: TipoConta; status: EtapaConta; pagador: Pagador
  aberta_em: string; status_em: string; status_por: string | null
  paciente: { id: string; nome: string; prontuario: string | null }
  atendimento: { inicio: string | null; fim: string | null; situacao: string | null; desfecho?: string | null; setor: string | null } | null
  atendimento_terminou: boolean
  origem: Ligacao | null
  derivadas: Ligacao[]
}
/** Item da conta (Fase 5B, tarefa 2): linha do BPA na porta; AIH ou especial lançado na internação. */
export type ItemConta = {
  origem: 'atendimento' | 'classificacao' | 'medicacao' | 'registro' | 'aih' | 'lancamento'
  origem_id: string; procedimento: string | null; nome: string | null; quantidade: number
  profissional: string | null; cbo: string | null; em: string | null
  valor_unitario: number | null; valor_total: number | null
  criticas: { codigo: string; texto: string; bloqueante?: boolean }[]; avisos: { codigo: string; texto: string }[]
  retiravel: boolean
  aih?: { status: string; numero: string | null; competencia: string | null }
}
/** Medicamento da conta (Fase 5B, etapa 3.3): o que a farmácia dispensou (menos o que voltou) ao lado do que a enfermagem deu. */
export type MedicamentoConta = {
  item_id: string; medicamento: string; unidade_consumo: string | null; prescricao: string
  dispensado: number; devolvido: number; liquido: number; sem_farmaceutico: boolean
  administrado: number; aviso: string | null
  fora_da_conta: boolean; fora_motivo: string | null; fora_por: string | null
}
/** AIH e APAC ligadas à conta (Fase 5B, tarefa 4): só mostra; quem pede e decide é a regulação. */
export type AihConta = {
  id: string; status: 'solicitada' | 'aprovada' | 'rejeitada' | 'cancelada'; numero: string | null; competencia: string | null
  procedimento: string | null; nome: string | null; solicitada_em: string; decidida_em: string | null; motivo: string | null; vigente: boolean
}
export type ApacConta = {
  id: string; tipo: '1' | '2' | '3'; status: 'solicitada' | 'autorizada' | 'rejeitada' | 'cancelada'; numero: string | null
  procedimento: string; nome: string | null; validade_inicio: string | null; validade_fim: string | null
  solicitada_em: string; decidida_em: string | null; motivo: string | null
  competencias: { competencia: string; fechada: boolean; fora_do_arquivo: boolean }[]
}
export type DocumentosSus = { aihs: AihConta[]; apacs: ApacConta[]; avisos: string[] }

export const SITUACAO_DOCUMENTO: Record<AihConta['status'] | ApacConta['status'], string> = {
  solicitada: 'solicitada', aprovada: 'aprovada', autorizada: 'autorizada', rejeitada: 'rejeitada', cancelada: 'cancelada',
}
export const TIPO_APAC: Record<ApacConta['tipo'], string> = { '1': 'inicial', '2': 'continuidade', '3': 'única' }

export type ContaDetalhe = Conta & {
  eventos: { evento: string; de: string | null; para: string | null; motivo: string | null; por: string | null; em: string }[]
  pode_conduzir: boolean
  pode_reabrir: boolean
  itens: ItemConta[]
  congelada_em: string | null
  total_referencia: number
  itens_com_aviso: number
  medicamentos: MedicamentoConta[]
  medicamentos_com_aviso: number
  documentos_sus: DocumentosSus
}

export const ORIGEM_ITEM: Record<ItemConta['origem'], string> = {
  atendimento: 'Atendimento médico', classificacao: 'Classificação de risco', medicacao: 'Medicação administrada',
  registro: 'Lançado', aih: 'AIH (principal)', lancamento: 'Lançado (especial)',
}

/** Real com vírgula, para o valor de referência do SIGTAP. */
export const reais = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const ETAPA: Record<EtapaConta, string> = {
  aberta: 'aberta', em_conferencia: 'em conferência', fechada: 'fechada', faturada: 'faturada',
}
export const TIPO: Record<TipoConta, string> = { ambulatorial: 'Porta (BPA)', internacao: 'Internação (AIH)' }
export const PAGADOR: Record<Pagador, string> = { sus: 'SUS', convenio: 'Convênio', particular: 'Particular' }
export const EVENTO: Record<string, string> = {
  aberta: 'Conta aberta', conferencia: 'Em conferência', devolvida: 'Voltou a aberta', fechada: 'Fechada',
  faturada: 'Faturada', reaberta: 'Reaberta pelo gestor', pagador: 'Pagador trocado',
  lancamento: 'Procedimento lançado', retirada: 'Procedimento retirado',
  medicamento_fora: 'Medicamento fora da conta', medicamento_volta: 'Medicamento voltou à conta',
}

export type AcaoConta = { para: EtapaConta; rotulo: string; pedeMotivo: boolean; bloqueio?: string }

/** Ações da etapa atual para quem está vendo (4a/5a): faturamento conduz, gestor reabre. */
export function acoesDaConta(c: Pick<ContaDetalhe, 'status' | 'tipo' | 'atendimento_terminou' | 'pode_conduzir' | 'pode_reabrir'>): AcaoConta[] {
  const a: AcaoConta[] = []
  if (c.pode_conduzir) {
    if (c.status === 'aberta') a.push({ para: 'em_conferencia', rotulo: 'Iniciar conferência', pedeMotivo: false })
    if (c.status === 'em_conferencia') {
      a.push({
        para: 'fechada', rotulo: 'Fechar conta', pedeMotivo: false,
        bloqueio: c.atendimento_terminou ? undefined
          : c.tipo === 'ambulatorial' ? 'O atendimento ainda não terminou.' : 'A internação ainda não teve alta.',
      })
      a.push({ para: 'aberta', rotulo: 'Voltar a aberta', pedeMotivo: true })
    }
    if (c.status === 'fechada') a.push({ para: 'faturada', rotulo: 'Marcar como faturada', pedeMotivo: false })
  }
  if (c.pode_reabrir && (c.status === 'fechada' || c.status === 'faturada')) a.push({ para: 'aberta', rotulo: 'Reabrir', pedeMotivo: true })
  return a
}
