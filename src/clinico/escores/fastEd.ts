import { completo, escolha, somar, type Escore } from '../escore.ts'

// FAST-ED (Field Assessment Stroke Triage for Emergency Destination): escores
// P2/P3, item E8; decisão A do RT em 11/11/2026, como a única escala de
// oclusão de grande vaso do app (o RACE saiu do backlog). Pontos conferidos na
// Tabela 1 do Lima 2016, no PDF publicado (Stroke 2016;47:1997–2002) e no
// manuscrito do PMC (PMC4961538), entregues pelo RT: cada item com a nota do
// NIHSS de onde vem. O "T" (tempo) é registro para a decisão e não pontua.
// Faixas de probabilidade (0–1, 2–3, ≥ 4) e desempenho do corte ≥ 4 do texto
// do mesmo artigo. Sem conduta (ADR 0007): a tela dá a pontuação e o que o
// estudo achou.

export const fastEd: Escore = {
  ficha: {
    id: 'fast-ed',
    titulo: 'FAST-ED — suspeita de oclusão de grande vaso no AVC',
    versao: '2026-11-11.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Lima FO, Silva GS, Furie KL, et al. Field Assessment Stroke Triage for Emergency Destination: A Simple and Accurate Prehospital Scale to Detect Large Vessel Occlusion Strokes. Stroke. 2016;47(8):1997–2002 (PMID 27364531; texto completo e Tabela 1 lidos): itens, pontos, faixas e desempenho (≥ 4: sensibilidade 0,60, especificidade 0,89, VPP 0,72, VPN 0,82).', url: 'https://doi.org/10.1161/STROKEAHA.116.013301' },
    ],
    revisadoEm: '11/11/2026 (escores P2/P3, item E8; Tabela 1 conferida no PDF do artigo)',
  },
  descricao: 'Cinco itens do NIHSS, de 0 a 9 pontos: face, braço, fala, olhar e negligência. O tempo é registrado e não pontua.',
  itens: [
    { tipo: 'escolha', id: 'face', rotulo: 'F — paralisia facial', opcoes: [
      { rotulo: 'Normal ou paralisia leve (NIHSS 0–1)', valor: 0 },
      { rotulo: 'Paralisia parcial ou completa (NIHSS 2–3)', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'braco', rotulo: 'A — fraqueza do braço', opcoes: [
      { rotulo: 'Sem queda (NIHSS 0)', valor: 0 },
      { rotulo: 'Queda ou algum esforço contra a gravidade (NIHSS 1–2)', valor: 1 },
      { rotulo: 'Sem esforço contra a gravidade ou sem movimento (NIHSS 3–4)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'fala', rotulo: 'S — alteração da fala', ajuda: 'O estudo conta a fluência e a compreensão.', opcoes: [
      { rotulo: 'Ausente (NIHSS 0)', valor: 0 },
      { rotulo: 'Leve a moderada (NIHSS 1)', valor: 1 },
      { rotulo: 'Grave, afasia global ou mudo (NIHSS 2–3)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'olhar', rotulo: 'E — desvio do olhar', opcoes: [
      { rotulo: 'Ausente (NIHSS 0)', valor: 0 },
      { rotulo: 'Parcial (NIHSS 1)', valor: 1 },
      { rotulo: 'Desvio forçado (NIHSS 2)', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'negligencia', rotulo: 'D — negação ou negligência', opcoes: [
      { rotulo: 'Ausente (NIHSS 0)', valor: 0 },
      { rotulo: 'Extinção à estimulação bilateral simultânea em só uma modalidade sensitiva (NIHSS 1)', valor: 1 },
      { rotulo: 'Não reconhece a própria mão ou se orienta só para um lado do corpo (NIHSS 2)', valor: 2 },
    ] },
  ],
  calcular(r) {
    const e = fastEd
    if (!completo(e, r)) return null
    const p = somar(e, r)
    const alto = p >= 4
    const meio = p >= 2 && p <= 3
    return {
      rotulo: 'FAST-ED',
      valor: `${p}`,
      unidade: 'de 9',
      nota: alto ? '4 ou mais: no estudo, cerca de 60% ou mais com oclusão de grande vaso' : meio ? '2 a 3: no estudo, cerca de 30% com oclusão de grande vaso' : '0 a 1: no estudo, menos de 15% com oclusão de grande vaso',
      estado: alto ? 2 : meio ? 1 : 0,
      derivados: [
        ['Corte de 4 ou mais no estudo', 'sensibilidade 0,60 · especificidade 0,89 · VPP 0,72 · VPN 0,82'],
        ...(escolha(e, r, 'olhar')!.valor > 0 || escolha(e, r, 'negligencia')!.valor > 0 ? [['Sinal cortical', 'olhar ou negligência pontuou'] as [string, string]] : []),
      ],
      alerta: alto ? 'Com 4 ou mais, o estudo achou mais oclusão proximal (carótida intracraniana e M1). Registre a hora do último momento visto bem.' : undefined,
      cuidados: [
        'Não substitui a angiotomografia: com o corte de 4, 4 em cada 10 oclusões ficaram abaixo dele no estudo.',
        'No estudo, a pontuação veio do NIHSS feito na admissão por equipe treinada, não em campo; a validação em campo não fazia parte do artigo.',
        'Poucos casos de oclusão da basilar no estudo.',
        'Registre a hora do último momento visto bem (o T da escala), que não pontua.',
      ],
    }
  },
}
