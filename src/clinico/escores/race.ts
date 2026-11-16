import { completo, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'
import { AHA_ASA_2026 } from '../adulto/avcTrombolise.ts'

// RACE (Rapid Arterial oCclusion Evaluation): pendente desde 27/10/2026 nas
// lacunas clínicas por falta da fonte com a pontuação item a item. Em
// 16/11/2026 o RT entregou o PDF do artigo original e pediu a escala no grupo
// Neurologia, ao lado do FAST-ED. Pontos e instruções conferidos na Tabela 1
// (p. 88) e na Tabela I do suplemento; desempenho por corte na Tabela 3
// (p. 89). Onde o suplemento difere da Tabela 1 (segunda pergunta da agnosia),
// vale a Tabela 1 do artigo.

export const RACE_2014: Fonte = {
  citacao: 'Pérez de la Ossa N, Carrera D, Gorchs M, et al. Design and Validation of a Prehospital Stroke Scale to Predict Large Arterial Occlusion: The Rapid Arterial Occlusion Evaluation Scale. Stroke. 2014;45(1):87–91 (PDF entregue pelo RT em 16/11/2026): Tabela 1 (pontos e instruções, p. 88), Tabela 3 (desempenho por corte, p. 89) e Tabela I do suplemento.',
  url: 'https://doi.org/10.1161/STROKEAHA.113.003071',
}

/** Tabela 3 (p. 89): sensibilidade, especificidade, VPP e VPN do corte "≥ n". */
const CORTES: Record<number, [string, string, string, string]> = {
  1: ['1,00', '0,13', '0,24', '1,00'],
  2: ['0,97', '0,27', '0,27', '0,97'],
  3: ['0,93', '0,40', '0,30', '0,96'],
  4: ['0,89', '0,55', '0,35', '0,95'],
  5: ['0,85', '0,68', '0,42', '0,94'],
  6: ['0,72', '0,77', '0,46', '0,91'],
  7: ['0,53', '0,89', '0,56', '0,87'],
  8: ['0,32', '0,95', '0,65', '0,84'],
  9: ['0,07', '0,99', '0,56', '0,79'],
}
const desempenho = (c: [string, string, string, string]) => `sensibilidade ${c[0]} · especificidade ${c[1]} · VPP ${c[2]} · VPN ${c[3]}`

export const race: Escore = {
  ficha: {
    id: 'race',
    titulo: 'RACE — suspeita de oclusão de grande vaso no AVC',
    versao: '2026-11-16.1',
    publico: 'adulto',
    fontes: [RACE_2014, AHA_ASA_2026],
    revisadoEm: '16/11/2026 (escala nova, pedido do RT; Tabelas 1 e 3 e suplemento conferidos no PDF do artigo; aguarda aprovação do RT)',
  },
  descricao: 'Cinco itens do NIHSS simplificados, de 0 a 9 pontos: face, braço, perna, olhar e afasia ou agnosia, conforme o lado da hemiparesia.',
  itens: [
    { tipo: 'escolha', id: 'face', rotulo: 'Paralisia facial', ajuda: 'Peça para mostrar os dentes.', opcoes: [
      { rotulo: 'Ausente: movimento simétrico (NIHSS 0)', valor: 0 },
      { rotulo: 'Leve: um pouco assimétrico (NIHSS 1)', valor: 1 },
      { rotulo: 'Moderada a grave: totalmente assimétrico (NIHSS 2–3)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'braco', rotulo: 'Função motora do braço', ajuda: 'Estenda o braço do paciente a 90° (sentado) ou 45° (deitado).', opcoes: [
      { rotulo: 'Normal a leve: mantém mais de 10 segundos (NIHSS 0–1)', valor: 0 },
      { rotulo: 'Moderada: mantém menos de 10 segundos (NIHSS 2)', valor: 1 },
      { rotulo: 'Grave: não eleva o braço contra a gravidade (NIHSS 3–4)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'perna', rotulo: 'Função motora da perna', ajuda: 'Estenda a perna do paciente a 30°, deitado.', opcoes: [
      { rotulo: 'Normal a leve: mantém mais de 5 segundos (NIHSS 0–1)', valor: 0 },
      { rotulo: 'Moderada: mantém menos de 5 segundos (NIHSS 2)', valor: 1 },
      { rotulo: 'Grave: não eleva a perna contra a gravidade (NIHSS 3–4)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'olhar', rotulo: 'Desvio da cabeça e do olhar', ajuda: 'Observe desvio dos olhos e da cabeça para um lado.', opcoes: [
      { rotulo: 'Ausente: olha para os dois lados, sem desvio da cabeça (NIHSS 0)', valor: 0 },
      { rotulo: 'Presente: olhos e cabeça desviados para um lado (NIHSS 1–2)', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'cortical', rotulo: 'Afasia (hemiparesia direita) ou agnosia (hemiparesia esquerda)',
      ajuda: 'Hemiparesia direita, afasia: peça "feche os olhos" e "faça um punho". Hemiparesia esquerda, agnosia: mostrando o braço parético, pergunte "de quem é este braço?" e peça "levante os dois braços e bata palmas", para ver se reconhece o braço e o déficit.',
      opcoes: [
        { rotulo: 'Afasia: faz as 2 tarefas · Agnosia: reconhece o braço e o déficit (NIHSS 0)', valor: 0 },
        { rotulo: 'Afasia: faz 1 tarefa · Agnosia: não reconhece o braço ou o déficit (NIHSS 1)', valor: 1 },
        { rotulo: 'Afasia: não faz nenhuma · Agnosia: não reconhece o braço nem o déficit (NIHSS 2)', valor: 2 },
      ] },
  ],
  calcular(r) {
    const e = race
    if (!completo(e, r)) return null
    const p = somar(e, r)
    const alto = p >= 5
    return {
      rotulo: 'RACE',
      valor: `${p}`,
      unidade: 'de 9',
      nota: alto ? '5 ou mais: no estudo, corte com sensibilidade 0,85 e VPP 0,42 para oclusão de grande vaso' : 'abaixo de 5: no estudo, VPN 0,94 do corte de 5 para oclusão de grande vaso',
      estado: alto ? 2 : 0,
      derivados: [
        ['Corte de 5 ou mais no estudo (o melhor)', desempenho(CORTES[5])],
        ...(p >= 1 && p !== 5 ? [[`Corte de ${p} ou mais no estudo`, desempenho(CORTES[p])] as [string, string]] : []),
      ],
      alerta: alto ? 'Com 5 ou mais, 19% dos pacientes do estudo fizeram tratamento endovascular, contra 2% abaixo de 5. Registre a hora do último momento visto bem.' : undefined,
      cuidados: [
        'Não substitui a angiotomografia: com o corte de 5, 15 em cada 100 oclusões ficaram abaixo dele no estudo, e menos da metade dos que pontuaram 5 ou mais tinha oclusão.',
        'Pontuação alta também aparece no AVC hemorrágico grave: no estudo, parte dos pacientes com escore alto tinha hemorragia (Figura 2).',
        'Desenhada no AVC isquêmico de circulação anterior; a validação teve poucos casos de circulação posterior. Em metade dos pacientes a oclusão foi vista pelo Doppler transcraniano.',
        'No estudo, a escala foi aplicada em campo por técnicos de emergência treinados; nos AVCs do hemisfério direito (agnosia), o valor preditivo foi menor.',
      ],
    }
  },
}
