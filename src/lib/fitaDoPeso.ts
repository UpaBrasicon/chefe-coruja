import { CORES_BROSELOW, pesoDaCor, rotuloPesoDaCor, type CorBroselow } from '../clinico/pediatria/fitaBroselow.ts'
import { pesoDaDose, type PesoDaDose } from '../clinico/pediatria/dosesDaFita.ts'

// Peso digitado → cor da fita (pedido do RT de 17/11/2026: "ao colocar o peso já
// selecione a cor, e vice-versa"). Só consulta a tabela aprovada (ficha
// ped-fita-broselow); não cria faixa nova. A fita é por altura, e as faixas de
// peso têm vãos entre uma cor e a seguinte (ex.: 22 a 24 kg): no vão, nenhuma cor
// é escolhida e a tela diz entre quais cores o peso ficou.

export type LeituraDoPeso =
  | { tipo: 'cor'; cor: CorBroselow }
  | { tipo: 'entre'; abaixo: CorBroselow; acima: CorBroselow }
  | { tipo: 'fora'; motivo: 'abaixo' | 'acima' }
  | { tipo: 'vazio' }

export function lerPesoTexto(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n > 0 ? n : null
}

export function corDoPeso(kg: number | null): LeituraDoPeso {
  if (kg === null) return { tipo: 'vazio' }
  const primeira = CORES_BROSELOW[0]
  const ultima = CORES_BROSELOW[CORES_BROSELOW.length - 1]
  if (kg < primeira.pesoKg[0]) return { tipo: 'fora', motivo: 'abaixo' }
  if (kg > ultima.pesoKg[1]) return { tipo: 'fora', motivo: 'acima' }
  for (let i = 0; i < CORES_BROSELOW.length; i++) {
    const c = CORES_BROSELOW[i]
    if (kg >= c.pesoKg[0] && kg <= c.pesoKg[1]) return { tipo: 'cor', cor: c }
    const prox = CORES_BROSELOW[i + 1]
    if (prox && kg > c.pesoKg[1] && kg < prox.pesoKg[0]) return { tipo: 'entre', abaixo: c, acima: prox }
  }
  return { tipo: 'vazio' }
}

// Cor escolhida na lista: fica na origem do peso da Central ("fita de Broselow,
// cor amarela (12–14 kg → 13 kg)"). Mudar o peso à mão apaga a origem e, com
// ela, a cor; aí vale o peso digitado.
const PREFIXO_FITA = 'fita de Broselow, cor '

/**
 * G6 (RT, 18/11/2026): na cinza (3 a 5 kg) o meio da faixa erra até 33% (bebê de
 * 3 kg com dose de 4 kg); sem peso, a tela pede 3, 4 ou 5 kg em vez de usar o meio.
 */
export const PESOS_DA_CINZA = [3, 4, 5] as const
export const pedePesoNaCor = (c: CorBroselow | undefined) => c?.id === 'cinza'

export const origemDaCor = (c: CorBroselow) =>
  `${PREFIXO_FITA}${c.nome.toLowerCase()} (${pedePesoNaCor(c) ? `${c.pesoKg[0]}–${c.pesoKg[1]} kg` : rotuloPesoDaCor(c)})`

export function corEscolhida(origem: string): CorBroselow | undefined {
  return origem.startsWith(PREFIXO_FITA) ? CORES_BROSELOW.find((c) => origem === origemDaCor(c)) : undefined
}

/** Cor da fita para o paciente da Central: a escolhida na lista ou, sem ela, a do peso digitado. */
export function leituraDaFita(p: { origem: string; peso: string }) {
  const escolhida = corEscolhida(p.origem)
  if (escolhida) return { cor: escolhida, pelaLista: true, leitura: corDoPeso(pesoDaCor(escolhida)) }
  const leitura = corDoPeso(lerPesoTexto(p.peso))
  return { cor: leitura.tipo === 'cor' ? leitura.cor : undefined, pelaLista: false, leitura }
}

/**
 * Peso da dose para o paciente da Central (regra do RT de 17/11/2026): com peso
 * digitado, vale o peso; com a cor escolhida na lista, o meio da faixa da cor —
 * menos na cinza (G6), que pede o peso.
 */
export function pesoDaDoseDoPaciente(p: { origem: string; peso: string }): PesoDaDose {
  const escolhida = corEscolhida(p.origem)
  if (escolhida) return pedePesoNaCor(escolhida) ? { origem: 'nenhum' } : pesoDaDose(null, escolhida.id)
  return pesoDaDose(lerPesoTexto(p.peso), null)
}
