import { completo, escolha, somar, type Escore } from '../escore.ts'

// Rockall, versão clínica (antes da endoscopia) e completa (depois dela).
// Porte do protótipo (gastro/Rockall, construído em 29/08/2026). O protótipo
// trocava os campos por um seletor de versão; aqui os dois itens endoscópicos
// têm a opção "Endoscopia ainda não feita" (não testável): com as duas assim,
// o escore é o clínico. Saíram (ADR 0007) "Alta precoce", "Para decidir alta
// na chegada" e o "indica prioridade de endoscopia" dos cuidados.

// Mortalidade por ponto no escore COMPLETO, da coorte de derivação.
// A mortalidade por ponto do protótipo era incoerente (7 pontos acima de 8+) e não
// bateu com a coorte de 1996: fica fora até ser conferida na fonte primária.
const FAIXA = ['0 a 2 pontos', '3 a 4 pontos', '5 pontos ou mais']
const NIVEL = ['baixo risco', 'risco intermediário', 'alto risco']
const SEM_ENDOSCOPIA = { rotulo: 'Endoscopia ainda não feita', valor: 0, naoTestavel: true }

export const rockall: Escore = {
  ficha: {
    id: 'rockall',
    titulo: 'Rockall — ressangramento e mortalidade na HDA',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Rockall TA, Logan RFA, Devlin HB, Northfield TC. Risk assessment after acute upper gastrointestinal haemorrhage. Gut. 1996;38(3):316–321.', url: 'https://doi.org/10.1136/gut.38.3.316' },
      { citacao: 'Stanley AJ, Laine L, Dalton HR, et al. Comparison of risk scoring systems for patients presenting with upper gastrointestinal bleeding. BMJ. 2017;356:i6432.', url: 'https://doi.org/10.1136/bmj.i6432' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
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
    const banda = total >= 5 ? 2 : total >= 3 ? 1 : 0
    return {
      rotulo: completa ? 'Rockall completo' : 'Rockall clínico',
      valor: String(total),
      unidade: 'de ' + (completa ? 11 : 7),
      nota: NIVEL[banda] + (completa ? '' : ' · falta a endoscopia para o escore completo'),
      estado: banda as 0 | 1 | 2,
      derivados: completa
        ? [['Faixa', FAIXA[banda]], ['Mortalidade por ponto', 'não exibida: tabela em conferência na fonte primária']]
        : [['Faixa', FAIXA[banda]], ['O que falta', 'diagnóstico endoscópico e estigma de sangramento recente']],
      alerta: semDiag !== semEstigma
        ? 'Só um dos dois itens endoscópicos foi preenchido. O Rockall completo precisa dos dois; até lá, vale o escore clínico.'
        : undefined,
      cuidados: [
        'A versão clínica não substitui a completa, e a forma completa não existe antes da endoscopia.',
        'O Rockall estima morte e ressangramento, não necessidade de intervenção.',
        'A coorte de derivação é de 1996, anterior ao inibidor de bomba em bomba de infusão e à ligadura elástica.',
        'Escore baixo com sangramento ativo na endoscopia não é escore baixo: o achado endoscópico manda.',
      ],
    }
  },
}
