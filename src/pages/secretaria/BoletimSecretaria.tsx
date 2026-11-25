import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Download, Minus, X } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'

import { Chip, TituloCartao, TituloSecao, VazioLinha } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CORES_RISCO, rotuloCor, textoAlvo, type CorRisco } from '@/domain/risco'
import {
  avaliarNoMes, deslocarMes, indicadorMeta, mesDe, mesesPadrao, mesesParaEscolher, metaDoMes, parte, primeiroDia, SUFIXO, variacao,
  type Ala, type Boletim, type BoletimMes, type Causa, type ItemLista, type Medida, type Modo, type NomeAla,
} from '@/lib/boletim'
import { dataHora, dataIso, mesAno, numero, numeroAte } from '@/lib/formato'
import type { Indicadores } from '@/lib/secretariaCompleta'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Boletim bimestral do Gestor da secretaria (pedido do RT, 24/11/2026). Segue
// a ordem da apresentação bimestral que a secretaria já usa: porta, tempos,
// CIDs da porta, enfermarias, estabilização, encaminhamentos, óbitos, produção
// e notificações; mais os indicadores de contrato e as metas (P1 e P2). O banco
// faz as contas (secretaria_boletim, migration 20270421000080): só agregado,
// número exato, sem identificar paciente. "Baixar PDF" usa a impressão do
// navegador com a folha montada só com o boletim.

// Na impressão, só o boletim sai na folha (a casca do app some).
const CSS_IMPRESSAO = `@media print {
  body:has(> #boletim-impressao) > *:not(#boletim-impressao) { display: none !important; }
  @page { size: A4; margin: 12mm; }
}`

const mesLongo = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return mesAno(a, m)
}
const mesCurto = (mes: string) => {
  const t = mesLongo(mes).split(' de ')[0]
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function valor(v: number | null | undefined, medida: Medida = 'n'): string {
  if (v === null || v === undefined) return '—'
  if (medida === 'n') return numero(v)
  if (medida === 'dias') return `${numeroAte(v, 1)} ${v === 1 ? 'dia' : 'dias'}`
  return `${numeroAte(v, 1)}${SUFIXO[medida]}`
}

export default function BoletimSecretaria() {
  const hoje = dataIso()
  const padrao = React.useMemo(() => mesesPadrao(hoje), [hoje])
  const opcoesMes = React.useMemo(() => mesesParaEscolher(hoje), [hoje])
  const [unidade, setUnidade] = React.useState('')
  const [modo, setModo] = React.useState<Modo>('bimestral')
  const [mesA, setMesA] = React.useState(padrao.a)
  const [mesB, setMesB] = React.useState(padrao.b)
  // mensal: o mês escolhido com o anterior ao lado; bimestral: os dois em ordem
  const [a, b] = modo === 'mensal' ? [deslocarMes(mesB, -1), mesB] : [mesA, mesB].sort()

  // as unidades da secretaria (a mesma consulta da aba Unidades)
  const lista = useQuery({
    queryKey: ['secretaria-indicadores', mesDe(hoje)],
    queryFn: async () => {
      const [ano, mes] = mesDe(hoje).split('-').map(Number)
      const { data, error } = await supabase.rpc('secretaria_indicadores', { p_ano: ano, p_mes: mes })
      if (error) throw error
      return data as unknown as Indicadores
    },
  })
  const unidades = lista.data?.unidades ?? []

  const dados = useQuery({
    queryKey: ['secretaria-boletim', unidade, a, b],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_boletim', {
        p_unidade: unidade || null, p_mes_a: primeiroDia(a), p_mes_b: primeiroDia(b),
      })
      if (error) throw error
      return data as unknown as Boletim
    },
  })

  const nomeUnidade = unidade ? (unidades.find((u) => u.id === unidade)?.nome ?? 'Unidade') : 'Toda a rede'

  return (
    <div className="flex flex-col gap-4">
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="boletim-unidade">Unidade</Label>
            <CampoSelecao id="boletim-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="min-w-[220px]">
              <option value="">Toda a rede</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </CampoSelecao>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-rotulo text-tinta-sussurro">Período</span>
            <div role="radiogroup" aria-label="Período do boletim" className="flex gap-2">
              <Chip radio ativo={modo === 'bimestral'} onClick={() => setModo('bimestral')}>Bimestral</Chip>
              <Chip radio ativo={modo === 'mensal'} onClick={() => setModo('mensal')}>Mensal</Chip>
            </div>
          </div>
          {modo === 'bimestral' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="boletim-mes-a">Primeiro mês</Label>
              <CampoSelecao id="boletim-mes-a" value={mesA} onChange={(e) => setMesA(e.target.value)}>
                {opcoesMes.map((m) => <option key={m} value={m}>{mesLongo(m)}</option>)}
              </CampoSelecao>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="boletim-mes-b">{modo === 'bimestral' ? 'Segundo mês' : 'Mês'}</Label>
            <CampoSelecao id="boletim-mes-b" value={mesB} onChange={(e) => setMesB(e.target.value)}>
              {opcoesMes.map((m) => <option key={m} value={m}>{mesLongo(m)}</option>)}
            </CampoSelecao>
          </div>
          <Button variant="outline" className="ml-auto" disabled={!dados.data} onClick={() => window.print()}>
            <Download />
            Baixar PDF
          </Button>
        </CardContent>
      </Card>

      {dados.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {dados.error && <MensagemErro erro={dados.error} acao="montar o boletim" />}
      {dados.data && (
        <>
          <Relatorio b={dados.data} modo={modo} nome={nomeUnidade} emitido={dados.dataUpdatedAt} />
          {createPortal(
            <div id="boletim-impressao" className="hidden bg-superficie p-0 text-tinta print:block">
              <style>{CSS_IMPRESSAO}</style>
              <Relatorio b={dados.data} modo={modo} nome={nomeUnidade} emitido={dados.dataUpdatedAt} impressao />
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}

// ── o boletim ────────────────────────────────────────────────────────────

type Ctx = { b: Boletim; meses: [BoletimMes, BoletimMes]; comMeta: boolean; impressao: boolean }
const Contexto = React.createContext<Ctx | null>(null)
const useCtx = () => React.useContext(Contexto)!

function Relatorio({ b, modo, nome, emitido, impressao = false }: { b: Boletim; modo: Modo; nome: string; emitido: number; impressao?: boolean }) {
  const meses = b.meses
  const [ma, mb] = [mesDe(meses[0].mes), mesDe(meses[1].mes)]
  const ctx: Ctx = { b, meses, comMeta: !b.rede && b.metas.length > 0, impressao }
  const periodo = modo === 'mensal'
    ? `${mesLongo(mb)}, comparado a ${mesLongo(ma)}`
    : `${mesLongo(ma).split(' de ')[0]} e ${mesLongo(mb)}`
  return (
    <Contexto.Provider value={ctx}>
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 print:mb-2">
          <TituloSecao className="mb-0">{modo === 'mensal' ? 'Boletim mensal de indicadores' : 'Boletim bimestral de indicadores'}</TituloSecao>
          <p className="text-corpo text-tinta">
            {nome}{b.rede ? ` (${b.unidades.length} ${b.unidades.length === 1 ? 'unidade' : 'unidades'})` : ''} · {periodo}
          </p>
          <p className="text-rotulo text-tinta-sussurro">
            Fonte: registros do Chefe Coruja. Números exatos, só agregados, sem identificar paciente. Emitido em {dataHora(emitido)}.
          </p>
        </header>

        <Secao titulo="Atendimento na porta">
          <Tabela>
            <Linha rotulo="Fichas confeccionadas" v={(m) => m.porta.fichas} />
            <Linha rotulo="Fichas atendidas" v={(m) => m.porta.atendidas} chave="fichas_atendidas" />
            <Linha rotulo="Fichas não atendidas" v={(m) => m.porta.nao_atendidas} />
            <Linha rotulo="Taxa de atendimento" v={(m) => m.porta.taxa_atendimento} medida="pct" chave="taxa_atendimento" />
          </Tabela>
          <Tabela titulo="Atendidas por especialidade e turno" nota="Diurno de 07:00 a 19:00; noturno de 19:00 a 07:00.">
            <Linha rotulo="Clínica médica, diurno" v={(m) => m.porta.turnos.adulto_diurno} />
            <Linha rotulo="Clínica médica, noturno" v={(m) => m.porta.turnos.adulto_noturno} />
            <Linha rotulo="Pediatria, diurno" v={(m) => m.porta.turnos.pediatrico_diurno} />
            <Linha rotulo="Pediatria, noturno" v={(m) => m.porta.turnos.pediatrico_noturno} />
            {meses.some((m) => m.porta.turnos.sem_publico > 0) && (
              <Linha rotulo="Sem público na ficha" v={(m) => m.porta.turnos.sem_publico} />
            )}
          </Tabela>
        </Secao>

        <Secao titulo="Tempo médio de espera na porta">
          <Tabela>
            <Linha rotulo="Da abertura da ficha à classificação de risco" v={(m) => m.porta.espera_classificacao_min} medida="min" chave="espera_classificacao" />
            <Linha rotulo="Da classificação de risco ao atendimento médico" v={(m) => m.porta.espera_medico_min} medida="min" chave="espera_medico" />
          </Tabela>
        </Secao>

        <Secao titulo="Indicadores do contrato">
          <Tabela nota="Tempo-alvo até o médico pela cor da classificação (Manchester, com o ajuste da unidade). Retorno: nova ficha do mesmo paciente até 72 h depois da anterior terminar. Transferência: pedido de leito ou transferência regulado com destino, autorizado em diante, sobre as fichas atendidas.">
            <Linha rotulo="Atendidos no tempo-alvo da cor" v={(m) => m.contrato.pct_no_alvo} medida="pct" chave="pct_no_alvo" />
            {CORES_RISCO.map((cor) => (
              <Linha key={cor} recuo rotulo={`${rotuloCor(cor)} (${alvoDaCor(b, cor)})`} medida="pct"
                v={(m) => { const c = m.porta.no_alvo.por_cor?.[cor]; return c ? parte(c.dentro, c.avaliados) : null }}
                extra={(m) => { const c = m.porta.no_alvo.por_cor?.[cor]; return c && c.avaliados > 0 ? `${numero(c.dentro)} de ${numero(c.avaliados)}` : null }} />
            ))}
            <Linha rotulo="Retorno à porta em 72 h" v={(m) => m.contrato.retorno_72h} medida="pct" chave="retorno_72h"
              extra={(m) => `${numero(m.porta.retorno_72h.retornos)} fichas`} />
            <Linha rotulo="Permanência na porta abaixo de 24 h" v={(m) => m.contrato.permanencia_menor_24h} medida="pct" chave="permanencia_menor_24h" />
            <Linha rotulo="Transferências reguladas" v={(m) => m.contrato.transferencias} />
            <Linha rotulo="Taxa de transferência" v={(m) => m.contrato.taxa_transferencia} medida="pct" chave="taxa_transferencia" />
          </Tabela>
        </Secao>

        <Secao titulo="CIDs mais frequentes na porta">
          <Listas titulo="Pediatria" itens={(m) => m.cids_porta.pediatrico} />
          <Listas titulo="Clínica médica" itens={(m) => m.cids_porta.adulto} />
        </Secao>

        <SecaoAla titulo="Enfermaria adulto" ala="enfermaria_adulto" />
        <SecaoAla titulo="Enfermaria pediátrica" ala="enfermaria_pediatrica" />
        <SecaoAla titulo="Estabilização" ala="estabilizacao" />

        <Secao titulo="Encaminhamentos e APAC">
          <Tabela>
            <Linha rotulo="Encaminhamentos" v={(m) => m.encaminhamentos.total} />
            <Linha recuo rotulo="Consulta" v={(m) => m.encaminhamentos.por_tipo.consulta} />
            <Linha recuo rotulo="Exame" v={(m) => m.encaminhamentos.por_tipo.exame} />
            <Linha recuo rotulo="Leito" v={(m) => m.encaminhamentos.por_tipo.leito} />
            <Linha recuo rotulo="Transferência" v={(m) => m.encaminhamentos.por_tipo.transferencia} />
            <Linha rotulo="APAC" v={(m) => m.encaminhamentos.apac} />
          </Tabela>
          <Listas titulo="Especialidades mais pedidas" itens={(m) => m.encaminhamentos.especialidades} destino />
          <Listas titulo="Exames mais pedidos" itens={(m) => m.encaminhamentos.exames} destino />
        </Secao>

        <Secao titulo="Óbitos e mortalidade">
          <Tabela nota="Taxa de mortalidade: óbitos na enfermaria e na estabilização sobre as saídas de internação do mês. Antes ou depois de 24 h da admissão (na porta, da chegada).">
            <Linha rotulo="Óbitos, total" v={(m) => m.obitos.total} />
            <Linha recuo rotulo="Na estabilização" v={(m) => m.obitos.estabilizacao} />
            <Linha recuo rotulo="Na enfermaria" v={(m) => m.obitos.enfermaria} />
            <Linha recuo rotulo="Na porta e em outros setores" v={(m) => m.obitos.porta} />
            <Linha rotulo="Taxa de mortalidade" v={(m) => m.obitos.taxa_mortalidade} medida="pct" chave="taxa_mortalidade" />
            <Linha rotulo="Óbitos antes de 24 h" v={(m) => m.obitos.ate_24h} />
            <Linha rotulo="Óbitos depois de 24 h" v={(m) => m.obitos.apos_24h} />
          </Tabela>
          <Causas titulo="Causas na estabilização" causas={(m) => m.obitos.causas.estabilizacao} />
          <Causas titulo="Causas na enfermaria" causas={(m) => m.obitos.causas.enfermaria} />
          {meses.some((m) => m.obitos.causas.porta.length > 0) && (
            <Causas titulo="Causas na porta e em outros setores" causas={(m) => m.obitos.causas.porta} />
          )}
        </Secao>

        <Secao titulo="Produção">
          <Tabela nota="Pequenos procedimentos: procedimentos registrados do grupo 04 da tabela SIGTAP. Exames feitos ou com resultado no mês.">
            <Linha rotulo="Pequenos procedimentos" v={(m) => m.producao.pequenos_procedimentos} chave="pequenos_procedimentos" />
            <Linha rotulo="Exames de análises clínicas" v={(m) => m.producao.laboratorio} chave="exames_laboratorio" />
            <Linha rotulo="Eletrocardiogramas" v={(m) => m.producao.ecg} chave="ecg" />
            <Linha rotulo="Raios X" v={(m) => m.producao.raio_x} chave="raio_x" />
            <Linha rotulo="Procedimentos registrados, todos" v={(m) => m.producao.procedimentos} />
          </Tabela>
        </Secao>

        <Secao titulo="Notificações epidemiológicas e respiratórias">
          <Tabela nota="Agravos abertos no mês, fora os descartados.">
            <Linha rotulo="Dengue" v={(m) => m.notificacoes.dengue} />
            <Linha rotulo="SRAG" v={(m) => m.notificacoes.srag} />
            <Linha rotulo="Covid-19" v={(m) => m.notificacoes.covid} />
            <Linha rotulo="Todas as notificações" v={(m) => m.notificacoes.total} />
          </Tabela>
        </Secao>

        {b.rede && <p className="text-rotulo text-tinta-sussurro">As metas do contrato aparecem no boletim de cada unidade.</p>}
      </div>
    </Contexto.Provider>
  )
}

function alvoDaCor(b: Boletim, cor: CorRisco): string {
  const min = b.alvos?.[cor]
  if (min === undefined) return textoAlvo(cor)
  return min === 0 ? 'imediato' : `até ${min} min`
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <TituloSecao className="mb-0">{titulo}</TituloSecao>
      {children}
    </section>
  )
}

function SecaoAla({ titulo, ala }: { titulo: string; ala: NomeAla }) {
  const { b, meses } = useCtx()
  const da = (m: BoletimMes): Ala | undefined => m.internacao[ala]
  const parteDe = (m: BoletimMes, n: number) => {
    const t = da(m)?.total ?? 0
    const p = parte(n, t)
    return p === null ? null : `${numeroAte(p, 1)}%`
  }
  // origem das internações novas (o modelo dá a parte de cada uma)
  const parteDe2 = (m: BoletimMes, o: 'emergencia' | 'enfermaria') => {
    const x = da(m)
    if (!x) return null
    const p = parte(x.origem[o] ?? 0, x.novas)
    return p === null ? null : `${numeroAte(p, 1)}%`
  }
  const chaveOcupacao = `ocupacao_${ala}`
  return (
    <Secao titulo={titulo}>
      {ala === 'estabilizacao' && !b.estabilizacao_marcada && (
        <Aviso tom="informacao" className="print:hidden">
          Nenhum setor marcado como estabilização{b.rede ? ' nas unidades' : ' nesta unidade'}. Marque em Unidade, Setores e leitos, para os números desta seção.
        </Aviso>
      )}
      <Tabela nota="Paciente-dia pelas horas de internação no mês; ocupação pelos leitos ativos hoje; giro e permanência média pelas saídas do setor no mês.">
        <Linha rotulo="Total de internações" v={(m) => da(m)?.total ?? 0} />
        <Linha recuo rotulo="Internações novas" v={(m) => da(m)?.novas ?? 0} extra={(m) => parteDe(m, da(m)?.novas ?? 0)} />
        <Linha recuo rotulo="Internações anteriores" v={(m) => da(m)?.anteriores ?? 0} extra={(m) => parteDe(m, da(m)?.anteriores ?? 0)} />
        <Linha rotulo="Taxa de ocupação" v={(m) => da(m)?.ocupacao ?? null} medida="pct"
          chave={indicadorMeta(chaveOcupacao) ? chaveOcupacao : undefined} />
        <Linha rotulo="Giro de leito" v={(m) => da(m)?.giro ?? null} />
        <Linha rotulo="Permanência média" v={(m) => da(m)?.permanencia_media_dias ?? null} medida="dias"
          chave={ala === 'enfermaria_adulto' ? 'permanencia_media_enfermaria_adulto' : undefined} />
        <Linha rotulo="Paciente-dia" v={(m) => da(m)?.paciente_dia ?? 0} />
        <Linha rotulo="Leitos ativos" v={(m) => da(m)?.leitos ?? 0} semVariacao />
        {ala === 'estabilizacao' && (
          <>
            <Linha rotulo="Origem: emergência" v={(m) => da(m)?.origem.emergencia ?? 0} extra={(m) => parteDe2(m, 'emergencia')} />
            <Linha rotulo="Origem: enfermaria" v={(m) => da(m)?.origem.enfermaria ?? 0} extra={(m) => parteDe2(m, 'enfermaria')} />
            {meses.some((m) => (da(m)?.origem.outra_unidade ?? 0) > 0) && (
              <Linha rotulo="Origem: outra unidade" v={(m) => da(m)?.origem.outra_unidade ?? 0} />
            )}
          </>
        )}
      </Tabela>
      <Listas titulo="Principais diagnósticos" itens={(m) => da(m)?.diagnosticos ?? []} />
      <p className="text-rotulo text-tinta-sussurro">
        Características clínicas{ala === 'estabilizacao' ? ' e SAPS 3' : ''}: fonte Epimed, fora do app por enquanto.
      </p>
    </Secao>
  )
}

// ── tabela de dois meses ─────────────────────────────────────────────────

function Tabela({ titulo, nota, children }: { titulo?: string; nota?: string; children: React.ReactNode }) {
  const { meses, comMeta } = useCtx()
  return (
    <Card className="print:rounded-none print:border-0 print:shadow-none">
      <CardContent className="flex flex-col gap-2 print:p-0">
        {titulo && <TituloCartao className="mb-0">{titulo}</TituloCartao>}
        <Table className="w-full min-w-[560px] text-apoio">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] text-left font-medium">Indicador</TableHead>
              <TableHead className="text-right font-medium">{mesCurto(mesDe(meses[0].mes))}</TableHead>
              <TableHead className="text-right font-medium">{mesCurto(mesDe(meses[1].mes))}</TableHead>
              <TableHead className="text-right font-medium">Variação</TableHead>
              {comMeta && <TableHead className="text-right font-medium">Meta</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
        {nota && <p className="text-rotulo text-tinta-sussurro">{nota}</p>}
      </CardContent>
    </Card>
  )
}

function Linha({ rotulo, v, medida = 'n', chave, extra, recuo = false, semVariacao = false }: {
  rotulo: string
  v: (m: BoletimMes) => number | null | undefined
  medida?: Medida
  /** chave do indicador com meta do contrato (catálogo em lib/boletim) */
  chave?: string
  extra?: (m: BoletimMes) => string | null
  recuo?: boolean
  semVariacao?: boolean
}) {
  const { b, meses, comMeta } = useCtx()
  const [x, y] = [v(meses[0]) ?? null, v(meses[1]) ?? null]
  const metaB = chave && comMeta ? metaDoMes(b.metas, chave, mesDe(meses[1].mes)) : null
  return (
    <TableRow className="border-t border-fio">
      <TableCell className={cn('py-2 text-tinta', recuo && 'pl-6 text-tinta-apoio')}>{rotulo}</TableCell>
      {meses.map((m, i) => {
        const n = i === 0 ? x : y
        const avaliado = chave && comMeta ? avaliarNoMes(m, b.metas, chave) : null
        const ext = extra?.(m)
        return (
          <TableCell key={m.mes} className="py-2 text-right tabular">
            <span className="text-tinta">{valor(n, medida)}</span>
            {ext && <span className="ml-1 text-rotulo text-tinta-sussurro">({ext})</span>}
            {avaliado && avaliado.avaliacao !== 'sem_dado' && <Cumpriu ok={avaliado.avaliacao === 'cumpriu'} />}
          </TableCell>
        )
      })}
      <TableCell className="py-2 text-right">{semVariacao ? null : <Seta antes={x} depois={y} medida={medida} />}</TableCell>
      {comMeta && (
        <TableCell className="py-2 text-right tabular text-tinta-apoio">
          {metaB ? `${metaB.sentido === 'maior' ? '≥' : '≤'} ${valor(metaB.meta, medida)}` : null}
        </TableCell>
      )}
    </TableRow>
  )
}

function Cumpriu({ ok }: { ok: boolean }) {
  const Icone = ok ? Check : X
  return (
    <span className="mt-0.5 flex items-center justify-end gap-1 text-rotulo text-tinta-sussurro">
      <Icone className="size-3" aria-hidden />
      {ok ? 'cumpriu' : 'não cumpriu'}
    </span>
  )
}

/** Seta de variação em cor neutra: o boletim mostra, quem lê julga. */
function Seta({ antes, depois, medida }: { antes: number | null; depois: number | null; medida: Medida }) {
  const v = variacao(antes, depois)
  if (!v) return <span className="text-tinta-sussurro">—</span>
  const Icone = v.direcao === 'sobe' ? ArrowUp : v.direcao === 'desce' ? ArrowDown : Minus
  const sinal = v.diferenca > 0 ? '+' : v.diferenca < 0 ? '−' : ''
  const abs = Math.abs(v.diferenca)
  const texto = medida === 'pct'
    ? `${sinal}${numeroAte(abs, 1)} p.p.`
    : `${sinal}${medida === 'n' ? numero(abs) : numeroAte(abs, 1)}${v.pct !== null && v.pct !== 0 ? ` (${sinal}${numeroAte(Math.abs(v.pct), 1)}%)` : ''}`
  const nome = v.direcao === 'sobe' ? 'subiu' : v.direcao === 'desce' ? 'desceu' : 'igual'
  return (
    <span className="inline-flex items-center justify-end gap-1 text-tinta-apoio tabular" title={nome}>
      <Icone className="size-3.5" aria-label={nome} />
      {v.direcao === 'igual' ? 'igual' : texto}
    </span>
  )
}

// ── listas lado a lado ───────────────────────────────────────────────────

function Listas({ titulo, itens, destino = false }: { titulo: string; itens: (m: BoletimMes) => ItemLista[]; destino?: boolean }) {
  const { meses } = useCtx()
  return (
    <Card className="print:rounded-none print:border-0 print:shadow-none">
      <CardContent className="flex flex-col gap-2 print:p-0">
        <TituloCartao className="mb-0">{titulo}</TituloCartao>
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          {meses.map((m) => {
            const l = itens(m)
            return (
              <div key={m.mes} className="flex flex-col gap-1">
                <span className="text-rotulo font-medium text-tinta-apoio">{mesCurto(mesDe(m.mes))}</span>
                {l.length === 0 ? <VazioLinha className="py-1">Nada registrado no mês.</VazioLinha> : (
                  <ol className="flex flex-col gap-1">
                    {l.map((it, i) => (
                      <li key={`${it.nome}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-fio pb-1 text-apoio">
                        <span className="min-w-0 text-tinta">
                          {it.cid && <span className="mr-1 text-tinta-sussurro tabular">{it.cid}</span>}
                          {it.nome}
                          {destino && (it.destino || it.origem) && (
                            <span className="block text-rotulo text-tinta-sussurro">{[it.destino, it.origem].filter(Boolean).join(' · ')}</span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium text-tinta tabular">{numero(it.n)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function Causas({ titulo, causas }: { titulo: string; causas: (m: BoletimMes) => Causa[] }) {
  return <Listas titulo={titulo} itens={(m) => causas(m).map((c) => ({ nome: c.causa, n: c.n }))} />
}
