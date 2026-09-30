// Acuidade do leito no desenho do protótipo (index.html 2664–2758):
// numeral e banda do NEWS2/PEWS (calculados no banco), a linha de tendência
// das últimas aferições, "Motivo do alerta" com os itens e o qSOFA do adulto,
// e o lançamento de vitais no mesmo cartão.
//
// A tendência (item 4 do protótipo, 27/08): o último ponto é o escore de
// agora — a linha não termina num número diferente do numeral ao lado; a cor
// é a da banda de agora; menos de dois pontos não é tendência.
import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Check, Thermometer } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { FONTE_QSOFA, qsofa } from '@/clinico/qsofa'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { Caixa, Chip } from './caixas'
import { type Acuidade, hora, msg } from './comum'

const BANDA_ROTULO = ['risco baixo', 'atenção', 'risco alto']
const BANDA_TEXTO = ['text-conforme', 'text-observacao', 'text-critico']
const BANDA_TRACO = ['stroke-conforme', 'stroke-observacao', 'stroke-critico']
const BANDA_PONTO = ['fill-conforme', 'fill-observacao', 'fill-critico']

type Ponto = { aferido_em: string; total: number; banda: number; parcial: boolean }

/** Texto de intervalo curto: "40 min", "6h", "2 dias". */
function intervalo(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)} dias`
}

/** Pontos do SVG (104×30, margem 4), com teto mínimo de 4 para a linha não gritar à toa. */
function geometriaSparkline(valores: number[], largura = 104, altura = 30, margem = 4) {
  const max = Math.max(4, ...valores)
  const min = Math.min(0, ...valores)
  const faixa = max - min || 1
  const px = (i: number) => margem + (i * (largura - margem * 2)) / Math.max(1, valores.length - 1)
  const py = (v: number) => altura - margem - ((v - min) * (altura - margem * 2)) / faixa
  return {
    pontos: valores.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' '),
    fimX: px(valores.length - 1),
    fimY: py(valores[valores.length - 1] ?? 0),
  }
}

export function BlocoAcuidade({ a, carregando, pacienteId, internacaoId, podeLancar, prontuarioAberto, perfilId, aoGravar, aoErro }: {
  a?: Acuidade
  carregando: boolean
  pacienteId: string
  internacaoId: string
  podeLancar: boolean
  prontuarioAberto: boolean
  perfilId?: string
  aoGravar: () => void
  aoErro: (m: string) => void
}) {
  const [motivoAberto, setMotivoAberto] = React.useState(false)
  const [lancando, setLancando] = React.useState(false)

  const serie = useQuery({
    queryKey: ['tendencia-acuidade', pacienteId],
    enabled: !!a?.escala,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tendencia_acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as Ponto[]
    },
  })

  if (carregando) return <Spinner />
  if (!a) return null
  if (!a.escala) {
    return <Caixa className="px-4 py-3.5 text-apoio text-tinta-sussurro">{a.motivo}</Caixa>
  }
  const semAfericao = !a.aferido_em
  const banda = a.banda ?? 0
  const pediatrico = a.escala === 'PEWS'

  // série + o escore de agora no fim (se o banco ainda não o tem na série)
  const pts: Ponto[] = [...(serie.data ?? [])]
  if (!semAfericao && a.total !== undefined) {
    const ultimo = pts[pts.length - 1]
    if (!ultimo || Date.parse(ultimo.aferido_em) !== Date.parse(a.aferido_em!)) {
      pts.push({ aferido_em: a.aferido_em!, total: a.total, banda, parcial: !!a.parcial })
    } else {
      pts[pts.length - 1] = { ...ultimo, total: a.total, banda }
    }
  }
  const ultimos = pts.slice(-9)
  const de = ultimos[0]?.total
  const para = ultimos[ultimos.length - 1]?.total
  const rumo = de === undefined || para === undefined ? '' : para > de ? `sobe de ${de} para ${para}` : para < de ? `cai de ${de} para ${para}` : `estável em ${para}`
  const janela = ultimos.length > 1 ? intervalo(Date.parse(ultimos[ultimos.length - 1].aferido_em) - Date.parse(ultimos[0].aferido_em)) : ''
  const geo = ultimos.length > 1 ? geometriaSparkline(ultimos.map((p) => p.total)) : null

  return (
    <Caixa>
      <div className="flex flex-wrap items-center gap-4 border-b border-fio bg-superficie px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold tracking-[0.07em] text-tinta-sussurro uppercase">
            {a.escala}{a.grupo ? ` · ${a.grupo}` : ''}
          </span>
          {semAfericao ? (
            <span className="text-apoio text-tinta-sussurro">sem aferição em 24 h</span>
          ) : (
            <div className="flex items-baseline gap-2.5">
              <span className={cn('text-[30px] leading-[0.9] font-semibold tracking-[-0.02em] tabular-nums', BANDA_TEXTO[banda])}>
                {a.total}{a.parcial ? '*' : ''}
              </span>
              <span className={cn('text-apoio font-medium', BANDA_TEXTO[banda])}>
                {BANDA_ROTULO[banda]}{(a.azul ?? []).length > 0 ? ` · zona azul: ${a.azul!.join(', ')}` : ''}
              </span>
            </div>
          )}
        </div>

        {geo ? (
          <button type="button" onClick={() => setMotivoAberto((x) => !x)}
            aria-label={`Tendência do ${a.escala} em ${janela}: ${rumo}. Abre o motivo do alerta.`}
            className="-ml-1 flex shrink-0 flex-col items-start gap-0.5 rounded-[9px] px-1.5 py-1 hover:bg-marca/[0.06]">
            <svg viewBox="0 0 104 30" width="104" height="30" aria-hidden className="block">
              <polyline points={geo.pontos} fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={BANDA_TRACO[banda]} />
              <circle cx={geo.fimX.toFixed(1)} cy={geo.fimY.toFixed(1)} r="2.7" className={BANDA_PONTO[banda]} />
            </svg>
            <span className="text-[12px] whitespace-nowrap text-tinta-sussurro">{janela} · {rumo}</span>
          </button>
        ) : !semAfericao && !serie.isLoading ? (
          <span className="shrink-0 text-[12px] whitespace-nowrap text-tinta-sussurro">Aferição única · sem tendência ainda</span>
        ) : null}

        <span className="min-w-0 flex-[1_1_200px] text-apoio text-pretty text-tinta-sussurro">
          {semAfericao ? 'Lance os sinais vitais para o escore.' : `Aferido às ${hora(a.aferido_em)}`}
        </span>
        {!semAfericao && (
          <button type="button" onClick={() => setMotivoAberto((x) => !x)} aria-expanded={motivoAberto}
            className="flex items-center gap-1.5 rounded-[9px] border border-fio bg-superficie px-[11px] py-1.5 text-apoio font-medium whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao">
            <Activity className="size-3.5" aria-hidden /> Motivo do alerta
          </button>
        )}
        {podeLancar && !lancando && (
          <button type="button" onClick={() => setLancando(true)}
            className="flex items-center gap-1.5 rounded-[9px] bg-acao px-3 py-[7px] text-apoio font-medium whitespace-nowrap text-white hover:bg-acao-pressionada">
            <Thermometer className="size-3.5" aria-hidden /> Lançar vitais
          </button>
        )}
      </div>

      {a.parcial && !semAfericao && (
        <div className="flex items-start gap-2 border-b border-fio bg-atencao/[0.04] px-4 py-[11px]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-atencao" aria-hidden />
          <span className="text-apoio leading-[1.45] text-pretty text-atencao">
            Escore parcial: {(a.faltando ?? []).join(', ').toLowerCase()} sem medida. O asterisco no numeral marca isso.
          </span>
        </div>
      )}

      {motivoAberto && !semAfericao && (
        <div className="border-b border-fio bg-superficie">
          {(a.itens ?? []).map((x) => (
            <div key={x.rotulo} className="flex items-center gap-3 border-b border-trilha px-4 py-[9px]">
              <span className="min-w-0 flex-1 text-controle text-grafite">{x.rotulo}</span>
              <span className="text-controle whitespace-nowrap text-tinta tabular-nums">{x.valor}</span>
              <span className={cn('text-apoio font-semibold whitespace-nowrap tabular-nums',
                x.azul ? 'text-suprimento' : x.pontos >= 3 ? 'text-critico' : x.pontos > 0 ? 'text-observacao' : 'text-tinta-sussurro')}>
                {x.azul ? 'azul' : `+${x.pontos}`}
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-1.5 px-4 py-[11px]">
            {pediatrico ? (
              <span className="text-apoio font-semibold text-grafite">qSOFA não se aplica a pediatria.</span>
            ) : (
              <MotivoQsofa pacienteId={pacienteId} habilitado={prontuarioAberto} />
            )}
            <span className="text-apoio leading-[1.45] text-pretty text-tinta-sussurro">
              {a.fonte} O escore apoia; a conduta é da equipe.
            </span>
          </div>
        </div>
      )}

      {lancando && (
        <LancarVitais pacienteId={pacienteId} internacaoId={internacaoId} pediatrico={pediatrico} perfilId={perfilId}
          aoFechar={() => setLancando(false)}
          aoGravar={() => { setLancando(false); aoGravar() }} aoErro={aoErro} />
      )}
    </Caixa>
  )
}

// ── qSOFA dos vitais crus (últimas 24 h) ───────────────────────────────────
type VitalCru = { valor_num: number | null; aferido_em: string; conceito: { nome: string } | null; opcao: { valor: string } | null }

function MotivoQsofa({ pacienteId, habilitado }: { pacienteId: string; habilitado: boolean }) {
  const vitais = useQuery({
    queryKey: ['vitais-qsofa', pacienteId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao')
        .select('valor_num, aferido_em, conceito:conceito_id(nome), opcao:valor_conceito_id(valor)')
        .eq('paciente_id', pacienteId)
        .gte('aferido_em', new Date(Date.now() - 24 * 3600_000).toISOString())
        .order('aferido_em', { ascending: false })
        .limit(300)
      if (error) throw error
      return (data ?? []) as unknown as VitalCru[]
    },
  })
  if (!habilitado || vitais.isLoading) return <span className="text-apoio text-tinta-sussurro">Calculando o qSOFA…</span>
  if (vitais.error) return <span className="text-apoio text-atencao">qSOFA não calculado: {msg(vitais.error)}</span>
  // o mais recente de cada sinal (a lista vem do mais novo para o mais velho)
  const ultimo = new Map<string, VitalCru>()
  for (const v of vitais.data ?? []) if (v.conceito && !ultimo.has(v.conceito.nome)) ultimo.set(v.conceito.nome, v)
  const n = (nome: string) => ultimo.get(nome)?.valor_num ?? null
  const r = qsofa({
    fr: n('frequencia-respiratoria'),
    pas: n('pressao-arterial-sistolica'),
    glasgow: n('glasgow'),
    consciencia: ultimo.get('nivel-consciencia')?.opcao?.valor ?? null,
  })
  return (
    <>
      <span className={cn('text-apoio font-semibold', r.alerta ? 'text-critico' : 'text-grafite')}>{r.texto}</span>
      <div className="flex flex-wrap gap-3.5">
        {r.itens.map((q) => (
          <span key={q.id} className="flex items-baseline gap-1.5 text-apoio text-tinta-sussurro">
            {q.rotulo}{q.valor ? ` (${q.valor})` : ' (não medido)'}
            <span className={cn('font-semibold tabular-nums', q.pontos ? 'text-observacao' : 'text-tinta-sussurro')}>+{q.pontos}</span>
          </span>
        ))}
      </div>
      <span className="text-apoio leading-[1.45] text-pretty text-tinta-sussurro">{FONTE_QSOFA}</span>
    </>
  )
}

// ── lançar vitais ───────────────────────────────────────────────────────────
type Conceito = { id: string; nome: string; opcoes: { id: string; rotulo: string }[] }
const NUMERICOS = [
  ['pressao-arterial-sistolica', 'PAS', 'mmHg'],
  ['frequencia-cardiaca', 'FC', 'bpm'],
  ['frequencia-respiratoria', 'FR', 'irpm'],
  ['temperatura', 'Temp.', '°C'],
  ['saturacao-o2', 'SpO₂', '%'],
] as const
const NUMERICOS_ADULTO = [['glasgow', 'Glasgow', '3–15']] as const
// pediatria: o que o Phoenix pede além do PEWS
const NUMERICOS_PED = [
  ['pressao-arterial-diastolica', 'PAD', 'mmHg'],
  ['pressao-arterial-media', 'PAM medida', 'mmHg'],
  ['fio2', 'FiO₂', '%'],
  ['glasgow', 'Glasgow', '3–15'],
  ['drogas-vasoativas', 'Vasoativas', 'nº'],
] as const
const EXAMES = [
  ['po2', 'PaO₂ arterial', 'mmHg'],
  ['pco2', 'PaCO₂', 'mmHg'],
  ['creatinina', 'Creatinina', 'mg/dL'],
  ['leucocitos', 'Leucócitos', '/mm³'],
  ['lactato', 'Lactato', 'mmol/L'],
  ['plaquetas', 'Plaquetas', '/mm³'],
  ['inr', 'INR', ''],
  ['d-dimero', 'D-dímero', 'mg/L FEU'],
  ['fibrinogenio', 'Fibrinogênio', 'mg/dL'],
] as const

function CampoNumero({ nome, rotulo, unidade, valor, mudar }: { nome: string; rotulo: string; unidade: string; valor: string; mudar: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`v-${nome}`} className="text-[12px] font-medium text-tinta-sussurro">{rotulo}</label>
      <div className="flex items-center gap-1.5 rounded-[9px] border border-fio bg-campo px-2.5 py-[7px] focus-within:border-marca">
        <input id={`v-${nome}`} inputMode="decimal" value={valor} onChange={(e) => mudar(e.target.value)}
          className="w-full min-w-0 flex-1 border-0 bg-transparent text-corpo text-tinta tabular-nums outline-none" />
        {unidade && <span className="text-[12px] whitespace-nowrap text-tinta-sussurro">{unidade}</span>}
      </div>
    </div>
  )
}

export function LancarVitais({ pacienteId, internacaoId, pediatrico, perfilId, aoGravar, aoFechar, aoErro }: {
  pacienteId: string; internacaoId: string; pediatrico: boolean; perfilId?: string
  aoGravar: () => void; aoFechar: () => void; aoErro: (m: string) => void
}) {
  const [v, setV] = React.useState<Record<string, string>>({})
  const categoricos = pediatrico
    ? [['oxigenio-suplementar', 'Oxigênio'], ['esforco-respiratorio', 'Esforço respiratório'], ['enchimento-capilar', 'Enchimento capilar central'],
       ['suporte-respiratorio', 'Suporte respiratório'], ['pupilas', 'Pupilas']]
    : [['oxigenio-suplementar', 'Oxigênio'], ['nivel-consciencia', 'Nível de consciência']]
  const conceitos = useQuery({
    queryKey: ['conceitos-vitais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceito')
        .select('id, nome, conceito_opcao(id, rotulo, ordem)')
        .is('unidade_id', null)
        .in('categoria', ['sinal_vital', 'laboratorio'])
      if (error) throw error
      return (data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        opcoes: [...(c.conceito_opcao ?? [])].sort((a, b) => a.ordem - b.ordem),
      })) as Conceito[]
    },
  })
  const gravar = useMutation({
    mutationFn: async () => {
      if (!perfilId) throw new Error('Sem sessão.')
      const porNome = new Map((conceitos.data ?? []).map((c) => [c.nome, c]))
      const itens = Object.entries(v)
        .filter(([, x]) => x.trim() !== '')
        .map(([nome, x]) => {
          const c = porNome.get(nome)
          if (!c) throw new Error(`Conceito ${nome} não encontrado.`)
          if (c.opcoes.length > 0) {
            return novoItem('observacao', { internacao_id: internacaoId, paciente_id: pacienteId, conceito_id: c.id, valor_conceito_id: x, origem: 'manual' })
          }
          const milhar = nome === 'plaquetas' || nome === 'leucocitos'
          const n = Number(x.replace(/\./g, milhar ? '' : '.').replace(',', '.'))
          if (Number.isNaN(n)) throw new Error(`Valor inválido em ${nome}.`)
          if (nome === 'plaquetas' && n < 1000) throw new Error('Plaquetas em /mm³ (ex.: 95000), não em milhares.')
          return novoItem('observacao', { internacao_id: internacaoId, paciente_id: pacienteId, conceito_id: c.id, valor_num: n, origem: 'manual' })
        })
      if (itens.length === 0) throw new Error('Preencha ao menos um sinal vital.')
      const r = await gravarRegistros(perfilId, itens)
      if (r.recusados.length > 0) throw new Error(r.recusados[0].replace(/^SYNC_[A-Z_]+: /, ''))
    },
    onSuccess: () => {
      setV({})
      aoGravar()
    },
    onError: (e) => aoErro(msg(e)),
  })
  const algo = Object.values(v).some((x) => x.trim() !== '')
  const set = (nome: string) => (x: string) => setV((s) => ({ ...s, [nome]: x }))
  const numericos = [...NUMERICOS, ...(pediatrico ? NUMERICOS_PED : NUMERICOS_ADULTO)]

  return (
    <div className="flex flex-col gap-3 bg-superficie px-4 py-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {numericos.map(([nome, rotulo, unidade]) => (
          <CampoNumero key={nome} nome={nome} rotulo={rotulo} unidade={unidade} valor={v[nome] ?? ''} mudar={set(nome)} />
        ))}
      </div>
      {categoricos.map(([nome, rotulo]) => {
        const c = conceitos.data?.find((x) => x.nome === nome)
        if (!c) return null
        return (
          <div key={nome} className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={rotulo}>
            <span className="mr-1 text-[12px] font-medium text-tinta-sussurro">{rotulo}</span>
            {c.opcoes.map((o) => (
              <Chip key={o.id} role="radio" aria-checked={v[nome] === o.id} ativo={v[nome] === o.id}
                onClick={() => set(nome)(v[nome] === o.id ? '' : o.id)}>
                {o.rotulo}
              </Chip>
            ))}
          </div>
        )
      })}
      {pediatrico && (
        <>
          <p className="text-apoio text-pretty text-pediatria">
            Vasoativas: adrenalina, noradrenalina, dopamina, dobutamina, milrinona ou vasopressina, em qualquer dose (Phoenix).
          </p>
          <div className="text-[12px] font-semibold tracking-wide text-tinta-sussurro uppercase">Exames (Phoenix e PELOD-2)</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {EXAMES.map(([nome, rotulo, unidade]) => (
              <CampoNumero key={nome} nome={nome} rotulo={rotulo} unidade={unidade} valor={v[nome] ?? ''} mudar={set(nome)} />
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-[1_1_220px] text-apoio text-pretty text-tinta-sussurro">
          Deixe em branco o que não foi medido. O escore sai marcado como parcial. O valor fica cru, sem marca de alterado.
        </span>
        <Button size="sm" variant="outline" onClick={aoFechar}>Cancelar</Button>
        <Button size="sm" onClick={() => gravar.mutate()} disabled={!algo || gravar.isPending || conceitos.isLoading}>
          {gravar.isPending ? <Spinner /> : <Check />} Salvar aferição
        </Button>
      </div>
    </div>
  )
}
