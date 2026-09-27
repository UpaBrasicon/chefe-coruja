import { completo, escolha, numero, somar, type Escore, type Respostas } from '../escore.ts'

// Sepse no adulto: qSOFA, SOFA e lactato numa ferramenta só, como no protótipo
// (infectologia/Sepse — adulto, construído em 30/08/2026): o lactato de 2 mmol/L
// integra a definição de choque séptico que o SOFA usa. Saíram (ADR 0007) o
// "tempo-alvo de antibiótico", a orientação de volume no alerta de clareamento
// e os cuidados de tipo de solução e alvo de ressuscitação. Fica o SOFA, o
// critério Sepsis-3, o critério de choque e o clareamento com a referência.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const SOFA = ['resp', 'coag', 'hep', 'cv', 'snc', 'renal']
const QSOFA = ['qGlasgow', 'qFr', 'qPas']
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')

/** Número opcional digitado fora da faixa: não se ignora em silêncio. */
const opcionalInvalido = (r: Respostas, id: string) => r[id] !== undefined && numero(sepseAdulto, r, id) === undefined

export const sepseAdulto: Escore = {
  ficha: {
    id: 'sepse-adulto',
    titulo: 'Sepse no adulto — qSOFA, SOFA e lactato',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Singer M, Deutschman CS, Seymour CW, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801–810.', url: 'https://doi.org/10.1001/jama.2016.0287' },
      { citacao: 'Prescott HC, Antonelli M, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. SCCM/IDSA. 2026.', url: 'https://www.sccm.org/survivingsepsiscampaign' },
      { citacao: 'Meyer NJ, Prescott HC. Sepsis and septic shock. N Engl J Med. 2024;391(22):2133–2146.', url: 'https://doi.org/10.1056/NEJMra2403213' },
      { citacao: 'ANDROMEDA-SHOCK-2 Investigators. Peripheral perfusion-targeted resuscitation in septic shock. JAMA. 2025.', url: 'https://doi.org/10.1001/jama.2025.0084' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Sinal de alerta qSOFA, disfunção orgânica pelo SOFA e clareamento de lactato',
  itens: [
    { tipo: 'escolha', id: 'qGlasgow', rotulo: 'qSOFA · Glasgow abaixo de 15', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'qFr', rotulo: 'qSOFA · Frequência respiratória de 22/min ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'qPas', rotulo: 'qSOFA · Pressão sistólica de 100 mmHg ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'resp', rotulo: 'SOFA · Respiratório · PaO₂/FiO₂', opcoes: [
      { rotulo: '400 ou mais', valor: 0 }, { rotulo: 'Abaixo de 400', valor: 1 }, { rotulo: 'Abaixo de 300', valor: 2 },
      { rotulo: 'Abaixo de 200, com suporte ventilatório', valor: 3 }, { rotulo: 'Abaixo de 100, com suporte ventilatório', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'coag', rotulo: 'SOFA · Coagulação · plaquetas (×10³/µL)', opcoes: [
      { rotulo: '150 ou mais', valor: 0 }, { rotulo: 'Abaixo de 150', valor: 1 }, { rotulo: 'Abaixo de 100', valor: 2 },
      { rotulo: 'Abaixo de 50', valor: 3 }, { rotulo: 'Abaixo de 20', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'hep', rotulo: 'SOFA · Hepático · bilirrubina (mg/dL)', opcoes: [
      { rotulo: 'Abaixo de 1,2', valor: 0 }, { rotulo: '1,2 a 1,9', valor: 1 }, { rotulo: '2,0 a 5,9', valor: 2 },
      { rotulo: '6,0 a 11,9', valor: 3 }, { rotulo: '12,0 ou mais', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'cv', rotulo: 'SOFA · Cardiovascular', opcoes: [
      { rotulo: 'PAM de 70 mmHg ou mais', valor: 0 }, { rotulo: 'PAM abaixo de 70 mmHg', valor: 1 },
      { rotulo: 'Dopamina até 5, ou dobutamina em qualquer dose', valor: 2 },
      { rotulo: 'Dopamina acima de 5, ou nora/adrenalina até 0,1', valor: 3 },
      { rotulo: 'Dopamina acima de 15, ou nora/adrenalina acima de 0,1', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'snc', rotulo: 'SOFA · Neurológico · Glasgow', opcoes: [
      { rotulo: '15', valor: 0 }, { rotulo: '13 a 14', valor: 1 }, { rotulo: '10 a 12', valor: 2 },
      { rotulo: '6 a 9', valor: 3 }, { rotulo: 'Abaixo de 6', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'renal', rotulo: 'SOFA · Renal · creatinina (mg/dL) ou diurese', opcoes: [
      { rotulo: 'Creatinina abaixo de 1,2', valor: 0 }, { rotulo: '1,2 a 1,9', valor: 1 }, { rotulo: '2,0 a 3,4', valor: 2 },
      { rotulo: '3,5 a 4,9, ou diurese abaixo de 500 mL/dia', valor: 3 }, { rotulo: '5,0 ou mais, ou diurese abaixo de 200 mL/dia', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'vaso', rotulo: 'Vasopressor para manter PAM de 65 mmHg', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'volume', rotulo: 'Ressuscitação volêmica inicial já feita', opcoes: NAO_SIM },
    { tipo: 'numero', id: 'lac', rotulo: 'Lactato atual', unidade: 'mmol/L', min: 0, max: 30, passo: 0.1, opcional: true, ajuda: 'Se o laudo vier em mg/dL, divida por 9 para chegar a mmol/L.' },
    { tipo: 'numero', id: 'lacAnt', rotulo: 'Lactato anterior', unidade: 'mmol/L', min: 0, max: 30, passo: 0.1, opcional: true, ajuda: 'Deixe em branco se esta é a primeira medida.' },
    { tipo: 'numero', id: 'horas', rotulo: 'Intervalo entre as duas medidas', unidade: 'h', min: 0.1, max: 72, passo: 0.5, opcional: true, ajuda: 'Em branco, conta 2 horas.' },
  ],
  calcular(r) {
    if (!completo(sepseAdulto, r)) return null
    if (opcionalInvalido(r, 'lac') || opcionalInvalido(r, 'lacAnt') || opcionalInvalido(r, 'horas')) return null
    const sofa = somar(sepseAdulto, r, SOFA)
    const nQ = somar(sepseAdulto, r, QSOFA)
    const sepse = sofa >= 2
    const vaso = escolha(sepseAdulto, r, 'vaso')!.valor === 1
    const vol = escolha(sepseAdulto, r, 'volume')!.valor === 1
    const lac = numero(sepseAdulto, r, 'lac')
    const lacAnt = numero(sepseAdulto, r, 'lacAnt')
    const lacAlto = lac !== undefined && lac >= 2
    const choque = sepse && vaso && lacAlto && vol
    // Clareamento: referência de queda de 10% a cada 2 h (protótipo, SSC 2026).
    const temPar = lac !== undefined && lacAnt !== undefined && lacAnt > 0
    const clar = temPar ? ((lacAnt - lac) / lacAnt) * 100 : NaN
    const h = numero(sepseAdulto, r, 'horas')
    const hrs = h !== undefined && h > 0 ? h : 2
    const metaOk = Number.isFinite(clar) && clar >= 10 * (hrs / 2)
    const banda = choque ? 2 : sepse ? 1 : 0
    return {
      rotulo: choque ? 'Choque séptico' : sepse ? 'Sepse' : 'SOFA',
      valor: String(sofa),
      unidade: 'de 24',
      nota: choque
        ? 'vasopressor e lactato de ' + fmt(lac!) + ' após ressuscitação'
        : sepse ? 'disfunção orgânica de 2 pontos ou mais — sepse, se houver infecção' : 'sem disfunção suficiente para sepse pelo SOFA',
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['qSOFA', nQ + ' de 3 · ' + (nQ >= 2 ? 'positivo — sinal de alerta' : 'negativo, o que NÃO afasta sepse')],
        ['Critério de sepse', 'infecção suspeita ou confirmada mais SOFA de 2 ou mais · Sepsis-3'],
        ['Critério de choque séptico', 'sepse mais vasopressor para PAM de 65 mais lactato de 2 ou mais, após ressuscitação'],
        ['Lactato atual', lac === undefined ? 'não informado — o critério de choque séptico depende dele' : fmt(lac) + ' mmol/L' + (lacAlto ? ' · acima do limiar de choque' : ' · abaixo do limiar')],
        ['Clareamento', temPar ? fmt(clar) + '% em ' + fmt(hrs) + ' h · referência de 10% a cada 2 h · ' + (metaOk ? 'referência atingida' : 'ABAIXO da referência') : 'sem medida anterior'],
        ['Sistemas com disfunção', SOFA.filter((k) => (escolha(sepseAdulto, r, k)?.valor ?? 0) > 0).length + ' de 6'],
      ],
      alerta: nQ >= 2 && !sepse
        ? 'qSOFA positivo com SOFA abaixo de 2. O qSOFA é sinal de alerta, não critério de sepse — e não é ferramenta de rastreio isolada. Complete os exames do SOFA antes de descartar.'
        : temPar && !metaOk && sepse
          ? 'Clareamento de lactato abaixo da referência de 10% a cada 2 horas.'
          : sepse && vaso && lacAlto && !vol
            ? 'Falta marcar se a ressuscitação volêmica inicial já foi feita. O critério de choque séptico exige lactato de 2 ou mais DEPOIS dela — antes disso, o lactato alto pode ser só hipovolemia.'
            : undefined,
      cuidados: [
        'A Surviving Sepsis Campaign recomenda CONTRA o qSOFA como ferramenta única de rastreio, em favor de SIRS, NEWS ou MEWS. O qSOFA aqui existe como sinal de alerta.',
        'O SOFA mede DELTA: em paciente com disfunção crônica prévia, o que conta é o aumento em relação ao basal, e esta tela assume basal zero.',
        'Na criança este escore NÃO se aplica: a referência é o Phoenix. O limiar de lactato pediátrico permanece incerto na literatura.',
      ],
    }
  },
}
