import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP2, type DosePeso, type Faixa } from './fonteP2.ts'

// RCP pediátrica e arritmias — livro do ICr (caps. 1 e 2). Parâmetros de
// compressão/ventilação, cargas de desfibrilação e cardioversão por peso e as
// drogas da Tabela 2 do cap. 1, com página. O livro segue a AHA 2020; o
// adolescente (sinais de puberdade) usa as diretrizes de adulto (p. 25).
//
// Versão .1 de 28/09/2026: diretrizes AHA/AAP 2025 (PBLS e PALS), lidas no
// documento oficial "Destaques das Diretrizes 2025" (edição Heart & Stroke,
// p. 11–15); o texto integral do Part 8 não pôde ser aberto. Doses e cargas
// continuam as do livro (os destaques não as alteram).

export const AHA_AAP_2025: Fonte = {
  citacao: 'Lasa JJ, Dhillon GS, Duff JP, et al. Part 8: Pediatric Advanced Life Support: 2025 American Heart Association and American Academy of Pediatrics Guidelines for CPR and ECC. Circulation. 2025;152(16 Suppl 2):S479–S537; e Part 6 (PBLS). Lidos em: American Heart Association. Highlights of the 2025 AHA Guidelines for CPR and ECC, Heart & Stroke edition, p. 11–15.',
  url: 'https://doi.org/10.1161/CIR.0000000000001368',
  pediatrica: true,
}

const baseRcp = fichaP2('ped-rcp-icr', 'RCP pediátrica — parâmetros, choque e drogas', 'cap. 1, p. 24–38; cap. 2, p. 39–58')

export const fichaRcpPediatrica: Ficha = {
  ...baseRcp,
  versao: '2026-09-28.1',
  fontes: [...baseRcp.fontes, AHA_AAP_2025],
  revisadoEm: '28/09/2026 (AHA/AAP 2025 conferida pelos Destaques oficiais; livro do ICr mantido como base)',
}

/** Alvo de pressão diastólica durante a RCP com linha arterial (AHA 2025, novo): ≥ 25 mmHg no lactente; ≥ 30 mmHg a partir de 1 ano. */
export function metaPadRcp2025(faixa: FaixaRcp): number {
  return faixa === 'lactente' ? 25 : 30
}

export type ItemPals2025 = { tema: string; aha: string; estado: 'novo' | 'atualizado'; pagina: string; livro: string }

export const DIRETRIZ_PALS_2025: ItemPals2025[] = [
  { tema: 'Compressão no lactente', aha: 'Comprimir o esterno com a base de 1 mão ou com os 2 polegares e mãos envolvendo o tórax; se não conseguir envolver o tórax, base de 1 mão. A técnica de 2 dedos não é mais recomendada', estado: 'atualizado', pagina: 'p. 11 (PBLS)', livro: '1 socorrista: 2 dedos (ou 2 polegares); 2 ou mais: 2 polegares (p. 26)' },
  { tema: 'Pausas', aha: 'Minimizar interrupções; pausas nas compressões < 10 s', estado: 'novo', pagina: 'p. 11', livro: 'interrupção < 10 s (Tabela 1, p. 31)' },
  { tema: 'Obstrução de via aérea por corpo estranho', aha: 'Lactente: ciclos de 5 golpes nas costas e 5 compressões torácicas (base de 1 mão); criança: 5 golpes nas costas e 5 compressões abdominais, até expelir ou ficar irresponsivo', estado: 'atualizado', pagina: 'p. 11', livro: '—' },
  { tema: 'Adrenalina', aha: 'Ritmo inicial não chocável: primeira dose o mais cedo possível (< 3 min associado aos melhores desfechos)', estado: 'atualizado', pagina: 'p. 14', livro: 'o mais cedo possível, idealmente até 5 min; repetir a cada 3–5 min (p. 31, 35)' },
  { tema: 'EtCO₂', aha: 'Com via aérea invasiva, pode ser considerado para monitorar a qualidade da RCP; um valor isolado de EtCO₂ não deve ser usado para encerrar a reanimação (houve sobrevida com média < 20 mmHg)', estado: 'novo', pagina: 'p. 14', livro: '—' },
  { tema: 'Pressão arterial invasiva na RCP', aha: 'Com linha arterial, pode ser razoável mirar PAD ≥ 25 mmHg no lactente e ≥ 30 mmHg a partir de 1 ano', estado: 'novo', pagina: 'p. 14', livro: '—' },
  { tema: 'TSV com comprometimento refratária', aha: 'Sem resposta a manobra vagal, adenosina e cardioversão sincronizada e sem especialista disponível: procainamida, amiodarona ou sotalol IV podem ser razoáveis', estado: 'atualizado', pagina: 'p. 14', livro: 'adenosina 0,1 → 0,2 mg/kg; cardioversão 0,5–1 → 1–2 J/kg (cap. 2, p. 50–52)' },
  { tema: 'Pós-PCR — pressão', aha: 'Manter PAS e PAM acima do percentil 10 para a idade; hipotensão (< p5) é comum (25–50%) e associada a pior sobrevida', estado: 'atualizado', pagina: 'p. 14', livro: 'PA sistólica acima do percentil 5 (p. 35, 37)' },
  { tema: 'Prognóstico neurológico', aha: 'Usar múltiplas modalidades; reflexo de tosse/vômito ou resposta à dor isolados não são bem estabelecidos; EEG até 72 h pode apoiar o prognóstico junto com outros critérios', estado: 'atualizado', pagina: 'p. 15', livro: '—' },
  { tema: 'Sobrevivência', aha: 'Avaliar necessidades físicas, cognitivas e emocionais no 1º ano após a PCR', estado: 'atualizado', pagina: 'p. 15', livro: '—' },
  { tema: 'Doses e cargas', aha: 'Os Destaques 2025 não alteram as doses da Tabela 2 nem as cargas de desfibrilação do livro; o texto integral do Part 8 não foi aberto', estado: 'atualizado', pagina: '—', livro: 'Tabela 2 (p. 31–32); 2 → 4 → 4–10 J/kg (p. 35)' },
]

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
