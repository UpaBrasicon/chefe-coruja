// Estados do documento (protótipo: "Barra do Documento" e Bloco 1 item 1).
//
// Protótipo: Aberto → Assinado → Cancelado. No app, enquanto a assinatura
// ICP-Brasil (etapa 4.8) espera a escolha do provedor:
//   aberto    = rascunho no banco (fase 4.1), só o autor vê e edita
//   emitido   = emissão numerada (estado 'ativo'): vale como registro, só leitura
//   assinado  = GANCHO da 4.8: o banco aceita o estado, nada no app o grava
//   cancelado = emitido e depois cancelado com justificativa (15+ letras);
//               continua no prontuário, riscado. Nada se apaga.
//   retificado = versão substituída por uma retificação do autor
// Corrigir documento emitido: cancelar e "Copiar como novo" (ou retificar).
import { useQuery, type QueryClient } from '@tanstack/react-query'

import { TIPOS_FOLHA } from '@/lib/folhas'
import { supabase } from '@/lib/supabase'

export type EstadoDocumento = 'aberto' | 'emitido' | 'assinado' | 'cancelado' | 'retificado'

/** Linha de public.documentos_do_paciente. */
export type DocumentoEpisodio = {
  id: string
  raiz_id: string
  versao: number
  tipo: string
  estado: 'rascunho' | 'ativo' | 'assinado' | 'cancelado' | 'retificado'
  numero: string | null
  episodio_id: string | null
  internacao_id: string | null
  episodio_chegada: string | null
  autor_id: string
  autor: string | null
  meu: boolean
  criado_em: string
  atualizado_em: string
  emitido_em: string | null
  cancelado_em: string | null
  cancelado_por: string | null
  motivo_cancelamento: string | null
  retificacao_de: string | null
  motivo_retificacao: string | null
  copia_de: string | null
  assinado_em: string | null
  conteudo: string | null
}

export const ROTULO_DOCUMENTO: Record<string, string> = {
  admissao_anamnese: 'Admissão e anamnese', evolucao: 'Evolução', prescricao: 'Prescrição', sumario_alta: 'Sumário de alta',
  sumario_obito: 'Sumário de óbito', atestado: 'Atestado', termo_consentimento: 'Termo de consentimento',
  boletim_emergencia: 'Boletim de emergência', partograma: 'Partograma', teleinterconsulta: 'Teleinterconsulta',
  receita: 'Receita', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames', laudo_aih: 'Laudo de AIH',
  parecer: 'Parecer', evolucao_enfermagem: 'Evolução de enfermagem', anotacao_enfermagem: 'Anotação de enfermagem',
  evolucao_fisioterapia: 'Evolução de fisioterapia', evolucao_nutricao: 'Evolução de nutrição', evolucao_outros: 'Evolução multiprofissional',
}

export const rotuloDocumento = (tipo: string) => ROTULO_DOCUMENTO[tipo] ?? tipo.replace(/_/g, ' ')

/** Tipos que o servidor cancela por esta porta (os outros têm fluxo próprio). */
export const TIPOS_CANCELAVEIS = new Set(['atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'boletim_emergencia', 'admissao_anamnese'])
/** Tipos que viram rascunho ao copiar (os de public.salvar_rascunho). */
export const TIPOS_COPIAVEIS = new Set(['atestado', 'receita', 'encaminhamento', 'pedido_exames', 'laudo_aih', 'prescricao', 'sumario_alta', 'termo_consentimento', 'boletim_emergencia'])
/** Tipos com folha A4 no servidor (edge function `folha`): todos os de lib/folhas. */
export const TIPOS_COM_FOLHA = new Set<string>(TIPOS_FOLHA)

export const JUSTIFICATIVA_CANCELAR_DOCUMENTO = 15

export function estadoDoDocumento(d: Pick<DocumentoEpisodio, 'estado'>): EstadoDocumento {
  switch (d.estado) {
    case 'rascunho': return 'aberto'
    case 'ativo': return 'emitido'
    default: return d.estado
  }
}

export const NOME_ESTADO: Record<EstadoDocumento, string> = {
  aberto: 'Aberto', emitido: 'Emitido', assinado: 'Assinado', cancelado: 'Cancelado', retificado: 'Retificado',
}
/** Variante do Badge para cada estado. */
export const COR_ESTADO: Record<EstadoDocumento, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  aberto: 'warning', emitido: 'success', assinado: 'success', cancelado: 'destructive', retificado: 'secondary',
}

export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
export const diaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

/** Histórico do episódio aberto (ou do último) do paciente, de todos os profissionais. */
export function useDocumentosEpisodio(pacienteId: string | null | undefined, sinal?: unknown) {
  return useQuery({
    queryKey: ['documentos-episodio', pacienteId, sinal instanceof Date ? sinal.getTime() : sinal ?? null],
    enabled: !!pacienteId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('documentos_do_paciente', { p_paciente: pacienteId! })
      if (error) throw error
      return (data ?? []) as unknown as DocumentoEpisodio[]
    },
  })
}

/** Depois de emitir, cancelar ou copiar: quem mostra documentos recarrega. */
export function invalidarDocumentos(qc: QueryClient) {
  for (const k of ['documentos-episodio', 'pendencias-pep', 'impressao-prontuario-docs', 'impeditivos', 'pendencias-saida', 'rascunhos-checkout']) {
    void qc.invalidateQueries({ queryKey: [k] })
  }
}

export async function cancelarDocumento(documentoId: string, motivo: string) {
  const { error } = await supabase.rpc('cancelar_documento', { p_documento: documentoId, p_motivo: motivo.trim() })
  if (error) throw new Error(error.message)
}

export async function copiarDocumento(documentoId: string): Promise<{ id: string; tipo: string; conteudo: string }> {
  const { data, error } = await supabase.rpc('copiar_documento', { p_documento: documentoId })
  if (error) throw new Error(error.message)
  return data as unknown as { id: string; tipo: string; conteudo: string }
}

/** A emissão numerada que já existe (fase 4.1), sem imprimir. */
export async function emitirRascunho(rascunhoId: string): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc('emitir_rascunho', { p_rascunho: rascunhoId })
  if (error) throw new Error(error.message)
  return data as unknown as { id: string; numero: string }
}

/**
 * Marca d'água do rascunho para a FOLHA impressa (protótipo: "RASCUNHO – NÃO
 * VÁLIDO"). CSS puro, para quem monta folha (lib/folhas) acrescentar no
 * <style> e pôr a classe `cc-rascunho` no <body>.
 */
export const MARCA_DAGUA_RASCUNHO_CSS =
  'body.cc-rascunho::after{content:"RASCUNHO – NÃO VÁLIDO";position:fixed;top:45%;left:0;right:0;text-align:center;' +
  'font:900 30pt system-ui,sans-serif;color:rgba(0,0,0,.1);transform:rotate(-24deg);pointer-events:none;z-index:9999}'
