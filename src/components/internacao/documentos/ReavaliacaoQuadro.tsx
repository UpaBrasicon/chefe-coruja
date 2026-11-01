// Reavaliação do quadro (ponto 10 do plantonista, modelo B do RT em
// 31/10/2026): mudança importante do quadro (ex.: entrou por pneumonia,
// evoluiu com AVC), com o que mudou, história, exame, hipótese e plano. Fica
// ligada à admissão, que não muda; a aba Admissão mostra a original e as
// reavaliações em ordem. Gravada por registrar_reavaliacao_quadro (só o
// médico com o paciente, internação aberta); lida por reavaliacoes_do_quadro.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, RefreshCcw } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { diaHora, invalidarDocumentos } from '@/components/documento/documentos'
import { BuscaCid } from '@/components/documentos/busca'
import { Cartao, Leitura, Texto } from '@/components/documentos/ui'
import { dadosReavaliacao, type FormReavaliacao, pendenciasReavaliacao, REAVALIACAO_VAZIA, textoReavaliacao } from '@/lib/admissaoReavaliacao'
import { folhaDoDocumentoEmitido, imprimirDocumento } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

type Reavaliacao = FormReavaliacao & { documento_id: string; criado_em: string; numero: string | null; estado: string; autor: string | null }

export function ReavaliacoesQuadro({ internacaoId, pacienteId, prontuarioAberto, admissaoEm }: {
  internacaoId: string
  pacienteId: string
  prontuarioAberto: boolean
  /** Data e hora da admissão, para o texto ("ligada à admissão de …"). */
  admissaoEm: string | null
}) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [f, setF] = React.useState<FormReavaliacao>(REAVALIACAO_VAZIA)
  const [erro, setErro] = React.useState<string | null>(null)
  const [gravando, setGravando] = React.useState(false)
  const set = (p: Partial<FormReavaliacao>) => setF((x) => ({ ...x, ...p }))

  const lista = useQuery({
    queryKey: ['reavaliacoes-quadro', internacaoId],
    enabled: prontuarioAberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reavaliacoes_do_quadro', { p_internacao: internacaoId })
      if (error) throw error
      return (data ?? []) as unknown as Reavaliacao[]
    },
  })
  const pendencias = pendenciasReavaliacao(f)

  async function registrar() {
    if (pendencias.length) return
    setErro(null)
    const janela = window.open('', '_blank')
    if (!janela) return setErro('O navegador bloqueou a janela de impressão. Libere pop-ups e tente de novo.')
    const escrever = (html: string) => { janela.document.open(); janela.document.write(html); janela.document.close() }
    const falha = (m: string) => { escrever(`<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">${m}</p>`); setErro(m) } // padrao-ok: mensagem escrita na janela de impressão, que não lê os tokens do app
    escrever('<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando a reavaliação…</p>') // padrao-ok: mensagem escrita na janela de impressão, que não lê os tokens do app
    setGravando(true)
    try {
      const { data, error } = await supabase.rpc('registrar_reavaliacao_quadro', {
        p_internacao: internacaoId, p_conteudo: textoReavaliacao(f, admissaoEm), p_dados: dadosReavaliacao(f) as unknown as Json,
      })
      if (error) return falha(`Não foi possível registrar a reavaliação: ${error.message}. Nada foi impresso.`)
      setF(REAVALIACAO_VAZIA)
      setAberto(false)
      invalidarDocumentos(qc)
      void qc.invalidateQueries({ queryKey: ['documentos-clinicos', pacienteId] })
      void qc.invalidateQueries({ queryKey: ['reavaliacoes-quadro', internacaoId] })
      const r = await folhaDoDocumentoEmitido(data as string, 'Reavaliação do quadro')
      if ('erro' in r) return falha(`A reavaliação foi registrada, mas a folha não pôde ser montada${r.erro ? `: ${r.erro}` : ''}. Reimprima por aqui.`)
      escrever(r.html)
      janela.focus()
      setTimeout(() => janela.print(), 300)
    } finally {
      setGravando(false)
    }
  }

  const reavs = lista.data ?? []
  return (
    <>
      {reavs.map((r, n) => (
        <Cartao key={r.documento_id} icone={<RefreshCcw />} titulo={<>Reavaliação do quadro {n + 1}
          <span className="ml-1.5 text-apoio font-normal text-tinta-sussurro">{diaHora(r.criado_em)} · {r.autor ?? '—'}{r.numero ? ` · nº ${r.numero}` : ''}</span></>}
          acoes={<Button size="sm" variant="outline" onClick={() => void imprimirDocumento(r.documento_id, 'Reavaliação do quadro · reimpressão')}><Printer /> Reimprimir</Button>}>
          <div className="flex flex-wrap gap-3">
            <Leitura rotulo="O que mudou no quadro" valor={r.motivo} largura="cheio" />
            <Leitura rotulo="Hipótese diagnóstica" valor={r.cid} largura="cheio" />
            <Leitura rotulo="História" valor={r.subjetivo} largura="cheio" />
            <Leitura rotulo="Exame" valor={r.objetivo} largura="cheio" />
            <Leitura rotulo="Plano" valor={r.plano} largura="cheio" />
          </div>
        </Cartao>
      ))}

      {!aberto ? (
        <div>
          <Button size="sm" variant="outline" onClick={() => setAberto(true)}><RefreshCcw /> Reavaliação do quadro</Button>
          <p className="mt-1 text-rotulo text-tinta-sussurro">Para mudança importante do quadro. A admissão não muda; erro de registro se corrige em "Corrigir".</p>
        </div>
      ) : (
        <Cartao icone={<RefreshCcw />} titulo={<>Reavaliação do quadro <span className="ml-1.5 text-apoio font-normal text-tinta-sussurro">Ligada à admissão{admissaoEm ? ` de ${admissaoEm}` : ''}</span></>}>
          <div className="flex flex-wrap gap-3">
            <Texto id="reav-motivo" rotulo="O que mudou no quadro" longo linhas={3} dica="Ex.: entrou por pneumonia, evoluiu com déficit motor às 10h"
              valor={f.motivo} onChange={(x) => set({ motivo: x })} />
            <Texto id="reav-subjetivo" rotulo="História" longo linhas={5} valor={f.subjetivo} onChange={(x) => set({ subjetivo: x })} />
            <Texto id="reav-objetivo" rotulo="Exame" longo linhas={5} valor={f.objetivo} onChange={(x) => set({ objetivo: x })} />
            <BuscaCid id="reav-cid" rotulo="Hipótese diagnóstica" valor={f.cid} confirmado={f.cidOk}
              onDigitar={(x) => set({ cid: x, cidOk: false })} onEscolher={(c, nome) => set({ cid: `${c} — ${nome}`, cidOk: true })} />
            <Texto id="reav-plano" rotulo="Plano" longo linhas={4} valor={f.plano} onChange={(x) => set({ plano: x })} />
          </div>
          {pendencias.length > 0 && <p className="text-apoio text-tinta-sussurro">Falta preencher: {pendencias.join(', ')}.</p>}
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAberto(false); setErro(null) }}>Cancelar</Button>
            <Button disabled={pendencias.length > 0 || gravando} onClick={() => void registrar()}>
              <Printer /> {gravando ? 'Registrando…' : 'Registrar e imprimir'}
            </Button>
          </div>
        </Cartao>
      )}
    </>
  )
}
