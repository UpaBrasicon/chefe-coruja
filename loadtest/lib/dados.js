// IDs da massa LOADTEST, gravados por setup/criar_massa.mjs em dados.json:
// { unidade, setores:[], setorPorta, leitos:[], pacientes:[], pacientesPorSetor:{}, conversas:[], lat, lng }
import { SharedArray } from 'k6/data'

const massa = new SharedArray('massa', () => [JSON.parse(open('../dados.json'))])
export const DADOS = massa[0]

export function aleatorio(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// As leituras de paciente só valem para quem está escalado no setor dele
// (paciente_no_meu_plantao): sorteia entre os internados do setor do usuário.
export function pacienteDoSetor(setor) {
  const lista = (setor && DADOS.pacientesPorSetor?.[setor]) || []
  return lista.length ? aleatorio(lista) : null
}
