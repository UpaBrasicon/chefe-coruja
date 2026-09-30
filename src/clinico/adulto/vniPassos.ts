import type { Ficha } from '../ficha.ts'
import { VNI_DPOC } from './asmaDpoc.ts'
import { fichaAdulto, pagina } from './fonte.ts'
import { VNI } from './oxigenacao.ts'
import type { Faixa } from './ventilacaoMecanica.ts'

// VNI em cinco passos (formato do protótipo: Quem, Interface, Ajustes,
// Acompanhar, Retirar) com o que o Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022) traz: indicações, maior evidência e contraindicações
// (cap. 27, p. 378 e 382–384), contraindicações da IC aguda (cap. 21, p. 296),
// modos CPAP/BiPAP (p. 385–386), pressões iniciais só na DPOC (cap. 31, p. 424)
// e os alvos de SatO2 (cap. 1, p. 35–36; cap. 27, p. 379; cap. 21, p. 296).
//
// O protótipo trazia pressões por quadro (EAP, hipoxêmico, obesidade,
// neuromuscular, asma), HACOR, ROX, critérios de falha e de retirada e faixas
// pediátricas e neonatais (SES-DF). O livro não traz nada disso: fica fora e
// vai para a lista do RT. Nenhuma pressão é sugerida fora da DPOC.

const PAG_VNI = 'cap. 27, p. 378–386; cap. 31, p. 424–426; cap. 21, p. 296; cap. 1, p. 35–36'

export const fichaVniPassos: Ficha = {
  ...fichaAdulto('adulto-vni-cinco-passos', 'Ventilação não invasiva em cinco passos (adulto)', PAG_VNI),
  versao: '2026-09-30.1',
  fontes: [pagina(PAG_VNI)],
  revisadoEm: '30/09/2026 (conferido no texto dos cap. 1, 19, 27 e 31; aguarda aprovação do RT)',
}

export const PASSOS_VNI = ['Quem', 'Interface', 'Ajustes', 'Acompanhar', 'Retirar'] as const

/** Quadro que muda o que o livro traz no passo de ajustes. */
export type QuadroVni = 'dpoc' | 'eap' | 'outro'

export const QUADROS_VNI: Record<QuadroVni, { nome: string; livro: string; pagina: string }> = {
  dpoc: { nome: 'Exacerbação de DPOC', livro: 'Inicia-se usualmente com baixas pressões: IPAP 8–12 cmH2O e EPAP ("CPAP") 3–5 cmH2O.', pagina: 'cap. 31, p. 424' },
  eap: { nome: 'Edema pulmonar cardiogênico / IC aguda congesta', livro: 'CPAP, ou VNI com EPAP e IPAP para diminuir o trabalho respiratório e aumentar a aceitação. O livro não traz valores de pressão.', pagina: 'cap. 21, p. 296' },
  outro: { nome: 'Outra IRpA', livro: 'O livro não traz valores de pressão para os demais quadros.', pagina: 'cap. 27, p. 385–386' },
}

/** Contraindicações do cap. 27 (p. 383–384) e as da IC aguda (p. 296), sem repetir. */
export const CONTRAINDICACOES_VNI: { texto: string; pagina: string }[] = [
  ...VNI.contraindicacoes.map((texto) => ({ texto, pagina: 'cap. 27, p. 383–384' })),
  { texto: 'Secreção excessiva ou tosse ineficaz', pagina: 'cap. 21, p. 296' },
  { texto: 'Agitação', pagina: 'cap. 21, p. 296' },
  { texto: 'Cirurgia recente de esôfago ou de vias aéreas superiores', pagina: 'cap. 21, p. 296' },
]

/** Interfaces citadas (p. 382). O livro não traz critério de escolha entre elas. */
export const INTERFACES_VNI = ['Máscara facial total', 'Máscara oronasal', 'Máscara nasal', 'Capacete']

export const MODOS_VNI = [
  { id: 'cpap', nome: 'CPAP', texto: 'O paciente respira espontaneamente e a ventilação mantém pressão positiva contínua em todo o ciclo. Podem ser usados altos fluxos de O2. Principalmente para correção de hipoxemia.', pagina: 'p. 385–386' },
  { id: 'bipap', nome: 'BiPAP', texto: 'Regula-se a pressão inspiratória (IPAP) e a expiratória (EPAP). Principalmente para correção de hipoventilação. Cuidado com fluxos altos de O2 em obstruídos.', pagina: 'p. 386' },
] as const

export type ModoVni = (typeof MODOS_VNI)[number]['id']

/** Alvos de SatO2 que o livro escreve, por contexto. */
export const ALVOS_SAT_VNI: { id: string; contexto: string; faixa: Faixa | null; acima: number | null; pagina: string }[] = [
  { id: 'hipercapnica', contexto: 'IRpA hipercápnica', faixa: [90, 93], acima: null, pagina: 'cap. 27, p. 379' },
  { id: 'dpoc', contexto: 'DPOC ou risco de insuficiência hipercápnica', faixa: [88, 92], acima: null, pagina: 'cap. 1, p. 36' },
  { id: 'ic', contexto: 'IC aguda', faixa: null, acima: 95, pagina: 'cap. 21, p. 296' },
  { id: 'critico', contexto: 'Paciente crítico no DE', faixa: [94, 98], acima: null, pagina: 'cap. 1, p. 35' },
]

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0

export type AjustesVni = { modo: ModoVni; ipap?: number; epap?: number; cpap?: number }
export type LeituraAjustesVni = { suporte: number | null; notas: string[]; foraDoLivro: string[] }

/**
 * Passo 3: pressão de suporte (IPAP − EPAP) é conta; faixa só existe para a
 * DPOC (p. 424). Nos demais quadros nada é comparado — o livro não traz.
 */
export function lerAjustesVni(q: QuadroVni, a: AjustesVni): LeituraAjustesVni {
  const notas: string[] = []
  const fora: string[] = []
  if (a.modo === 'cpap') {
    if (q === 'dpoc') notas.push('Na DPOC o livro descreve VNI com IPAP e EPAP (p. 424) e alerta para fluxos altos de O2 em obstruídos no BiPAP (p. 386).')
    if (valido(a.cpap)) notas.push(`CPAP ${a.cpap} cmH2O informado. ${q === 'dpoc' ? '' : 'O livro não traz valor de CPAP para comparar.'}`.trim())
    return { suporte: null, notas, foraDoLivro: fora }
  }
  const suporte = valido(a.ipap) && valido(a.epap) ? a.ipap - a.epap : null
  if (suporte !== null && suporte <= 0) fora.push('IPAP menor ou igual à EPAP: sem pressão de suporte.')
  if (q === 'dpoc') {
    if (valido(a.ipap) && (a.ipap < VNI_DPOC.ipap[0] || a.ipap > VNI_DPOC.ipap[1])) fora.push(`IPAP ${a.ipap} cmH2O fora de 8–12 (valor inicial do livro, p. 424)`)
    if (valido(a.epap) && (a.epap < VNI_DPOC.epap[0] || a.epap > VNI_DPOC.epap[1])) fora.push(`EPAP ${a.epap} cmH2O fora de 3–5 (valor inicial do livro, p. 424)`)
  } else notas.push('O livro não traz IPAP/EPAP para este quadro: a tela só faz a conta da pressão de suporte.')
  return { suporte, notas, foraDoLivro: fora }
}

export type AcompanhamentoVni = {
  ph?: number
  paco2?: number
  pao2?: number
  sat?: number
  alvoSat?: string
  naoRetentor?: boolean
  rebaixamento?: boolean
  instabilidade?: boolean
  pausas?: boolean
  secrecao?: boolean
  dpoc?: boolean
}

/**
 * Passo 4: o livro não traz critério de falha da VNI (nem HACOR, nem ROX).
 * A tela lista o que ele traz como indicação de VM invasiva (cap. 37, p. 498;
 * DPOC, Tabela 7, p. 425–426) e o alvo de SatO2 escolhido. Não decide.
 */
export function lerAcompanhamentoVni(m: AcompanhamentoVni): { invasiva: string[]; sat: string | null } {
  const r: string[] = []
  if (valido(m.pao2) && m.pao2 < 60) r.push('PO2 < 60 mmHg: indicação de VM se houver esforço respiratório sem melhora após O2 adequado, incluindo VNI (cap. 37, p. 498)')
  if (valido(m.paco2) && m.paco2 > 55 && m.naoRetentor) r.push('PCO2 > 55 mmHg em não retentor crônico: indicação de VM, principalmente com falência ventilatória ou carbonarcose (cap. 37, p. 498)')
  if (m.rebaixamento) r.push('Rebaixamento do nível de consciência: contraindicação de VNI (p. 383) e, na DPOC, indicação de VM invasiva (Tabela 7, p. 425)')
  if (m.instabilidade) r.push('Instabilidade hemodinâmica: contraindicação de VNI (p. 384); na DPOC, VM invasiva se grave e sem resposta a cristaloide e vasopressor (Tabela 7, p. 426)')
  if (m.dpoc && m.pausas) r.push('Pausas respiratórias com rebaixamento: indicação de VM invasiva na DPOC (Tabela 7, p. 425)')
  if (m.secrecao) r.push(m.dpoc ? 'Inabilidade persistente de remover secreções: indicação de VM invasiva na DPOC (Tabela 7, p. 425)' : 'Inabilidade de manejar secreção: contraindicação de VNI (p. 383)')
  let sat: string | null = null
  const alvo = ALVOS_SAT_VNI.find((a) => a.id === m.alvoSat)
  if (alvo && valido(m.sat)) {
    if (alvo.faixa) sat = m.sat < alvo.faixa[0] ? `SatO2 ${m.sat}% abaixo de ${alvo.faixa[0]}–${alvo.faixa[1]}% (${alvo.pagina})` : m.sat > alvo.faixa[1] ? `SatO2 ${m.sat}% acima de ${alvo.faixa[0]}–${alvo.faixa[1]}% (${alvo.pagina})` : `SatO2 ${m.sat}% dentro de ${alvo.faixa[0]}–${alvo.faixa[1]}% (${alvo.pagina})`
    else sat = m.sat > alvo.acima! ? `SatO2 ${m.sat}% acima de ${alvo.acima}% (${alvo.pagina})` : `SatO2 ${m.sat}% — o alvo do livro é > ${alvo.acima}% (${alvo.pagina})`
  }
  return { invasiva: r, sat }
}

export const RETIRADA_VNI =
  'O livro não traz critérios de retirada nem de desmame da VNI. Critérios do protótipo (sete itens) não têm fonte no repositório e aguardam o responsável técnico.'
