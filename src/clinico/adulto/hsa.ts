import { completo, escolha, numero, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Hemorragia subaracnóidea não traumática — cap. 40 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 550–562. Escalas da Tabela 2 a 5,
// nimodipino e metas numéricas. Escalas não emitem conduta (ADR 0007).

const CAP = 'cap. 40 Hemorragia subaracnóidea não traumática'

export const fichaHsaAdulto = fichaAdulto('adulto-hsa', 'Hemorragia subaracnóidea — nimodipino e metas (adulto)', `${CAP}, p. 558–561`)

const simNao = (id: string, rotulo: string): Item => ({ tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] })

// Regra de Ottawa (Tabela 2, p. 553–554)
const ITENS_OTTAWA: Item[] = [
  simNao('idade', 'Idade ≥ 40 anos'),
  simNao('cervical', 'Dor cervical ou rigidez de nuca'),
  simNao('flexao', 'Limitação da flexão cervical ao exame clínico'),
  simNao('perda', 'Perda de consciência presenciada'),
  simNao('esforco', 'Início durante esforço físico'),
  simNao('thunderclap', 'Thunderclap headache (pico de intensidade em segundos)'),
]

export const ottawaHsa: Escore = {
  ficha: fichaAdulto('adulto-ottawa-hsa', 'Regra de Ottawa para HSA (adulto)', `${CAP}, p. 553–554 (Tabela 2)`),
  descricao: 'Cefaleia súbita não traumática em paciente sem rebaixamento do nível de consciência: seis itens da Tabela 2 do manual do HC.',
  itens: ITENS_OTTAWA,
  calcular(r) {
    if (!completo(ottawaHsa, r)) return null
    const positivos = ITENS_OTTAWA.filter((i) => escolha(ottawaHsa, r, i.id)?.valor === 1).map((i) => i.rotulo)
    const n = positivos.length
    return {
      rotulo: 'Ottawa HSA',
      valor: String(n),
      unidade: 'de 6 itens',
      nota: n > 0 ? 'Regra positiva: o livro indica investigação para HSA com qualquer item presente' : 'Nenhum item presente',
      estado: n > 0 ? 2 : 0,
      derivados: positivos.length ? [['Itens presentes', positivos.join('; ')]] : [],
      cuidados: [
        'Só se aplica a pacientes sem rebaixamento do nível de consciência (p. 553).',
        'Sensibilidade de 100% e especificidade de 15%; exclui da investigação apenas 14% dos pacientes (p. 553).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Hunt-Hess (Tabela 3, p. 555)
const HUNT_HESS = [
  'I — Assintomático ou cefaleia leve e rigidez de nuca discreta',
  'II — Cefaleia moderada a intensa, sinais meníngeos, sem déficits neurológicos (exceto paralisia de nervos cranianos)',
  'III — Sonolência ou confusão mental, déficit neurológico focal',
  'IV — Estupor, hemiparesia moderada ou grave',
  'V — Coma e postura de descerebração',
]

export const huntHess: Escore = {
  ficha: fichaAdulto('adulto-hunt-hess', 'Classificação de Hunt-Hess — HSA (adulto)', `${CAP}, p. 554–555 (Tabela 3)`),
  descricao: 'Grau clínico da HSA na admissão (I a V), da Tabela 3 do manual do HC.',
  itens: [{ tipo: 'escolha', id: 'grau', rotulo: 'Quadro na admissão', opcoes: HUNT_HESS.map((rotulo, i) => ({ rotulo, valor: i + 1 })) }],
  calcular(r) {
    if (!completo(huntHess, r)) return null
    const g = escolha(huntHess, r, 'grau')!.valor
    return {
      rotulo: 'Hunt-Hess',
      valor: ['I', 'II', 'III', 'IV', 'V'][g - 1],
      unidade: 'de V',
      nota: HUNT_HESS[g - 1].replace(/^[IV]+ — /, ''),
      estado: g >= 4 ? 2 : g === 3 ? 1 : 0,
      derivados: [],
      cuidados: [
        'Pode, com limitações, predizer risco cirúrgico e prognóstico (p. 554–555). O livro não traz mortalidade por grau.',
        'A classificação de Hunt-Hess é fator de risco de ressangramento (p. 558).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// WFNS, chamada "CFIN" no livro (Tabela 4, p. 555)

/** Grau da Tabela 4 pelo Glasgow e pelo déficit motor; null quando a tabela não tem linha (Glasgow 15 com déficit). */
export function grauWfns(glasgow: number, deficitMotor: boolean): number | null {
  if (!Number.isInteger(glasgow) || glasgow < 3 || glasgow > 15) return null
  if (glasgow === 15) return deficitMotor ? null : 1
  if (glasgow >= 13) return deficitMotor ? 3 : 2
  if (glasgow >= 7) return 4
  return 5
}

export const wfns: Escore = {
  ficha: fichaAdulto('adulto-wfns', 'Escala WFNS ("CFIN" no livro) — HSA (adulto)', `${CAP}, p. 555 (Tabela 4)`),
  descricao: 'Grau 1 a 5 pela escala de coma de Glasgow e pela presença de déficit motor (Tabela 4 do manual do HC).',
  itens: [
    { tipo: 'numero', id: 'glasgow', rotulo: 'Escala de coma de Glasgow', min: 3, max: 15, passo: 1 },
    { tipo: 'escolha', id: 'deficit', rotulo: 'Déficit motor', opcoes: [{ rotulo: 'Ausente', valor: 0 }, { rotulo: 'Presente', valor: 1 }] },
  ],
  calcular(r) {
    if (!completo(wfns, r)) return null
    const gcs = numero(wfns, r, 'glasgow')!
    const g = grauWfns(Math.round(gcs), escolha(wfns, r, 'deficit')!.valor === 1)
    if (g === null) {
      return {
        rotulo: 'WFNS', valor: '—', nota: 'Glasgow 15 com déficit motor: sem linha na Tabela 4', estado: 1, derivados: [],
        alerta: 'A Tabela 4 do livro (como a escala original) não classifica Glasgow 15 com déficit motor.',
        cuidados: ['Sem referência pediátrica declarada.'],
      }
    }
    return {
      rotulo: 'WFNS',
      valor: String(g),
      unidade: 'de 5',
      nota: ['Glasgow 15, sem déficit', 'Glasgow 13-14, sem déficit', 'Glasgow 13-14, com déficit', 'Glasgow 7-12', 'Glasgow 3-6'][g - 1],
      estado: g >= 4 ? 2 : g === 3 ? 1 : 0,
      derivados: [['Glasgow informado', String(Math.round(gcs))]],
      cuidados: [
        'O livro chama a escala de "Federação Internacional de Neurologia (CFIN)"; a escala com Glasgow e déficit motor é a da World Federation of Neurosurgical Societies (WFNS).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Fisher (Tabela 5, p. 556)
const FISHER = [
  '1 — Ausência de sangramentos',
  '2 — Sangramento com espessura < 1 mm',
  '3 — Sangramento com espessura > 1 mm',
  '4 — Presença de hemoventrículo ou hemorragia intraparenquimatosa',
]

export const fisherHsa: Escore = {
  ficha: fichaAdulto('adulto-fisher-hsa', 'Classificação de Fisher — HSA na TC (adulto)', `${CAP}, p. 556–559 (Tabela 5)`),
  descricao: 'Padrão do sangramento na TC de crânio, de 1 a 4, da Tabela 5 do manual do HC (Fisher clássica, não a modificada).',
  itens: [{ tipo: 'escolha', id: 'grau', rotulo: 'Achado na TC', opcoes: FISHER.map((rotulo, i) => ({ rotulo, valor: i + 1 })) }],
  calcular(r) {
    if (!completo(fisherHsa, r)) return null
    const g = escolha(fisherHsa, r, 'grau')!.valor
    return {
      rotulo: 'Fisher',
      valor: String(g),
      unidade: 'de 4',
      nota: FISHER[g - 1].replace(/^\d — /, ''),
      estado: g >= 3 ? 1 : 0,
      derivados: [],
      cuidados: [
        'Usada para predizer risco de vasoespasmo; não tem correlação clínica (p. 556).',
        'O melhor preditor de vasoespasmo é a quantidade de sangue na TC inicial e a escala de Fisher (p. 559). O livro não traz risco percentual por grau.',
        'O livro não traz a escala de Fisher modificada.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Nimodipino e metas (p. 558–561)

export const NIMODIPINO = { mg: 60, intervaloH: 4, dias: 21, via: 'VO ou por sonda', pagina: 'p. 560' }

export function contaNimodipino(): { dosesDia: number; mgDia: number; dosesTotais: number; mgTotal: number } {
  const dosesDia = 24 / NIMODIPINO.intervaloH
  return { dosesDia, mgDia: dosesDia * NIMODIPINO.mg, dosesTotais: dosesDia * NIMODIPINO.dias, mgTotal: dosesDia * NIMODIPINO.dias * NIMODIPINO.mg }
}

export const METAS_HSA = [
  { alvo: 'Hemoglobina', valor: 'acima de 8 g/dL', pagina: 'p. 560' },
  { alvo: 'Pressão arterial sistólica', valor: '< 160 mmHg (nitroprussiato de sódio se necessário)', pagina: 'p. 560' },
  { alvo: 'Pressão intracraniana', valor: '< 20 mmHg', pagina: 'p. 560' },
  { alvo: 'Pressão de perfusão cerebral', valor: '> 70 mmHg', pagina: 'p. 560' },
  { alvo: 'Exame neurológico sumário', valor: 'a cada 1 a 4 horas', pagina: 'p. 560' },
  { alvo: 'HIC: cabeceira e sedação', valor: 'cabeceira a 30°; sedação visando RASS -5', pagina: 'p. 561' },
  { alvo: 'HIC: hipocapnia', valor: 'pCO2 entre 31 e 35 mmHg, não de rotina e não prolongada', pagina: 'p. 561' },
  { alvo: 'Ácido tranexâmico', valor: 'opção nas primeiras 72 h sem correção do aneurisma (o livro não traz dose)', pagina: 'p. 561' },
  { alvo: 'Vasoespasmo: hipertensão induzida', valor: 'PAM em torno de 100 mmHg (fenilefrina); evidência pequena', pagina: 'p. 561' },
  { alvo: 'Vasoespasmo: janela', valor: 'maior incidência do 7º ao 10º dia, resolução em 21 dias', pagina: 'p. 558' },
  { alvo: 'Doppler transcraniano', valor: 'diário nos primeiros 7 dias, depois em dias alternados por 14 dias; aumento > 50% da velocidade indica vasoespasmo', pagina: 'p. 559' },
  { alvo: 'Angiografia negativa', valor: 'repetir em 4 a 14 dias (aneurisma oculto em cerca de 24%)', pagina: 'p. 558' },
  { alvo: 'Ressangramento', valor: '8 a 23%, maioria nas primeiras 48 h, sobretudo nas primeiras 6 h', pagina: 'p. 558' },
]
