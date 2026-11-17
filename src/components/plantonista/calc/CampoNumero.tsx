import { useId, useState, type ReactNode } from 'react'

import { lerNumeroDigitado, numeroBr } from '@/domain/copiaCalculo'
import { AVISO_PESO_ADULTO_FORA, PESO_ADULTO_MAX_KG, PESO_ADULTO_MIN_KG } from '@/domain/pesoAdulto'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { usePacienteCentral } from '@/lib/pacienteCentral'

import type { PesoAdulto } from './pacienteNaFerramenta'

// Campo numérico do piloto das calculadoras (diagnóstico, F4/F7; C4/C5 = A):
// abre vazio (não com "0"), aceita vírgula e ponto, mostra a unidade dentro
// do campo e, com `faixa`, avisa e deixa a ferramenta decidir não calcular.
// Fala com as ferramentas como o NumberField antigo: 0 = não informado.

export function CampoNumero({
  id,
  rotulo,
  unidade,
  valor,
  onChange,
  faixa,
  ajuda,
  selo,
  className,
}: {
  id?: string
  rotulo: string
  unidade?: string
  valor: number
  onChange: (n: number) => void
  /** fora de [min, max] o campo fica inválido e mostra `aviso` */
  faixa?: { min: number; max: number; aviso: string }
  ajuda?: ReactNode
  /** marca ao lado do rótulo, ex.: "da Central" */
  selo?: ReactNode
  className?: string
}) {
  const idAuto = useId()
  const idCampo = id ?? idAuto
  const [texto, setTexto] = useState(() => (valor > 0 ? numeroBr(valor) : ''))

  // Valor trocado por fora (ex.: limpar): o texto acompanha, sem brigar com a digitação.
  const [valorVisto, setValorVisto] = useState(valor)
  if (valor !== valorVisto) {
    setValorVisto(valor)
    if (lerNumeroDigitado(texto) !== valor) setTexto(valor > 0 ? numeroBr(valor) : '')
  }

  const fora = !!faixa && valor > 0 && (valor < faixa.min || valor > faixa.max)
  const invalido = lerNumeroDigitado(texto) === null

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={idCampo}>{rotulo}</Label>
        {selo}
      </div>
      <div className="relative">
        <Input
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          aria-invalid={fora || invalido}
          aria-describedby={fora || invalido ? `${idCampo}-aviso` : undefined}
          className={cn('tabular-nums', unidade && 'pr-16')}
          onChange={(e) => {
            const t = e.target.value
            setTexto(t)
            const n = lerNumeroDigitado(t)
            if (n !== null) onChange(n)
          }}
        />
        {unidade && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-apoio text-tinta-sussurro">
            {unidade}
          </span>
        )}
      </div>
      {invalido && <p id={`${idCampo}-aviso`} role="alert" className="text-apoio text-critico">Use só números, com vírgula ou ponto.</p>}
      {fora && !invalido && <p id={`${idCampo}-aviso`} role="alert" className="text-apoio font-medium text-critico">{faixa.aviso}</p>}
      {ajuda && <p className="text-apoio text-tinta-sussurro">{ajuda}</p>}
    </div>
  )
}

/**
 * Selo "da Central": o valor veio do paciente da Central e não foi mudado.
 * Vindo do atendimento (F3 das ferramentas pelo CID), o selo diz a origem e a
 * data, como "peso do prontuário, 12/11" (condição da sessão legal).
 */
export function SeloDaCentral() {
  const { origem } = usePacienteCentral()
  return (
    <span
      title={origem ? `Valor do atendimento (${origem}). Mude no campo se não for este.` : "Valor do paciente da Central do Médico, nesta aba. Mude no campo se não for este."}
      className="rounded-capsula border border-acao/30 bg-alerta-marca px-2 py-px text-rotulo font-medium text-acao"
    >
      {origem || 'da Central'}
    </span>
  )
}

export function CampoPesoAdulto({ id, estado, className }: { id: string; estado: PesoAdulto; className?: string }) {
  return (
    <CampoNumero
      id={id}
      rotulo="Peso"
      unidade="kg"
      valor={estado.peso}
      onChange={estado.setPeso}
      className={className}
      selo={estado.central !== null && estado.peso === estado.central ? <SeloDaCentral /> : undefined}
      faixa={{ min: PESO_ADULTO_MIN_KG, max: PESO_ADULTO_MAX_KG, aviso: AVISO_PESO_ADULTO_FORA }}
    />
  )
}
