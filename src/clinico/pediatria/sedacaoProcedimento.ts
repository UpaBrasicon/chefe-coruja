import { BOLUS, type Bolus } from './bolus.ts'
import { fichaP4, type Referencia } from './fonteP4.ts'

// Sedação e analgesia em procedimentos — livro do ICr, cap. 78 (p. 844–851).
// O capítulo quase não traz dose; as doses por peso vêm do Apêndice e já estão
// em bolus.ts — aqui são reaproveitadas (sem copiar número). O que o capítulo
// acrescenta: dose terapêutica da cetamina (1 a 1,5 mg/kg), contraindicação em
// < 3 meses, dexmedetomidina (ataque em 30 min e manutenção), jejum (Tabela 4),
// ASA (Tabela 1) e sugestões por tipo de procedimento (Tabela 5).

export const fichaSedacaoProcedimento = fichaP4('ped-sedacao-procedimento', 'Sedação para procedimento — criança', 'cap. 78, p. 844–851; Apêndice, p. 894–897')

const ids = ['midazolam-iv-menor5', 'midazolam-iv-maior5', 'midazolam-im', 'midazolam-in', 'fentanil', 'cetamina-iv', 'cetamina-im', 'propofol', 'etomidato', 'dexmedetomidina-proc']
/** Sedativos/analgésicos do Apêndice (bolus.ts). */
export const SEDATIVOS_APENDICE: Bolus[] = ids.map((id) => BOLUS.find((b) => b.id === id)).filter((b): b is Bolus => b !== undefined)
/** Reversores do Apêndice (bolus.ts): flumazenil e naloxona. */
export const REVERSORES_APENDICE: Bolus[] = BOLUS.filter((b) => b.id === 'flumazenil' || b.id.startsWith('naloxona'))

/** Cetamina: dose terapêutica do capítulo (1 a 1,5 mg/kg; acima disso só aumenta efeito dissociativo, p. 848). Sem via declarada. */
export const CETAMINA_TERAPEUTICA_MG_KG: [number, number] = [1, 1.5]
/** Cetamina contraindicada em menores de 3 meses (p. 848). */
export const CETAMINA_IDADE_MINIMA_MESES = 3
/** Dexmedetomidina: ataque 1 mcg/kg em até 30 min; manutenção 0,5 a 1 mcg/kg/h (p. 849). */
export const DEXMED_ATAQUE_MCG_KG = 1
export const DEXMED_MANUTENCAO_MCG_KG_H: [number, number] = [0.5, 1]

export function cetaminaTerapeuticaMg(pesoKg: number): [number, number] | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? [pesoKg * CETAMINA_TERAPEUTICA_MG_KG[0], pesoKg * CETAMINA_TERAPEUTICA_MG_KG[1]] : null
}

/** Cetamina proibida pela idade? (< 3 meses completos). Idade desconhecida → null. */
export function cetaminaContraindicadaIdade(idadeMeses: number): boolean | null {
  return Number.isFinite(idadeMeses) && idadeMeses >= 0 ? idadeMeses < CETAMINA_IDADE_MINIMA_MESES : null
}

export function dexmedetomidina(pesoKg: number): { ataqueMcg: number; manutencaoMcgH: [number, number] } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { ataqueMcg: DEXMED_ATAQUE_MCG_KG * pesoKg, manutencaoMcgH: [DEXMED_MANUTENCAO_MCG_KG_H[0] * pesoKg, DEXMED_MANUTENCAO_MCG_KG_H[1] * pesoKg] }
}

export type Ingesta = 'claros' | 'materno' | 'formula' | 'gordurosa'
/** Tabela 4 (p. 847): jejum antes de sedação moderada/profunda, em horas. */
export const JEJUM_H: Record<Ingesta, { horas: number; rotulo: string }> = {
  claros: { horas: 2, rotulo: 'Líquidos claros (água, suco sem polpa, bebidas gaseificadas, chás, café preto)' },
  materno: { horas: 4, rotulo: 'Leite materno' },
  formula: { horas: 6, rotulo: 'Fórmula infantil, leite não humano, refeições leves (torradas e líquidos claros)' },
  gordurosa: { horas: 8, rotulo: 'Comidas gordurosas, frituras e carne' },
}

/** Horas que faltam para completar o jejum da Tabela 4 (0 = já completou). */
export function jejumFaltaH(ingesta: Ingesta, horasDesde: number): number | null {
  if (!Number.isFinite(horasDesde) || horasDesde < 0) return null
  return Math.max(0, JEJUM_H[ingesta].horas - horasDesde)
}

/** Tabela 1 (p. 845): ASA. ASA III ou mais: maior risco; procedimentos eletivos postergados. */
export const ASA: [string, string][] = [
  ['ASA I', 'Paciente sem comorbidade sistêmica'],
  ['ASA II', 'Doença sistêmica leve'],
  ['ASA III', 'Doença sistêmica grave'],
  ['ASA IV', 'Condição sistêmica com risco de morte'],
  ['ASA V', 'Moribundo, sem chance de sobrevivência sem procedimento'],
]

/** Tabela 5 (p. 849): sugestões por tipo de procedimento — referência. */
export const SUGESTOES_PROCEDIMENTO: { tipo: string; exemplos: string; necessidade: string; sugestao: string }[] = [
  { tipo: 'Não invasivos', exemplos: 'Tomografia, ecocardiograma, eletroencefalograma, ultrassonografia', necessidade: 'Controle motor; medidas de conforto', sugestao: 'Midazolam; dexmedetomidina (midazolam para EEG não é boa alternativa)' },
  { tipo: 'Dor leve e alto grau de ansiedade', exemplos: 'Troca de traqueostomia ou gastrostomia, procedimentos dentários, nasofibroscopia, punção venosa periférica, sutura, punção lombar', necessidade: 'Analgesia, sedação, controle motor, redução da ansiedade', sugestao: 'Midazolam (considerar associar analgésico nos dolorosos); cetamina; analgesia tópica ou local' },
  { tipo: 'Dor intensa, ansiedade ou ambos', exemplos: 'Drenagem de abscesso, artrocentese, aspirado de medula, punção pericárdica, cardioversão, acesso venoso central, debridamento de queimadura, redução de fratura, hérnia ou parafimose, toracocentese, drenagem torácica, paracentese, exame de vítima de violência sexual', necessidade: 'Sedação, analgesia, controle motor, redução da ansiedade, amnésia', sugestao: 'Fentanil; midazolam + fentanil; cetamina; cetamina + propofol; propofol + fentanil; morfina' },
]

export const REFERENCIAS_SEDACAO: Referencia[] = [
  { rotulo: 'Níveis de sedação (ASA, 2002)', texto: 'Mínima (ansiólise), moderada (consciente), profunda e anestesia geral; a cetamina (dissociativa) não segue esse contínuo dose-dependente.', pagina: 'p. 844–845' },
  { rotulo: 'Monitorização', texto: 'Monitor multiparamétrico contínuo, oximetria e ECG contínuos, PA não invasiva a cada 5 min, acesso venoso, material de via aérea e RCP à mão; supervisão até recuperar o nível de consciência basal.', pagina: 'p. 847' },
  { rotulo: 'Sem jejum completo (emergência)', texto: 'Considerar o risco de aspiração: reduzir o nível de sedação para leve ou obter via aérea definitiva.', pagina: 'p. 846' },
  { rotulo: 'Cetamina', texto: 'Contraindicada em malformações de via aérea, estenose subglótica, menores de 3 meses, psicose; sem antídoto; efeito de 50 a 140 min conforme a via.', pagina: 'p. 848' },
  { rotulo: 'Fentanil', texto: 'Início em 2 a 3 min, duração de 20 a 40 min; doses altas e infusão rápida podem causar rigidez torácica.', pagina: 'p. 848' },
  { rotulo: 'Propofol', texto: 'Início < 1 min, recuperação em 5 a 15 min; depressor cardiovascular e respiratório potente — fora do centro cirúrgico, só na indisponibilidade de outras drogas.', pagina: 'p. 848' },
  { rotulo: 'Flumazenil', texto: 'Aumenta o risco de crises convulsivas refratárias e estado de mal epiléptico.', pagina: 'p. 847' },
]
