// Pré-natal da UBS (5A, tarefa 7; decisões K1 a K6 = A e opção B da tela, RT
// em 05/11/2026, ref. Wrike Gantt): cartões no topo e uma linha do tempo por
// gestante, com os trimestres, as consultas, os testes e "hoje", e embaixo o
// que perdeu o prazo e o que está a fazer pela nota C3 da SAPS/MS. A regra fica
// em src/domain/preNatal.ts; o banco em pre_natal_painel (20270222000001).
import { useQuery } from '@tanstack/react-query'
import { Baby, CalendarPlus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { DialogoDesfecho, DialogoDum, DialogoRetirar, IncluirGestante } from '@/components/preNatal/Dialogos'
import { EscalaSemanas, LegendaLinhaDoTempo, LinhaDoTempo } from '@/components/preNatal/LinhaDoTempo'
import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { linkMarcarNaAgenda } from '@/domain/agenda'
import { rotuloIdade } from '@/domain/idade'
import {
  ROTULO_FASE, TETO_NO_APP, diaDoPuerperio, diasEntre, faseDa, fimDaGestacao, frasesDa, pontosDa, resumoPreNatal, rotuloIG, temAtraso,
  type Fase, type PreNatalLinha,
} from '@/domain/preNatal'
import { dataIso, diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Filtro = 'todas' | 'atrasadas' | Fase | 'sem_consulta'
type Acao = { tipo: 'dum' | 'desfecho' | 'retirar'; l: PreNatalLinha }
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const nomeDe = (l: PreNatalLinha) => l.nome_social || l.nome

export default function PreNatal() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  // inclui e registra o médico ou o enfermeiro da UBS; técnico e gestor só veem
  const podeEditar = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('enfermeiro')
  const hoje = dataIso()
  const painel = useQuery({
    queryKey: ['pre-natal', 'painel', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('pre_natal_painel', { p_unidade: unidadeId! })
      if (error) throw error
      return (d ?? []) as unknown as PreNatalLinha[]
    },
  })
  const [filtro, setFiltro] = React.useState<Filtro>('todas')
  const [acao, setAcao] = React.useState<Acao | null>(null)
  const linhas = painel.data ?? []
  const r = resumoPreNatal(linhas, hoje)
  const visiveis = linhas.filter((l) => filtro === 'todas' ? true
    : filtro === 'atrasadas' ? temAtraso(l, hoje)
      : filtro === 'sem_consulta' ? !l.proxima_consulta
        : faseDa(l, hoje) === filtro)

  return (
    <>
      <TituloPagina titulo="Pré-natal" descricao="Gestantes e puérperas da unidade, pelas boas práticas da nota C3 do Ministério da Saúde."
        acoes={podeEditar && unidadeId && !painel.error ? <IncluirGestante unidadeId={unidadeId} /> : undefined} />
      {painel.isLoading ? <Spinner /> : painel.error ? <p className="text-apoio text-critico">{msg(painel.error)}</p>
        : linhas.length === 0 ? (
          <Vazio icone={Baby} titulo="Nenhuma gestante no pré-natal ainda"
            texto='A gestante entra sozinha quando a consulta da UBS registra "pré-natal" ou o CID-10/CIAP-2 de gestação. O médico e o enfermeiro também incluem à mão, aqui ou na consulta.' />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero rotulo="No pré-natal" valor={String(r.total)} nota={`${r.gestantes} gestantes · ${r.puerperas} puérperas`} />
              <Numero rotulo="1ª consulta até 12 semanas" valor={r.captacao.de ? `${r.captacao.feitas} de ${r.captacao.de}` : '—'} nota="captação precoce" />
              <Numero rotulo="Com algo atrasado" valor={String(r.comAtraso)} nota="busca ativa" tom={r.comAtraso > 0 ? 'critico' : undefined} />
              <Numero rotulo="Sem DUM" valor={String(r.semDum)} nota="registre a DUM" tom={r.semDum > 0 ? 'atencao' : undefined} />
            </div>
            <Chips rotulo="Filtrar o pré-natal">
              <Chip ativo={filtro === 'todas'} contagem={r.total} onClick={() => setFiltro('todas')}>Todas</Chip>
              <Chip ativo={filtro === 'atrasadas'} contagem={r.comAtraso} onClick={() => setFiltro('atrasadas')}>Atrasadas</Chip>
              <Chip ativo={filtro === 't1'} contagem={r.t1} onClick={() => setFiltro('t1')}>1º trimestre</Chip>
              <Chip ativo={filtro === 't2'} contagem={r.t2} onClick={() => setFiltro('t2')}>2º trimestre</Chip>
              <Chip ativo={filtro === 't3'} contagem={r.t3} onClick={() => setFiltro('t3')}>3º trimestre</Chip>
              <Chip ativo={filtro === 'puerperio'} contagem={r.puerperas} onClick={() => setFiltro('puerperio')}>Puerpério</Chip>
              <Chip ativo={filtro === 'sem_dum'} contagem={r.semDum} onClick={() => setFiltro('sem_dum')}>Sem DUM</Chip>
              <Chip ativo={filtro === 'sem_consulta'} contagem={r.semConsultaMarcada} onClick={() => setFiltro('sem_consulta')}>Sem consulta marcada</Chip>
            </Chips>
            <LegendaLinhaDoTempo />
            <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              <div className="hidden border-b border-fio px-4 pb-1.5 pt-2.5 md:grid md:grid-cols-[13rem_1fr_11rem] md:gap-4">
                <span className="rotulo text-tinta-sussurro">Gestante</span>
                <EscalaSemanas />
                <span className="rotulo text-tinta-sussurro">Pontos · próxima</span>
              </div>
              <ul aria-label="Gestantes do pré-natal">
                {visiveis.map((l) => <Linha key={l.id} l={l} hoje={hoje} podeEditar={podeEditar} onAcao={(tipo) => setAcao({ tipo, l })} />)}
              </ul>
              {visiveis.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Ninguém neste filtro.</p>}
              <p className="border-t border-fio bg-campo px-4 py-2.5 text-rotulo text-tinta-sussurro">
                Régua: nota metodológica C3 da SAPS/MS, junho de 2026; trimestres do Caderno de Atenção Básica nº 32. Visita do ACS,
                vacina dTpa e saúde bucal não são registradas no app (a pontuação vai até {TETO_NO_APP} de 100); a pontuação oficial é a do SISAB.
              </p>
            </div>
          </div>
        )}
      {acao?.tipo === 'dum' && <DialogoDum g={acao.l} nome={nomeDe(acao.l)} onFechar={() => setAcao(null)} />}
      {acao?.tipo === 'desfecho' && <DialogoDesfecho g={acao.l} nome={nomeDe(acao.l)} onFechar={() => setAcao(null)} />}
      {acao?.tipo === 'retirar' && <DialogoRetirar g={acao.l} nome={nomeDe(acao.l)} onFechar={() => setAcao(null)} />}
    </>
  )
}

function Linha({ l, hoje, podeEditar, onAcao }: { l: PreNatalLinha; hoje: string; podeEditar: boolean; onAcao: (t: Acao['tipo']) => void }) {
  const fase = faseDa(l, hoje)
  const { perdido, aFazer } = frasesDa(l, hoje)
  const dp = diaDoPuerperio(l, hoje)
  return (
    <li className="grid gap-2 border-b border-fio px-4 py-3 last:border-b-0 md:grid-cols-[13rem_1fr_11rem] md:items-center md:gap-4">
      <div className="min-w-0">
        <strong className="text-tinta">{nomeDe(l)}</strong>
        {l.data_nascimento && <span className="text-apoio text-tinta-sussurro"> {rotuloIdade(l.data_nascimento, hoje)}</span>}
        <div className="text-apoio text-tinta-apoio">
          {fase === 'puerperio'
            ? `${l.desfecho === 'parto' && l.desfecho_em ? `parto ${dataBr(l.desfecho_em)}` : `fim ${dataBr(fimDaGestacao(l)!)}`} · puerpério dia ${dp ?? 0}`
            : l.dum ? `${rotuloIG(diasEntre(l.dum, hoje))} · DPP ${dataBr(l.dpp!)}` : ROTULO_FASE.sem_dum}
        </div>
      </div>
      <div className="min-w-0">
        {l.dum ? (
          <>
            <LinhaDoTempo g={l} hoje={hoje} />
            {perdido.length > 0 && <p className="mt-1 text-apoio text-critico">{perdido.join(' · ')}</p>}
            {aFazer.length > 0 && <p className="mt-1 text-apoio text-tinta-apoio">A fazer: {aFazer.join(' · ')}</p>}
            {perdido.length === 0 && aFazer.length === 0 && <p className="mt-1 text-apoio text-conforme">Em dia no que o app registra</p>}
            <p className="mt-0.5 text-rotulo text-tinta-sussurro">consultas {l.consultas ?? 0}/7 · pressão {l.pa ?? 0}/7 · peso e altura {l.peso_altura ?? 0}/7</p>
          </>
        ) : (
          <p className="text-apoio text-atencao">Sem a DUM, o app não sabe a semana da gestação nem os prazos da régua.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-col md:items-start">
        <span className="text-apoio text-tinta-apoio">
          {l.dum ? `${pontosDa(l, hoje)} de ${TETO_NO_APP}` : '—'} · {l.proxima_consulta ? `próx. ${diaMesHora(l.proxima_consulta)}` : 'sem consulta'}
        </span>
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="outline" render={<Link to={linkMarcarNaAgenda(l.paciente_id, null, 'consulta_programada')} />} nativeButton={false}>
            <CalendarPlus /> Agendar
          </Button>
          {podeEditar && (
            <>
              <Button size="xs" variant={l.dum ? 'ghost' : 'outline'} onClick={() => onAcao('dum')}>{l.dum ? 'Corrigir DUM' : 'Registrar DUM'}</Button>
              {fase !== 'puerperio' && <Button size="xs" variant="outline" onClick={() => onAcao('desfecho')}>Registrar fim da gestação</Button>}
              <Button size="xs" variant="ghost" onClick={() => onAcao('retirar')}>Retirar</Button>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

function Numero({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota: string; tom?: 'critico' | 'atencao' }) {
  return (
    <div className="flex flex-col rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="rotulo text-tinta-sussurro">{rotulo}</span>
      <span className={cn('text-titulo font-semibold tabular', tom === 'critico' ? 'text-critico' : tom === 'atencao' ? 'text-atencao' : 'text-tinta')}>{valor}</span>
      <span className="text-apoio text-tinta-sussurro">{nota}</span>
    </div>
  )
}
