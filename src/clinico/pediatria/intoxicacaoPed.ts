import { BOLUS, type Bolus } from './bolus.ts'
import { fichaP4, type DoseLivro, type Referencia } from './fonteP4.ts'

// Intoxicações exógenas — livro do ICr, cap. 18 (p. 201–208). Os antídotos do
// Apêndice já estão em bolus.ts (grupo "antidoto") e são reaproveitados aqui;
// este arquivo só traz o que o CAPÍTULO acrescenta (descontaminação,
// eliminação, via oral da acetilcisteína, pralidoxima IM, atropina na faixa do
// capítulo) e as Tabelas 2 e 3. A decisão é do médico (ADR 0007); o capítulo
// recomenda consultar o centro de controle de intoxicações antes de um
// antídoto (p. 205–206).

export const fichaIntoxicacaoPed = fichaP4('ped-intoxicacoes', 'Intoxicações exógenas — criança', 'cap. 18, p. 201–208; Apêndice, p. 894–910')

/** Antídotos do Apêndice (bolus.ts), sem duplicar número. */
export const ANTIDOTOS_APENDICE: Bolus[] = BOLUS.filter((b) => b.grupo === 'antidoto')

export const DOSES_CAPITULO_INTOX: DoseLivro[] = [
  { id: 'carvao-cap', nome: 'Carvão ativado (texto do capítulo)', unidade: 'g', porKgDose: [0.5, 1], via: 'VO ou SNG; maior eficácia até 1 h da ingestão', pagina: 'p. 205',
    nota: 'O capítulo dá "até um máximo de 25 a 100 g em adolescentes e adultos" (p. 205) — sem teto para a criança menor; o Apêndice dá máx. 50 g/dose (p. 899). Paciente com rebaixamento: intubação antes, para prevenir aspiração (p. 205).' },
  { id: 'furosemida-vo', nome: 'Furosemida — diurese forçada, VO', unidade: 'mg', porKgDose: [1, 3], via: 'VO, com hiper-hidratação de 20 a 30% acima da necessidade basal', pagina: 'p. 205' },
  { id: 'furosemida-iv', nome: 'Furosemida — diurese forçada, EV', unidade: 'mg', porKgDose: [0.5, 1], via: 'EV, com hiper-hidratação de 20 a 30% acima da necessidade basal', pagina: 'p. 205' },
  { id: 'bicarbonato-alcalina', nome: 'Bicarbonato de sódio — diurese alcalina', unidade: 'mEq', porKgDose: [1, 2], via: 'em 3 a 4 h, pH urinário checado a cada hora (alvo ≥ 7,5); monitorar eletrólitos, sobretudo potássio', pagina: 'p. 205',
    nota: 'Tóxicos ácidos de baixa ligação proteica e eliminação renal: salicilatos, fenobarbital e antidepressivos tricíclicos (p. 205).' },
  { id: 'acetilcisteina-vo-ataque', nome: 'Acetilcisteína VO — ataque (acetaminofeno)', unidade: 'mg', porKgDose: [140, 140], via: 'VO', pagina: 'p. 206' },
  { id: 'acetilcisteina-vo-manut', nome: 'Acetilcisteína VO — manutenção', unidade: 'mg', porKgDose: [70, 70], via: 'VO a cada 4 h, 17 doses (3 dias de tratamento)', pagina: 'p. 206',
    nota: 'O Apêndice traz o esquema EV (150 → 50 → 100 mg/kg, p. 897), já na ferramenta de doses por peso.' },
  { id: 'atropina-cap', nome: 'Atropina — organofosforados e carbamatos (capítulo)', unidade: 'mg', porKgDose: [0.01, 0.05], via: 'de preferência IV, repetida em intervalos de minutos até melhora ou sinais de intoxicação atropínica', pagina: 'p. 206',
    nota: 'O Apêndice dá 0,02 a 0,05 mg/kg, a cada 10 a 20 min (p. 894). Nenhum dos dois traz máximo.' },
  { id: 'pralidoxima-im', nome: 'Pralidoxima — IM', unidade: 'mg', porKgDose: [15, 15], via: 'IM; pode ser repetida mais duas vezes. Evitar em carbamatos; sempre com atropina', pagina: 'p. 207',
    nota: 'EV: 20 a 50 mg/kg (máx. 2.000 mg) e infusão de 10 a 20 mg/kg/h — nas ferramentas de doses por peso e de infusões.' },
  { id: 'vitk-sc', nome: 'Vitamina K1 — SC, sem sangramento ativo', unidade: 'mg', fixo: [2, 5], via: 'SC', pagina: 'p. 208',
    nota: 'EV: 0,03 mg/kg/dose (p. 208). Sangramento significativo: 5 mg (p. 208).' },
]

/** Tabela 2 (p. 203–204): toxíndromes — referência. */
export const TOXINDROMES: { nome: string; clinica: string; agentes: string }[] = [
  { nome: 'Anticolinérgica', clinica: 'Midríase, rubor cutâneo, mucosas secas, hipertermia, taquicardia, retenção urinária, agitação psicomotora, alucinações e delírios', agentes: 'Anti-histamínicos H1, atropina, escopolamina, fenotiazídicos, antidepressivos tricíclicos, vegetais beladonados' },
  { nome: 'Colinérgica', clinica: 'Miose, sudorese, lacrimejamento, salivação, broncoespasmo, bradicardia, diarreia e fasciculações musculares', agentes: 'Inseticidas organofosforados e carbamatos, prostigmina, alguns cogumelos' },
  { nome: 'Simpatomimética', clinica: 'Midríase, rubor cutâneo, sudorese, taquicardia, hipertensão, hipertermia, agitação psicomotora', agentes: 'Cocaína, anfetaminas e derivados, descongestionantes nasais, cafeína, teofilina' },
  { nome: 'Narcótica', clinica: 'Miose, depressão respiratória, depressão neurológica, bradicardia, hipotermia, hipotensão, hiporreflexia', agentes: 'Opioides (codeína, fentanil, heroína, morfina, oxicodona, metadona)' },
  { nome: 'Depressiva', clinica: 'Depressão neurológica, depressão respiratória, cianose, hiporreflexia, hipotensão', agentes: 'Barbitúricos, benzodiazepínicos, etanol' },
  { nome: 'Extrapiramidal (distonia aguda)', clinica: 'Hipertonia, espasmos musculares, roda denteada, parkinsonismo, mímica facial pobre, choro monótono', agentes: 'Metoclopramida, domperidona, butirofenonas (haloperidol), fenotiazídicos, fenciclidina, lítio' },
  { nome: 'Metemoglobinêmica', clinica: 'Cianose, palidez, confusão mental, depressão neurológica', agentes: 'Azul de metileno, dapsona, doxorrubicina, fenazopiridina, furazolidona, nitratos, nitritos, nitrofurantoína, piridina, sulfametoxazol' },
]

/** Tabela 3 (p. 206): agentes com antídoto de eficácia comprovada — referência. */
export const ANTIDOTOS_TABELA3: [string, string][] = [
  ['Acetaminofeno', 'N-acetilcisteína'],
  ['Antidepressivos tricíclicos', 'Bicarbonato de sódio'],
  ['Arsênico', 'BAL/penicilamina'],
  ['Benzodiazepínicos', 'Flumazenil'],
  ['Betabloqueadores', 'Glucagon'],
  ['Chumbo', 'DMSA/EDTA/BAL'],
  ['Cianeto', 'Nitrito de amila + nitrito de sódio + tiossulfato de sódio'],
  ['Dicumarínicos', 'Vitamina K (fitonadiona)'],
  ['Digoxina', 'Anticorpo antidigoxina (Fab)'],
  ['Hipoglicemiantes orais (sulfonilureias)', 'Octreotida'],
  ['Inibidores da acetilcolinesterase (organofosforados e carbamatos)', 'Atropina'],
  ['Isoniazida', 'Piridoxina'],
  ['Kelocyanor', 'Hidroxicobalamina'],
  ['Mercúrio', 'BAL/penicilamina/DMSA'],
  ['Metanol/etilenoglicol', 'Etanol/fomepizol'],
  ['Metemoglobinizantes', 'Azul de metileno'],
  ['Metoclopramida, haloperidol', 'Difenidramina, biperideno'],
  ['Monóxido de carbono', 'O₂ a 100%, 1–3 atm'],
  ['Opioides', 'Naloxona'],
  ['Organofosforados', 'Oximas: pralidoxima, obidoxima'],
  ['Sais de ferro', 'Deferoxamina'],
  ['Tiroxina', 'Propranolol'],
]

export const REFERENCIAS_INTOX: Referencia[] = [
  { rotulo: 'Etapas', texto: 'Avaliação e estabilização; toxíndrome e agente; descontaminação; eliminação; antídotos — em geral, mas não necessariamente, nessa ordem (Quadro 1).', pagina: 'p. 202–203' },
  { rotulo: 'Lavagem gástrica', texto: 'Restrita a ingestão recente de medicações não adsorvidas pelo carvão (lítio, ferro) em pacientes sintomáticos; uso rotineiro contraindicado. Ipeca contraindicada.', pagina: 'p. 205' },
  { rotulo: 'Carvão em múltiplas doses', texto: 'Pode ser considerado em ingestão elevada de carbamazepina, dapsona, fenobarbital, quinino ou teofilina.', pagina: 'p. 205' },
  { rotulo: 'Exames indiretos', texto: 'Queda > 50% da colinesterase sanguínea: altamente sugestiva de organofosforados/carbamatos. Metemoglobinemia > 15%: acompanhada de sintomatologia.', pagina: 'p. 204' },
  { rotulo: 'Etanol (metanol/etilenoglicol)', texto: 'Alvo de alcoolemia em torno de 100 mg/dL; o livro cita "50 g de álcool" sem dose por peso — a ferramenta não calcula.', pagina: 'p. 206' },
  { rotulo: 'Exsanguineotransfusão', texto: 'Principal indicação: metemoglobinemia tóxica com falha do azul de metileno.', pagina: 'p. 205' },
]

/** Erratas do capítulo conferidas no PDF (p. 204): unidades dos níveis séricos. */
export const ERRATA_NIVEIS =
  'Os níveis séricos de referência da p. 204 estão impressos com unidades incoerentes — chumbo "> 25 mg/dL", fenobarbital "> 30 mg/mL", ferro "> 300 mg/dL", teofilina "(20 mg/mL)" sem sinal. Não são mostrados como valor de corte.'
