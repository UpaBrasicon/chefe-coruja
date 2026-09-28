import type { Ficha } from './ficha.ts'

// Hiperpotassemia: gravidade pelo nível, indicação de cálcio pelo ECG e a
// conduta em três tempos (estabilizar, deslocar, remover). Portada da versão
// revisada do protótipo (resposta E03 da revisão de evidência, 30/08/2026),
// que substituiu a ficha antiga com poliestirenossulfonato como conduta.
// A fonte não quantifica dose no adulto: onde ela não quantifica, aqui também não.

export const fichaHiperpotassemia: Ficha = {
  id: 'hiperpotassemia',
  titulo: 'Hiperpotassemia — conduta por nível e por ECG',
  versao: '2026-09-27.2',
  publico: 'ambos',
  fontes: [
    { citacao: 'Geldermann N, et al. Acute hyperkalaemia in emergency care: evidence-based approaches. Emerg Med J. 2026.', pediatrica: true },
    { citacao: 'Arzayus-Patiño L, et al. Inhaled beta-2 agonists in hyperkalaemia. PLoS One. 2025.' },
    { citacao: 'Divergência mostrada na tela: Brandão Neto RA, et al. (eds.). Manual de Medicina de Emergência — HCFMUSP. 3ª ed. Manole; 2022. cap. 67, p. 907–917.' },
  ],
  revisadoEm: '27/09/2026 — decisão do RT: mantida a referência mais recente (2026); o manual do HCFMUSP (2022) aparece como divergência',
}

export type Ecg = 'sem_alteracao' | 'alterado' | 'nao_feito'

export type EntradaHiperK = {
  potassio: number
  ecg: Ecg
  diureseComprometida: boolean
  acidose: boolean
  pediatrico: boolean
  pesoKg?: number
}

export type Faixa = 'Leve' | 'Moderada' | 'Grave' | 'Fora da faixa de hiperpotassemia'
export type Linha = { item: string; texto: string; quando: string }
export type Bloco = { titulo: string; sub: string; linhas: Linha[] }

export type ResultadoHiperK = {
  faixa: Faixa
  calcio: 'indicado' | 'nao_indicado' | 'indeterminado'
  gravidade: 0 | 1 | 2
  emergenciaPediatrica: boolean
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

const fmt = (x: number, casas = 0) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')

export function avaliarHiperpotassemia(e: EntradaHiperK): ResultadoHiperK | null {
  const k = e.potassio
  if (!Number.isFinite(k)) return null
  const ecgAlt = e.ecg === 'alterado'
  const semEcg = e.ecg === 'nao_feito'
  const faixa = faixaPotassio(k)
  // ECG não feito não é ECG normal: abaixo de 6,5 a indicação fica indeterminada
  const calcio = ecgAlt || k >= 6.5 ? 'indicado' : semEcg ? 'indeterminado' : 'nao_indicado'
  const gravidade = k > 6 || ecgAlt || (semEcg && k >= 5.5) ? 2 : k >= 5.5 ? 1 : 0
  const emergenciaPediatrica = e.pediatrico && (k > 7 || ecgAlt)
  const peso = e.pesoKg && e.pesoKg > 0 ? e.pesoKg : null
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
        { item: 'Gluconato de cálcio 10%', texto: '1 ampola de 10 mL = 1 g = 93 mg de cálcio elementar = 4,65 mEq. Corre em veia periférica; o cloreto de cálcio exige acesso central. Velocidade máxima de 200 mg/min no adulto e 100 mg/min em pediatria.', quando: '' },
        { item: 'Glicose', texto: 'glicose 50%: 1 mL = 0,5 g; glicose 25%: 1 mL = 0,25 g.', quando: '' },
        { item: 'Bicarbonato de sódio 8,4%', texto: '1 mL = 1 mEq.', quando: '' },
        { item: 'Cuidado de via', texto: 'bicarbonato e cálcio NÃO correm na mesma via.', quando: 'obrigatório' },
      ],
    },
  ]

  if (e.pediatrico) {
    blocos.push({
      titulo: 'Na criança',
      sub: 'Emergência com potássio acima de 7 mEq/L ou ECG alterado. Doses da fonte (lise tumoral pediátrica).',
      linhas: [
        { item: 'Insulina rápida com dextrose a 25%', texto: peso ? `insulina 0,1 U/kg EV = ${fmt(0.1 * peso, 1)} U · dextrose a 25%, 2 mL/kg = ${fmt(2 * peso)} mL` : 'insulina 0,1 U/kg EV com dextrose a 25%, 2 mL/kg — informe o peso', quando: 'deslocamento' },
        { item: 'Gluconato de cálcio', texto: peso ? `100 a 200 mg/kg = ${fmt(100 * peso)} a ${fmt(200 * peso)} mg por dose, infusão lenta com ECG` : '100 a 200 mg/kg por dose, infusão lenta com ECG', quando: 'cardioproteção' },
        { item: 'Bicarbonato de sódio', texto: peso ? `1 a 2 mEq/kg EV = ${fmt(peso)} a ${fmt(2 * peso)} mEq` : '1 a 2 mEq/kg EV', quando: '' },
        { item: 'Poliestirenossulfonato de sódio', texto: 'mesma ressalva do adulto: não é mais recomendado (necrose intestinal, atribuída ao sorbitol, mais relevante na criança). Só em anúrico ou gravemente oligúrico.', quando: diurese ? 'fora de linha' : 'só nesta exceção' },
      ],
    })
  }

  const alertas = [
    emergenciaPediatrica ? 'Criança com potássio acima de 7 mEq/L ou ECG alterado é emergência médica.' : '',
    calcio === 'indicado' ? 'Cálcio indicado agora, pela cardioproteção. Ele não reduz o potássio: os passos 2 e 3 continuam obrigatórios.' : '',
    semEcg && k >= 5 && k < 6.5 ? 'ECG não feito: abaixo de 6,5 mEq/L a indicação de cálcio depende dele.' : '',
  ].filter(Boolean)

  return { faixa, calcio, gravidade, emergenciaPediatrica, blocos, alertas }
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
