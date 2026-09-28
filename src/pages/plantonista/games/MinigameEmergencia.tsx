import { QuizGame, type Questao } from '@/components/plantonista/QuizGame'

// Doses e condutas conferidas no Manual de Medicina de Emergência do HCFMUSP,
// 3ª ed. (Manole, 2022). Cada explicação cita capítulo e página do livro.

const questoes: Questao[] = [
  {
    pergunta: 'Paciente com dor torácica há 3 h + supradesnivelamento de ST em V1–V4. Conduta imediata:',
    opcoes: ['AAS 300 mg + reperfusão (angioplastia primária; fibrinolítico se a ICP levar mais de 120 min)', 'Observação por 24 h', 'Dipirona e alta', 'Antibiótico'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 14, p. 216–218: aspirina 300 mg (exceto alergia verdadeira ou suspeita de dissecção de aorta); com menos de 12 h, angioplastia primária; se o tempo até a reperfusão percutânea passar de 120 min, fibrinolítico, com injeção em menos de 10 min do diagnóstico.',
  },
  {
    pergunta: 'Homem de 60 anos com déficit focal súbito, visto bem pela última vez há menos de 4 h. Exame de imagem inicial:',
    opcoes: ['Tomografia de crânio sem contraste imediata', 'AAS oral antes da imagem', 'Anticoagulante pleno', 'Observar 6 h'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 38, p. 519–521: imagem do encéfalo é obrigatória em toda suspeita de AVCi e, em geral, a TC de crânio sem contraste basta; o único exame laboratorial que precisa preceder a trombólise, fora uso de anticoagulante, é a glicemia capilar. Alteplase é considerada até 4,5 h do último momento assintomático.',
  },
  {
    pergunta: 'Anafilaxia com urticária generalizada, sibilância e estridor, pressão ainda preservada. Droga e via de primeira linha:',
    opcoes: ['Adrenalina 0,3–0,5 mg IM no vasto lateral da coxa', 'Difenidramina EV', 'Metilprednisolona', 'Salbutamol isolado'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 11, p. 175–177: adrenalina assim que o diagnóstico é aventado, 0,3–0,5 mg IM (0,3–0,5 mL da 1:1.000) no vasto lateral, repetida a cada 5–10 min. Em choque ou sem resposta a duas doses, adrenalina EV 0,1 mg. Corticoide e anti-histamínico são de segunda linha.',
  },
  {
    pergunta: 'Politraumatizado em choque hemorrágico, sem TCE grave. Reposição inicial pelo livro:',
    opcoes: ['Controle do sangramento, cristaloide aquecido em alíquotas de 250–500 mL com hipotensão permissiva (PAS 80–90 mmHg) e hemocomponentes se persistir instável', 'SF 0,9% em grande volume até normalizar a pressão', 'Dextrano', 'Hidrocortisona'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 47, p. 644–647: cristaloide aquecido (38 ºC) em duas veias calibrosas; volumes restritos em alíquotas de 250–500 mL com hipotensão permissiva (PAS 80–90, PAM 50–60; no TCE grave, PAM > 80); transfusão se instável após 1–3 L de cristaloide e, na transfusão maciça, plasma, plaquetas e hemácias 1:1:1.',
  },
  {
    pergunta: 'Bradicardia sintomática (FC 30, hipotensão). Conduta farmacológica inicial:',
    opcoes: ['Atropina 0,5 mg EV a cada 3 min (máximo 3 mg)', 'Amiodarona', 'Adenosina', 'Magnésio'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 15, p. 229: atropina 0,5 mg EV a cada 3 min até 3 mg (em geral não funciona no Mobitz II nem no BAVT); sem melhora, marca-passo e, enquanto isso, dopamina 5–20 µg/kg/min ou adrenalina (o livro imprime "2–10 µg/kg/min"; a dose usual é 2–10 µg/min).',
  },
  {
    pergunta: 'TV sem pulso na PCR. Conduta:',
    opcoes: ['Desfibrilação + RCP; adrenalina 1 mg a cada 3–5 min após o 2º choque', 'Adenosina', 'Apenas RCP', 'Bicarbonato de rotina'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 2, p. 48–49: FV/TV sem pulso devem ser desfibriladas de imediato (360 J monofásico ou 200 J/carga do fabricante no bifásico) e a RCP retomada logo após; adrenalina 1 mg IV/IO a cada 3–5 min após o 2º choque; amiodarona 300 mg após o 3º e 150 mg após o 5º choque (Tabela 2). Bicarbonato só em situações específicas (p. 50).',
  },
  {
    pergunta: 'Cetoacidose diabética com K de 4,5 mEq/L e pH 7,10. Prioridade inicial:',
    opcoes: ['SF 0,9% 1.000–1.500 mL na 1ª hora + insulina regular EV 0,1 U/kg/h, com potássio no soro', 'Insulina apenas após 2 h', 'Bicarbonato de rotina', 'Potássio antes de tudo, sem volume'],
    correta: 0,
    explicacao: 'Manual HCFMUSP, 3ª ed., cap. 64, p. 869–874: 1.000–1.500 mL de NaCl 0,9% na 1ª hora; insulina concomitante (0,1 U/kg em bolus e 0,1 U/kg/h), exceto se K < 3,3 mEq/L, quando se repõe potássio antes; com K entre 3,3 e 5,0, 25 mEq de K por litro de soro. Bicarbonato só com pH < 6,9.',
  },
]

export function MinigameEmergencia() {
  return (
    <QuizGame
      title="Minigame de Emergência"
      description="Cenários rápidos de emergência para testar sua conduta."
      questoes={questoes}
      fonte="Conteúdo conferido no Manual de Medicina de Emergência HCFMUSP, 3ª ed."
    />
  )
}
