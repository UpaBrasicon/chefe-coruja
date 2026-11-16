import type { ReactNode } from 'react'

import { Chip } from '@/components/monitor/Pagina'

import { CampoNumero, SeloDaCentral } from './CampoNumero'
import type { InicioPed } from './pacienteNaFerramenta'

// Peso e idade da criança no piloto das calculadoras (C5 = A, RT em
// 16/11/2026): abrem com o que foi digitado na Central (modo pediátrico),
// com o selo "da Central", e continuam editáveis. Idade em dias na Central
// não vira meses aqui: o campo fica vazio para o médico preencher.

export function CamposPacientePed({
  idBase,
  peso,
  anos,
  meses,
  onPeso,
  onAnos,
  onMeses,
  daCentral,
  rn,
  onRn,
  children,
}: {
  idBase: string
  peso: number
  anos: number
  meses: number
  onPeso: (n: number) => void
  onAnos: (n: number) => void
  onMeses: (n: number) => void
  daCentral: InicioPed | null
  rn?: boolean
  onRn?: (v: boolean) => void
  children?: ReactNode
}) {
  const selo = (igual: boolean) => (daCentral && igual ? <SeloDaCentral /> : undefined)
  const idadeIgual = !!daCentral && (daCentral.anos > 0 || daCentral.meses > 0) && anos === daCentral.anos && meses === daCentral.meses
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      <CampoNumero id={`${idBase}-peso`} rotulo="Peso aferido ou estimado" unidade="kg" valor={peso} onChange={onPeso} selo={selo(!!daCentral && daCentral.peso > 0 && peso === daCentral.peso)} />
      <CampoNumero id={`${idBase}-anos`} rotulo="Idade" unidade="anos" valor={anos} onChange={onAnos} selo={selo(idadeIgual)} />
      <CampoNumero id={`${idBase}-meses`} rotulo="e meses" unidade="0 a 11" valor={meses} onChange={onMeses} />
      {onRn && (
        <div className="flex flex-col gap-1.5">
          <span id={`${idBase}-rn`} className="text-apoio font-medium text-tinta">Recém-nascido?</span>
          <div role="radiogroup" aria-labelledby={`${idBase}-rn`} className="flex flex-wrap gap-2">
            <Chip variante="opcao" radio ativo={rn === false} onClick={() => onRn(false)}>Não</Chip>
            <Chip variante="opcao" radio ativo={rn === true} onClick={() => onRn(true)}>Sim</Chip>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
