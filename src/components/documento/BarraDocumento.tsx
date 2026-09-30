// Barra do documento (protótipo "Barra do Documento.dc.html"; index.html
// pepVals ~29882). Fica no alto de cada formulário de documento: estado,
// o que falta para emitir, ações e o histórico do episódio.
//
// Diferença do protótipo: "Fechar e assinar" vira "Emitir" (a emissão
// numerada da fase 4.1), porque a assinatura ICP-Brasil (etapa 4.8) espera a
// escolha do provedor. O estado "Assinado" aparece se o banco o tiver — é o
// gancho da 4.8 —, mas nada aqui assina.
//
// A barra NÃO emite nem limpa o formulário sozinha: quem a usa passa
// `aoEmitir` (a emissão que o formulário já faz), `aoNovo` (limpar) e
// `aoCopiar` (carregar o conteúdo copiado). Cancelar e copiar vão direto ao
// servidor. O estado vem do banco (documentos_do_paciente), então a barra
// enxerga também o que foi emitido em outro aparelho.
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Copy, FilePlus2, History, Printer, Send, X } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  cancelarDocumento, COR_ESTADO, copiarDocumento, type DocumentoEpisodio, estadoDoDocumento, type EstadoDocumento, hora,
  invalidarDocumentos, JUSTIFICATIVA_CANCELAR_DOCUMENTO, NOME_ESTADO, rotuloDocumento, TIPOS_CANCELAVEIS, TIPOS_COPIAVEIS,
  useDocumentosEpisodio,
} from './documentos'

export type BarraDocumentoProps = {
  pacienteId: string | null | undefined
  /** tipo_documento do banco (receita, atestado, encaminhamento, pedido_exames, laudo_aih…) */
  tipo: string
  rotulo?: string
  /** `salvoEm` do useRascunhoServidor: a barra recarrega quando o rascunho é salvo. */
  salvoEm?: Date | null
  /** Campos obrigatórios que faltam; com algum, "Emitir" fica travado e a barra diz o quê. */
  pendencias?: string[]
  /** A emissão que o formulário já faz (abrirImpressao com `documento`). Sem ela, não há botão Emitir. */
  aoEmitir?: () => void
  /** Imprimir sem emitir (rascunho sai com marca d'água, se a folha a tiver). */
  aoImprimir?: () => void
  /** Limpar o formulário para um documento novo em branco. */
  aoNovo?: () => void
  /** Carregar no formulário o conteúdo copiado (o rascunho novo já existe no banco). */
  aoCopiar?: (conteudo: string, rascunhoId: string) => void
  className?: string
}

function metaDe(d: DocumentoEpisodio): string {
  const autor = d.autor ?? '—'
  switch (estadoDoDocumento(d)) {
    case 'aberto': return `Aberto às ${hora(d.criado_em)} · ${autor} · salvo às ${hora(d.atualizado_em)}`
    case 'emitido': return `Emitido às ${hora(d.emitido_em ?? d.criado_em)} · ${autor}`
    case 'assinado': return `Assinado às ${hora(d.assinado_em)} · ${autor}`
    case 'retificado': return `Emitido às ${hora(d.emitido_em ?? d.criado_em)} · ${autor} · substituído por versão nova`
    case 'cancelado': return `Cancelado às ${hora(d.cancelado_em)} por ${d.cancelado_por ?? '—'} · “${d.motivo_cancelamento ?? ''}”`
  }
}

function tituloDe(d: DocumentoEpisodio): string {
  return rotuloDocumento(d.tipo) + (d.numero ? ` nº ${d.numero}` : '') + (d.versao > 1 ? ` · versão ${d.versao}` : '')
}

export function BarraDocumento({
  pacienteId, tipo, rotulo, salvoEm, pendencias = [], aoEmitir, aoImprimir, aoNovo, aoCopiar, className,
}: BarraDocumentoProps) {
  const qc = useQueryClient()
  const docs = useDocumentosEpisodio(pacienteId, salvoEm)
  const [histAberto, setHistAberto] = React.useState(false)
  const [pedindo, setPedindo] = React.useState(false)
  const [just, setJust] = React.useState('')
  const [ocupado, setOcupado] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  // 'Novo' clicado: vale para este paciente e este último emitido, até o rascunho chegar
  const [novoPara, setNovoPara] = React.useState<string | null>(null)

  const rot = rotulo ?? rotuloDocumento(tipo)
  const lista = React.useMemo(() => docs.data ?? [], [docs.data])
  const doTipo = lista.filter((d) => d.tipo === tipo)
  const rascunho = doTipo.find((d) => d.estado === 'rascunho' && d.meu) ?? null
  const ultimoEmitido = doTipo.find((d) => d.numero && d.estado !== 'retificado') ?? null

  const chaveNovo = `${pacienteId ?? ''}:${ultimoEmitido?.id ?? ''}`
  const emBranco = !rascunho && novoPara === chaveNovo

  const atual = rascunho ?? (emBranco ? null : ultimoEmitido)
  const estado: EstadoDocumento = atual ? estadoDoDocumento(atual) : 'aberto'
  const aberto = estado === 'aberto'
  const podeEmitir = aberto && pendencias.length === 0
  const podeCancelar = !!atual && (estado === 'emitido' || estado === 'assinado') && atual.meu && TIPOS_CANCELAVEIS.has(tipo)
  const podeCopiar = !rascunho && !!ultimoEmitido && TIPOS_COPIAVEIS.has(tipo)
  const justOk = just.trim().length >= JUSTIFICATIVA_CANCELAR_DOCUMENTO

  const texto = !pacienteId
    ? 'Escolha o paciente: o documento fica no prontuário dele.'
    : !atual
      ? 'Aberto · ainda não iniciado. O rascunho é salvo sozinho enquanto você escreve.'
      : estado === 'aberto'
        ? `Aberto · rascunho salvo às ${hora(atual.atualizado_em)}${atual.copia_de ? ' · cópia de documento anterior' : ''}. Só você vê.`
        : estado === 'emitido'
          ? `Emitido nº ${atual.numero} às ${hora(atual.emitido_em)} por ${atual.autor ?? '—'} · só leitura. Para corrigir, cancele e copie como novo.`
          : estado === 'assinado'
            ? `Assinado às ${hora(atual.assinado_em)} por ${atual.autor ?? '—'} · só leitura. Para corrigir, cancele e copie como novo.`
            : `Cancelado às ${hora(atual.cancelado_em)} · “${atual.motivo_cancelamento ?? ''}” · riscado no histórico.`

  async function executar(fn: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await fn()
      invalidarDocumentos(qc)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const cancelar = () => executar(async () => {
    if (!atual || !justOk) return
    await cancelarDocumento(atual.id, just)
    setPedindo(false)
    setJust('')
  })

  const copiar = () => executar(async () => {
    if (!ultimoEmitido) return
    const r = await copiarDocumento(ultimoEmitido.id)
    setNovoPara(null)
    aoCopiar?.(r.conteudo, r.id)
  })

  const novo = () => {
    setNovoPara(chaveNovo)
    setPedindo(false)
    aoNovo?.()
  }

  const bloqueio = pendencias.slice(0, 3).join(' · ') + (pendencias.length > 3 ? ` · e mais ${pendencias.length - 3}` : '')

  return (
    <section aria-label={`Documento: ${rot}`} className={cn('flex flex-col gap-2.5 rounded-cartao border border-fio bg-superficie px-4 py-3 shadow-repouso', className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant={COR_ESTADO[estado]}>{NOME_ESTADO[estado]}</Badge>
        <span className="min-w-0 flex-[1_1_240px] text-apoio text-pretty text-tinta-apoio">{texto}</span>
      </div>

      {aberto && pendencias.length > 0 && (
        <div className="flex items-start gap-2 rounded-controle bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Para emitir: {bloqueio}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {aoNovo && (
          <Button size="sm" variant="outline" disabled={!pacienteId || aberto || ocupado} onClick={novo}
            title={aberto ? 'Já existe um documento aberto deste tipo' : 'Novo documento em branco'}>
            <FilePlus2 /> Novo
          </Button>
        )}
        {TIPOS_COPIAVEIS.has(tipo) && (
          <Button size="sm" variant="outline" disabled={!podeCopiar || ocupado} onClick={() => void copiar()}
            title={rascunho ? 'Copiar só quando não houver rascunho aberto deste tipo' : 'Abre um rascunho novo com o conteúdo do último documento emitido'}>
            <Copy /> Copiar como novo
          </Button>
        )}
        {aoImprimir && (
          <Button size="sm" variant="outline" disabled={!pacienteId} onClick={aoImprimir}
            title={aberto ? 'Rascunho imprime com marca d’água' : 'Imprimir'}>
            <Printer /> Imprimir
          </Button>
        )}
        <Button size="sm" variant="outline" aria-expanded={histAberto} disabled={!pacienteId} onClick={() => setHistAberto((v) => !v)}>
          <History /> Histórico{lista.length ? ` (${lista.length})` : ''}
        </Button>
        {TIPOS_CANCELAVEIS.has(tipo) && (
          <Button size="sm" variant="destructive" disabled={!podeCancelar || pedindo || ocupado}
            className="border-critico/30 text-critico"
            title={podeCancelar ? 'Cancelar com justificativa' : 'Só o autor cancela documento emitido'}
            onClick={() => { setPedindo(true); setJust('') }}>
            <X /> Cancelar
          </Button>
        )}
        {aoEmitir && (
          <Button size="sm" disabled={!pacienteId || !podeEmitir || ocupado} onClick={aoEmitir}
            title={podeEmitir ? 'Emite com número definitivo e trava o documento' : aberto ? `Falta: ${pendencias.join(' · ')}` : `Documento ${NOME_ESTADO[estado].toLowerCase()}`}>
            <Send /> Emitir
          </Button>
        )}
      </div>

      {pedindo && atual && (
        <div className="flex flex-col gap-2 rounded-controle border border-critico/25 bg-alerta-critico p-3">
          <label htmlFor="cc-just-cancelar" className="text-apoio font-medium text-tinta">
            Justificativa do cancelamento · mínimo {JUSTIFICATIVA_CANCELAR_DOCUMENTO} caracteres
          </label>
          <Textarea id="cc-just-cancelar" value={just} onChange={(e) => setJust(e.target.value)} className="min-h-[64px] bg-superficie"
            placeholder="Ex.: receita lançada no paciente errado" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-[1_1_220px] text-apoio text-tinta-sussurro">
              O documento continua no prontuário, riscado, com a justificativa. Nada é apagado.
            </span>
            <Button size="sm" variant="ghost" onClick={() => { setPedindo(false); setJust('') }}>Desistir</Button>
            <Button size="sm" disabled={!justOk || ocupado} className="bg-critico hover:bg-critico/90" onClick={() => void cancelar()}>
              <X /> Confirmar cancelamento
            </Button>
          </div>
        </div>
      )}

      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}

      {histAberto && (
        <aside className="flex flex-col gap-1.5 rounded-controle border border-fio bg-campo p-3">
          <div className="flex items-center gap-2 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
            <History className="size-3.5" aria-hidden /> Histórico do episódio
            <span className="ml-auto font-normal tracking-normal normal-case">{lista.length} {lista.length === 1 ? 'documento' : 'documentos'}</span>
          </div>
          {docs.isLoading && <p className="text-apoio text-tinta-sussurro">Carregando…</p>}
          {docs.error && <p className="text-apoio text-critico">{(docs.error as Error).message}</p>}
          {!docs.isLoading && lista.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum documento neste episódio.</p>}
          {lista.map((d) => {
            const e = estadoDoDocumento(d)
            return (
              <div key={d.id} className="flex flex-col gap-0.5 border-b border-fio py-1.5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 text-apoio font-semibold', e === 'cancelado' ? 'text-tinta-sussurro line-through' : 'text-tinta')}>
                    {tituloDe(d)}
                  </span>
                  <Badge variant={COR_ESTADO[e]}>{NOME_ESTADO[e]}</Badge>
                </div>
                <span className="text-rotulo text-tinta-sussurro">{metaDe(d)}</span>
              </div>
            )
          })}
          <p className="pt-1 text-rotulo text-tinta-sussurro">
            Emitido não se edita: cancele com justificativa e copie como novo. O histórico é do episódio, de todos os profissionais.
          </p>
        </aside>
      )}
    </section>
  )
}

/**
 * Marca d'água de rascunho na TELA (sobre a pré-visualização do documento).
 * Para a folha impressa, ver MARCA_DAGUA_RASCUNHO_CSS em ./documentos.
 */
export function MarcaDaguaRascunho({ ativo, children, className }: { ativo: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {ativo && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
          <span className="-rotate-[24deg] text-[clamp(28px,6vw,56px)] font-black tracking-[0.04em] whitespace-nowrap text-tinta/10 select-none">
            RASCUNHO – NÃO VÁLIDO
          </span>
        </div>
      )}
    </div>
  )
}
