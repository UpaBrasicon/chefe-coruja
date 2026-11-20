import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, User } from 'lucide-react'

import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { DROGAS_ISR, calcularIsr, type DrogaIsr } from '@/clinico/adulto/isr'
import {
  ADRENALINA_BOLUS_EV, ADRENALINA_IM, CUIDADOS_ANAFILAXIA, SEGUNDA_LINHA_ANAFILAXIA, bolusEvMl, volumeChoqueMl,
} from '@/clinico/adulto/anafilaxia'
import { numeroDaDose } from '@/clinico/pediatria/dosesDaFita'
import { alterarPaciente, definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { CampoGrande } from './CamposDoGuia'

// Guias de bolso do adulto (pedido do RT de 20/11/2026), no mesmo formato dos
// da criança: peso no alto, números grandes, ferramenta completa embaixo. Só
// dados das fichas aprovadas adulto-isr (sequência rápida, manual do HCFMUSP,
// Anexo 1) e adulto-anafilaxia (manual, cap. 11); nenhuma dose nova.

const faixa = (a: number, b: number) => (Math.abs(a - b) < 1e-9 ? numeroDaDose(a) : `${numeroDaDose(a)} a ${numeroDaDose(b)}`)

function usePesoAdultoDeBolso(): number | null {
  const p = usePacienteCentral()
  const kg = Number(String(p.peso).replace(',', '.'))
  return p.modo === 'adulto' && Number.isFinite(kg) && kg >= 30 && kg <= 250 ? kg : null
}

function CabecalhoAdulto({ titulo, descricao, pedePeso = true }: { titulo: string; descricao: string; pedePeso?: boolean }) {
  const p = usePacienteCentral()
  const idPeso = useId()
  const kg = usePesoAdultoDeBolso()
  return (
    <>
      <Link to="/plantonista" className="flex min-h-11 items-center gap-2 self-start text-controle font-semibold text-acao no-underline">
        <ArrowLeft className="size-5" aria-hidden /> Guia rápido
      </Link>
      <TituloPagina titulo={titulo} descricao={descricao} className="mb-0" />
      {p.modo !== 'adulto' ? (
        <div className="flex flex-col gap-3 rounded-cartao border border-fio-forte bg-superficie p-4">
          <p className="text-corpo text-tinta">Este guia é do adulto. Mudar para adulto apaga o peso e a cor da criança.</p>
          <Button type="button" onClick={() => definirModo('adulto')} className="self-start">
            <User className="size-5" aria-hidden /> Mudar para adulto
          </Button>
        </div>
      ) : pedePeso && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso} aoMudar={(v) => alterarPaciente({ peso: v })} />
          </div>
          {kg === null && <p className="text-controle text-tinta-apoio">Digite o peso (30 a 250 kg) para as doses por peso.</p>}
        </>
      )}
    </>
  )
}

function Cartao({ nome, dose, volume, detalhe, nota, fonte }: { nome: string; dose: string; volume?: string; detalhe?: string; nota?: string; fonte: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-cartao border border-fio-forte bg-superficie px-4 py-3">
      <span className="text-corpo font-semibold text-tinta">{nome}</span>
      <span className="text-numeral-compacto leading-tight font-bold tabular-nums text-tinta">{dose}</span>
      {volume && <span className="text-corpo font-semibold tabular-nums text-acao">{volume}</span>}
      {detalhe && <span className="text-apoio text-tinta-apoio">{detalhe}</span>}
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

const PAPEIS: { papel: DrogaIsr['papel']; titulo: string }[] = [
  { papel: 'analgesia', titulo: '1. Analgesia (pré-tratamento)' },
  { papel: 'inducao', titulo: '2. Indução (escolha uma)' },
  { papel: 'bloqueio', titulo: '3. Bloqueio neuromuscular (escolha um)' },
]

/** Intubação de bolso (adulto): sequência rápida pelo peso, com mL e ampolas. */
export function IntubacaoAdultoDeBolso() {
  const kg = usePesoAdultoDeBolso()
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoAdulto titulo="Intubação" descricao="Adulto: sequência rápida pelo peso" />
      {kg !== null && PAPEIS.map(({ papel, titulo }) => (
        <section key={papel} className="flex flex-col gap-2">
          <TituloSecao className="mb-0">{titulo}</TituloSecao>
          <ul className="flex flex-col gap-2.5">
            {DROGAS_ISR.filter((d) => d.papel === papel).map((d) => {
              const r = calcularIsr(d, kg)
              if (!r) return null
              return (
                <Cartao key={d.id} nome={d.nome} dose={r.dose}
                  volume={`${r.volumeMl} mL · ${r.ampolas} ${r.ampolas === 1 ? 'ampola' : 'ampolas'}`}
                  detalhe={`${d.fixa ? 'dose fixa' : `${numeroDaDose(d.mgKg!)} mg/kg`} · ${d.apresentacao}`}
                  nota={d.nota} fonte="manual do HCFMUSP, Anexo 1 (ficha adulto-isr)" />
              )
            })}
          </ul>
        </section>
      ))}
      {kg !== null && <p className="text-rotulo text-tinta-sussurro">A decisão é do médico. Doses da ficha aprovada adulto-isr.</p>}
      <LinkCompleto rota="/plantonista/calculadoras/iot" nome="Via aérea e intubação completa" />
    </div>
  )
}

/** Anafilaxia de bolso (adulto): adrenalina IM primeiro, bolus EV, volume e segunda linha. */
export function AnafilaxiaAdultoDeBolso() {
  const kg = usePesoAdultoDeBolso()
  const volume = kg !== null ? volumeChoqueMl(kg) : null
  const ml = (mg: number) => mg / ADRENALINA_IM.mgMl
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoAdulto titulo="Anafilaxia" descricao="Adulto: adrenalina IM primeiro" />
      <section className="flex flex-col gap-2">
        <TituloSecao className="mb-0">1. Adrenalina IM</TituloSecao>
        <ul className="flex flex-col gap-2.5">
          <Cartao nome="Adrenalina IM (1:1.000, 1 mg/mL)" dose={`${faixa(ADRENALINA_IM.mg[0], ADRENALINA_IM.mg[1])} mg`}
            volume={`${faixa(ml(ADRENALINA_IM.mg[0]), ml(ADRENALINA_IM.mg[1]))} mL`}
            detalhe={`no ${ADRENALINA_IM.local}; repetir a cada ${faixa(ADRENALINA_IM.repeticaoMin[0], ADRENALINA_IM.repeticaoMin[1])} min`}
            fonte={`manual do HCFMUSP, ${ADRENALINA_IM.pagina}`} />
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <TituloSecao className="mb-0">2. Sem resposta ou choque</TituloSecao>
        <ul className="flex flex-col gap-2.5">
          <Cartao nome="Adrenalina EV em bolus" dose={`${numeroDaDose(ADRENALINA_BOLUS_EV.mg)} mg`}
            volume={`${numeroDaDose(bolusEvMl())} mL do preparo (${ADRENALINA_BOLUS_EV.preparo})`}
            detalhe={`em ${faixa(ADRENALINA_BOLUS_EV.minutos[0], ADRENALINA_BOLUS_EV.minutos[1])} min; ${ADRENALINA_BOLUS_EV.quando}`}
            fonte={`manual do HCFMUSP, ${ADRENALINA_BOLUS_EV.pagina}`} />
          {volume && (
            <Cartao nome="Cristaloide no choque" dose={`${faixa(volume[0], volume[1])} mL`} detalhe="10 a 20 mL/kg"
              fonte="manual do HCFMUSP, cap. 11 (ficha adulto-anafilaxia)" />
          )}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <TituloSecao className="mb-0">3. Segunda linha</TituloSecao>
        <ul className="flex flex-col gap-2.5">
          {SEGUNDA_LINHA_ANAFILAXIA.map((i) => <Cartao key={i.id} nome={i.nome} dose={i.dose} nota={i.nota} fonte={`manual do HCFMUSP, ${i.pagina}`} />)}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <TituloSecao className="mb-0">Cuidados</TituloSecao>
        {CUIDADOS_ANAFILAXIA.map((c) => <p key={c.texto} className="text-apoio text-tinta-apoio">{c.texto} ({c.pagina})</p>)}
      </section>
      <p className="text-rotulo text-tinta-sussurro">A decisão é do médico. Doses da ficha aprovada adulto-anafilaxia.</p>
      <LinkCompleto rota="/plantonista/emergencias/anafilaxia-adulto" nome="Anafilaxia completa" />
    </div>
  )
}
