// Puericultura da UBS (5A, tarefa 7; K6 = A do RT em 05/11/2026: mesmas regras
// do pré-natal, tela na opção B): cartões no topo e uma linha do tempo por
// criança, do nascimento aos 2 anos, pela nota C2 da SAPS/MS. Entra toda
// criança com cadastro na UBS e menos de 2 anos (nota C2, item 14). A regra fica
// em src/domain/puericultura.ts; o banco em puericultura_painel (20270224000001).
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, Sprout } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { DialogoRetirarCrianca } from '@/components/puericultura/DialogosPuericultura'
import { EscalaMeses, LegendaLinhaDoTempoCrianca, LinhaDoTempoCrianca } from '@/components/puericultura/LinhaDoTempoCrianca'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { linkMarcarNaAgenda } from '@/domain/agenda'
import {
  META, TETO_NO_APP, faseDa, frasesDa, pontosDa, resumoPuericultura, rotuloIdadeCurta, temAtraso, type CriancaLinha, type Fase,
} from '@/domain/puericultura'
import { dataIso, diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Filtro = 'todas' | 'atrasadas' | Fase | 'sem_consulta'
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const nomeDe = (l: CriancaLinha) => l.nome_social || l.nome

export default function Puericultura() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  // retira o médico ou o enfermeiro da UBS; técnico e gestor só veem
  const podeEditar = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('enfermeiro')
  const hoje = dataIso()
  const painel = useQuery({
    queryKey: ['puericultura', 'painel', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('puericultura_painel', { p_unidade: unidadeId! })
      if (error) throw error
      return (d ?? []) as unknown as CriancaLinha[]
    },
  })
  const [filtro, setFiltro] = React.useState<Filtro>('todas')
  const [retirar, setRetirar] = React.useState<CriancaLinha | null>(null)
  const linhas = painel.data ?? []
  const r = resumoPuericultura(linhas, hoje)
  const visiveis = linhas.filter((l) => filtro === 'todas' ? true
    : filtro === 'atrasadas' ? temAtraso(l, hoje)
      : filtro === 'sem_consulta' ? !l.proxima_consulta
        : faseDa(l.data_nascimento, hoje) === filtro)

  return (
    <>
      <TituloPagina titulo="Puericultura" descricao="Crianças de até 2 anos da unidade, pelas boas práticas da nota C2 do Ministério da Saúde." />
      {painel.isLoading ? <Spinner /> : painel.error ? <p className="text-apoio text-critico">{msg(painel.error)}</p>
        : linhas.length === 0 ? (
          <Vazio icone={Sprout} titulo="Nenhuma criança de até 2 anos"
            texto="Toda criança com cadastro na unidade e menos de 2 anos aparece aqui sozinha, pela data de nascimento. O cadastro é feito na Nova ficha." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero rotulo="Na puericultura" valor={String(r.total)} nota={`${r.neonatal} até 30 dias · ${r.primeiroAno} no 1º ano · ${r.segundoAno} no 2º`} />
              <Numero rotulo="1ª consulta até o 30º dia" valor={r.captacao.de ? `${r.captacao.feitas} de ${r.captacao.de}` : '—'} nota="captação precoce" />
              <Numero rotulo="Com algo atrasado" valor={String(r.comAtraso)} nota="busca ativa" tom={r.comAtraso > 0 ? 'critico' : undefined} />
              <Numero rotulo="Sem consulta marcada" valor={String(r.semConsultaMarcada)} nota="agende a próxima" />
            </div>
            <Chips rotulo="Filtrar a puericultura">
              <Chip ativo={filtro === 'todas'} contagem={r.total} onClick={() => setFiltro('todas')}>Todas</Chip>
              <Chip ativo={filtro === 'atrasadas'} contagem={r.comAtraso} onClick={() => setFiltro('atrasadas')}>Atrasadas</Chip>
              <Chip ativo={filtro === 'neonatal'} contagem={r.neonatal} onClick={() => setFiltro('neonatal')}>Até 30 dias</Chip>
              <Chip ativo={filtro === 'primeiro_ano'} contagem={r.primeiroAno} onClick={() => setFiltro('primeiro_ano')}>1º ano</Chip>
              <Chip ativo={filtro === 'segundo_ano'} contagem={r.segundoAno} onClick={() => setFiltro('segundo_ano')}>2º ano</Chip>
              <Chip ativo={filtro === 'sem_consulta'} contagem={r.semConsultaMarcada} onClick={() => setFiltro('sem_consulta')}>Sem consulta marcada</Chip>
            </Chips>
            <LegendaLinhaDoTempoCrianca />
            <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              <div className="hidden border-b border-fio px-4 pb-1.5 pt-2.5 md:grid md:grid-cols-[13rem_1fr_11rem] md:gap-4">
                <span className="rotulo text-tinta-sussurro">Criança</span>
                <EscalaMeses />
                <span className="rotulo text-tinta-sussurro">Pontos · próxima</span>
              </div>
              <ul aria-label="Crianças da puericultura">
                {visiveis.map((l) => {
                  const { perdido, aFazer } = frasesDa(l, hoje)
                  return (
                    <li key={l.paciente_id} className="grid gap-2 border-b border-fio px-4 py-3 last:border-b-0 md:grid-cols-[13rem_1fr_11rem] md:items-center md:gap-4">
                      <div className="min-w-0">
                        <strong className="text-tinta">{nomeDe(l)}</strong>
                        <div className="text-apoio text-tinta-apoio">{rotuloIdadeCurta(l.data_nascimento, hoje)}{l.nome_mae ? ` · mãe ${l.nome_mae}` : ''}</div>
                      </div>
                      <div className="min-w-0">
                        <LinhaDoTempoCrianca c={l} hoje={hoje} />
                        {perdido.length > 0 && <p className="mt-1 text-apoio text-critico">{perdido.join(' · ')}</p>}
                        {aFazer.length > 0 && <p className="mt-1 text-apoio text-tinta-apoio">A fazer: {aFazer.join(' · ')}</p>}
                        <p className="mt-0.5 text-rotulo text-tinta-sussurro">consultas {l.consultas}/{META} · peso e altura {l.peso_altura}/{META} até os 2 anos</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-col md:items-start">
                        <span className="text-apoio text-tinta-apoio">
                          {pontosDa(l, hoje)} de {TETO_NO_APP} · {l.proxima_consulta ? `próx. ${diaMesHora(l.proxima_consulta)}` : 'sem consulta'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          <Button size="xs" variant="outline" render={<Link to={linkMarcarNaAgenda(l.paciente_id, null, 'consulta_programada')} />} nativeButton={false}>
                            <CalendarPlus /> Agendar
                          </Button>
                          {podeEditar && <Button size="xs" variant="ghost" onClick={() => setRetirar(l)}>Retirar</Button>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {visiveis.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Ninguém neste filtro.</p>}
              <p className="border-t border-fio bg-campo px-4 py-2.5 text-rotulo text-tinta-sussurro">
                Régua: nota metodológica C2 da SAPS/MS, junho de 2026. Conta a consulta com o problema "Puericultura". Visitas do ACS e vacinas
                não são registradas no app (a pontuação vai até {TETO_NO_APP} de 100); a pontuação oficial é a do SISAB.
              </p>
            </div>
          </div>
        )}
      {retirar && <DialogoRetirarCrianca pacienteId={retirar.paciente_id} nome={nomeDe(retirar)} onFechar={() => setRetirar(null)} />}
    </>
  )
}

function Numero({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota: string; tom?: 'critico' }) {
  return (
    <div className="flex flex-col rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="rotulo text-tinta-sussurro">{rotulo}</span>
      <span className={cn('text-titulo font-semibold tabular', tom === 'critico' ? 'text-critico' : 'text-tinta')}>{valor}</span>
      <span className="text-apoio text-tinta-sussurro">{nota}</span>
    </div>
  )
}
