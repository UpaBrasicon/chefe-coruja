import { completo, escolha, type Escore, type Respostas } from '../escore.ts'

// Regras de Ottawa (lacunas da Central, lote 1, 23/10/2026). Conferidas no texto:
//   • tornozelo e pé (versão refinada de Stiell 1993): dor na zona maleolar com
//     dor à palpação na borda posterior dos 6 cm distais da fíbula ou da tíbia,
//     ou incapacidade de dar 4 passos logo após o trauma e na avaliação; dor no
//     mediopé com dor à palpação na base do 5º metatarso ou no navicular, ou a
//     mesma incapacidade (Schiper 2023, Tabela 1; Anwar 2025; Yazdani 2006 para
//     as zonas). A "ponta" do maléolo não foi confirmada e não entra.
//   • joelho (Stiell 1995): 55 anos ou mais, dor à palpação da cabeça da fíbula,
//     dor isolada na patela, não flete a 90°, não dá 4 passos logo após o trauma
//     e na avaliação.
// Como no Canadian CT Head (ADR 0007): regra positiva ou negativa, sem "pedir
// radiografia" como ordem; o que a regra prediz vai na nota.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)!.valor === 1

export const ottawaTornozelo: Escore = {
  ficha: {
    id: 'ottawa-tornozelo-pe',
    titulo: 'Regras de Ottawa — tornozelo e pé (adulto)',
    versao: '2026-10-23.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Stiell IG, Greenberg GH, McKnight RD, et al. Decision rules for the use of radiography in acute ankle injuries. Refinement and prospective validation. JAMA. 1993;269(9):1127–1132 (PMID 8433468).', url: 'https://doi.org/10.1001/jama.269.9.1127' },
      { citacao: 'Bachmann LM, Kolb E, Koller MT, Steurer J, ter Riet G. Accuracy of Ottawa ankle rules to exclude fractures of the ankle and mid-foot: systematic review. BMJ. 2003;326(7386):417 (PMID 12595378): LR− 0,08 no tornozelo e no mediopé.', url: 'https://doi.org/10.1136/bmj.326.7386.417' },
      { citacao: 'Schiper SP, Rodrigues HM, Reis JELE, et al. Implementation of Ottawa ankle rules in university hospital emergency room: pilot study. Acta Ortop Bras. 2023;31(5):e266034 (PMID 37876862), Tabela 1: os critérios.', url: 'https://doi.org/10.1590/1413-785220233105e266034' },
      { citacao: 'Yazdani S, Jahandideh H, Ghofrani H. Validation of the Ottawa Ankle Rules in Iran. BMC Emerg Med. 2006;6:3 (PMID 16480520): as zonas maleolar e do mediopé.', url: 'https://doi.org/10.1186/1471-227X-6-3' },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 1; critérios conferidos no texto da fonte)',
  },
  descricao: 'Trauma agudo de tornozelo ou pé: duas regras (tornozelo e mediopé), cada uma com a sua zona de dor.',
  itens: [
    { tipo: 'escolha', id: 'zonaMaleolar', rotulo: 'Dor na zona maleolar', ajuda: '6 cm distais da fíbula e da tíbia, e o tálus.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fibula', rotulo: 'Dor à palpação na borda posterior dos 6 cm distais da fíbula (maléolo lateral)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'tibia', rotulo: 'Dor à palpação na borda posterior dos 6 cm distais da tíbia (maléolo medial)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'zonaMediope', rotulo: 'Dor no mediopé', ajuda: 'Navicular, cuboide, cuneiformes, processo anterior do calcâneo e base do 5º metatarso.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'quintoMetatarso', rotulo: 'Dor à palpação na base do 5º metatarso', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'navicular', rotulo: 'Dor à palpação no navicular', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'carga', rotulo: 'Não consegue dar 4 passos logo após o trauma e na avaliação', opcoes: NAO_SIM },
  ],
  calcular(r) {
    const e = ottawaTornozelo
    if (!completo(e, r)) return null
    const carga = sim(e, r, 'carga')
    const tornozelo = sim(e, r, 'zonaMaleolar') && (sim(e, r, 'fibula') || sim(e, r, 'tibia') || carga)
    const pe = sim(e, r, 'zonaMediope') && (sim(e, r, 'quintoMetatarso') || sim(e, r, 'navicular') || carga)
    const positivas = [tornozelo && 'tornozelo', pe && 'pé'].filter(Boolean) as string[]
    return {
      rotulo: 'Ottawa — tornozelo e pé',
      valor: positivas.length ? 'Regra positiva' : 'Regra negativa',
      nota: positivas.length
        ? `positiva para ${positivas.join(' e ')}: na regra, indica a radiografia dessa região`
        : 'negativa nas duas regiões: na regra, fratura improvável',
      estado: positivas.length ? 1 : 0,
      derivados: [
        ['Regra do tornozelo', tornozelo ? 'positiva' : 'negativa'],
        ['Regra do pé (mediopé)', pe ? 'positiva' : 'negativa'],
        ['Desempenho (revisão sistemática)', 'sensibilidade perto de 100%, LR− 0,08; especificidade modesta'],
      ],
      cuidados: [
        'A regra serve para descartar fratura, não para confirmar: a especificidade é baixa.',
        'Derivada e validada em adultos. As validações excluíram, entre outros, lesão com mais de 7 dias, politrauma e rebaixamento do nível de consciência.',
      ],
    }
  },
}

export const ottawaJoelho: Escore = {
  ficha: {
    id: 'ottawa-joelho',
    titulo: 'Regra de Ottawa — joelho (adulto)',
    versao: '2026-10-23.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Stiell IG, Greenberg GH, Wells GA, et al. Derivation of a decision rule for the use of radiography in acute knee injuries. Ann Emerg Med. 1995;26(4):405–413 (PMID 7574120).', url: 'https://doi.org/10.1016/s0196-0644(95)70106-0' },
      { citacao: 'Bachmann LM, Haberzeth S, Steurer J, ter Riet G. The accuracy of the Ottawa knee rule to rule out knee fractures: a systematic review. Ann Intern Med. 2004;140(2):121–124 (PMID 14734335): sensibilidade 98,5%, especificidade 48,6%, LR− 0,05.', url: 'https://doi.org/10.7326/0003-4819-140-5-200403020-00013' },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 1; critérios conferidos no texto da fonte)',
  },
  descricao: 'Trauma agudo de joelho: cinco critérios; um ou mais tornam a regra positiva.',
  itens: [
    { tipo: 'escolha', id: 'idade55', rotulo: 'Idade de 55 anos ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fibula', rotulo: 'Dor à palpação da cabeça da fíbula', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'patela', rotulo: 'Dor isolada à palpação da patela', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'flexao', rotulo: 'Não consegue fletir o joelho a 90°', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'carga', rotulo: 'Não consegue dar 4 passos logo após o trauma e na avaliação', opcoes: NAO_SIM },
  ],
  calcular(r) {
    const e = ottawaJoelho
    if (!completo(e, r)) return null
    const n = e.itens.filter((i) => sim(e, r, i.id)).length
    return {
      rotulo: 'Ottawa — joelho',
      valor: n ? 'Regra positiva' : 'Regra negativa',
      nota: n ? `${n} de 5 critérios: na regra, indica a radiografia do joelho` : 'nenhum critério: na regra, fratura improvável',
      estado: n ? 1 : 0,
      derivados: [
        ['Critérios presentes', `${n} de 5`],
        ['Desempenho (revisão sistemática)', 'sensibilidade 98,5%, especificidade 48,6%, LR− 0,05'],
      ],
      cuidados: [
        'A regra serve para descartar fratura; não avalia ligamento nem menisco.',
        'Derivada e revisada em adultos.',
      ],
    }
  },
}
