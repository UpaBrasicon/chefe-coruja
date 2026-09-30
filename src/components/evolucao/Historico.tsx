// ─────────────────────────────────────────────────────────────────────────────
// Histórico de evoluções (protótipo: ESTADO.md etapa 4, manual 3.4; aba
// Evolução do leito, evolHistVals): um histórico único da internação com os
// sete tipos — médica, enfermagem, anotação, fisioterapia, nutrição, outros e
// admissão —, filtro por tipo (chips com contagem), prestador, período e texto,
// seleção por caixa, e o painel lateral de leitura.
//
// Fisioterapia, nutrição e "outros" já têm tipo de documento no banco, mas não
// têm papel no sistema: aparecem aqui quando houver registro. A enfermagem
// registra pela frente dela (onda 7).
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowRight, History } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { TIPOS_REGISTRO, chaveDia, diaHora, ehMedico, mensagemErro, rotuloTipo, useHistoricoEvolucoes, type RegistroHistorico, type TipoRegistro } from './dados'
import { Bloco, Mensagem } from './pecas'

function status(r: RegistroHistorico): { rotulo: string; classe: string } {
  if (r.estado === 'cancelado') return { rotulo: 'Cancelado', classe: 'bg-critico/10 text-critico' }
  if (r.versao > 1) return { rotulo: `Corrigido · v${r.versao}`, classe: 'bg-atencao/10 text-atencao' }
  if (r.papel === 'complemento') return { rotulo: 'Complemento', classe: 'bg-suprimento/10 text-suprimento' }
  return { rotulo: 'Registrado', classe: 'bg-conforme/10 text-conforme' }
}

const corTipo = (t: string) => (ehMedico(t) ? 'text-acao' : 'text-tinta-apoio')

export function Historico({ internacaoId }: { internacaoId: string }) {
  const q = useHistoricoEvolucoes(internacaoId)
  const [fora, setFora] = React.useState<Partial<Record<TipoRegistro, boolean>>>({})
  const [prestador, setPrestador] = React.useState('')
  const [de, setDe] = React.useState('')
  const [ate, setAte] = React.useState('')
  const [busca, setBusca] = React.useState('')
  const [sel, setSel] = React.useState<Record<string, boolean>>({})

  const regs = React.useMemo(() => q.data ?? [], [q.data])
  const prestadores = React.useMemo(() => Array.from(new Set(regs.map((r) => r.autor ?? '—'))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [regs])
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const semTipo = regs.filter((r) => {
    const dia = chaveDia(r.registrado_em)
    return (!prestador || (r.autor ?? '—') === prestador) && (!de || dia >= de) && (!ate || dia <= ate)
      && (!termo || r.texto.toLocaleLowerCase('pt-BR').includes(termo))
  })
  const vis = semTipo.filter((r) => !fora[r.tipo])
  const selecionados = vis.filter((r) => sel[r.id])

  if (q.isLoading) return <Bloco><span className="flex items-center gap-2 text-apoio text-tinta-sussurro"><Spinner /> Carregando o histórico…</span></Bloco>
  if (q.error) return <Bloco><Mensagem aviso={{ erro: true, texto: 'Não foi possível abrir o histórico: ' + mensagemErro(q.error) }} /></Bloco>

  return (
    <Bloco aria-label="Histórico de evoluções" className="gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-[7px] text-corpo font-semibold text-tinta"><History className="size-[15px] text-acao" aria-hidden /> Histórico de evoluções</h3>
        <span className="text-apoio text-tinta-sussurro">
          {vis.length} {vis.length === 1 ? 'registro' : 'registros'}
          {selecionados.length > 0 && ` · ${selecionados.length} selecionado${selecionados.length > 1 ? 's' : ''}`}
        </span>
        {/* ONDA 6 — impressão: "Imprimir relatório" (tudo o que está filtrado) ou
            "Imprimir selecionados" gera o Relatório de evolução A4 (protótipo:
            montarEvolHtml), pela folha do servidor (lib/prontuario, abrirImpressao)
            com o registro da impressão. O botão entra aqui, à direita. */}
      </div>

      <div role="group" aria-label="Tipos de registro" className="flex flex-wrap gap-1.5">
        {TIPOS_REGISTRO.map((t) => {
          const on = !fora[t.valor]
          return (
            <button key={t.valor} type="button" aria-pressed={on} onClick={() => setFora((x) => ({ ...x, [t.valor]: on }))}
              className={cn('min-h-[34px] rounded-capsula border px-3 py-1.5 text-apoio',
                on ? 'border-marca/40 bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-sussurro')}>
              {t.rotulo} · {semTipo.filter((r) => r.tipo === t.valor).length}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">
          Prestador
          <select value={prestador} onChange={(e) => setPrestador(e.target.value)}
            className="min-h-[38px] rounded-controle border border-fio bg-campo px-2.5 py-2 text-controle text-tinta outline-none focus-visible:border-marca">
            <option value="">Todos</option>
            {prestadores.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">De<Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">Até<Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">
          Buscar no texto<Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="potássio, febre…" />
        </label>
      </div>

      <div className="flex flex-col overflow-hidden rounded-container border border-fio">
        {vis.map((r) => {
          const s = status(r)
          return (
            <div key={r.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 border-b border-trilha px-3.5 py-3 last:border-b-0">
              <input type="checkbox" checked={!!sel[r.id]} onChange={() => setSel((x) => ({ ...x, [r.id]: !x[r.id] }))}
                aria-label={`Selecionar ${rotuloTipo(r.tipo)} de ${diaHora(r.registrado_em)}`} className="mt-0.5 size-[18px] cursor-pointer accent-acao" />
              <div className="flex min-w-0 flex-col gap-[5px]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="tabular text-apoio font-semibold text-tinta">{diaHora(r.registrado_em)}</span>
                  <span className={cn('text-rotulo font-semibold', corTipo(r.tipo))}>{rotuloTipo(r.tipo)}</span>
                  <span className="text-apoio text-tinta-apoio">{r.autor ?? '—'} · {r.especialidade}</span>
                  <span className={cn('rounded-capsula px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', s.classe)}>{s.rotulo}</span>
                </div>
                <span className="text-controle leading-[1.5] text-pretty whitespace-pre-wrap text-grafite">{r.texto}</span>
                {r.versao > 1 && r.motivo_correcao && (
                  <span className="text-rotulo text-tinta-sussurro">Correção em {diaHora(r.corrigido_em)}: {r.motivo_correcao}</span>
                )}
              </div>
            </div>
          )
        })}
        {vis.length === 0 && <span className="p-3.5 text-apoio text-tinta-sussurro">{regs.length ? 'Nenhum registro com esses filtros.' : 'Nenhum registro nesta internação ainda.'}</span>}
      </div>
    </Bloco>
  )
}

/** Painel lateral de leitura: os registros mais recentes; um toque abre o texto inteiro. */
export function HistoricoLateral({ internacaoId, aoVerTudo }: { internacaoId: string; aoVerTudo?: () => void }) {
  const q = useHistoricoEvolucoes(internacaoId)
  const [aberto, setAberto] = React.useState<string | null>(null)
  const regs = q.data ?? []
  return (
    <aside aria-label="Histórico de evoluções" className="flex min-w-0 flex-col gap-2.5 rounded-menu border border-fio bg-superficie p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-[7px] text-controle font-semibold text-tinta"><History className="size-[15px] text-acao" aria-hidden /> Histórico</span>
        <span className="ml-auto text-rotulo text-tinta-sussurro">{regs.length} {regs.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      {q.isLoading && <span className="flex items-center gap-2 text-apoio text-tinta-sussurro"><Spinner /> Carregando…</span>}
      <div className="flex max-h-[560px] flex-col overflow-y-auto">
        {regs.map((r) => {
          const expandido = aberto === r.id
          return (
            <button key={r.id} type="button" aria-expanded={expandido} onClick={() => setAberto(expandido ? null : r.id)}
              className="flex flex-col gap-[3px] border-b border-trilha py-[9px] text-left last:border-b-0 hover:bg-campo/60">
              <span className="flex flex-wrap items-baseline gap-[7px]">
                <span className="tabular text-rotulo font-semibold text-tinta">{diaHora(r.registrado_em)}</span>
                <span className={cn('text-[11px] font-semibold', corTipo(r.tipo))}>{rotuloTipo(r.tipo)}{r.papel === 'complemento' ? ' · complemento' : ''}</span>
              </span>
              <span className="text-rotulo text-tinta-sussurro">{r.autor ?? '—'}</span>
              <span className={cn('text-apoio leading-[1.45] whitespace-pre-wrap text-grafite', !expandido && 'line-clamp-3')}>{r.texto}</span>
            </button>
          )
        })}
        {!q.isLoading && regs.length === 0 && <span className="py-2 text-apoio text-tinta-sussurro">Nenhum registro nesta internação ainda.</span>}
      </div>
      {aoVerTudo && (
        <button type="button" onClick={aoVerTudo}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio text-acao hover:bg-marca/[0.06]">
          Filtrar e ler tudo <ArrowRight className="size-[13px]" aria-hidden />
        </button>
      )}
    </aside>
  )
}
