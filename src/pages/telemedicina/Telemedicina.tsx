// Telas do médico de telemedicina além dos Chamados (Chamados.tsx). Revisão do
// perfil (RT, 24/11/2026): o menu ficou Chamados, Escala, Histórico e
// Prontuários (TM2). As Salas em andamento e as Assinaturas pendentes viraram
// abas dos Chamados (TM1); o Telemonitoramento virou a aba "Cobertura dos
// setores" da Escala (ES3); as Credenciais moram no menu do usuário (CR1). Os
// endereços antigos continuam valendo e levam ao lugar novo. Tudo lido do banco
// (migrations 20261001000003 e 20261009000002); nada aqui grava.
import { useQuery } from '@tanstack/react-query'
import { Lock, Receipt } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Abas, Chip, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { dataIso, dataPorExtenso, diaMes, mesAno, moeda, numero, semanaCurta } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { agruparPorDia, duracaoLegivel, grupoDaAcao, ROTULO_ACAO, trilhaDaTelemedicina, type GrupoAcao } from '@/lib/telemedicinaPerfil'
import { cn } from '@/lib/utils'

import { COR_SITUACAO, hhmm, Nota, PontoSituacao, ROTULO_SITUACAO, Secao, VazioLinha, type Situacao } from './comum'

const TELAS = {
  historico: { titulo: 'Histórico', descricao: 'Suas teleinterconsultas e a trilha do que foi aberto por elas, com data e hora' },
  credenciais: { titulo: 'Unidades e credenciais', descricao: 'Onde você atende e com que inscrição. A Res. CFM 2.314 exige a identificação do médico em toda teleconsulta.' },
} as const
type Tela = keyof typeof TELAS

/** Os endereços das telas que viraram abas (TM1, TM2): o link antigo não quebra. */
const MUDOU: Record<string, string> = {
  salas: '/teleinterconsulta?aba=atendimento',
  assinaturas: '/teleinterconsulta?aba=assinar',
  telemonitoramento: '/minha-escala?aba=cobertura',
}

const brl = moeda
const diaSemana = (iso: string) => semanaCurta(iso)
const isoDia = (d: Date) => dataIso(d)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Telemedicina() {
  const { tela } = useParams<{ tela: string }>()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  if (tela && MUDOU[tela]) return <Navigate to={MUDOU[tela]} replace />
  if (!tela || !(tela in TELAS)) return <Navigate to="/teleinterconsulta" replace />
  if (!unidadeId) return <Spinner />
  const t = TELAS[tela as Tela]
  return (
    <div className="flex w-full max-w-4xl flex-col">
      <TituloPagina titulo={t.titulo} descricao={t.descricao} />
      {tela === 'historico' && <Historico />}
      {tela === 'credenciais' && <Credenciais />}
    </div>
  )
}

function Erro({ e }: { e: unknown }) {
  return e ? <p role="alert" className="text-apoio text-critico">{(e as Error).message}</p> : null
}

// ── extrato (aba da Escala) ─────────────────────────────────────────────────
export function Extrato() {
  const hoje = new Date()
  const [mes, setMes] = React.useState(() => isoDia(hoje).slice(0, 7))
  const [ano, m] = mes.split('-').map(Number)
  const de = `${mes}-01`
  const ate = isoDia(new Date(Date.UTC(ano, m, 0, 12)))
  const q = useQuery({
    queryKey: ['tele-extrato', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_extrato', { p_de: de, p_ate: ate })
      if (error) throw error
      return data ?? []
    },
  })
  const linhas = q.data ?? []
  const soma = (sit: string[]) => linhas.filter((l) => sit.includes(l.situacao)).reduce((s, l) => s + Number(l.valor || 0), 0)
  const emCurso = linhas.find((l) => l.situacao === 'em_curso')
  const pareceres = linhas.reduce((s, l) => s + Number(l.pareceres || 0), 0)
  const horasFechadas = linhas.filter((l) => l.situacao === 'fechado').reduce((s, l) => s + Number(l.horas || 0), 0)
  const nomeMes = mesAno(ano, m)
  const trocar = (delta: number) => { const d = new Date(Date.UTC(ano, m - 1 + delta, 15)); setMes(d.toISOString().slice(0, 7)) }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 place-items-center rounded-controle bg-acao/10 text-acao" aria-hidden><Receipt className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <TituloSecao className="mb-0">Extrato de {nomeMes}</TituloSecao>
          <p className="text-apoio text-tinta-sussurro">Plantão conta pelo valor da unidade para o setor e o turno escalados; o parecer aparece no plantão em que foi escrito</p>
        </div>
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => trocar(-1)}>Mês anterior</Button>
          <Button size="xs" variant="outline" onClick={() => trocar(1)}>Próximo</Button>
        </div>
      </div>
      <Erro e={q.error} />
      {linhas.length > 0 && linhas.every((l) => Number(l.valor) === 0) && (
        <Nota>A unidade ainda não tem valor de plantão para estes setores e turnos (o gestor define em Configuração, Valores de plantão). Horas e pareceres são reais.</Nota>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Fechado até agora', brl(soma(['fechado'])), `${numero(horasFechadas)} h de plantão encerradas`],
          ['Plantão em curso', emCurso ? brl(Number(emCurso.valor)) : 'Nenhum', emCurso ? `${emCurso.unidade}, até ${hhmm(emCurso.fim)}` : 'sem plantão agora'],
          ['Previsto no mês', brl(soma(['fechado', 'em_curso', 'previsto'])), 'pela escala do mês'],
        ].map(([rot, v, sub]) => (
          <div key={rot} className="flex flex-col gap-1 rounded-cartao border border-fio bg-superficie px-4 py-3">
            <span className="text-apoio text-tinta-sussurro">{rot}</span>
            <span className="text-numeral-compacto leading-none font-semibold tracking-[-0.03em] tabular-nums text-tinta">{v}</span>
            <span className="text-apoio text-tinta-sussurro">{sub}</span>
          </div>
        ))}
      </div>
      {q.isLoading && <Spinner />}
      {q.data?.length === 0 && <VazioLinha>Nenhum plantão remoto na sua escala neste mês.</VazioLinha>}
      <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie empty:hidden">
        {linhas.slice().reverse().map((l) => (
          <li key={l.escala_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-3 last:border-0">
            <span className="w-12 text-apoio font-semibold tabular-nums text-tinta">{diaMes(l.inicio)}</span>
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-apoio text-tinta">{capital(diaSemana(l.inicio))} {hhmm(l.inicio)}–{hhmm(l.fim)} <span className="text-tinta-sussurro">· {l.unidade} · {l.setor}</span></span>
              <span className="text-apoio text-tinta-sussurro">
                {numero(Number(l.horas))} h escaladas · {l.pareceres} {Number(l.pareceres) === 1 ? 'parecer' : 'pareceres'}
                {l.checkin_em ? ` · check-in ${hhmm(l.checkin_em)}` : l.situacao !== 'previsto' ? ' · sem check-in' : ''}{l.checkout_em ? ` · check-out ${hhmm(l.checkout_em)}` : ''}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={cn('text-corpo font-semibold tabular-nums', l.situacao === 'em_curso' ? 'text-atencao' : 'text-tinta')}>{brl(Number(l.valor))}</span>
              <span className={cn('text-apoio', l.situacao === 'em_curso' ? 'text-atencao' : 'text-tinta-sussurro')}>
                {l.situacao === 'fechado' ? 'Fechado' : l.situacao === 'em_curso' ? 'Em curso' : 'Previsto'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-apoio text-pretty text-tinta-sussurro">
        {pareceres} {pareceres === 1 ? 'parecer respondido' : 'pareceres respondidos'} nos plantões do mês. A rede não tem valor por parecer, então ele não entra na soma.
      </p>
    </section>
  )
}

// ── cobertura dos setores (aba da Escala, ES3; era o Telemonitoramento) ─────
export function CoberturaSetores() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const q = useQuery({
    queryKey: ['tele-cobertura', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_cobertura', { p_unidade: unidadeId!, p_dias: 7 })
      if (error) throw error
      return data ?? []
    },
  })
  const agora = (q.data ?? []).filter((c) => c.agora)
  const depois = (q.data ?? []).filter((c) => !c.agora)
  const Linha = ({ c }: { c: NonNullable<typeof q.data>[number] }) => (
    <li className={cn('flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-3 last:border-0', c.minha && 'bg-alerta-marca/40')}>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="text-apoio font-medium text-tinta">{c.setor}</span>
        <span className="text-apoio text-tinta-sussurro">{c.minha ? 'Sua escala' : c.medico} · {capital(diaSemana(c.inicio))} {diaMes(c.inicio)}, {hhmm(c.inicio)}–{hhmm(c.fim)}</span>
      </div>
      {c.situacao && (
        <span className={cn('inline-flex items-center gap-2 rounded-capsula border px-3 py-1 text-apoio font-medium', COR_SITUACAO[c.situacao as Situacao['estado']])}>
          <PontoSituacao estado={c.situacao as Situacao['estado']} />{ROTULO_SITUACAO[c.situacao as Situacao['estado']]}
        </span>
      )}
    </li>
  )
  return (
    <div className="flex flex-col gap-4">
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      <Secao titulo="Cobertos agora" extra={q.data ? String(agora.length) : undefined}>
        {q.data && agora.length === 0 && <VazioLinha>Nenhum setor com telemedicina de plantão neste momento.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie empty:hidden">{agora.map((c, i) => <Linha key={i} c={c} />)}</ul>
      </Secao>
      <Secao titulo="Próximos 7 dias">
        {q.data && depois.length === 0 && <VazioLinha>Nenhuma cobertura escalada nos próximos 7 dias.</VazioLinha>}
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie empty:hidden">{depois.map((c, i) => <Linha key={i} c={c} />)}</ul>
      </Secao>
      <Nota>A cobertura vem da escala da telemedicina na unidade. Ela não abre os pacientes do setor: o prontuário só abre pela teleinterconsulta aceita.</Nota>
    </div>
  )
}

// ── histórico (HI1, CH3) ────────────────────────────────────────────────────
type Historico = {
  consultas: { id: string; paciente: string; unidade: string; setor: string | null; solicitante: string; pergunta: string; resposta: string | null
    status: string; urgencia: string; criada_em: string; aceita_em: string | null; respondida_em: string | null
    numero_solicitacao: string | null; numero_parecer: string | null; assinado_em: string | null }[]
  trilha: { em: string; acao: string; paciente: string; unidade: string; por: string }[]
}

const FILTROS: [GrupoAcao | 'todas', string][] = [
  ['todas', 'Todas'], ['pedido', 'Pedidos'], ['aceite', 'Aceites'], ['parecer', 'Pareceres'], ['abertura', 'Aberturas'], ['impressao', 'Impressões'],
]

function Historico() {
  const { perfil } = useAuth()
  const [dias, setDias] = React.useState(30)
  const [aba, setAba] = React.useState<'consultas' | 'trilha'>('consultas')
  const [filtro, setFiltro] = React.useState<GrupoAcao | 'todas'>('todas')
  const [aberto, setAberto] = React.useState<string | null>(null)
  const q = useQuery({
    queryKey: ['tele-historico', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_historico', { p_dias: dias })
      if (error) throw error
      return data as unknown as Historico
    },
  })
  const d = q.data
  // só os eventos da telemedicina: as aberturas feitas como Médico saem (CH3)
  const trilha = d ? trilhaDaTelemedicina(d.trilha, d.consultas) : []
  const visiveis = filtro === 'todas' ? trilha : trilha.filter((e) => grupoDaAcao(e.acao) === filtro)
  const porDia = agruparPorDia(visiveis, (e) => dataIso(e.em))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Abas className="mb-0" rotulo="O que ver" valor={aba} onChange={setAba}
          abas={[['consultas', 'Minhas teleinterconsultas', d?.consultas.length], ['trilha', 'Trilha de auditoria', d ? trilha.length : undefined]]} />
        <div role="group" aria-label="Período" className="ml-auto flex flex-wrap gap-2">
          {[7, 30, 90].map((n) => <Chip key={n} ativo={dias === n} onClick={() => setDias(n)}>{n} dias</Chip>)}
        </div>
      </div>
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      {d && aba === 'consultas' && (
        d.consultas.length === 0 ? <VazioLinha>Nenhuma teleinterconsulta sua no período.</VazioLinha> : (
          <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            {d.consultas.map((c) => (
              <li key={c.id} className="border-b border-trilha px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                    <span className="text-apoio font-medium text-tinta">{c.paciente} <span className="font-normal text-tinta-sussurro">· {[c.setor, c.unidade].filter(Boolean).join(' · ')}</span></span>
                    <span className="text-apoio text-tinta-sussurro">
                      Pedido de {c.solicitante} em {fmtDataHora(c.criada_em)}
                      {c.respondida_em && c.aceita_em ? ` · parecer em ${duracaoLegivel(new Date(c.respondida_em).getTime() - new Date(c.aceita_em).getTime())} depois do aceite` : ''}
                      {c.numero_parecer ? ` · nº ${c.numero_parecer}` : ''}
                    </span>
                  </div>
                  <span className={cn('text-apoio', c.status === 'respondida' ? 'text-conforme' : 'text-atencao')}>{c.status === 'respondida' ? 'Respondida' : 'Em atendimento'}</span>
                  <Button size="xs" variant="outline" onClick={() => setAberto(aberto === c.id ? null : c.id)}>{aberto === c.id ? 'Fechar' : 'Pergunta e parecer'}</Button>
                </div>
                {aberto === c.id && (
                  <div className="mt-3 flex flex-col gap-2 text-apoio">
                    <p className="rounded-controle bg-trilha/60 px-3 py-2 text-tinta"><span className="font-medium">Pergunta: </span>{c.pergunta}</p>
                    {c.resposta && <p className="rounded-controle border border-fio px-3 py-2 whitespace-pre-wrap text-tinta"><span className="font-medium">Parecer: </span>{c.resposta}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      {d && aba === 'trilha' && (
        <>
          <div role="group" aria-label="Filtrar por ação" className="flex flex-wrap gap-2">
            {FILTROS.map(([k, r]) => <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{r}</Chip>)}
          </div>
          {visiveis.length === 0 ? <VazioLinha>Nada registrado no período{filtro === 'todas' ? '' : ' com esta ação'}.</VazioLinha> : (
            <div className="flex flex-col gap-4">
              {porDia.map((g) => (
                <section key={g.dia} aria-label={dataPorExtenso(`${g.dia}T12:00:00Z`)} className="flex flex-col gap-2">
                  <h2 className="text-apoio font-semibold text-tinta">{dataPorExtenso(`${g.dia}T12:00:00Z`)}</h2>
                  <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
                    {g.itens.map((t, i) => (
                      <li key={i} className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-trilha px-4 py-2 last:border-0 sm:grid-cols-[48px_200px_minmax(0,1fr)]">
                        <span className="text-apoio tabular-nums text-tinta-sussurro">{hhmm(t.em)}</span>
                        <span className="text-apoio font-medium text-tinta">
                          {ROTULO_ACAO[t.acao] ?? t.acao}
                          {t.por && t.por !== perfil?.nome_completo && <span className="font-normal text-tinta-sussurro"> · {t.por}</span>}
                        </span>
                        <span className="col-start-2 text-apoio text-tinta-apoio sm:col-start-auto">{t.paciente} <span className="text-tinta-sussurro">· {t.unidade}</span></span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="text-apoio text-tinta-sussurro">
            A abertura do prontuário entra aqui quando cai na janela de leitura de uma teleinterconsulta sua: do aceite até 24 h depois do parecer.
          </p>
        </>
      )}
    </div>
  )
}

// ── unidades e credenciais (CR1; mora no menu do usuário) ───────────────────
type Credenciais = {
  perfil: { nome: string; crm: string | null; uf_crm: string | null; conselho: string | null; registro_numero: string | null; registro_uf: string | null }
  especialidades: string[]
  unidades: { unidade_id: string; nome: string; uf: string | null; municipio: string | null; de_plantao: boolean; proximo: string | null }[]
}

function LinhaCredencial({ rotulo, valor, situacao, tom = 'neutro', acao }: {
  rotulo: string; valor: React.ReactNode; situacao: string; tom?: 'conforme' | 'atencao' | 'neutro'; acao?: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-3 last:border-0">
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <span className="text-apoio text-tinta-sussurro">{rotulo}</span>
        <span className="text-corpo font-medium text-tinta">{valor}</span>
      </div>
      <span className={cn('text-apoio', tom === 'conforme' ? 'text-conforme' : tom === 'atencao' ? 'text-atencao' : 'text-tinta-sussurro')}>{situacao}</span>
      {acao}
    </li>
  )
}

function Credenciais() {
  const q = useQuery({
    queryKey: ['tele-credenciais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_credenciais')
      if (error) throw error
      return data as unknown as Credenciais
    },
  })
  const d = q.data
  const crm = d?.perfil.crm ? `CRM ${d.perfil.crm}${d.perfil.uf_crm ? `/${d.perfil.uf_crm}` : ''}` : null
  return (
    <div className="flex flex-col gap-4">
      <Erro e={q.error} />
      {q.isLoading && <Spinner />}
      {d && (
        <>
          <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
            <LinhaCredencial rotulo="Inscrição" valor={crm ?? 'CRM não cadastrado'}
              situacao={crm ? 'Vai em todo parecer' : 'Peça à coordenação para completar o cadastro'} tom={crm ? 'conforme' : 'atencao'} />
            <LinhaCredencial rotulo="Especialidade" valor={d.especialidades.length ? d.especialidades.join(', ') : 'Nenhuma declarada'}
              situacao="Declarada por você; o RQE não é conferido pelo app"
              acao={<Button size="sm" variant="outline" nativeButton={false} render={<Link to="/perfil" />}>{d.especialidades.length ? 'Alterar' : 'Declarar'}</Button>} />
            <LinhaCredencial rotulo="Assinatura digital" valor="ICP-Brasil" situacao="Ainda sem provedor" />
          </ul>
          <Secao titulo="Unidades com telemedicina" extra={String(d.unidades.length)}>
            <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              {d.unidades.map((u) => (
                <li key={u.unidade_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-3 last:border-0">
                  <span className="min-w-[180px] flex-1 text-apoio font-medium text-tinta">
                    {u.nome}
                    {(u.municipio || u.uf) && <span className="font-normal text-tinta-sussurro"> · {[u.municipio, u.uf].filter(Boolean).join('/')}</span>}
                  </span>
                  <span className={cn('text-apoio', u.de_plantao ? 'text-conforme' : 'text-tinta-sussurro')}>
                    {u.de_plantao ? 'Na escala agora' : u.proximo ? `Próximo plantão ${diaSemana(u.proximo)} ${diaMes(u.proximo)} às ${hhmm(u.proximo)}` : 'Sem plantão marcado'}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
          <Nota icone={<Lock />}>
            Este perfil não entra na Central do Médico, no Plantão nem nos leitos da unidade. O prontuário do paciente abre só pela teleinterconsulta que você aceitou, e cada abertura vai para a trilha de auditoria.
          </Nota>
        </>
      )}
    </div>
  )
}
