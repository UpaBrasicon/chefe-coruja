import type { Fonte } from '../ficha.ts'

// Diretriz da ASH 2020 de tratamento do tromboembolismo venoso. Lote 3 da
// revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 25. O texto
// integral foi lido no PMC (PMC7556153), pelo Chrome do RT, com as 28
// recomendações e o grau GRADE de cada uma. As recomendações de TEP já estão na
// AHA/ACC 2026 (lote 2); aqui ficam as que valem para a TVP. A CHEST 2021 não
// foi lida. As doses e contas do manual não mudam.

export const ASH_TEV_2020: Fonte = {
  citacao: 'Ortel TL, Neumann I, Ageno W, et al. American Society of Hematology 2020 guidelines for management of venous thromboembolism: treatment of deep vein thrombosis and pulmonary embolism. Blood Adv. 2020;4(19):4693–4738 (PMID 33007077). PMC7556153: texto integral lido, com as 28 recomendações graduadas.',
  url: 'https://doi.org/10.1182/bloodadvances.2020001830',
}

const SEM_ITEM = 'sem item do manual na ferramenta'

/** ASH 2020 × manual, na TVP; um tema por linha. */
export const DIRETRIZ_TVP: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Tratamento em casa', diretriz: 'TVP sem complicação: tratar em casa em vez de internar', grau: 'condicional; certeza baixa', fonte: 'ASH 2020', livro: 'tratamento ambulatorial se estável, sem alto risco de sangramento, sem doença renal crônica avançada e com os demais critérios (p. 351)' },
  { tema: 'DOAC ou varfarina', diretriz: 'Preferir anticoagulante oral direto à varfarina (condicional, certeza moderada); nenhum DOAC é preferido a outro (condicional, muito baixa)', grau: 'condicional', fonte: 'ASH 2020', livro: 'varfarina 5 mg com INR 2–3; os anticoagulantes orais diretos são contraindicados na insuficiência renal (p. 353)' },
  { tema: 'Trombólise na TVP', diretriz: 'TVP proximal: anticoagulação isolada na maioria, sem trombolítico (condicional, baixa). TVP extensa em que a trombólise é considerada: por cateter, e não sistêmica (condicional, muito baixa)', grau: 'condicional', fonte: 'ASH 2020', livro: 'trombolítico com papel limitado na TVP; pode ser usado na flegmasia alba ou cerúlea dolens (p. 355)' },
  { tema: 'Filtro de veia cava', diretriz: 'TVP proximal com doença cardiopulmonar importante: anticoagulação isolada, sem filtro (condicional, baixa). Com contraindicação à anticoagulação, filtro removível, retirado assim que possível anticoagular', grau: 'condicional; certeza baixa', fonte: 'ASH 2020', livro: 'filtro só com contraindicação à heparina ou evento trombótico apesar do tratamento (p. 355)' },
  { tema: 'Duração do tratamento primário', diretriz: 'Provocada por fator transitório, por fator crônico ou não provocada: 3–6 meses de tratamento primário, em vez de 6–12 meses', grau: 'condicional; certeza moderada', fonte: 'ASH 2020', livro: '3 meses no fator transitório; mínimo de 3 meses sem fator precipitante; mais de 3 meses na neoplasia ativa (p. 353–354)' },
  { tema: 'Depois do tratamento primário', diretriz: 'Não provocada ou por fator crônico: anticoagulação indefinida (condicional, moderada). Recorrência não provocada: indefinida (forte, moderada). Fator transitório com evento prévio também transitório: parar (condicional, moderada)', grau: 'condicional e forte', fonte: 'ASH 2020', livro: 'as diretrizes recentes preferem 3 meses no alto risco de sangramento e períodos maiores no alto risco de recorrência (p. 353)' },
  { tema: 'Anticoagulante ou aspirina na prevenção secundária', diretriz: 'Na prevenção secundária, anticoagulante em vez de aspirina (condicional, moderada); DOAC em dose padrão ou reduzida (condicional, moderada)', grau: 'condicional; certeza moderada', fonte: 'ASH 2020', livro: 'aspirina depois de parar a anticoagulação na TEV sem fator provocador claro (p. 355)' },
  { tema: 'Como decidir a duração', diretriz: 'Na TVP não provocada, não usar de rotina escore prognóstico, D-dímero ou ultrassom de trombo residual para decidir a duração', grau: 'condicional; certeza muito baixa', fonte: 'ASH 2020', livro: SEM_ITEM },
  { tema: 'INR na varfarina', diretriz: 'INR de 2,0 a 3,0, e não faixa menor (1,5–1,9)', grau: 'forte; certeza moderada', fonte: 'ASH 2020', livro: 'INR entre 2,0 e 3,0 (p. 353)' },
  { tema: 'Recorrência em uso de varfarina', diretriz: 'Nova TVP com varfarina em faixa terapêutica: trocar para HBPM, e não para DOAC', grau: 'condicional; certeza muito baixa', fonte: 'ASH 2020', livro: SEM_ITEM },
  { tema: 'Aspirina prévia', diretriz: 'Doença cardiovascular estável que já usava aspirina: suspender a aspirina enquanto durar a anticoagulação', grau: 'condicional; certeza muito baixa', fonte: 'ASH 2020', livro: SEM_ITEM },
]

export const DIFERENCAS_TVP: string[] = [
  'Prevenção secundária: a ASH prefere anticoagulante (DOAC em dose padrão ou reduzida) à aspirina; o manual cita aspirina depois de parar a anticoagulação na TEV não provocada.',
  'Duração: a ASH dá 3–6 meses de tratamento primário e depois anticoagulação indefinida na não provocada ou com fator crônico; o manual fala em mínimo de 3 meses e em prolongar conforme os riscos.',
  'DOAC: a ASH o prefere à varfarina; o manual traz os dois e diz que o DOAC é contraindicado na insuficiência renal.',
  'Filtro de veia cava e trombólise: a ASH e o manual concordam em reservá-los; a ASH acrescenta o filtro removível e a trombólise por cateter.',
]
