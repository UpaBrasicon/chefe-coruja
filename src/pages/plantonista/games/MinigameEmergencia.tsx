import { QuizGame, type Questao } from '@/components/plantonista/QuizGame'

const questoes: Questao[] = [
  {
    pergunta: 'Paciente com dor torácica + supradesnivelamento de ST em V1–V4. Conduta imediata:',
    opcoes: ['Aspirina + reperfusão (angioplastia ou trombolítico)', 'Observação por 24h', 'Dipirona e alta', 'Antibiótico'],
    correta: 0,
    explicacao: 'IAM com supra de ST exige reperfusão imediata (AAS + ICP/trombolítico).',
  },
  {
    pergunta: 'Homem 60 anos com déficit focal súbito e hora do início < 4h. Primeira conduta:',
    opcoes: ['Tomografia de crânio sem contraste imediata', 'AAS oral', 'Anticoagulante pleno', 'Observar 6h'],
    correta: 0,
    explicacao: 'TC sem contraste exclui hemorragia antes de decidir trombólise no AVC isquêmico.',
  },
  {
    pergunta: 'Paciente em anafilaxia com estridor e hipotensão. Droga de primeira linha:',
    opcoes: ['Adrenalina IM 0,3–0,5 mg', 'Difenidramina EV', 'Metilprednisolona', 'Salbutamol isolado'],
    correta: 0,
    explicacao: 'Adrenalina IM é a primeira linha na anafilaxia. Antihistamínicos/corticoide são adjuvantes.',
  },
  {
    pergunta: 'Adulto com choque hipovolêmico por hemorragia. Reposição inicial preferida:',
    opcoes: ['Cristaloide aquecido + hemocomponentes (transfusão balanceada)', 'SF 0,9% isolado em grande volume', 'Dextrano', 'Hidrocortisona'],
    correta: 0,
    explicacao: 'Controle de danos: cristaloide aquecido + hemocomponentes precoces (1:1:1) na hemorragia.',
  },
  {
    pergunta: 'Bradicardia sintomática (FC 30, hipotensão). Conduta:',
    opcoes: ['Atropina 0,5 mg EV (repetir até 3 mg)', 'Amiodarona', 'Adenosina', 'Magnésio'],
    correta: 0,
    explicacao: 'Atropina é a primeira linha na bradicardia sintomática; marcapasso se refratária.',
  },
  {
    pergunta: 'TV sem pulso no PCR. Conduta:',
    opcoes: ['Desfibrilação + RCP + adrenalina a cada 3–5 min', 'Adenosina', 'Apenas RCP', 'Bicarbonato de rotina'],
    correta: 0,
    explicacao: 'Ritmo chocável: desfibrilar o quanto antes, RCP de alta qualidade e adrenalina 1 mg a cada 3–5 min.',
  },
  {
    pergunta: 'Cetoacidose diabética: qual a prioridade inicial?',
    opcoes: ['Reposição volêmica com SF 0,9% + insulina regular EV', 'Insulina apenas após 2h', 'Bicarbonato de rotina', 'Potássio antes de tudo, sem volume'],
    correta: 0,
    explicacao: 'Hidratação + insulina EV + reposição de potássio guiada. Bicarbonato só em situações específicas.',
  },
]

export function MinigameEmergencia() {
  return (
    <QuizGame
      title="Minigame de Emergência"
      description="Cenários rápidos de emergência para testar sua conduta."
      questoes={questoes}
    />
  )
}
