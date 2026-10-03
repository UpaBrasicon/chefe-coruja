import type { Ficha } from './ficha.ts'
import { BOLUS, NEONATO_FORA, type Bolus } from './pediatria/bolus.ts'
import { CLORETO_CA_TABELA7, HIPERCALEMIA, LIMIARES_K, calcularDose, type Dose } from './pediatria/eletrolitosPed.ts'
import { LIVRO_ICR } from './pediatria/fonteIcr.ts'
import { textoDoseLivro, type DoseLivro } from './pediatria/fonteP4.ts'
import { DOSES_TABELA8 } from './pediatria/injuriaRenalPed.ts'
import { DOSES_SLT } from './pediatria/oncologiaPed.ts'

// Hiperpotassemia: gravidade pelo nível, indicação de cálcio pelo ECG e a
// conduta em três tempos (estabilizar, deslocar, remover). Portada da versão
// revisada do protótipo (resposta E03 da revisão de evidência, 30/08/2026),
// que substituiu a ficha antiga com poliestirenossulfonato como conduta.
// A fonte não quantifica dose no adulto: onde ela não quantifica, aqui também não.
//
// CRIANÇA (auditoria 03/10/2026, R2): a referência de 2026 vale só para o
// ADULTO (decisão do RT, 27/09). Na criança tudo sai do livro do ICr-HCFMUSP
// (cap. 54, p. 546–549), reaproveitando os valores já conferidos em
// ./pediatria/eletrolitosPed.ts; outras passagens do mesmo livro já modeladas
// no app (apêndice, cap. de IRA, cap. de emergências oncológicas) aparecem
// como divergência. Nada é digitado de novo aqui nem convertido do adulto.

export const fichaHiperpotassemia: Ficha = {
  id: 'hiperpotassemia',
  titulo: 'Hiperpotassemia — conduta por nível e por ECG',
  versao: '2026-10-03.1',
  publico: 'ambos',
  fontes: [
    { citacao: 'Adulto: Geldermann N, et al. Acute hyperkalaemia in emergency care: evidence-based approaches. Emerg Med J. 2026.' },
    { citacao: 'Adulto: Arzayus-Patiño L, et al. Inhaled beta-2 agonists in hyperkalaemia. PLoS One. 2025.' },
    { citacao: 'Adulto, divergência mostrada na tela: Brandão Neto RA, et al. (eds.). Manual de Medicina de Emergência — HCFMUSP. 3ª ed. Manole; 2022. cap. 67, p. 907–917.' },
    { citacao: `Criança: ${LIVRO_ICR.citacao} cap. 54, p. 546–549 (Tabela 7); divergências do mesmo livro: apêndice (p. 894–897), IRA (p. 583), emergências oncológicas (p. 701–702).`, pediatrica: true },
  ],
  revisadoEm: '03/10/2026 — adulto: decisão do RT de 27/09/2026 (referência de 2026; manual do HCFMUSP como divergência). Criança: só o livro do ICr-HCFMUSP (auditoria R2); o período neonatal fica fora',
}

export type Ecg = 'sem_alteracao' | 'alterado' | 'nao_feito'

export type EntradaHiperK = {
  potassio: number
  ecg: Ecg
  diureseComprometida: boolean
  acidose: boolean
}

export type Faixa = 'Leve' | 'Moderada' | 'Grave' | 'Fora da faixa de hiperpotassemia'
export type Linha = { item: string; texto: string; quando: string }
export type Bloco = { titulo: string; sub: string; linhas: Linha[] }

export type ResultadoHiperK = {
  faixa: Faixa
  calcio: 'indicado' | 'nao_indicado' | 'indeterminado'
  gravidade: 0 | 1 | 2
  blocos: Bloco[]
  alertas: string[]
}

/** Faixas exclusivas: 5,0–5,4 leve; 5,5–6,0 moderada; acima de 6,0 grave. */
export function faixaPotassio(k: number): Faixa {
  if (k > 6) return 'Grave'
  if (k >= 5.5) return 'Moderada'
  if (k >= 5) return 'Leve'
  return 'Fora da faixa de hiperpotassemia'
}

/** Conduta do ADULTO (Geldermann 2026). Para criança, use `avaliarHiperpotassemiaPed`. */
export function avaliarHiperpotassemia(e: EntradaHiperK): ResultadoHiperK | null {
  const k = e.potassio
  if (!Number.isFinite(k)) return null
  const ecgAlt = e.ecg === 'alterado'
  const semEcg = e.ecg === 'nao_feito'
  const faixa = faixaPotassio(k)
  // ECG não feito não é ECG normal: abaixo de 6,5 a indicação fica indeterminada
  const calcio = ecgAlt || k >= 6.5 ? 'indicado' : semEcg ? 'indeterminado' : 'nao_indicado'
  const gravidade = k > 6 || ecgAlt || (semEcg && k >= 5.5) ? 2 : k >= 5.5 ? 1 : 0
  const diurese = !e.diureseComprometida

  const blocos: Bloco[] = [
    {
      titulo: '1 · Estabilizar a membrana',
      sub: calcio === 'indicado'
        ? `Indicado: ${ecgAlt ? 'ECG alterado' : 'potássio de 6,5 mEq/L ou mais'}`
        : calcio === 'indeterminado'
          ? 'Indeterminado: sem ECG, e com potássio abaixo de 6,5 mEq/L, não há como dizer que o cálcio não está indicado. Faça o ECG.'
          : 'Indicado quando há alteração no ECG ou potássio de 6,5 mEq/L ou mais.',
      linhas: [
        { item: 'Gluconato ou cloreto de cálcio EV', texto: 'início em minutos, duração de 30 a 60 minutos. NÃO reduz o potássio sérico: protege o miocárdio.', quando: calcio === 'indicado' ? 'agora' : 'se ECG alterado' },
        { item: 'Dose no adulto', texto: 'a referência não quantifica a dose de cálcio no adulto — siga o protocolo da unidade.', quando: '' },
      ],
    },
    {
      titulo: '2 · Deslocar para dentro da célula',
      sub: 'Efeito temporário: o potássio volta se nada for removido.',
      linhas: [
        { item: 'Insulina regular EV com glicose', texto: 'início em 15 a 30 minutos, duração de 4 a 6 horas. A glicose evita hipoglicemia, risco relevante sobretudo em não diabético.', quando: '15 a 30 min' },
        { item: 'Beta-agonista inalatório', texto: 'salbutamol, com efeito sinérgico à insulina — em associação, não como substituto.', quando: 'associar' },
        { item: 'Bicarbonato', texto: e.acidose ? 'papel incerto; indicação limitada à acidose metabólica concomitante — o caso declarado aqui.' : 'papel incerto; indicação limitada à acidose metabólica concomitante, que não foi declarada.', quando: e.acidose ? 'considerar' : 'não indicado' },
      ],
    },
    {
      titulo: '3 · Remover do corpo',
      sub: 'É o passo que fecha o quadro.',
      linhas: [
        { item: 'Diurético', texto: diurese ? 'furosemida com função renal e diurese preservadas.' : 'sem diurese, o diurético não é o caminho.', quando: diurese ? 'considerar' : 'sem diurese' },
        { item: 'Patirômero e ciclossilicato de zircônio e sódio', texto: 'aumentam a excreção fecal de potássio, melhor tolerados; exigem validação adicional em contexto de urgência.', quando: 'preferidos' },
        { item: 'Poliestirenossulfonato de sódio', texto: 'NÃO é mais recomendado: eficácia questionável e risco de necrose intestinal. Segue indicado apenas em paciente anúrico ou gravemente oligúrico.', quando: diurese ? 'fora de linha' : 'só nesta exceção' },
        { item: 'Diálise', texto: 'opção definitiva em caso refratário ou em doença renal terminal.', quando: 'refratário' },
      ],
    },
    {
      titulo: 'Preparo',
      sub: 'Onde a referência não quantifica dose no adulto, só a conversão da ampola — para conferir a prescrição, não para substituí-la.',
      linhas: [
        { item: 'Gluconato de cálcio 10%', texto: '1 ampola de 10 mL = 1 g = 93 mg de cálcio elementar = 4,65 mEq. Corre em veia periférica; o cloreto de cálcio exige acesso central. Velocidade máxima de 200 mg/min no adulto.', quando: '' },
        { item: 'Glicose', texto: 'glicose 50%: 1 mL = 0,5 g; glicose 25%: 1 mL = 0,25 g.', quando: '' },
        { item: 'Bicarbonato de sódio 8,4%', texto: '1 mL = 1 mEq.', quando: '' },
        { item: 'Cuidado de via', texto: 'bicarbonato e cálcio NÃO correm na mesma via.', quando: 'obrigatório' },
      ],
    },
  ]

  const alertas = [
    calcio === 'indicado' ? 'Cálcio indicado agora, pela cardioproteção. Ele não reduz o potássio: os passos 2 e 3 continuam obrigatórios.' : '',
    semEcg && k >= 5 && k < 6.5 ? 'ECG não feito: abaixo de 6,5 mEq/L a indicação de cálcio depende dele.' : '',
  ].filter(Boolean)

  return { faixa, calcio, gravidade, blocos, alertas }
}

// ---------------------------------------------------------------- criança (ICr-HCFMUSP)

/** Neonato: menos de 28 dias de vida. */
export const DIAS_NEONATAL = 28

/**
 * Recém-nascido pela idade da Central. `null` quando a idade não decide:
 * sem idade, ou "0 meses" (pode ter menos ou mais de 28 dias).
 */
export function neonatoPelaIdade(idade: number | null, unidade: 'dias' | 'meses' | 'anos'): boolean | null {
  if (idade === null || !Number.isFinite(idade) || idade < 0) return null
  if (unidade === 'dias') return idade < DIAS_NEONATAL
  if (idade >= 1) return false
  return null
}

export type EntradaHiperKPed = {
  potassio: number
  ecg: Ecg
  /** recém-nascido (< 28 dias); `null` = não informado */
  neonato: boolean | null
  pesoKg?: number
}

export type DoseHiperKPed = {
  id: string
  nome: string
  texto: string
  pagina: string
  unidade: string
  /** dose para o peso, pelo livro; null sem peso, no neonato ou sem a idade */
  faixa: [number, number] | null
  noMaximo: boolean
  errata?: string
  nota?: string
  /** a mesma droga em outras passagens do livro do ICr já modeladas no app */
  divergencias: string[]
}

export type SemReferenciaPed = { item: string; texto: string }

export type ResultadoHiperKPed = {
  /** leitura do nível pelos limiares do livro (p. 546–548) */
  leitura: string
  acimaDoLimiar: boolean
  risco: boolean
  alertas: string[]
  /** neonato: o livro não cobre; não há dose */
  neonato: boolean
  semPeso: boolean
  doses: DoseHiperKPed[]
  semReferencia: SemReferenciaPed[]
}

const faixaTexto = (f: [number, number]) => (f[0] === f[1] ? `${f[0]}` : `${f[0]} a ${f[1]}`).replace(/\./g, ',')

/** Linha do apêndice (bolus.ts) como texto, só com os campos do próprio registro. */
export function textoBolus(b: Bolus): string {
  const partes = [`${faixaTexto(b.faixa)} ${b.unidade}${b.porKg ? '/kg' : ''}`]
  if (b.maximo !== undefined) partes.push(`máx. ${b.maximo.toLocaleString('pt-BR')} ${b.unidade}`)
  if (b.condicao) partes.push(b.condicao.texto)
  partes.push(b.via)
  return `${b.nome}: ${partes.join(' · ')} (${b.pagina})${b.errata ? `. Errata: ${b.errata}` : ''}`
}

const doLivro = (contexto: string, d: DoseLivro) =>
  `${contexto} — ${d.nome}: ${textoDoseLivro(d)} · ${d.via} (${d.pagina})${d.nota ? `. ${d.nota}` : ''}${d.errata ? `. Errata: ${d.errata}` : ''}`

const achar = <T extends { id: string }>(lista: T[], id: string): T => {
  const x = lista.find((i) => i.id === id)
  if (!x) throw new Error(`hiperpotassemia: item ${id} ausente na fonte pediátrica`)
  return x
}

/** Ids do cap. 54 (eletrolitosPed) → a mesma droga em outras passagens do livro já no app. */
const DIVERGENCIAS_PED: Record<string, { apendice?: string[]; ira?: string[]; slt?: string[] }> = {
  'gluconato-ca': { ira: ['gluconato'], slt: ['gluconato'] },
  'cloreto-ca': { ira: ['cacl'] },
  bic: { apendice: ['bicarbonato-hipercalemia'], ira: ['bic'], slt: ['bic3'] },
  insulina: { apendice: ['polarizante-insulina'], ira: ['insulina'], slt: ['insulina'] },
  'glicose-polarizante': { apendice: ['polarizante-g10', 'polarizante-g25'], ira: ['glicose'], slt: ['glicose25'] },
  sorcal: { ira: ['sorcal'], slt: ['sorcal'] },
  'furosemida-k': { ira: ['furo-k'], slt: ['furo'] },
}

export function divergenciasPed(id: string): string[] {
  const d = DIVERGENCIAS_PED[id]
  if (!d) return []
  return [
    ...(d.apendice ?? []).map((x) => `Apêndice — ${textoBolus(achar(BOLUS, x))}`),
    ...(d.ira ?? []).map((x) => doLivro('Cap. de injúria renal aguda, Tabela 8', achar(DOSES_TABELA8, x))),
    ...(d.slt ?? []).map((x) => doLivro('Cap. de emergências oncológicas (lise tumoral), Tabela 6', achar(DOSES_SLT, x))),
  ]
}

/** Beta-agonista: o cap. 54 não dá dose; o cap. de IRA dá (p. 583). Só divergência, sem cálculo. */
export const BETA2_IRA = doLivro('Cap. de injúria renal aguda, Tabela 8', achar(DOSES_TABELA8, 'beta2'))

/** O que a conduta do adulto tem e o cap. 54 do livro do ICr não quantifica para a criança. */
export const SEM_REFERENCIA_PED: SemReferenciaPed[] = [
  { item: 'Beta-agonista', texto: `o cap. 54 cita agonista beta-adrenérgico inalatório ou EV sem dose (p. 549): sem referência pediátrica de dose neste capítulo. Em outra passagem do livro: ${BETA2_IRA}` },
  { item: 'Patirômero e ciclossilicato de zircônio e sódio', texto: 'sem referência pediátrica: o livro do ICr não traz.' },
  { item: 'Diálise', texto: 'o livro cita a diálise como último recurso, sem critério numérico (p. 549).' },
]

/** O Anexo 2 do manual do adulto não tem registro no app para estes itens. */
export const ANEXO2_SEM_REGISTRO =
  'Anexo 2 do manual do adulto (padrão de diluição em crianças, p. 1490–1494): o app não tem registro destes itens de hipercalemia, então nenhuma divergência é mostrada a partir dele.'

export { NEONATO_FORA }

function dosePed(d: Dose, peso: number | null, calcula: boolean): DoseHiperKPed {
  const r = calcula && peso ? calcularDose(d, peso) : null
  return {
    id: d.id,
    nome: d.nome,
    texto: d.texto,
    pagina: d.pagina,
    unidade: d.unidade,
    faixa: r ? r.faixa : null,
    noMaximo: r ? r.noMaximo : false,
    errata: d.errata,
    nota: d.nota,
    divergencias: divergenciasPed(d.id),
  }
}

/**
 * Criança (de 1 dia a antes dos 14 anos): só o livro do ICr-HCFMUSP. Limiares
 * e doses vêm de ./pediatria/eletrolitosPed.ts (cap. 54); no neonato não há
 * dose (o apêndice não cobre o período neonatal, p. 894), e sem saber se é
 * recém-nascido a ferramenta também não calcula.
 */
export function avaliarHiperpotassemiaPed(e: EntradaHiperKPed): ResultadoHiperKPed | null {
  const k = e.potassio
  if (!Number.isFinite(k) || k <= 0) return null
  const peso = e.pesoKg && e.pesoKg > 0 ? e.pesoKg : null
  const calcula = e.neonato === false
  const acimaDoLimiar = k > LIMIARES_K.hipercalemia
  const risco = k >= LIMIARES_K.hipercalemiaGrave
  const n = (x: number) => x.toLocaleString('pt-BR')
  const leitura = acimaDoLimiar
    ? `Hipercalemia pelo livro: acima de ${n(LIMIARES_K.hipercalemia)} mEq/L (p. 546).`
    : `Não passa de ${n(LIMIARES_K.hipercalemia)} mEq/L, o limiar do livro (p. 546).`

  const alertas = [
    risco ? `Potássio de ${n(LIMIARES_K.hipercalemiaGrave)} mEq/L ou mais: situação de risco pelo livro (p. 548), assim como a hipercalemia sintomática ou de 6 a 7 em elevação rápida.` : '',
    k > LIMIARES_K.ecgAcimaDe && e.ecg === 'nao_feito' ? `Acima de ${n(LIMIARES_K.ecgAcimaDe)} mEq/L o livro pede ECG (p. 548): ainda não feito.` : '',
    e.ecg === 'alterado' ? 'ECG alterado: o gluconato de cálcio pode ser repetido após 5 min se o ECG persistir alterado (p. 549).' : '',
    `Em recém-nascidos e lactentes jovens o limite superior do potássio pode chegar a ${n(LIMIARES_K.hipercalemiaRN)} mEq/L (p. 546).`,
  ].filter(Boolean)

  return {
    leitura,
    acimaDoLimiar,
    risco,
    alertas,
    neonato: e.neonato === true,
    semPeso: peso === null,
    doses: [...HIPERCALEMIA, CLORETO_CA_TABELA7].map((d) => dosePed(d, peso, calcula)),
    semReferencia: SEM_REFERENCIA_PED,
  }
}

// Decisão do RT (27/09/2026): a tela segue a referência mais recente (Geldermann
// 2026); o manual do HCFMUSP (2022, cap. 67) aparece como divergência, com
// página. Valores conferidos no PDF do livro.
export const DIVERGENCIA_MANUAL_HC = {
  fonte: 'Manual de Medicina de Emergência — HCFMUSP, 3ª ed., 2022, cap. 67',
  classificacao: 'Hipercalemia a partir de 5,5 mEq/L (p. 907); leve 5,5–5,9, moderada 6–6,4, grave ≥ 6,5 (p. 908, pelo European Resuscitation Council).',
  itens: [
    { item: 'Cálcio', texto: 'Gluconato ou cloreto de cálcio 10%: 10 mL em 100 mL de SG 5%, IV em 3–5 min (o cloreto tem 3× mais cálcio: 13,6 × 4,6 mEq em 10 mL)', pagina: 'p. 915–916' },
    { item: 'Insulina + glicose', texto: 'Insulina regular 10 UI IV + glicose 10% 500 mL IV em 30–60 min', pagina: 'p. 915' },
    { item: 'β2-agonista', texto: 'Salbutamol 5 mg/mL: 10–20 mg inalatório + SF 0,9% 5 mL em 10 min', pagina: 'p. 915' },
    { item: 'Bicarbonato', texto: 'NaHCO3 8,4% 150 mL + SG 5% 1.000 mL IV em 2–4 h (eficácia limitada)', pagina: 'p. 916' },
    { item: 'Diurético', texto: 'Furosemida 40 mg IV; efeito caliurético questionável no curto prazo, não como medida isolada', pagina: 'p. 916' },
    { item: 'Resina', texto: 'Poliestirenossulfonato de CÁLCIO (Sorcal®) 30–60 g + manitol 100 mL VO (ou retal); risco de necrose intestinal', pagina: 'p. 916' },
  ],
  diferencas: [
    'Início da hipercalemia: 5,5 no manual × 5,0 nesta tela.',
    'O manual quantifica as doses do adulto; a referência desta tela não quantifica.',
    'O manual usa a resina de cálcio (Sorcal); esta tela, pela referência de 2026, trata a resina de sódio como fora de linha.',
    'O manual não restringe o bicarbonato à acidose metabólica.',
  ],
} as const
