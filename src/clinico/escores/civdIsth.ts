import { completo, escolha, somar, type Escore } from '../escore.ts'

// CIVD manifesta pelo escore do ISTH: quatro parâmetros laboratoriais, com a
// doença de base como pré-requisito. Porte do protótipo (hematologia/CIVD —
// ISTH, construído em 02/09/2026). Saíram (ADR 0007) os grupos "tratamento" e
// "anticoagulação por fenótipo", as linhas e alertas de repetição/transfusão
// e os cuidados sobre hemocomponente e antifibrinolítico: fica o total, o
// corte de 5 e a leitura manifesta/não manifesta.

const PARAMETROS = ['plaq', 'dd', 'tp', 'fib']

export const civdIsth: Escore = {
  ficha: {
    id: 'civd-isth',
    titulo: 'CIVD manifesta — escore do ISTH',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Taylor FB Jr, Toh CH, Hoots WK, et al. Towards definition, clinical and laboratory criteria, and a scoring system for disseminated intravascular coagulation. Thromb Haemost. 2001;86(5):1327–1330.', url: 'https://doi.org/10.1055/s-0037-1616068' },
      { citacao: 'Wada H, Thachil J, Di Nisio M, et al. Guidance for diagnosis and treatment of disseminated intravascular coagulation from harmonization of the recommendations from three guidelines. J Thromb Haemost. 2013;11(4):761–767.', url: 'https://doi.org/10.1111/jth.12155' },
      { citacao: 'Levi M, Scully M. How I treat disseminated intravascular coagulation. Blood. 2018;131(8):845–854.', url: 'https://doi.org/10.1182/blood-2017-10-804096' },
      { citacao: 'UpToDate. Disseminated intravascular coagulation (DIC) in adults: Evaluation and management. (referência de escopo autorizada pelo usuário em 02/09/2026)', url: 'https://www.uptodate.com' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Quatro parâmetros laboratoriais, 0 a 8 pontos, com a doença de base como pré-requisito',
  itens: [
    { tipo: 'escolha', id: 'base', rotulo: 'Doença de base compatível com CIVD', ajuda: 'Sepse, trauma grave, complicação obstétrica, neoplasia, hemólise, grande queimado.', opcoes: [
      { rotulo: 'Sim', valor: 1 }, { rotulo: 'Não', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'fenotipo', rotulo: 'Predomínio clínico', opcoes: [
      { rotulo: 'Sangramento', valor: 0 }, { rotulo: 'Trombose', valor: 0 }, { rotulo: 'Nenhum dos dois', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'plaq', rotulo: 'Plaquetas', opcoes: [
      { rotulo: 'Acima de 100 mil', valor: 0 }, { rotulo: 'De 50 mil a 100 mil', valor: 1 }, { rotulo: 'Abaixo de 50 mil', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'dd', rotulo: 'D-dímero ou produtos de degradação da fibrina', opcoes: [
      { rotulo: 'Sem aumento', valor: 0 }, { rotulo: 'Aumento moderado', valor: 2 }, { rotulo: 'Aumento acentuado', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'tp', rotulo: 'Prolongamento do tempo de protrombina', opcoes: [
      { rotulo: 'Abaixo de 3 segundos', valor: 0 }, { rotulo: 'De 3 a menos de 6 segundos', valor: 1 }, { rotulo: '6 segundos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'fib', rotulo: 'Fibrinogênio', opcoes: [
      { rotulo: '100 mg/dL ou mais', valor: 0 }, { rotulo: 'Abaixo de 100 mg/dL', valor: 1 },
    ] },
  ],
  calcular(r) {
    if (!completo(civdIsth, r)) return null
    const temBase = escolha(civdIsth, r, 'base')!.valor === 1
    const sangramento = escolha(civdIsth, r, 'fenotipo')!.rotulo === 'Sangramento'
    const total = somar(civdIsth, r, PARAMETROS)
    const manifesta = temBase && total >= 5
    return {
      rotulo: 'Escore do ISTH',
      valor: temBase ? String(total) : 'Não se aplica',
      unidade: temBase ? (total === 1 ? 'ponto' : 'pontos') : undefined,
      nota: !temBase ? 'sem doença de base o escore não foi construído'
        : manifesta ? 'compatível com CIVD manifesta' : 'abaixo do corte de 5 — não afasta',
      estado: !temBase ? 2 : manifesta ? 2 : total >= 3 ? 1 : 0,
      derivados: temBase
        ? [
            ['Corte do ISTH', '5 pontos ou mais'],
            ['Leitura', manifesta ? 'CIVD manifesta' : 'CIVD não manifesta'],
          ]
        : [
            ['Pré-requisito', 'doença de base compatível com CIVD'],
            ['Sem ele', 'o escore não se aplica — nenhum total foi calculado'],
          ],
      alerta: !temBase
        ? 'Sem doença de base compatível, o escore do ISTH NÃO se aplica. Ele foi construído e validado como confirmação em quem já tem a condição desencadeante — sepse, trauma grave, complicação obstétrica, neoplasia, hemólise, grande queimado. Fora disso, os quatro parâmetros alterados apontam para outro diagnóstico, não para CIVD.'
        : !manifesta && sangramento && total >= 3
          ? 'Abaixo do corte, mas com predomínio hemorrágico e escore intermediário: o ISTH não afasta CIVD, e o quadro é dinâmico.'
          : undefined,
      cuidados: [
        'O escore não afasta. Total abaixo de 5 é CIVD não manifesta, não ausência de CIVD.',
        'O escore é uma fotografia de um quadro dinâmico: o valor de hoje não vale para amanhã.',
        'Fibrinogênio normal não tranquiliza. Ele é reagente de fase aguda e sobe na sepse — pode estar normal com consumo em curso, e é por isso que vale só 1 ponto no escore.',
        'Na CIVD da leucemia promielocítica aguda e nas complicações obstétricas, a evolução é muito mais rápida.',
      ],
    }
  },
}
