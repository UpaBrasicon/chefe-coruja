import { completo, numero, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// Critérios de Light: exsudato se qualquer um dos três for positivo, com o
// gradiente e a relação de albumina quando a albumina é informada. Porte do
// protótipo (pneumologia/Light, construído em 30/08/2026). Não havia conduta
// a retirar. A albumina é opcional; se digitada fora da faixa, não calcula.

const f2 = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '—')

// Lote 7 da revisão do HCFMUSP (Q2 = A, decisão do RT de 14/11/2026): a BTS 2023
// de doença pleural (versão resumida, lida no texto integral pelo Chrome do RT),
// ao lado do cap. 36 do manual do HC (p. 485–497, conferido no PDF).
export const BTS_PLEURA_2023: Fonte = {
  citacao: 'Roberts ME, Rahman NM, Maskell NA, et al. British Thoracic Society Guideline for pleural disease. Thorax. 2023;78(11):1143–1156 (PMID 37553157); versão completa em Thorax. 2023;78(Suppl 3):s1–s42 (PMID 37433578). Texto da versão resumida lido; GRADE e consenso.',
  url: 'https://doi.org/10.1136/thorax-2023-220304',
}

/** BTS 2023 × manual, no derrame pleural e na infecção pleural do adulto; grau como a diretriz escreve. */
export const DIRETRIZ_PLEURA_2023: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Toracocentese', diretriz: 'Sempre guiar a toracocentese por imagem, para reduzir complicações', grau: 'forte, por consenso', fonte: 'BTS 2023', livro: 'toracocentese guiada por ultrassom com análise do líquido (cap. 36, p. 485)' },
  { tema: 'Amostra', diretriz: 'Suspeita de derrame maligno: 25–50 mL para citologia. Suspeita de infecção: líquido em tubo seco e em frasco de hemocultura', grau: 'forte, por consenso', fonte: 'BTS 2023', livro: 'retirar 50–60 mL para celularidade, citologia, DHL, proteínas, glicose, pH, ADA, BAAR, bacterioscopia e culturas (cap. 36, p. 488)' },
  { tema: 'pH na hora', diretriz: 'Derrame parapneumônico ou suspeita de infecção pleural sem pus franco na punção: medir o pH imediatamente; amostra sem anestésico local nem heparina', grau: 'forte, por consenso', fonte: 'BTS 2023', livro: 'pH entre os exames do líquido (cap. 36, p. 488)' },
  { tema: 'pH do líquido e drenagem', diretriz: 'pH ≤ 7,2: alto risco de derrame parapneumônico complicado ou infecção pleural; drenar com dreno torácico se o volume acessível no ultrassom permitir com segurança. pH acima de 7,2 e abaixo de 7,4 (por exemplo, 7,3): risco intermediário; medir DHL e considerar drenagem se > 900 UI/L, sobretudo com febre que persiste, volume grande, glicose ≤ 4,0 mmol/L (72 mg/dL), realce pleural na TC ou septação no ultrassom. pH ≥ 7,4: baixo risco, sem indicação de dreno imediato; reavaliar e repetir a punção se for preciso', grau: 'forte, por consenso', fonte: 'BTS 2023', livro: 'pH < 7,2 indica drenagem no derrame parapneumônico; complicado também com glicose < 40 ou < 60 mg/dL, DHL > 1.000 U/L, bacterioscopia ou cultura positiva, ou pus (cap. 36, p. 491–492)' },
  { tema: 'Sem pH disponível', diretriz: 'Glicose do líquido < 3,3 mmol/L indica alta probabilidade de derrame complicado ou infecção e pode orientar a drenagem', grau: 'forte, por consenso', fonte: 'BTS 2023', livro: 'glicose < 60 mg/dL sugere parapneumônico complicado (cap. 36, p. 491)' },
  { tema: 'Calibre do dreno', diretriz: 'Drenar a infecção pleural com dreno fino (14F ou menor)', grau: 'condicional, por consenso', fonte: 'BTS 2023', livro: 'drenagem pleural fechada no parapneumônico complicado (cap. 36, p. 492)' },
  { tema: 'Terapia intrapleural', diretriz: 'TPA com DNase quando a drenagem para e sobra coleção; TPA ou DNase sozinhos e estreptoquinase não devem ser usados; lavagem com soro se TPA com DNase ou cirurgia não forem possíveis', grau: 'condicional, por consenso', fonte: 'BTS 2023', livro: 'trombolítico no dreno ou videotoracoscopia no parapneumônico com loculação e no empiema (cap. 36, p. 494)' },
  { tema: 'Prognóstico', diretriz: 'O escore RAPID (rim, idade, pus, origem da infecção, nutrição) pode estratificar o risco do adulto com infecção pleural', grau: 'condicional', fonte: 'BTS 2023', livro: 'o cap. 36 não trata do ponto' },
]

export const light: Escore = {
  ficha: {
    id: 'light',
    titulo: 'Critérios de Light — exsudato ou transudato',
    versao: '2026-11-14.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Light RW, Macgregor MI, Luchsinger PC, Ball WC. Pleural effusions: the diagnostic separation of transudates and exudates. Ann Intern Med. 1972;77(4):507–513.', url: 'https://doi.org/10.7326/0003-4819-77-4-507' },
      { citacao: 'Sundaralingam A, Grabczak EM, Burra P, et al. ERS statement on benign pleural effusions in adults. Eur Respir J. 2024.', url: 'https://doi.org/10.1183/13993003.02307-2023' },
      { citacao: 'Porcel JM. Biomarkers in the diagnosis of pleural diseases: a 2018 update. Ther Adv Respir Dis. 2018;12:1753466618808660. NT-proBNP no líquido pleural acima de 1500 pg/mL.', url: 'https://doi.org/10.1177/1753466618808660' },
      { citacao: 'Porcel JM, Porcel L, Palma R, Bielsa S. Revisiting Light’s criteria: a validated blood-free triple combination matches diagnostic accuracy in over 7000 patients. ERJ Open Res. 2026;12(2):00821-2025 (PMID 41846683). 7.280 toracocenteses: desempenho de Light e combinação tripla sem soro.', url: 'https://doi.org/10.1183/23120541.00821-2025' },
      { citacao: 'Porcel JM, Trujillano J, Porcel L, et al. Development and validation of a diagnostic prediction model for heart failure-related pleural effusions: the BANCA score. ERJ Open Res. 2025;11:01030-2024. Corte ótimo de NT-proBNP 2500 pg/mL.', url: 'https://doi.org/10.1183/23120541.01030-2024' },
      BTS_PLEURA_2023,
    ],
    revisadoEm: '14/11/2026 (BTS 2023 ao lado do manual do HC, cap. 36; lote 7 da revisão do HCFMUSP; aguarda aprovação do RT); 11/11/2026 (regra sem soro e desempenho pelo Porcel 2026, decisão H21 do RT)',
  },
  descricao: 'Exsudato ou transudato no derrame pleural, com o gradiente de albumina',
  itens: [
    { tipo: 'numero', id: 'protP', rotulo: 'Proteína total no líquido pleural', unidade: 'g/dL', min: 0, max: 20, passo: 0.1 },
    { tipo: 'numero', id: 'protS', rotulo: 'Proteína total no soro', unidade: 'g/dL', min: 0.1, max: 20, passo: 0.1 },
    { tipo: 'numero', id: 'ldhP', rotulo: 'LDH no líquido pleural', unidade: 'U/L', min: 0, max: 100000, passo: 1 },
    { tipo: 'numero', id: 'ldhS', rotulo: 'LDH no soro', unidade: 'U/L', min: 1, max: 100000, passo: 1 },
    { tipo: 'numero', id: 'ldhLSN', rotulo: 'Limite superior normal do LDH no seu laboratório', unidade: 'U/L', min: 1, max: 10000, passo: 1, ajuda: 'Está no cabeçalho do laudo. Varia entre laboratórios, e o terceiro critério depende dele.' },
    { tipo: 'numero', id: 'albS', rotulo: 'Albumina no soro', unidade: 'g/dL', min: 0.1, max: 10, passo: 0.1, opcional: true, ajuda: 'Para o gradiente, usado quando a clínica sugere transudato.' },
    { tipo: 'numero', id: 'albP', rotulo: 'Albumina no líquido pleural', unidade: 'g/dL', min: 0, max: 10, passo: 0.1, opcional: true },
  ],
  calcular(r) {
    if (!completo(light, r)) return null
    // albumina opcional: vazia é permitida, digitada fora da faixa não
    if (['albS', 'albP'].some((id) => r[id] !== undefined && numero(light, r, id) === undefined)) return null
    const n = (id: string) => numero(light, r, id) ?? NaN
    const rProt = n('protP') / n('protS')
    const rLdh = n('ldhP') / n('ldhS')
    const corte3 = (2 / 3) * n('ldhLSN')
    const c1 = rProt > 0.5
    const c2 = rLdh > 0.6
    const c3 = n('ldhP') > corte3
    const positivos = (c1 ? 1 : 0) + (c2 ? 1 : 0) + (c3 ? 1 : 0)
    const exsudato = positivos > 0
    // arredondado a 2 casas (o que a tela mostra): 3,2 − 2,0 não pode dar 1,2000000000000002 e passar do corte
    const grad = Math.round((n('albS') - n('albP')) * 100) / 100
    const gradTransuda = Number.isFinite(grad) && grad > 1.2
    const rAlb = n('albP') / n('albS')
    const pos = (c: boolean) => (c ? 'POSITIVO' : 'negativo')
    return {
      rotulo: 'Light',
      valor: exsudato ? 'Exsudato' : 'Transudato',
      nota: exsudato
        ? positivos + (positivos === 1 ? ' critério positivo' : ' critérios positivos') + ' de 3'
        : 'nenhum dos três critérios positivo',
      estado: exsudato ? 1 : 0,
      derivados: [
        ['1 · Proteína pleural ÷ sérica', f2(rProt) + ' · corte 0,50 · ' + pos(c1)],
        ['2 · LDH pleural ÷ sérico', f2(rLdh) + ' · corte 0,60 · ' + pos(c2)],
        ['3 · LDH pleural acima de 2/3 do LSN', f2(n('ldhP')) + ' contra ' + f2(corte3) + ' U/L · ' + pos(c3)],
        ['Gradiente de albumina soro − pleural', f2(grad) + ' g/dL · corte 1,2'],
        ['Relação albumina pleural ÷ sérica', f2(rAlb) + ' · abaixo de 0,60 confirma transudato na cirrose'],
        ['Desempenho', 'sensibilidade 98% · especificidade 69 a 71% (Porcel 2026, 7.280 toracocenteses) · parte dos transudatos vira exsudato'],
      ],
      alerta: exsudato && gradTransuda
        ? 'Os critérios de Light dizem EXSUDATO, mas o gradiente de albumina é ' + f2(grad) + ' g/dL, acima de 1,2. Se a clínica é de insuficiência cardíaca ou cirrose, este é provavelmente um FALSO EXSUDATO — o gradiente reclassifica corretamente cerca de 80% deles. Diurético em uso é a causa mais comum dessa discordância.'
        : exsudato && positivos === 1
          ? 'Só um dos três critérios é positivo. Exsudato por margem estreita, e é nessa faixa que o falso exsudato do paciente em diurético aparece — confira o gradiente de albumina.'
          : undefined,
      cuidados: [
        'Qualquer UM dos três critérios positivo classifica como exsudato. Não é preciso ter os três.',
        'O terceiro critério usa o limite superior da normalidade do LDH do seu laboratório. O antigo corte fixo de 200 U/L era o LSN de um laboratório específico, não uma constante.',
        'Sem amostra sérica, use a combinação tripla só do líquido pleural (Porcel 2026, 7.280 toracocenteses): proteína pleural acima de 3 g/dL OU LDH pleural acima de 2/3 do LSN do laboratório OU colesterol pleural acima de 55 mg/dL. A acurácia foi igual à de Light. A regra dupla (só LDH ou colesterol) deixou de achar exsudatos e não deve ser usada.',
        'NT-proBNP no líquido pleural acima de 1500 pg/mL (o mesmo que ng/L) é marca de insuficiência cardíaca descompensada (Porcel 2018).',
        'O escore BANCA (Porcel 2025) achou 2500 pg/mL como corte ótimo, e o NT-proBNP pleural tendeu a ser mais acurado que o sérico. É outro corte, de outro estudo.',
        'A ERS 2024 mantém os critérios de Light: nenhuma alternativa testada em cinco décadas os superou.',
        'Líquido pleural e soro coletados no mesmo dia.',
      ],
    }
  },
}
