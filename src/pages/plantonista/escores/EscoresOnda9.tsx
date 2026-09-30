import { duke } from '@/clinico/adulto/duke'
import { sincopeSanFrancisco } from '@/clinico/adulto/sincopeSanFrancisco'
import { ckdEpi } from '@/clinico/escores/ckdEpi'
import { iss } from '@/clinico/escores/iss'
import { pram } from '@/clinico/escores/pram'
import { sincopeCanadense } from '@/clinico/escores/sincopeCanadense'
import { timiIamcsst } from '@/clinico/escores/timiIamcsst'
import { schwartzPed } from '@/clinico/pediatria/schwartzPed'
import { EscoreTela } from '@/components/plantonista/EscoreTela'

// Calculadoras sem equivalente que entraram na onda 9 do porte, cada uma com a
// sua fonte na ficha (manual do HC, livro do ICr ou referência primária).

export const TimiIamcsst = () => <EscoreTela escore={timiIamcsst} />
export const SincopeSanFrancisco = () => <EscoreTela escore={sincopeSanFrancisco} />
export const SincopeCanadense = () => <EscoreTela escore={sincopeCanadense} />
export const Duke = () => <EscoreTela escore={duke} />
export const Iss = () => <EscoreTela escore={iss} />
export const CkdEpi = () => <EscoreTela escore={ckdEpi} />
export const Pram = () => <EscoreTela escore={pram} />
export const SchwartzPed = () => <EscoreTela escore={schwartzPed} />
