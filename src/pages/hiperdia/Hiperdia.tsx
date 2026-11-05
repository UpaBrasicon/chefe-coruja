// Hiperdia da UBS (5A, tarefa 7, parte 7.2; decisões J1 a J5 e opção A do RT
// em 03/11/2026, ref. Wrike Analytics): cartões no topo e a matriz com cada
// paciente numa linha e cada boa prática das notas C5 e C4 da SAPS/MS numa
// coluna, com o filtro dos atrasados e "Agendar" (busca ativa). A regra de
// "em dia" e dos pontos fica em src/domain/hiperdia.ts.
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, HeartPulse } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { IncluirNoHiperdia } from '@/components/hiperdia/IncluirNoHiperdia'
import { SeloPrograma } from '@/components/hiperdia/SeloPrograma'
import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { linkMarcarNaAgenda } from '@/domain/agenda'
import {
  ITENS, TETO_NO_APP, estadoDoItem, pontosDoPaciente, resumoHiperdia, temPendencia,
  type HiperdiaLinha, type ItemHiperdia, type Programa,
} from '@/domain/hiperdia'
import { rotuloIdade } from '@/domain/idade'
import { useAgora } from '@/hooks/useAgora'
import { data, dataIso, diaMes, diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Filtro = 'todos' | 'pendentes' | Programa | 'sem_consulta'
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const COLUNAS = ITENS.filter((i) => i.item !== 'acs')
const MESES: Record<ItemHiperdia, string> = { consulta: '6 m', pa: '6 m', peso_altura: '12 m', hba1c: '12 m', pes: '12 m', acs: '12 m' }

export default function Hiperdia() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  // inclui o médico ou o enfermeiro da UBS (programa_incluir); técnico e gestor só veem
  const podeIncluir = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('enfermeiro')
  const agora = useAgora(60_000)
  const painel = useQuery({
    queryKey: ['hiperdia', 'painel', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('hiperdia_painel', { p_unidade: unidadeId! })
      if (error) throw error
      return (d ?? []) as unknown as HiperdiaLinha[]
    },
  })
  const [filtro, setFiltro] = React.useState<Filtro>('todos')
  const linhas = painel.data ?? []
  const r = resumoHiperdia(linhas, agora)
  const jaNoPrograma = Object.fromEntries(linhas.map((l) => [l.paciente_id, l.programas.map((p) => p.programa)]))
  const visiveis = linhas.filter((l) => filtro === 'todos' ? true
    : filtro === 'pendentes' ? temPendencia(l, agora)
      : filtro === 'sem_consulta' ? !l.proxima_consulta
        : l.programas.some((p) => p.programa === filtro))

  return (
    <>
      <TituloPagina titulo="Hiperdia" descricao="Hipertensão e diabetes da unidade, pelas boas práticas das notas C5 e C4 do Ministério da Saúde."
        acoes={podeIncluir && unidadeId && !painel.error ? <IncluirNoHiperdia unidadeId={unidadeId} jaNoPrograma={jaNoPrograma} /> : undefined} />
      {painel.isLoading ? <Spinner /> : painel.error ? <p className="text-apoio text-critico">{msg(painel.error)}</p>
        : linhas.length === 0 ? (
          <Vazio icone={HeartPulse} titulo="Ninguém no hiperdia ainda"
            texto="O paciente entra sozinho quando a consulta da UBS registra hipertensão ou diabetes (problema, CID-10 ou CIAP-2). O médico e o enfermeiro também incluem à mão, aqui ou na consulta." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero rotulo="No programa" valor={String(r.total)} nota={`${r.hipertensao} hipertensão · ${r.diabetes} diabetes`} />
              <Numero rotulo="Tudo em dia" valor={String(r.emDia)} nota="no que o app registra" />
              <Numero rotulo="Com algo atrasado" valor={String(r.pendentes)} nota="busca ativa" alerta={r.pendentes > 0} />
              <Numero rotulo="Pontuação média" valor={[r.mediaHipertensao, r.mediaDiabetes].filter((x) => x !== null).join(' · ') || '—'}
                nota={[r.mediaHipertensao !== null && `hipertensão (de ${TETO_NO_APP.hipertensao})`, r.mediaDiabetes !== null && `diabetes (de ${TETO_NO_APP.diabetes})`].filter(Boolean).join(' · ')} />
            </div>
            <Chips rotulo="Filtrar o hiperdia">
              <Chip ativo={filtro === 'todos'} contagem={r.total} onClick={() => setFiltro('todos')}>Todos</Chip>
              <Chip ativo={filtro === 'pendentes'} contagem={r.pendentes} onClick={() => setFiltro('pendentes')}>Atrasados</Chip>
              <Chip ativo={filtro === 'hipertensao'} contagem={r.hipertensao} onClick={() => setFiltro('hipertensao')}>Hipertensão</Chip>
              <Chip ativo={filtro === 'diabetes'} contagem={r.diabetes} onClick={() => setFiltro('diabetes')}>Diabetes</Chip>
              <Chip ativo={filtro === 'sem_consulta'} contagem={r.semConsultaMarcada} onClick={() => setFiltro('sem_consulta')}>Sem consulta marcada</Chip>
            </Chips>
            <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              <Table aria-label="Pacientes do hiperdia">
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    {COLUNAS.map((c) => <TableHead key={c.item}>{c.rotulo} · {MESES[c.item]}</TableHead>)}
                    <TableHead>Próxima consulta</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((l) => {
                    const pts = pontosDoPaciente(l, agora)
                    return (
                      <TableRow key={l.paciente_id}>
                        <TableCell>
                          <strong className="text-tinta">{l.nome_social || l.nome}</strong>
                          {l.data_nascimento && <span className="text-apoio text-tinta-sussurro"> {rotuloIdade(l.data_nascimento, dataIso())}</span>}
                          <div className="mt-1 flex gap-1">{l.programas.map((p) => <SeloPrograma key={p.id} programa={p.programa} />)}</div>
                        </TableCell>
                        {COLUNAS.map((c) => <TableCell key={c.item}><Celula l={l} item={c.item} agora={agora} /></TableCell>)}
                        <TableCell className="text-apoio text-tinta-apoio">{l.proxima_consulta ? diaMesHora(l.proxima_consulta) : '—'}</TableCell>
                        <TableCell className="text-apoio text-tinta-apoio">
                          {l.programas.map((p) => `${p.programa === 'hipertensao' ? 'HAS' : 'DM'} ${pts[p.programa]}`).join(' · ')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="outline" render={<Link to={linkMarcarNaAgenda(l.paciente_id, null, 'consulta_programada')} />} nativeButton={false}>
                            <CalendarPlus /> Agendar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {visiveis.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Ninguém neste filtro.</p>}
              <p className="border-t border-fio bg-campo px-4 py-2.5 text-rotulo text-tinta-sussurro">
                Régua: notas metodológicas C5 (hipertensão) e C4 (diabetes) da SAPS/MS, junho de 2026. A visita do ACS não é registrada no app;
                a pontuação oficial é a do SISAB.
              </p>
            </div>
          </div>
        )}
    </>
  )
}

function Numero({ rotulo, valor, nota, alerta }: { rotulo: string; valor: string; nota: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="rotulo text-tinta-sussurro">{rotulo}</span>
      <span className={cn('text-titulo font-semibold tabular', alerta ? 'text-critico' : 'text-tinta')}>{valor}</span>
      <span className="text-apoio text-tinta-sussurro">{nota}</span>
    </div>
  )
}

function Celula({ l, item, agora }: { l: HiperdiaLinha; item: ItemHiperdia; agora: number }) {
  const e = estadoDoItem(l, item, agora)
  if (e === 'nao_se_aplica') return <span className="text-tinta-sussurro" aria-label="não se aplica">—</span>
  if (e === 'sem_registro') return <span className="rounded-capsula bg-trilha px-2 py-0.5 text-rotulo text-tinta-apoio">sem registro</span>
  const campo = ITENS.find((i) => i.item === item)!.campo!
  const iso = l[campo] as string
  const quando = new Date(iso).getFullYear() === new Date(agora).getFullYear() ? diaMes(iso) : data(iso)
  return e === 'em_dia'
    ? <span className="rounded-capsula bg-alerta-conforme px-2 py-0.5 text-rotulo font-medium text-conforme">✓ {quando}</span>
    : <span className="rounded-capsula bg-alerta-critico px-2 py-0.5 text-rotulo font-medium text-critico">! {quando}</span>
}
