import { completo, escolha, type Escore } from '../escore.ts'

// McIsaac (Centor modificado) na faringite (lacunas da Central, lote 1,
// 23/10/2026). Conferido no texto: 1 ponto para temperatura acima de 38 °C,
// ausência de tosse, adenopatia cervical anterior dolorosa e edema ou exsudato
// amigdaliano (Brennan-Krohn 2018); idade de 3 a 14 anos +1, 15 a 44 anos 0,
// 45 anos ou mais −1 (Fine 2012); escores −1 e 5 contados como 0 e 4 (Fine).
// A tabela de recomendação por escore do artigo original não está em texto
// acessível e não entra. O escore orienta o teste, não o antibiótico.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

export const mcisaac: Escore = {
  ficha: {
    id: 'mcisaac-centor',
    titulo: 'McIsaac (Centor modificado) — faringite',
    versao: '2026-10-23.1',
    publico: 'ambos',
    fontes: [
      { citacao: 'McIsaac WJ, White D, Tannenbaum D, Low DE. A clinical score to reduce unnecessary antibiotic use in patients with sore throat. CMAJ. 1998;158(1):75–83 (PMID 9475915): escore de 0 a 4, pacientes de 3 a 76 anos.', pediatrica: true },
      { citacao: 'Brennan-Krohn T, Ozonoff A, Sandora TJ. Adherence to guidelines for testing and treatment of children with pharyngitis. BMC Pediatr. 2018;18(1):43 (PMID 29426305): os itens; escore abaixo de 2 como risco muito baixo.', url: 'https://doi.org/10.1186/s12887-018-0988-z', pediatrica: true },
      { citacao: 'Fine AM, Nizet V, Mandl KD. Large-scale validation of the Centor and McIsaac scores to predict group A streptococcal pharyngitis. Arch Intern Med. 2012;172(11):847–852 (PMID 22566485): ajuste pela idade; não se aplica abaixo de 3 anos.', url: 'https://doi.org/10.1001/archinternmed.2012.950', pediatrica: true },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 1; itens conferidos no texto da fonte)',
  },
  descricao: 'Dor de garganta a partir de 3 anos: quatro achados e a idade; orienta o teste para estreptococo do grupo A.',
  itens: [
    { tipo: 'escolha', id: 'febre', rotulo: 'Temperatura acima de 38 °C', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'semTosse', rotulo: 'Ausência de tosse', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'adenopatia', rotulo: 'Adenopatia cervical anterior dolorosa', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'amigdala', rotulo: 'Edema ou exsudato amigdaliano', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [{ rotulo: '3 a 14 anos', valor: 1 }, { rotulo: '15 a 44 anos', valor: 0 }, { rotulo: '45 anos ou mais', valor: -1 }] },
  ],
  calcular(r) {
    const e = mcisaac
    if (!completo(e, r)) return null
    const bruto = e.itens.reduce((s, i) => s + (escolha(e, r, i.id)?.valor ?? 0), 0)
    const v = Math.max(0, Math.min(4, bruto))
    return {
      rotulo: 'McIsaac',
      valor: String(v),
      unidade: 'de 4',
      nota: v < 2 ? 'abaixo de 2: risco muito baixo de estreptococo do grupo A' : '2 ou mais: o teste para estreptococo do grupo A faz sentido',
      estado: v < 2 ? 0 : 1,
      derivados: [['Soma antes do ajuste', String(bruto)]],
      cuidados: [
        'Não se aplica abaixo de 3 anos.',
        'O escore orienta o teste rápido ou a cultura; não substitui o teste nem indica antibiótico sozinho.',
      ],
    }
  },
}
