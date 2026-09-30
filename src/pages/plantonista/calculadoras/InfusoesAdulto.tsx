import { Activity, ChevronRight, Droplet, Moon, Search, X, Zap, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { INFUSOES_ADULTO, NOTAS_PADIS_2025, concentracao, doseAdulto, fichaInfusoesAdulto, unidadeDose, velocidadeAdulto, type InfusaoAdulto } from '@/clinico/adulto/infusoes'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Porta única das infusões contínuas do adulto (onda 9; protótipo: tela
// "Infusões — adulto" de 09/09). Peso primeiro, busca, classes recolhidas com
// contador, a droga com o preparo do Anexo 1 do manual do HC, a faixa e a
// barra de dose que muda de cor até o teto. A barra NUNCA passa do máximo do
// livro: acima do teto não há referência e a tela não calcula velocidade.
// As três entradas antigas (vasoativas, sedação, bloqueio) abrem esta mesma
// tela já na classe, para não duplicar regra.

type Grupo = InfusaoAdulto['grupo']
type Classe = Grupo | 'anticoag'

const CLASSES: { id: Classe; rotulo: string; icone: LucideIcon }[] = [
  { id: 'vasoativo', rotulo: 'Drogas vasoativas', icone: Activity },
  { id: 'sedacao', rotulo: 'Sedação e analgesia', icone: Moon },
  { id: 'bloqueio', rotulo: 'Bloqueio neuromuscular', icone: Zap },
  { id: 'anticoag', rotulo: 'Anticoagulação', icone: Droplet },
]

const ATALHOS = [
  { rotulo: 'Heparina não fracionada EV', texto: '80 UI/kg + 18 UI/kg/h (manual HC)', to: '/plantonista/calculadoras/heparinizacao-venosa' },
  { rotulo: 'Heparina — ajuste pelo TTPa', texto: 'Nomograma da Tabela 7 do manual HC', to: '/plantonista/calculadoras/heparinizacao-ajuste' },
]

const br = (x: number | null, casas = 1) => (x === null || !Number.isFinite(x) ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))
const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Passo da barra pela largura da faixa (protótipo), ancorado no mínimo. */
function passoDaFaixa(span: number) {
  return span >= 50 ? 1 : span >= 10 ? 0.5 : span >= 2 ? 0.1 : span >= 0.5 ? 0.05 : 0.01
}

function Droga({ i, peso }: { i: InfusaoAdulto; peso: number }) {
  const [min, max] = i.faixa
  const span = max - min
  const passo = passoDaFaixa(span)
  const [doseTxt, setDoseTxt] = useState(String(min).replace('.', ','))
  const [mlh, setMlh] = useState('')
  const [servico, setServico] = useState(false)
  const [massa, setMassa] = useState('')
  const [volume, setVolume] = useState('')

  const u = unidadeDose(i)
  const unMassa = i.numerador === 'U' ? 'U' : 'mg'
  const fator = i.numerador === 'mcg' ? 1000 : 1
  const m = lerNumero(massa)
  const vol = lerNumero(volume)
  const concServico = servico && m > 0 && vol > 0 ? (m * fator) / vol : null
  // com a diluição do serviço, a mesma conta roda sobre um preparo equivalente
  const preparo: InfusaoAdulto = concServico ? { ...i, totalDroga: concServico, volumeFinalMl: 1 } : i
  const conc = concentracao(preparo)
  const unConc = `${i.numerador === 'mcg' ? 'µg' : i.numerador}/mL`

  const dose = lerNumero(doseTxt)
  const acimaTeto = Number.isFinite(dose) && dose > max + 1e-9
  const abaixoPiso = Number.isFinite(dose) && dose < min - 1e-9
  const semPeso = i.porKg && !(peso > 0)
  const vel = Number.isFinite(dose) && !acimaTeto && !(servico && !concServico) ? velocidadeAdulto(preparo, dose, peso) : null
  const v = lerNumero(mlh)
  const doseDaBomba = Number.isFinite(v) && !(servico && !concServico) ? doseAdulto(preparo, v, peso) : null
  const pct = span > 0 && Number.isFinite(dose) ? Math.min(1, Math.max(0, (dose - min) / span)) : 0
  const cor = pct >= 0.85 ? 'critico' : pct >= 0.5 ? 'atencao' : 'acao'
  const corTexto = { critico: 'text-critico', atencao: 'text-atencao', acao: 'text-acao' }[cor]
  const corFundo = { critico: 'bg-critico', atencao: 'bg-atencao', acao: 'bg-acao' }[cor]

  return (
    <div className="flex flex-col gap-4 border-t border-fio px-4 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-apoio text-tinta-apoio">{i.preparo}</p>
        <p className="text-apoio text-tinta-apoio">Faixa do livro: <strong className="tabular-nums">{br(min, 3)} a {br(max, 3)} {u}</strong> · Manual HCFMUSP, Anexo 1, {i.pagina}</p>
        {i.errata && <p className="text-apoio text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>{i.errata}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Diluição">
          <button type="button" aria-pressed={!servico} onClick={() => setServico(false)} className={cn('min-h-11 flex-1 rounded-controle border px-3 font-medium', !servico ? 'border-acao bg-acao text-white' : 'border-fio text-tinta-apoio')}>
            Padrão HC ({br(concentracao(i), 2)} {unConc})
          </button>
          <button type="button" aria-pressed={servico} onClick={() => setServico(true)} className={cn('min-h-11 flex-1 rounded-controle border px-3 font-medium', servico ? 'border-acao bg-acao text-white' : 'border-fio text-tinta-apoio')}>
            Diluição do serviço
          </button>
        </div>
        {servico && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor={`${i.id}-massa`}>{unMassa} na solução</Label><Input id={`${i.id}-massa`} inputMode="decimal" value={massa} onChange={(e) => setMassa(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor={`${i.id}-vol`}>Volume final (mL)</Label><Input id={`${i.id}-vol`} inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} /></div>
            <p className={cn('text-apoio sm:col-span-2', concServico ? 'text-tinta-apoio' : 'text-atencao')}>
              {concServico ? `Concentração digitada agora: ${br(conc, 2)} ${unConc}. Confira com o rótulo do preparo.` : 'Informe massa e volume finais para a tela calcular a concentração.'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${i.id}-dose`}>Dose ({u})</Label>
        {span > 0 && (
          <input
            type="range" aria-label={`Dose de ${i.nome}`} min={min} max={max} step={passo}
            value={Number.isFinite(dose) ? Math.min(max, Math.max(min, dose)) : min}
            onChange={(e) => setDoseTxt(String(Number(e.target.value) >= max - passo / 2 ? max : Math.round(Number(e.target.value) * 1000) / 1000).replace('.', ','))}
            className="w-full accent-acao"
          />
        )}
        <div className="h-2.5 overflow-hidden rounded-capsula bg-trilha" aria-hidden><div className={cn('h-full rounded-capsula transition-[width]', corFundo)} style={{ width: `${Math.round(pct * 100)}%` }} /></div>
        <Input id={`${i.id}-dose`} inputMode="decimal" className="max-w-40" value={doseTxt} onChange={(e) => setDoseTxt(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-1 rounded-cartao border border-acao/30 bg-acao/[0.04] px-4 py-3">
          <span className="rotulo text-acao">Velocidade</span>
          <span className="text-[30px] leading-none font-semibold tabular-nums text-acao">{semPeso ? '—' : br(vel)}</span>
          <span className="text-apoio text-tinta-sussurro">mL/h</span>
        </div>
        <div className={cn('flex flex-col items-center gap-1 rounded-cartao border px-4 py-3', acimaTeto ? 'border-critico/40' : 'border-fio')}>
          <span className={cn('rotulo', corTexto)}>Dose</span>
          <span className={cn('text-[30px] leading-none font-semibold tabular-nums', corTexto)}>{Number.isFinite(dose) ? br(dose, 3) : '—'}</span>
          <span className="text-apoio text-tinta-sussurro">{u}</span>
        </div>
      </div>
      <p className={cn('text-apoio', acimaTeto ? 'text-critico' : pct >= 0.85 ? 'text-atencao' : 'text-tinta-sussurro')}>
        {semPeso ? 'Informe o peso: a dose é por kg.'
          : acimaTeto ? `Acima do teto da faixa do livro (${br(max, 3)} ${u}): sem referência, a tela não calcula a velocidade.`
            : abaixoPiso ? `Abaixo do piso da faixa do livro (${br(min, 3)} ${u}).`
              : pct >= 0.85 ? `Perto do teto da faixa do livro (${br(max, 3)} ${u}).`
                : i.porKg ? `Calculado para ${br(peso, 1)} kg.` : 'Dose fixa, não depende do peso.'}
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${i.id}-mlh`}>Já está correndo? Velocidade na bomba (mL/h) → dose</Label>
        <Input id={`${i.id}-mlh`} inputMode="decimal" className="max-w-40" value={mlh} onChange={(e) => setMlh(e.target.value)} />
        <p className="tabular-nums">
          {semPeso ? 'Informe o peso.' : doseDaBomba === null ? '—' : <><strong>{br(doseDaBomba, 3)} {u}</strong>{(doseDaBomba > max + 1e-9 || doseDaBomba < min - 1e-9) && <span className="ml-2 text-atencao">fora da faixa do livro</span>}</>}
        </p>
      </div>
    </div>
  )
}

/** Infusões contínuas do adulto: porta única com classes, busca e barra de dose. */
export function InfusoesAdulto({ grupo }: { grupo?: Grupo }) {
  const [peso, setPeso] = useState(0)
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<Classe | null>(grupo ?? null)
  const [droga, setDroga] = useState<string | null>(null)

  const termo = semAcento(busca.trim())
  const filtradas = termo ? INFUSOES_ADULTO.filter((i) => semAcento(i.nome).includes(termo)) : INFUSOES_ADULTO
  const atalhos = termo ? ATALHOS.filter((a) => semAcento(a.rotulo).includes(termo)) : ATALHOS
  const classes = CLASSES.map((c) => {
    const drogas = c.id === 'anticoag' ? [] : filtradas.filter((i) => i.grupo === c.id)
    const n = c.id === 'anticoag' ? atalhos.length : drogas.length
    return { ...c, drogas, n, abertaAgora: termo ? n > 0 : aberta === c.id }
  }).filter((c) => !termo || c.n > 0)
  const algumaAberta = classes.some((c) => c.abertaAgora)

  return (
    <ToolLayout
      title="Infusões contínuas — adulto"
      description="Porta única: vasoativas, sedação e analgesia, bloqueio neuromuscular e atalhos da anticoagulação. Preparo padrão do Anexo 1 do manual do HC (ou a diluição do serviço), velocidade pela dose e dose pela bomba. Adulto (14 anos ou mais)."
      ficha={fichaInfusoesAdulto}
    >
      <div className="grid gap-4 rounded-container border border-fio bg-card p-4 sm:grid-cols-2">
        <NumberField id="inf-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inf-busca">Buscar droga</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
            <Input id="inf-busca" className="pl-9" placeholder="noradrenalina, fentanil…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
      </div>

      {termo && classes.length === 0 && <p className="text-tinta-sussurro">Nenhuma droga do Anexo 1 com esse nome.</p>}

      <div className={cn('grid gap-3', !algumaAberta && 'sm:grid-cols-2')}>
        {classes.filter((c) => !algumaAberta || c.abertaAgora).map((c) => {
          const Icone = c.icone
          return (
            <section key={c.id} className={cn('overflow-hidden rounded-container border bg-card', c.abertaAgora ? 'border-acao' : 'border-fio')}>
              <div className="flex items-center gap-2 pr-3">
                <button type="button" aria-expanded={c.abertaAgora} onClick={() => { setAberta(aberta === c.id ? null : c.id); setDroga(null) }} className="flex min-h-14 flex-1 items-center gap-3 px-4 py-3 text-left">
                  <span className="grid size-8 shrink-0 place-items-center rounded-controle bg-trilha text-acao"><Icone className="size-4" aria-hidden /></span>
                  <span className="flex-1 text-[16px] font-semibold tracking-[-0.01em] text-tinta">{c.rotulo}</span>
                  <span className={cn('rounded-capsula px-2 py-0.5 text-rotulo font-semibold', c.id === 'anticoag' ? 'bg-atencao/10 text-atencao' : 'bg-acao/10 text-acao')}>{c.n}</span>
                </button>
                {c.abertaAgora && (
                  <button type="button" onClick={() => { setAberta(null); setDroga(null); setBusca('') }} className="inline-flex min-h-10 items-center gap-1.5 rounded-controle border border-fio px-3 text-apoio text-tinta-apoio">
                    <X className="size-4" aria-hidden /> Fechar
                  </button>
                )}
              </div>
              {c.abertaAgora && c.id === 'anticoag' && (
                <ul>{atalhos.map((a) => (
                  <li key={a.to} className="border-t border-fio">
                    <Link to={a.to} className="flex min-h-13 items-center gap-2 px-4 py-3 hover:bg-trilha/40">
                      <span className="flex-1"><span className="font-medium text-tinta">{a.rotulo}</span><span className="block text-apoio text-tinta-sussurro">{a.texto}</span></span>
                      <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />
                    </Link>
                  </li>
                ))}</ul>
              )}
              {c.abertaAgora && c.drogas.map((i) => {
                const sel = droga === i.id || (termo !== '' && c.drogas.length === 1)
                return (
                  <div key={i.id}>
                    <button type="button" aria-expanded={sel} onClick={() => setDroga(droga === i.id ? null : i.id)} className={cn('flex min-h-13 w-full items-center gap-2.5 border-t border-fio px-4 py-3 text-left', sel && 'bg-trilha/40')}>
                      <span className={cn('flex-1 text-[15px] text-tinta', sel ? 'font-semibold' : 'font-medium')}>{i.nome}</span>
                      <span className="text-apoio text-tinta-sussurro tabular-nums">{unidadeDose(i)}</span>
                      <ChevronRight className={cn('size-4 text-tinta-sussurro transition-transform', sel && 'rotate-90')} aria-hidden />
                    </button>
                    {sel && <Droga i={i} peso={peso} />}
                  </div>
                )
              })}
              {c.abertaAgora && c.id === 'sedacao' && (
                <div className="border-t border-fio px-4 py-3 text-apoio">
                  <p className="font-medium">PADIS 2025 — sedação contínua e delirium (SCCM)</p>
                  <p className="text-tinta-sussurro">Atualização focada (Crit Care Med 2025;53:e711–e727), conferida pelo resumo executivo e pela página da SCCM. As diluições acima seguem o Anexo 1 do manual.</p>
                  <ul className="mt-1.5 flex flex-col gap-1">{NOTAS_PADIS_2025.map((n) => <li key={n.tema}><span className="font-medium">{n.tema}:</span> {n.texto} <span className="text-tinta-sussurro">({n.forca})</span></li>)}</ul>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </ToolLayout>
  )
}

export const InfusoesAdultoPorta = () => <InfusoesAdulto />
export const DrogasVasoativas = () => <InfusoesAdulto grupo="vasoativo" />
export const SedacaoContinua = () => <InfusoesAdulto grupo="sedacao" />
export const BloqueioNeuromuscular = () => <InfusoesAdulto grupo="bloqueio" />
