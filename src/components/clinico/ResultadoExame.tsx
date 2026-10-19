// Resultado de um exame (Fase 5C, tarefa 1, etapa 1.2; decisões do RT de
// 19/10/2026). Mostra a versão vigente, com os analitos como o laboratório
// mandou (o sistema não interpreta nem marca nada; o crítico vem do
// laboratório), o laudo em PDF e o histórico de versões. Aqui também: marcar a
// coleta (enfermagem), registrar o resultado à mão com laudo opcional, retificar
// com motivo e dar ciência (médico). Abrir o resultado tira a marca de "novo".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { fmtDataHora } from '@/lib/datas'
import { caminhoLaudo, erroLaudo, PENDENTE, SITUACAO_EXAME, type ExameDetalhe, type VersaoResultado } from '@/lib/exames'
import { supabase } from '@/lib/supabase'

const MINIMO_MOTIVO = 10

export function ResultadoExame({ exameId, aoMudar }: { exameId: string; aoMudar?: () => void }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [registrando, setRegistrando] = React.useState<'novo' | 'retificar' | null>(null)
  const [historico, setHistorico] = React.useState(false)
  const detalhe = useQuery({
    queryKey: ['exame-detalhe', exameId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exame_detalhe', { p_exame: exameId })
      if (error) throw error
      return data as unknown as ExameDetalhe
    },
  })
  const d = detalhe.data
  const recarregar = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['exame-detalhe', exameId] })
    aoMudar?.()
  }, [qc, exameId, aoMudar])

  // 5a: abrir o resultado tira a marca de "novo"
  const visto = React.useRef(false)
  React.useEffect(() => {
    if (!d || visto.current || d.situacao !== 'resultado' || d.visto_em) return
    visto.current = true
    void supabase.rpc('marcar_resultado_visto', { p_exame: exameId }).then(({ error }) => { if (!error) aoMudar?.() })
  }, [d, exameId, aoMudar])

  const [link, setLink] = React.useState('')
  const [editandoLink, setEditandoLink] = React.useState(false)
  const realizar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_exame_realizado', { p_exame: exameId, p_imagem_url: link.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { setLink(''); setEditandoLink(false); recarregar() },
    onError: (e) => setErro((e as Error).message),
  })
  const salvarLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_link_imagem', { p_exame: exameId, p_url: link.trim() })
      if (error) throw error
    },
    onSuccess: () => { setLink(''); setEditandoLink(false); recarregar() },
    onError: (e) => setErro((e as Error).message),
  })
  const coletar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_exame_coletado', { p_exame: exameId })
      if (error) throw error
    },
    onSuccess: recarregar,
    onError: (e) => setErro((e as Error).message),
  })
  const ciencia = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('dar_ciencia_resultado', { p_exame: exameId })
      if (error) throw error
    },
    onSuccess: recarregar,
    onError: (e) => setErro((e as Error).message),
  })

  if (detalhe.isLoading) return <Spinner />
  if (detalhe.error) return <p className="text-apoio text-critico">{(detalhe.error as Error).message}</p>
  if (!d) return null
  const vigente = d.versoes.find((v) => v.vigente)
  const antigas = d.versoes.filter((v) => !v.vigente)
  const pendente = PENDENTE.includes(d.situacao)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fio bg-superficie p-3 text-apoio">
      <span className="text-rotulo text-tinta-sussurro">
        {SITUACAO_EXAME[d.situacao]} · pedido {fmtDataHora(d.pedido_em)}{d.pedido_por ? ` por ${d.pedido_por}` : ''}
        {d.coletado_em ? ` · coletado ${fmtDataHora(d.coletado_em)}${d.coletado_por ? ` por ${d.coletado_por}` : ''}` : ''}
        {d.em_analise_em ? ` · em análise desde ${fmtDataHora(d.em_analise_em)}` : ''}
        {d.realizado_em ? ` · realizado ${fmtDataHora(d.realizado_em)}${d.realizado_por ? ` por ${d.realizado_por}` : ''}` : ''}
      </span>
      {/* 5C-2, 3a: a imagem fica no PACS; aqui só o link para o visualizador */}
      {d.imagem_url && (
        <a href={d.imagem_url} target="_blank" rel="noopener noreferrer" className="self-start text-apoio font-medium text-acao underline">
          Ver imagem no PACS
        </a>
      )}
      {erro && <p role="alert" className="text-critico">{erro}</p>}

      {vigente && <Versao v={vigente} />}

      {vigente && d.pode_dar_ciencia && (
        d.ja_ciente
          ? <span className="text-rotulo text-conforme">Você deu ciência deste resultado.</span>
          : <Button size="sm" variant={vigente.critico ? 'destructive' : 'outline'} className="self-start" disabled={ciencia.isPending}
              onClick={() => ciencia.mutate()}>Ciente do resultado</Button>
      )}

      {antigas.length > 0 && (
        <button type="button" className="self-start text-rotulo text-acao underline" onClick={() => setHistorico(!historico)}>
          {historico ? 'Esconder versões anteriores' : `Versões anteriores (${antigas.length})`}
        </button>
      )}
      {historico && antigas.map((v) => <Versao key={v.id} v={v} />)}

      <div className="flex flex-wrap gap-2">
        {d.pode_coletar && <Button size="sm" variant="outline" disabled={coletar.isPending} onClick={() => coletar.mutate()}>Coletado</Button>}
        {d.pode_realizar && !editandoLink && <Button size="sm" variant="outline" onClick={() => { setEditandoLink(true); setLink('') }}>Realizado</Button>}
        {d.tipo === 'imagem' && d.pode_registrar && d.situacao !== 'pedido' && d.situacao !== 'cancelado' && !editandoLink && (
          <Button size="sm" variant="ghost" onClick={() => { setEditandoLink(true); setLink(d.imagem_url ?? '') }}>{d.imagem_url ? 'Trocar link da imagem' : 'Link da imagem'}</Button>
        )}
        {d.pode_registrar && pendente && !registrando && <Button size="sm" variant="outline" onClick={() => setRegistrando('novo')}>Registrar resultado</Button>}
        {d.pode_registrar && d.situacao === 'resultado' && !registrando && (
          <Button size="sm" variant="ghost" onClick={() => setRegistrando('retificar')}>Retificar</Button>
        )}
      </div>
      {editandoLink && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-fio p-2.5">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-rotulo text-tinta-apoio">
            Link da imagem no visualizador do PACS (https://){d.situacao === 'pedido' ? ' — opcional' : ''}
            <input className="h-8 rounded-controle border border-fio bg-campo px-2 text-apoio" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
          <Button size="sm" variant="ghost" onClick={() => setEditandoLink(false)}>Voltar</Button>
          {d.situacao === 'pedido'
            ? <Button size="sm" disabled={realizar.isPending} onClick={() => realizar.mutate()}>Marcar realizado</Button>
            : <Button size="sm" disabled={!link.trim().startsWith('https://') || salvarLink.isPending} onClick={() => salvarLink.mutate()}>Salvar link</Button>}
        </div>
      )}
      {registrando && (
        <RegistrarResultado exameId={exameId} aceitaFoto={d.tipo === 'imagem'} retificar={registrando === 'retificar'}
          aoFechar={() => setRegistrando(null)} aoGravar={() => { setRegistrando(null); recarregar() }} />
      )}
    </div>
  )
}

function Versao({ v }: { v: VersaoResultado }) {
  const [erro, setErro] = React.useState<string | null>(null)
  const abrirLaudo = async () => {
    setErro(null)
    const { data, error } = await supabase.rpc('exame_laudo_abrir', { p_resultado: v.id })
    if (error) return setErro(error.message)
    const r = data as unknown as { caminho: string }
    const url = await supabase.storage.from('exames').createSignedUrl(r.caminho, 60)
    if (url.error) return setErro(url.error.message)
    window.open(url.data.signedUrl, '_blank', 'noopener')
  }
  return (
    <div className={`flex flex-col gap-1.5 rounded-md border px-2.5 py-2 ${v.critico ? 'border-critico/50 bg-critico/[0.04]' : 'border-trilha'}${v.vigente ? '' : ' opacity-75'}`}>
      <span className="flex flex-wrap items-center gap-1.5 text-rotulo text-tinta-sussurro">
        <span className="font-medium text-tinta">Versão {v.versao}</span>
        <Badge variant={v.origem === 'laboratorio' ? 'info' : 'secondary'}>{v.origem === 'laboratorio' ? 'laboratório' : 'manual'}</Badge>
        {v.critico && <Badge variant="destructive">crítico (laboratório)</Badge>}
        {!v.vigente && <Badge variant="outline">retificada</Badge>}
        <span>liberado {fmtDataHora(v.liberado_em)}{v.registrado_por ? ` · ${v.registrado_por}` : ''}</span>
      </span>
      {v.itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-apoio">
            <thead className="text-left text-rotulo text-tinta-sussurro">
              <tr><th className="py-1 pr-2 font-medium">Analito</th><th className="py-1 pr-2 font-medium">Resultado</th>
                <th className="py-1 pr-2 font-medium">Referência</th><th className="py-1 font-medium">Marca</th></tr>
            </thead>
            <tbody>
              {v.itens.map((i, k) => (
                <tr key={k} className={`border-t border-trilha ${i.critico ? 'font-semibold text-critico' : ''}`}>
                  <td className="py-1 pr-2">{i.analito}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{i.valor ?? '—'}{i.unidade ? ` ${i.unidade}` : ''}</td>
                  <td className="py-1 pr-2 text-tinta-apoio">{i.referencia ?? '—'}</td>
                  <td className="py-1">{i.marca ?? ''}{i.critico ? ' · crítico' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {v.texto && <p className="whitespace-pre-wrap text-tinta">{v.texto}</p>}
      {v.tem_pdf && (
        <Button size="xs" variant="outline" className="self-start" onClick={() => void abrirLaudo()}>
          <FileText /> {/\.(jpe?g|png)$/i.test(v.pdf_nome ?? '') ? 'Traçado / imagem' : 'Laudo em PDF'}{v.pdf_nome ? ` (${v.pdf_nome})` : ''}
        </Button>
      )}
      {v.cientes.length > 0 && <span className="text-rotulo text-tinta-sussurro">Ciente: {v.cientes.map((c) => `${c.por} (${fmtDataHora(c.em)})`).join(', ')}</span>}
      {!v.vigente && v.motivo_retificacao && <span className="text-rotulo text-tinta-sussurro">Retificada em {fmtDataHora(v.retificado_em!)}: “{v.motivo_retificacao}”</span>}
      {erro && <p role="alert" className="text-critico">{erro}</p>}
    </div>
  )
}

function RegistrarResultado({ exameId, retificar, aceitaFoto, aoFechar, aoGravar }: {
  exameId: string; retificar: boolean; aceitaFoto: boolean; aoFechar: () => void; aoGravar: () => void
}) {
  const [texto, setTexto] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [gravando, setGravando] = React.useState(false)
  const gravar = async () => {
    setErro(null)
    if (arquivo) { const p = erroLaudo(arquivo, aceitaFoto); if (p) return setErro(p) }
    setGravando(true)
    try {
      let caminho: string | undefined
      if (arquivo) {
        caminho = caminhoLaudo(exameId, arquivo.name, Date.now())
        const up = await supabase.storage.from('exames').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
        if (up.error) throw up.error
      }
      const { error } = await supabase.rpc('registrar_resultado_exame', {
        p_exame: exameId, p_texto: texto.trim() || undefined, p_pdf_caminho: caminho, p_pdf_nome: arquivo?.name,
        p_motivo_retificacao: retificar ? motivo.trim() : undefined,
      })
      if (error) throw error
      aoGravar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setGravando(false)
    }
  }
  const pronto = (texto.trim().length > 0 || !!arquivo) && (!retificar || motivo.trim().length >= MINIMO_MOTIVO)
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-fio p-2.5">
      <Label htmlFor={`res-texto-${exameId}`}>{retificar ? 'Retificar o resultado (fica como versão nova)' : 'Resultado (manual)'}</Label>
      <Textarea id={`res-texto-${exameId}`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Como veio do laboratório" />
      <label className="flex flex-wrap items-center gap-2 text-rotulo text-tinta-apoio">
        {aceitaFoto ? 'Laudo ou traçado em PDF, JPG ou PNG (opcional, até 10 MB)' : 'Laudo em PDF (opcional, até 10 MB)'}
        <input type="file" accept={aceitaFoto ? 'application/pdf,image/jpeg,image/png' : 'application/pdf'} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      {retificar && (
        <>
          <Label htmlFor={`res-motivo-${exameId}`}>Motivo da retificação</Label>
          <Textarea id={`res-motivo-${exameId}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </>
      )}
      {erro && <p role="alert" className="text-critico">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={aoFechar}>Voltar</Button>
        <Button size="sm" disabled={!pronto || gravando} onClick={() => void gravar()}>{retificar ? 'Retificar' : 'Registrar'}</Button>
      </div>
    </div>
  )
}
