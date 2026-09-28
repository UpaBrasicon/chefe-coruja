import { Fragment, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ExternalLink, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import type { Fonte, StatusIa, ToolHit } from '@/lib/useClinicalAsk'
import { cn } from '@/lib/utils'

// Painel da resposta da IA (guia §9.4): texto em streaming com [n] clicável,
// ferramentas sugeridas, lista de fontes, estados de bloqueio/erro, feedback
// 👍/👎 e o aviso fixo de responsabilidade.

export const AVISO_RESPONSABILIDADE = 'Suporte à decisão baseado nas fontes citadas. A conduta é responsabilidade do médico assistente.'

type Props = {
  pergunta: string
  texto: string
  fontes: Fonte[]
  ferramentas: ToolHit[]
  status: StatusIa
  alerta: string | null
  requestId: string | null
  onFechar: () => void
}

/** Renderiza a linha com **negrito** e [n] como chip que rola até a fonte. */
function linha(t: string, chave: string, chip: (n: number, k: string) => ReactNode): ReactNode[] {
  const partes = t.split(/(\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\])/g)
  return partes.map((p, i) => {
    const k = `${chave}-${i}`
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>
    const m = p.match(/^\[(\d+(?:,\s*\d+)*)\]$/)
    if (m) return <Fragment key={k}>{m[1].split(/,\s*/).map((n, j) => chip(Number(n), `${k}-${j}`))}</Fragment>
    return <Fragment key={k}>{p}</Fragment>
  })
}

function Texto({ texto, fontes }: { texto: string; fontes: Fonte[] }) {
  const chip = (n: number, k: string) => {
    const existe = fontes.some((f) => f.n === n)
    return (
      <button
        key={k}
        type="button"
        disabled={!existe}
        onClick={() => document.getElementById(`fonte-ia-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        className={cn('mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 align-baseline text-[11px] font-semibold tabular-nums',
          existe ? 'bg-marca/15 text-marca hover:bg-marca/25' : 'bg-alerta/20 text-alerta')}
        aria-label={`Fonte ${n}`}
      >
        {n}
      </button>
    )
  }
  const linhas = texto.replace(/\r/g, '').split('\n')
  const blocos: ReactNode[] = []
  let lista: { tipo: 'ul' | 'ol'; itens: ReactNode[] } | null = null
  const fecharLista = () => {
    if (!lista) return
    const k = `l-${blocos.length}`
    blocos.push(lista.tipo === 'ul'
      ? <ul key={k} className="my-1.5 list-disc space-y-1 pl-5">{lista.itens}</ul>
      : <ol key={k} className="my-1.5 list-decimal space-y-1 pl-5">{lista.itens}</ol>)
    lista = null
  }
  linhas.forEach((l, i) => {
    const k = `t-${i}`
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (li) {
      const tipo = /^\s*\d/.test(l) ? 'ol' : 'ul'
      if (!lista || lista.tipo !== tipo) { fecharLista(); lista = { tipo, itens: [] } }
      lista.itens.push(<li key={k}>{linha(li[1], k, chip)}</li>)
      return
    }
    fecharLista()
    const h = l.match(/^\s*#{1,4}\s+(.*)$/)
    if (h) { blocos.push(<p key={k} className="mt-3 mb-1 font-semibold text-tinta">{linha(h[1], k, chip)}</p>); return }
    if (!l.trim()) return
    blocos.push(<p key={k} className="my-1.5">{linha(l, k, chip)}</p>)
  })
  fecharLista()
  return <div className="text-corpo leading-relaxed text-tinta">{blocos}</div>
}

function Feedback({ requestId }: { requestId: string }) {
  const [enviado, setEnviado] = useState<boolean | null>(null)
  const [erro, setErro] = useState(false)
  const enviar = async (util: boolean) => {
    setEnviado(util)
    const { error } = await supabase.rpc('registrar_feedback_busca', { p_request_id: requestId, p_util: util })
    if (error) { setErro(true); setEnviado(null) }
  }
  return (
    <div className="flex items-center gap-2 text-apoio text-tinta-sussurro">
      <span>{enviado === null ? 'Esta resposta ajudou?' : 'Obrigado pelo retorno.'}</span>
      <button type="button" onClick={() => enviar(true)} aria-pressed={enviado === true} aria-label="Resposta útil"
        className={cn('rounded-controle-sm p-1 hover:text-acao', enviado === true && 'text-acao')}>
        <ThumbsUp className="size-4" />
      </button>
      <button type="button" onClick={() => enviar(false)} aria-pressed={enviado === false} aria-label="Resposta não ajudou"
        className={cn('rounded-controle-sm p-1 hover:text-acao', enviado === false && 'text-acao')}>
        <ThumbsDown className="size-4" />
      </button>
      {erro && <span className="text-alerta">Não foi possível registrar.</span>}
    </div>
  )
}

function CartoesFerramentas({ ferramentas }: { ferramentas: ToolHit[] }) {
  const navigate = useNavigate()
  if (!ferramentas.length) return null
  return (
    <div>
      <p className="rotulo mb-1.5 text-tinta-sussurro">Ferramentas da Central para o cálculo</p>
      <div className="flex flex-wrap gap-2">
        {ferramentas.map((t) => (
          <button key={t.id} type="button" onClick={() => navigate(t.rota)}
            className="flex items-center gap-2 rounded-container border border-fio bg-superficie px-3 py-1.5 text-apoio text-tinta shadow-repouso hover:border-marca">
            <span className="font-medium">{t.nome}</span>
            <span className="text-tinta-sussurro">{t.categoria}</span>
            <span className="text-acao">Abrir</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function RespostaIa({ pergunta, texto, fontes, ferramentas, status, alerta, requestId, onFechar }: Props) {
  if (status === 'idle') return null
  const mensagem: Record<string, string | null> = {
    loading: 'Consultando o material de referência…',
    blocked: 'Não encontrei isso no material de referência.',
    limite: 'Limite de 30 perguntas por hora atingido. A busca local continua disponível.',
    indisponivel: 'IA indisponível no momento. A busca local continua disponível.',
    error: 'Não foi possível consultar a IA agora.',
  }
  const aviso = mensagem[status] ?? null
  return (
    <section aria-live="polite" aria-label="Resposta da IA" className="mb-[22px] rounded-container border border-fio bg-superficie shadow-repouso">
      <header className="flex items-start justify-between gap-3 border-b border-fio px-4 py-3">
        <div className="min-w-0">
          <p className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><Sparkles className="size-3.5 text-marca" aria-hidden /> Perguntar à IA</p>
          <p className="truncate text-corpo font-semibold text-tinta">“{pergunta}”</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar resposta" className="rounded-controle-sm p-1 text-tinta-sussurro hover:text-acao">
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-4 px-4 py-3">
        {alerta && <p className="rounded-controle-sm border border-alerta/40 bg-alerta/10 px-3 py-2 text-apoio text-tinta">{alerta}</p>}
        {aviso && <p className={cn('text-corpo', status === 'loading' ? 'animate-pulse text-tinta-sussurro' : 'text-tinta')}>{aviso}</p>}
        {(status === 'streaming' || status === 'done') && <Texto texto={texto} fontes={fontes} />}
        {status === 'streaming' && <span className="inline-block h-4 w-1.5 animate-pulse bg-marca align-middle" aria-hidden />}

        <CartoesFerramentas ferramentas={ferramentas} />

        {fontes.length > 0 && (
          <div>
            <p className="rotulo mb-1.5 flex items-center gap-1.5 text-tinta-sussurro"><BookOpen className="size-3.5" aria-hidden /> Fontes</p>
            <ol className="space-y-1.5">
              {fontes.map((f) => (
                <li key={f.n} id={`fonte-ia-${f.n}`} className="flex gap-2 rounded-controle-sm px-2 py-1 text-apoio text-tinta target:bg-marca/10">
                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-marca/15 px-1.5 text-[11px] font-semibold text-marca tabular-nums">{f.n}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{f.titulo}</span>
                    <span className="text-tinta-sussurro"> · {f.editor}, {f.ano}{f.secao ? ` · ${f.secao}` : ''}{f.pagina ? ` · p. ${f.pagina}` : ''}</span>
                    {f.ref && <span className="block text-tinta-sussurro">Fonte da ficha: {f.ref}</span>}
                    {f.url && (
                      <a href={f.url} target={f.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-acao hover:underline">
                        {f.url.startsWith('/') ? 'abrir ferramenta' : 'link'} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(status === 'done' || status === 'blocked') && requestId && <Feedback requestId={requestId} />}
      </div>

      <footer className="border-t border-fio px-4 py-2 text-apoio text-tinta-sussurro">{AVISO_RESPONSABILIDADE}</footer>
    </section>
  )
}
