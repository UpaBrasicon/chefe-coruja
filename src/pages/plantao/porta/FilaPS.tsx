// Fila médica do Pronto-Socorro (protótipo, "Pronto Socorro"), em três abas,
// cada uma com a sua tabela: triados aguardando por cor e espera; "Em
// atendimento" (com o estado "em reavaliação"); "Saídas do plantão" com os
// finalizados e excluídos do dia. A cor manda; 80+ e prioridade legal só
// desempatam dentro da mesma cor.
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Stethoscope } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { faixaEtaria, rotuloFaixa, rotuloIdade } from '@/domain/idade'
import { homonimos } from '@/domain/homonimos'
import { rotulosPrioridade } from '@/domain/prioridade'
import { ALVO_MIN, gravidade, ordemMedica, type CorRisco } from '@/domain/risco'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { BotaoChamar } from '@/components/porta/Chamada'
import { SeloHomonimo } from '@/components/porta/SeloHomonimo'
import { EncaminhamentosRecebidos } from '@/components/encaminhamento/EncaminhamentosRecebidos'
import { useChamadasPorEpisodio } from '@/hooks/useChamadas'

import { hoje, hora, minutos, nomeDe, rotuloDesfecho, useAgora, type EpFila } from './comum'
import { Estado } from '@/components/porta/Estado'

type Saida = {
  id: string; cor_atual: CorRisco | null; queixa: string; desfecho: string | null; desfecho_motivo: string | null
  desfecho_detalhes: Record<string, unknown> | null; desfecho_em: string | null; encerrado_em: string | null; desfecho_por: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

const MOTIVO_EXCLUSAO: Record<string, string> = { evasao: 'evasão', duplicada: 'ficha duplicada', engano: 'engano' }

const idadeDe = (p: { data_nascimento: string | null } | null) => (p?.data_nascimento ? rotuloIdade(p.data_nascimento, hoje()) : '')
const minDesde = (iso: string | null | undefined, agora: number) => (iso ? Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000)) : 0)
const quando = (s: Saida) => Date.parse(s.desfecho_em ?? s.encerrado_em ?? '') || 0

const Vazio = ({ children }: { children: React.ReactNode }) => <p className="px-5 py-5 text-controle text-tinta-sussurro">{children}</p>
const Nada = () => <span className="text-tinta-sussurro">—</span>

// Três abas pedidas pelo RT (21/10/2026), no lugar dos grupos empilhados. A aba
// fica na URL (?fila=), então volta onde estava ao fechar o atendimento.
const ABAS = [
  { valor: 'aguardando', rotulo: 'Aguardando atendimento' },
  { valor: 'atendimento', rotulo: 'Em atendimento' },
  { valor: 'saidas', rotulo: 'Saídas do plantão' },
] as const
type Aba = (typeof ABAS)[number]['valor']

// Ordenar pela coluna (quadro de rastreamento dos rivais, escolha do RT em
// 21/10/2026). Sem coluna escolhida vale a ordem de sempre (a médica, na fila;
// a mais recente, nas saídas). Clique: maior primeiro → menor primeiro → volta.
type Ordem = { col: string | null; desc: boolean }
function useOrdem() {
  const [ordem, setOrdem] = React.useState<Ordem>({ col: null, desc: true })
  const alternar = (col: string) =>
    setOrdem((o) => (o.col !== col ? { col, desc: true } : o.desc ? { col, desc: false } : { col: null, desc: true }))
  return [ordem, alternar] as const
}
function ordenar<T>(lista: T[], ordem: Ordem, chaves: Record<string, (x: T) => number>): T[] {
  const chave = ordem.col ? chaves[ordem.col] : undefined
  if (!chave) return lista
  // sort estável: empate fica na ordem de sempre
  return [...lista].sort((a, b) => (ordem.desc ? chave(b) - chave(a) : chave(a) - chave(b)))
}

function Cabeca({ children, col, ordem, alternar, className }: {
  children: React.ReactNode; col?: string; ordem?: Ordem; alternar?: (c: string) => void; className?: string
}) {
  if (!col || !ordem || !alternar) return <TableHead className={className}>{children}</TableHead>
  const ativa = ordem.col === col
  const Icone = !ativa ? ArrowUpDown : ordem.desc ? ArrowDown : ArrowUp
  return (
    <TableHead className={className} aria-sort={ativa ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
      <Button variant="ghost" size="xs" onClick={() => alternar(col)} className={cn('-mx-2 font-[inherit] text-[length:inherit]', ativa && 'text-tinta')}>
        {children}<Icone aria-hidden />
      </Button>
    </TableHead>
  )
}

// Nome e idade; embaixo, quando há, a prioridade legal e a faixa pela idade na
// chegada (pediatria ou sem data de nascimento; adulto não ganha rótulo).
function Paciente({ e, iguais }: {
  e: { id: string; paciente: EpFila['paciente'] | Saida['paciente'] } & Partial<Pick<EpFila, 'chegada_em' | 'prioridades_legais'>>
  iguais?: Set<string>
}) {
  const faixa = e.chegada_em ? faixaEtaria(e.paciente?.data_nascimento, e.chegada_em) : null
  const prioridade = e.prioridades_legais?.length ? rotulosPrioridade(e.prioridades_legais).join(', ') : ''
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span><span className="font-medium text-tinta">{nomeDe(e)}</span> <span className="text-tinta-sussurro">{idadeDe(e.paciente)}</span></span>
      {(prioridade || (faixa && rotuloFaixa(faixa))) && (
        <span className="text-rotulo text-tinta-sussurro">
          {prioridade && <>Prioridade: {prioridade}</>}
          {prioridade && faixa && rotuloFaixa(faixa) && ' · '}
          {faixa && rotuloFaixa(faixa) && <span className={faixa === 'pediatrico' ? 'text-pediatria' : 'text-atencao'}>{rotuloFaixa(faixa)}</span>}
        </span>
      )}
      {iguais?.has(e.id) && <SeloHomonimo paciente={e.paciente as EpFila['paciente']} />}
    </div>
  )
}

const Queixa = ({ texto }: { texto: string }) => (
  <TableCell className="max-w-[220px] truncate text-tinta-apoio" title={texto}>{texto}</TableCell>
)

export function FilaPS({ aviso, onAbrir }: { aviso: string | null; onAbrir: (e: EpFila) => void }) {
  const { unidadeAtiva } = useUnidade()
  const agora = useAgora()
  const [busca, setBusca] = useSearchParams()
  const aba: Aba = ABAS.some((a) => a.valor === busca.get('fila')) ? (busca.get('fila') as Aba) : 'aguardando'
  const trocarAba = (v: Aba) => {
    const proxima = new URLSearchParams(busca)
    if (v === 'aguardando') proxima.delete('fila')
    else proxima.set('fila', v)
    setBusca(proxima, { replace: true })
  }
  const [ordemAg, alternarAg] = useOrdem()
  const [ordemAt, alternarAt] = useOrdem()
  const [ordemSa, alternarSa] = useOrdem()

  const setores = useQuery({
    queryKey: ['setores-na-escala', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('setores_na_escala_agora')
      if (error) throw error
      return (Array.isArray(data) ? data : []) as string[]
    },
  })
  const meusSetores = setores.data ?? []

  const fila = useQuery({
    queryKey: ['fila-medica', unidadeAtiva?.unidade_id, meusSetores],
    enabled: meusSetores.length > 0,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodios')
        .select('id, paciente_id, setor_id, cor_atual, classificado_em, chegada_em, queixa, publico, prioridades_legais, atendimento_iniciado_em, reavaliar_em, paciente:pacientes(nome, nome_social, data_nascimento, prontuario, nome_mae, responsavel_nome)')
        .in('setor_id', meusSetores)
        .eq('etapa', 'atendimento')
      if (error) throw error
      return ((data ?? []) as unknown as EpFila[]).sort(ordemMedica)
    },
  })
  // finalizados e excluídos do dia (desde 0h de Brasília)
  const saidas = useQuery({
    queryKey: ['saidas-plantao', unidadeAtiva?.unidade_id, meusSetores],
    enabled: meusSetores.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(`${hoje()}T00:00:00-03:00`).toISOString()
      const { data, error } = await supabase
        .from('episodios')
        .select('id, cor_atual, queixa, desfecho, desfecho_motivo, desfecho_detalhes, desfecho_em, encerrado_em, desfecho_por, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', meusSetores)
        .not('etapa', 'in', '(triagem,atendimento)')
        .not('desfecho', 'is', null)
        .or(`desfecho_em.gte.${desde},encerrado_em.gte.${desde}`)
        .limit(200)
      if (error) throw error
      return ((data ?? []) as unknown as Saida[]).sort((a, b) => quando(b) - quando(a))
    },
  })

  const aguardando = (fila.data ?? []).filter((e) => !e.atendimento_iniciado_em)
  const emAtendimento = (fila.data ?? []).filter((e) => e.atendimento_iniciado_em)
  const acimaDoAlvo = aguardando.filter((e) => minDesde(e.classificado_em, agora) > ALVO_MIN[e.cor_atual]).length
  const contagem: Record<Aba, number> = { aguardando: aguardando.length, atendimento: emAtendimento.length, saidas: (saidas.data ?? []).length }
  const iguais = homonimos(fila.data ?? [])
  const setoresDaFila = [...new Set((fila.data ?? []).map((e) => e.setor_id))]
  const chamadas = useChamadasPorEpisodio(setoresDaFila, 'atendimento')

  const carregando = setores.isLoading || fila.isLoading
  const erro = setores.error ?? fila.error
  // "cor": mais grave primeiro na ordem decrescente
  const porCor = (e: { cor_atual: CorRisco | null }) => (e.cor_atual ? -gravidade(e.cor_atual) : -99)

  return (
    <div className="flex flex-col gap-3">
      {aviso && (
        <div role="status" className="flex items-center gap-2 rounded-container border border-acao/20 bg-alerta-marca px-4 py-3 text-controle text-acao">
          <Check className="size-4 shrink-0" aria-hidden /> {aviso}
        </div>
      )}
      {/* encaminhamentos internos para mim: antes ninguém podia aceitar (o componente não estava em tela nenhuma) */}
      <EncaminhamentosRecebidos vazio={null} />
      {erro && <p className="text-apoio text-critico">{(erro as Error).message}</p>}
      {!carregando && !erro && meusSetores.length === 0 && (
        <p className="rounded-container border border-fio bg-superficie px-5 py-4 text-apoio text-tinta-sussurro">
          Você não está na escala de nenhuma porta agora: a fila aparece para quem está de plantão.
        </p>
      )}

      <Tabs value={aba} onValueChange={(v) => trocarAba(v as Aba)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-fio">
          <TabsList aria-label="Fila do Pronto-Socorro" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            {ABAS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                {a.rotulo}
                <span className="text-rotulo font-semibold text-acao tabular-nums">{contagem[a.valor]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {/* o que passou do alvo aparece em qualquer aba: não some ao olhar outra lista */}
          <span className={cn('pb-2.5 text-apoio', acimaDoAlvo ? 'font-medium text-critico' : 'text-tinta-sussurro')}>
            {acimaDoAlvo ? `${acimaDoAlvo} acima do alvo da cor` : 'por cor e tempo de espera'}
          </span>
        </div>

        <TabsContent value="aguardando">
          <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {carregando && <div className="px-5 py-4"><Spinner /></div>}
            {!carregando && aguardando.length === 0 && <Vazio>Nenhum paciente triado aguardando.</Vazio>}
            {aguardando.length > 0 && (
              <Table aria-label="Aguardando atendimento">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Cabeca col="cor" ordem={ordemAg} alternar={alternarAg}>Cor</Cabeca>
                    <Cabeca>Paciente</Cabeca>
                    <Cabeca>Queixa</Cabeca>
                    <Cabeca col="espera" ordem={ordemAg} alternar={alternarAg}>Espera</Cabeca>
                    <Cabeca>Alvo</Cabeca>
                    <Cabeca>Situação</Cabeca>
                    <Cabeca className="text-right"><span className="sr-only">Ações</span></Cabeca>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenar(aguardando, ordemAg, { cor: porCor, espera: (e) => minDesde(e.classificado_em, agora) }).map((e) => {
                    const acima = minDesde(e.classificado_em, agora) > ALVO_MIN[e.cor_atual]
                    const n = chamadas.data?.get(e.id) ?? 0
                    return (
                      <TableRow key={e.id}>
                        <TableCell><PilulaRisco cor={e.cor_atual} /></TableCell>
                        <TableCell><Paciente e={e} iguais={iguais} /></TableCell>
                        <Queixa texto={e.queixa} />
                        <TableCell className={cn('tabular-nums', acima ? 'font-semibold text-critico' : 'text-tinta-apoio')}>{minutos(e.classificado_em, agora)}</TableCell>
                        <TableCell className="tabular-nums text-tinta-sussurro">{ALVO_MIN[e.cor_atual]} min</TableCell>
                        <TableCell>
                          {n === 0 ? <Estado tom="cinza">Aguardando</Estado>
                            : <Estado tom={n >= 3 ? 'vermelho' : 'ambar'}>Chamado {n} {n === 1 ? 'vez' : 'vezes'}</Estado>}
                        </TableCell>
                        <TableCell>
                          {/* sala, chamar e abrir numa linha só: a linha da tabela não cresce */}
                          <div className="flex items-center justify-end gap-2 [&>div]:flex-nowrap">
                            <BotaoChamar episodioId={e.id} setorId={e.setor_id} etapa="atendimento" chamadas={n} semContagem />
                            <Button size="sm" onClick={() => onAbrir(e)} aria-label={`Abrir atendimento de ${nomeDe(e)}`}><Stethoscope /> Abrir</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="atendimento">
          <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {!carregando && emAtendimento.length === 0 && <Vazio>Nenhum paciente em atendimento.</Vazio>}
            {emAtendimento.length > 0 && (
              <Table aria-label="Em atendimento">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Cabeca col="cor" ordem={ordemAt} alternar={alternarAt}>Cor</Cabeca>
                    <Cabeca>Paciente</Cabeca>
                    <Cabeca>Queixa</Cabeca>
                    <Cabeca col="ha" ordem={ordemAt} alternar={alternarAt}>Há</Cabeca>
                    <Cabeca>Situação</Cabeca>
                    <Cabeca className="text-right"><span className="sr-only">Ações</span></Cabeca>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenar(emAtendimento, ordemAt, { cor: porCor, ha: (e) => minDesde(e.atendimento_iniciado_em, agora) }).map((e) => {
                    const reav = !!e.reavaliar_em
                    const atrasada = reav && Date.parse(e.reavaliar_em!) < agora
                    return (
                      <TableRow key={e.id}>
                        <TableCell><PilulaRisco cor={e.cor_atual} /></TableCell>
                        <TableCell><Paciente e={e} iguais={iguais} /></TableCell>
                        <Queixa texto={e.queixa} />
                        <TableCell className="tabular-nums text-tinta-apoio">{minutos(e.atendimento_iniciado_em, agora)}</TableCell>
                        <TableCell>
                          {reav
                            ? <Estado tom={atrasada ? 'vermelho' : 'ambar'}>Em reavaliação · às {hora(e.reavaliar_em)}{atrasada ? ' · atrasada' : ''}</Estado>
                            : <Estado tom="teal">Em atendimento</Estado>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => onAbrir(e)}>{reav ? 'Reavaliar' : 'Abrir atendimento'}</Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="saidas">
          <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {!saidas.isLoading && (saidas.data ?? []).length === 0 && <Vazio>Nenhuma saída desde a meia-noite.</Vazio>}
            {(saidas.data ?? []).length > 0 && (
              <Table aria-label="Saídas do plantão">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Cabeca col="cor" ordem={ordemSa} alternar={alternarSa}>Cor</Cabeca>
                    <Cabeca>Paciente</Cabeca>
                    <Cabeca>Desfecho</Cabeca>
                    <Cabeca>CID</Cabeca>
                    <Cabeca>Destino ou motivo</Cabeca>
                    <Cabeca col="hora" ordem={ordemSa} alternar={alternarSa}>Hora</Cabeca>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenar(saidas.data ?? [], ordemSa, { cor: porCor, hora: quando }).map((s) => {
                    // retirado da fila (recepção/enfermagem): sem médico no desfecho
                    const excluido = s.desfecho === 'cancelado' || (s.desfecho === 'evasao' && !s.desfecho_por)
                    const [codigo, ...resto] = (s.desfecho_motivo ?? '').split(': ')
                    const d = s.desfecho_detalhes ?? {}
                    const destino = excluido ? resto.join(': ') || s.desfecho_motivo : d.destino ? String(d.destino) : ''
                    return (
                      <TableRow key={s.id}>
                        <TableCell><PilulaRisco cor={s.cor_atual} /></TableCell>
                        <TableCell><Paciente e={s} /></TableCell>
                        <TableCell>
                          {excluido
                            ? <Estado tom="vermelho">Excluído · {MOTIVO_EXCLUSAO[codigo] ?? codigo}</Estado>
                            : <Estado tom="verde">{rotuloDesfecho(s.desfecho)}</Estado>}
                        </TableCell>
                        <TableCell className="tabular-nums text-tinta-apoio">{d.cid_alta ? String(d.cid_alta) : <Nada />}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-tinta-apoio" title={destino || undefined}>{destino || <Nada />}</TableCell>
                        <TableCell className="tabular-nums text-tinta-apoio">{hora(s.desfecho_em ?? s.encerrado_em)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
