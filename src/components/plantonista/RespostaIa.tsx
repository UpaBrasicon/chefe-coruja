import { Fragment, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, ExternalLink, Globe, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CopyResult } from '@/components/plantonista/CopyResult'
import { supabase } from '@/lib/supabase'
import { confiancaDasCitadas, fontesNaTela, mostrarPubmed, numeracaoNaTela, SEM_PEDIATRIA, semResposta, textoConfianca, textoParaCopiar } from '@/lib/respostaIa'
import type { ArtigoPubmed, ConfiancaIa, Fonte, StatusIa, ToolHit } from '@/lib/useClinicalAsk'
import { cn } from '@/lib/utils'
import { etapaVisivel, ROTULO_ETAPA, type EtapaIa } from '@/lib/etapaIa'

// Painel da resposta da IA (guia §9.4): texto em streaming com [n] clicável,
// ferramentas sugeridas, lista de fontes, estados de bloqueio/erro, feedback
// 👍/👎 e o aviso fixo de responsabilidade.
//
// IA3 e IA6 (RT, 24/11/2026): as fontes vêm recolhidas, uma linha cada e
// numeradas 1..n na ordem em que o texto cita; o caminho cru de uma
// ferramenta no texto vira o botão "Abrir ferramenta"; "Copiar com fontes"
// leva a resposta em texto simples para colar na evolução.

export const AVISO_RESPONSABILIDADE = 'Suporte à decisão baseado nas fontes citadas. A conduta é responsabilidade do médico assistente.'

type Props = {
  pergunta: string
  texto: string
  fontes: Fonte[]
  ferramentas: ToolHit[]
  status: StatusIa
  alerta: string | null
  requestId: string | null
  /** Público que a biblioteca usou (R2-13): pergunta de criança só busca em fonte pediátrica. */
  publico?: 'adulto' | 'pediatrico' | null
  /** E4: nível de confiança que a biblioteca calculou (null em resposta antiga ou fixa). */
  confianca?: ConfiancaIa | null
  /** E5: artigos do PubMed ao vivo quando o material não respondeu. */
  pubmed?: ArtigoPubmed[]
  /** Etapa da espera (lendo, procurando, escrevendo), mostrada com as bolinhas. */
  etapa?: EtapaIa | null
  onFechar: () => void
  className?: string
}

/**
 * Espera com etapa (pedido do RT, 17/11/2026): três bolinhas que sobem e descem
 * e o nome da etapa. Com movimento reduzido no aparelho, as bolinhas ficam paradas.
 */
function Pensando({ etapa }: { etapa: EtapaIa }) {
  return (
    <p role="status" className="flex items-center gap-2.5 text-corpo text-tinta-sussurro">
      <span className="flex items-end gap-1" aria-hidden>
        <span className="size-1.5 rounded-capsula bg-acao motion-safe:animate-bounce" />
        <span className="size-1.5 rounded-capsula bg-acao motion-safe:animate-bounce motion-safe:[animation-delay:150ms]" />
        <span className="size-1.5 rounded-capsula bg-acao motion-safe:animate-bounce motion-safe:[animation-delay:300ms]" />
      </span>
      {ROTULO_ETAPA[etapa]}…
    </p>
  )
}

/** E5: lista do PubMed ao vivo, sem texto da IA. */
function ListaPubmed({ artigos }: { artigos: ArtigoPubmed[] }) {
  return (
    <div data-pubmed>
      <p className="rotulo mb-1 flex items-center gap-1.5 text-tinta-sussurro"><Globe className="size-3.5" aria-hidden /> PubMed ao vivo, fora do material de referência</p>
      <p className="mb-1.5 text-apoio text-tinta-sussurro">Artigos para ler na fonte. A IA não resumiu nem conferiu o conteúdo.</p>
      <ol className="space-y-1.5">
        {artigos.map((a) => (
          <li key={a.pmid} className="rounded-controle px-2 py-1 text-apoio text-tinta">
            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-medium text-acao hover:underline">
              {a.titulo} <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
            </a>
            <span className="block text-tinta-sussurro">{[a.revista, a.ano, a.tipo].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const PARTES = /(\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\]|\(?\/plantonista\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\)?)/g

/** Renderiza a linha com **negrito**, [n] como chip que abre a fonte e o caminho cru como botão. */
function linha(t: string, chave: string, chip: (n: number, k: string) => ReactNode, rota: (caminho: string, k: string) => ReactNode): ReactNode[] {
  const partes = t.split(PARTES)
  return partes.map((p, i) => {
    const k = `${chave}-${i}`
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>
    const m = p.match(/^\[(\d+(?:,\s*\d+)*)\]$/)
    if (m) return <Fragment key={k}>{m[1].split(/,\s*/).map((n, j) => chip(Number(n), `${k}-${j}`))}</Fragment>
    if (/^\(?\/plantonista\//.test(p)) return rota(p.replace(/^\(|\)$/g, ''), k)
    return <Fragment key={k}>{p}</Fragment>
  })
}

function Texto({ texto, fontes, onCitar }: { texto: string; fontes: Fonte[]; onCitar: (na: number) => void }) {
  const navigate = useNavigate()
  const numeros = numeracaoNaTela(texto)
  const chip = (n: number, k: string) => {
    const existe = fontes.some((f) => f.n === n)
    const na = numeros.get(n) ?? n
    return (
      <Button
        key={k}
        variant="link"
        size="xs"
        disabled={!existe}
        onClick={() => onCitar(na)}
        className={cn('mx-0.5 h-5 min-h-5 min-w-5 rounded-capsula px-1.5 align-baseline font-semibold tabular-nums disabled:opacity-100',
          existe ? 'bg-acao/15 text-acao hover:bg-acao/25 hover:text-acao' : 'bg-alerta/20 text-alerta')}
        aria-label={`Fonte ${na}`}
      >
        {na}
      </Button>
    )
  }
  const rota = (caminho: string, k: string) => (
    <Button key={k} variant="outline" size="xs" onClick={() => navigate(caminho)} className="mx-1 h-6 gap-1 align-baseline">
      Abrir ferramenta <ArrowRight className="size-3" aria-hidden />
    </Button>
  )
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
      lista.itens.push(<li key={k}>{linha(li[1], k, chip, rota)}</li>)
      return
    }
    fecharLista()
    const h = l.match(/^\s*#{1,4}\s+(.*)$/)
    if (h) { blocos.push(<p key={k} className="mt-3 mb-1 font-semibold text-tinta">{linha(h[1], k, chip, rota)}</p>); return }
    if (!l.trim()) return
    blocos.push(<p key={k} className="my-1.5">{linha(l, k, chip, rota)}</p>)
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
      <Button variant="ghost" size="icon-xs" onClick={() => enviar(true)} aria-pressed={enviado === true} aria-label="Resposta útil"
        className={cn(enviado === true && 'text-acao')}>
        <ThumbsUp className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => enviar(false)} aria-pressed={enviado === false} aria-label="Resposta não ajudou"
        className={cn(enviado === false && 'text-acao')}>
        <ThumbsDown className="size-4" />
      </Button>
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
          <BotaoLinha key={t.id} onClick={() => navigate(t.rota)}
            className="flex-row items-center gap-2 px-3 py-1.5 text-apoio text-tinta">
            <span className="font-medium">{t.nome}</span>
            <span className="text-tinta-sussurro">{t.categoria}</span>
            <span className="text-acao">Abrir</span>
          </BotaoLinha>
        ))}
      </div>
    </div>
  )
}

/** IA3: fontes recolhidas, uma linha cada, na numeração da tela. */
function ListaFontes({ fontes, aberta, onAlternar }: { fontes: (Fonte & { na: number })[]; aberta: boolean; onAlternar: () => void }) {
  const navigate = useNavigate()
  return (
    <div>
      <Button variant="ghost" size="xs" onClick={onAlternar} aria-expanded={aberta} aria-controls="fontes-ia"
        className="gap-1.5 px-0 text-apoio font-medium text-tinta-apoio">
        <ChevronRight className={cn('size-4 transition-transform', aberta && 'rotate-90')} aria-hidden />
        <BookOpen className="size-3.5" aria-hidden />
        {fontes.length === 1 ? '1 fonte' : `${fontes.length} fontes`}
      </Button>
      {aberta && (
        <ol id="fontes-ia" className="mt-1.5 divide-y divide-trilha rounded-controle border border-fio">
          {fontes.map((f) => {
            const detalhe = `${f.editor}, ${f.ano}${f.secao ? ` · ${f.secao}` : ''}${f.pagina ? ` · p. ${f.pagina}` : ''}`
            const interna = !!f.url?.startsWith('/')
            return (
              <li key={f.n} id={`fonte-ia-${f.na}`} className="flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-apoio text-tinta"
                title={[f.titulo, detalhe, f.ref ? `Fonte da ficha: ${f.ref}` : ''].filter(Boolean).join(' · ')}>
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-capsula bg-acao/15 px-1.5 text-rotulo font-semibold text-acao tabular-nums">{f.na}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{f.titulo}</span>
                  <span className="text-tinta-sussurro"> · {detalhe}</span>
                </span>
                {f.url && (interna ? (
                  <Button variant="link" size="xs" onClick={() => navigate(f.url!)} className="shrink-0">Abrir ferramenta</Button>
                ) : (
                  <a href={f.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${f.titulo}`} className="shrink-0 text-acao hover:underline">
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ))}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function RespostaIa({ pergunta, texto, fontes, ferramentas, status, alerta, requestId, publico, confianca, pubmed = [], etapa = null, onFechar, className }: Props) {
  const [fontesAbertas, setFontesAbertas] = useState(false)
  if (status === 'idle') return null
  const curto = status === 'streaming' || status === 'done' ? semResposta(texto) : null
  if (curto) { fontes = []; ferramentas = [] }
  // durante o streaming só as fontes já citadas; pronta, as citadas (ou todas, sem citação)
  const naTela = status === 'done' ? fontesNaTela(texto, fontes) : numeracaoNaTela(texto).size ? fontesNaTela(texto, fontes) : []
  const mensagem: Record<string, string | null> = {
    loading: null,
    blocked: publico === 'pediatrico' ? SEM_PEDIATRIA : 'Não encontrei isso no material de referência.',
    limite: 'Limite de 30 perguntas por hora atingido. A busca local continua disponível.',
    indisponivel: 'IA indisponível no momento. A busca local continua disponível.',
    error: 'Não foi possível consultar a IA agora.',
    segundo_fator: 'A IA pede o segundo fator confirmado. Entre de novo e confirme o código para usar a IA.',
    identificacao: 'A pergunta parece ter identificação de paciente (nome, CPF, CNS, data ou prontuário) e não foi enviada. Pergunte sem o dado: a IA não recebe identificação.',
  }
  const aviso = mensagem[status] ?? null
  const pensando = etapaVisivel(status, texto, etapa)
  // E4: o nível vale pelas fontes citadas na resposta
  const nivel = confiancaDasCitadas(status === 'done' ? naTela : fontes, confianca)
  const citar = (na: number) => {
    setFontesAbertas(true)
    window.requestAnimationFrame(() => document.getElementById(`fonte-ia-${na}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  return (
    <section aria-live="polite" aria-label="Resposta da IA" className={cn('flex flex-col rounded-container border border-fio bg-superficie', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-fio px-4 py-3">
        <div className="min-w-0">
          <p className="rotulo flex items-center gap-1.5 text-tinta-sussurro"><Sparkles className="size-3.5 text-acao" aria-hidden /> Resposta da IA</p>
          <p className="text-corpo font-semibold text-tinta">"{pergunta}"</p>
          {publico === 'pediatrico' && <p className="text-apoio text-tinta-sussurro">Pergunta de criança: só fontes pediátricas.</p>}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onFechar} aria-label="Fechar resposta">
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {alerta && <p className="rounded-controle border border-alerta/40 bg-alerta/10 px-3 py-2 text-apoio text-tinta">{alerta}</p>}
        {aviso && <p className="text-corpo text-tinta">{aviso}</p>}
        {pensando && <Pensando etapa={pensando} />}
        {(status === 'streaming' || status === 'done') && (curto ? <p className="text-corpo text-tinta">{curto}</p> : <Texto texto={texto} fontes={fontes} onCitar={citar} />)}
        {status === 'streaming' && !pensando && <span className="inline-block h-4 w-1.5 animate-pulse bg-acao align-middle" aria-hidden />}
        {status === 'done' && !curto && textoConfianca(nivel) && (
          <p className={cn('text-apoio', nivel === 'alta' ? 'text-tinta-sussurro' : 'text-tinta')} data-confianca={nivel}>
            {textoConfianca(nivel)}
          </p>
        )}

        <CartoesFerramentas ferramentas={ferramentas} />

        {naTela.length > 0 && <ListaFontes fontes={naTela} aberta={fontesAbertas} onAlternar={() => setFontesAbertas((a) => !a)} />}

        {mostrarPubmed(status, curto, pubmed) && <ListaPubmed artigos={pubmed} />}

        {(status === 'done' || status === 'blocked') && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {requestId ? <Feedback requestId={requestId} /> : <span />}
            {status === 'done' && !curto && texto.trim() && (
              <CopyResult texto={textoParaCopiar(pergunta, texto, naTela)} rotulo="Copiar com fontes" />
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-fio px-4 py-2 text-apoio text-tinta-sussurro">{AVISO_RESPONSABILIDADE}</footer>
    </section>
  )
}
