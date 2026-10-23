import { completo, escolha, numero, type Escore, type Respostas } from '../escore.ts'

// Sgarbossa modificado (Smith) — lacunas da Central, lote 2 (23/10/2026).
// Conferido no texto dos resumos:
//   • Sgarbossa 1996: supra de ST de 1 mm ou mais concordante com o QRS; infra
//     de ST de 1 mm ou mais em V1, V2 ou V3; supra de 5 mm ou mais discordante.
//   • Smith 2012: o 3º critério passa a ser proporcional (ST/S de −0,25 ou
//     menos), a regra não é ponderada (basta 1 de 3); ST medido em relação ao
//     segmento PR, R ou S (o mais proeminente) ao 0,5 mm; a razão só conta em
//     derivação com desvio discordante de 1 mm ou mais.
//   • Meyers 2015 (validação): "pelo menos 1 mm de supra e ST/S ≤ −0,25".
//   • Dodd 2021: os mesmos critérios no ritmo de marca-passo ventricular.
// O manual do HC (p. 213) descreve a versão modificada com discordância "acima de
// 30%"; o corte das fontes primárias é 25% e é o que a regra usa (divergência na
// nota). Como os demais escores (ADR 0007): regra positiva ou negativa, sem ordem.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)!.valor === 1

/** Corte da razão ST/S (Smith 2012): supra discordante de 25% ou mais da onda S. */
export const CORTE_ST_S = 0.25

/** Razão ST/S com sinal (supra discordante sobre onda S negativa dá valor negativo). */
export function razaoStS(supraMm: number, sMm: number): number | null {
  if (!(Number.isFinite(supraMm) && Number.isFinite(sMm)) || supraMm <= 0 || sMm <= 0) return null
  return -supraMm / sMm
}

/** 3º critério modificado: supra discordante de 1 mm ou mais e ST/S de −0,25 ou menos. */
export function discordanteExcessivo(supraMm: number, sMm: number): boolean {
  const r = razaoStS(supraMm, sMm)
  return r !== null && supraMm >= 1 && r <= -CORTE_ST_S
}

export const sgarbossaModificado: Escore = {
  ficha: {
    id: 'sgarbossa-modificado',
    titulo: 'Sgarbossa modificado (Smith) — BRE ou marca-passo',
    versao: '2026-10-23.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Smith SW, Dodd KW, Henry TD, Dvorak DM, Pearce LA. Diagnosis of ST-elevation myocardial infarction in the presence of left bundle branch block with the ST-elevation to S-wave ratio in a modified Sgarbossa rule. Ann Emerg Med. 2012;60(6):766–776 (PMID 22939607): ST/S ≤ −0,25, regra não ponderada; sensibilidade 91%, especificidade 90%.', url: 'https://doi.org/10.1016/j.annemergmed.2012.07.119' },
      { citacao: 'Sgarbossa EB, Pinski SL, Barbagelata A, et al. Electrocardiographic diagnosis of evolving acute myocardial infarction in the presence of left bundle-branch block. N Engl J Med. 1996;334(8):481–487 (PMID 8559200): os critérios concordantes.', url: 'https://doi.org/10.1056/NEJM199602223340801' },
      { citacao: 'Meyers HP, Limkakeng AT, Jaffa EJ, et al. Validation of the modified Sgarbossa criteria for acute coronary occlusion in the setting of left bundle branch block. Am Heart J. 2015;170(6):1255–1264 (PMID 26678648): sensibilidade 80%, especificidade 99%.', url: 'https://doi.org/10.1016/j.ahj.2015.09.005' },
      { citacao: 'Dodd KW, Zvosec DL, Hart MA, et al. Electrocardiographic diagnosis of acute coronary occlusion myocardial infarction in ventricular paced rhythm using the modified Sgarbossa criteria. Ann Emerg Med. 2021;78(4):517–529 (PMID 34172301): sensibilidade 81%, especificidade 96% no marca-passo.', url: 'https://doi.org/10.1016/j.annemergmed.2021.03.036' },
      { citacao: 'Lindow T, Mokhtari A, Nyström A, et al. Comparison of diagnostic accuracy of current left bundle branch block and ventricular pacing ECG criteria for detection of occlusion myocardial infarction. Int J Cardiol. 2023;395:131569 (PMID 37931659): no PS com baixa prevalência, VPP 9,4% e VPN acima de 98%.', url: 'https://doi.org/10.1016/j.ijcard.2023.131569' },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 2; critérios conferidos no texto das fontes)',
  },
  descricao: 'BRE ou ritmo de marca-passo ventricular com suspeita de SCA: três critérios de ECG; basta um.',
  itens: [
    { tipo: 'escolha', id: 'ritmo', rotulo: 'Ritmo de base', ajuda: 'Bloqueio de ramo esquerdo ou ritmo de marca-passo ventricular.', opcoes: [{ rotulo: 'BRE', valor: 0 }, { rotulo: 'Marca-passo', valor: 1 }] },
    { tipo: 'escolha', id: 'supraConcordante', rotulo: 'Supra de ST concordante de 1 mm ou mais', ajuda: 'No mesmo sentido do QRS, em pelo menos uma derivação.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'infraV1V3', rotulo: 'Infra de ST de 1 mm ou mais em V1, V2 ou V3', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'supraDiscordante', rotulo: 'Supra de ST discordante de 1 mm ou mais', ajuda: 'Em sentido oposto ao QRS. Se sim, informe abaixo a derivação com a maior proporção.', opcoes: NAO_SIM },
    { tipo: 'numero', id: 'supraMm', rotulo: 'Supra de ST nessa derivação', unidade: 'mm', min: 0, max: 30, passo: 0.5, opcional: true, ajuda: 'No ponto J, em relação ao segmento PR.' },
    { tipo: 'numero', id: 'sMm', rotulo: 'Profundidade da onda S na mesma derivação', unidade: 'mm', min: 0, max: 60, passo: 0.5, opcional: true },
  ],
  calcular(r) {
    const e = sgarbossaModificado
    if (!completo(e, r)) return null
    const discordante = sim(e, r, 'supraDiscordante')
    const supra = numero(e, r, 'supraMm')
    const s = numero(e, r, 'sMm')
    if (discordante && (supra === undefined || s === undefined || razaoStS(supra, s) === null)) return null
    const razao = discordante ? razaoStS(supra!, s!) : null
    const c3 = discordante && discordanteExcessivo(supra!, s!)
    const criterios = [
      sim(e, r, 'supraConcordante') && 'supra concordante',
      sim(e, r, 'infraV1V3') && 'infra em V1–V3',
      c3 && 'supra discordante com ST/S ≤ −0,25',
    ].filter(Boolean) as string[]
    const mp = escolha(e, r, 'ritmo')!.valor === 1
    const positivo = criterios.length > 0
    return {
      rotulo: 'Sgarbossa modificado',
      valor: positivo ? 'Positivo' : 'Negativo',
      nota: positivo
        ? `${criterios.join('; ')}: nos estudos, sugere oclusão coronariana aguda (equivalente de IAM com supra)`
        : 'nenhum critério: a regra não sugere oclusão coronariana aguda, mas não a descarta sozinha',
      estado: positivo ? 2 : 0,
      derivados: [
        ['Critérios presentes', `${criterios.length} de 3`],
        ...(razao !== null ? [['Razão ST/S', razao.toFixed(2).replace('.', ',').replace('-', '−')] as [string, string]] : []),
        mp
          ? ['Desempenho no marca-passo (Dodd 2021)', 'sensibilidade 81%, especificidade 96% contra pacientes do PS']
          : ['Desempenho no BRE', 'derivação: sensibilidade 91%, especificidade 90%; validação: 80% e 99%'],
      ],
      cuidados: [
        'O manual do HC (cap. 14, p. 213) lista o BRE e o marca-passo com Sgarbossa positivo entre os equivalentes de IAM com supra; pelo consenso europeu citado no capítulo, angioplastia primária, e não trombólise.',
        'O manual descreve a versão modificada com discordância "acima de 30%"; as fontes primárias (Smith 2012, Meyers 2015) usam 25%, que é o corte aqui.',
        'No PS com poucos casos de oclusão, o valor preditivo positivo foi baixo (9,4%) e o negativo, alto (acima de 98%): o ECG sozinho não basta (Lindow 2023).',
        ...(mp ? ['No marca-passo, somar infra concordante em V4–V6 elevou a sensibilidade para 86% (Dodd 2021); não faz parte da regra.'] : []),
      ],
    }
  },
}
