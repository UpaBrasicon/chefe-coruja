import { LIVRO_PS_PED, fichaPediatrica } from './fonte.ts'

// Infusões contínuas pediátricas — Apêndice do PS Pediatria ICr-HCFMUSP
// (4ª ed., 2023), tabelas 1 e 2, com conferência nos capítulos. O livro NÃO dá
// preparo padrão de infusão (procurado nos caps. de RCP, choque, SRI, crise
// epiléptica e sedação: só há a concentração das ampolas, p. 87–88 e p. 253).
// Por isso a velocidade sai de uma CONCENTRAÇÃO INFORMADA PELO USUÁRIO:
//   mL/h = dose × peso × (60 se a dose é por minuto) ÷ concentração.
// Onde o valor do livro não é coerente e nenhum capítulo o confirma, a
// ferramenta não calcula e mostra o texto do livro (`semCalculo`).
// O apêndice não cobre o período neonatal (p. 894).

export const fichaInfusoesPediatricas = fichaPediatrica(
  'ped-infusoes',
  'Infusões contínuas pediátricas',
  'Apêndice, tabelas 1 e 2 (p. 894–910); choque séptico (p. 87–88); anafilaxia (p. 100–101); crise epiléptica (p. 127); intoxicações (p. 207); cardiopatias (p. 240–241); miocardite (p. 253); emergência hipertensiva (p. 276); hemorragia digestiva (p. 349); emergências oncológicas (p. 720); sedação (p. 849)',
  LIVRO_PS_PED,
)

export type GrupoInfusao = 'vasoativo' | 'sedacao' | 'bloqueio' | 'outros'

export const GRUPOS_INFUSAO: Record<GrupoInfusao, string> = {
  vasoativo: 'Vasoativos, inotrópicos e antiarrítmicos',
  sedacao: 'Sedação, analgesia e crise epiléptica',
  bloqueio: 'Bloqueio neuromuscular',
  outros: 'Outras infusões (broncodilatadores, antídotos, eletrólitos, hemorragia digestiva)',
}

export type Numerador = 'mcg' | 'mg' | 'mEq' | 'mL' | 'mU'

export type InfusaoPed = {
  id: string
  nome: string
  grupo: GrupoInfusao
  numerador: Numerador
  /** dose por kg (quase todas); false = dose absoluta por tempo */
  porKg: boolean
  tempo: 'min' | 'h'
  /** faixa usual do livro, na unidade da dose */
  faixa: [number, number]
  /** teto do livro na mesma unidade, quando acima da faixa */
  maximo?: number
  /** teto absoluto por tempo (não por kg), ex.: somatostatina 50 µg/h */
  tetoAbsoluto?: number
  /** o texto do livro como está, para conferência */
  textoLivro: string
  /** página do texto do livro, quando difere da página dos números usados */
  paginaTexto?: string
  pagina: string
  /** apresentação comercial citada pelo livro (não é preparo) */
  apresentacao?: string
  /** limites de concentração citados pelo livro, na unidade do numerador por mL */
  concentracaoMaxima?: { valor: number; texto: string }[]
  semCalculo?: string
  nota?: string
  errata?: string
}

const I = (i: InfusaoPed) => i

export const INFUSOES_PED: InfusaoPed[] = [
  // ── vasoativos / inotrópicos / antiarrítmicos ──
  I({ id: 'epinefrina', nome: 'Epinefrina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.1, 1],
    textoLivro: 'IV contínua: 0,1 a 1 mcg/kg/min', pagina: 'p. 895', apresentacao: 'Adrenalina® 1 mg/mL (p. 87)',
    nota: 'Choque séptico (p. 87): 0,1 a 1,0 mcg/kg/min. Cardiopatias (p. 240): efeito beta 0,01–0,3; alfa > 0,3 mcg/kg/min. Anafilaxia refratária (p. 100): 0,1 mcg/kg/min, titulável.' }),
  I({ id: 'norepinefrina', nome: 'Norepinefrina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.05, 2], maximo: 2,
    textoLivro: 'IV contínuo: 0,05 mcg/kg/min, (máx. 1 a 2 mcg/kg/min)', pagina: 'p. 896; p. 101', apresentacao: 'Norepine® 1 mg/mL (p. 88)',
    nota: 'O apêndice dá o início (0,05) e o teto (1 a 2); a anafilaxia (p. 101) dá 0,05 a 2 mcg/kg/min e o choque séptico (p. 88), 0,1 a 2,0. Não é recomendada a diluição em SF (p. 88). Incompatível com bicarbonato (p. 896).' }),
  I({ id: 'dopamina', nome: 'Dopamina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [1, 20], maximo: 50,
    textoLivro: 'IV contínua: 1 a 20 mcg/kg/min, máx. 50 mcg/kg/minuto', pagina: 'p. 895', apresentacao: '5 mg/mL (p. 87; ampola 10 mL = 50 mg, p. 253)',
    concentracaoMaxima: [{ valor: 3200, texto: 'Concentração máxima de 3.200 mcg/mL (p. 895).' }],
    nota: 'Choque séptico (p. 87): 2 a 20 mcg/kg/min. Não infundir com bicarbonato (p. 895).' }),
  I({ id: 'dobutamina', nome: 'Dobutamina', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [2, 20], maximo: 40,
    textoLivro: 'ICC, choque cardiogênico: IV contínua: 2 a 20 mcg/kg/min (máx. 40 mcg/kg/min)', pagina: 'p. 895', apresentacao: 'Dobutrex® 12,5 mg/mL (p. 87)',
    nota: 'Não infundir no mesmo cateter que heparina, hidrocortisona, cefazolina, penicilina e bicarbonato. Fotossensível (p. 895).' }),
  I({ id: 'milrinona', nome: 'Milrinona', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.25, 0.75],
    textoLivro: 'IV contínuo: 0,25 a 0,75 mcg/kg/min', pagina: 'p. 896', apresentacao: '1 mg/mL (ampola 20 mL = 20 mg, p. 253)',
    nota: 'Cardiopatias (p. 240) e miocardite (p. 253): 0,25 a 0,75 mcg/kg/min. Ataque em "Doses por peso".' }),
  I({ id: 'nitroprussiato', nome: 'Nitroprussiato de sódio', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.3, 3], maximo: 10,
    textoLivro: 'IV contínuo: 0,3 a 3 mcg/kg/min (máx. 10 mcg/kg/min)', pagina: 'p. 896',
    nota: 'Diluir em SG 5%; fotossensível; risco de tiocianeto, cianeto e metemoglobinemia (p. 896). Cardiopatias (p. 240): 0,3 a 4,0; emergência hipertensiva (p. 276): inicial 0–3, máx. 10 mcg/kg/min.' }),
  I({ id: 'amiodarona', nome: 'Amiodarona', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [5, 10],
    textoLivro: 'IV contínua: 5 a 10 mcg/kg/min', pagina: 'p. 894',
    concentracaoMaxima: [{ valor: 2000, texto: 'Diluir em SG 5%, concentração máxima de 2 mg/mL em cateter periférico (p. 894).' }] }),
  I({ id: 'lidocaina', nome: 'Lidocaína', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [20, 50],
    textoLivro: 'IV: 1 mg/kg/dose (máx. 100 mg/dose), seguida de infusão contínua de 20 a 50 mcg/kg/minuto', pagina: 'p. 896' }),
  I({ id: 'esmolol-has', nome: 'Esmolol — emergência hipertensiva', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [25, 100], maximo: 500,
    textoLivro: 'Manutenção 25-100 mcg/kg/min (titular até 500 mcg/kg/min)', pagina: 'p. 895',
    nota: 'Preferir cateter venoso central; meia-vida de 10 min (p. 895). Bolus em "Doses por peso".' }),
  I({ id: 'esmolol-tsv', nome: 'Esmolol — taquicardia supraventricular', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [25, 100], maximo: 1000,
    textoLivro: 'Manutenção 25-100 mcg/kg/min (titular até 1.000 mcg/kg/min)', pagina: 'p. 895' }),
  I({ id: 'alprostadil-inicial', nome: 'Prostaglandina E1 (alprostadil) — dose inicial', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.05, 0.1],
    textoLivro: 'Dose inicial IV: 0,05 a 0,1 mcg/kg/min', pagina: 'p. 896',
    nota: 'Cardiopatias (p. 241): 0,01 a 0,1 mcg/kg/min. O apêndice exclui o período neonatal (p. 894); a dose aqui não é de recém-nascido.' }),
  I({ id: 'alprostadil-manutencao', nome: 'Prostaglandina E1 (alprostadil) — manutenção', grupo: 'vasoativo', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.01, 0.04],
    textoLivro: 'Manutenção: 0,01 a 0,04 mcg/kg/min', pagina: 'p. 896',
    nota: 'O apêndice exclui o período neonatal (p. 894); a dose aqui não é de recém-nascido.' }),
  I({ id: 'vasopressina-choque', nome: 'Vasopressina — choque', grupo: 'vasoativo', numerador: 'mU', porKg: true, tempo: 'h', faixa: [0.01, 0.5], maximo: 2,
    textoLivro: 'Choque hipotensivo e arresponsivo a fluidos e catecolaminas: 0,01 a 0,5 mU/kg/hora (máx. 2 mU/kg/hora)', pagina: 'p. 909',
    semCalculo: 'Conferido no PDF (p. 909), mas nenhum capítulo do livro dá a infusão de vasopressina no choque para confirmar a unidade, e a faixa fica abaixo até da dose inicial do diabetes insipidus na mesma linha (0,5 mU/kg/h). Sem cálculo.' }),
  I({ id: 'vasopressina-di', nome: 'Vasopressina — diabetes insipidus central', grupo: 'outros', numerador: 'mU', porKg: true, tempo: 'h', faixa: [0.5, 0.5], maximo: 10,
    textoLivro: 'Diabetes insipidus central: 0,5 mU/kg/hora, titulando a cada 10 minutos até obter diurese < 2 mL/kg/hora (máx. 10 mU/kg/hora)', pagina: 'p. 909',
    nota: 'Dados limitados na pediatria; recomendável cateter central; vesicante (p. 909).' }),
  I({ id: 'vasopressina-gi', nome: 'Vasopressina — sangramento GI', grupo: 'outros', numerador: 'mU', porKg: true, tempo: 'min', faixa: [2, 5], maximo: 10,
    textoLivro: 'Sangramento GI: 2 a 5 mU/kg/min, titulando até conter o sangramento (máx. 10 mU/kg/min)', pagina: 'p. 909' }),
  I({ id: 'glucagon', nome: 'Glucagon — hipotensão persistente na anafilaxia', grupo: 'vasoativo', numerador: 'mcg', porKg: false, tempo: 'min', faixa: [5, 15],
    textoLivro: 'seguida de infusão de 5 a 15 mcg/minuto, titulada de acordo com a resposta clínica', pagina: 'p. 101',
    nota: 'Dose por minuto, não por kg. Ataque de 20 a 30 mcg/kg, máx. 1 mg (p. 101), em "Doses por peso".' }),

  // ── sedação / analgesia / crise ──
  I({ id: 'midazolam', nome: 'Midazolam', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [1, 18],
    textoLivro: 'IV contínuo: 0,05 a 2 mcg/kg/minuto', paginaTexto: 'apêndice, p. 896', pagina: 'p. 127; p. 720',
    nota: 'Crise epiléptica (p. 127): iniciar com 1 mcg/kg/min e aumentar 1 a cada 5 min conforme necessidade.',
    errata: 'O apêndice escreve "0,05 a 2 mcg/kg/minuto" (p. 896, conferido no PDF) — unidade trocada. A tabela de crise epiléptica (p. 127) e a de emergências oncológicas (p. 720) dão 1 a 18 mcg/kg/min; é essa a faixa usada no cálculo.' }),
  I({ id: 'fentanil', nome: 'Fentanil', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'h', faixa: [1, 3],
    textoLivro: 'IV contínua: 1 a 3 mcg/kg/hora', pagina: 'p. 895',
    nota: 'Infusão rápida pode causar rigidez torácica (p. 895).' }),
  I({ id: 'cetamina', nome: 'Cetamina', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [5, 20],
    textoLivro: 'IV contínua: 5 a 20 mcg/kg/min', pagina: 'p. 894', apresentacao: 'Ketamin S® 50 mg/mL (p. 88)',
    nota: 'Choque séptico (p. 88): manutenção 5 a 10 mcg/kg/min, associar midazolam. Contraindicada em < 3 meses (p. 894).' }),
  I({ id: 'dexmedetomidina', nome: 'Dexmedetomidina', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'h', faixa: [0.2, 1], maximo: 1.4,
    textoLivro: 'Sedação contínua: ... manutenção de 0,2 a 1 µg/kg/h (máx. 1,4 µg/kg/h)', pagina: 'p. 895',
    nota: 'Cap. de sedação (p. 849): manutenção de 0,5 a 1 mcg/kg/h; a criança pode precisar de doses maiores.' }),
  I({ id: 'propofol-crise', nome: 'Propofol — estado de mal epiléptico', grupo: 'sedacao', numerador: 'mg', porKg: true, tempo: 'h', faixa: [5, 5],
    textoLivro: 'Propofol — dose de manutenção: 5 mg/kg/hora (VM necessária; UTI com monitorização contínua)', pagina: 'p. 127' }),
  I({ id: 'propofol-apendice', nome: 'Propofol — contínuo (apêndice)', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [200, 300],
    textoLivro: 'IV contínuo: 200 a 300 mcg/kg/min', pagina: 'p. 896',
    semCalculo: 'Conferido no PDF (p. 896), mas não confirmado no livro: o cap. de crise epiléptica dá 5 mg/kg/h (≈ 83 mcg/kg/min, p. 127) e o cap. de TCE diz que a infusão contínua de propofol não está recomendada em crianças (p. 178). Sem cálculo para esta linha.' }),
  I({ id: 'tiopental', nome: 'Tiopental', grupo: 'sedacao', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [10, 100],
    textoLivro: 'Manutenção: 10 a 100 mcg/kg/minuto', pagina: 'p. 897',
    nota: 'Crise epiléptica (p. 127): 1 a 3 mg/kg/hora (≈ 17 a 50 mcg/kg/min), com VM e UTI.' }),

  // ── bloqueio neuromuscular ──
  I({ id: 'rocuronio', nome: 'Rocurônio', grupo: 'bloqueio', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [7, 12],
    textoLivro: 'IV contínuo: 7 a 12 mcg/kg/min', pagina: 'p. 896', nota: 'Associar sedação (p. 896).' }),
  I({ id: 'vecuronio', nome: 'Vecurônio', grupo: 'bloqueio', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.8, 2.5],
    textoLivro: 'IV contínuo: 0,8 a 2,5 mcg/kg/min', pagina: 'p. 897', nota: 'Efeito cumulativo; associar sedação (p. 897).' }),

  // ── outros ──
  I({ id: 'salbutamol', nome: 'Salbutamol IV', grupo: 'outros', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.1, 6],
    textoLivro: 'IV: iniciar com 0,1 a 0,2 µg/kg/min e aumentar 0,1 µg/kg/min a cada 20 minutos, até 3 a 6 µg/kg/min', pagina: 'p. 908',
    nota: 'Início 0,1 a 0,2; alvo até 3 a 6 µg/kg/min. Aumento e desmame lentos; queda de potássio (p. 908).' }),
  I({ id: 'terbutalina', nome: 'Terbutalina', grupo: 'outros', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [0.2, 0.4], maximo: 5,
    textoLivro: 'Contínuo: 0,2 a 0,4 mcg/kg/min, podendo aumentar, a cada 30 min, titulando de 0,1 a 0,2 mcg/kg/min até a dose de máx. de 5 mcg/kg/min', pagina: 'p. 909' }),
  I({ id: 'octreotida', nome: 'Octreotida', grupo: 'outros', numerador: 'mcg', porKg: true, tempo: 'h', faixa: [0.5, 2],
    textoLivro: 'IV contínuo: 0,5-2 mcg/kg/h', pagina: 'p. 896',
    nota: 'Tabela 2 do apêndice (p. 905): 1 a 2 mcg/kg/h; hemorragia digestiva (p. 349): 1 mcg/kg/h, até 4 mcg/kg/h. Desmame de 50% a cada 12 h após 24 h de controle (p. 905).' }),
  I({ id: 'somatostatina', nome: 'Somatostatina', grupo: 'outros', numerador: 'mcg', porKg: true, tempo: 'h', faixa: [3.5, 10], tetoAbsoluto: 50,
    textoLivro: 'Manutenção: 3,5 a 10 µg/kg/hora (máx. 50 µg/h) por 3 a 5 dias', pagina: 'p. 908',
    nota: 'Hemorragia digestiva (p. 349): 1 a 20 mcg/kg/h, ou 250 a 500 mcg/h para adolescentes e adultos — diverge do teto de 50 µg/h do apêndice.' }),
  I({ id: 'terlipressina', nome: 'Terlipressina — contínuo', grupo: 'outros', numerador: 'mcg', porKg: true, tempo: 'min', faixa: [4, 20],
    textoLivro: 'Contínuo: 4 a 20 mcg/kg/min', pagina: 'p. 909',
    semCalculo: 'Conferido no PDF (p. 909), mas nenhum capítulo do livro dá a infusão de terlipressina para confirmar a unidade (o cap. de hemorragia digestiva só diz que é pouco usada em crianças, p. 349). Sem cálculo.' }),
  I({ id: 'nacl3', nome: 'Cloreto de sódio 3%', grupo: 'outros', numerador: 'mL', porKg: true, tempo: 'h', faixa: [0.5, 1.5],
    textoLivro: 'IV contínua: 0,5-1,5 mL/kg/hora (ajuste PIC < 20 mmHg)', pagina: 'p. 895',
    nota: 'Limite de Na sérico de 160 mEq/L (p. 895). Emergências oncológicas (p. 720): manutenção de 0,1 a 1 mL/kg/hora.' }),
  I({ id: 'kcl', nome: 'Cloreto de potássio', grupo: 'outros', numerador: 'mEq', porKg: true, tempo: 'h', faixa: [0.3, 0.5], maximo: 1,
    textoLivro: 'IV: 0,5 a 1 mEq/kg/dose máx. 40 mEq, infundir a 0,3 a 0,5 mEq/kg/hora (velocidade máx. 1 mEq/kg/hora)', pagina: 'p. 895',
    concentracaoMaxima: [
      { valor: 0.08, texto: 'Acima do máximo em via periférica: o livro dá 40 a 80 mEq/L (p. 895).' },
      { valor: 0.15, texto: 'Acima do máximo em via central: o livro dá 80 a 150 mEq/L (p. 895).' },
    ],
    nota: 'Dose total da reposição: 0,5 a 1 mEq/kg, máximo 40 mEq (p. 895). Concentração em mEq/mL (40 mEq/L = 0,04 mEq/mL).' }),
  I({ id: 'pralidoxima', nome: 'Pralidoxima — após o ataque', grupo: 'outros', numerador: 'mg', porKg: true, tempo: 'h', faixa: [10, 20],
    textoLivro: 'seguida de infusão contínua na dose de 10 a 20 mg/kg/h', pagina: 'p. 207',
    nota: 'Adolescentes e adultos: alternativamente 8 mg/kg/h (p. 208). Usar com atropina; evitar em carbamatos (p. 207).' }),
  I({ id: 'deferoxamina', nome: 'Deferoxamina — intoxicação por ferro', grupo: 'outros', numerador: 'mg', porKg: true, tempo: 'h', faixa: [15, 15],
    textoLivro: 'IV: 15 mg/kg/hora', pagina: 'p. 900', nota: 'Torna a urina alaranjada ou rosada (p. 900).' }),
]

export const unidadeDoseInfusao = (i: InfusaoPed) => `${i.numerador === 'mcg' ? 'µg' : i.numerador}${i.porKg ? '/kg' : ''}/${i.tempo}`
export const unidadeConcentracao = (i: InfusaoPed) => `${i.numerador === 'mcg' ? 'µg' : i.numerador}/mL`

/** NaCl 3% em mL/kg/h não precisa de concentração: a dose já é volume. */
export const precisaConcentracao = (i: InfusaoPed) => i.numerador !== 'mL'

function base(i: InfusaoPed, pesoKg: number, conc: number): number | null {
  if (i.semCalculo) return null
  if (i.porKg && !(Number.isFinite(pesoKg) && pesoKg > 0)) return null
  const c = precisaConcentracao(i) ? conc : 1
  if (!(Number.isFinite(c) && c > 0)) return null
  // mL/h por unidade de dose
  return ((i.porKg ? pesoKg : 1) * (i.tempo === 'min' ? 60 : 1)) / c
}

/** mL/h para uma dose, com a concentração informada (unidade do numerador por mL). */
export function velocidadePed(i: InfusaoPed, dose: number, pesoKg: number, concentracao: number): number | null {
  if (!Number.isFinite(dose) || dose < 0) return null
  const k = base(i, pesoKg, concentracao)
  return k === null ? null : dose * k
}

/** Caminho inverso: dose correspondente a uma velocidade na bomba. */
export function dosePed(i: InfusaoPed, mlH: number, pesoKg: number, concentracao: number): number | null {
  if (!Number.isFinite(mlH) || mlH < 0) return null
  const k = base(i, pesoKg, concentracao)
  return k === null ? null : mlH / k
}

/** Velocidades para os extremos da faixa do livro. */
export function faixaEmMlH(i: InfusaoPed, pesoKg: number, concentracao: number): [number, number] | null {
  const a = velocidadePed(i, i.faixa[0], pesoKg, concentracao)
  const b = velocidadePed(i, i.faixa[1], pesoKg, concentracao)
  return a === null || b === null ? null : [a, b]
}

export type Alerta = { tipo: 'acimaDoMaximo' | 'foraDaFaixa' | 'tetoAbsoluto' | 'concentracao'; texto: string }

/** Avisos para uma dose e concentração: fora da faixa, acima do teto, concentração acima do citado pelo livro. */
export function alertasInfusao(i: InfusaoPed, dose: number | null, pesoKg: number, concentracao: number): Alerta[] {
  const a: Alerta[] = []
  if (dose !== null && Number.isFinite(dose)) {
    if (i.maximo !== undefined && dose > i.maximo) a.push({ tipo: 'acimaDoMaximo', texto: `Acima do máximo do livro (${i.maximo} ${unidadeDoseInfusao(i)}).` })
    else if (dose < i.faixa[0] || dose > (i.maximo ?? i.faixa[1])) a.push({ tipo: 'foraDaFaixa', texto: 'Fora da faixa do livro.' })
    if (i.tetoAbsoluto !== undefined) {
      const porTempo = dose * (i.porKg ? pesoKg : 1)
      if (Number.isFinite(porTempo) && porTempo > i.tetoAbsoluto)
        a.push({ tipo: 'tetoAbsoluto', texto: `Acima do teto absoluto do livro (${i.tetoAbsoluto} ${i.numerador === 'mcg' ? 'µg' : i.numerador}/${i.tempo}).` })
    }
  }
  for (const c of i.concentracaoMaxima ?? []) if (Number.isFinite(concentracao) && concentracao > c.valor) a.push({ tipo: 'concentracao', texto: c.texto })
  return a
}
