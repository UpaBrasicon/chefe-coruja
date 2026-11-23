import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'

import { cartaoDoGuia } from '@/content/guiaRapido'
import { TituloPagina } from '@/components/monitor/Pagina'
import { CronometroParada } from './CronometroParada'
import { GuiaParadaCrianca } from './GuiaParadaCrianca'
import { AnafilaxiaDeBolso, CriseDeBolso, DesidratacaoDeBolso, DosesDeBolso } from './GuiaDeBolso'
import { AnafilaxiaAdultoDeBolso, CriseAdultoDeBolso, IntubacaoAdultoDeBolso } from './GuiaDeBolsoAdulto'
import { InicioCelular } from './InicioCelular'

// Guia rápido (F4, celular e tablet; pedido do RT de 17/11/2026, M1–M6 = A).
// Desde o item 6 (RT, 23/11/2026) o início é a tela nova do celular
// (InicioCelular: cartões por tipo de conteúdo que abrem no lugar); os guias
// de bolso, o cronômetro e os grupos seguem nos mesmos endereços (?guia=).
// O peso e a idade saíram do início (CM2 = A): cada guia pede os dele.

// Cartão que junta ferramentas (ex.: parada e reanimação na criança): a lista delas.
function GrupoDoGuia({ grupo }: { grupo: NonNullable<ReturnType<typeof cartaoDoGuia>> }) {
  return (
    <div className="flex flex-col gap-4">
      <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
        <ArrowLeft className="size-5" aria-hidden /> Início
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
  return <InicioCelular />
}
