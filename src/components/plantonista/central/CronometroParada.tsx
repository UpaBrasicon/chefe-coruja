import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, HeartPulse, Volume2, VolumeX } from 'lucide-react'

import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import {
  COMPRESSOES_POR_MIN, EPI_MAX_MS, EPI_MIN_MS, RITMOS_PARADA, acaoAgora, antiarritmicoLiberado, desdeAEpinefrina,
  dosesDaParada, epinefrinaDevida, horaDoRegistro, minSeg, restaDoCiclo, ritmoDaParada, situacaoDaParada, textoDoRegistro,
  CHOQUES_ANTES_DA_EPINEFRINA, CHOQUES_ANTES_DO_ANTIARRITMICO,
  type EstadoParada, type EventoParada, type PublicoParada, type RitmoParada, type TipoEvento,
} from '@/clinico/cronometroParada'
import { CAUSAS_REVERSIVEIS, FERRAMENTAS_DO_CRONOMETRO } from '@/content/cronometroParada'
import { alterarPaciente, usePacienteCentral } from '@/lib/pacienteCentral'
import { pesoDaDoseDoPaciente } from '@/lib/fitaDoPeso'
import { cn } from '@/lib/utils'
import { CampoGrande, ChaveDoPaciente, CorDaFita, DetalheDaFita } from './CamposDoGuia'

// Cronômetro da parada (G3), criança e adulto, construído com o RT no protótipo
// de 18/11/2026: "Iniciar parada" → ritmo → conduta com UMA ação agora e os
// próximos com contagem. Só na tela: o registro vive nesta aba enquanto o app
// está aberto (como a Central do paciente) e é copiado pelo médico; nada vai ao
// banco nem ao armazenamento do aparelho.

let registroDaAba: EstadoParada | null = null

// ── avisos: bipe, vibração e tela acesa ──
let audio: AudioContext | null = null
function contexto(): AudioContext | null {
  try {
    audio ??= new AudioContext()
    void audio.resume()
    return audio
  } catch { return null }
}
function tom(a: AudioContext, em: number, freq: number, dura: number, volume: number) {
  const o = a.createOscillator()
  const g = a.createGain()
  o.frequency.value = freq
  o.connect(g); g.connect(a.destination)
  g.gain.setValueAtTime(volume, em)
  g.gain.exponentialRampToValueAtTime(0.001, em + dura)
  o.start(em); o.stop(em + dura + 0.02)
}
function bipe(vezes: number) {
  const a = contexto()
  if (a) for (let i = 0; i < vezes; i++) tom(a, a.currentTime + i * 0.25, 880, 0.18, 0.25)
  try { navigator.vibrate?.([220, 100, 220]) } catch { /* sem vibração (iPhone) */ }
}

function useTelaAcesa(ligada: boolean) {
  useEffect(() => {
    if (!ligada) return
    let trava: WakeLockSentinel | null = null
    const pedir = () => { navigator.wakeLock?.request('screen').then((t) => { trava = t }).catch(() => {}) }
    pedir()
    const voltou = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', voltou)
    return () => { document.removeEventListener('visibilitychange', voltou); void trava?.release().catch(() => {}) }
  }, [ligada])
}

/** Metrônomo das compressões (pedido do RT): liga e desliga a qualquer momento. */
function useMetronomo(ligado: boolean) {
  useEffect(() => {
    if (!ligado) return
    const a = contexto()
    if (!a) return
    let proximo = a.currentTime + 0.05
    const id = window.setInterval(() => {
      while (proximo < a.currentTime + 0.2) { tom(a, proximo, 1200, 0.05, 0.18); proximo += 60 / COMPRESSOES_POR_MIN }
    }, 50)
    return () => window.clearInterval(id)
  }, [ligado])
}

// ── tira de ECG desenhada (esquema próprio, no papel milimetrado) ──
function pontosDaTira(ritmo: RitmoParada): string {
  const L = 320, M = 42, pts: string[] = []
  let semente = 11
  const acaso = () => (semente = (semente * 9301 + 49297) % 233280) / 233280
  const complexo = (f: number) => {
    if (f < 6) return -3 * Math.sin((f / 6) * Math.PI)
    if (f < 12) return 0
    if (f < 14) return 4
    if (f < 17) return -30 + (f - 14) * 2
    if (f < 20) return 10
    if (f > 30 && f < 44) return -7 * Math.sin(((f - 30) / 14) * Math.PI)
    return 0
  }
  for (let x = 0; x <= L; x += 1.5) {
    let y = M
    if (ritmo === 'fv') y = M + Math.sin(x / 6.5 + Math.sin(x / 23) * 2) * (8 + 12 * Math.abs(Math.sin(x / 41))) + (acaso() - 0.5) * 5
    if (ritmo === 'tv') { const f = (x % 34) / 34; y = M + (f < 0.45 ? -26 * Math.sin((f / 0.45) * Math.PI) : 18 * Math.sin(((f - 0.45) / 0.55) * Math.PI)) }
    if (ritmo === 'aesp') y = M + complexo(x % 80)
    if (ritmo === 'assistolia') y = M + Math.sin(x / 37) * 1.6 + (acaso() - 0.5) * 1.2
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

function FitaEcg({ ritmo }: { ritmo: RitmoParada }) {
  const pontos = useMemo(() => pontosDaTira(ritmo), [ritmo])
  const linhas: React.ReactNode[] = []
  for (let x = 0; x <= 320; x += 8) linhas.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={84} strokeWidth={x % 40 ? 0.5 : 1} stroke={x % 40 ? '#F6CFDF' : '#E9A3C1'} />) // padrao-ok: papel milimetrado de ECG
  for (let y = 0; y <= 84; y += 8) linhas.push(<line key={`y${y}`} x1={0} y1={y} x2={320} y2={y} strokeWidth={y % 40 ? 0.5 : 1} stroke={y % 40 ? '#F6CFDF' : '#E9A3C1'} />) // padrao-ok: papel milimetrado de ECG
  return (
    <svg viewBox="0 0 320 84" preserveAspectRatio="none" aria-hidden className="block size-full">
      <rect width={320} height={84} fill="#FFF7FA" /> {/* padrao-ok: papel de ECG, igual nos dois temas */}
      {linhas}
      <polyline fill="none" stroke="#1E293B" strokeWidth={1.8} strokeLinejoin="round" points={pontos} /> {/* padrao-ok: traçado escuro sobre o papel claro */}
    </svg>
  )
}

const ROTULO: Partial<Record<TipoEvento, string>> = { acesso: 'Acesso IV/IO', 'via-aerea': 'Via aérea avançada' }

export function CronometroParada() {
  const p = usePacienteCentral()
  const idPeso = useId()
  const [registro, setRegistro] = useState<EstadoParada | null>(() => registroDaAba)
  const [agora, setAgora] = useState(() => Date.now())
  const [forcarRitmo, setForcarRitmo] = useState(false)
  const [som, setSom] = useState(false)
  const avisos = useRef(new Set<string>())
  const atual = useRef(registro)

  useEffect(() => { registroDaAba = registro; atual.current = registro }, [registro])
  const s = registro ? situacaoDaParada(registro) : null
  const correndo = !!s && !s.encerrada
  useTelaAcesa(correndo)
  useMetronomo(correndo && som && !s?.rce)

  const anota = (tipo: TipoEvento, texto: string, ritmo?: RitmoParada) =>
    setRegistro((r) => (r ? { ...r, eventos: [...r.eventos, { tipo, em: Date.now(), texto, ritmo } satisfies EventoParada] } : r))

  // relógio: a cada 250 ms; fim do ciclo e epinefrina de 3 e 5 min dão bipe uma vez
  useEffect(() => {
    if (!correndo) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setAgora(t)
      const r = atual.current
      if (!r) return
      const x = situacaoDaParada(r)
      if (x.rce || x.encerrada) return
      const resta = restaDoCiclo(x, t)
      const chave = `c${x.ciclo}-${x.choques}`
      if (resta !== null && resta <= 0 && !avisos.current.has(chave)) {
        avisos.current.add(chave)
        bipe(3)
        setRegistro((y) => (y ? { ...y, eventos: [...y.eventos, { tipo: 'fim-ciclo', em: t, texto: `Fim do ciclo ${x.ciclo}: checar o ritmo e trocar quem comprime` }] } : y))
      }
      const desde = desdeAEpinefrina(x, t)
      if (desde !== null && desde >= EPI_MIN_MS && !avisos.current.has(`e3-${x.epinefrinas}`)) { avisos.current.add(`e3-${x.epinefrinas}`); bipe(2) }
      if (desde !== null && desde >= EPI_MAX_MS && !avisos.current.has(`e5-${x.epinefrinas}`)) { avisos.current.add(`e5-${x.epinefrinas}`); bipe(3) }
    }, 250)
    return () => window.clearInterval(id)
  }, [correndo])

  const publico: PublicoParada | null = p.modo === 'pediatrico' ? 'crianca' : p.modo === 'adulto' ? 'adulto' : null
  const peso = pesoDaDoseDoPaciente(p)
  const kg = peso.origem === 'nenhum' ? null : peso.kg

  if (!registro || !s) {
    const iniciar = () => {
      if (!publico) return
      contexto()
      avisos.current = new Set()
      const t = Date.now()
      setForcarRitmo(false)
      setRegistro({
        publico, pesoKg: kg,
        eventos: [{ tipo: 'inicio', em: t, texto: `Início da parada (${publico === 'crianca' ? `criança, ${kg ? `${kg} kg` : 'sem peso'}` : 'adulto'})` }],
      })
      setAgora(t)
      bipe(1)
    }
    return (
      <div className="flex flex-col gap-4">
        <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
          <ArrowLeft className="size-5" aria-hidden /> Guia rápido
        </Link>
        <TituloPagina titulo="Cronômetro da parada" descricao="Ritmo, choque, drogas e registro com horário" className="mb-0" />
        <ChaveDoPaciente />
        {publico && (
          <div className="grid grid-cols-2 gap-2.5">
            <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso} aoMudar={(v) => alterarPaciente({ peso: v })} />
            {publico === 'crianca' ? <><CorDaFita /><DetalheDaFita /></> : null}
          </div>
        )}
        {publico === 'crianca' && !kg && (
          <p className="text-controle text-tinta-apoio">Sem peso, o cronômetro conta o tempo e mostra a conduta, mas não mostra as doses.</p>
        )}
        <Button type="button" onClick={iniciar} disabled={!publico}
          // padrao-ok: botão de emergência grande, pedido do RT
          className="min-h-30 w-full gap-3 rounded-cartao bg-critico text-[26px] font-extrabold tracking-wide text-sobre-acao hover:bg-critico/90">
          <HeartPulse className="size-9" aria-hidden /> INICIAR PARADA
        </Button>
        <p className="text-apoio text-tinta-apoio">
          Ao tocar: começa o tempo total, abre o ciclo de 2 min e pede o ritmo. Tela sempre acesa, bipe e vibração. Nada é gravado: no fim, copie o registro.
        </p>
        {publico && <ListaFerramentas ferramentas={FERRAMENTAS_DO_CRONOMETRO[publico]} />}
      </div>
    )
  }

  const doses = dosesDaParada(registro.publico, registro.pesoKg)
  const resta = restaDoCiclo(s, agora)
  const acao = acaoAgora(s, agora)
  const r = s.ritmo ? ritmoDaParada(s.ritmo) : null
  // volta à escolha do ritmo no fim de cada ciclo (ou quando o médico pede)
  const ultimo = (tipo: TipoEvento) => registro.eventos.reduce((m, e) => (e.tipo === tipo ? e.em : m), -1)
  const mostraRitmos = !s.rce && !s.encerrada && (forcarRitmo || !r || ultimo('fim-ciclo') > Math.max(ultimo('ritmo'), ultimo('choque')))

  const escolheRitmo = (id: RitmoParada) => {
    const x = ritmoDaParada(id)
    anota('ritmo', `Ritmo: ${x.nome} (${x.chocavel ? 'chocável' : 'não chocável'})`, id)
    setForcarRitmo(false)
  }
  const darChoque = () => {
    const d = doses?.choque(s.choques)
    anota('choque', `Choque ${s.choques + 1}${d ? `: ${d.valor}` : ''}${r ? ` (${r.curto})` : ''}`)
  }
  const darEpi = () => anota('epinefrina', `Epinefrina ${s.epinefrinas + 1}${doses ? `: ${doses.epinefrina.valor} (${doses.epinefrina.detalhe.split(' · ')[0]})` : ''}`)

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 grid grid-cols-[1.6fr_1fr] gap-2 border-b border-fio-forte bg-superficie px-4 py-2.5">
        <div className={cn('grid rounded-cartao bg-trilha px-3.5 py-2 transition-colors',
          s.rce ? 'bg-alerta-conforme' : resta !== null && resta <= 0 ? 'bg-alerta-critico' : resta !== null && resta <= 15_000 ? 'bg-alerta-atencao' : '')}>
          <span className="text-rotulo font-semibold text-tinta-apoio">{s.rce ? 'Circulação de volta' : `Ciclo ${s.ciclo} · 2 min`}</span>
          <strong className={cn('font-mono text-numeral-critico leading-none font-bold tabular-nums',
            resta !== null && resta <= 0 ? 'text-critico' : resta !== null && resta <= 15_000 ? 'text-atencao' : 'text-tinta')}>
            {s.rce ? 'RCE' : resta !== null ? minSeg(resta) : '--:--'}
          </strong>
        </div>
        <div className="grid content-center rounded-cartao bg-trilha px-3 py-2">
          <span className="text-rotulo font-semibold text-tinta-apoio">Total</span>
          <strong className="font-mono text-numeral-compacto font-bold tabular-nums">{minSeg(agora - (s.inicio ?? agora))}</strong>
        </div>
        <Button type="button" variant="outline" aria-pressed={som} onClick={() => setSom(!som)}
          className={cn('col-span-2 min-h-11 text-controle font-semibold whitespace-normal', som && 'border-acao bg-alerta-marca text-acao')}>
          {som ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
          {som ? `Som das compressões: ligado (${COMPRESSOES_POR_MIN}/min)` : 'Som das compressões: desligado'}
        </Button>
      </div>

      {s.encerrada ? (
        <p className="text-corpo font-semibold text-tinta">Parada encerrada. Copie o registro para o prontuário.</p>
      ) : s.rce ? (
        <div className="flex flex-col gap-3 rounded-cartao bg-alerta-conforme p-4">
          <span className="text-controle font-bold text-conforme">Retorno da circulação</span>
          <span className="text-controle text-tinta-apoio">Cuidados pós-parada. Se o pulso sumir de novo, volte ao ritmo.</span>
          <Button type="button" variant="outline" className="min-h-12 text-corpo font-semibold"
            onClick={() => anota('nova-parada', 'Nova parada depois do RCE')}>
            Perdeu o pulso: voltar ao ritmo
          </Button>
        </div>
      ) : mostraRitmos ? (
        <EscolhaDoRitmo aoEscolher={escolheRitmo} aoRce={() => anota('rce', 'RCE: retorno da circulação espontânea')} />
      ) : r && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-dialogo font-bold text-tinta">{r.curto}</span>
            <span className={cn('rounded-capsula px-2.5 py-0.5 text-rotulo font-semibold', r.chocavel ? 'bg-alerta-critico text-critico' : 'bg-trilha text-tinta-apoio')}>
              {r.chocavel ? 'chocável' : 'não chocável'}
            </span>
          </div>
          {acao === 'choque' && (
            <Agora tom="critico" titulo={`Agora: choque ${s.choques + 1}`} valor={doses?.choque(s.choques).valor ?? 'Choque'} detalhe={doses?.choque(s.choques).detalhe ?? 'digite o peso para a carga'}
              botao="Choque dado" aoTocar={darChoque} />
          )}
          {acao === 'epinefrina' && (
            <Agora tom="atencao" titulo={`Agora: epinefrina ${s.epinefrinas + 1}`} valor={doses?.epinefrina.valor ?? 'Epinefrina'} detalhe={doses?.epinefrina.detalhe ?? 'digite o peso para a dose'}
              botao="Epinefrina dada" aoTocar={darEpi} />
          )}
          {acao === 'compressoes' && (
            <div className="flex flex-col gap-1.5 rounded-cartao bg-alerta-marca p-4">
              <span className="text-controle font-bold text-acao">Agora: compressões</span>
              <span className="text-numeral-compacto font-extrabold text-tinta">Comprima forte e rápido</span>
              <span className="text-controle text-tinta-apoio">sem parar até o fim do ciclo{r.chocavel && s.choqueNesteCiclo ? '; depois do choque, sem checar o pulso' : ''}</span>
            </div>
          )}

          <TituloSecao className="mb-0">Próximos</TituloSecao>
          <ul className="flex flex-col gap-2">
            {r.chocavel ? (
              <Proximo rotulo="Próximo choque" valor={doses?.choque(s.choqueNesteCiclo ? s.choques : s.choques + 1).valor ?? ''}
                quando={<>na checagem do ritmo, em <Conta ms={resta} />, se continuar {r.curto}</>} />
            ) : (
              <Proximo rotulo="Checar o ritmo" valor="pulso e ritmo" quando={<>em <Conta ms={resta} /></>} />
            )}
            {s.epinefrinas > 0 ? (
              <Proximo rotulo={`Epinefrina ${s.epinefrinas + 1}`} valor={doses?.epinefrina.valor ?? ''}
                quando={epinefrinaDevida(s, agora) ? <b className="text-conforme">já pode (até 5 min da última)</b>
                  : <>em <Conta ms={EPI_MIN_MS - (desdeAEpinefrina(s, agora) ?? 0)} /> (3 a 5 min da última)</>} />
            ) : r.chocavel && s.choques < CHOQUES_ANTES_DA_EPINEFRINA ? (
              <Proximo rotulo="Epinefrina 1" valor={doses?.epinefrina.valor ?? ''} quando={`depois do ${CHOQUES_ANTES_DA_EPINEFRINA}º choque (faltam ${CHOQUES_ANTES_DA_EPINEFRINA - s.choques})`} />
            ) : null}
            {r.chocavel && (
              <Proximo rotulo={s.antiarritmicos === 0 ? 'Amiodarona' : 'Amiodarona, dose seguinte'} valor={doses?.amiodarona(s.antiarritmicos).valor ?? ''}
                quando={antiarritmicoLiberado(s)
                  ? <b className="text-conforme">já pode{doses ? ` (ou lidocaína ${doses.lidocaina.valor})` : ''}</b>
                  : `depois do ${CHOQUES_ANTES_DO_ANTIARRITMICO}º choque (faltam ${CHOQUES_ANTES_DO_ANTIARRITMICO - s.choques})`} />
            )}
          </ul>

          <div className="flex flex-wrap gap-2">
            {antiarritmicoLiberado(s) && (
              <>
                <Button type="button" variant="outline" className="min-h-12 text-controle font-semibold"
                  onClick={() => anota('amiodarona', `Amiodarona${doses ? `: ${doses.amiodarona(s.antiarritmicos).valor}` : ''}`)}>Amiodarona dada</Button>
                <Button type="button" variant="outline" className="min-h-12 text-controle font-semibold"
                  onClick={() => anota('lidocaina', `Lidocaína${doses ? `: ${doses.lidocaina.valor}` : ''}`)}>Lidocaína dada</Button>
              </>
            )}
            {(['acesso', 'via-aerea'] as const).map((t) => (
              <Button key={t} type="button" variant="outline" className="min-h-12 text-controle font-semibold" onClick={() => anota(t, ROTULO[t]!)}>{ROTULO[t]}</Button>
            ))}
            {acao !== 'epinefrina' && s.epinefrinas > 0 && (
              <Button type="button" variant="outline" className="min-h-12 text-controle font-semibold" onClick={darEpi}>Epinefrina dada</Button>
            )}
          </div>

          <details className="rounded-container border border-fio-forte bg-superficie px-3.5 py-2.5">
            <summary className="cursor-pointer text-controle font-semibold text-tinta">Causas reversíveis</summary>
            <ul className="mt-2 list-disc pl-5 text-controle text-tinta-apoio">
              {CAUSAS_REVERSIVEIS[registro.publico].itens.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p className="mt-1 text-rotulo text-tinta-sussurro">{CAUSAS_REVERSIVEIS[registro.publico].fonte}</p>
          </details>
          <Button type="button" variant="outline" className="min-h-12 border-2 border-acao text-corpo font-semibold text-acao" onClick={() => setForcarRitmo(true)}>
            Checar ritmo agora
          </Button>
        </div>
      )}

      <Registro registro={registro} agora={agora} />
      <div className="flex flex-wrap gap-2">
        {!s.encerrada && (
          <Button type="button" variant="destructive" className="min-h-12 text-controle font-semibold" onClick={() => anota('fim', 'Fim da parada')}>
            Encerrar parada
          </Button>
        )}
        {s.encerrada && (
          <Button type="button" variant="outline" className="min-h-12 text-controle font-semibold" onClick={() => { setRegistro(null); setSom(false) }}>
            Nova parada
          </Button>
        )}
      </div>
      {doses && <p className="text-rotulo text-tinta-sussurro">{doses.fonte} A decisão é do médico.</p>}
      <ListaFerramentas ferramentas={FERRAMENTAS_DO_CRONOMETRO[registro.publico]} />
    </div>
  )
}

function EscolhaDoRitmo({ aoEscolher, aoRce }: { aoEscolher: (r: RitmoParada) => void; aoRce: () => void }) {
  const grupo = (chocavel: boolean) => (
    <section className="flex flex-col gap-2">
      <TituloSecao className={cn('mb-0', chocavel && 'text-critico')}>{chocavel ? 'Ritmos chocáveis' : 'Ritmos não chocáveis'}</TituloSecao>
      {RITMOS_PARADA.filter((r) => r.chocavel === chocavel).map((r) => (
        <Button key={r.id} type="button" variant="outline" onClick={() => aoEscolher(r.id)}
          className="grid min-h-22 w-full grid-cols-[36%_1fr] items-stretch overflow-hidden rounded-cartao border-fio-forte p-0 text-left whitespace-normal">
          <span className={cn('flex flex-col justify-center gap-0.5 px-3 py-2.5 text-corpo leading-tight font-bold text-tinta', chocavel ? 'bg-alerta-critico' : 'bg-trilha')}>
            <span className={cn('text-rotulo font-semibold', chocavel ? 'text-critico' : 'text-tinta-apoio')}>{chocavel ? 'chocável' : 'não chocável'}</span>
            {r.nome}
          </span>
          <FitaEcg ritmo={r.id} />
        </Button>
      ))}
    </section>
  )
  return (
    <div className="flex flex-col gap-4">
      <p className="text-corpo font-semibold text-tinta">Qual é o ritmo?</p>
      {grupo(true)}
      {grupo(false)}
      <Button type="button" variant="outline" onClick={aoRce}
        className="min-h-15 w-full rounded-cartao border-2 border-conforme bg-alerta-conforme text-secao font-bold text-conforme">
        Pulso presente — RCE
      </Button>
    </div>
  )
}

function Agora({ tom, titulo, valor, detalhe, botao, aoTocar }: {
  tom: 'critico' | 'atencao'; titulo: string; valor: string; detalhe: string; botao: string; aoTocar: () => void
}) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-cartao p-4', tom === 'critico' ? 'bg-alerta-critico' : 'bg-alerta-atencao')}>
      <span className={cn('text-controle font-bold', tom === 'critico' ? 'text-critico' : 'text-atencao')}>{titulo}</span>
      <span className="text-numeral-atencao leading-tight font-extrabold tabular-nums text-tinta">{valor}</span>
      <span className="text-controle text-tinta-apoio">{detalhe}</span>
      <Button type="button" onClick={aoTocar}
        className={cn('min-h-15 text-secao font-bold', tom === 'critico' ? 'bg-critico hover:bg-critico/90' : 'bg-acao')}>
        {botao}
      </Button>
    </div>
  )
}

function Conta({ ms }: { ms: number | null }) {
  return <strong className="font-mono text-secao font-bold tabular-nums text-tinta">{ms === null ? '--:--' : minSeg(ms)}</strong>
}

function Proximo({ rotulo, valor, quando }: { rotulo: string; valor: string; quando: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 rounded-container border border-fio-forte bg-superficie px-3.5 py-2.5">
      <span className="text-corpo font-semibold text-tinta">{rotulo}</span>
      <span className="text-right text-corpo font-bold tabular-nums text-tinta">{valor}</span>
      <span className="col-span-2 text-controle text-tinta-apoio">{quando}</span>
    </li>
  )
}

function Registro({ registro, agora }: { registro: EstadoParada; agora: number }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const linhas = registro.eventos.filter((e) => e.tipo !== 'som').slice().reverse()
  const copiar = () => {
    const texto = textoDoRegistro(registro, agora)
    navigator.clipboard?.writeText(texto).then(() => setCopiado('Registro copiado.'), () => setCopiado('Não deu para copiar: abra o registro e selecione o texto.'))
  }
  return (
    <details className="rounded-container border border-fio-forte bg-superficie px-3.5 py-2.5">
      <summary className="cursor-pointer text-controle font-semibold text-tinta">Registro ({linhas.length})</summary>
      <ol className="mt-2 flex flex-col">
        {linhas.map((e, i) => (
          <li key={`${e.em}-${i}`} className="grid grid-cols-[5.6em_1fr] gap-2 border-b border-fio py-1.5 text-controle last:border-b-0">
            <time className="font-mono text-tinta-sussurro">{horaDoRegistro(e.em)}</time>
            <span className="text-tinta">{e.texto}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center gap-3">
        <Button type="button" variant="outline" className="min-h-11 text-controle font-semibold" onClick={copiar}>Copiar registro</Button>
        {copiado && <span role="status" className="text-controle text-tinta-apoio">{copiado}</span>}
      </div>
    </details>
  )
}

function ListaFerramentas({ ferramentas }: { ferramentas: { nome: string; rota: string }[] }) {
  if (!ferramentas.length) return null
  return (
    <ul className="flex flex-col gap-2.5">
      {ferramentas.map((f) => (
        <li key={f.rota}>
          <Link to={f.rota}
            className="flex min-h-14 items-center gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3 text-corpo font-semibold text-tinta no-underline hover:border-acao">
            <span className="flex-1">{f.nome}</span>
            <ChevronRight className="size-5 text-tinta-apoio" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
