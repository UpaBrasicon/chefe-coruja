import { completo, escolha, marcadas, numero, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Tromboembolismo pulmonar (cap. 32, p. 429–449) e pneumonia adquirida na
// comunidade (cap. 33, p. 450–467) do Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022). Wells, Genebra, PESI, PSI e CURB-65 já existem no
// produto e não são duplicados; aqui ficam PERC, HESTIA, SMART-COP, ATS/IDSA e
// os antibióticos da Tabela 10. O livro não traz sPESI.

const TEP = 'cap. 32 Tromboembolismo pulmonar'
const PAC = 'cap. 33 Pneumonia adquirida na comunidade'

const simNao = (id: string, rotulo: string): Item => ({ tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] })
const sim = (e: Escore, r: Parameters<Escore['calcular']>[0], id: string) => escolha(e, r, id)?.valor === 1

/** Errata conferida no PDF: a Tabela 3 (p. 433) inverte as faixas do Wells simplificado. */
export const ERRATA_WELLS_SIMPLIFICADO =
  'p. 433 (conferido na imagem da página) — a Tabela 3 traz "TEP provável: 0-1" e "TEP improvável: ≥ 2". No Wells simplificado é o contrário: 0-1 improvável e ≥ 2 provável. O próprio texto logo abaixo aplica o PERC quando a probabilidade é "improvável (baixo risco)".'

// ---------------------------------------------------------------------------
// PERC (Tabela 4, p. 434)

export const perc: Escore = {
  ficha: fichaAdulto('adulto-perc', 'PERC — critérios para descartar TEP (adulto)', `${TEP}, p. 433–434 (Tabela 4)`),
  descricao: 'Pulmonary Embolism Rule-Out Criteria: oito perguntas; todas negativas descartam a suspeita quando a probabilidade pré-teste é improvável.',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 14, max: 120, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 20, max: 250, passo: 1 },
    { tipo: 'numero', id: 'sat', rotulo: 'SaO2 em ar ambiente', unidade: '%', min: 50, max: 100, passo: 1 },
    simNao('hemoptise', 'Hemoptise'),
    simNao('edema', 'Edema unilateral de membro inferior'),
    simNao('cirurgia', 'Cirurgia ou trauma há menos de 4 semanas, com necessidade de anestesia geral'),
    simNao('previo', 'Antecedente de TEP ou TVP'),
    simNao('estrogenio', 'Uso de estrogênio'),
  ],
  calcular(r) {
    if (!completo(perc, r)) return null
    const positivos: string[] = []
    if (numero(perc, r, 'idade')! >= 50) positivos.push('idade ≥ 50 anos')
    if (numero(perc, r, 'fc')! >= 100) positivos.push('FC ≥ 100')
    if (numero(perc, r, 'sat')! < 95) positivos.push('SaO2 < 95%')
    const nomes: Record<string, string> = { hemoptise: 'hemoptise', edema: 'edema unilateral', cirurgia: 'cirurgia/trauma < 4 semanas', previo: 'TEP/TVP prévios', estrogenio: 'estrogênio' }
    for (const id of Object.keys(nomes)) if (sim(perc, r, id)) positivos.push(nomes[id])
    const negativo = positivos.length === 0
    return {
      rotulo: 'PERC',
      valor: negativo ? 'negativo' : 'positivo',
      nota: negativo ? 'Todas as respostas negativas: pelo livro, a suspeita pode ser considerada descartada' : `${positivos.length} critério(s) presente(s): o PERC não descarta`,
      estado: negativo ? 0 : 1,
      derivados: negativo ? [] : [['Critérios presentes', positivos.join('; ')]],
      alerta: 'O PERC só se aplica quando a probabilidade pré-teste é improvável (p. 433). Atenção à errata do Wells simplificado da Tabela 3 (p. 433), que inverte as faixas.',
      cuidados: [
        ERRATA_WELLS_SIMPLIFICADO,
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// HESTIA (Tabela 11, p. 447–448)

const ITENS_HESTIA: Item[] = [
  simNao('instavel', 'O paciente está instável hemodinamicamente?'),
  simNao('trombolise', 'É necessário realizar trombólise ou trombectomia?'),
  simNao('sangramento', 'Sangramento ativo ou alto risco de sangramento?'),
  simNao('o2', 'Foi necessário suporte de O2 por mais de 24 h para obter SatO2 > 90%?'),
  simNao('anticoagulado', 'Diagnóstico de TEP em vigência de anticoagulação?'),
  simNao('dor', 'Dor grave que necessitou de medicações IV por mais de 24 h?'),
  simNao('razao', 'Razão médica ou social que indica internação?'),
  simNao('clcr', 'Clearance de creatinina < 30 mL/min?'),
  simNao('hepatica', 'Insuficiência hepática?'),
  simNao('gravidez', 'A paciente está grávida?'),
  simNao('hit', 'Histórico documentado de plaquetopenia induzida por heparina?'),
]

export const hestia: Escore = {
  ficha: fichaAdulto('adulto-hestia', 'Critérios HESTIA — tratamento ambulatorial do TEP (adulto)', `${TEP}, p. 447–448 (Tabela 11)`),
  descricao: 'Onze critérios de exclusão para tratamento ambulatorial do TEP confirmado; o livro combina com PESI classe I ou II.',
  itens: ITENS_HESTIA,
  calcular(r) {
    if (!completo(hestia, r)) return null
    const positivos = ITENS_HESTIA.filter((i) => sim(hestia, r, i.id)).map((i) => i.rotulo.replace(/\?$/, ''))
    const candidato = positivos.length === 0
    return {
      rotulo: 'HESTIA',
      valor: String(positivos.length),
      unidade: 'de 11 critérios',
      nota: candidato ? 'Todas as respostas negativas: pelo livro, candidato a tratamento ambulatorial se também PESI I ou II' : 'Algum critério de exclusão presente',
      estado: candidato ? 0 : 1,
      derivados: candidato ? [] : [['Critérios presentes', positivos.join('; ')]],
      cuidados: [
        'O livro usa o HESTIA com o PESI (classes I e II, p. 447). O PESI está em ferramenta própria.',
        'PESI I ou II com troponina ou BNP positivo, se dosados, reclassifica como risco intermediário baixo (p. 447).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// SMART-COP (Tabela 6, p. 458; cap. 90, p. 1223)

export const smartCop: Escore = {
  ficha: fichaAdulto('adulto-smart-cop', 'SMART-COP — necessidade de suporte intensivo na PAC (adulto)', `${PAC}, p. 457–458 (Tabela 6); cap. 90 Influenza, p. 1223`),
  descricao: 'Oito variáveis da Tabela 6 do manual do HC; 3 pontos ou mais indicam benefício de leito de terapia intensiva no protocolo do HC.',
  itens: [
    { tipo: 'escolha', id: 's', rotulo: 'PAS < 90 mmHg', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 2 pontos', valor: 2 }] },
    { tipo: 'escolha', id: 'm', rotulo: 'Infiltrados multilobares', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }] },
    { tipo: 'escolha', id: 'a', rotulo: 'Albumina < 3,5 g/dL', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }] },
    { tipo: 'escolha', id: 'r', rotulo: 'FR > 30 ipm', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }] },
    { tipo: 'escolha', id: 't', rotulo: 'FC > 124 bpm', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }] },
    { tipo: 'escolha', id: 'c', rotulo: 'Confusão mental', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }] },
    { tipo: 'escolha', id: 'o', rotulo: 'PO2 < 60 mmHg (cap. 33) ou SatO2 < 90% (cap. 90)', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 2 pontos', valor: 2 }] },
    { tipo: 'escolha', id: 'p', rotulo: 'pH < 7,35', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 2 pontos', valor: 2 }] },
  ],
  calcular(r) {
    if (!completo(smartCop, r)) return null
    const total = somar(smartCop, r)
    return {
      rotulo: 'SMART-COP',
      valor: String(total),
      unidade: 'de 11',
      nota: total >= 3 ? '≥ 3 pontos: o livro associa a benefício de internação em terapia intensiva' : 'Abaixo de 3 pontos',
      estado: total >= 3 ? 2 : total >= 1 ? 1 : 0,
      derivados: [['Corte do cap. 33 (p. 458)', '≥ 3 pontos'], ['Corte do cap. 90 (p. 1223)', '> 3 pontos, na série de influenza H1N1 do HC']],
      cuidados: [
        'Correlação > 90% com necessidade de suporte ventilatório (invasivo ou não) e de vasopressores (p. 458).',
        'O livro usa cortes fixos de FR e de oxigenação; o escore original ajusta esses cortes pela idade (o livro não traz o ajuste).',
        'No cap. 90 (p. 1223) a albumina aparece como "< 3,4 mg/dL" (unidade errada); aqui vale a Tabela 6: < 3,5 g/dL.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// ATS/IDSA (Tabela 7, p. 459–460)

export const atsIdsaPac: Escore = {
  ficha: fichaAdulto('adulto-ats-idsa-pac', 'Critérios ATS/IDSA de PAC grave (adulto)', `${PAC}, p. 458–460 (Tabela 7)`),
  descricao: 'Dois critérios maiores e nove menores de necessidade de terapia intensiva na PAC. Marque os presentes.',
  itens: [
    { tipo: 'marca', id: 'choque', rotulo: 'Choque séptico com necessidade de vasopressores', pontos: 1, grupo: 'Critérios maiores' },
    { tipo: 'marca', id: 'vmi', rotulo: 'Necessidade de ventilação mecânica invasiva', pontos: 1, grupo: 'Critérios maiores' },
    { tipo: 'marca', id: 'fr', rotulo: 'Frequência respiratória ≥ 30 ipm', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'pf', rotulo: 'Relação PaO2/FiO2 ≤ 250', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'multilobar', rotulo: 'Infiltrados multilobares', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'confusao', rotulo: 'Confusão/desorientação', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'ureia', rotulo: 'Ureia ≥ 43 mg/dL', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'leuco', rotulo: 'Leucopenia (< 4.000 células/mm³)', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'plaq', rotulo: 'Trombocitopenia (< 100.000/mm³)', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'hipotermia', rotulo: 'Hipotermia (temperatura central < 36 °C)', pontos: 1, grupo: 'Critérios menores' },
    { tipo: 'marca', id: 'hipotensao', rotulo: 'Hipotensão que requer ressuscitação volêmica agressiva', pontos: 1, grupo: 'Critérios menores' },
  ],
  calcular(r) {
    const maiores = somar(atsIdsaPac, r, ['choque', 'vmi'])
    const menores = somar(atsIdsaPac, r, ['fr', 'pf', 'multilobar', 'confusao', 'ureia', 'leuco', 'plaq', 'hipotermia', 'hipotensao'])
    const livro = maiores >= 1 || menores >= 2
    const diretriz = maiores >= 1 || menores >= 3
    return {
      rotulo: 'ATS/IDSA',
      valor: `${maiores} maior(es), ${menores} menor(es)`,
      nota: livro ? 'Preenche o critério do livro (1 maior ou 2 menores)' : 'Não preenche o critério do livro',
      estado: diretriz ? 2 : livro ? 1 : 0,
      derivados: [
        ['Regra do livro (p. 460)', livro ? 'preenche: 1 maior ou 2 menores' : 'não preenche'],
        ['Regra da diretriz ATS/IDSA 2019 (1 maior ou 3 menores)', diretriz ? 'preenche' : 'não preenche'],
      ],
      alerta: !diretriz && livro ? 'Errata: o livro pede 2 critérios menores; a diretriz ATS/IDSA 2019, que o próprio capítulo cita (Metlay et al.), pede 3.' : undefined,
      cuidados: [
        ...(marcadas(atsIdsaPac, r).length ? [] : ['Nenhum critério marcado.']),
        'No protocolo institucional do HC o escore adotado é o SMART-COP (p. 458).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Antibióticos por grupo (Tabela 10, p. 463–464) e texto (p. 460–462)

export const fichaPacAntibioticoAdulto = fichaAdulto('adulto-pac-antibiotico', 'PAC — antibiótico por grupo de risco (adulto)', `${PAC}, p. 452–465 (Tabelas 5, 8 e 10)`)

export type GrupoPac = 'baixo' | 'baixoComorbidade' | 'intermediario' | 'alto' | 'pseudomonas'

export const PAC_ANTIBIOTICOS: { grupo: GrupoPac; nome: string; opcoes: string[] }[] = [
  { grupo: 'baixo', nome: 'Baixo risco, hígidos e sem uso de ATB nos últimos 3 meses', opcoes: ['Amoxicilina 500 mg 8/8 h', 'Azitromicina 500 mg 1 x/d*'] },
  { grupo: 'baixoComorbidade', nome: 'Baixo risco com comorbidades ou uso de ATB nos últimos 3 meses', opcoes: ['Amoxicilina 1 g 8/8 h + azitromicina 500 mg 1 x/d', 'Levofloxacino 500 mg 1 x/d'] },
  { grupo: 'intermediario', nome: 'Risco intermediário', opcoes: ['Amoxicilina 1 g 8/8 h + azitromicina 500 mg 1 x/d', 'Levofloxacino 500 mg 1 x/d'] },
  { grupo: 'alto', nome: 'Alto risco', opcoes: ['Ceftriaxona 1 g 12/12 h + azitromicina 500 mg 1 x/d', 'Levofloxacino 500 mg 1 x/d'] },
  { grupo: 'pseudomonas', nome: 'Risco de Pseudomonas', opcoes: [
    'Ceftazidima 2 g 8/8 h + levofloxacino 750 mg 1 x/d ou azitromicina 500 mg 1 x/d',
    'Cefepime 2 g 8/8 h + levofloxacino 750 mg 1 x/d ou azitromicina 500 mg 1 x/d',
    'Piperacilina/tazobactam 4,5 g 6/6 h + levofloxacino 750 mg 1 x/d ou azitromicina 500 mg 1 x/d',
    'Meropenem 1 g 8/8 h + levofloxacino 750 mg 1 x/d ou azitromicina 500 mg 1 x/d',
  ] },
]

export const NOTA_CLARITROMICINA = '* Azitromicina pode ser substituída por claritromicina 500 mg VO/EV 12/12 h (p. 464).'

/** Tabela 5 (p. 457): PORT I-II baixo, III intermediário, IV-V alto. */
export function grupoPorPort(classe: 1 | 2 | 3 | 4 | 5): 'baixo' | 'intermediario' | 'alto' {
  return classe <= 2 ? 'baixo' : classe === 3 ? 'intermediario' : 'alto'
}

export const DESTINO_POR_PORT = [
  { classes: 'PORT I e II', texto: 'Tratamento ambulatorial' },
  { classes: 'PORT III', texto: 'Internação 24-48 h' },
  { classes: 'PORT IV e V', texto: 'Internação em enfermaria ou UTI' },
]

export const DURACAO_PAC = [
  { grupo: 'Baixo risco', texto: 'tratamento ambulatorial por 5 dias; retorno se não melhorar em 3 dias', pagina: 'p. 460' },
  { grupo: 'Intermediário e alto risco', texto: 'início em no máximo 4 horas (na 1ª hora se séptico); 7 a 10 dias no total', pagina: 'p. 460' },
]

export const FATORES_PSEUDOMONAS = [
  'Uso de antibióticos endovenosos no último mês',
  'Internação por mais de 48 horas na última semana',
  'Doença estrutural pulmonar (p. ex., bronquiectasia)',
  'Neutropenia grave',
  'Corticoterapia sistêmica prolongada (prednisona > 10 mg/dia) — só no texto da p. 461',
]

/** Metilprednisolona 0,5 mg/kg 12/12 h EV por 5 dias, considerada no choque séptico com altas doses de vasopressor (p. 461). */
export const METILPREDNISOLONA_PAC = { mgKg: 0.5, intervaloH: 12, dias: 5, pagina: 'p. 461' }

export function metilprednisolonaPac(pesoKg: number): { mgDose: number; mgDia: number } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const mgDose = METILPREDNISOLONA_PAC.mgKg * pesoKg
  return { mgDose, mgDia: mgDose * (24 / METILPREDNISOLONA_PAC.intervaloH) }
}

export const CRITERIOS_ALTA_PAC = [
  'Temperatura < 37,5 °C',
  'FR < 24 ipm',
  'FC < 100 bpm',
  'Pressão sistólica ≥ 90 mmHg',
  'SatO2 > 90% em ar ambiente',
  'Retorno ao status mental basal',
]

export const PROCALCITONINA_PAC = [
  { texto: '< 0,1 ng/mL: considerar fortemente não introduzir e/ou descontinuar antibióticos', pagina: 'p. 452' },
  { texto: 'Suspensão do antibiótico se cair abaixo de 0,5 µg/L ou 80% do valor máximo', pagina: 'p. 464' },
]
