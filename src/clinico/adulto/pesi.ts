import { completo, numero, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// PESI (Pulmonary Embolism Severity Index) como o Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022) traz: Tabela 10 (p. 445–446) e
// Figura 4 com a conduta por classe (p. 447). Conferido na imagem das páginas.
// O livro não traz sPESI nem mortalidade por classe; nenhum dos dois entra aqui.

const TEP = 'cap. 32 Tromboembolismo pulmonar'

const ponto = (id: string, rotulo: string, pontos: number): Item => ({
  tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: `Sim — ${pontos} pontos`, valor: pontos }],
})

/** Classes da Tabela 10 (p. 446). */
export const CLASSES_PESI = [
  { classe: 'I', ate: 65, faixa: '≤ 65' },
  { classe: 'II', ate: 85, faixa: '66-85' },
  { classe: 'III', ate: 105, faixa: '86-105' },
  { classe: 'IV', ate: 125, faixa: '106-125' },
  { classe: 'V', ate: Infinity, faixa: '> 125' },
] as const

export function classePesi(pontos: number): (typeof CLASSES_PESI)[number] {
  return CLASSES_PESI.find((c) => pontos <= c.ate)!
}

/** O que o livro diz de cada classe (p. 447, texto e Figura 4). */
const LIVRO: Record<'I-II' | 'III-IV' | 'V', [string, string][]> = {
  'I-II': [
    ['Livro, p. 447', 'Baixo risco.'],
    ['Local de tratamento', 'Considerar tratamento domiciliar ou alta precoce: candidato se todas as respostas do HESTIA forem negativas.'],
    ['Troponina e BNP', 'Não é necessária a dosagem; se feita e vier positiva, reclassifica como risco intermediário baixo.'],
  ],
  'III-IV': [
    ['Livro, p. 447', 'Dosagem de troponina e BNP e aferição de disfunção de VD (ecocardiograma ou TC).'],
    ['Um ou nenhum alterado', 'Risco intermediário baixo (Figura 4): internar e monitorizar.'],
    ['Ambos alterados', 'Risco intermediário alto: internação e monitorização, atento à descompensação hemodinâmica que indica a trombólise.'],
  ],
  V: [['Livro, p. 447', 'O livro não descreve conduta para a classe V: o texto e a Figura 4 tratam só das classes I a IV.']],
}

export const pesi: Escore = {
  ficha: fichaAdulto('adulto-pesi', 'PESI — gravidade do TEP (adulto)', `${TEP}, p. 445–447 (Tabela 10 e Figura 4)`),
  descricao: 'Pulmonary Embolism Severity Index para o paciente com TEP confirmado: idade em anos mais os pontos de cada variável da Tabela 10 do manual do HC.',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 14, max: 120, passo: 1, ajuda: 'Soma a idade em anos.' },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Feminino', valor: 0 }, { rotulo: 'Masculino — 10 pontos', valor: 10 }] },
    ponto('neoplasia', 'Neoplasia', 30),
    ponto('icc', 'ICC (insuficiência cardíaca congestiva)', 10),
    ponto('dpoc', 'DPOC (doença pulmonar obstrutiva crônica)', 10),
    ponto('fc', 'Frequência cardíaca ≥ 110', 20),
    ponto('pas', 'Pressão sistólica < 100 mmHg', 30),
    ponto('fr', 'Frequência respiratória > 30', 20),
    ponto('temp', 'Temperatura < 36 °C', 20),
    ponto('consciencia', 'Alteração aguda do nível de consciência', 60),
    ponto('sat', 'Saturação arterial de O2 < 90%', 20),
  ],
  calcular(r) {
    if (!completo(pesi, r)) return null
    const total = numero(pesi, r, 'idade')! + somar(pesi, r)
    const c = classePesi(total)
    const grupo = c.classe === 'I' || c.classe === 'II' ? 'I-II' : c.classe === 'V' ? 'V' : 'III-IV'
    return {
      rotulo: 'PESI',
      valor: String(total),
      unidade: 'pontos',
      nota: `Classe ${c.classe} (${c.faixa} pontos)${grupo === 'I-II' ? ' · baixo risco pelo livro' : ''}`,
      estado: grupo === 'I-II' ? 0 : grupo === 'III-IV' ? 1 : 2,
      derivados: [
        ['Classe', `${c.classe} (${c.faixa})`],
        ...LIVRO[grupo],
      ],
      cuidados: [
        'O livro não traz o PESI simplificado (sPESI) nem a mortalidade por classe; nenhum dos dois é mostrado aqui.',
        'Frequência respiratória pontua acima de 30 ("> 30", Tabela 10). No artigo original (Aujesky 2005) o corte é ≥ 30; aqui vale o livro.',
        'O livro usa "DPOC" e "Neoplasia"; o artigo original fala em doença pulmonar crônica e câncer.',
        'Critérios HESTIA estão em ferramenta própria.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
