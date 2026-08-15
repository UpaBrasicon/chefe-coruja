import { QuizGame, type Questao } from '@/components/plantonista/QuizGame'

const questoes: Questao[] = [
  {
    pergunta: 'Paciente com pneumonia grave na UTI, Gram+ em escarro. Qual o antibiótico mais adequado?',
    opcoes: ['Ceftriaxona', 'Vancomicina', 'Azitromicina', 'Oseltamivir'],
    correta: 1,
    explicacao: 'Cobertura de Gram+ (S. aureus, pneumococo). Ceftriaxona é Gram−/Gram+ de espectro menor para MRSA; azitromicina é para atípicos.',
  },
  {
    pergunta: 'Pneumonia adquirida na comunidade com suspeita de atípico (Mycoplasma). Melhor opção:',
    opcoes: ['Piperacilina-tazobactam', 'Anfotericina B', 'Azitromicina', 'Aciclovir'],
    correta: 2,
    explicacao: 'Atípicos (Mycoplasma, Legionella, Chlamydia) respondem a macrolídeos como azitromicina.',
  },
  {
    pergunta: 'Paciente imunossuprimido com suspeita de pneumonia fúngica. Tratamento:',
    opcoes: ['Ceftriaxona + azitromicina', 'Anfotericina B', 'Metronidazol', 'Vancomicina'],
    correta: 1,
    explicacao: 'Fungos não respondem a antibióticos comuns — requerem antifúngico (anfotericina B, azóis, equinocandinas).',
  },
  {
    pergunta: 'Pneumonia viral (influenza) confirmada por PCR. Conduta:',
    opcoes: ['Amoxicilina-clavulanato', 'Oseltamivir', 'Fluconazol', 'Ciprofloxacino'],
    correta: 1,
    explicacao: 'Antiviral (oseltamivir) para influenza. Antibiótico só se coinfecção bacteriana.',
  },
  {
    pergunta: 'Pneumonia aspirativa (anaeróbios da cavidade oral). Melhor cobertura:',
    opcoes: ['Clindamicina', 'Ceftazidima', 'Vancomicina', 'Fluconazol'],
    correta: 0,
    explicacao: 'Clindamicina ou betalactâmico com ação em anaeróbios para pneumonia aspirativa.',
  },
  {
    pergunta: 'Principal medida de suporte no choque séptico:',
    opcoes: ['Antibiótico por via oral', 'Noradrenalina precoce', 'Hiperhidratação agressiva', 'Corticosteroide de rotina'],
    correta: 1,
    explicacao: 'Vasopressor precoce (noradrenalina) + reposição guiada. Evitar hiperidratação agressiva.',
  },
  {
    pergunta: 'Antibioticoterapia empírica em pneumonia grave (UTI) de início precoce, sem fatores de risco para resistência:',
    opcoes: ['Betalactâmico (cefepima/piperacilina-tazobactam) + macrolídeo', 'Vancomicina isolada', 'Metronidazol isolado', 'Azitromicina isolada'],
    correta: 0,
    explicacao: 'Cobertura de Gram−/Gram+ + atípicos. Evitar antibiótico de amplo espectro desnecessário (stewardship).',
  },
]

export function Infection() {
  return (
    <QuizGame
      title="Infection — Pneumonia na UTI"
      description="Escolha o antibiótico certo para cada patógeno. Quanto maior o acerto, menor a pressão de seleção de resistência."
      questoes={questoes}
    />
  )
}
