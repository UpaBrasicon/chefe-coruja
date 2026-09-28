import { QuizGame, type Questao } from '@/components/plantonista/QuizGame'

// Perguntas conferidas no Manual de Medicina de Emergência do HCFMUSP, 3ª ed.
// (Manole, 2022). Cada explicação cita capítulo e página do livro.

const questoes: Questao[] = [
  {
    pergunta: 'PAC grave com infiltrado cavitário e influenza concomitante (quadro sugestivo de MRSA). Qual antimicrobiano o livro associa a essa cobertura?',
    opcoes: ['Ceftriaxona isolada', 'Vancomicina', 'Azitromicina isolada', 'Oseltamivir isolado'],
    correta: 1,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 33, p. 461–462 (Tabela 9): germes meticilino-resistentes necessitariam de cobertura com vancomicina. A diretriz ATS/IDSA citada pelo livro não recomenda cobrir MRSA de rotina, só na pneumonia grave com fatores de risco (cavitação/necrose, influenza concomitante, derrame que aumenta rápido, entre outros).',
  },
  {
    pergunta: 'PAC de baixo risco em paciente hígido, sem antibiótico nos últimos 3 meses. Opção da Tabela 10:',
    opcoes: ['Piperacilina-tazobactam', 'Amoxicilina 500 mg 8/8 h ou azitromicina 500 mg 1 x/dia', 'Levofloxacino + ceftriaxona', 'Meropenem'],
    correta: 1,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 33, Tabela 10, p. 463: baixo risco, hígido — amoxicilina 500 mg 8/8 h ou azitromicina 500 mg 1 x/d, por 5 dias (p. 460). Quinolona respiratória de rotina ou terapia dupla não estão indicadas nesse grupo (p. 460). O livro não recomenda separar pneumonia "típica" de "atípica" pela clínica (p. 450).',
  },
  {
    pergunta: 'Neutropenia febril de alto risco, febre persistente após 4–7 dias de antibiótico e nódulos pulmonares na TC. Opção antifúngica do livro:',
    opcoes: ['Ceftriaxona + azitromicina', 'Anfotericina B lipossomal (ou voriconazol)', 'Metronidazol', 'Vancomicina'],
    correta: 1,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 81, p. 1072: com infiltrados/nódulos pulmonares, anfotericina B lipossomal 3–5 mg/kg IV 1 x/d ou voriconazol 6 mg/kg IV 12/12 h no 1º dia e depois 4 mg/kg 12/12 h. Sem foco e sem profilaxia antifúngica prévia, a opção é caspofungina (p. 1072).',
  },
  {
    pergunta: 'Neutropenia febril de alto risco no pronto-socorro, estável. Esquema inicial:',
    opcoes: ['Monoterapia com β-lactâmico anti-Pseudomonas (p. ex., cefepime 2 g IV 8/8 h)', 'Vancomicina + cefepime de rotina', 'Ceftriaxona isolada', 'Aguardar hemoculturas para iniciar'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 81, p. 1068–1070: antimicrobiano idealmente nos primeiros 30 min após a triagem, depois das hemoculturas; monoterapia com piperacilina-tazobactam 4,5 g 6/6 h, cefepime 2 g 8/8 h ou meropenem 1 g 8/8 h. Vancomicina ou teicoplanina não fazem parte do esquema inicial — só com indicação (instabilidade, mucosite, cateter/pele, Gram-positivo em cultura etc.).',
  },
  {
    pergunta: 'Influenza H1N1 em paciente hospitalizado. Antiviral e dose do livro:',
    opcoes: ['Amoxicilina-clavulanato', 'Oseltamivir 75 mg VO 12/12 h por 5 dias', 'Fluconazol', 'Aciclovir'],
    correta: 1,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 90, p. 1224–1225: oseltamivir 75 mg VO 12/12 h por 5 dias (pode prolongar para 7–10), com maior benefício nas primeiras 48 h; indicado a todo hospitalizado com suspeita ou confirmação (Tabela 6). No quadro respiratório grave o livro manda associar antibioticoterapia de amplo espectro.',
  },
  {
    pergunta: 'Pneumonia aspirativa adquirida na comunidade com escarro pútrido (risco de anaeróbios), sem alergia a penicilina. Escolha do livro:',
    opcoes: ['Amoxicilina-clavulanato 500/125 mg 8/8 h', 'Ceftazidima', 'Vancomicina', 'Fluconazol'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 35, Tabela 4, p. 479: comunidade — betalactâmico com inibidor de betalactamase (amoxicilina-clavulanato 500/125 mg 8/8 h ou ampicilina-sulbactam 1,5–3 g IV 6/6 h); clindamicina 600 mg 8/8 h fica para alérgicos a penicilina. No abscesso pulmonar a clindamicina é a terapia de escolha (p. 482).',
  },
  {
    pergunta: 'Choque séptico com PAM baixa após a reposição inicial de cristaloide. Qual vasopressor o livro prefere?',
    opcoes: ['Dopamina', 'Noradrenalina', 'Dobutamina isolada', 'Corticoide de rotina no lugar do vasopressor'],
    correta: 1,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 7, p. 122: cristaloide 30 mL/kg na 1ª hora em alíquotas de 250–500 mL com reavaliação; alvo PAM ≥ 65 mmHg; a droga vasopressora preferencial é a noradrenalina (Tabela 8, p. 123: 0,05–2 µg/kg/min). Corticoide não é de rotina; hidrocortisona 200 mg/dia por 7 dias pode ser considerada no choque em uso de vasopressor (p. 125).',
  },
  {
    pergunta: 'Pneumonia comunitária de alto risco, sem risco de Pseudomonas — esquema da Tabela 10 do manual HCFMUSP:',
    opcoes: ['Ceftriaxona + azitromicina', 'Cefepima + levofloxacino', 'Vancomicina isolada', 'Metronidazol isolado'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 33, Tabela 10, p. 463: alto risco — ceftriaxona 1 g 12/12 h + azitromicina 500 mg 1 x/d (ou levofloxacino 500 mg 1 x/d). Cefepime, ceftazidima, piperacilina-tazobactam ou meropenem ficam para o risco de Pseudomonas.',
  },
  {
    pergunta: 'Pielonefrite. Qual destes antibióticos o livro diz que NÃO serve, por não atingir o trato urinário alto?',
    opcoes: ['Ciprofloxacina', 'Ceftriaxona', 'Norfloxacina', 'Gentamicina em dose única diária'],
    correta: 2,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 89, p. 1213: na pielonefrite são necessários antibióticos com penetração no trato urinário alto, como ciprofloxacina (400 mg IV ou 500 mg VO 12/12 h) ou ceftriaxona (1–2 g 1 x/d), ou aminoglicosídeo em dose única diária; não é possível usar norfloxacina. Duração de 7 a 14 dias.',
  },
]

export function Infection() {
  return (
    <QuizGame
      title="Infection — antimicrobianos na emergência"
      description="Escolha o antimicrobiano certo para cada cenário, pelo manual do HC."
      questoes={questoes}
      fonte="Conteúdo conferido no Manual de Medicina de Emergência HCFMUSP, 3ª ed."
    />
  )
}
