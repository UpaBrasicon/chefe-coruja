import { completo, escolha, numero, somar, type Escore } from '../escore.ts'

// PSI / PORT: idade em pontos brutos, sexo, 18 itens e cinco classes. Porte do
// protótipo (pneumologia/PSI · PORT, construído em 30/08/2026), com a classe I
// pelo passo prévio do algoritmo. Saíram (ADR 0007) o "local indicado" (nota e
// derivado), o "antes de internar pelo número" do alerta e os cuidados de local
// de tratamento e de alta: fica a classe e a mortalidade em 30 dias.

const ns = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]
const MORT = ['', '0,1', '0,6', '0,9', '9,3', '27,0']
const ROM = ['', 'I', 'II', 'III', 'IV', 'V']
const DEMO = ['asilo']
const COMORB = ['neoplasia', 'hepatopatia', 'ic', 'avc', 'renal']
const EXAME = ['mental', 'fr', 'pas', 'temp', 'pulso']
const LAB = ['ph', 'ureia', 'sodio', 'glicose', 'ht', 'pao2', 'derrame']

export const psi: Escore = {
  ficha: {
    id: 'psi-port',
    titulo: 'PSI / PORT — gravidade da pneumonia adquirida na comunidade',
    versao: '2026-10-09.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Fine MJ, Auble TE, Yealy DM, et al. A prediction rule to identify low-risk patients with community-acquired pneumonia. N Engl J Med. 1997;336(4):243–250.', url: 'https://doi.org/10.1056/NEJM199701233360402' },
      { citacao: 'Metlay JP, Waterer GW, Long AC, et al. Diagnosis and treatment of adults with community-acquired pneumonia. An official ATS/IDSA clinical practice guideline. Am J Respir Crit Care Med. 2019;200(7):e45–e67.', url: 'https://doi.org/10.1164/rccm.201908-1581ST' },
      { citacao: 'Bai AD, Loeb M. Community-Acquired Pneumonia in Adults. NEJM Evid. 2025;4(12):EVIDra2500170 (PMID 41288422).', url: 'https://doi.org/10.1056/EVIDra2500170' },
    ],
    revisadoEm: '09/10/2026 (citação de Bai e Loeb corrigida pelo PubMed: NEJM Evidence)',
  },
  descricao: 'Classe de gravidade da pneumonia adquirida na comunidade e mortalidade em 30 dias da coorte original',
  itens: [
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Masculino', valor: 0 }, { rotulo: 'Feminino', valor: 1 }] },
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 14, max: 120, passo: 1, ajuda: 'Entra em pontos brutos. Sexo feminino subtrai 10.' },
    { tipo: 'escolha', id: 'asilo', rotulo: 'Residente em instituição de longa permanência', opcoes: ns(10) },
    { tipo: 'escolha', id: 'neoplasia', rotulo: 'Comorbidade · Neoplasia ativa', opcoes: ns(30) },
    { tipo: 'escolha', id: 'hepatopatia', rotulo: 'Comorbidade · Hepatopatia', opcoes: ns(20) },
    { tipo: 'escolha', id: 'ic', rotulo: 'Comorbidade · Insuficiência cardíaca', opcoes: ns(10) },
    { tipo: 'escolha', id: 'avc', rotulo: 'Comorbidade · Doença cerebrovascular', opcoes: ns(10) },
    { tipo: 'escolha', id: 'renal', rotulo: 'Comorbidade · Doença renal', opcoes: ns(10) },
    { tipo: 'escolha', id: 'mental', rotulo: 'Exame · Alteração do estado mental', opcoes: ns(20) },
    { tipo: 'escolha', id: 'fr', rotulo: 'Exame · Frequência respiratória de 30/min ou mais', opcoes: ns(20) },
    { tipo: 'escolha', id: 'pas', rotulo: 'Exame · Pressão sistólica abaixo de 90 mmHg', opcoes: ns(20) },
    { tipo: 'escolha', id: 'temp', rotulo: 'Exame · Temperatura abaixo de 35 °C ou 40 °C ou mais', opcoes: ns(15) },
    { tipo: 'escolha', id: 'pulso', rotulo: 'Exame · Pulso de 125 bpm ou mais', opcoes: ns(10) },
    { tipo: 'escolha', id: 'ph', rotulo: 'Laboratório · pH arterial abaixo de 7,35', opcoes: ns(30) },
    { tipo: 'escolha', id: 'ureia', rotulo: 'Laboratório · Ureia de 64 mg/dL ou mais (BUN ≥ 30)', opcoes: ns(20) },
    { tipo: 'escolha', id: 'sodio', rotulo: 'Laboratório · Sódio abaixo de 130 mEq/L', opcoes: ns(20) },
    { tipo: 'escolha', id: 'glicose', rotulo: 'Laboratório · Glicose de 250 mg/dL ou mais', opcoes: ns(10) },
    { tipo: 'escolha', id: 'ht', rotulo: 'Laboratório · Hematócrito abaixo de 30%', opcoes: ns(10) },
    { tipo: 'escolha', id: 'pao2', rotulo: 'Laboratório · PaO₂ abaixo de 60 mmHg ou SpO₂ abaixo de 90%', opcoes: ns(10) },
    { tipo: 'escolha', id: 'derrame', rotulo: 'Imagem · Derrame pleural', opcoes: ns(10) },
  ],
  calcular(r) {
    if (!completo(psi, r)) return null
    const anos = numero(psi, r, 'idade')!
    const fem = escolha(psi, r, 'sexo')!.valor === 1
    const pDemo = somar(psi, r, DEMO)
    const pCom = somar(psi, r, COMORB)
    const pEx = somar(psi, r, EXAME)
    const pLab = somar(psi, r, LAB)
    const total = anos + (fem ? -10 : 0) + pDemo + pCom + pEx + pLab
    // A classe I não sai da soma: é o passo prévio do algoritmo (idade até 50,
    // nenhuma comorbidade e nenhum achado de exame físico).
    const classeI = anos <= 50 && pCom === 0 && pEx === 0
    const cls = classeI ? 1 : total <= 70 ? 2 : total <= 90 ? 3 : total <= 130 ? 4 : 5
    const banda = cls >= 5 ? 2 : cls >= 3 ? 1 : 0
    return {
      rotulo: 'PSI · classe ' + ROM[cls],
      valor: classeI ? 'I' : String(total),
      unidade: classeI ? 'sem soma de pontos' : 'pontos',
      nota: 'mortalidade em 30 dias ' + MORT[cls] + '%',
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Classe', ROM[cls] + ' de V'],
        ['Mortalidade em 30 dias', MORT[cls] + '% · coorte de validação original'],
        ['Pontos por idade e sexo', (anos + (fem ? -10 : 0)) + (fem ? ' · ' + anos + ' menos 10 por sexo feminino' : ' · idade em pontos brutos')],
        ['Pontos por residência', String(pDemo)],
        ['Pontos por comorbidade', String(pCom)],
        ['Pontos por exame físico', String(pEx)],
        ['Pontos por laboratório e imagem', String(pLab)],
        ['Faixas', 'I pelo algoritmo · II até 70 · III 71 a 90 · IV 91 a 130 · V acima de 130'],
      ],
      alerta: classeI
        ? 'Classe I sai do PASSO PRÉVIO do algoritmo, não da soma: idade até 50 anos, nenhuma comorbidade e nenhum achado de exame físico. A soma de pontos aqui seria ' + total + ', e ler essa soma colocaria o paciente em classe II.'
        : anos >= 70 && pCom === 0 && pEx === 0 && pLab === 0
          ? 'Toda a pontuação deste paciente vem da IDADE. É o viés conhecido do PSI: idade em pontos brutos leva o idoso sem nenhuma alteração para uma classe alta.'
          : anos < 50 && cls <= 2 && (pLab > 0 || pEx > 0)
            ? 'Jovem com alteração de exame ou laboratório e classe baixa. O PSI subestima gravidade nessa combinação justamente porque a idade pesa muito — a diretriz é explícita em que o escore não se usa isolado.'
            : undefined,
      cuidados: [
        'Nunca isolado. O escore trata variáveis contínuas de forma binária — qualquer sistólica abaixo de 90 conta igual, independente do basal do paciente.',
        'O critério renal publicado é BUN ≥ 30 mg/dL. Em ureia isso equivale a cerca de 64 mg/dL, e é assim que está na lista acima.',
        'Derivado e validado exclusivamente em adultos. Não há referência pediátrica declarada, e nenhum escore de pneumonia desta família tem validação em criança.',
      ],
    }
  },
}
