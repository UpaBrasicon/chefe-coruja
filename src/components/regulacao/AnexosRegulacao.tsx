// ─────────────────────────────────────────────────────────────────────────────
// Anexos e laudos da regulação (Fase 4, tarefa 6; decisões do RT de 11/10/2026).
//
// • Arquivo PDF, JPG ou PNG (até 10 MB, 10 por pedido), ou documento já emitido
//   no prontuário do paciente.
// • Anexam a origem (solicitante, médico assistente, gestor) e o regulador da
//   central, com o pedido em aberto. Retirar pede motivo; o anexo fica guardado.
// • Abrir registra o acesso (regulacao_anexo_abrir), que libera a leitura do
//   arquivo por 2 min; o link gerado vale 60 s.
// Migration 20261112000001_anexos_regulacao.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, Paperclip } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fmtDataHora } from '@/lib/datas'
import { ANEXO_TIPOS, caminhoAnexo, erroArquivo } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

type Anexo = { id: string; tipo: 'arquivo' | 'documento'; nome: string; tamanho: number | null; enviado_em: string; enviado_por: string | null }
type Lista = { pode_anexar: boolean; anexos: Anexo[]; retirados: number }
type Documento = { id: string; tipo: string; numero: string | null; versao: number; emitido_em: string; autor: string | null }
type Aberto = { tipo: 'documento'; nome: string; conteudo: string; versao: number; emitido_em: string; autor: string | null }

const kb = (n: number | null) => (n == null ? '' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export function AnexosRegulacao({ solicitacaoId }: { solicitacaoId: string }) {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['regulacao-anexos', solicitacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_anexos', { p_solicitacao: solicitacaoId })
      if (error) throw error
      return data as unknown as Lista
    },
  })
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [escolherDoc, setEscolherDoc] = React.useState(false)
  const [aberto, setAberto] = React.useState<Aberto | null>(null)
  const [retirando, setRetirando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['regulacao-anexos', solicitacaoId] })
  const total = lista.data?.anexos.length ?? 0

  async function enviar(arquivo: File) {
    setErro(null)
    const problema = erroArquivo(arquivo, total)
    if (problema) return setErro(problema)
    setEnviando(true)
    try {
      const caminho = caminhoAnexo(solicitacaoId, arquivo.name, Date.now())
      const up = await supabase.storage.from('regulacao').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('regulacao_registrar_anexo', {
        p_solicitacao: solicitacaoId, p_caminho: caminho, p_nome: arquivo.name, p_tamanho: arquivo.size, p_tipo_mime: arquivo.type,
      })
      if (error) throw error
      recarregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function abrir(a: Anexo) {
    setErro(null)
    const { data, error } = await supabase.rpc('regulacao_anexo_abrir', { p_anexo: a.id })
    if (error) return setErro(error.message)
    const r = data as unknown as { tipo: 'arquivo'; caminho: string; nome: string } | Aberto
    if (r.tipo === 'documento') return setAberto(r)
    const url = await supabase.storage.from('regulacao').createSignedUrl(r.caminho, 60)
    if (url.error) return setErro(url.error.message)
    window.open(url.data.signedUrl, '_blank', 'noopener')
  }

  const retirar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_retirar_anexo', { p_anexo: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setRetirando(null); setMotivo(''); recarregar() },
  })

  if (lista.isLoading) return <Loader2 className="size-4 animate-spin text-tinta-sussurro" aria-label="Carregando anexos" />
  if (lista.error) return <p className="text-rotulo text-critico">{(lista.error as Error).message}</p>
  const l = lista.data!
  return (
    <div className="flex flex-col gap-2 rounded-md border border-fio bg-superficie p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-tinta"><Paperclip className="size-4" aria-hidden /> Anexos ({total}/10)</span>
        {l.retirados > 0 && <span className="text-rotulo text-tinta-sussurro">{l.retirados} retirado(s), guardado(s)</span>}
        {l.pode_anexar && total < 10 && (
          <>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-controle border border-fio px-2.5 py-1 text-apoio hover:bg-campo has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marca">
              <input type="file" accept={ANEXO_TIPOS.join(',')} className="sr-only" disabled={enviando}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void enviar(f) }} />
              {enviando ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Paperclip className="size-3.5" aria-hidden />}
              {enviando ? 'Enviando…' : 'Anexar arquivo (PDF, JPG, PNG)'}
            </label>
            <Button size="xs" variant="outline" onClick={() => setEscolherDoc(!escolherDoc)}>
              <FileText className="size-3.5" /> Do prontuário
            </Button>
          </>
        )}
      </div>
      {escolherDoc && <EscolherDocumento solicitacaoId={solicitacaoId} aoFim={() => { setEscolherDoc(false); recarregar() }} />}
      {l.anexos.length === 0 ? <span className="text-rotulo text-tinta-sussurro">Nenhum anexo.</span> : (
        <ul className="flex flex-col gap-1">
          {l.anexos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <button type="button" className="text-acao underline-offset-2 hover:underline" onClick={() => void abrir(a)}>
                {a.tipo === 'documento' ? '📄 ' : ''}{a.nome}
              </button>
              <span className="text-rotulo text-tinta-sussurro">{kb(a.tamanho)} · {a.enviado_por ?? '—'} · {fmtDataHora(a.enviado_em)}</span>
              {l.pode_anexar && retirando !== a.id && (
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => { setRetirando(a.id); setMotivo('') }}>Retirar</Button>
              )}
              {retirando === a.id && (
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Input aria-label="Motivo da retirada" className="h-7 w-56" placeholder="Motivo (mín. 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <Button size="xs" variant="destructive" disabled={retirar.isPending || motivo.trim().length < 10} onClick={() => retirar.mutate(a.id)}>Retirar</Button>
                  <Button size="xs" variant="ghost" onClick={() => setRetirando(null)}>Voltar</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {aberto && (
        <div className="rounded-md border border-fio bg-campo p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium text-tinta">{aberto.nome}</span>
            <span className="text-rotulo text-tinta-sussurro">{aberto.autor ?? '—'} · {fmtDataHora(aberto.emitido_em)}</span>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAberto(null)}>Fechar</Button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-apoio text-tinta">{aberto.conteudo}</pre>
        </div>
      )}
      <span className="text-rotulo text-tinta-sussurro">Abrir um anexo fica registrado no acesso ao prontuário.</span>
      {(erro || retirar.error) && <p role="alert" className="text-rotulo text-critico">{erro ?? (retirar.error as Error).message}</p>}
    </div>
  )
}

function EscolherDocumento({ solicitacaoId, aoFim }: { solicitacaoId: string; aoFim: () => void }) {
  const docs = useQuery({
    queryKey: ['regulacao-docs-anexaveis', solicitacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_documentos_anexaveis', { p_solicitacao: solicitacaoId })
      if (error) throw error
      return (data ?? []) as unknown as Documento[]
    },
  })
  const anexar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_anexar_documento', { p_solicitacao: solicitacaoId, p_documento: id })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  if (docs.isLoading) return <Loader2 className="size-4 animate-spin" aria-label="Carregando documentos" />
  return (
    <div className="flex flex-col gap-1 rounded-md border border-fio p-2">
      {(docs.data ?? []).length === 0 ? <span className="text-rotulo text-tinta-sussurro">Nenhum documento emitido no prontuário deste paciente.</span> : (
        docs.data!.map((d) => (
          <button key={d.id} type="button" className="flex flex-wrap items-center gap-2 rounded px-2 py-1 text-left hover:bg-campo"
            onClick={() => anexar.mutate(d.id)} disabled={anexar.isPending}>
            <span className="font-medium text-tinta">{d.tipo.replace(/_/g, ' ')}{d.numero ? ` nº ${d.numero}` : ''}</span>
            <span className="text-rotulo text-tinta-sussurro">versão {d.versao} · {d.autor ?? '—'} · {fmtDataHora(d.emitido_em)}</span>
          </button>
        ))
      )}
      {anexar.error && <p role="alert" className="text-rotulo text-critico">{(anexar.error as Error).message}</p>}
    </div>
  )
}
