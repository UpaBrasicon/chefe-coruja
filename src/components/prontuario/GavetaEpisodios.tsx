// ─────────────────────────────────────────────────────────────────────────────
// Gaveta de episódios anteriores (protótipo, D5 — `valsEpisodios`).
//
// Um só painel para quem está com o paciente agora (leito ou porta): lista as
// passagens ANTERIORES desta pessoa por esta unidade — atendimentos da porta
// encerrados e internações encerradas —, com data, desfecho, queixa/motivo,
// onde foi e o resumo (sumário de alta, sumário de óbito ou a última evolução;
// na falta deles, o relato do desfecho).
//
// Nada aqui passa por cima do banco: lê só o que a RLS deixa ler, depois de
// abrir o prontuário no servidor (abrir_prontuario grava o acesso, e as
// políticas restritivas de "prontuário aberto" exigem isso para ler documento).
// ─────────────────────────────────────────────────────────────────────────────
import { BookOpen, History } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Spinner } from '@/components/ui/spinner'

import { useEpisodiosAnteriores } from './useEpisodiosAnteriores'

export function GavetaEpisodios({
  pacienteId,
  nome,
  aberta,
  onAbertaChange,
}: {
  pacienteId: string
  nome: string
  aberta: boolean
  onAbertaChange: (v: boolean) => void
}) {
  const q = useEpisodiosAnteriores(pacienteId)
  const [expandido, setExpandido] = React.useState<string | null>(null)
  const lista = q.data ?? []

  const total = q.data
    ? lista.length === 1
      ? '1 passagem anterior nesta unidade'
      : `${lista.length} passagens anteriores nesta unidade`
    : undefined

  return (
    <Gaveta
      aberta={aberta}
      onAbertaChange={(v) => {
        if (!v) setExpandido(null)
        onAbertaChange(v)
      }}
      rotulo="Episódios anteriores"
    >
      <GavetaCabeca sobre="Episódios anteriores" titulo={nome} detalhe={total} />

      {q.isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {q.error && (
        <p className="mx-[22px] my-4 rounded-controle border border-critico/30 bg-critico/[0.08] p-3 text-apoio text-critico">
          {(q.error as Error).message}
        </p>
      )}

      {q.data && lista.length > 0 && (
        <ul>
          {lista.map((ep) => {
            const aberto = expandido === ep.chave
            return (
              <li key={ep.chave} className="flex flex-col gap-1.5 border-b border-trilha px-[22px] py-4">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="text-corpo font-semibold tracking-[-0.01em] text-tinta tabular-nums">{ep.quando}</span>
                  <Badge variant={ep.tom}>{ep.desfecho}</Badge>
                </div>
                <span className="text-corpo text-tinta">{ep.queixa}</span>
                {ep.onde && <span className="text-apoio text-tinta-sussurro">{ep.onde}</span>}
                {ep.resumo ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={aberto}
                      onClick={() => setExpandido(aberto ? null : ep.chave)}
                      className="self-start text-apoio font-medium text-acao hover:text-acao-pressionada"
                    >
                      {aberto ? 'Ocultar resumo' : 'Ver resumo'}
                    </button>
                    {aberto && (
                      <p className="rounded-controle bg-campo px-3.5 py-3 text-[14px] leading-[1.6] whitespace-pre-line text-tinta-apoio [text-wrap:pretty]">
                        {ep.resumo}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-apoio text-tinta-sussurro">Sem resumo registrado.</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {q.data && lista.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
          <BookOpen className="size-[22px] text-tinta-sussurro" aria-hidden />
          <span className="text-corpo font-semibold text-tinta">Primeira internação</span>
          <span className="max-w-[34ch] text-apoio text-tinta-sussurro [text-wrap:pretty]">
            Não há passagem anterior desta pessoa por esta unidade.
          </span>
        </div>
      )}

      <GavetaPe className="[text-wrap:pretty]">
        Você alcança estes episódios porque {nome} está sob o seu cuidado agora. Encerrada a internação, o histórico passa a ser do gestor.
      </GavetaPe>
    </Gaveta>
  )
}

/**
 * Botão que abre a gaveta: "Atendimentos anteriores", ou "Primeira internação"
 * quando não há passagem anterior. Para plugar no cabeçalho do leito e da porta.
 */
export function BotaoEpisodiosAnteriores({ pacienteId, nome, className }: { pacienteId: string; nome: string; className?: string }) {
  const [aberta, setAberta] = React.useState(false)
  const q = useEpisodiosAnteriores(pacienteId)
  const primeira = q.data?.length === 0
  return (
    <>
      <Button size="sm" variant="outline" className={cn(className)} onClick={() => setAberta(true)}>
        {primeira ? <BookOpen /> : <History />}
        {primeira ? 'Primeira internação' : 'Atendimentos anteriores'}
        {!!q.data?.length && <span className="tabular-nums text-tinta-sussurro">{q.data.length}</span>}
      </Button>
      <GavetaEpisodios pacienteId={pacienteId} nome={nome} aberta={aberta} onAbertaChange={setAberta} />
    </>
  )
}
