import { fichaP4, type DoseLivro } from './fonteP4.ts'
import { positivoP5, type ItemLivro } from './fonteP5.ts'

// Febre no paciente imunodeprimido não oncológico — livro do ICr, cap. 47
// (p. 478–486). Terapia antimicrobiana empírica da Tabela 7 (p. 482) por peso,
// com os máximos da Tabela 2 do Apêndice (p. 897–909) quando o capítulo não os
// traz. Teicoplanina fica sem cálculo (texto ambíguo, ver errata). Corticoide
// em dose imunossupressora (p. 484). Sem valor neonatal.

export const fichaImunodeprimidoPed = fichaP4('ped-febre-imunodeprimido', 'Febre no imunodeprimido não oncológico — criança', 'cap. 47, p. 478–486; Apêndice, p. 897–909')

const AP = (pag: string, max: string) => `máx. do Apêndice: ${max} (${pag})`

/** Tabela 7 (p. 482). */
export const DOSES_IMUNODEPRIMIDO: DoseLivro[] = [
  { id: 'aciclovir', nome: 'Aciclovir — HSV, CMV, EBV, VZV', unidade: 'mg', porKgDia: [40, 60], doses: [3, 3], via: 'de 8/8 h', pagina: 'p. 482',
    nota: 'Apêndice (p. 897): IV 10 a 15 mg/kg/dose (< 12 anos) ou 500 mg/m²/dose de 8/8 h, sem máximo em mg.' },
  { id: 'anfotericina', nome: 'Anfotericina B — antifúngico e antiprotozoário', unidade: 'mg', porKgDia: [1, 1.5], doses: [1, 1], via: '1x/dia', pagina: 'p. 482',
    nota: 'A Tabela 7 não diz a formulação. Apêndice (p. 898): desoxicolato 0,3 a 1 mg/kg/dia (dose-teste 0,1 mg/kg); lipossomal 3 a 5 mg/kg/dia.' },
  { id: 'ampicilina', nome: 'Ampicilina — Listeria, pneumococo, meningococo, H. influenzae', unidade: 'mg', porKgDia: [200, 300], doses: [4, 4], via: 'de 6/6 h', pagina: 'p. 482', nota: 'O Apêndice (p. 898) não traz máximo para a via IV.' },
  { id: 'azitromicina', nome: 'Azitromicina — MAC, Legionella, Cryptosporidium', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDose: 500, fonteMaximo: AP('p. 898', '500 mg/dose (IV)'), via: '1x/dia', pagina: 'p. 482' },
  { id: 'cefepima', nome: 'Cefepima — E. coli, Klebsiella', unidade: 'mg', porKgDia: [150, 150], doses: [3, 3], maxDose: 2000, fonteMaximo: AP('p. 899', '2 g/dose'), via: 'de 8/8 h', pagina: 'p. 482' },
  { id: 'cefotaxima', nome: 'Cefotaxima', unidade: 'mg', porKgDia: [200, 200], doses: [4, 4], maxDia: 6000, fonteMaximo: AP('p. 899', '6 g/dia'), via: 'de 6/6 h', pagina: 'p. 482' },
  { id: 'ceftazidima', nome: 'Ceftazidima — P. aeruginosa', unidade: 'mg', porKgDia: [150, 150], doses: [3, 3], maxDia: 6000, fonteMaximo: AP('p. 899', '6 g/dia'), via: 'de 8/8 h', pagina: 'p. 482' },
  { id: 'ceftriaxona', nome: 'Ceftriaxona', unidade: 'mg', porKgDia: [50, 100], doses: [2, 2], maxDose: 2000, fonteMaximo: AP('p. 899', '2 g/dose'), via: 'de 12/12 h', pagina: 'p. 482' },
  { id: 'fluconazol', nome: 'Fluconazol — C. albicans, Cryptococcus', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDia: 600, fonteMaximo: AP('p. 902', '600 mg/dia'), via: '1x/dia', pagina: 'p. 482' },
  { id: 'cipro', nome: 'Ciprofloxacino', unidade: 'mg', porKgDia: [20, 30], doses: [2, 2], maxDia: 800, fonteMaximo: AP('p. 900', '800 mg/dia IV (1.500 mg/dia VO)'), via: 'de 12/12 h', pagina: 'p. 482' },
  { id: 'gentamicina', nome: 'Gentamicina — P. aeruginosa, Serratia, Staphylococcus', unidade: 'mg', porKgDia: [7.5, 7.5], doses: [3, 3], via: 'de 8/8 h', pagina: 'p. 482',
    nota: 'Apêndice (p. 902): 5 a 10 mg/kg/dia 1x/dia, sem máximo.' },
  { id: 'tmp', nome: 'TMP/SMX — P. jirovecii, Nocardia, Listeria e outros', unidade: 'mg', porKgDia: [20, 20], doses: [4, 4], via: 'de 6/6 h; dose do trimetoprim (Apêndice, p. 908)', pagina: 'p. 482',
    nota: 'Apêndice (p. 908): infecção grave 20 mg/kg/dia 3 a 4x (máx. 160 mg/dose); P. jirovecii 15 a 20 mg/kg/dia sem máximo. Teto não aplicado.' },
  { id: 'vancomicina', nome: 'Vancomicina — MRSA', unidade: 'mg', porKgDia: [40, 60], doses: [4, 4], maxDia: 2000, fonteMaximo: AP('p. 909', '2.000 mg/dia'), via: 'de 6/6 h', pagina: 'p. 482' },
]

export const ERRATA_TEICOPLANINA =
  'Teicoplanina (Tabela 7, p. 482, conferida no PDF): "10 mg/kg/d de 12/12 h nas 3 primeiras doses, após, 10 mg/kg/d 1x/dia"; o Apêndice (p. 909): "10 mg/kg/dia, a cada 12 horas, nas primeiras 3 doses, e após 6 a 10 mg/kg, 1 vez ao dia (máx. 400 mg/dose)". "/dia" de 12/12 h não deixa claro se 10 mg/kg é a dose ou o total do dia; a ferramenta não calcula.'

/**
 * Corticoide imunossupressor (p. 484): equivalente a prednisona 2 mg/kg/dia por 1 semana
 * ou 1 mg/kg/dia por 15 a 30 dias. Devolve se atinge algum dos dois limiares.
 */
export function corticoideImunossupressor(mgKgDia: number, dias: number): boolean | null {
  if (!positivoP5(mgKgDia, dias)) return null
  return (mgKgDia >= 2 && dias >= 7) || (mgKgDia >= 1 && dias >= 15)
}

export const NOTA_CORTICOIDE =
  'O livro dá "1 mg/kg/dia, por 15 a 30 dias"; a ferramenta usa o menor tempo (15 dias) como limiar.'

/** Tabela 2 (p. 479–480): padrão por tipo de erro inato. */
export const PADROES_IMUNIDADE: [string, string, string, string][] = [
  ['Celulares', 'Precoce', 'Micobactérias, Pseudomonas, CMV, EBV, VZV, enterovírus, Candida, P. jirovecii', 'Baixo ganho, candidíase persistente; BCGite, hipocalcemia, GVHD'],
  ['Humorais', '5 a 12 meses ou fim da infância', 'S. pneumoniae, Hib, S. aureus, Campylobacter, enterovírus, giárdia, Cryptosporidium', 'Sinopulmonares, GI, artrite, meningoencefalite; autoimunidade, linfoma'],
  ['Fagócitos', 'Precoce', 'S. aureus, Pseudomonas, Serratia, Klebsiella, Candida, Nocardia, Aspergillus', 'Celulite, abscessos, adenite, periodontite, osteomielite; queda tardia do coto'],
  ['Complemento', 'Qualquer idade', 'N. meningitidis, E. coli', 'Meningite, artrite, septicemia; vasculite, LES, glomerulonefrite'],
]

/** Tabela 5 (p. 481): profilaxia e vacinação por imunodeficiência. */
export const PROFILAXIA: [string, string, string, string][] = [
  ['DGC', 'TMP/SMX, itraconazol', 'IFN-gama', 'Evitar BCG; considerar evitar vírus vivos'],
  ['Agamaglobulinemia', 'TMP/SMX ou amoxicilina (azitromicina se bronquiectasia)', 'IVIG', 'Vacinar familiares; influenza anual'],
  ['SCID', 'TMP/SMX, fluconazol, considerar aciclovir', 'IVIG', 'Evitar BCG e vírus vivos'],
  ['DiGeorge', 'Frequentemente não necessário', '—', 'Vírus vivo caso a caso'],
  ['STAT1', 'Fluconazol; aciclovir/valaciclovir se HSV/VZV', 'Considerar IVIG', '—'],
  ['Complemento / asplenia', 'Penicilina ou amoxicilina', '—', 'Meningocócica e pneumocócica'],
]

export const REFERENCIAS_IMUNO: ItemLivro[] = [
  { texto: 'Abordagem: história e exame cuidadosos, exames extensos, antibiótico de largo espectro empírico, antecipar complicações e coinfecções, monitorar resposta e considerar reduzir a imunossupressão.', pagina: 'p. 480, Figura 1 p. 485' },
  { texto: 'Hemocultura pareada (central e periférica) se cateter central; culturas de vigilância na suspeita de multirresistentes; RX só com quadro respiratório.', pagina: 'p. 481' },
  { texto: 'Transplante de órgão sólido: precoce (0–30 dias) infecções cirúrgicas e nosocomiais; intermediário (1–6 meses) CMV, P. jirovecii, aspergilose, toxoplasmose, nocardiose, reativações; tardio depende do enxerto e da imunossupressão.', pagina: 'p. 482–483' },
  { texto: 'TCTH: fase I até a pega (20–30 dias, neutropenia e mucosite); fase II até D+100 (imunidade celular, DECH); fase III após D+100.', pagina: 'p. 483–484' },
  { texto: 'Imunobiológicos: anti-TNF → tuberculose, micoses endêmicas, Listeria, hepatite B; anti-CD20 → bactérias, hepatite B; alemtuzumabe → herpes, poliomavírus, Pneumocystis, Aspergillus.', pagina: 'Tabela 10, p. 485' },
]
