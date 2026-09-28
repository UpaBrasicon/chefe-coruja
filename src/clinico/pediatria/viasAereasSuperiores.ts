import { fichaP4, type DoseLivro, type Referencia } from './fonteP4.ts'

// Afecções das vias aéreas superiores — livro do ICr, cap. 28 (p. 285–299):
// otite média aguda, faringotonsilite estreptocócica, sinusite bacteriana e
// crupe viral (o livro NÃO traz o escore de Westley: a gravidade do crupe é a
// Tabela 6, qualitativa). Máximos que o capítulo não traz vêm da Tabela 2 do
// Apêndice (p. 897–910), citados em `fonteMaximo`.

export const fichaViasAereasSuperiores = fichaP4('ped-vias-aereas-superiores', 'OMA, faringite, sinusite e crupe — criança', 'cap. 28, p. 285–299; Apêndice, p. 897–910')

const AP_CEFUROXIMA = 'máx. do Apêndice: cefuroxima VO 500 mg/dose (p. 900)'
const AP_CEFTRIAXONA = 'máx. do Apêndice: ceftriaxona 2 g/dose (p. 899)'
const AP_CLARITRO = 'máx. do Apêndice: claritromicina 500 mg/dose (p. 900)'
const AP_AMOXCLAV14 = 'máx. do Apêndice: amoxicilina-clavulanato 14:1, 4.000 mg/dia de amoxicilina (p. 898)'

export const DOSES_OMA: DoseLivro[] = [
  { id: 'oma-amox', nome: 'Amoxicilina (1ª escolha)', unidade: 'mg', porKgDia: [50, 90], doses: [2, 2], via: 'VO de 12/12 h', pagina: 'p. 286–287',
    nota: 'A SBP recomenda 50 mg/kg/dia no Brasil; os 90 mg/kg/dia da AAP refletem a resistência do pneumococo nos EUA (p. 286–287).' },
  { id: 'oma-amox-alta', nome: 'Amoxicilina em alta dose (falha ou uso nos últimos 30 dias)', unidade: 'mg', porKgDia: [90, 90], doses: [2, 2], via: 'VO de 12/12 h por 10 dias', pagina: 'p. 287' },
  { id: 'oma-amoxclav', nome: 'Amoxicilina + clavulanato (alta dose)', unidade: 'mg', porKgDia: [90, 90], doses: [2, 2], maxDia: 4000, fonteMaximo: AP_AMOXCLAV14, via: 'VO de 12/12 h por 10 dias; clavulanato 6,4 mg/kg/dia', pagina: 'p. 287', nota: 'Dose referente à amoxicilina.' },
  { id: 'oma-cefuroxima', nome: 'Axetilcefuroxima', unidade: 'mg', porKgDia: [30, 30], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CEFUROXIMA, via: 'VO de 12/12 h por 10 dias', pagina: 'p. 287' },
  { id: 'oma-ceftriaxona', nome: 'Ceftriaxona', unidade: 'mg', porKgDose: [50, 50], doses: [1, 1], maxDose: 2000, fonteMaximo: AP_CEFTRIAXONA, via: 'IM 1 vez ao dia por 3 dias', pagina: 'p. 287' },
  { id: 'oma-clinda', nome: 'Clindamicina (alergia grave à penicilina)', unidade: 'mg', porKgDia: [30, 40], doses: [3, 3], maxDia: 1800, fonteMaximo: 'máx. do Apêndice: clindamicina VO 1,8 g/dia (p. 900)', via: 'VO de 8/8 h por 10 dias', pagina: 'p. 287',
    nota: 'O Apêndice traz clindamicina VO 10 a 30 mg/kg/dia (p. 900); o capítulo, 30 a 40.' },
  { id: 'oma-eritro', nome: 'Eritromicina (alergia grave à penicilina)', unidade: 'mg', porKgDia: [50, 50], doses: [3, 3], maxDia: 2000, fonteMaximo: 'máx. do Apêndice: eritromicina 2 g/dia (p. 901)', via: 'VO de 8/8 h por 10 dias', pagina: 'p. 287' },
  { id: 'oma-claritro', nome: 'Claritromicina (alergia grave à penicilina)', unidade: 'mg', porKgDia: [15, 15], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CLARITRO, via: 'VO de 12/12 h por 10 dias', pagina: 'p. 287' },
]

export const DOSES_FARINGITE: DoseLivro[] = [
  { id: 'far-penv', nome: 'Penicilina V oral — crianças', unidade: 'mg', fixo: [250, 250], doses: [2, 3], via: 'VO de 8/8 h ou 12/12 h por 10 dias', pagina: 'p. 289 (Tabela 3)' },
  { id: 'far-amox-1x', nome: 'Amoxicilina — 1 vez ao dia', unidade: 'mg', porKgDose: [50, 50], doses: [1, 1], maxDose: 1000, via: 'VO 1 vez ao dia por 10 dias', pagina: 'p. 289 (Tabela 3)' },
  { id: 'far-amox-2x', nome: 'Amoxicilina — 12/12 h', unidade: 'mg', porKgDose: [25, 25], doses: [2, 2], maxDose: 500, via: 'VO de 12/12 h por 10 dias', pagina: 'p. 289 (Tabela 3)' },
  { id: 'far-cefalexina', nome: 'Cefalexina (alérgico, sem anafilaxia prévia)', unidade: 'mg', porKgDose: [20, 20], doses: [2, 2], maxDose: 500, via: 'VO de 12/12 h por 10 dias', pagina: 'p. 289 (Tabela 4)' },
  { id: 'far-cefadroxila', nome: 'Cefadroxila (alérgico, sem anafilaxia prévia)', unidade: 'mg', porKgDose: [30, 30], doses: [1, 1], maxDose: 1000, via: 'VO 1 vez ao dia por 10 dias', pagina: 'p. 289 (Tabela 4)' },
  { id: 'far-clinda', nome: 'Clindamicina (alérgico)', unidade: 'mg', porKgDose: [7, 7], doses: [3, 3], maxDose: 300, via: 'VO de 8/8 h por 10 dias', pagina: 'p. 289 (Tabela 4)' },
  { id: 'far-azitro', nome: 'Azitromicina (alérgico)', unidade: 'mg', porKgDose: [12, 12], doses: [1, 1], maxDose: 500, via: 'VO 1 vez ao dia por 5 dias', pagina: 'p. 290 (Tabela 4)', nota: 'Resistência conhecida do estreptococo, variável geograficamente (p. 290).' },
  { id: 'far-claritro', nome: 'Claritromicina (alérgico)', unidade: 'mg', porKgDose: [7.5, 7.5], doses: [2, 2], maxDose: 250, via: 'VO de 12/12 h por 10 dias', pagina: 'p. 290 (Tabela 4)', nota: 'Resistência conhecida do estreptococo, variável geograficamente (p. 290).' },
]

/** Penicilina G benzatina (Tabela 3, p. 289): < 27 kg 600.000 U; > 27 kg 1.200.000 U. Exatamente 27 kg: o livro não define. */
export function benzatinaFaringiteU(pesoKg: number): number | 'indefinido' | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  if (pesoKg < 27) return 600_000
  if (pesoKg > 27) return 1_200_000
  return 'indefinido'
}

export const DOSES_SINUSITE: DoseLivro[] = [
  { id: 'sin-amox', nome: 'Amoxicilina', unidade: 'mg', porKgDia: [50, 50], doses: [2, 2], via: 'VO de 12/12 h', pagina: 'p. 292', nota: '> 2 anos, sem creche e sem amoxicilina nos últimos 30 dias (p. 292).' },
  { id: 'sin-amoxclav', nome: 'Amoxicilina + clavulanato', unidade: 'mg', porKgDia: [90, 90], doses: [2, 2], maxDia: 4000, fonteMaximo: AP_AMOXCLAV14, via: 'VO de 12/12 h; clavulanato 6,4 mg/kg/dia', pagina: 'p. 292',
    nota: 'Creche, amoxicilina nos últimos 30 dias ou < 2 anos; atenção à dose de clavulanato (posologia limitada no Brasil, p. 292).' },
  { id: 'sin-ceftriaxona', nome: 'Ceftriaxona', unidade: 'mg', porKgDose: [50, 50], doses: [1, 1], maxDose: 2000, fonteMaximo: AP_CEFTRIAXONA, via: 'IM ou EV, dose única; reavaliar em 24 h', pagina: 'p. 292' },
  { id: 'sin-cefuroxima', nome: 'Cefuroxima (alergia sem hipersensibilidade tipo I)', unidade: 'mg', porKgDia: [30, 30], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CEFUROXIMA, via: 'VO de 12/12 h', pagina: 'p. 292' },
  { id: 'sin-claritro', nome: 'Claritromicina (hipersensibilidade tipo I)', unidade: 'mg', porKgDia: [15, 15], doses: [2, 2], maxDose: 500, fonteMaximo: AP_CLARITRO, via: 'VO de 12/12 h', pagina: 'p. 292' },
  { id: 'sin-azitro-d1', nome: 'Azitromicina — 1º dia (hipersensibilidade tipo I)', unidade: 'mg', porKgDia: [10, 10], doses: [1, 1], maxDia: 500, fonteMaximo: 'máx. do Apêndice: azitromicina 500 mg/dia (p. 898)', via: 'VO 1 vez ao dia', pagina: 'p. 292' },
  { id: 'sin-azitro-d2', nome: 'Azitromicina — 2º ao 5º dia', unidade: 'mg', porKgDia: [5, 5], doses: [1, 1], maxDia: 500, fonteMaximo: 'máx. do Apêndice: azitromicina 500 mg/dia (p. 898)', via: 'VO 1 vez ao dia', pagina: 'p. 292' },
]

export const DOSES_CRUPE: DoseLivro[] = [
  { id: 'crupe-dexa', nome: 'Dexametasona', unidade: 'mg', porKgDose: [0.15, 0.6], maxDose: 10, via: 'VO ou IM, dose única (melhora em 2 a 3 h; efeito por 24 a 48 h)', pagina: 'p. 294',
    nota: 'O Apêndice dá 0,6 mg/kg dose única com "máx. 12 g" (p. 900) — errata já registrada na ferramenta de doses por peso.' },
  { id: 'crupe-prednisolona', nome: 'Prednisolona', unidade: 'mg', porKgDose: [1, 1], via: 'VO, dose única', pagina: 'p. 294', nota: 'O livro associa a prednisolona a maior taxa de retorno ao hospital que a dexametasona (p. 294).' },
  { id: 'crupe-budesonida', nome: 'Budesonida inalatória', unidade: 'mg', fixo: [2, 2], doses: [2, 2], via: 'inalatória, 2 vezes/dia por 5 dias; se incapaz de tomar VO ou vomitando', pagina: 'p. 294', nota: 'Doses maiores não têm utilidade (p. 294).' },
  { id: 'crupe-epinefrina', nome: 'Epinefrina inalatória 1:1.000', unidade: 'mL', fixo: [3, 5], via: 'nebulização; 3 a 5 mL (3 a 5 ampolas) independentemente da idade e do peso; observar 3 a 4 h após', pagina: 'p. 295',
    nota: 'Indicações: crupe moderado ou grave e manipulação prévia da via aérea superior. Efeito de ~2 h; repetição conforme a necessidade (p. 295).' },
]

/** Cânula no crupe: 0,5 mm a menos de DI que o calculado para a idade (p. 295); supraglotite: 0,5 a 1,0 mm menor, lâmina curva (p. 296). */
export function canulaReduzida(diCalculadoMm: number, doenca: 'crupe' | 'supraglotite'): [number, number] | null {
  if (!Number.isFinite(diCalculadoMm) || diCalculadoMm <= 1) return null
  return doenca === 'crupe' ? [diCalculadoMm - 0.5, diCalculadoMm - 0.5] : [diCalculadoMm - 1, diCalculadoMm - 0.5]
}

/** Tabela 6 (p. 294): gravidade do crupe — referência, sem pontuação. */
export const GRAVIDADE_CRUPE: { sinal: string; leve: string; moderado: string; grave: string; falencia: string }[] = [
  { sinal: 'Tosse ladrante', leve: 'Ocasional', moderado: 'Frequente', grave: 'Frequente', falencia: 'Não intensa pela fadiga' },
  { sinal: 'Estridor', leve: 'Nenhum ou mínimo ao repouso', moderado: 'Audível ao repouso', grave: 'Inspiratório evidente e ocasionalmente expiratório', falencia: 'Audível ao repouso, pode ser fraco' },
  { sinal: 'Tiragens', leve: 'Nenhuma ou leve', moderado: 'Visível ao repouso', grave: 'Acentuadas', falencia: 'Podem não estar presentes' },
  { sinal: 'Agitação ou letargia', leve: 'Nenhuma', moderado: 'Nenhuma ou discreta', grave: 'Letargia significativa', falencia: 'Letargia ou rebaixamento de consciência' },
  { sinal: 'Cianose', leve: 'Nenhuma', moderado: 'Nenhuma', grave: 'Nenhuma', falencia: 'Presente' },
]

export const REFERENCIAS_VAS: Referencia[] = [
  { rotulo: 'OMA — diagnóstico (AAP)', texto: 'Ao menos um: abaulamento moderado ou grave da MT; otorreia recente não atribuível a otite externa; abaulamento leve + otalgia de início recente (< 48 h) ou hiperemia importante da MT.', pagina: 'p. 286' },
  { rotulo: 'OMA — indicação de antibiótico', texto: '< 6 meses; sinais de gravidade (otalgia moderada/grave, otalgia > 48 h ou febre ≥ 39 °C) em qualquer idade; imunodeficientes ou implante coclear. 6 m–2 a bilateral: antibiótico. 6 m–2 a unilateral e > 2 anos, sem gravidade: antibiótico ou observação por 48–72 h (Tabela 1).', pagina: 'p. 286–287' },
  { rotulo: 'Faringite — teste', texto: 'Confirmar o estreptococo (teste rápido; cultura se forte suspeita e teste negativo) antes de tratar; tosse, coriza, rouquidão, úlceras orais e conjuntivite sugerem vírus e dispensam teste. Isolamento até sem febre e ≥ 12 h de antibiótico.', pagina: 'p. 288–289' },
  { rotulo: 'Sinusite bacteriana (AAP)', texto: 'Sintomas persistentes > 10 dias sem melhora; piora da evolução após melhora inicial (em geral 6º–7º dia); ou sintomas graves: ≥ 3 dias seguidos de T ≥ 39 °C com secreção purulenta. Persistentes: antibiótico ou observar mais 3 dias; graves ou piora: antibiótico. Imagem não distingue viral de bacteriana.', pagina: 'p. 291–292' },
  { rotulo: 'Crupe — alta e internação', texto: 'Alta: sem estridor em repouso nem tiragens. Internação a considerar: corticoide há > 4 h e ainda desconforto, estridor em repouso e tiragens, ou suspeita de sepse ou desidratação; agitação ou letargia recorrentes → UTI.', pagina: 'p. 295' },
  { rotulo: 'Supraglotite e traqueíte bacteriana', texto: 'Sem indicação de corticoide ou epinefrina inalatória. Supraglotite: cefuroxima, ceftriaxona ou cefotaxima EV. Traqueíte: oxacilina + cefalosporina de 3ª geração (vancomicina se suspeita de resistente). O capítulo não traz dose.', pagina: 'p. 296–298' },
]
