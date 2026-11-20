import { useId } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Baby, ChevronRight } from 'lucide-react'

import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { BOLUS, GRUPOS, calcularBolus, type Bolus, type Grupo } from '@/clinico/pediatria/bolus'
import { DOSES_CRISE, ETAPAS_CRISE, type EtapaCrise } from '@/clinico/pediatria/criseEpileptica'
import { DOSES_ANAFILAXIA } from '@/clinico/pediatria/anafilaxia'
import { calcularDose, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { numeroDaDose } from '@/clinico/pediatria/dosesDaFita'
import { alterarPaciente, definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { corEscolhida, pedePesoNaCor, pesoDaDoseDoPaciente } from '@/lib/fitaDoPeso'
import { numeroSemMilhar } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { CampoGrande, CorDaFita, DetalheDaFita } from './CamposDoGuia'

// Guias de bolso do hospital e da UPA (pedido do RT de 20/11/2026: "um guia
// rápido de bolso para quase tudo", pela organização do PedBook e do PedAjuda,
// não pela marca nem pelo conteúdo deles). Cada guia só mostra o que já está nas
// fichas aprovadas (doses por peso, crise epiléptica, anafilaxia) e o mL das
// ampolas da ficha ped-ampolas; nenhuma dose nova. Peso e cor no alto, na mesma
// Central do Guia rápido; com peso digitado vale o peso, só com a cor, o meio da faixa.

const faixa = (a: number, b: number) => (Math.abs(a - b) < 1e-9 ? numeroDaDose(a) : `${numeroDaDose(a)} a ${numeroDaDose(b)}`)
/** dose por kg com até 3 casas (0,025 mg/kg não vira 0,03) */
const porKgTxt = ([a, b]: [number, number], u: string) => {
  const n = (x: number) => numeroSemMilhar(x, 3)
  // infusão: µg/min vira µg/kg/min
  const un = u.includes('/') ? u.replace('/', '/kg/') : `${u}/kg`
  return `${Math.abs(a - b) < 1e-12 ? n(a) : `${n(a)} a ${n(b)}`} ${un}`
}

/** Peso da dose na Central (peso digitado, ou o meio da faixa da cor). */
function usePesoDeBolso(): number | null {
  const p = usePacienteCentral()
  const peso = pesoDaDoseDoPaciente(p)
  return p.modo === 'pediatrico' && peso.origem !== 'nenhum' ? peso.kg : null
}

/** Cabeçalho comum: voltar, título, peso e cor da fita (só criança). */
function CabecalhoDeBolso({ titulo, descricao }: { titulo: string; descricao: string }) {
  const p = usePacienteCentral()
  const idPeso = useId()
  const peso = pesoDaDoseDoPaciente(p)
  return (
    <>
      <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
        <ArrowLeft className="size-5" aria-hidden /> Guia rápido
      </Link>
      <TituloPagina titulo={titulo} descricao={descricao} className="mb-0" />
      {p.modo !== 'pediatrico' ? (
        <div className="flex flex-col gap-3 rounded-cartao border border-fio-forte bg-superficie p-4">
          <p className="text-corpo text-tinta">Este guia é da criança. Mudar para criança apaga o peso e a idade do adulto.</p>
          <Button type="button" onClick={() => definirModo('pediatrico')} className="self-start">
            <Baby className="size-5" aria-hidden /> Mudar para criança
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso} aoMudar={(v) => alterarPaciente({ peso: v })} />
            <CorDaFita />
            <DetalheDaFita />
          </div>
          <p className="text-controle text-tinta-apoio">
            {peso.origem === 'peso' && <>Dose pelo <b className="text-tinta">peso digitado: {numeroDaDose(peso.kg)} kg</b>.</>}
            {peso.origem === 'cor' && <>Dose pela <b className="text-tinta">cor {peso.cor.nome.toLowerCase()}: {numeroDaDose(peso.kg)} kg</b> (meio da faixa). Pese quando der: com o peso, a dose sai do peso.</>}
            {peso.origem === 'nenhum' && (pedePesoNaCor(corEscolhida(p.origem))
              ? 'Na cor cinza, escolha 3, 4 ou 5 kg acima para ver as doses.'
              : 'Digite o peso ou escolha a cor da fita para ver as doses.')}
          </p>
        </>
      )}
    </>
  )
}

/** Uma dose em letra grande, com o volume (da apresentação do livro ou da ampola escolhida). */
function CartaoDeBolso({ nome, porKg, dose, unidade, volume, ampola, via, maximo, noMaximo, condicao, nota, fonte }: {
  nome: string; porKg: string; dose: [number, number]; unidade: string
  volume?: { ml: [number, number]; de?: string } | null; ampola?: string
  via: string; maximo?: number; noMaximo?: boolean; condicao?: string; nota?: string; fonte: string
}) {
  return (
    <li className="flex flex-col gap-1 rounded-cartao border border-fio-forte bg-superficie px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-corpo font-semibold text-tinta">{nome}</span>
        <span className="shrink-0 text-rotulo text-tinta-sussurro">{porKg}</span>
      </div>
      <span className="text-numeral-compacto leading-tight font-bold tabular-nums text-tinta">
        {faixa(dose[0], dose[1])} <span className="text-secao font-semibold text-tinta-apoio">{unidade}</span>
      </span>
      {volume && unidade !== 'mL' && (
        <span className="text-corpo font-semibold tabular-nums text-acao">
          {faixa(volume.ml[0], volume.ml[1])} mL{volume.de && <span className="font-normal text-tinta-apoio"> de {volume.de}</span>}
        </span>
      )}
      {!volume && ampola && <EscolhaDaAmpola chave={ampola} dose={dose} unidade={unidade} grande />}
      <span className="text-apoio text-tinta-apoio">{via}</span>
      {(maximo !== undefined || condicao) && (
        <div className="flex flex-wrap gap-1.5">
          {maximo !== undefined && (
            <span className={cn('rounded-controle px-2 py-0.5 text-rotulo font-semibold', noMaximo ? 'bg-alerta-atencao text-atencao' : 'bg-trilha text-tinta-apoio')}>
              {noMaximo ? 'no máximo' : 'máx.'} {numeroDaDose(maximo)} {unidade}
            </span>
          )}
          {condicao && <span className="rounded-controle bg-trilha px-2 py-0.5 text-rotulo text-tinta-apoio">{condicao}</span>}
        </div>
      )}
      {nota && (
        <details className="text-apoio text-tinta-apoio">
          <summary className="cursor-pointer">Nota</summary>
          <p className="mt-1">{nota}</p>
        </details>
      )}
      <span className="text-rotulo text-tinta-sussurro">Fonte: {fonte}</span>
    </li>
  )
}

function LinkCompleto({ rota, nome }: { rota: string; nome: string }) {
  return (
    <Link to={rota} className="flex min-h-14 items-center gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3 text-corpo font-semibold text-tinta no-underline hover:border-acao">
      <span className="flex-1">{nome}</span>
      <ChevronRight className="size-5 text-tinta-apoio" aria-hidden />
    </Link>
  )
}

const AVISO = 'A decisão é do médico. Doses das fichas aprovadas; o mL sai da ampola escolhida.'

function cartaoDoBolus(b: Bolus, kg: number) {
  const r = calcularBolus(b, kg)
  if (!r || r.aplica === 'nao') return null
  return (
    <CartaoDeBolso key={b.id} nome={b.nome} porKg={b.porKg ? porKgTxt(b.faixa, b.unidade) : 'dose fixa'}
      dose={r.faixa} unidade={b.unidade} volume={r.volumeMl ? { ml: r.volumeMl, de: b.apresentacao } : null} ampola={`bolus:${b.id}`}
      via={b.via} maximo={b.maximo} noMaximo={r.noMaximo} condicao={r.aplica === 'indefinido' ? b.condicao?.texto : undefined}
      nota={b.nota} fonte={`livro do ICr, Apêndice, ${b.pagina}`} />
  )
}

function cartaoDaDose(d: DosePeso, kg: number, lista: 'crise' | 'anafilaxia') {
  const r = calcularDose(d, kg)
  if (!r) return null
  return (
    <CartaoDeBolso key={d.id} nome={d.nome} porKg={porKgTxt(d.porKg, d.unidade)}
      dose={r.dose} unidade={d.unidade} volume={r.volumeMl ? { ml: r.volumeMl, de: d.solucao } : null}
      ampola={lista === 'crise' ? `crise:${d.id}` : undefined}
      via={d.via} maximo={d.maximo} noMaximo={r.noMaximo} nota={d.nota} fonte={`livro do ICr, ${d.pagina}`} />
  )
}

/** "Doses por classe" (como a seção Dosagens): grade das classes do Apêndice; cada uma abre as doses pelo peso. */
export function DosesDeBolso() {
  const kg = usePesoDeBolso()
  const [params, setParams] = useSearchParams()
  const classe = params.get('classe') as Grupo | null
  const itens = classe && classe in GRUPOS ? BOLUS.filter((b) => b.grupo === classe) : []
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDeBolso titulo="Doses por classe" descricao="Criança até 13 anos, 11 meses e 29 dias" />
      <ul className="grid grid-cols-2 gap-2.5">
        {(Object.keys(GRUPOS) as Grupo[]).map((g) => (
          <li key={g}>
            <button type="button" aria-pressed={g === classe}
              onClick={() => {
                setParams((p) => { const n = new URLSearchParams(p); n.set('classe', g); return n })
                // no celular a lista fica embaixo da grade: leva até ela
                setTimeout(() => document.getElementById('doses-da-classe')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
              }}
              className={cn('flex min-h-18 w-full items-center rounded-cartao border px-3.5 py-3 text-left text-controle leading-tight font-semibold',
                g === classe ? 'border-acao bg-alerta-marca text-acao' : 'border-fio-forte bg-superficie text-tinta hover:border-acao')}>
              {GRUPOS[g]}
            </button>
          </li>
        ))}
      </ul>
      {classe && kg !== null && (
        <section id="doses-da-classe" className="flex scroll-mt-4 flex-col gap-2">
          <TituloSecao className="mb-0">{GRUPOS[classe]}</TituloSecao>
          <ul className="flex flex-col gap-2.5">{itens.map((b) => cartaoDoBolus(b, kg))}</ul>
          <p className="text-rotulo text-tinta-sussurro">{AVISO} Ficha ped-bolus.</p>
        </section>
      )}
      <LinkCompleto rota="/plantonista/pediatria/bolus" nome="Doses por peso completas" />
    </div>
  )
}

const ORDEM_CRISE: EtapaCrise[] = ['suporte', 'benzodiazepinico', 'segunda', 'terceira', 'refratario']

/** Crise epiléptica de bolso: as etapas da Tabela 1 do livro, em ordem, com dose e mL. */
export function CriseDeBolso() {
  const kg = usePesoDeBolso()
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDeBolso titulo="Crise epiléptica" descricao="Criança: etapas em ordem, com a dose pelo peso" />
      {kg !== null && ORDEM_CRISE.map((e, i) => {
        const doses = DOSES_CRISE.filter((d) => d.etapa === e)
        if (!doses.length) return null
        return (
          <section key={e} className="flex flex-col gap-2">
            <TituloSecao className="mb-0">{i + 1}. {ETAPAS_CRISE[e]}</TituloSecao>
            <ul className="flex flex-col gap-2.5">{doses.map((d) => cartaoDaDose(d, kg, 'crise'))}</ul>
          </section>
        )
      })}
      {kg !== null && <p className="text-rotulo text-tinta-sussurro">{AVISO} Ficha ped-crise-epileptica-icr.</p>}
      <LinkCompleto rota="/plantonista/pediatria/crise-epileptica-pediatrica" nome="Crise epiléptica completa" />
    </div>
  )
}

/** Anafilaxia de bolso: as linhas de tratamento do livro, com dose e mL. */
export function AnafilaxiaDeBolso() {
  const kg = usePesoDeBolso()
  const linhas = [...new Set(DOSES_ANAFILAXIA.map((d) => d.linha))]
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDeBolso titulo="Anafilaxia" descricao="Criança: epinefrina IM primeiro, depois as outras linhas" />
      {kg !== null && linhas.map((l) => (
        <section key={l} className="flex flex-col gap-2">
          <TituloSecao className="mb-0">{ROTULO_LINHA[l] ?? l}</TituloSecao>
          <ul className="flex flex-col gap-2.5">{DOSES_ANAFILAXIA.filter((d) => d.linha === l).map((d) => cartaoDaDose(d, kg, 'anafilaxia'))}</ul>
        </section>
      ))}
      {kg !== null && <p className="text-rotulo text-tinta-sussurro">{AVISO} Ficha ped-anafilaxia-icr.</p>}
      <LinkCompleto rota="/plantonista/pediatria/anafilaxia-pediatrica" nome="Anafilaxia completa" />
    </div>
  )
}

const ROTULO_LINHA: Record<string, string> = {
  primeira: '1ª linha: epinefrina IM',
  segunda: '2ª linha',
  terceira: '3ª linha',
  refrataria: 'Anafilaxia refratária',
}
