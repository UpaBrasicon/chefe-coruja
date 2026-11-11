import { twistPed } from '@/clinico/escores/twist'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// TWIST na criança (escores P2/P3, item P9): a regra e o teste ficam em
// src/clinico/escores/twist.ts, a mesma do adulto; aqui só o nome que o registry usa.
export const TwistPed = () => <EscoreTela escore={twistPed} />
