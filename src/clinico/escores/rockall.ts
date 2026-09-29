import { completo, escolha, somar, type Escore } from '../escore.ts'

// Rockall, versão clínica (antes da endoscopia) e completa (depois dela).
// Porte do protótipo (gastro/Rockall, construído em 29/08/2026). O protótipo
// trocava os campos por um seletor de versão; aqui os dois itens endoscópicos
// têm a opção "Endoscopia ainda não feita" (não testável): com as duas assim,
// o escore é o clínico. Saíram (ADR 0007) "Alta precoce", "Para decidir alta
// na chegada" e o "indica prioridade de endoscopia" dos cuidados.

// Tabelas IV(A) e IV(B) de Rockall 1996, p. 319, lidas no PDF do artigo em
// 28/09/2026. O ressangramento de 7 pontos (43,8%) é MAIOR que o de 8+ (41,8%)
// no próprio artigo: não é erro de transcrição. A mortalidade sobe em degraus.
// As faixas "0–2 / 3–4 / 5+" do protótipo não existem no artigo e saíram. O
// artigo só destaca o grupo de baixo risco: escore inicial 0 (15% dos casos na
// chegada) e escore completo 0 a 2 (26% dos casos depois da endoscopia).
/** Mortalidade observada por escore inicial, 0 a 7 (Tabela IV(A)). */
const MORTE_INICIAL = ['0,2', '2,4', '5,6', '11,0', '24,6', '39,6', '48,9', '50,0']
/** Escore completo, 0 a 7 e 8+ (Tabela IV(B)). */
const RESSANGRA_COMPLETO = ['4,9', '3,4', '5,3', '11,2', '14,1', '24,1', '32,9', '43,8', '41,8']
const MORTE_COMPLETO = ['0', '0', '0,2', '2,9', '5,3', '10,8', '17,3', '27,0', '41,1']
const PAGINA = 'Rockall 1996, Tabela IV, p. 319'
const SEM_ENDOSCOPIA = { rotulo: 'Endoscopia ainda não feita', valor: 0, naoTestavel: true }

export const rockall: Escore = {
  ficha: {
    id: 'rockall',
    titulo: 'Rockall — ressangramento e mortalidade na HDA',
    versao: '2026-09-28.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Rockall TA, Logan RFA, Devlin HB, Northfield TC. Risk assessment after acute upper gastrointestinal haemorrhage. Gut. 1996;38(3):316–321. Tabela III (p. 318) e Tabela IV (p. 319).', url: 'https://doi.org/10.1136/gut.38.3.316' },
      { citacao: 'Stanley AJ, Laine L, Dalton HR, et al. Comparison of risk scoring systems for patients presenting with upper gastrointestinal bleeding. BMJ. 2017;356:i6432.', url: 'https://doi.org/10.1136/bmj.i6432' },
    ],
    revisadoEm: '28/09/2026 (tabela de mortalidade conferida no artigo)',
  },
  descricao: 'Mortalidade e ressangramento na hemorragia digestiva alta, na forma clínica ou completa',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: 'Abaixo de 60 anos', valor: 0 }, { rotulo: '60 a 79 anos', valor: 1 }, { rotulo: '80 anos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'choque', rotulo: 'Estado hemodinâmico', opcoes: [
      { rotulo: 'Sem choque — sistólica 100 ou mais e pulso abaixo de 100', valor: 0 },
      { rotulo: 'Taquicardia — sistólica 100 ou mais e pulso 100 ou mais', valor: 1 },
      { rotulo: 'Hipotensão — sistólica abaixo de 100', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'comorb', rotulo: 'Comorbidade', opcoes: [
      { rotulo: 'Nenhuma maior', valor: 0 },
      { rotulo: 'Insuficiência cardíaca, doença isquêmica ou outra comorbidade maior', valor: 2 },
      { rotulo: 'Insuficiência renal, insuficiência hepática ou neoplasia disseminada', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'diag', rotulo: 'Diagnóstico endoscópico', opcoes: [
      SEM_ENDOSCOPIA,
      { rotulo: 'Mallory-Weiss, ou sem lesão e sem estigma', valor: 0 },
      { rotulo: 'Qualquer outro diagnóstico', valor: 1 },
      { rotulo: 'Neoplasia do trato digestivo alto', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'estigma', rotulo: 'Estigma de sangramento recente', opcoes: [
      SEM_ENDOSCOPIA,
      { rotulo: 'Ausente, ou apenas ponto escuro', valor: 0 },
      { rotulo: 'Sangue no trato digestivo alto, coágulo aderido, vaso visível ou sangramento ativo', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(rockall, r)) return null
    const semDiag = escolha(rockall, r, 'diag')!.naoTestavel === true
    const semEstigma = escolha(rockall, r, 'estigma')!.naoTestavel === true
    const completa = !semDiag && !semEstigma
    const total = somar(rockall, r, completa ? undefined : ['idade', 'choque', 'comorb'])
    const baixo = completa ? total <= 2 : total === 0
    const i = Math.min(total, 8)
    return {
      rotulo: completa ? 'Rockall completo' : 'Rockall clínico',
      valor: String(total),
      unidade: 'de ' + (completa ? 11 : 7),
      nota: completa
        ? 'mortalidade observada ' + MORTE_COMPLETO[i] + '% · ressangramento ' + RESSANGRA_COMPLETO[i] + '%'
        : 'mortalidade observada ' + MORTE_INICIAL[total] + '% · falta a endoscopia para o escore completo',
      estado: baixo ? 0 : 1,
      derivados: completa
        ? [
            ['Mortalidade observada', MORTE_COMPLETO[i] + '% com ' + (total >= 8 ? '8 pontos ou mais' : total + (total === 1 ? ' ponto' : ' pontos')) + ' · ' + PAGINA],
            ['Ressangramento observado', RESSANGRA_COMPLETO[i] + '%'],
            ['Grupo de baixo risco do artigo', baixo ? 'sim · escore completo 0 a 2' : 'não · o artigo destaca só 0 a 2'],
          ]
        : [
            ['Mortalidade observada', MORTE_INICIAL[total] + '% com ' + total + (total === 1 ? ' ponto' : ' pontos') + ' no escore inicial · ' + PAGINA],
            ['Grupo de baixo risco do artigo', baixo ? 'sim · escore inicial 0' : 'não · no escore inicial o artigo destaca só o 0'],
            ['O que falta', 'diagnóstico endoscópico e estigma de sangramento recente'],
          ],
      alerta: semDiag !== semEstigma
        ? 'Só um dos dois itens endoscópicos foi preenchido. O Rockall completo precisa dos dois; até lá, vale o escore clínico.'
        : undefined,
      cuidados: [
        'A versão clínica não substitui a completa, e a forma completa não existe antes da endoscopia.',
        'O Rockall estima morte e ressangramento, não necessidade de intervenção.',
        'As porcentagens são as observadas na coorte de derivação, não uma previsão individual. O próprio artigo diz que o escore não prevê o desfecho de um paciente, salvo talvez nos escores completos 0 e 1, sem mortes.',
        'Com 8 pontos ou mais o artigo junta tudo numa categoria, por haver poucos casos.',
        'A coorte de derivação é de 1996, anterior ao inibidor de bomba em bomba de infusão e à ligadura elástica.',
        'Escore baixo com sangramento ativo na endoscopia não é escore baixo: o achado endoscópico manda.',
      ],
    }
  },
}
