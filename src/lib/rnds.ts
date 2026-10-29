// Regras da aba "RNDS" em Integrações (Fase 5C, tarefa 5, etapa 5.4c; opção A
// do RT: estado no topo, depois credencial, envio, bloqueios e fila). Os dados
// vêm de public.rnds_painel e public.rnds_itens (migration 20270206000001).

export type SituacaoCertificado =
  | 'sem_certificado' | 'aguardando' | 'valido' | 'senha_incorreta' | 'invalido' | 'vencido' | 'chave_trocada'
export type StatusItem = 'pendente' | 'retido' | 'erro' | 'enviado'
export type TipoDocumento = 'rac' | 'sumario_alta' | 'regulacao'

export type BloqueioRnds = { id: string; profissional: string | null; codigo: string; mensagem: string | null; bloqueado_em: string }

export type PainelRnds = {
  pode_producao: boolean
  config: {
    financiamento: string | null; envio_ligado: boolean
    pausado_em: string | null; pausa_motivo: string | null; atualizado_em: string | null
  } | null
  credencial: {
    id: string; nome: string; ambiente: 'homologacao' | 'producao'; identificador_solicitante: string | null
    unidade_principal_id: string
    unidades: { id: string; nome: string; cnes: string | null }[]
    certificado: {
      situacao: SituacaoCertificado; titular: string | null; documento: string | null; valido_ate: string | null
      enviado_em: string | null; lido_em: string | null; erro: string | null
    }
  } | null
  contagem: Partial<Record<StatusItem, number>>
  bloqueios: BloqueioRnds[]
}

export type ItemRnds = {
  id: string; tipo: TipoDocumento; referencia_id: string; status: StatusItem; tentativas: number
  ultimo_erro: string | null; criado_em: string; enviado_em: string | null; proxima_tentativa_em: string | null
  id_rnds: string | null
}

export const ROTULO_CERTIFICADO: Record<SituacaoCertificado, string> = {
  sem_certificado: 'Sem certificado',
  aguardando: 'Aguardando leitura',
  valido: 'Válido',
  senha_incorreta: 'Senha incorreta',
  invalido: 'Ilegível',
  vencido: 'Vencido',
  chave_trocada: 'Enviar de novo',
}
export const VARIANTE_CERTIFICADO: Record<SituacaoCertificado, 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  sem_certificado: 'secondary', aguardando: 'info', valido: 'success', senha_incorreta: 'destructive',
  invalido: 'destructive', vencido: 'destructive', chave_trocada: 'warning',
}

export const ROTULO_STATUS: Record<StatusItem, string> = { pendente: 'Na fila', retido: 'Retido', erro: 'Com erro', enviado: 'Enviado' }
export const VARIANTE_STATUS: Record<StatusItem, 'secondary' | 'warning' | 'destructive' | 'success'> = {
  pendente: 'secondary', retido: 'warning', erro: 'destructive', enviado: 'success',
}
export const ROTULO_TIPO: Record<TipoDocumento, string> = {
  rac: 'Atendimento (RAC)', sumario_alta: 'Sumário de alta', regulacao: 'Regulação',
}

/**
 * BRFinanciamento (01–08, o que o banco aceita). Só 01 e 07 têm o nome
 * conferido (docs/rnds); os outros aparecem pelo código até a conferência com a
 * tabela oficial, sem nome inventado.
 */
export const FINANCIAMENTOS: { codigo: string; rotulo: string }[] = [
  { codigo: '07', rotulo: '07 — SUS municipal' },
  { codigo: '01', rotulo: '01 — SUS federal' },
  ...['02', '03', '04', '05', '06', '08'].map((codigo) => ({ codigo, rotulo: `${codigo} — código da tabela BRFinanciamento` })),
]

const DIA_MS = 86_400_000

/** Dias inteiros até a data (negativo se já passou). */
export function diasAte(iso: string, agora: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - agora) / DIA_MS)
}

export type AcaoAlerta = 'retomar' | 'certificado' | 'credencial' | 'bloqueios'
export type AlertaRnds = { tom: 'critico' | 'atencao' | 'informacao' | 'marca'; titulo: string; texto: string; acao?: AcaoAlerta }

const MOTIVO_CERTIFICADO: Partial<Record<SituacaoCertificado, string>> = {
  senha_incorreta: 'A senha informada não abre o certificado.',
  invalido: 'O serviço não conseguiu ler o arquivo. Confira se é o .pfx do certificado A1.',
  vencido: 'O certificado venceu e o envio parou.',
  chave_trocada: 'A chave do serviço da RNDS mudou e o certificado precisa ser enviado de novo.',
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** O que pede ação, do mais grave ao mais leve: a faixa do topo da aba. */
export function alertas(p: PainelRnds, agora: number = Date.now()): AlertaRnds[] {
  const lista: AlertaRnds[] = []
  if (!p.credencial) {
    lista.push({ tom: 'marca', titulo: 'A unidade ainda não envia à RNDS', texto: 'Monte a credencial com o identificador do solicitante e envie o certificado A1.', acao: 'credencial' })
    return lista
  }
  if (p.config?.pausado_em) {
    lista.push({ tom: 'critico', titulo: 'Envio pausado', texto: maiuscula(p.config.pausa_motivo ?? 'a RNDS recusou a credencial.'), acao: 'retomar' })
  }
  const c = p.credencial.certificado
  const motivo = MOTIVO_CERTIFICADO[c.situacao]
  if (motivo) {
    lista.push({ tom: c.situacao === 'chave_trocada' ? 'atencao' : 'critico', titulo: `Certificado: ${ROTULO_CERTIFICADO[c.situacao].toLowerCase()}`, texto: motivo, acao: 'certificado' })
  } else if (c.situacao === 'sem_certificado') {
    lista.push({ tom: 'marca', titulo: 'Falta o certificado', texto: 'Envie o certificado A1 (.pfx) da credencial.', acao: 'certificado' })
  } else if (c.situacao === 'valido' && c.valido_ate) {
    const dias = diasAte(c.valido_ate, agora)
    if (dias <= 30) {
      lista.push({ tom: 'atencao', titulo: `Certificado vence em ${dias === 1 ? '1 dia' : `${dias} dias`}`, texto: 'Envie o certificado renovado antes do vencimento, ou o envio para.', acao: 'certificado' })
    }
  } else if (c.situacao === 'aguardando') {
    lista.push({ tom: 'informacao', titulo: 'Certificado em leitura', texto: 'O serviço da RNDS abre o certificado em até 1 minuto. A situação aparece aqui.' })
  }
  if (p.bloqueios.length > 0) {
    const n = p.bloqueios.length
    lista.push({ tom: 'atencao', titulo: n === 1 ? '1 profissional bloqueado pela RNDS' : `${n} profissionais bloqueados pela RNDS`,
      texto: 'Os documentos deles ficam retidos. Acerte o cadastro no CNES e tire o bloqueio.', acao: 'bloqueios' })
  }
  if (p.config && !p.config.envio_ligado && !p.config.pausado_em) {
    lista.push({ tom: 'informacao', titulo: 'Envio desligado', texto: 'Escolha o financiamento e ligue o envio quando a credencial estiver pronta.' })
  }
  return lista
}

/** CNPJ (14) ou CPF (11) com a máscara; o resto como veio. */
export function formatarDocumento(d: string | null): string {
  if (!d) return '—'
  if (/^\d{14}$/.test(d)) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (/^\d{11}$/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return d
}

/** O motivo do item sem o prefixo técnico "retido: ". */
export function motivoDoItem(i: ItemRnds): string | null {
  if (!i.ultimo_erro) return null
  return maiuscula(i.ultimo_erro.replace(/^retido: /, ''))
}

/** Erro volta à fila ("Reenviar"); retido tenta agora ("Tentar agora"). */
export function acaoDoItem(i: ItemRnds): { rotulo: string } | null {
  if (i.status === 'erro') return { rotulo: 'Reenviar' }
  if (i.status === 'retido') return { rotulo: 'Tentar agora' }
  return null
}

/** O .pfx de um A1 tem poucos KB; o banco aceita o cifrado até 200 mil caracteres. */
export const PFX_MAX_BYTES = 100_000

export function conferirArquivo(f: { name: string; size: number }): string | null {
  if (!/\.(pfx|p12)$/i.test(f.name)) return 'Escolha o arquivo .pfx (ou .p12) do certificado A1.'
  if (f.size === 0) return 'O arquivo está vazio.'
  if (f.size > PFX_MAX_BYTES) return 'O arquivo é grande demais para um certificado A1.'
  return null
}
