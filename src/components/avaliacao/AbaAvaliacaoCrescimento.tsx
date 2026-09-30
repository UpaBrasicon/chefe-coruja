// ─────────────────────────────────────────────────────────────────────────────
// Avaliação e curva de crescimento (protótipo, etapa 9 — manual 3.11 e 3.12).
//
// Avaliação: escolhe a escala, responde as perguntas, "Calcular e salvar"
// exige todas; o resultado é a soma e a leitura é a faixa da própria escala
// (o servidor refaz as duas). Pediatria: NIPS e FLACC; adulto: Braden e Morse.
// Intervenção só se a unidade cadastrar (hoje avisa que não há). Histórico com
// filtro e cancelamento com motivo.
//
// Curva: peso, comprimento/estatura, IMC e perímetro cefálico para a idade,
// linhas de escore-z pelo LMS da OMS e os pontos do paciente lidos das
// observações (triagem, leito, ou "Lançar aferição" aqui). Só pediatria; fora
// dela a tela diz o motivo. Impressão: onda 6.
// ─────────────────────────────────────────────────────────────────────────────
import { ClipboardCheck, LineChart as IconeCurva, Printer } from 'lucide-react'
import * as React from 'react'

import {
  INDICADORES, avaliarMedida, classificarPesoIdade, defIndicador, intervaloDaIdade, mesesDeIdade, motivoSemCurva,
  paresImc, rotuloIntervalo, sexoDaTabela, tabelaDe, type Indicador, type Intervalo, type Medida,
} from '@/clinico/crescimento/curvas'
import {
  ESCALAS_AVALIACAO, escalasDoPublico, faixaDe, respondidas, totalAvaliacao,
  type EscalaAvaliacao, type Respostas, type Tom,
} from '@/clinico/crescimento/escalasAvaliacao'
import { SISVAN_2011 } from '@/clinico/crescimento/fonte'
import { textoFontes } from '@/clinico/ficha'
import { ehPediatrico } from '@/domain/idade'
import { imprimirRelatorio } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { CurvaCrescimento, type PontoPaciente } from './CurvaCrescimento'
import {
  br, dia, hojeSP, msg, num, quando, useAvaliacoes, useMedidasCrescimento, usePacienteCurva, useRecarregarAvaliacao,
  type AvaliacaoRegistro, type Grandeza,
} from './useAvaliacao'

export type AbaAvaliacaoCrescimentoProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

// pílulas cheias do protótipo (pill): verde, âmbar, laranja, vermelho
const PILULA: Record<Tom, string> = {
  conforme: 'bg-conforme text-white',
  atencao: 'bg-observacao text-white',
  alerta: 'bg-mts-laranja text-white',
  critico: 'bg-critico text-white',
}
const Pilula = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={cn('rounded-capsula px-[9px] py-[3px] text-rotulo font-semibold whitespace-nowrap', className)}>{children}</span>
)
const Cartao = ({ children }: { children: React.ReactNode }) => (
  <section className="flex flex-col gap-2.5 rounded-menu border border-fio bg-superficie p-4 text-controle">{children}</section>
)
const Aviso = ({ erro, aviso }: { erro: string | null; aviso: string | null }) => (
  <>
    {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2.5 text-apoio text-critico">{erro}</p>}
    {aviso && <p role="status" className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5 text-apoio text-conforme">{aviso}</p>}
  </>
)

type Executar = (fn: () => PromiseLike<{ error: unknown }>, ok: string) => Promise<boolean>
function useExecutar(recarregar: () => void) {
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const executar: Executar = async (fn, ok) => {
    setOcupado(true)
    try {
      const { error } = await fn()
      if (error) { setErro(msg(error)); setAviso(null); return false }
      setErro(null); setAviso(ok); recarregar(); return true
    } finally { setOcupado(false) }
  }
  return { erro, aviso, ocupado, executar }
}

export function AbaAvaliacaoCrescimento({ pacienteId, episodioId, internacaoId }: AbaAvaliacaoCrescimentoProps) {
  const pac = usePacienteCurva(pacienteId)
  if (pac.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (pac.error || !pac.data) return <p className="text-apoio text-critico">{pac.error ? msg(pac.error) : 'Sem dados.'}</p>
  const { data_nascimento: nascimento, sexo } = pac.data
  const ped = nascimento ? ehPediatrico(nascimento, hojeSP()) : null
  return (
    <div className="flex flex-col gap-3.5">
      <SecaoAvaliacao pacienteId={pacienteId} episodioId={episodioId} internacaoId={internacaoId}
        publico={ped === null ? null : ped ? 'pediatrico' : 'adulto'} />
      <SecaoCurva pacienteId={pacienteId} episodioId={episodioId} internacaoId={internacaoId} nascimento={nascimento} sexo={sexo} />
    </div>
  )
}

// ── avaliação ────────────────────────────────────────────────────────────────
function SecaoAvaliacao({ pacienteId, episodioId, internacaoId, publico }: AbaAvaliacaoCrescimentoProps & { publico: 'adulto' | 'pediatrico' | null }) {
  const q = useAvaliacoes(pacienteId)
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarAvaliacao(pacienteId))
  const [escala, setEscala] = React.useState<EscalaAvaliacao | null>(null)
  const [resp, setResp] = React.useState<Respostas>({})
  const [filtro, setFiltro] = React.useState<EscalaAvaliacao | ''>('')
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const opcoes = escalasDoPublico(publico)
  const def = escala ? ESCALAS_AVALIACAO[escala] : null
  const total = escala ? totalAvaliacao(escala, resp) : null
  const fx = escala && total !== null ? faixaDe(escala, total) : null
  const hist = q.data ?? []
  const noHist = Array.from(new Set(hist.map((a) => a.escala)))
  const visiveis = hist.filter((a) => !filtro || a.escala === filtro)

  async function salvar() {
    if (!escala || total === null) return
    const feito = await executar(() => supabase.rpc('registrar_avaliacao', {
      p_paciente: pacienteId, p_escala: escala, p_respostas: resp,
      p_episodio: episodioId ?? undefined, p_internacao: internacaoId ?? undefined,
    }), `${ESCALAS_AVALIACAO[escala].nome}: resultado ${total} salvo.`)
    if (feito) setResp({})
  }

  async function cancelar(a: AvaliacaoRegistro) {
    const feito = await executar(() => supabase.rpc('cancelar_avaliacao', { p_avaliacao: a.id, p_motivo: motivo }),
      'Avaliação cancelada. Continua no histórico.')
    if (feito) { setCancelando(null); setMotivo('') }
  }

  return (
    <Cartao>
      <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta"><ClipboardCheck className="size-4 text-acao" aria-hidden /> Avaliação</h3>
      <span className="text-apoio text-tinta-sussurro">Escolha o indicador, responda as perguntas e salve. O resultado e a interpretação saem da própria escala.</span>
      {publico === null && (
        <span className="text-apoio text-atencao">Sem data de nascimento no cadastro: as escalas dependem da idade (NIPS e FLACC na pediatria; Braden e Morse no adulto).</span>
      )}
      {opcoes.length > 0 && (
        <div role="group" aria-label="Indicador" className="flex flex-wrap gap-1.5">
          {opcoes.map((e) => (
            <Chip key={e} ativo={escala === e} onClick={() => { setEscala(escala === e ? null : e); setResp({}) }}>{ESCALAS_AVALIACAO[e].nome}</Chip>
          ))}
        </div>
      )}
      {def && escala && (
        <>
          <span className="text-apoio text-tinta-apoio">{def.nome} · {def.faixaEtaria} · {quando(new Date().toISOString())}</span>
          {def.itens.map((it) => (
            <div key={it.id} className="flex flex-wrap items-start gap-2">
              <span className="flex-[0_0_170px] pt-1.5 text-apoio font-medium text-tinta">{it.rotulo}</span>
              <div className="flex min-w-0 flex-[1_1_280px] flex-wrap gap-1.5">
                {it.opcoes.map((o) => (
                  <Chip key={o.valor} ativo={resp[it.id] === o.valor} onClick={() => setResp({ ...resp, [it.id]: o.valor })}>{o.valor} · {o.rotulo}</Chip>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-controle font-semibold text-tinta">
              {total !== null ? `Resultado ${total}` : `${respondidas(escala, resp)} de ${def.itens.length} respondidas`}
            </span>
            {fx && <Pilula className={PILULA[fx.tom]}>{fx.rotulo}</Pilula>}
          </div>
          {fx && <span className="text-rotulo text-tinta-sussurro">Intervenção: a unidade ainda não cadastrou intervenção para esta faixa.</span>}
          <span className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">{textoFontes(def.ficha)}</span>
          <div className="flex justify-end">
            <Button size="sm" disabled={total === null || ocupado} onClick={() => void salvar()}>Calcular e salvar</Button>
          </div>
        </>
      )}
      <Aviso erro={erro} aviso={aviso} />

      <div className="flex flex-wrap items-center gap-1.5 border-t border-trilha pt-2.5">
        <span className="mr-1 text-apoio font-semibold text-grafite">Histórico</span>
        {noHist.length > 1 && (
          <>
            <Chip ativo={!filtro} onClick={() => setFiltro('')}>Todas</Chip>
            {noHist.map((e) => <Chip key={e} ativo={filtro === e} onClick={() => setFiltro(e)}>{ESCALAS_AVALIACAO[e]?.nome ?? e}</Chip>)}
          </>
        )}
        {/* folha de avaliações (montarAvalHtml do protótipo): as que estão na lista */}
        {visiveis.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto"
            onClick={() => void imprimirRelatorio({ tipo: 'avaliacao', pacienteId, internacaoId, ids: filtro ? visiveis.map((a) => a.id) : null })}>
            <Printer /> Imprimir
          </Button>
        )}
      </div>
      {q.isLoading && <div className="flex justify-center py-3"><Spinner /></div>}
      {q.error && <p className="text-apoio text-critico">{msg(q.error)}</p>}
      {visiveis.map((a) => {
        const cancelada = !!a.cancelada_em
        const tom = ESCALAS_AVALIACAO[a.escala] ? faixaDe(a.escala, a.total).tom : 'atencao'
        return (
          <div key={a.id} className="flex flex-col gap-1 border-b border-trilha py-1.5"
            title={cancelada ? `Cancelada por ${a.cancelada_por ?? '—'} em ${quando(a.cancelada_em)}: ${a.motivo_cancelamento}` : undefined}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-controle font-medium text-tinta">{ESCALAS_AVALIACAO[a.escala]?.nome ?? a.escala}</span>
              <Pilula className={cancelada ? 'bg-trilha text-tinta-sussurro line-through' : PILULA[tom]}>Resultado {a.total} · {a.interpretacao}</Pilula>
              <span className="min-w-0 flex-[1_1_200px] text-rotulo text-tinta-sussurro">
                {quando(a.registrado_em)} · {a.autor ?? '—'}
                {cancelada ? ` · cancelada por ${a.cancelada_por ?? '—'} em ${quando(a.cancelada_em)} (${a.motivo_cancelamento})` : ''}
              </span>
              {!cancelada && cancelando !== a.id && (
                <Button size="xs" variant="outline" onClick={() => { setCancelando(a.id); setMotivo('') }}>Cancelar</Button>
              )}
            </div>
            {cancelando === a.id && (
              <div className="flex flex-col gap-2 rounded-controle border border-critico/30 bg-alerta-critico p-2.5">
                <span className="text-apoio text-critico">Cancelar esta avaliação? Continua no histórico; diga por quê.</span>
                <Input aria-label="Motivo do cancelamento" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="flex gap-1.5">
                  <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || ocupado} onClick={() => void cancelar(a)}>Confirmar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelando(null)}>Não</Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {!q.isLoading && visiveis.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhuma avaliação registrada.</span>}
    </Cartao>
  )
}

// ── curva de crescimento ─────────────────────────────────────────────────────
const GRANDEZA: Record<Exclude<Indicador, 'imc'>, Grandeza> = { peso: 'peso', estatura: 'estatura', pc: 'perimetro-cefalico' }
const sinal = (z: number) => (z > 0 ? '+' : z < 0 ? '−' : '') + br(Math.abs(z), 2)

function SecaoCurva({ pacienteId, episodioId, internacaoId, nascimento, sexo }: AbaAvaliacaoCrescimentoProps & {
  nascimento: string | null; sexo: string | null
}) {
  const hoje = hojeSP()
  const motivo = motivoSemCurva(nascimento, sexo, hoje)
  const medidas = useMedidasCrescimento(pacienteId, internacaoId)
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarAvaliacao(pacienteId))
  const idadeHoje = nascimento ? mesesDeIdade(nascimento, hoje) : null
  const [ind, setInd] = React.useState<Indicador>('peso')
  const [intervaloEscolhido, setIntervalo] = React.useState<Intervalo | null>(null)
  const [ligar, setLigar] = React.useState(false)
  const [af, setAf] = React.useState({ data: hoje, peso: '', est: '', pc: '' })

  const def = defIndicador(ind)
  const intervalos = Object.keys(def.intervalos) as Intervalo[]
  const pedido = intervaloEscolhido ?? intervaloDaIdade(idadeHoje)
  const intervalo: Intervalo = def.intervalos[pedido] ? pedido : '0-5'
  const [x0, x1] = def.intervalos[intervalo]!
  const s = sexoDaTabela(sexo)

  // pontos do paciente no intervalo mostrado
  const lista = medidas.data ?? []
  const deGrandeza = (g: Grandeza): Medida[] => lista.filter((m) => m.grandeza === g).map((m) => ({ aferidoEm: m.aferidoEm, valor: m.valor }))
  const serie: Medida[] = ind === 'imc' ? paresImc(deGrandeza('peso'), deGrandeza('estatura')) : deGrandeza(GRANDEZA[ind])
  const pontos: (PontoPaciente & { z: number; percentil: number })[] = []
  if (!motivo && s && nascimento) {
    for (const m of serie) {
      const meses = mesesDeIdade(nascimento, m.aferidoEm)
      if (meses === null || meses < x0 || meses > x1) continue
      const r = avaliarMedida(ind, s, meses, m.valor)
      if (!r) continue
      const cls = ind === 'peso' ? ` · ${classificarPesoIdade(r.z).toLowerCase()}` : ''
      pontos.push({
        meses, valor: Number(m.valor.toFixed(2)), z: r.z, percentil: r.percentil,
        texto: `${dia(m.aferidoEm)} · ${br(m.valor, ind === 'peso' ? 2 : 1)} ${def.unidade} · escore-z ${sinal(r.z)} · percentil ${br(r.percentil)}${cls}`,
      })
    }
  }
  const tabela = s ? tabelaDe(ind, s, intervalo) : null
  const fonte = tabela
    ? tabela.fonte + (ind === 'peso'
      ? `. Classificação: ${SISVAN_2011.citacao}` + (intervalo !== '0-5' ? ' A OMS 2007 só publica peso para a idade até 10 anos.' : '')
      : '. Linhas em escore-z calculadas pelo LMS da própria tabela (método de Cole); além de ±3, o escore-z restrito da OMS.')
    : ''
  const peso = num(af.peso), est = num(af.est), pc = num(af.pc)
  const afOk = !!af.data && [peso, est, pc].some((v) => v !== null && v > 0) && [af.peso, af.est, af.pc].every((t, i) => !t.trim() || [peso, est, pc][i] !== null)

  async function lancar() {
    const feito = await executar(() => supabase.rpc('registrar_afericao_crescimento', {
      p_paciente: pacienteId, p_data: af.data, p_peso: peso ?? undefined, p_estatura: est ?? undefined, p_pc: pc ?? undefined,
      p_episodio: episodioId ?? undefined, p_internacao: internacaoId ?? undefined,
    }), 'Aferição lançada.')
    if (feito) setAf({ data: hoje, peso: '', est: '', pc: '' })
  }

  return (
    <Cartao>
      <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta"><IconeCurva className="size-4 text-acao" aria-hidden /> Curva de crescimento</h3>
      <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
        Curvas da OMS até 19 anos (padrão 2006 do nascimento aos 5 anos; referência 2007 dos 5 aos 19). Aqui só na pediatria: até 13 anos, 11 meses e 29 dias.
      </span>
      {motivo ? (
        <span className="text-apoio text-atencao [text-wrap:pretty]">{motivo}</span>
      ) : (
        <>
          <div role="group" aria-label="Gráfico" className="flex flex-wrap gap-1.5">
            {INDICADORES.map((d) => <Chip key={d.id} ativo={ind === d.id} onClick={() => setInd(d.id)}>{d.rotulo}</Chip>)}
            <Chip ativo={ligar} onClick={() => setLigar(!ligar)}>Linha</Chip>
          </div>
          <div role="group" aria-label="Intervalo" className="flex flex-wrap gap-1.5">
            {intervalos.map((k) => <Chip key={k} ativo={intervalo === k} onClick={() => setIntervalo(k)}>{rotuloIntervalo(ind, k)}</Chip>)}
          </div>
          {ind === 'pc' && idadeHoje !== null && idadeHoje > 60 && (
            <span className="text-apoio text-atencao">A OMS só publica perímetro cefálico para a idade até 5 anos.</span>
          )}
          {ind === 'peso' && idadeHoje !== null && idadeHoje > 120 && (
            <span className="text-apoio text-atencao">A OMS 2007 só publica peso para a idade até 10 anos: acompanhe pelo IMC para a idade.</span>
          )}
          {medidas.isLoading && <div className="flex justify-center py-3"><Spinner /></div>}
          {medidas.error && <p className="text-apoio text-critico">{msg(medidas.error)}</p>}
          {!medidas.isLoading && pontos.length === 0 && (
            <span className="text-apoio text-atencao">
              Nenhuma aferição de {def.grandeza} neste intervalo ({intervalo === '0-5' ? 'nascimento a 5 anos' : `5 a ${Math.floor(x1 / 12)} anos`}).
              {ind === 'imc' ? ' O IMC precisa de peso e estatura do mesmo dia.' : ''}
            </span>
          )}
          {s && <CurvaCrescimento indicador={ind} sexo={s} intervalo={intervalo} pontos={pontos} ligar={ligar} />}
          {pontos.length > 0 && (
            <ul aria-label="Aferições do paciente" className="flex flex-col gap-0.5">
              {pontos.map((p, i) => <li key={i} className="text-apoio text-tinta">{p.texto}</li>)}
            </ul>
          )}
          {ind === 'estatura' && intervalo === '0-5' && (
            <span className="text-rotulo text-tinta-sussurro">Até 23 meses a tabela é de comprimento (deitado); a partir de 24 meses, de estatura (em pé).</span>
          )}
          <span className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">{fonte}</span>

          <div className="flex flex-wrap items-end gap-2 border-t border-trilha pt-2.5">
            <label className="flex flex-col gap-1 text-rotulo text-tinta-apoio">Data
              <Input type="date" value={af.data} max={hoje} min={nascimento ?? undefined} onChange={(e) => setAf({ ...af, data: e.target.value })} />
            </label>
            <label className="flex w-[90px] flex-col gap-1 text-rotulo text-tinta-apoio">Peso (kg)
              <Input inputMode="decimal" value={af.peso} onChange={(e) => setAf({ ...af, peso: e.target.value })} />
            </label>
            <label className="flex w-[110px] flex-col gap-1 text-rotulo text-tinta-apoio">Estatura (cm)
              <Input inputMode="decimal" value={af.est} onChange={(e) => setAf({ ...af, est: e.target.value })} />
            </label>
            <label className="flex w-[90px] flex-col gap-1 text-rotulo text-tinta-apoio">PC (cm)
              <Input inputMode="decimal" value={af.pc} onChange={(e) => setAf({ ...af, pc: e.target.value })} />
            </label>
            <Button size="sm" variant="outline" disabled={!afOk || ocupado} onClick={() => void lancar()}>Lançar aferição</Button>
          </div>
          <Aviso erro={erro} aviso={aviso} />
        </>
      )}
    </Cartao>
  )
}
