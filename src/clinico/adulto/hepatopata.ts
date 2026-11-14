import type { Ficha, Fonte } from '../ficha.ts'
import { numero, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'
import { nacVO } from './intoxicacoes.ts'
import { numero as numeroBr } from '../../lib/formato.ts'

// Emergências no hepatopata — caps. 55 a 60 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 755–822. A ferramenta faz as contas
// que o livro permite (GASA, albumina por litro e por peso, degraus de
// terlipressina, estádio ICA-AKI, Maddrey, King's College, NAC por peso) e
// mostra cada número com a página. A decisão é do médico (ADR 0007).

// Revisão PubMed de 09/10/2026 (decisão do RT): os critérios de SHR do
// consenso ADQI-ICA 2024 entram ao lado do livro, com a divergência explícita
// (a EASL mantém as 48 h de albumina). Nenhuma dose nova.
export const ADQI_ICA_2024: Fonte = {
  citacao: 'Nadim MK, Kellum JA, Forni L, et al. Acute kidney injury in patients with cirrhosis: Acute Disease Quality Initiative (ADQI) and International Club of Ascites (ICA) joint multidisciplinary consensus meeting. J Hepatol. 2024;81(1):163–183 (PMID 38527522).',
  url: 'https://doi.org/10.1016/j.jhep.2024.03.031',
}
export const CONTESTACAO_SHR_2025: Fonte = {
  citacao: 'Schleicher EM, et al. J Hepatol. 2025;83:682–691 (PMID 40118117) e Angeli P, et al. J Hepatol. 2025;83:800–802 (PMID 40250764): resposta à albumina entre 24 e 48 h em parte dos pacientes; seguir o algoritmo EASL (48 h) até haver mais dados.',
  url: 'https://doi.org/10.1016/j.jhep.2025.03.008',
}

export const DIVERGENCIA_SHR_2024 = 'ADQI-ICA 2024 (posterior ao livro): a LRA na cirrose segue o KDIGO, incluindo a diurese ≤ 0,5 mL/kg/h por ≥ 6 h; HRS-AKI é a falta de melhora da creatinina e/ou da diurese em 24 h após ressuscitação volêmica adequada, quando indicada; o consenso é contra exigir 48 h de albumina para o diagnóstico (risco de sobrecarga e de atrasar a terlipressina); os nomes passam a HRS-AKI, HRS-AKD e HRS-CKD. Divergência: estudo de 2025 mostrou resposta à albumina só entre 24 e 48 h em 18–28% dos pacientes, e a EASL recomenda manter as 48 h até haver mais dados. A ferramenta mostra o esquema do livro; a escolha é do médico.'

// Lote 4 da revisão do HCFMUSP, O2 (decisão do RT de 14/11/2026), cap. 57 e 58: a
// guidance da AASLD de 2021 (ascite, PBE e SHR; sem graduação) foi lida no texto
// integral no site da revista, e o consenso ADQI-ICA de 2024 (graduado), no PMC.
// As doses e contas do manual não mudam.
export const AASLD_ASCITE_2021: Fonte = {
  citacao: 'Biggins SW, Angeli P, Garcia-Tsao G, et al. Diagnosis, Evaluation, and Management of Ascites, Spontaneous Bacterial Peritonitis and Hepatorenal Syndrome: 2021 Practice Guidance by the American Association for the Study of Liver Diseases. Hepatology. 2021;74(2):1014–1048 (PMID 33942342). Texto integral lido; guidance sem graduação.',
  url: 'https://doi.org/10.1002/hep.31884',
}

const SEM_ITEM_PBE = 'sem item do manual na ferramenta'

/** AASLD 2021 e ADQI-ICA 2024 × manual, na PBE e na SHR do adulto; um tema por linha. */
export const DIRETRIZ_PBE_SHR: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Paracentese diagnóstica', diretriz: 'Todo cirrótico com ascite internado de urgência faz paracentese diagnóstica, mesmo sem sinais de infecção; com sinais de infecção também, junto com a investigação. Cultura à beira do leito em frascos de hemocultura (aeróbio e anaeróbio), antes do antibiótico', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: SEM_ITEM_PBE },
  { tema: 'Diagnóstico de PBE', diretriz: 'PMN > 250/mm³ no líquido ascítico (ou pleural, no empiema espontâneo); começar antibiótico EV empírico antes da cultura. PMN > 250 com foco abdominal (diverticulite, colecistite): tratar o foco, não como PBE', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: 'PMN ≥ 250/mm³ (p. 782)' },
  { tema: 'Antibiótico na PBE', diretriz: 'PBE comunitária: cefalosporina de 3ª geração EV (por exemplo, cefotaxima 2 g 12/12 h). Infecção hospitalar ou associada a serviço de saúde, antibiótico de largo espectro recente, sepse ou choque: largo espectro desde o início', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: 'ceftriaxona 2 g EV/dia por 5 dias; cefotaxima 2 g EV 6/6 h (texto) ou 8/8 h (tabela) (p. 784–785)' },
  { tema: 'Resposta ao antibiótico', diretriz: 'Repetir a paracentese em 2 dias; queda dos PMN menor que 25% é falha: ampliar o antibiótico e investigar peritonite secundária', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: 'queda de pelo menos 25% dos PMN indica sucesso (p. 785)' },
  { tema: 'Albumina na PBE', diretriz: 'Albumina EV com o antibiótico: 1,5 g/kg no D1 e 1 g/kg no D3; maior benefício com LRA ou icterícia (AASLD). Albumina 20–25% para prevenir LRA na PBE e após paracentese grande (ADQI-ICA, forte, B); não usar de rotina em outras infecções nem só para manter albumina > 3 g/dL (forte, A)', grau: 'guidance; forte, A e B', fonte: 'AASLD 2021; ADQI-ICA 2024', livro: '1,5 g/kg nas primeiras 6 h e 1 g/kg no D3 (p. 785, 795)' },
  { tema: 'Betabloqueador na PBE', diretriz: 'Suspender temporariamente o betabloqueador não seletivo se houver hipotensão (PAM < 65 mmHg) ou LRA', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: SEM_ITEM_PBE },
  { tema: 'Profilaxia da PBE', diretriz: 'Depois de um episódio de PBE: norfloxacino diário por tempo prolongado (ciprofloxacino se não houver). HDA no cirrótico: ceftriaxona 1 g/24 h por até 7 dias. Proteína do líquido < 1,5 g/dL: profilaxia primária só em selecionados, com disfunção renal ou hepática', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: 'norfloxacina 400 mg/dia na PBE prévia; após HDA, ceftriaxona 1–2 g/dia por 7 dias (p. 786)' },
  { tema: 'Paracentese de grande volume', diretriz: 'Acima de 5 L, repor albumina 6–8 g por litro retirado; o risco de disfunção circulatória pós-paracentese sobe acima de 8 L em uma sessão', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: 'repor albumina quando retirar mais de 5 L, 8 g/L (p. 766)' },
  { tema: 'Nefrotóxicos no cirrótico com ascite', diretriz: 'Evitar AINE, IECA e BRA; evitar aminoglicosídeo sempre que possível', grau: 'guidance, sem graduação', fonte: 'AASLD 2021', livro: SEM_ITEM_PBE },
  { tema: 'Definição de LRA na cirrose', diretriz: 'Critérios do KDIGO, incluindo diurese ≤ 0,5 mL/kg/h por ≥ 6 h (forte, A); creatinina basal = menor valor estável dos últimos 3 meses (forte, D); sem basal, a menor entre a da admissão e a estimada por TFG de 75 (fraca, B)', grau: 'forte, A e D; fraca, B', fonte: 'ADQI-ICA 2024', livro: 'aumento ≥ 0,3 mg/dL em 48 h ou > 50% da basal (Tabela 2 e critérios, p. 791–793)' },
  { tema: 'Critérios de SHR-LRA', diretriz: 'Cirrose com ascite; LRA pelo KDIGO; sem melhora da creatinina e/ou da diurese em 24 h após volume adequado (quando indicado); sem outra causa forte. Não exigir 48 h de albumina para o diagnóstico (forte, D). Os termos SHR tipo 1 e 2 dão lugar a SHR-LRA, SHR-DRA e SHR-DRC', grau: 'forte, D; sem grau', fonte: 'ADQI-ICA 2024', livro: 'sem melhora com albumina 1 g/kg (máx. 100 g/dia) por 48 h; sem choque, sem nefrotóxico, sem doença parenquimatosa (p. 791–793)' },
  { tema: 'Fluido na LRA', diretriz: 'Cristaloide, de preferência balanceado, como primeira escolha na LRA que precisa de volume (forte, B). Na sobrecarga, suspender fluidos e usar diurético ou diálise', grau: 'forte, B; boa prática', fonte: 'ADQI-ICA 2024', livro: 'suspeita de SHR: suspender diuréticos e expandir com albumina 1 g/kg/dia por 2 dias (p. 791)' },
  { tema: 'Vasoconstritor na SHR-LRA', diretriz: 'Terlipressina como primeira escolha, com albumina 20–25%, logo que se diagnostica a SHR-LRA (forte, A). Subir a terlipressina a cada 24 h se a creatinina não cair 25% (forte, D); subir a norepinefrina a cada 4 h se a PAM não subir 10 mmHg (forte, B). Sem terlipressina nem norepinefrina: midodrina 5–15 mg VO 8/8 h com octreotídeo 100–200 µg 8/8 h, com eficácia baixa (AASLD)', grau: 'forte, A, B e D; guidance', fonte: 'ADQI-ICA 2024; AASLD 2021', livro: 'terlipressina em degraus a cada 2 dias sem resposta, até 12 mg/dia em bolus (p. 795–797)' },
  { tema: 'Albumina com o vasoconstritor', diretriz: 'Albumina 20–25%, 20–40 g/dia, ajustada todo dia pelo volume; suspender se houver sobrecarga ou edema pulmonar', grau: 'boa prática', fonte: 'ADQI-ICA 2024', livro: 'albumina 1 g/kg no D1 e 20–40 g/dia nos demais (p. 794)' },
  { tema: 'Quando parar o vasoconstritor', diretriz: 'Creatinina volta a até 0,3 mg/dL do basal; efeito adverso grave; sem melhora em 48 h na dose máxima tolerada; indicação de diálise; ou 14 dias (forte, B). A AASLD fala em parar se a creatinina não cair após 4 dias na dose máxima', grau: 'forte, B; guidance', fonte: 'ADQI-ICA 2024; AASLD 2021', livro: 'resposta = queda de 25% da creatinina; até 14 dias (p. 797)' },
  { tema: 'Transplante', diretriz: 'Avaliar transplante depois de qualquer LRA na cirrose descompensada (boa prática); o transplante é o tratamento definitivo da SHR-LRA, respondendo ou não ao vasoconstritor (forte, A)', grau: 'boa prática; forte, A', fonte: 'ADQI-ICA 2024', livro: SEM_ITEM_PBE },
]

export const DIFERENCAS_PBE_SHR: string[] = [
  'Diagnóstico da SHR: o ADQI-ICA 2024 usa 24 h sem melhora após volume e não exige 48 h de albumina; o manual exige 48 h de albumina 1 g/kg.',
  'Terlipressina: o ADQI-ICA sobe a dose a cada 24 h sem queda de 25% da creatinina; o manual sobe a cada 2 dias.',
  'Quando parar: o ADQI-ICA para sem melhora em 48 h na dose máxima, e a AASLD em 4 dias; o manual avalia até 14 dias.',
  'Volume na LRA: o ADQI-ICA prefere cristaloide balanceado quando é preciso volume; o manual expande com albumina.',
  'Cefotaxima: a AASLD dá 2 g de 12/12 h; o manual, 2 g de 6/6 h ou 8/8 h.',
  'Paracentese grande: a AASLD repõe 6–8 g de albumina por litro; o manual, 8 g/L.',
]

const fichaAsciteLivro = fichaAdulto(
  'adulto-ascite-pbe-hepatorrenal',
  'Ascite, PBE e síndrome hepatorrenal — adulto',
  'cap. 55 Ascite, p. 755–767; cap. 57 Peritonite bacteriana espontânea, p. 779–786; cap. 58 Síndrome hepatorrenal, p. 789–797',
)
export const fichaAsciteShr: Ficha = {
  ...fichaAsciteLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaAsciteLivro.fontes, ADQI_ICA_2024, CONTESTACAO_SHR_2025, AASLD_ASCITE_2021],
  revisadoEm: '14/11/2026 (AASLD 2021 e ADQI-ICA 2024 lidas no texto integral, ao lado do manual; lote 4 da revisão do HCFMUSP; aguarda aprovação do RT); 09/10/2026 (ADQI-ICA 2024 e a divergência EASL ao lado do livro)',
}

// Lote 4 da revisão do HCFMUSP, O2 (decisão do RT de 14/11/2026), cap. 59: a diretriz
// da ACG de 2026 (GRADE) foi lida no texto integral no site da revista. As doses e
// contas do manual não mudam.
export const ACG_EH_2026: Fonte = {
  citacao: 'Bajaj JS, Jakab SS, Jesudian AB, et al. ACG Clinical Guideline: Hepatic Encephalopathy. Am J Gastroenterol. 2026;121(3):588–618 (PMID 41773757). Texto integral lido; GRADE.',
  url: 'https://doi.org/10.14309/ajg.0000000000003899',
}

const SEM_ITEM_EH = 'sem item do manual na ferramenta'

/** ACG 2026 × manual, na encefalopatia hepática do adulto; um tema por linha. */
export const DIRETRIZ_EH: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Amônia sérica', diretriz: 'Não usar a amônia sérica sozinha para diagnosticar a encefalopatia mínima ou encoberta, nem dosar amônia de rotina para guiar o tratamento. Amônia normal em paciente em estupor ou coma põe o diagnóstico em dúvida', grau: 'condicional, muito baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Imagem do crânio', diretriz: 'Cirrótico confuso sem déficit focal novo: não fazer imagem do crânio de rotina', grau: 'condicional, muito baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Gravidade e destino', diretriz: 'West Haven e Glasgow na chegada e durante a internação; encefalopatia de grau alto vai para semi-intensiva ou UTI, com proteção de via aérea quando preciso, para evitar aspiração', grau: 'conceito-chave, sem grau', fonte: 'ACG 2026', livro: 'West Haven, graus I a IV (cap. 59, Tabela 3, p. 803–804)' },
  { tema: 'Fator precipitante', diretriz: 'Procurar sangramento, infecção, sedativos e distúrbios tóxicos e metabólicos. Culturas de sangue, ascite e urina em todos. Os mais comuns: constipação, HDA, infecção, hiponatremia e desidratação ou excesso de diurético', grau: 'conceito-chave, sem grau', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Lactulose na crise', diretriz: 'Lactulose na encefalopatia manifesta (forte, moderada). Grau 2: 10–20 g (15–30 mL) VO a cada 2 h até 2 evacuações pastosas; depois 2 a 4 vezes ao dia, para manter 2–3 evacuações por dia. Grau 3–4 sem deglutição segura: sonda nasogástrica com a mesma dose', grau: 'forte, moderada; dose do texto', fonte: 'ACG 2026', livro: '20 a 40 mL de 8/8 a 4/4 h, com aumento progressivo; 2 a 4 evacuações pastosas ao dia (cap. 59, p. 805–806)' },
  { tema: 'Enema de lactulose', diretriz: 'Com o tônus do esfíncter anal preservado: 300 mL de solução de lactulose em 700 mL de água ou soro fisiológico, reter 30–60 min, repetir a cada 4–6 h até melhorar. Enema acidificante é melhor que enema de água', grau: 'texto, sem grau', fonte: 'ACG 2026', livro: '200 a 300 mL de lactulose em 700 a 800 mL de solução retal; reter pelo menos 30 min (cap. 59, Tabela 4, p. 806)' },
  { tema: 'Polietilenoglicol', diretriz: 'Polietilenoglicol em volume alto (por exemplo, 4 L) como alternativa à lactulose; pensar nele quando a lactulose dá distensão, desconforto ou íleo', grau: 'condicional, baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Rifaximina na crise', diretriz: 'Somar rifaximina à lactulose na encefalopatia manifesta aguda. Na UTI, com antibiótico de largo espectro, a rifaximina acrescenta pouco', grau: 'condicional, baixa', fonte: 'ACG 2026', livro: '550 mg VO 12/12 h; o manual diz que não está disponível no Brasil (cap. 59, p. 805–806)' },
  { tema: 'Sem resposta em 48–72 h', diretriz: 'A melhora é esperada em 24–48 h. Sem melhora após 48–72 h de tratamento adequado, com evacuações na meta e o precipitante tratado: procurar outra causa de alteração mental, precipitante não tratado ou shunt', grau: 'conceito-chave, sem grau', fonte: 'ACG 2026', livro: 'neomicina 1 a 1,5 g de 6/6 h sem resposta à lactulose em 48 h; metronidazol 250 a 500 mg de 8/8 h (cap. 59, p. 805)' },
  { tema: 'Medicamentos', diretriz: 'Revisar a prescrição e reduzir o que piora a consciência ou a encefalopatia: opioides, benzodiazepínicos, gabapentina e pregabalina, hipnóticos (zolpidem) e inibidor de bomba de prótons', grau: 'conceito-chave, sem grau', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Prevenção da recorrência', diretriz: 'Depois do primeiro episódio, lactulose titulada para 2–3 evacuações pastosas por dia (forte, alta). Recorrência apesar da lactulose: somar rifaximina 550 mg 2 vezes ao dia (forte, alta). Escala de Bristol junto com o número de evacuações para titular em casa (condicional, muito baixa)', grau: 'forte, alta; condicional, muito baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Proteína e dieta', diretriz: 'Meta de proteína de 1,2–1,5 g/kg/dia no ambulatório (forte, moderada); não restringir proteína (condicional, muito baixa); aminoácidos de cadeia ramificada se a comida não atinge a meta (forte, moderada); lanche noturno (condicional, muito baixa)', grau: 'forte, moderada; condicional, muito baixa', fonte: 'ACG 2026', livro: '35–40 kcal/kg; proteína 1,25–1,5 g/kg (texto) ou 1,2–1,5 g/kg/dia (Tabela 4) (cap. 59, p. 805–806)' },
  { tema: 'Zinco', diretriz: 'Sintomas persistentes apesar de lactulose e rifaximina: zinco se o zinco sérico estiver baixo', grau: 'condicional, muito baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Paciente intubado', diretriz: 'Ajustar a lactulose pelas evacuações; suspender laxativos se a sonda retal passar de 300 mL de fezes por dia; vigiar hipernatremia e prevenir aspiração', grau: 'texto, sem grau', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
  { tema: 'Encefalopatia refratária', diretriz: 'Embolização de shunt na encefalopatia refratária com tratamento otimizado e boa função hepática (condicional, muito baixa). Vários episódios com MELD < 15: avaliar transplante intervivos (condicional, baixa)', grau: 'condicional, muito baixa e baixa', fonte: 'ACG 2026', livro: SEM_ITEM_EH },
]

export const DIFERENCAS_EH: string[] = [
  'Lactulose na crise: a ACG dá 15–30 mL a cada 2 h até 2 evacuações pastosas e depois 2 a 4 vezes ao dia; o manual, 20–40 mL de 8/8 a 4/4 h.',
  'Meta de evacuações: a ACG fala em 2–3 pastosas por dia; o manual, em 2 a 4.',
  'Sem resposta: a ACG procura outra causa depois de 48–72 h; o manual passa à neomicina depois de 48 h. A ACG 2026 não cita neomicina nem metronidazol.',
  'Rifaximina: a ACG a soma na crise (condicional) e na recorrência (forte); o manual diz que não está disponível no Brasil.',
  'Polietilenoglicol 4 L: alternativa à lactulose na ACG; o manual não traz.',
  'Enema: a ACG usa 300 mL em 700 mL, retidos por 30–60 min e repetidos a cada 4–6 h; o manual, 200–300 mL em 700–800 mL, retidos por pelo menos 30 min.',
]

const fichaInsuficienciaHepaticaLivro = fichaAdulto(
  'adulto-encefalopatia-hepatites-graves',
  'Encefalopatia hepática e hepatites graves — adulto',
  'cap. 59 Encefalopatia hepática, p. 799–806; cap. 60 Hepatites graves, p. 808–819',
)
export const fichaInsuficienciaHepatica: Ficha = {
  ...fichaInsuficienciaHepaticaLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaInsuficienciaHepaticaLivro.fontes, ACG_EH_2026],
  revisadoEm: '14/11/2026 (ACG 2026 da encefalopatia hepática lida no texto integral, ao lado do manual; lote 4 da revisão do HCFMUSP; aguarda aprovação do RT)',
}

export type Faixa = [number, number]
export type Referencia = { texto: string; pagina: string; errata?: string }

const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Albumina humana 20% (p. 794) ────────────────────────────────────────────

export const ALBUMINA_FRASCO = { ml: 50, g: 10, concentracao: '20%', infusaoMin: [10, 30] as Faixa, pagina: 'cap. 58, p. 794',
  texto: 'Cada frasco de 50 mL de albumina a 20% tem 10 g; infundir em 10 a 30 minutos (pode ser prolongado se houver receio de congestão pulmonar)' }

/** Frascos de 10 g (p. 794) para uma dose em g; arredondado para cima e o valor exato ao lado. */
export function frascosAlbumina(g: number): { exato: number; inteiros: number } | null {
  if (!valido(g)) return null
  const exato = g / ALBUMINA_FRASCO.g
  return { exato, inteiros: Math.ceil(exato - 1e-9) }
}

// ── GASA (cap. 55, p. 758) ──────────────────────────────────────────────────

export const ERRATA_GASA = 'A p. 758 escreve "> 1,1 = hipertensão portal" e "< 1,1 = ausência"; 1,1 exato fica sem classe. Em outras páginas aparecem "≥ 1,1" (p. 782) e "≤ 1,1" (p. 765). Com 1,1 a ferramenta mostra as três leituras.'

export type ResultadoGasa = { gasa: number; leitura: 'aumentado' | 'diminuido' | 'limite'; texto: string }

export function gasa(albuminaSerica: number, albuminaAscitica: number): ResultadoGasa | null {
  if (!Number.isFinite(albuminaSerica) || !Number.isFinite(albuminaAscitica) || albuminaSerica <= 0 || albuminaAscitica < 0) return null
  const g = Math.round((albuminaSerica - albuminaAscitica) * 100) / 100
  if (g > 1.1) return { gasa: g, leitura: 'aumentado', texto: 'GASA > 1,1 g/dL: hipertensão portal (p. 758)' }
  if (g < 1.1) return { gasa: g, leitura: 'diminuido', texto: 'GASA < 1,1 g/dL: ausência de hipertensão portal (p. 758)' }
  return { gasa: g, leitura: 'limite', texto: 'GASA = 1,1 g/dL: sem classe na p. 758 (ver errata)' }
}

export const LIQUIDO_ASCITICO: Referencia[] = [
  { texto: 'Amilase LA/sérica > 0,4 sugere perfuração intestinal com peritonite secundária; > 6, ascite pancreática', pagina: 'cap. 55, p. 763' },
  { texto: 'ADA > 40 U/L sugere tuberculose (sensibilidade próxima a 100%, especificidade 92%; no cirrótico, sensibilidade ≈ 60%)', pagina: 'cap. 55, p. 763' },
  { texto: 'Ascite quilosa: triglicérides > 200 mg/dL; hemorrágica: > 50.000 hemácias/mm³; pancreática: amilase tipicamente > 1.000 U/L', pagina: 'cap. 55, p. 764–765' },
  { texto: 'Peritonite de diálise peritoneal: leucócitos > 100/mm³ com > 50% de neutrófilos, ou Gram/cultura positivos', pagina: 'cap. 55, p. 760' },
  { texto: 'Tratamento da ascite cirrótica: sódio < 88 mEq/dia; dose máxima de 160 mg de furosemida e 400 mg de espironolactona', pagina: 'cap. 55, Tabela 7, p. 767' },
]

// ── Albumina pós-paracentese (cap. 55, p. 766) ──────────────────────────────

export const ALBUMINA_PARACENTESE = { limiteLitros: 5, gPorLitro: 8, pagina: 'cap. 55, p. 766',
  texto: 'Paracentese de alívio no cirrótico: repor albumina quando se retirar mais que 5 litros (repor 8 g/L)' }

export const NOTA_PARACENTESE = 'O livro não diz se os 8 g/L valem para todo o volume ou só para o que passa de 5 L. A conta mostra as duas leituras.'

export function albuminaParacentese(litros: number) {
  if (!valido(litros)) return null
  const acima = litros > ALBUMINA_PARACENTESE.limiteLitros
  if (!acima) return { acimaDoLimite: false as const }
  const total = ALBUMINA_PARACENTESE.gPorLitro * litros
  const excedente = ALBUMINA_PARACENTESE.gPorLitro * (litros - ALBUMINA_PARACENTESE.limiteLitros)
  return { acimaDoLimite: true as const, gVolumeTotal: total, gSoExcedente: excedente, frascosTotal: frascosAlbumina(total)!, frascosExcedente: frascosAlbumina(excedente)! }
}

// ── PBE (cap. 57) ───────────────────────────────────────────────────────────

export const ALBUMINA_PBE = { d1GKg: 1.5, d1Horas: 6, d3GKg: 1, pagina: 'cap. 57, p. 785; cap. 58, p. 795',
  texto: '1,5 g/kg nas primeiras 6 horas do diagnóstico e 1 g/kg no terceiro dia (PBE sem LRA). PBE que já chega com LRA: 1 g/kg/dia por 2 dias (p. 795; Figura 1, p. 796)' }

export function albuminaPbe(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const d1 = ALBUMINA_PBE.d1GKg * pesoKg
  const d3 = ALBUMINA_PBE.d3GKg * pesoKg
  return { d1G: d1, d3G: d3, frascosD1: frascosAlbumina(d1)!, frascosD3: frascosAlbumina(d3)! }
}

export const ERRATA_DISPENSA_ALBUMINA_PBE = 'A p. 785 escreve que a albumina "não é necessária em pacientes com creatinina < 1 mg/dL, bilirrubinas < 4 mg/dL ou ureia < 60 mg/dL". Com "ou", quase todo paciente cairia na dispensa; o texto não deixa claro se os critérios se somam. A ferramenta mostra cada um separado e não conclui.'

export function criteriosDispensaAlbuminaPbe(cr?: number, bt?: number, ureia?: number): string[] {
  const r: string[] = []
  if (cr !== undefined && valido(cr) && cr < 1) r.push('creatinina < 1 mg/dL')
  if (bt !== undefined && valido(bt) && bt < 4) r.push('bilirrubina total < 4 mg/dL')
  if (ureia !== undefined && valido(ureia) && ureia < 60) r.push('ureia < 60 mg/dL')
  return r
}

export type CulturaLa = 'positiva' | 'negativa' | 'pendente'

/** Categorias do líquido ascítico (p. 782–783): PMN ≥ 250/mm³ × cultura de agente único. */
export function classificarLiquidoAscitico(pmn: number, cultura: CulturaLa): Referencia | null {
  if (!Number.isFinite(pmn) || pmn < 0) return null
  const pagina = 'cap. 57, p. 782–783'
  if (pmn >= 250 && cultura === 'positiva') return { texto: 'PBE clássica: PMN ≥ 250/mm³ e cultura positiva para agente único', pagina }
  if (pmn >= 250 && cultura === 'negativa') return { texto: 'Ascite neutrocítica com cultura negativa: PMN ≥ 250/mm³; o livro diz que deve ser tratada como PBE clássica', pagina }
  if (pmn >= 250) return { texto: 'PMN ≥ 250/mm³ com cultura pendente: faixa de PBE clássica ou ascite neutrocítica (o livro trata as duas igualmente)', pagina }
  if (cultura === 'positiva') return { texto: 'Bacteriascite não neutrocítica monobacteriana: PMN < 250/mm³ e cultura positiva; o livro recomenda nova paracentese (até 40% evoluem com PBE; repetir em 48 h, p. 785)', pagina }
  return { texto: 'PMN < 250/mm³: fora dos critérios de PBE do livro', pagina }
}

/** Peritonite secundária (p. 781): PMN > 250 e pelo menos 2 de glicose < 50, proteína > 1, DHL > LSN. */
export function criteriosPeritoniteSecundaria(pmn: number, glicose?: number, proteina?: number, dhlAcimaLsn = false) {
  const achados: string[] = []
  if (glicose !== undefined && Number.isFinite(glicose) && glicose > 0 && glicose < 50) achados.push('glicose < 50 mg/dL')
  if (proteina !== undefined && Number.isFinite(proteina) && proteina > 1) achados.push('proteínas totais > 1 g/dL')
  if (dhlAcimaLsn) achados.push('DHL > limite superior sérico')
  return { achados, criterioDoLivro: Number.isFinite(pmn) && pmn > 250 && achados.length >= 2 }
}

export const NOTA_PMN_250 = 'O livro usa "≥ 250" na PBE (p. 782) e "mais de 250" na peritonite secundária (p. 781).'

export const ERRATA_RESPOSTA_PBE = 'A p. 785 escreve que "uma queda de pelo menos 25% dos PMN é indicativa de sucesso do tratamento e diagnósticos diferenciais devem ser aventados". A segunda parte cabe quando a queda é menor que 25%; a ferramenta mostra só a queda calculada.'

export function quedaPmn(pmnInicial: number, pmn48h: number): { quedaPct: number; atingiu25: boolean } | null {
  if (!valido(pmnInicial) || !Number.isFinite(pmn48h) || pmn48h < 0) return null
  const quedaPct = ((pmnInicial - pmn48h) / pmnInicial) * 100
  return { quedaPct, atingiu25: quedaPct >= 25 }
}

export const ATB_PBE: (Referencia & { droga: string })[] = [
  { droga: 'Ceftriaxona', texto: '2 g EV 1 vez ao dia por 5 dias (texto); 1–2 g EV 1 × ao dia, 5 dias (Tabela 4)', pagina: 'cap. 57, p. 784–785' },
  { droga: 'Cefotaxima', texto: '2 g EV 6/6 h (texto, p. 784) x 2 g EV 8/8 h (Tabela 4, p. 785), 5 dias', pagina: 'cap. 57, p. 784–785', errata: 'Intervalo diverge entre o texto e a tabela; as duas versões ficam na tela.' },
  { droga: 'Amoxicilina/clavulanato', texto: '1 g EV 8/8 h por 2 dias, seguido de 500 mg 8/8 h VO se estável; 8–14 dias', pagina: 'cap. 57, p. 785' },
  { droga: 'Ciprofloxacina', texto: '200 mg EV 12/12 h por 2 dias, seguidos de 500 mg VO 12/12 h por 5 dias; 7 dias (opção em casos leves sem quinolona profilática)', pagina: 'cap. 57, p. 784–786' },
]

export const PROFILAXIA_PBE: Referencia[] = [
  { texto: 'Indicada em PBE prévia ou HDA; considerar se proteína total do LA < 1,5 g/dL (sem benefício de sobrevida)', pagina: 'cap. 57, p. 786' },
  { texto: 'PBE prévia ou proteína baixa: norfloxacina 400 mg/dia até transplante; ciprofloxacina 750 mg 1 x/semana até transplante', pagina: 'cap. 57, p. 786' },
  { texto: 'Após HDA: norfloxacina 400 mg 12/12 h VO 7 dias; ciprofloxacina "200 12/12 horas EV" 7 dias; ceftriaxona 1–2 g EV 1 x/dia 7 dias', pagina: 'cap. 57, p. 786',
    errata: 'Ciprofloxacina sem unidade na p. 786 e diferente da p. 704 ("500 EV").' },
]

// ── Síndrome hepatorrenal (cap. 58) ─────────────────────────────────────────

export const ALBUMINA_SHR = { gKgDia: 1, dias: 2, maxGDia: 100, pagina: 'cap. 58, p. 791 e 794',
  texto: 'Suspeita de SHR: suspender diuréticos e expandir com albumina EV 1 g/kg/dia por 2 dias consecutivos, dose máxima de 100 g/dia' }

export const ALBUMINA_COM_TERLIPRESSINA = { d1GKg: 1, demaisGDia: [20, 40] as Faixa, sugeridaGDia: 30, pagina: 'cap. 58, p. 794',
  texto: 'Durante a terlipressina: albumina 1 g/kg no D1 e 20 a 40 g/dia nos demais dias (sugerido 30 g/dia ou conforme tolerância)' }

export function albuminaShr(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const bruto = ALBUMINA_SHR.gKgDia * pesoKg
  const gDia = Math.min(bruto, ALBUMINA_SHR.maxGDia)
  return { gDia, limitadoA100: bruto > ALBUMINA_SHR.maxGDia, totalG: gDia * ALBUMINA_SHR.dias, frascosDia: frascosAlbumina(gDia)! }
}

export const NOTA_ALBUMINA_D1_TERLIPRESSINA = 'Para o D1 da terlipressina (1 g/kg) o livro não repete o teto de 100 g/dia; a conta mostra o valor por peso e avisa quando passa de 100 g.'

export function albuminaComTerlipressina(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const d1 = ALBUMINA_COM_TERLIPRESSINA.d1GKg * pesoKg
  return { d1G: d1, d1AcimaDe100: d1 > 100, frascosD1: frascosAlbumina(d1)!, demaisGDia: ALBUMINA_COM_TERLIPRESSINA.demaisGDia, sugeridaGDia: ALBUMINA_COM_TERLIPRESSINA.sugeridaGDia }
}

export type DegrauTerlipressina = { mg: number; intervaloH: number; mgDia: number; rotulo: string }

const degrau = (mg: number, intervaloH: number): DegrauTerlipressina =>
  ({ mg, intervaloH, mgDia: mg * (24 / intervaloH), rotulo: `${mg} mg EV ${intervaloH}/${intervaloH} h` })

/** Sequência em bolus (p. 797), subindo a cada 2 dias sem resposta, até 12 mg/dia. */
export const TERLIPRESSINA_SHR = {
  degraus: [degrau(1, 6), degrau(1, 4), degrau(2, 6), degrau(2, 4)],
  maxMgDia: 12,
  avaliarAposDias: 2,
  respostaQuedaPct: 25,
  completaAteBasalMais: 0.3,
  maxDias: 14,
  continua: { inicialMgDia: 3, passoMgDia: 1, aCadaDias: 2, diluenteMl: 50, diluente: 'soro glicosado 5%' },
  pagina: 'cap. 58, p. 795–797; Figura 1, p. 796',
}

export const NOTA_TERLIPRESSINA_CONTINUA = 'A p. 797 sugere diluir a dose do dia em SG 5% 50 mL em bomba de infusão contínua. A velocidade não está escrita, então a ferramenta não calcula mL/h. O teto de 12 mg/dia está escrito para a sequência em bolus (p. 797; Figura 1, p. 796), não para a contínua.'

export function terlipressinaContinua(mgDia: number) {
  if (!valido(mgDia)) return null
  const c = TERLIPRESSINA_SHR.continua
  return { mgDia, concentracaoMgMl: mgDia / c.diluenteMl, acimaDoTetoBolus: mgDia > TERLIPRESSINA_SHR.maxMgDia }
}

/** Degraus da infusão contínua: 3 mg/dia + 1 mg/dia a cada 2 dias, mostrados até 12 mg/dia. */
export function degrausContinua(): { diaInicio: number; mgDia: number }[] {
  const c = TERLIPRESSINA_SHR.continua
  const r: { diaInicio: number; mgDia: number }[] = []
  for (let mg = c.inicialMgDia, dia = 1; mg <= TERLIPRESSINA_SHR.maxMgDia; mg += c.passoMgDia, dia += c.aCadaDias) r.push({ diaInicio: dia, mgDia: mg })
  return r
}

/** Resposta (p. 795): queda de 25% da creatinina em relação à inicial; completa ao voltar a até basal + 0,3. */
export function respostaTerlipressina(crInicial: number, crAtual: number, crBasal?: number) {
  if (!valido(crInicial) || !valido(crAtual)) return null
  const quedaPct = ((crInicial - crAtual) / crInicial) * 100
  const completa = crBasal !== undefined && valido(crBasal) ? crAtual <= crBasal + TERLIPRESSINA_SHR.completaAteBasalMais : null
  return { quedaPct, atingiu25: quedaPct >= TERLIPRESSINA_SHR.respostaQuedaPct, completa }
}

export const NOTA_RESPOSTA_25 = 'O livro escreve "queda de 25%"; a ferramenta lê como queda de pelo menos 25%.'

export const ERRATA_NEJM_TERLIPRESSINA = 'A p. 797 atribui ao estudo do NEJM de 2021 mortalidade de 2% x 11% e NNT de 11. O inventário do projeto aponta que o estudo mediu reversão da SHR, sem benefício de mortalidade; isso não foi conferido fora do livro. Mostrado só como citação, sem entrar em conta.'

export type EstadioIcaAki = { estadio: 0 | 1 | 2 | 3; motivos: string[] }

/**
 * Estadiamento ICA-AKI da Tabela 2 (p. 791), lido como escrito:
 * 1 = aumento ≥ 0,3 ou > 1,5 até 2,0 × basal; 2 = > 2,0 até 3,0 ×;
 * 3 = > 3,0 ×, ou Cr ≥ 4,0 com elevação aguda ≥ 0,3, ou início de diálise.
 */
export function estadioIcaAki(crBasal: number, crAtual: number, dialise = false): EstadioIcaAki | null {
  if (!valido(crBasal) || !valido(crAtual)) return null
  const razao = crAtual / crBasal
  const delta = Math.round((crAtual - crBasal) * 100) / 100
  const motivos: string[] = []
  if (dialise) motivos.push('início de diálise')
  if (razao > 3) motivos.push(`creatinina ${fmt(razao)} × o basal (> 3,0)`)
  if (crAtual >= 4 && delta >= 0.3) motivos.push('creatinina ≥ 4,0 mg/dL com elevação ≥ 0,3')
  if (motivos.length) return { estadio: 3, motivos }
  if (razao > 2) return { estadio: 2, motivos: [`creatinina ${fmt(razao)} × o basal (> 2,0 até 3,0)`] }
  if (razao > 1.5) motivos.push(`creatinina ${fmt(razao)} × o basal (> 1,5 até 2,0)`)
  if (delta >= 0.3) motivos.push(`aumento de ${fmt(delta)} mg/dL (≥ 0,3)`)
  return motivos.length ? { estadio: 1, motivos } : { estadio: 0, motivos: ['sem critério de estádio da Tabela 2'] }
}

const fmt = (x: number) => numeroBr(Math.round(x * 100) / 100)

export const NOTA_ICA_AKI = 'O diagnóstico usa "> 50%" e o estádio 1 usa "> 1,5 até 2,0 ×": 1,5 × exato só entra pelo aumento absoluto ≥ 0,3. Na Tabela 2 o aumento ≥ 0,3 conta em 48 h; a ferramenta não pede o tempo e mostra o critério para quem usa conferir. A creatinina basal estimada pelo MDRD (TFG 75 mL/min/1,73 m²) é citada com "usar calculadora fornecida", mas a fórmula não está no livro — não é calculada.'

export const CRITERIOS_SHR: string[] = [
  'Cirrose com ascite',
  'Aumento de creatinina ≥ 0,3 mg/dL em 48 h ou > 50% em relação à basal (conhecida ou presumida nos últimos 7 dias)',
  'Sem melhora com albumina 1 g/kg (máximo 100 g/dia) por 48 horas',
  'Ausência de choque',
  'Ausência de tratamento com drogas nefrotóxicas',
  'Sem doença renal parenquimatosa: proteinúria ≤ 500 mg/dia, hematúria ≤ 50 hemácias/campo, ultrassom renal sem alteração',
]

export const DIFERENCIAL_LRA_CIRROSE: { item: string; preRenal: string; shr: string; nta: string }[] = [
  { item: 'Sódio urinário', preRenal: '< 20 mEq/L', shr: '< 20 mEq/L', nta: '> 40 mEq/L' },
  { item: 'FENa', preRenal: '< 0,5%', shr: '< 0,1–0,5%', nta: '> 0,5–2%' },
  { item: 'Proteinúria', preRenal: '< 500 mg/24 h', shr: '< 500 mg/24 h', nta: '> 500 mg/24 h' },
  { item: 'Sódio sérico', preRenal: 'indiferente', shr: '< 130–135 mEq/L', nta: 'indiferente' },
  { item: 'Resposta à albumina', preRenal: 'presente', shr: 'ausente', nta: 'ausente' },
]

export const NOTA_PROTEINURIA_INDICE = 'Índice proteína:creatinina urinária de 0,5 corresponde a 500 mg/24 h (Tabela 4, p. 793).'

// ── Encefalopatia hepática (cap. 59) ────────────────────────────────────────

export const WEST_HAVEN: { estadio: 'I' | 'II' | 'III' | 'IV'; consciencia: string; intelecto: string; comportamento: string; neuromuscular: string }[] = [
  { estadio: 'I', consciencia: 'Inversão do ciclo sono-vigília, alterações do sono', intelecto: 'Dificuldade em realizar somas e outras operações, pequeno déficit de atenção', comportamento: 'Euforia, respostas exageradas', neuromuscular: 'Tremor leve, discreta incoordenação e apraxia' },
  { estadio: 'II', consciencia: 'Respostas lentas, letargia, alterações do sono', intelecto: 'Perda de atenção, raciocínio lento, fala lentificada', comportamento: 'Irritabilidade, perda de inibições', neuromuscular: 'Flapping, alteração da escrita, fala arrastada' },
  { estadio: 'III', consciencia: 'Desorientação, sonolência, confusão mental', intelecto: 'Inabilidade de raciocinar, amnésia', comportamento: 'Ansiedade ou apatia, comportamento inapropriado ou bizarro, raiva', neuromuscular: 'Flapping, ataxia, reflexos usualmente hipoativos, nistagmo' },
  { estadio: 'IV', consciencia: 'Estupor ou coma', intelecto: 'Perda do autorreconhecimento e da resposta a estímulos', comportamento: 'Sem manifestações de comportamento, geralmente em coma', neuromuscular: 'Babinski, postura de descerebração, pupilas dilatadas; rigidez ou coma; sem flapping' },
]

export const PAGINA_WEST_HAVEN = 'cap. 59, Tabela 3, p. 803–804'

export const TRATAMENTO_EH: (Referencia & { droga: string })[] = [
  { droga: 'Lactulose', texto: '20 a 40 mL de 8/8 a 4/4 horas, com aumento progressivo; objetivo de 2 a 4 evacuações pastosas ao dia', pagina: 'cap. 59, p. 805–806' },
  { droga: 'Enema de lactulose (20–30%)', texto: '200 a 300 mL de lactulose em 700 a 800 mL de solução para uso retal (soro, água, glicerina ou manitol); reter por pelo menos 30 minutos', pagina: 'cap. 59, Tabela 4, p. 806' },
  { droga: 'Neomicina', texto: '1 a 1,5 g de 6/6 horas (sem resposta à lactulose em 48 h)', pagina: 'cap. 59, p. 805' },
  { droga: 'Metronidazol', texto: '250 a 500 mg de 8/8 horas', pagina: 'cap. 59, p. 805' },
  { droga: 'Rifaximina', texto: '550 mg VO 12/12 h; o livro diz que não está disponível no Brasil (grafado "rifamixina")', pagina: 'cap. 59, p. 805–806' },
]

/** Faixa diária de lactulose (p. 805): 20–40 mL × 3 a 6 tomadas. */
export function lactuloseMlDia(): Faixa {
  return [20 * 3, 40 * 6]
}

export const DIETA_EH = { kcalKg: [35, 40] as Faixa, proteinaTextoGKg: [1.25, 1.5] as Faixa, proteinaTabelaGKg: [1.2, 1.5] as Faixa, pagina: 'cap. 59, p. 805–806',
  errata: 'Proteína 1,25–1,5 g/kg no texto (p. 805) x 1,2–1,5 g/kg/dia na Tabela 4 (p. 806). As calorias são por kg de peso ideal, mas o livro não traz fórmula de peso ideal: a conta usa o peso informado por quem usa.' }

export function dietaEh(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const d = DIETA_EH
  return {
    kcal: [d.kcalKg[0] * pesoKg, d.kcalKg[1] * pesoKg] as Faixa,
    proteinaTexto: [d.proteinaTextoGKg[0] * pesoKg, d.proteinaTextoGKg[1] * pesoKg] as Faixa,
    proteinaTabela: [d.proteinaTabelaGKg[0] * pesoKg, d.proteinaTabelaGKg[1] * pesoKg] as Faixa,
  }
}

// ── Hepatites graves (cap. 60) ──────────────────────────────────────────────

export const HEPATITES_GRAVES: Referencia[] = [
  { texto: 'Hepatite por paracetamol só com doses maiores que 4 g em 24 horas', pagina: 'cap. 60, p. 809' },
  { texto: 'Hepatite fulminante: encefalopatia em menos de 26 semanas do aparecimento de icterícia; hiperaguda se < 1 semana', pagina: 'cap. 60, p. 810' },
  { texto: 'AST/ALT > 2 sugere hepatite alcoólica; transaminases > 500 U/L praticamente excluem', pagina: 'cap. 60, p. 811–812' },
  { texto: 'Queda > 50% das enzimas hepáticas em 24 horas pode indicar iminência de falência hepática', pagina: 'cap. 60, p. 814' },
  { texto: 'ACLF (NACSELD): pelo menos duas disfunções extra-hepáticas graves — choque, encefalopatia III/IV, terapia de substituição renal ou ventilação mecânica', pagina: 'cap. 60, p. 816' },
]

export const PFC_HEPATITE = { mlKg: 15, pagina: 'cap. 60, p. 817', texto: 'Em sangramento: plasma fresco congelado 15 mL/kg. INR alterado sem sangramento não é indicação' }

export function pfcHepatiteMl(pesoKg: number): number | null {
  return valido(pesoKg) ? PFC_HEPATITE.mlKg * pesoKg : null
}

// Maddrey (p. 817)

// Revisão PubMed, itens médios (decisão do RT de 06/11/2026): a diretriz ACG
// 2024 de doença hepática alcoólica entra como nota em cuidados e descrição. A
// ferramenta mantém o Maddrey e o corte do livro; nenhuma dose muda.
export const ACG_ALD_2024: Fonte = {
  citacao: 'Jophlin LL, Singal AK, Bataller R, et al. ACG Clinical Guideline: Alcohol-Associated Liver Disease. Am J Gastroenterol. 2024;119(1):30–54 (PMID 38174913).',
  url: 'https://doi.org/10.14309/ajg.0000000000002572',
}

export const NOTA_ACG_HEPATITE_ALCOOLICA =
  'ACG 2024 (posterior ao livro): o MELD é o escore mais acurado para estratificar a hepatite alcoólica, e MELD > 20 define a forma grave; no STOPAH (1.068 pacientes) o Maddrey discriminou pior a mortalidade em 28 e 90 dias que MELD, GAHS e ABIC. O benefício do corticoide em 28 dias aparece com MELD de 21 a 39, é limitado entre 40 e 50 e não existe acima de 50. O Lille no dia 4 do corticoide é tão acurado quanto no dia 7. A ferramenta mantém o Maddrey e o corte do livro; a escolha é do médico.'

const fichaMaddreyLivro = fichaAdulto('adulto-maddrey', 'Função discriminante de Maddrey — hepatite alcoólica (adulto)', 'cap. 60, p. 817')
export const fichaMaddrey: Ficha = {
  ...fichaMaddreyLivro,
  versao: '2026-11-06.1',
  fontes: [...fichaMaddreyLivro.fontes, ACG_ALD_2024],
  revisadoEm: '06/11/2026 (nota da ACG 2024 sobre MELD e Maddrey; revisão PubMed, itens médios)',
}

export const MADDREY = { k: 4.6, corte: 32, prednisona: 'prednisona 40 mg ao dia por 4 semanas', pagina: 'cap. 60, p. 817' }

export function funcaoMaddrey(tpPacienteS: number, tpControleS: number, btMgDl: number): number | null {
  if (!valido(tpPacienteS) || !valido(tpControleS) || !Number.isFinite(btMgDl) || btMgDl < 0) return null
  return MADDREY.k * (tpPacienteS - tpControleS) + btMgDl
}

export const maddrey: Escore = {
  ficha: fichaMaddrey,
  descricao: '4,6 × (TP do paciente − TP controle, em segundos) + bilirrubina total (mg/dL), com o corte de 32 do manual do HC (p. 817). A ACG 2024, posterior ao livro, prefere o MELD (> 20 define a forma grave); ver cuidados.',
  itens: [
    { tipo: 'numero', id: 'tp', rotulo: 'TP do paciente', unidade: 's', min: 1, max: 300, passo: 0.1 },
    { tipo: 'numero', id: 'controle', rotulo: 'TP controle', unidade: 's', min: 1, max: 100, passo: 0.1 },
    { tipo: 'numero', id: 'bt', rotulo: 'Bilirrubina total', unidade: 'mg/dL', min: 0, max: 80, passo: 0.1 },
  ],
  calcular(r) {
    const tp = numero(maddrey, r, 'tp')
    const ctl = numero(maddrey, r, 'controle')
    const bt = numero(maddrey, r, 'bt')
    if (tp === undefined || ctl === undefined || bt === undefined) return null
    const fd = funcaoMaddrey(tp, ctl, bt)!
    const grave = fd > MADDREY.corte
    return {
      rotulo: 'Função discriminante',
      valor: numeroBr(Math.round(fd * 10) / 10),
      nota: grave ? `> 32: hepatite alcoólica grave pela definição do livro (p. 817)` : '≤ 32: abaixo do corte de hepatite alcoólica grave do livro',
      estado: grave ? 2 : 0,
      derivados: [['Conta', `4,6 × (${tp} − ${ctl}) + ${bt}`], ['O livro associa ao corte', `${MADDREY.prednisona} (p. 817)`]],
      cuidados: [
        'Usa TP em segundos, não INR.',
        'O livro cita possível benefício de pentoxifilina ou N-acetilcisteína, sem dose.',
        NOTA_ACG_HEPATITE_ALCOOLICA,
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// King's College (Tabela 5, p. 818–819)

export type EntradaKings =
  | { etiologia: 'paracetamol'; phMenor730: boolean; inrMaior65: boolean; crMaior34: boolean; encefalopatia3ou4: boolean }
  | { etiologia: 'outras'; inrMaior65: boolean; idadeMaior40: boolean; causaMedicamentosaOuIndeterminada: boolean; ictericiaMais7Dias: boolean; inrMaior35: boolean; btMaior175: boolean }

export function kingsCollege(e: EntradaKings): { preenchido: boolean; motivo: string; contagem?: number } {
  if (e.etiologia === 'paracetamol') {
    if (e.phMenor730) return { preenchido: true, motivo: 'pH < 7,30' }
    const todos = e.inrMaior65 && e.crMaior34 && e.encefalopatia3ou4
    const n = [e.inrMaior65, e.crMaior34, e.encefalopatia3ou4].filter(Boolean).length
    return { preenchido: todos, motivo: todos ? 'INR > 6,5 + creatinina > 3,4 + encefalopatia III–IV' : `${n} de 3 critérios combinados (precisa dos 3)`, contagem: n }
  }
  if (e.inrMaior65) return { preenchido: true, motivo: 'INR > 6,5' }
  const n = [e.idadeMaior40, e.causaMedicamentosaOuIndeterminada, e.ictericiaMais7Dias, e.inrMaior35, e.btMaior175].filter(Boolean).length
  return { preenchido: n >= 3, motivo: `${n} de 5 critérios (precisa de 3)`, contagem: n }
}

export const NOTAS_KINGS: Referencia[] = [
  { texto: 'O livro lista "idade < 10 anos ou > 40 anos". Esta ferramenta é de adulto (14 anos ou mais): a faixa < 10 anos não se aplica e só "> 40 anos" é marcável.', pagina: 'cap. 60, p. 819' },
  { texto: 'No cap. 98 (intoxicação por paracetamol, p. 1311–1312) o mesmo critério aparece com creatinina > 3,2 mg/dL (aqui > 3,4), exige os três em 24 h e acrescenta lactato. As duas versões são do livro.', pagina: 'cap. 60, p. 818–819; cap. 98, p. 1311–1312' },
  { texto: 'INR > 6,5 é escrito junto de "(acima de 100 segundos)".', pagina: 'cap. 60, p. 819' },
]

// N-acetilcisteína na insuficiência hepática (p. 817–818)

export const NAC_CAP60 = {
  ev: [
    { rotulo: '1ª dose', mgKg: 150, minutos: 15, preparo: 'em solução glicosada 5% (volume não informado)' },
    { rotulo: '2ª dose', mgKg: 50, minutos: 240, preparo: 'volume não informado' },
  ],
  terceira: 'depois "100 mg a cada 6 horas", mantida até INR < 2,0',
  vo: 'VO ou SNG: 140 mg/kg em solução glicosada 5%, depois 70 mg/kg a cada 4 horas, total de 17 doses',
  pagina: 'cap. 60, p. 817–818',
  errata: 'A 3ª etapa EV está escrita "100 mg a cada 6 horas", sem "/kg" e sem dizer se é por kg — não é calculada. O ataque aparece em 15 minutos aqui e em 1 hora no cap. 98 (p. 1311), onde a 3ª fase é 100 mg/kg em 16 h. A ferramenta de intoxicações usa o cap. 98.',
}

export function nacCap60(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const ev = NAC_CAP60.ev.map((f) => ({ ...f, mg: f.mgKg * pesoKg, mgH: (f.mgKg * pesoKg) / (f.minutos / 60) }))
  return { ev, vo: nacVO(pesoKg)! }
}

export const FORA_HEPATOPATA = [
  'Creatinina basal estimada pelo MDRD (p. 791): o livro manda "usar calculadora fornecida" e não traz a fórmula.',
  'Dose de diurético por degrau na ascite: só a dose máxima (160 mg de furosemida, 400 mg de espironolactona, p. 767).',
  'Peso ideal para a meta calórica da encefalopatia: o livro não dá fórmula.',
  'Dose de pentoxifilina e de N-acetilcisteína na hepatite alcoólica (p. 817): não informada.',
  'Glicocorticoide e azatioprina na hepatite autoimune (p. 817): sem dose.',
  'Antibióticos da colangite e da febre tifoide (cap. 56): fora deste lote.',
]
