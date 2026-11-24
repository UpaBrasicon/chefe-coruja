// ─────────────────────────────────────────────────────────────────────────────
// Histórico de evoluções (protótipo: ESTADO.md etapa 4, manual 3.4; aba
// Evolução do leito, evolHistVals): um histórico único da internação com os
// sete tipos — médica, enfermagem, anotação, fisioterapia, nutrição, outros e
// admissão —, filtro por tipo (chips com contagem), prestador, período e texto.
//
// EV1 (RT, 24/11/2026): lista à esquerda e o registro aberto à direita; o
// painel lateral que repetia o histórico saiu. A admissão médica registrada
// aparece aqui em leitura (MA1), com o atalho para a ficha.
//
// Fisioterapia, nutrição e "outros" já têm tipo de documento no banco, mas não
// têm papel no sistema: aparecem aqui quando houver registro. A enfermagem
// registra pela frente dela (onda 7).
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown, History, Printer } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { imprimirRelatorio } from '@/lib/prontuario'
import { Button } from '@/components/ui/button'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Chip } from '@/components/monitor/Pagina'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { TIPOS_REGISTRO, chaveDia, diaHora, ehMedico, mensagemErro, rotuloTipo, useHistoricoEvolucoes, type RegistroHistorico, type TipoRegistro } from './dados'
import { Bloco, Mensagem } from './pecas'
import { Estado, type TomEstado } from '@/components/porta/Estado'

function status(r: RegistroHistorico): { rotulo: string; tom: TomEstado } {
  if (r.estado === 'cancelado') return { rotulo: 'Cancelado', tom: 'vermelho' }
  if (r.versao > 1) return { rotulo: `Corrigido · v${r.versao}`, tom: 'ambar' }
  if (r.papel === 'complemento') return { rotulo: 'Complemento', tom: 'teal' }
  return { rotulo: 'Registrado', tom: 'verde' }
}

const corTipo = (t: string) => (ehMedico(t) ? 'text-acao' : 'text-tinta-apoio')

export function Historico({ internacaoId, onAbrirAdmissao }: {
  internacaoId: string
  /** MA1: a admissão registrada vira leitura aqui; corrigir e reavaliar abrem a ficha */
  onAbrirAdmissao?: () => void
}) {
  const q = useHistoricoEvolucoes(internacaoId)
  const [fora, setFora] = React.useState<Partial<Record<TipoRegistro, boolean>>>({})
  const [prestador, setPrestador] = React.useState('')
  const [de, setDe] = React.useState('')
  const [ate, setAte] = React.useState('')
  const [busca, setBusca] = React.useState('')
  const [aberto, setAberto] = React.useState<string | null>(null)
  const [filtros, setFiltros] = React.useState(false)

  const regs = React.useMemo(() => q.data ?? [], [q.data])
  const prestadores = React.useMemo(() => Array.from(new Set(regs.map((r) => r.autor ?? '—'))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [regs])
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const semTipo = regs.filter((r) => {
    const dia = chaveDia(r.registrado_em)
    return (!prestador || (r.autor ?? '—') === prestador) && (!de || dia >= de) && (!ate || dia <= ate)
      && (!termo || r.texto.toLocaleLowerCase('pt-BR').includes(termo))
  })
  const vis = semTipo.filter((r) => !fora[r.tipo])
  // o registro escolhido; sem escolha, o mais recente
  const atual = vis.find((r) => r.id === aberto) ?? vis[0] ?? null
  const temAdmissao = regs.some((r) => r.tipo === 'admissao_anamnese')

  if (q.isLoading) return <Bloco><span className="flex items-center gap-2 text-apoio text-tinta-sussurro"><Spinner /> Carregando o histórico…</span></Bloco>
  if (q.error) return <Bloco><Mensagem aviso={{ erro: true, texto: 'Não foi possível abrir o histórico: ' + mensagemErro(q.error) }} /></Bloco>

  return (
    <Bloco aria-label="Histórico de evoluções" className="gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-[7px] text-corpo font-semibold text-tinta"><History className="size-[15px] text-acao" aria-hidden /> Histórico de evoluções</h3>
        <span className="text-apoio text-tinta-sussurro">{vis.length} {vis.length === 1 ? 'registro' : 'registros'}</span>
        {/* Relatório de evolução A4 (protótipo montarEvolHtml), montado no
            servidor com o registro da impressão: tudo o que está filtrado. */}
        <div className="ml-auto flex flex-wrap gap-2">
          {temAdmissao && onAbrirAdmissao && <Button size="sm" variant="outline" onClick={onAbrirAdmissao}>Ficha de admissão</Button>}
          <Button size="sm" variant="outline" aria-expanded={filtros} onClick={() => setFiltros(!filtros)}>
            Filtrar <ChevronDown className={cn('transition-transform', filtros && 'rotate-180')} aria-hidden />
          </Button>
          <Button size="sm" variant="outline" disabled={vis.length === 0}
            onClick={() => void imprimirRelatorio({ tipo: 'evolucao', internacaoId, ids: vis.length === regs.length ? null : vis.map((r) => r.id) })}>
            <Printer /> Imprimir relatório
          </Button>
        </div>
      </div>

      {filtros && (
        <>
          <div role="group" aria-label="Tipos de registro" className="flex flex-wrap gap-1.5">
            {TIPOS_REGISTRO.map((t) => {
              const on = !fora[t.valor]
              return (
                <Chip key={t.valor} variante="opcao" ativo={on} onClick={() => setFora((x) => ({ ...x, [t.valor]: on }))}>
                  {t.rotulo} · {semTipo.filter((r) => r.tipo === t.valor).length}
                </Chip>
              )
            })}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">
              Prestador
              <CampoSelecao value={prestador} onChange={(e) => setPrestador(e.target.value)} className="px-2.5 text-controle">
                <option value="">Todos</option>
                {prestadores.map((p) => <option key={p} value={p}>{p}</option>)}
              </CampoSelecao>
            </label>
            <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">De<Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
            <label className="flex flex-col gap-[5px] text-apoio font-medium text-grafite">Até<Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          </div>
        </>
      )}
      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no texto: potássio, febre…" aria-label="Buscar no texto" />

      {vis.length === 0 ? (
        <span className="text-apoio text-tinta-sussurro">{regs.length ? 'Nenhum registro com esses filtros.' : 'Nenhum registro nesta internação ainda.'}</span>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <div role="listbox" aria-label="Registros" className="flex max-h-[640px] flex-col overflow-y-auto rounded-container border border-fio">
            {vis.map((r) => {
              const sel = atual?.id === r.id
              return (
                <BotaoLinha key={r.id} variante="linha" role="option" aria-selected={sel} onClick={() => setAberto(r.id)}
                  className={cn('flex-col gap-[3px] rounded-none border-0 border-b border-trilha px-3 py-2.5 last:border-b-0 hover:bg-campo', sel && 'bg-alerta-marca')}>
                  <span className="flex flex-wrap items-baseline gap-[7px]">
                    <span className="tabular text-rotulo font-semibold text-tinta">{diaHora(r.registrado_em)}</span>
                    <span className={cn('text-rotulo font-semibold', corTipo(r.tipo))}>{rotuloTipo(r.tipo)}</span>
                  </span>
                  <span className="text-rotulo text-tinta-sussurro">{r.autor ?? '—'} · {status(r).rotulo}</span>
                  <span className="line-clamp-2 text-apoio leading-[1.4] text-grafite">{r.texto}</span>
                </BotaoLinha>
              )
            })}
          </div>
          {atual && (
            <article aria-label="Registro aberto" className="flex min-w-0 flex-col gap-2 rounded-container border border-fio bg-campo p-3.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="tabular text-apoio font-semibold text-tinta">{diaHora(atual.registrado_em)}</span>
                <span className={cn('text-rotulo font-semibold', corTipo(atual.tipo))}>{rotuloTipo(atual.tipo)}</span>
                <span className="text-apoio text-tinta-apoio">{atual.autor ?? '—'} · {atual.especialidade}</span>
                <Estado tom={status(atual).tom}>{status(atual).rotulo}</Estado>
                <Button size="xs" variant="outline" className="ml-auto"
                  onClick={() => void imprimirRelatorio({ tipo: 'evolucao', internacaoId, ids: [atual.id] })}>
                  <Printer /> Imprimir este
                </Button>
              </div>
              <span className="text-controle leading-[1.5] text-pretty whitespace-pre-wrap text-grafite">{atual.texto}</span>
              {atual.versao > 1 && atual.motivo_correcao && (
                <span className="text-rotulo text-tinta-sussurro">Correção em {diaHora(atual.corrigido_em)}: {atual.motivo_correcao}</span>
              )}
            </article>
          )}
        </div>
      )}
    </Bloco>
  )
}
