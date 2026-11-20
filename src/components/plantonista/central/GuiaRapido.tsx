import { useId } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Baby, Brain, Bug, Calculator, ChevronRight, Droplet, HandHeart, Heart, HeartPulse, Moon, Syringe, Thermometer,
  TriangleAlert, Waves, Wind, type LucideIcon,
} from 'lucide-react'

import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, cartaoDoGuia, type IconeGuia } from '@/content/guiaRapido'
import { ROTA_SOBRE_MODULO } from '@/content/sobreModuloClinico'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { alterarPaciente, usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'
import { CampoGrande, ChaveDoPaciente, CorDaFita, DetalheDaFita } from './CamposDoGuia'
import { CronometroParada } from './CronometroParada'
import { GuiaParadaCrianca } from './GuiaParadaCrianca'
import { AnafilaxiaDeBolso, CriseDeBolso, DesidratacaoDeBolso, DosesDeBolso } from './GuiaDeBolso'
import { AnafilaxiaAdultoDeBolso, CriseAdultoDeBolso, IntubacaoAdultoDeBolso } from './GuiaDeBolsoAdulto'

// Guia rápido (F4, celular e tablet; pedido do RT de 17/11/2026, M1–M6 = A,
// protótipo aprovado). No alto, a chave criança ↔ adulto e o peso e a idade,
// que vão para as ferramentas pela Central do paciente desta aba (trocar o
// lado zera tudo, como antes). Depois, "Calculadoras e escores" e os cartões
// por situação do plantão, cada um abrindo uma conduta que já existe.

const ICONES: Record<IconeGuia, LucideIcon> = {
  parada: HeartPulse, seringa: Syringe, 'via-aerea': Wind, pulmao: Waves, gota: Droplet, termometro: Thermometer,
  coracao: Heart, cerebro: Brain, lua: Moon, alerta: TriangleAlert, inseto: Bug, maos: HandHeart, bebe: Baby,
}


// Cartão que junta ferramentas (ex.: parada e reanimação na criança): a lista delas.
function GrupoDoGuia({ grupo }: { grupo: NonNullable<ReturnType<typeof cartaoDoGuia>> }) {
  return (
    <div className="flex flex-col gap-4">
      <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
        <ArrowLeft className="size-5" aria-hidden /> Guia rápido
      </Link>
      <TituloPagina titulo={grupo.nome} className="mb-0" />
      <ul className="flex flex-col gap-3">
        {grupo.itens.map((i) => (
          <li key={i.rota}>
            <Link to={i.rota}
              className="flex min-h-16 items-center gap-3 rounded-cartao border border-fio-forte bg-superficie px-4 py-3 text-corpo font-semibold text-tinta no-underline hover:border-acao">
              <span className="flex-1">{i.nome}</span>
              <ChevronRight className="size-5 text-tinta-apoio" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GuiaRapido() {
  const [params] = useSearchParams()
  const guia = params.get('guia')
  // G5 (RT, 18/11/2026): o cartão "Parada e reanimação" da criança abre direto o guia de parada
  if (guia === 'parada-crianca') return <GuiaParadaCrianca />
  // G3 (RT, 18/11/2026): cronômetro da parada; o cartão do adulto abre direto nele
  if (guia === 'cronometro' || guia === 'parada-adulto') return <CronometroParada />
  // guias de bolso da criança (RT, 20/11/2026)
  if (guia === 'doses-crianca') return <DosesDeBolso />
  if (guia === 'crise-crianca') return <CriseDeBolso />
  if (guia === 'anafilaxia-crianca') return <AnafilaxiaDeBolso />
  if (guia === 'desidratacao-crianca') return <DesidratacaoDeBolso />
  if (guia === 'iot-adulto') return <IntubacaoAdultoDeBolso />
  if (guia === 'anafilaxia-adulto') return <AnafilaxiaAdultoDeBolso />
  if (guia === 'crise-adulto') return <CriseAdultoDeBolso />
  const grupo = cartaoDoGuia(guia)
  if (grupo) return <GrupoDoGuia grupo={grupo} />
  return <InicioDoGuia />
}

function InicioDoGuia() {
  const p = usePacienteCentral()
  const idPeso = useId()
  const idIdade = useId()
  const crianca = p.modo === 'pediatrico'
  const cartoes = crianca ? GUIA_CRIANCA : GUIA_ADULTO
  return (
    <div className="flex flex-col gap-4">
      <TituloPagina
        titulo="Guia rápido"
        descricao={<Link to={ROTA_SOBRE_MODULO} className="text-acao underline-offset-4 hover:underline">Sobre o módulo clínico</Link>}
        className="mb-0"
      />
      <ChaveDoPaciente />
      {p.modo ? (
        <div className="grid grid-cols-2 gap-2.5">
          <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso}
            aoMudar={(v) => alterarPaciente({ peso: v })} />
          {crianca ? (
            // criança: peso e a cor da fita de Broselow (pedido do RT, 17/11/2026); a idade
            // fica para as ferramentas que precisam dela
            <CorDaFita />
          ) : (
            <CampoGrande id={idIdade} rotulo="Idade" modo="numeric" valor={p.idade} unidade="anos"
              aoMudar={(v) => alterarPaciente({ idade: v })} />
          )}
          {crianca && <DetalheDaFita />}
        </div>
      ) : (
        <p className="text-controle text-tinta-apoio">Toque em Criança ou Adulto para começar. Trocar o lado apaga peso e idade.</p>
      )}
      <Link to={ROTA_TODAS_FERRAMENTAS}
        className="flex min-h-18 items-center gap-3.5 rounded-cartao bg-acao px-4 py-3.5 text-sobre-acao no-underline hover:bg-acao-pressionada hover:text-sobre-acao">
        <span className="flex size-11 items-center justify-center rounded-container bg-superficie/15">
          <Calculator className="size-6" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-corpo font-bold">Calculadoras e escores</span>
          <span className="text-controle opacity-90">Todos, por grupo, com busca</span>
        </span>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
      <TituloSecao className="mt-1 mb-0">
        {crianca ? 'Guia rápido · criança até 13 anos e 11 meses' : 'Guia rápido · adulto'}
      </TituloSecao>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {cartoes.map((c) => {
          const Icone = ICONES[c.icone]
          return (
            <li key={c.nome}>
              <Link to={'rota' in c ? c.rota : `/plantonista?guia=${c.id}`}
                className="flex min-h-27 flex-col justify-between gap-3.5 rounded-cartao border border-fio-forte bg-superficie p-3.5 text-tinta no-underline hover:border-acao">
                <span className={cn('flex size-10 items-center justify-center rounded-container', crianca ? 'bg-pediatria/10 text-pediatria' : 'bg-alerta-marca text-acao')}>
                  <Icone className="size-5.5" aria-hidden />
                </span>
                <span className="text-corpo leading-tight font-semibold">{c.nome}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
