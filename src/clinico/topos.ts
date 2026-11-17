import type { ItemGuia } from './guia.ts'

// Textos do topo das ferramentas no modelo das calculadoras (pedido do RT de
// 16/11/2026, modelo do MDCalc): frase-resumo, instruções curtas e as abas
// "Quando usar" e "Por que usar". Decisão C1 = A: cada frase sai de fonte que a
// ficha já cita; o que a fonte não diz fica de fora e a aba não aparece.
// Módulo leve, sem as tabelas clínicas: o ToolLayout importa daqui em toda tela.
// Piloto (16/11/2026): os quatro escores do piloto, lidos nos resumos do PubMed
// e nos textos já lidos das diretrizes.

export type Topo = {
  /** uma frase de "para que serve", no lugar da descrição sob o título */
  resumo?: string
  instrucoes?: string
  quandoUsar?: ItemGuia[]
  porQueUsar?: ItemGuia[]
}

const BACKUS = 'Backus et al., Int J Cardiol 2013 (validação prospectiva)'
const SIX = 'Six et al., Neth Heart J 2008'
const SBC_DOR = 'SBC 2025, dor torácica na emergência'
const LIM = 'Lim et al., Thorax 2003 (derivação e validação)'
const ATS_IDSA = 'ATS/IDSA 2019, pneumonia comunitária'
const SEPSIS3 = 'Sepsis-3, JAMA 2016'
const SSC = 'SSC 2026'
const BRENNAN = 'Brennan et al., J Neurosurg 2018 (GCS-P)'

export const TOPOS: Record<string, Topo> = {
  heart: {
    resumo: 'Prevê o risco de evento cardíaco adverso maior em 6 semanas no paciente com dor torácica no pronto-socorro.',
    instrucoes: 'Cinco itens (história, ECG, idade, fatores de risco e troponina), de 0 a 2 pontos cada. Calcule quando o primeiro ECG e os primeiros exames estiverem prontos.',
    quandoUsar: [
      { texto: 'Dor torácica no pronto-socorro, para separar o paciente de baixo e o de alto risco de síndrome coronariana aguda.', ref: { fonte: BACKUS, pagina: 'resumo' } },
      { texto: 'Na suspeita de síndrome coronariana aguda, a diretriz brasileira indica o HEART como escore clínico preferencial.', ref: { fonte: SBC_DOR, pagina: 'p. 29–30', grau: 'I, B' } },
    ],
    porQueUsar: [
      { texto: 'Na validação prospectiva em 10 hospitais holandeses (2.440 pacientes), o evento cardíaco maior em 6 semanas ocorreu em 1,7% com HEART de 0 a 3, em 16,6% com 4 a 6 e em 50,1% com 7 a 10. A estatística C foi 0,83, maior que a do TIMI (0,75) e a do GRACE (0,70).', ref: { fonte: BACKUS, pagina: 'resumo' } },
      { texto: 'Cada item é uma consideração clássica de risco, pontuada de 0 a 2 conforme o grau da alteração: rápido de calcular, sem computador.', ref: { fonte: SIX, pagina: 'resumo' } },
    ],
  },
  'curb-65': {
    resumo: 'Estima a mortalidade em 30 dias da pneumonia comunitária no adulto, com dados da chegada ao hospital.',
    instrucoes: 'Um ponto para cada item: confusão, ureia acima de 7 mmol/L, frequência respiratória de 30 ou mais, PA sistólica abaixo de 90 ou diastólica de 60 ou menos, e idade de 65 anos ou mais.',
    quandoUsar: [
      { texto: 'Adulto com pneumonia comunitária na avaliação inicial no hospital, para estratificar a gravidade.', ref: { fonte: LIM, pagina: 'resumo' } },
      { texto: 'Para decidir o local do tratamento, a ATS/IDSA prefere o PSI ao CURB-65, sempre junto do julgamento clínico.', ref: { fonte: ATS_IDSA, pagina: 'questão 6', grau: 'forte, qualidade moderada' } },
    ],
    porQueUsar: [
      { texto: 'Em 1.068 adultos internados no Reino Unido, na Nova Zelândia e na Holanda, a mortalidade em 30 dias subiu com a pontuação: 0,7% com 0, 3,2% com 1, 3% com 2, 17% com 3, 41,5% com 4 e 57% com 5; a coorte de validação confirmou o padrão.', ref: { fonte: LIM, pagina: 'resumo' } },
    ],
  },
  'sepse-adulto': {
    resumo: 'Reconhece a disfunção orgânica da sepse pelo SOFA e o choque séptico pelos critérios do Sepsis-3.',
    instrucoes: 'Preencha os sistemas do SOFA com os dados disponíveis. Sem disfunção orgânica conhecida antes da infecção, o SOFA basal é considerado zero.',
    quandoUsar: [
      { texto: 'Infecção suspeita ou confirmada: a disfunção orgânica da sepse é o aumento agudo de 2 pontos ou mais no SOFA por causa da infecção.', ref: { fonte: SEPSIS3, pagina: 'Quadro 3' } },
      { texto: 'Para rastrear sepse no paciente agudo, NEWS, NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única.', ref: { fonte: SSC, pagina: 'rec. 4, p. 15', grau: 'forte, certeza moderada' } },
    ],
    porQueUsar: [
      { texto: 'SOFA de 2 ou mais reflete risco de morte de cerca de 10% na população hospitalar com infecção suspeita; mesmo a disfunção modesta pode piorar, por isso pede resposta rápida.', ref: { fonte: SEPSIS3, pagina: 'Quadro 3' } },
    ],
  },
  glasgow: {
    resumo: 'Mede o nível de consciência pela abertura ocular, pela resposta verbal e pela resposta motora; o GCS-P soma a reatividade das pupilas.',
    instrucoes: 'Some os três componentes (3 a 15). Para o GCS-P, subtraia o número de pupilas que não reagem (0, 1 ou 2): o resultado vai de 1 a 15.',
    quandoUsar: [
      { texto: 'Avaliação da gravidade do traumatismo craniano: o Glasgow e a resposta das pupilas são indicadores-chave da gravidade da lesão.', ref: { fonte: BRENNAN, pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Nos dados do CRASH e do IMPACT (cerca de 15.900 pacientes), somar as pupilas aumentou a informação sobre o desfecho: com Glasgow 3 a mortalidade foi de 51%, e com GCS-P 1, de 74%. O GCS-P também desfez o achado paradoxal de Glasgow 4 com desfecho pior que Glasgow 3.', ref: { fonte: BRENNAN, pagina: 'resumo' } },
    ],
  },
}

export function topoDa(fichaId: string): Topo | undefined {
  return TOPOS[fichaId]
}
