// IDs da massa LOADTEST, gravados por setup/criar_massa.mjs em dados.json:
// { unidade, setores:[], leitos:[], pacientes:[], conversas:[], lat, lng }
import { SharedArray } from 'k6/data'

const massa = new SharedArray('massa', () => [JSON.parse(open('../dados.json'))])
export const DADOS = massa[0]

export function aleatorio(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}
