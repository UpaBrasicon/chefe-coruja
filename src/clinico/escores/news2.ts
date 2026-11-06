import { completo, escolha, numero, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'
import { faixaNews2, pontosNews2 } from '../news2.ts'

// NEWS2 da Central. Pela Surviving Sepsis Campaign 2026, é uma das ferramentas
// recomendadas para rastrear sepse no paciente agudo (no lugar do qSOFA).
// A resposta clínica de cada faixa é do protocolo da unidade, não desta tela.
// Versão de 06/11/2026 (revisão PubMed, itens médios; RT, H14 = A): nota da
// versão brasileira oficial e da validação dela no pronto-socorro, pelos
// resumos. Os rótulos não mudam aqui: o alinhamento à versão oficial é tarefa à
// parte, com a enfermagem. Cortes e pontos não mudam.

export const NEWS2_BRASIL_2020: Fonte = {
  citacao: 'Oliveira APA, Urbanetto JS, Caregnato RCA. National Early Warning Score 2: transcultural adaptation to Brazilian Portuguese. Rev Gaúcha Enferm. 2020;41:e20190424 (PMID 33111761).',
  url: 'https://doi.org/10.1590/1983-1447.2020.20190424',
}

export const NEWS2_BRASIL_SEPSE_2025: Fonte = {
  citacao: 'Sousa AS, Soares GDR, Costa JPD, et al. Predictive performance of the National Early Warning Score 2- Brazilian Version for septic patients. Rev Gaúcha Enferm. 2025;46:e20240233 (PMID 40767651).',
  url: 'https://doi.org/10.1590/1983-1447.2025.20240233.en',
}

export const NOTA_NEWS2_BRASIL =
  'Versão brasileira oficial: o NEWS2 tem adaptação transcultural para o português do Brasil, autorizada pelo Royal College of Physicians (Rev Gaúcha Enferm 2020). Num pronto-socorro do Sul do Brasil (2025; 295 adultos com sepse suspeita ou confirmada), a versão brasileira previu deterioração clínica com AUC de 0,703 na classificação de risco e de 0,871 na última avaliação antes da transferência, e mortalidade hospitalar com AUC de 0,770 nessa última avaliação. Os rótulos desta tela ainda não foram alinhados aos da versão oficial (tarefa à parte, com a enfermagem); cortes e pontos são os do RCP 2017.'

export const news2: Escore = {
  ficha: {
    id: 'news2',
    titulo: 'NEWS2 — escore de alerta precoce',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Royal College of Physicians. National Early Warning Score (NEWS) 2: Standardising the assessment of acute-illness severity in the NHS. London: RCP; 2017.' },
      { citacao: 'Prescott HC, Antonelli M, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Crit Care Med. 2026.', url: 'https://doi.org/10.1097/CCM.0000000000007075' },
      NEWS2_BRASIL_2020,
      NEWS2_BRASIL_SEPSE_2025,
    ],
    revisadoEm: '06/11/2026 (nota da versão brasileira oficial, rótulos sem mudança; revisão PubMed, itens médios; mesmos cortes da acuidade do prontuário desde 27/09/2026)',
  },
  descricao: 'Sete parâmetros à beira do leito; na SSC 2026, ferramenta de rastreio de sepse no lugar do qSOFA',
  itens: [
    { tipo: 'numero', id: 'fr', rotulo: 'Frequência respiratória', unidade: 'irpm', min: 0, max: 80, passo: 1 },
    { tipo: 'numero', id: 'spo2', rotulo: 'Saturação de O₂', unidade: '%', min: 40, max: 100, passo: 1 },
    { tipo: 'escolha', id: 'escala', rotulo: 'Escala de SpO₂', ajuda: 'A escala 2 é só para hipercapnia documentada, com alvo de 88–92% definido pelo médico.', opcoes: [
      { rotulo: 'Escala 1 (padrão)', valor: 0 }, { rotulo: 'Escala 2 (hipercapnia, alvo 88–92%)', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'o2', rotulo: 'Oxigênio suplementar', opcoes: [{ rotulo: 'Ar ambiente', valor: 0 }, { rotulo: 'Em oxigênio', valor: 1 }] },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão sistólica', unidade: 'mmHg', min: 30, max: 300, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 10, max: 300, passo: 1 },
    { tipo: 'escolha', id: 'consciencia', rotulo: 'Consciência (ACVPU)', opcoes: [
      { rotulo: 'Alerta', valor: 0 }, { rotulo: 'Confusão nova, responde à voz, à dor ou sem resposta', valor: 1 },
    ] },
    { tipo: 'numero', id: 'temp', rotulo: 'Temperatura', unidade: '°C', min: 25, max: 45, passo: 0.1 },
  ],
  calcular(r) {
    if (!completo(news2, r)) return null
    const p = pontosNews2({
      fr: numero(news2, r, 'fr')!,
      spo2: numero(news2, r, 'spo2')!,
      escala2: escolha(news2, r, 'escala')!.valor === 1,
      oxigenio: escolha(news2, r, 'o2')!.valor === 1,
      pas: numero(news2, r, 'pas')!,
      fc: numero(news2, r, 'fc')!,
      alerta: escolha(news2, r, 'consciencia')!.valor === 0,
      temp: numero(news2, r, 'temp')!,
    })
    const f = faixaNews2(p)
    return {
      rotulo: 'NEWS2',
      valor: String(f.total),
      unidade: 'pontos',
      nota: 'faixa ' + f.rotulo,
      estado: f.banda,
      derivados: [
        ['Frequência respiratória', `+${p.fr}`],
        ['Saturação de O₂', `+${p.spo2}`],
        ['Oxigênio suplementar', `+${p.oxigenio}`],
        ['Pressão sistólica', `+${p.pas}`],
        ['Frequência cardíaca', `+${p.fc}`],
        ['Consciência', `+${p.consciencia}`],
        ['Temperatura', `+${p.temp}`],
        ['Faixas do RCP', '0–4 baixa · 3 em um parâmetro baixa-média · 5–6 média · 7 ou mais alta'],
      ],
      alerta: f.maior === 3 && f.total < 5 ? 'Um parâmetro isolado marcou 3 pontos: a faixa sobe mesmo com total baixo.' : undefined,
      cuidados: [
        'Rastreio de sepse: a Surviving Sepsis Campaign 2026 recomenda NEWS, NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única (recomendação forte, certeza moderada). NEWS2 alto em paciente com infecção suspeita pede a avaliação de sepse — o critério é o SOFA (ferramenta Sepse no adulto).',
        'A resposta de cada faixa (frequência de reavaliação, acionamento) é do protocolo da unidade.',
        'Escala de adulto: não se aplica a menores de 14 anos (na pediatria, PEWS) nem à gestante (escore obstétrico próprio).',
        'A acuidade do prontuário calcula o NEWS2 com a escala 1; a escala 2 só está nesta tela.',
        NOTA_NEWS2_BRASIL,
      ],
    }
  },
}
