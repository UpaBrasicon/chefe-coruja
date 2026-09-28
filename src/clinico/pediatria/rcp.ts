import { fichaP2, type DosePeso, type Faixa } from './fonteP2.ts'

// RCP pediátrica e arritmias — livro do ICr (caps. 1 e 2). Parâmetros de
// compressão/ventilação, cargas de desfibrilação e cardioversão por peso e as
// drogas da Tabela 2 do cap. 1, com página. O livro segue a AHA 2020; o
// adolescente (sinais de puberdade) usa as diretrizes de adulto (p. 25).

export const fichaRcpPediatrica = fichaP2(
  'ped-rcp-icr',
  'RCP pediátrica — parâmetros, choque e drogas',
  'cap. 1, p. 24–38; cap. 2, p. 39–58',
)

// ── Parâmetros do suporte básico (p. 25–31, Tabela 1) ──

export type FaixaRcp = 'lactente' | 'crianca' | 'adolescente'

export const FAIXAS_RCP: Record<FaixaRcp, string> = {
  lactente: 'Lactente (menos de 1 ano; exclui recém-nascido)',
  crianca: 'Criança (1 ano até antes da puberdade)',
  adolescente: 'Adolescente (broto mamário nas meninas, pelos axilares nos meninos)',
}

export type ParametrosRcp = {
  frequencia: string
  profundidade: string
  relacao: string
  viaAereaAvancada: string
  pulso: string
  tecnica: string
  pagina: string
}

const COMUM = {
  frequencia: '100 a 120 compressões por minuto',
  viaAereaAvancada: '1 ventilação a cada 2 a 3 segundos (20 a 30/min), compressões contínuas',
  pagina: 'p. 26, 30–31 (Tabela 1)',
}

export function parametrosRcp(f: FaixaRcp): ParametrosRcp {
  if (f === 'lactente') {
    return {
      ...COMUM,
      profundidade: '1/3 do diâmetro anteroposterior — cerca de 4 cm',
      relacao: '30:2 com 1 socorrista; 15:2 com 2 ou mais',
      pulso: 'braquial, no máximo 10 segundos',
      tecnica: '1 socorrista: 2 dedos (ou 2 polegares) no centro do tórax abaixo da linha intermamilar; 2 ou mais: 2 polegares com as mãos envolvendo o tórax',
    }
  }
  if (f === 'crianca') {
    return {
      ...COMUM,
      profundidade: '1/3 do diâmetro anteroposterior — cerca de 5 cm',
      relacao: '30:2 com 1 socorrista; 15:2 com 2 ou mais',
      pulso: 'carotídeo ou femoral, no máximo 10 segundos',
      tecnica: '1 ou 2 mãos no terço inferior do esterno',
    }
  }
  return {
    ...COMUM,
    profundidade: '5 a 6 cm (p. 26)',
    relacao: 'o livro remete o adolescente às diretrizes de RCP do adulto (p. 25)',
    pulso: 'carotídeo ou femoral, no máximo 10 segundos',
    tecnica: 'diretrizes de adulto (p. 25)',
    pagina: 'p. 25–26',
  }
}

/** Outros números do capítulo que valem para lactente e criança. */
export const OUTROS_PARAMETROS: { rotulo: string; valor: string; pagina: string }[] = [
  { rotulo: 'Ventilação de resgate (pulso presente, respiração anormal)', valor: '1 ventilação a cada 2 a 3 s (20 a 30/min); checar pulso a cada 2 min; compressões se FC < 60/min com hipoperfusão', pagina: 'p. 26' },
  { rotulo: 'Interrupção das compressões', valor: 'menos de 10 segundos', pagina: 'p. 31 (Tabela 1)' },
  { rotulo: 'Rodízio de quem comprime', valor: 'a cada 2 minutos', pagina: 'p. 26' },
  { rotulo: 'Bolsa autoinflável', valor: '450 a 500 mL para lactentes e crianças menores; 1.000 mL para crianças maiores e adolescentes', pagina: 'p. 29' },
  { rotulo: 'Fluxo de O₂ no reservatório da bolsa', valor: '10 a 15 L/min na bolsa pediátrica; 15 L/min na bolsa de adulto', pagina: 'p. 29' },
  { rotulo: 'Epinefrina nos ritmos não chocáveis', valor: 'o mais cedo possível, idealmente até 5 minutos da PCR; repetir a cada 3 a 5 min', pagina: 'p. 31, 35' },
  { rotulo: 'Pós-PCR — oxigenação', valor: 'SpO₂ de 94 a 99%', pagina: 'p. 35, 37 (Tabela 3)' },
  { rotulo: 'Pós-PCR — pressão', valor: 'PA sistólica acima do percentil 5 para idade e sexo', pagina: 'p. 35, 37' },
  { rotulo: 'Pós-PCR — temperatura (comatoso)', valor: 'normotermia 36 a 37,5 °C ou hipotermia leve 32 a 34 °C; evitar febre', pagina: 'p. 35, 37' },
]

// ── Desfibrilação e cardioversão (p. 28–29, 35; cap. 2 p. 51–52) ──

/** Carga máxima de adulto que o livro cita para o choque subsequente (p. 35). */
export const CARGA_ADULTO = { bifasico: [120, 200] as Faixa, monofasico: 360 }

export type Cargas = {
  primeiro: number
  segundo: number
  subsequentes: Faixa
  /** a ponta de cima dos subsequentes passa da carga máxima bifásica de adulto citada no livro */
  acimaDoAdulto: boolean
  cardioversaoInicial: Faixa
  cardioversaoSeguinte: Faixa
}

/** Joules pelo peso: FV/TV sem pulso 2 → 4 → 4–10 J/kg; cardioversão TSV 0,5–1 → 1–2 J/kg. */
export function cargasPorPeso(pesoKg: number): Cargas | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const subsequentes: Faixa = [4 * pesoKg, 10 * pesoKg]
  return {
    primeiro: 2 * pesoKg,
    segundo: 4 * pesoKg,
    subsequentes,
    acimaDoAdulto: subsequentes[1] > CARGA_ADULTO.bifasico[1],
    cardioversaoInicial: [0.5 * pesoKg, 1 * pesoKg],
    cardioversaoSeguinte: [1 * pesoKg, 2 * pesoKg],
  }
}

export const NOTAS_CHOQUE: { texto: string; pagina: string }[] = [
  { texto: 'FV/TV sem pulso: 1º choque 2 J/kg; se refratário, 4 J/kg; os seguintes, 4 a 10 J/kg ou a dose máxima indicada para adultos (120 a 200 J no bifásico, 360 J no monofásico).', pagina: 'p. 35' },
  { texto: 'Pás do desfibrilador manual: adulto para maiores de 1 ano ou 10 kg; infantil para menores de 1 ano. Posição anterolateral; anteroposterior se as pás se tocarem.', pagina: 'p. 35' },
  { texto: 'DEA: carga fixa de cerca de 250 J; pás pediátricas com atenuador abaixo de 8 anos, quando disponível; na falta, pá de adulto (exceto no período neonatal). Pode ser usado abaixo de 1 ano na falta de desfibrilador manual.', pagina: 'p. 28–29, 31' },
  { texto: 'Cardioversão sincronizada na TSV: 0,5 a 1 J/kg; se persistir, duplicar para 1 a 2 J/kg. Se não converter, reavaliar TSV versus TV. Modo sync antes de cada tentativa.', pagina: 'cap. 2, p. 51–52' },
]

// ── Drogas (Tabela 2, p. 31–32; bradicardia p. 32; adenosina cap. 2 p. 50) ──

export type GrupoRcp = 'pcr' | 'bradicardia' | 'tsv'

export const GRUPOS_RCP: Record<GrupoRcp, string> = {
  pcr: 'PCR (Tabela 2 do cap. 1)',
  bradicardia: 'Bradicardia com hipoperfusão',
  tsv: 'Taquicardia supraventricular',
}

export type DoseRcp = DosePeso & { grupo: GrupoRcp }

export const DROGAS_RCP: DoseRcp[] = [
  { grupo: 'pcr', id: 'epinefrina-iv', nome: 'Epinefrina IV/IO', unidade: 'mg', porKg: [0.01, 0.01], porMl: 0.1, solucao: '1:10.000 (1 ampola + 9 mL de SF ou AD) — 0,1 mL/kg', via: 'IV/IO; repetir a cada 3 a 5 min', pagina: 'p. 31 (Tabela 2)' },
  { grupo: 'pcr', id: 'epinefrina-et', nome: 'Epinefrina traqueal', unidade: 'mg', porKg: [0.1, 0.1], porMl: 1, solucao: '1:1.000 — 0,1 mL/kg', via: 'ET, só sem acesso vascular (absorção errática)', pagina: 'p. 31 (Tabela 2)' },
  { grupo: 'pcr', id: 'amiodarona', nome: 'Amiodarona', unidade: 'mg', porKg: [5, 5], maximo: 300, via: 'IV/IO na FV/TV sem pulso refratária ao choque; máximo diário 15 mg/kg', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'pcr', id: 'lidocaina-iv', nome: 'Lidocaína IV/IO', unidade: 'mg', porKg: [1, 1], via: 'IV/IO na FV/TV sem pulso refratária ao choque', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'pcr', id: 'lidocaina-et', nome: 'Lidocaína traqueal', unidade: 'mg', porKg: [2, 3], via: 'ET', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'pcr', id: 'bicarbonato', nome: 'Bicarbonato de sódio 8,4%', unidade: 'mEq', porKg: [1, 1], porMl: 1, solucao: '8,4%: 1 mL = 1 mEq', via: 'IV/IO; não é de rotina — PCR prolongada, acidose metabólica grave documentada', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'pcr', id: 'calcio', nome: 'Cálcio elementar', unidade: 'mg', porKg: [5, 7], via: 'IV/IO, de preferência central; hipocalcemia, hipercalemia, hipermagnesemia, bloqueador de canal de cálcio', pagina: 'p. 31–32 (Tabela 2)',
    nota: 'Volume pelo livro: 0,2 mL/kg de cloreto de cálcio 10% ou 0,6 mL/kg de gluconato de cálcio (ver abaixo).' },
  { grupo: 'pcr', id: 'cloreto-calcio', nome: 'Cloreto de cálcio 10% (volume)', unidade: 'mL', porKg: [0.2, 0.2], via: 'IV/IO, de preferência central (preparação de escolha)', pagina: 'p. 31–32 (Tabela 2)' },
  { grupo: 'pcr', id: 'gluconato-calcio', nome: 'Gluconato de cálcio (volume)', unidade: 'mL', porKg: [0.6, 0.6], via: 'IV/IO', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'pcr', id: 'magnesio', nome: 'Sulfato de magnésio 50%', unidade: 'mg', porKg: [25, 50], porMl: 500, solucao: 'MgSO₄ 50% = 500 mg/mL', via: 'IV; hipomagnesemia, torsades de pointes', pagina: 'p. 31–32 (Tabela 2)' },
  { grupo: 'pcr', id: 'glicose', nome: 'Glicose (hipoglicemia)', unidade: 'g', porKg: [0.5, 1], mlPorKg: [2, 4], solucao: 'glicose 25%: 2 a 4 mL/kg', via: 'IV/IO', pagina: 'p. 32 (Tabela 2)' },
  { grupo: 'bradicardia', id: 'epinefrina-bradi', nome: 'Epinefrina', unidade: 'mg', porKg: [0.01, 0.01], porMl: 0.1, solucao: '1:10.000 — 0,1 mL/kg', via: 'IV/IO, repetir a cada 3 a 5 min, se persistir apesar de via aérea e ventilação', pagina: 'p. 32' },
  { grupo: 'bradicardia', id: 'atropina', nome: 'Atropina', unidade: 'mg', porKg: [0.02, 0.02], via: 'na suspeita de tônus vagal aumentado ou BAV primário; pode ser repetida uma vez', pagina: 'p. 32' },
  { grupo: 'tsv', id: 'adenosina-1', nome: 'Adenosina — 1ª dose', unidade: 'mg', porKg: [0.1, 0.1], maximo: 6, via: 'bolo IV rápido seguido de 3 a 5 mL de AD ou SF; acesso central: cerca de 50% da dose', pagina: 'cap. 2, p. 50' },
  { grupo: 'tsv', id: 'adenosina-2', nome: 'Adenosina — 2ª dose (dobrada)', unidade: 'mg', porKg: [0.2, 0.2], maximo: 12, via: 'bolo IV rápido', pagina: 'cap. 2, p. 50' },
]
