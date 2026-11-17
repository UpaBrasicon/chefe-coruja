import type { ItemGuia } from './guia.ts'

// Textos do topo das ferramentas no modelo das calculadoras (pedido do RT de
// 16/11/2026, modelo do MDCalc): frase-resumo, instruções curtas e as abas
// "Quando usar" e "Por que usar". Decisão C1 = A: cada frase sai de fonte que a
// ficha já cita; o que a fonte não diz fica de fora e a aba não aparece.
// Módulo leve, sem as tabelas clínicas: o ToolLayout importa daqui em toda tela.
// Piloto (16/11/2026): os quatro escores do piloto; lote 2 no fim do mapa.

export type Topo = {
  /** uma frase de "para que serve", no lugar da descrição sob o título */
  resumo?: string
  instrucoes?: string
  quandoUsar?: ItemGuia[]
  porQueUsar?: ItemGuia[]
}

const BACKUS = 'Backus et al., Int J Cardiol 2013 (validação prospectiva)'
const SIX = 'Six et al., Neth Heart J 2008'
const SBC_DOR = 'SBC 2025, dor torácica na emergência'
const LIM = 'Lim et al., Thorax 2003 (derivação e validação)'
const ATS_IDSA = 'ATS/IDSA 2019, pneumonia comunitária'
const SEPSIS3 = 'Sepsis-3, JAMA 2016'
const SSC = 'SSC 2026'
const BRENNAN = 'Brennan et al., J Neurosurg 2018 (GCS-P)'

export const TOPOS: Record<string, Topo> = {
  heart: {
    resumo: 'Prevê o risco de evento cardíaco adverso maior em 6 semanas no paciente com dor torácica no pronto-socorro.',
    instrucoes: 'Cinco itens (história, ECG, idade, fatores de risco e troponina), de 0 a 2 pontos cada. Calcule quando o primeiro ECG e os primeiros exames estiverem prontos.',
    quandoUsar: [
      { texto: 'Dor torácica no pronto-socorro, para separar o paciente de baixo e o de alto risco de síndrome coronariana aguda.', ref: { fonte: BACKUS, pagina: 'resumo' } },
      { texto: 'Na suspeita de síndrome coronariana aguda, a diretriz brasileira indica o HEART como escore clínico preferencial.', ref: { fonte: SBC_DOR, pagina: 'p. 29–30', grau: 'I, B' } },
    ],
    porQueUsar: [
      { texto: 'Na validação prospectiva em 10 hospitais holandeses (2.440 pacientes), o evento cardíaco maior em 6 semanas ocorreu em 1,7% com HEART de 0 a 3, em 16,6% com 4 a 6 e em 50,1% com 7 a 10. A estatística C foi 0,83, maior que a do TIMI (0,75) e a do GRACE (0,70).', ref: { fonte: BACKUS, pagina: 'resumo' } },
      { texto: 'Cada item é uma consideração clássica de risco, pontuada de 0 a 2 conforme o grau da alteração: rápido de calcular, sem computador.', ref: { fonte: SIX, pagina: 'resumo' } },
    ],
  },
  'curb-65': {
    resumo: 'Estima a mortalidade em 30 dias da pneumonia comunitária no adulto, com dados da chegada ao hospital.',
    instrucoes: 'Um ponto para cada item: confusão, ureia acima de 7 mmol/L, frequência respiratória de 30 ou mais, PA sistólica abaixo de 90 ou diastólica de 60 ou menos, e idade de 65 anos ou mais.',
    quandoUsar: [
      { texto: 'Adulto com pneumonia comunitária na avaliação inicial no hospital, para estratificar a gravidade.', ref: { fonte: LIM, pagina: 'resumo' } },
      { texto: 'Para decidir o local do tratamento, a ATS/IDSA prefere o PSI ao CURB-65, sempre junto do julgamento clínico.', ref: { fonte: ATS_IDSA, pagina: 'questão 6', grau: 'forte, qualidade moderada' } },
    ],
    porQueUsar: [
      { texto: 'Em 1.068 adultos internados no Reino Unido, na Nova Zelândia e na Holanda, a mortalidade em 30 dias subiu com a pontuação: 0,7% com 0, 3,2% com 1, 3% com 2, 17% com 3, 41,5% com 4 e 57% com 5; a coorte de validação confirmou o padrão.', ref: { fonte: LIM, pagina: 'resumo' } },
    ],
  },
  'sepse-adulto': {
    resumo: 'Reconhece a disfunção orgânica da sepse pelo SOFA e o choque séptico pelos critérios do Sepsis-3.',
    instrucoes: 'Preencha os sistemas do SOFA com os dados disponíveis. Sem disfunção orgânica conhecida antes da infecção, o SOFA basal é considerado zero.',
    quandoUsar: [
      { texto: 'Infecção suspeita ou confirmada: a disfunção orgânica da sepse é o aumento agudo de 2 pontos ou mais no SOFA por causa da infecção.', ref: { fonte: SEPSIS3, pagina: 'Quadro 3' } },
      { texto: 'Para rastrear sepse no paciente agudo, NEWS, NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única.', ref: { fonte: SSC, pagina: 'rec. 4, p. 15', grau: 'forte, certeza moderada' } },
    ],
    porQueUsar: [
      { texto: 'SOFA de 2 ou mais reflete risco de morte de cerca de 10% na população hospitalar com infecção suspeita; mesmo a disfunção modesta pode piorar, por isso pede resposta rápida.', ref: { fonte: SEPSIS3, pagina: 'Quadro 3' } },
    ],
  },
  glasgow: {
    resumo: 'Mede o nível de consciência pela abertura ocular, pela resposta verbal e pela resposta motora; o GCS-P soma a reatividade das pupilas.',
    instrucoes: 'Some os três componentes (3 a 15). Para o GCS-P, subtraia o número de pupilas que não reagem (0, 1 ou 2): o resultado vai de 1 a 15.',
    quandoUsar: [
      { texto: 'Avaliação da gravidade do traumatismo craniano: o Glasgow e a resposta das pupilas são indicadores-chave da gravidade da lesão.', ref: { fonte: BRENNAN, pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Nos dados do CRASH e do IMPACT (cerca de 15.900 pacientes), somar as pupilas aumentou a informação sobre o desfecho: com Glasgow 3 a mortalidade foi de 51%, e com GCS-P 1, de 74%. O GCS-P também desfez o achado paradoxal de Glasgow 4 com desfecho pior que Glasgow 3.', ref: { fonte: BRENNAN, pagina: 'resumo' } },
    ],
  },
  // Condutas do piloto (16/11/2026): frase-resumo e instruções descrevem a própria
  // ferramenta (fonte = a da ficha, com a página); "Quando usar" só onde o livro
  // define a indicação. "Por que usar" fica vazio: as condutas não são escores.
  'adulto-isr': {
    resumo: 'Calcula dose, volume e ampolas das drogas da intubação em sequência rápida do adulto pelo peso, no padrão de diluição do manual do HC.',
    instrucoes: 'Informe o peso: cada droga aparece com a dose por kg, o volume e as ampolas da apresentação do Anexo 1 (p. 1480–1482). A DAS 2025 fica ao lado do manual.',
  },
  'adulto-infusoes': {
    resumo: 'Calcula a velocidade da bomba pela dose, e a dose pela velocidade, das infusões contínuas do adulto: vasoativos, sedação e analgesia, bloqueio neuromuscular e anticoagulação.',
    instrucoes: 'Escolha a droga e a diluição (o padrão do Anexo 1 do manual do HC ou a do serviço), informe o peso e a dose ou a velocidade da bomba.',
  },
  'adulto-reposicao-potassio': {
    resumo: 'Classifica a hipocalemia e calcula a reposição de potássio e o preparo do KCl pelo esquema do manual do HC.',
    instrucoes: 'Informe o potássio sérico, se há sintomas e se há perda urinária. Depois escolha a apresentação, a dose, o diluente e o tempo para ver volume, ampolas, concentração e velocidade.',
    quandoUsar: [
      { texto: 'Hipocalemia é o potássio abaixo de 3,5 mEq/L: leve de 3 a 3,4, moderada de 2,5 a 2,9 e grave abaixo de 2,5.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 67', pagina: 'p. 900' } },
    ],
  },
  'adulto-pcr': {
    resumo: 'Calcula as doses das drogas da parada cardiorrespiratória do adulto pelo peso e mostra a carga do choque, com a Tabela 2 do manual do HC e a AHA 2025 ao lado.',
    instrucoes: 'Informe o peso: a tela mostra as doses da Tabela 2, a carga da desfibrilação na FV e na TV sem pulso e as diferenças com a AHA 2025 e o CoSTR 2026.',
  },
  'ped-bolus': {
    resumo: 'Calcula as doses dos medicamentos de emergência pediátrica pelo peso, pelo apêndice do PS Pediatria do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso e busque o medicamento: cada dose mostra a página do livro, com errata e divergências quando houver.',
  },
  'ped-diarreia-desidratacao': {
    resumo: 'Classifica a desidratação da criança com diarreia aguda e calcula os volumes dos planos A, B e C pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Preencha a escala clínica de desidratação e o peso; o peso antes da doença é opcional e permite o grau pelo peso perdido.',
    quandoUsar: [
      { texto: 'Criança com diarreia aguda: a escala clínica de desidratação, adaptada de Friedman et al. (2004), classifica o grau de desidratação e orienta o plano de hidratação.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Tabela 1, p. 329; planos na p. 330' } },
    ],
  },
  // Lote 2 (16/11/2026, formato aprovado pelo RT): os demais escores da seção, por grupo.
  // Textos redigidos a partir dos resumos do PubMed, do PMC e das diretrizes já lidas;
  // cada número conferido contra a citação original. Campo sem fonte legível fica vazio.
  'cha2ds2-va': {
    resumo: 'Estima o risco de AVC e tromboembolismo na fibrilação atrial, sem a categoria de sexo, para apoiar a decisão sobre anticoagulação.',
    instrucoes: 'Marque cada fator presente: idade de 65 a 74 anos vale 1 ponto e de 75 anos ou mais, 2; AVC, AIT ou tromboembolismo prévio vale 2; os demais valem 1 cada.',
    quandoUsar: [
      { texto: 'Em todo paciente com fibrilação atrial não valvar.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: 'Quadro 5', grau: 'I A' } },
      { texto: 'Escore de 2 ou mais: terapia antitrombótica recomendada; escore 0: sem indicação de terapia antitrombótica.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: 'Quadro 5', grau: 'I A' } },
      { texto: 'Escore 1: a terapia antitrombótica pode ser instituída, pesando benefício, risco de sangramento, forma de apresentação da FA e preferência do paciente.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: 'Quadro 5', grau: 'IIa B' } },
    ],
    porQueUsar: [
      { texto: 'Em 195.719 pacientes com FA no Reino Unido, tirar o sexo do escore não mudou a discriminação: estatística C de 0,62 a 0,71 nas duas versões.', ref: { fonte: 'Yoshimura et al., Europace 2024', pagina: 'resumo' } },
      { texto: 'Escore 0 corresponde a risco baixo (1,3% ao ano); o escore tem alta sensibilidade e valor preditivo negativo para o baixo risco, mas baixa especificidade para o alto risco.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: '6.1' } },
      { texto: 'Na coorte de origem do escore (1.084 pacientes do Euro Heart Survey, versão com sexo), os classificados como baixo risco não tiveram evento tromboembólico.', ref: { fonte: 'Lip et al., Chest 2010', pagina: 'resumo' } },
    ],
  },
  'has-bled': {
    resumo: 'Estima o risco de sangramento maior em 1 ano no paciente com fibrilação atrial e ajuda a identificar fatores de risco modificáveis.',
    instrucoes: 'Marque cada fator presente; cada um vale 1 ponto, de 0 a 9.',
    quandoUsar: [
      { texto: 'No paciente com FA de alto risco, para identificar fatores de sangramento modificáveis.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: 'Quadro 5', grau: 'IIa B' } },
      { texto: 'Escore de 3 ou mais indica alto risco, mas não contraindica a anticoagulação.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: '6.2' } },
      { texto: 'Reavaliar periodicamente o risco de sangramento no paciente com FA.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: 'Quadro 5', grau: 'I B' } },
    ],
    porQueUsar: [
      { texto: 'Derivado em 3.978 pacientes do Euro Heart Survey: sangramento maior em 1,5% em 1 ano; estatística C de 0,72.', ref: { fonte: 'Pisters et al., Chest 2010', pagina: 'resumo' } },
      { texto: 'Em revisão sistemática de 38 estudos, foi o escore com melhor evidência na predição de sangramento.', ref: { fonte: 'SBC/SOBRAC, Diretriz Brasileira de FA 2025', pagina: '6.2' } },
    ],
  },
  'wells-tvp': {
    resumo: 'Estima a probabilidade clínica pré-teste de trombose venosa profunda no paciente ambulatorial com suspeita de TVP de membro inferior.',
    instrucoes: 'Marque cada item presente (1 ponto cada) e subtraia 2 pontos se um diagnóstico alternativo for ao menos tão provável quanto TVP.',
    quandoUsar: [
      { texto: 'Na probabilidade baixa (ou TVP improvável, na regra de dois níveis), comece pelo D-dímero; D-dímero negativo exclui TVP sem outros exames.', ref: { fonte: 'ASH 2018, diagnóstico de TEV (Lim et al., Blood Adv)', pagina: 'rec. 5a', grau: 'Forte (D-dímero), certeza moderada' } },
      { texto: 'O D-dímero tem utilidade limitada no paciente internado, no pós-operatório e na gestante.', ref: { fonte: 'ASH 2018, diagnóstico de TEV (Lim et al., Blood Adv)', pagina: 'rec. 5a, observações' } },
      { texto: 'Com TVP improvável e D-dímero negativo, a ultrassonografia pode ser dispensada com segurança.', ref: { fonte: 'Wells et al., N Engl J Med 2003', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em 593 pacientes, TVP em 3%, 17% e 75% nas probabilidades baixa, moderada e alta.', ref: { fonte: 'Wells et al., Lancet 1997', pagina: 'resumo' } },
      { texto: 'No ensaio randomizado, a estratégia com D-dímero teve 0,4% de eventos tromboembólicos em três meses entre os pacientes com TVP excluída, e 39% dispensaram a ultrassonografia.', ref: { fonte: 'Wells et al., N Engl J Med 2003', pagina: 'resumo' } },
      { texto: 'Em meta-análise de 10.002 pacientes, prevalência de TVP de 3,5% a 8,1% na probabilidade baixa, 13,3% a 23,9% na intermediária e 36,3% a 61,5% na alta.', ref: { fonte: 'ASH 2018, diagnóstico de TEV (Lim et al., Blood Adv)', pagina: 'Métodos, prevalência de TVP' } },
    ],
  },
  'light': {
    resumo: 'Separa o derrame pleural em exsudato ou transudato pela proteína e pelo LDH do líquido pleural e do soro.',
    instrucoes: 'Informe proteína e LDH do líquido e do soro e o limite superior normal do LDH do seu laboratório; basta um critério positivo para exsudato. Com a albumina do soro e do líquido, o gradiente de albumina ajuda a reclassificar o transudato rotulado como exsudato.',
    quandoUsar: [
      { texto: 'Como primeiro passo na investigação do derrame pleural.', ref: { fonte: 'Porcel et al., ERJ Open Res 2026', pagina: 'Introdução' } },
      { texto: 'Na insuficiência cardíaca, desconfie do exsudato pelos critérios de Light: a IC respondeu por 92% e 87% dos transudatos rotulados como exsudato.', ref: { fonte: 'Porcel et al., ERJ Open Res 2026', pagina: 'Resultados' } },
    ],
    porQueUsar: [
      { texto: 'Em 7.280 toracocenteses, na coorte de derivação, sensibilidade de 98% e especificidade de 71% para exsudato.', ref: { fonte: 'Porcel et al., ERJ Open Res 2026', pagina: 'resumo e Resultados' } },
      { texto: 'Na coorte de validação, sensibilidade de 98% e especificidade de 69%.', ref: { fonte: 'Porcel et al., ERJ Open Res 2026', pagina: 'Tabela 3' } },
      { texto: 'Gradiente de albumina (soro menos líquido) de 1,2 g/dL ou menos: sensibilidade de 72% e especificidade de 90% para exsudato.', ref: { fonte: 'Porcel et al., ERJ Open Res 2026', pagina: 'Tabela 2' } },
    ],
  },
  'grace': {
    resumo: 'Estima o risco de morte hospitalar na síndrome coronariana aguda a partir de oito variáveis da admissão.',
    instrucoes: 'Informe idade, frequência cardíaca, pressão sistólica e creatinina e marque a classe de Killip, a parada cardíaca na admissão, o desvio do ST e o marcador de necrose; os pontos são somados.',
    quandoUsar: [
      { texto: 'Todo paciente com SCA sem supra de ST deve ser classificado em risco alto, intermediário ou baixo, de preferência por mais de um método.', ref: { fonte: 'SBC 2021, AI e IAM sem supra de ST', pagina: '5.3, sumário de recomendações', grau: 'I B' } },
      { texto: 'GRACE acima de 140 é critério de alto risco (estratégia invasiva precoce, em menos de 24 h); 109 a 140, de risco intermediário (invasiva em menos de 72 h).', ref: { fonte: 'SBC 2021, AI e IAM sem supra de ST', pagina: 'Tabela 2.1', grau: 'I A' } },
    ],
    porQueUsar: [
      { texto: 'Derivado em 11.389 pacientes (509 mortes hospitalares); estatística C de 0,83 na derivação, 0,84 na confirmação no GRACE e 0,79 no GUSTO-IIb.', ref: { fonte: 'Granger et al., Arch Intern Med 2003', pagina: 'resumo' } },
      { texto: 'Até 108 pontos: mortalidade hospitalar de 1% ou menos; 109 a 140: entre 1% e 3%; acima de 140: acima de 3%.', ref: { fonte: 'SBC 2021, AI e IAM sem supra de ST', pagina: '5.3.1' } },
    ],
  },
  'genebra-revisado': {
    resumo: 'Estima a probabilidade pré-teste de embolia pulmonar no pronto-socorro só com variáveis clínicas, sem depender do julgamento implícito do médico.',
    instrucoes: 'Marque a faixa de frequência cardíaca e cada item presente; os pontos são somados (0 a 3: baixa; 4 a 10: intermediária; 11 ou mais: alta).',
    quandoUsar: [
      { texto: 'No paciente do pronto-socorro com suspeita clínica de embolia pulmonar.', ref: { fonte: 'Le Gal et al., Ann Intern Med 2006', pagina: 'resumo' } },
      { texto: 'Por não ter itens subjetivos, foi preferido ao Wells de três níveis na avaliação inicial da suspeita de TEP.', ref: { fonte: 'Etemadi et al., BMC Pulm Med 2025', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na validação externa, prevalência de TEP de 8% na probabilidade baixa, 28% na intermediária e 74% na alta.', ref: { fonte: 'Le Gal et al., Ann Intern Med 2006', pagina: 'resumo' } },
      { texto: 'Em meta-análise de 40 estudos (37.027 pacientes), excluiu TEP de forma semelhante ao Wells de três níveis (razão de verossimilhança negativa de 0,39 contra 0,34).', ref: { fonte: 'Etemadi et al., BMC Pulm Med 2025', pagina: 'resumo' } },
    ],
  },
  'killip': {
    resumo: 'Classifica, de I a IV, a insuficiência cardíaca no infarto e entra no cálculo do escore GRACE.',
    instrucoes: 'Escolha a classe que descreve o exame: I sem estertores nem terceira bulha; II estertores em até metade dos campos, terceira bulha ou turgência jugular; III edema agudo de pulmão; IV choque cardiogênico.',
    quandoUsar: [
      { texto: 'No exame físico da SCA, terceira bulha e estertores pulmonares estão entre os achados de mau prognóstico.', ref: { fonte: 'SBC 2021, AI e IAM sem supra de ST', pagina: '5.2.2' } },
    ],
    porQueUsar: [
      { texto: 'No GRACE, a classe de Killip vale de 0 ponto (classe I) a 59 pontos (classe IV).', ref: { fonte: 'SBC 2021, AI e IAM sem supra de ST', pagina: 'Figura 1.4' } },
    ],
  },
  'psi-port': {
    resumo: 'Estratifica o adulto com pneumonia adquirida na comunidade em cinco classes de risco de morte em 30 dias, para ajudar a decidir sobre a internação.',
    instrucoes: 'Informe sexo e idade e marque cada comorbidade e cada achado de exame, laboratório e imagem presente; a soma dos pontos define a classe.',
    quandoUsar: [
      { texto: 'Junto com o julgamento clínico, para decidir se o adulto com PAC precisa de internação; preferir o PSI ao CURB-65.', ref: { fonte: 'ATS/IDSA 2019, PAC no adulto (Metlay et al.)', pagina: 'Pergunta 6', grau: 'Forte, qualidade moderada' } },
      { texto: 'Pode subestimar a gravidade no paciente jovem; use sempre com o julgamento clínico.', ref: { fonte: 'ATS/IDSA 2019, PAC no adulto (Metlay et al.)', pagina: 'Pergunta 6' } },
      { texto: 'Não foi feito para escolher o nível de cuidado (enfermaria ou UTI) do paciente já internado.', ref: { fonte: 'ATS/IDSA 2019, PAC no adulto (Metlay et al.)', pagina: 'Pergunta 7' } },
    ],
    porQueUsar: [
      { texto: 'Derivado em 14.199 internados e validado em 38.039 internados e em 2.287 pacientes internados e ambulatoriais da coorte PORT.', ref: { fonte: 'Fine et al., N Engl J Med 1997', pagina: 'resumo' } },
      { texto: 'Mortalidade de 0,1% a 0,4% na classe I, 0,6% a 0,7% na classe II e 0,9% a 2,8% na classe III.', ref: { fonte: 'Fine et al., N Engl J Med 1997', pagina: 'resumo' } },
      { texto: 'Dois ensaios randomizados por cluster mostraram que o PSI aumenta com segurança a proporção de pacientes tratados fora do hospital.', ref: { fonte: 'ATS/IDSA 2019, PAC no adulto (Metlay et al.)', pagina: 'Pergunta 6' } },
    ],
  },
  'wells-tep': {
    resumo: 'Estima a probabilidade pré-teste de embolia pulmonar, em três níveis ou como TEP provável ou improvável, para orientar o uso do D-dímero.',
    instrucoes: 'Marque cada item presente e informe a idade; os pontos são somados (abaixo de 2: baixa; 2 a 6: moderada; acima de 6: alta; 4 ou menos: TEP improvável). A idade define o limiar do D-dímero ajustado (idade × 10 a partir de 50 anos).',
    quandoUsar: [
      { texto: 'No paciente com suspeita de TEP: escore de 4 ou menos com D-dímero negativo pode excluir TEP sem outros exames.', ref: { fonte: 'Wells et al., Thromb Haemost 2000', pagina: 'resumo' } },
      { texto: 'O estudo ADJUST-PE validou o D-dímero ajustado pela idade (idade × 10, a partir de 50 anos), com a probabilidade clínica avaliada pelo Genebra revisado simplificado ou pelo Wells de dois níveis.', ref: { fonte: 'Righini et al., JAMA 2014 (ADJUST-PE)', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Com escore de 4 ou menos e D-dímero negativo, TEP em 2,2% na derivação e 1,7% na validação; essa combinação ocorreu em 46% dos pacientes.', ref: { fonte: 'Wells et al., Thromb Haemost 2000', pagina: 'resumo' } },
      { texto: 'Em 3.346 pacientes, falha de 0,3% em 3 meses com D-dímero entre 500 µg/L e o limiar ajustado; acima de 75 anos, a exclusão pelo D-dímero subiu de 6,4% para 29,7%, sem falso-negativo a mais.', ref: { fonte: 'Righini et al., JAMA 2014 (ADJUST-PE)', pagina: 'resumo' } },
    ],
  },
  'years': {
    resumo: 'Combina três itens clínicos com um limiar de D-dímero (1000 ou 500 ng/mL) para excluir embolia pulmonar sem angiotomografia.',
    instrucoes: 'Marque os itens YEARS presentes e informe o D-dímero: sem nenhum item, o limiar é 1000 ng/mL; com um ou mais itens, 500 ng/mL.',
    quandoUsar: [
      { texto: 'Na suspeita de TEP: sem itens YEARS e D-dímero abaixo de 1000 ng/mL, ou com itens e D-dímero abaixo de 500 ng/mL, o TEP foi considerado excluído; os demais fizeram angiotomografia.', ref: { fonte: 'van der Hulle et al., Lancet 2017', pagina: 'resumo' } },
      { texto: 'Também no paciente com câncer ativo, o YEARS foi tão seguro quanto fazer angiotomografia em todos e a dispensou em 22%.', ref: { fonte: 'Akerboom et al., JAMA 2026 (Hydra)', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em 3.465 pacientes, 0,61% de TEV em 3 meses após a exclusão; a angiotomografia não foi indicada em 48%, 14% a menos de exames que Wells com D-dímero fixo.', ref: { fonte: 'van der Hulle et al., Lancet 2017', pagina: 'resumo' } },
      { texto: 'No câncer ativo (698 pacientes randomizados), eventos em 90 dias em 1,8% no grupo YEARS contra 5,5% no grupo só angiotomografia.', ref: { fonte: 'Akerboom et al., JAMA 2026 (Hydra)', pagina: 'resumo' } },
    ],
  },
  'timi-iamcsst': {
    resumo: 'Estima a mortalidade em 30 dias do paciente com IAM com supra de ST elegível a fibrinólise, já na apresentação.',
    instrucoes: 'Marque a faixa de idade e cada item presente; os pontos são somados, de 0 a 14.',
    quandoUsar: [
      { texto: 'Na triagem e no manejo do paciente com IAM com supra de ST elegível a fibrinólise.', ref: { fonte: 'Morrow et al., Circulation 2000', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Derivado em 14.114 pacientes do InTIME II (mortalidade média de 6,7% em 30 dias); mortalidade abaixo de 1% com escore 0 e aumento de mais de 40 vezes ao longo dos escores.', ref: { fonte: 'Morrow et al., Circulation 2000', pagina: 'resumo' } },
      { texto: 'Estatística C de 0,779, próxima à do modelo completo (0,784), e de 0,746 na validação externa no TIMI 9.', ref: { fonte: 'Morrow et al., Circulation 2000', pagina: 'resumo' } },
    ],
  },
  'sincope-canadense': {
    resumo: 'Estima o risco de evento grave em 30 dias no paciente atendido no pronto-socorro por síncope, depois da avaliação inicial.',
    instrucoes: 'Marque cada item presente e escolha o diagnóstico do pronto-socorro (vasovagal −2, nem vasovagal nem cardíaca 0, cardíaca +2); a soma vai de −3 a 11.',
    quandoUsar: [
      { texto: 'No paciente de 16 anos ou mais atendido em até 24 horas da síncope, quando a avaliação no pronto-socorro não achou causa grave.', ref: { fonte: 'Thiruganasambandamoorthy et al., JAMA Intern Med 2020', pagina: 'resumo' } },
      { texto: 'Risco muito baixo e baixo em geral podem ter alta; no alto risco, pode-se considerar internação breve.', ref: { fonte: 'Thiruganasambandamoorthy et al., JAMA Intern Med 2020', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Derivado em 4030 pacientes (evento grave em 3,6% em 30 dias); estatística C de 0,88.', ref: { fonte: 'Thiruganasambandamoorthy et al., CMAJ 2016', pagina: 'resumo' } },
      { texto: 'Validação em 3819 pacientes: AUC de 0,91; evento grave de 0,3% no risco muito baixo a 51,3% no muito alto; no corte de −1, sensibilidade de 97,8% e especificidade de 44,3%.', ref: { fonte: 'Thiruganasambandamoorthy et al., JAMA Intern Med 2020', pagina: 'resumo' } },
    ],
  },
  'sgarbossa-modificado': {
    resumo: 'Ajuda a reconhecer no ECG o infarto por oclusão coronária aguda quando há bloqueio de ramo esquerdo ou ritmo de marca-passo ventricular.',
    instrucoes: 'Escolha o ritmo de base e marque os critérios presentes; basta um positivo. Para o supra discordante, informe o supra de ST e a profundidade da onda S na mesma derivação: razão ST/S de −0,25 ou menor é positiva.',
    quandoUsar: [
      { texto: 'No paciente com BRE e suspeita de infarto agudo, como revisão da regra de Sgarbossa: regra não ponderada, basta 1 dos 3 critérios.', ref: { fonte: 'Smith et al., Ann Emerg Med 2012', pagina: 'resumo' } },
      { texto: 'Também no ritmo de marca-passo ventricular com sintomas de SCA.', ref: { fonte: 'Dodd et al., Ann Emerg Med 2021', pagina: 'resumo' } },
      { texto: 'No pronto-socorro com baixa prevalência de oclusão, o ECG sozinho não basta: valor preditivo positivo de 9,4% e negativo acima de 98,0%.', ref: { fonte: 'Lindow et al., Int J Cardiol 2023', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na derivação (33 casos e 129 controles), sensibilidade de 91% e especificidade de 90%.', ref: { fonte: 'Smith et al., Ann Emerg Med 2012', pagina: 'resumo' } },
      { texto: 'Na validação (45 oclusões e 249 controles), sensibilidade de 80% e especificidade de 99%.', ref: { fonte: 'Meyers et al., Am Heart J 2015', pagina: 'resumo' } },
      { texto: 'No marca-passo ventricular, sensibilidade de 81% e especificidade de 96% contra controles do pronto-socorro.', ref: { fonte: 'Dodd et al., Ann Emerg Med 2021', pagina: 'resumo' } },
    ],
  },
  'spesi': {
    resumo: 'Estima o risco de morte em 30 dias no paciente com embolia pulmonar aguda sintomática, separando baixo risco (0 ponto) de alto risco (1 ponto ou mais).',
    instrucoes: 'Marque cada item presente; cada um vale 1 ponto. Zero é baixo risco; 1 ou mais, alto risco.',
    quandoUsar: [
      { texto: 'No TEP agudo confirmado, como versão simplificada do PESI, com a mesma acurácia e mais fácil de usar.', ref: { fonte: 'Jiménez et al., Arch Intern Med 2010', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na derivação (995 pacientes), 30,7% foram de baixo risco, com mortalidade em 30 dias de 1,0%, contra 10,9% no alto risco; área sob a curva de 0,75.', ref: { fonte: 'Jiménez et al., Arch Intern Med 2010', pagina: 'resumo' } },
      { texto: 'Na validação RIETE (7106 pacientes), 36,2% de baixo risco, com mortalidade de 1,1%, contra 8,9% no alto risco.', ref: { fonte: 'Jiménez et al., Arch Intern Med 2010', pagina: 'resumo' } },
    ],
  },
  'crb-65': {
    resumo: 'Gradua a gravidade da pneumonia adquirida na comunidade pelo risco de morte em 30 dias, com quatro critérios só de história e exame físico.',
    instrucoes: 'Marque cada critério presente (1 ponto cada): 0 é baixo risco; 1 ou 2, intermediário; 3 ou 4, alto.',
    quandoUsar: [
      { texto: 'Para estimar a gravidade da PAC e ajudar o médico a organizar o tratamento, inclusive o local de cuidado.', ref: { fonte: 'McNally et al., Br J Gen Pract 2010', pagina: 'Introdução' } },
      { texto: 'Na atenção primária, use com cautela: na comunidade, o escore superestima a mortalidade em todas as faixas.', ref: { fonte: 'McNally et al., Br J Gen Pract 2010', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Meta-análise de 14 estudos (397.875 pacientes): no hospital, a mortalidade prevista bateu com a observada no risco intermediário (RR 0,91) e no alto (RR 1,01).', ref: { fonte: 'McNally et al., Br J Gen Pract 2010', pagina: 'resumo' } },
      { texto: 'Mortalidade observada: no hospital, 2,4% (baixo), 13,3% (intermediário) e 34,3% (alto); na comunidade, 0,0%, 1,6% e 18,5%.', ref: { fonte: 'McNally et al., Br J Gen Pract 2010', pagina: 'Tabela 2' } },
      { texto: 'No estudo de derivação, mortalidade de 1,2% no risco baixo, 8,2% no intermediário e 31,3% no alto.', ref: { fonte: 'McNally et al., Br J Gen Pract 2010 (citando Lim et al., Thorax 2003)', pagina: 'Métodos' } },
    ],
  },
  'child-pugh': {
    instrucoes: 'Marque bilirrubina total, albumina, INR, ascite e encefalopatia hepática; cada item vale de 1 a 3 pontos e a soma define a classe A, B ou C.',
  },
  'alvarado': {
    resumo: 'Estima a probabilidade de apendicite aguda no paciente com dor abdominal sugestiva, a partir de achados de história, exame físico e hemograma.',
    instrucoes: 'Marque os oito achados presentes: dor à palpação em fossa ilíaca direita e leucocitose valem 2 pontos e os demais, 1 ponto cada, num total de 0 a 10.',
    quandoUsar: [
      { texto: 'A WSES recomenda usar escores clínicos, como o Alvarado, para afastar apendicite aguda e identificar o paciente de risco intermediário, que precisa de exame de imagem.', ref: { fonte: 'Di Saverio et al., World J Emerg Surg 2020 (WSES)', pagina: 'Q.1.1', grau: 'Forte; qualidade da evidência alta (1A)' } },
      { texto: 'Não use o Alvarado para confirmar apendicite no adulto: ele não é específico o bastante, não diferencia a forma complicada da não complicada no idoso e é menos sensível no paciente com HIV.', ref: { fonte: 'Di Saverio et al., World J Emerg Surg 2020 (WSES)', pagina: 'Q.1.1', grau: 'Fraca contra; qualidade da evidência moderada (2B)' } },
      { texto: 'Na edição mais recente, a WSES reafirma que escores clínicos de risco e exames de imagem melhoram a acurácia diagnóstica e reduzem as apendicectomias negativas.', ref: { fonte: 'Podda et al., JAMA Surg 2026 (WSES 2025)', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Pontuação abaixo de 5 tem sensibilidade de 99% para afastar apendicite aguda, embora o escore não seja específico.', ref: { fonte: 'Di Saverio et al., World J Emerg Surg 2020 (WSES)', pagina: 'Q.1.1 (discussão)' } },
      { texto: 'Em 350 pacientes com suspeita de apendicite, Alvarado de 7 ou mais em homens e de 9 ou mais em mulheres teve razão de verossimilhança positiva comparável à da tomografia.', ref: { fonte: 'Di Saverio et al., World J Emerg Surg 2020 (WSES)', pagina: 'Q.1.1 (discussão)' } },
      { texto: 'Em metanálise de 26 estudos (15.699 pacientes), a área sob a curva ROC do Alvarado foi 0,79, menor que a do escore AIR (0,86).', ref: { fonte: 'Andersson e Stark, World J Emerg Surg 2025', pagina: 'resumo' } },
    ],
  },
  'abcd2': {
    resumo: 'Estima o risco de AVC nos primeiros dias depois de um ataque isquêmico transitório, para orientar a conduta na emergência.',
    instrucoes: 'Some idade, pressão arterial na avaliação, quadro clínico, duração do déficit e diabetes; o total vai de 0 a 7 pontos.',
    quandoUsar: [
      { texto: 'Não use o ABCD2 sozinho para identificar o paciente de alto risco nem para decidir triagem e tratamento no AIT suspeito: a sensibilidade é limitada e quem tem 3 pontos ou menos também pode estar em risco de novo AVC.', ref: { fonte: 'Fonseca et al., Eur Stroke J 2021 (ESO)', pagina: 'resumo; PICO 4.1', grau: 'Fraca contra; qualidade da evidência muito baixa' } },
      { texto: 'A ESO considera AIT de alto risco, entre outros critérios, ABCD2 de 4 ou mais, fraqueza ou alteração da fala por mais de cinco minutos, eventos recorrentes ou doença significativa de grande artéria ipsilateral.', ref: { fonte: 'Fonseca et al., Eur Stroke J 2021 (ESO)', pagina: 'resumo' } },
      { texto: 'Não serve para afastar AVC agudo na unidade de observação da emergência: quase 20% dos classificados como baixo risco tiveram AVC agudo diagnosticado.', ref: { fonte: 'Lumia et al., Crit Pathw Cardiol 2026', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na validação, o risco de AVC em 2 dias foi de 8,1% no alto risco (6 a 7 pontos), 4,1% no risco moderado (4 a 5) e 1,0% no baixo risco (0 a 3), com estatística C de 0,62 a 0,83.', ref: { fonte: 'Johnston et al., Lancet 2007', pagina: 'resumo' } },
      { texto: 'Em análise agrupada de estudos observacionais, o AVC em 7 dias foi de 1,8% com ABCD2 de 3 ou menos e de 5,3% com ABCD2 de 4 ou mais.', ref: { fonte: 'Fonseca et al., Eur Stroke J 2021 (ESO)', pagina: 'PICO 4.1 (análise)' } },
      { texto: 'Em metanálise em rede, todos os escores avaliados tiveram desempenho baixo para prever AVC em 90 dias após o AIT (sensibilidade agrupada de 48% a 64% e especificidade de 59% a 72%).', ref: { fonte: 'Deris et al., J Clin Med 2025', pagina: 'resumo' } },
    ],
  },
  '4t-hit': {
    resumo: 'Estima a probabilidade pré-teste de trombocitopenia induzida por heparina, separando-a das outras causas de queda das plaquetas no paciente em uso de heparina.',
    instrucoes: 'Pontue de 0 a 2 cada um dos quatro itens (queda e nadir das plaquetas, tempo entre a heparina e a queda, trombose ou outra sequela e outras causas de trombocitopenia), num total de 0 a 8. Se faltar informação, a diretriz da ASH considera prudente errar para a pontuação mais alta.',
    quandoUsar: [
      { texto: 'Na suspeita de trombocitopenia induzida por heparina, use o 4T, e não a impressão clínica, para estimar a probabilidade; com probabilidade intermediária ou alta, a ASH recomenda imunoensaio.', ref: { fonte: 'Cuker et al., Blood Adv 2018 (ASH)', pagina: 'rec. 2.1', grau: 'Forte; certeza moderada' } },
      { texto: 'Com probabilidade baixa no 4T, a ASH recomenda não pedir exames laboratoriais de trombocitopenia induzida por heparina, salvo dúvida sobre a pontuação (por exemplo, dados faltando).', ref: { fonte: 'Cuker et al., Blood Adv 2018 (ASH)', pagina: 'rec. 2.2', grau: 'Forte; certeza moderada' } },
      { texto: 'Com probabilidade baixa no 4T, a ASH recomenda não tratar empiricamente, ou seja, não suspender a heparina para iniciar anticoagulante não heparínico.', ref: { fonte: 'Cuker et al., Blood Adv 2018 (ASH)', pagina: 'rec. 2.3', grau: 'Forte; certeza moderada' } },
    ],
    porQueUsar: [
      { texto: 'Em metanálise de treze estudos com 3.068 pacientes, o valor preditivo negativo da baixa probabilidade no 4T foi 0,998.', ref: { fonte: 'Cuker et al., Blood 2012', pagina: 'resumo' } },
      { texto: 'O valor preditivo positivo foi 0,14 na probabilidade intermediária e 0,64 na probabilidade alta.', ref: { fonte: 'Cuker et al., Blood 2012', pagina: 'resumo' } },
      { texto: 'No estudo original, em dois centros, quem teve pontuação baixa raramente teve anticorpos anti-heparina positivos: 1 de 64 (1,6%) e 0 de 55 (0%).', ref: { fonte: 'Lo et al., J Thromb Haemost 2006', pagina: 'resumo' } },
    ],
  },
  'aims65': {
    resumo: 'Prevê a mortalidade hospitalar na hemorragia digestiva alta aguda com cinco dados disponíveis na chegada.',
    instrucoes: 'Marque um ponto para cada item presente na chegada: albumina abaixo de 3,0 g/dL, INR acima de 1,5, alteração do estado mental, pressão sistólica de 90 mmHg ou menos e idade acima de 65 anos, num total de 0 a 5.',
    quandoUsar: [
      { texto: 'Para prever morte, AIMS65 de 2 ou mais foi o corte ótimo num estudo prospectivo internacional (sensibilidade de 65,8% a 78,6% e especificidade de 65,0% a 65,3% entre os escores comparados).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
      { texto: 'Para prever necessidade de intervenção ou morte, o Glasgow-Blatchford (área sob a curva 0,86) foi melhor que o AIMS65 (0,68).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
      { texto: 'Nenhum escore, AIMS65 inclusive, ajudou a prever ressangramento ou tempo de internação.', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na base de 187 hospitais dos EUA, o escore foi derivado em 29.222 pacientes e validado em 32.504.', ref: { fonte: 'Saltzman et al., Gastrointest Endosc 2011', pagina: 'resumo' } },
      { texto: 'A mortalidade foi de 0,3% sem nenhum fator e de 31,8% com os 5 fatores; a área sob a curva foi 0,80 na derivação e 0,77 na validação.', ref: { fonte: 'Saltzman et al., Gastrointest Endosc 2011', pagina: 'resumo' } },
      { texto: 'Em estudo prospectivo internacional, AIMS65 e PNED (área sob a curva 0,77) foram os melhores para prever mortalidade, acima do Rockall de admissão (0,72) e do Glasgow-Blatchford (0,64).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
  },
  'bisap': {
    resumo: 'Identifica, nas primeiras 24 horas, o paciente com pancreatite aguda com maior risco de morte hospitalar.',
    instrucoes: 'Com os dados das primeiras 24 horas, informe a ureia e marque alteração do estado mental, SIRS com dois ou mais critérios, idade acima de 60 anos e derrame pleural na imagem; cada item presente vale 1 ponto.',
    quandoUsar: [
      { texto: 'Para a predição precoce da gravidade, a diretriz ibero-latino-americana recomenda o BISAP e a SIRS persistente pela simplicidade, apesar da acurácia limitada.', ref: { fonte: 'Cárdenas-Jaén et al., UEG J 2026 (iLATAM-AP)', pagina: 'Tabela 1 (Q6)', grau: 'Forte; evidência de baixa qualidade' } },
      { texto: 'Pancreatite grave prevista (BISAP de 3 ou mais, ou SIRS persistente) indica internação em cuidados intermediários; se não houver, monitorização próxima.', ref: { fonte: 'Cárdenas-Jaén et al., UEG J 2026 (iLATAM-AP)', pagina: 'Tabela 1 (Q7)', grau: 'Forte; evidência de qualidade moderada' } },
      { texto: 'Não há escore padrão-ouro; o BISAP é provavelmente um dos mais acurados e aplicáveis na prática, pela simplicidade e por prever gravidade, morte e falência orgânica.', ref: { fonte: 'Leppäniemi et al., World J Emerg Surg 2019 (WSES)', pagina: 'statements (diagnóstico)', grau: '1B' } },
    ],
    porQueUsar: [
      { texto: 'Foi derivado em 17.992 casos de 212 hospitais e validado em 18.256 casos de 177 hospitais.', ref: { fonte: 'Wu et al., Gut 2008', pagina: 'resumo' } },
      { texto: 'A mortalidade variou de mais de 20% no grupo de maior risco a menos de 1% no de menor risco; na validação, a área sob a curva foi 0,82, semelhante à do APACHE II (0,83).', ref: { fonte: 'Wu et al., Gut 2008', pagina: 'resumo' } },
      { texto: 'Em metanálise, com probabilidade pré-teste de pancreatite grave de 16,6% a 25,3%, o BISAP positivo elevou a probabilidade para 47% e o negativo a reduziu para 6%.', ref: { fonte: 'Capurso et al., UEG J 2023', pagina: 'resumo' } },
    ],
  },
  'civd-isth': {
    resumo: 'Diagnostica a CIVD manifesta, a fase avançada da coagulação intravascular disseminada, com exames de coagulação de rotina no paciente com doença de base compatível.',
    instrucoes: 'Confirme a doença de base compatível com CIVD e pontue plaquetas, D-dímero (ou produtos de degradação da fibrina), prolongamento do tempo de protrombina e fibrinogênio, num total de 0 a 8; o predomínio clínico (sangramento ou trombose) é registrado e não pontua.',
    quandoUsar: [
      { texto: 'Na sepse, os critérios de CIVD manifesta do ISTH servem para diagnosticar a CIVD avançada e prever mortalidade; para a CIVD precoce e o início do tratamento, a diretriz japonesa usa os critérios JAAM-DIC e SIC.', ref: { fonte: 'Shime et al., J Intensive Care 2025 (J-SSCG 2024)', pagina: 'CQ5-1', grau: 'Questão de fundo (informação, sem graduação)' } },
      { texto: 'A atualização do ISTH mantém, com modificações, o escore de CIVD manifesta para a fase tardia e propõe critérios próprios por doença de base para detectar a fase precoce.', ref: { fonte: 'Iba et al., J Thromb Haemost 2025 (ISTH SSC)', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'O escore de CIVD com exames globais de coagulação se correlaciona com achados clínicos e desfechos importantes.', ref: { fonte: 'Wada et al., J Thromb Haemost 2013 (harmonização de três diretrizes)', pagina: 'resumo', grau: 'Qualidade moderada' } },
      { texto: 'O diagnóstico confiável de CIVD pode ser feito com algoritmos de pontuação simples, baseados em exames de hemostasia de rotina.', ref: { fonte: 'Levi e Scully, Blood 2018', pagina: 'resumo' } },
      { texto: 'Os critérios de CIVD manifesta são mais estritos que os critérios JAAM-DIC e SIC e servem para evitar sobrediagnóstico e identificar os casos graves.', ref: { fonte: 'Shime et al., J Intensive Care 2025 (J-SSCG 2024)', pagina: 'CQ5-1 (comentário)' } },
    ],
  },
  'four': {
    resumo: 'Mede o nível de consciência do paciente crítico, inclusive intubado, avaliando olhos, resposta motora, reflexos de tronco e respiração.',
    instrucoes: 'Pontue de 0 a 4 a resposta ocular, a resposta motora, os reflexos de tronco e a respiração; o total vai de 0 a 16.',
    quandoUsar: [
      { texto: 'Diferente da escala de Glasgow, todos os componentes do FOUR podem ser avaliados mesmo no paciente intubado.', ref: { fonte: 'Iyer et al., Mayo Clin Proc 2009', pagina: 'resumo' } },
      { texto: 'Dá mais detalhe neurológico que a escala de Glasgow: inclui reflexos de tronco e padrão respiratório, reconhece a síndrome do encarceramento e os estágios de herniação.', ref: { fonte: 'Wijdicks et al., Ann Neurol 2005', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em 120 pacientes de UTI, a concordância entre avaliadores foi excelente (kappa ponderado de 0,82).', ref: { fonte: 'Wijdicks et al., Ann Neurol 2005', pagina: 'resumo' } },
      { texto: 'Na UTI clínica, previu desfecho neurológico ruim (Rankin modificado de 3 a 6) tão bem quanto a escala de Glasgow: área sob a curva de 0,75 contra 0,76.', ref: { fonte: 'Iyer et al., Mayo Clin Proc 2009', pagina: 'resumo' } },
      { texto: 'A mortalidade com FOUR 0 (89%) foi maior que com Glasgow 3 (71%), a pontuação mínima de cada escala.', ref: { fonte: 'Iyer et al., Mayo Clin Proc 2009', pagina: 'resumo' } },
    ],
  },
  'glasgow-blatchford': {
    resumo: 'Prevê, com dados da chegada e antes da endoscopia, a necessidade de transfusão ou de intervenção para controlar o sangramento na hemorragia digestiva alta.',
    instrucoes: 'Informe sexo, ureia, hemoglobina, pressão sistólica e frequência cardíaca, e marque melena, síncope, doença hepática e insuficiência cardíaca, com dados anteriores à endoscopia.',
    quandoUsar: [
      { texto: 'Na emergência, a diretriz do ACG sugere estratificar o risco para identificar o paciente de muito baixo risco (Glasgow-Blatchford de 0 a 1), que pode ter alta com seguimento ambulatorial.', ref: { fonte: 'Laine et al., Am J Gastroenterol 2021 (ACG)', pagina: 'resumo' } },
      { texto: 'Pontuação de 1 ou menos parece o limiar ideal para encaminhar ao manejo ambulatorial.', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo (conclusão)' } },
      { texto: 'Não é o melhor escore para prever mortalidade: área sob a curva de 0,64, abaixo de AIMS65 e PNED (0,77).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na validação prospectiva do estudo original, o escore discriminou bem quem precisou de tratamento: área sob a curva ROC de 0,92.', ref: { fonte: 'Blatchford et al., Lancet 2000', pagina: 'resumo' } },
      { texto: 'Em estudo prospectivo internacional, foi o melhor escore para prever intervenção hospitalar ou morte (área sob a curva 0,86), à frente de Rockall completo (0,70), PNED (0,69), AIMS65 (0,68) e Rockall de admissão (0,66).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
      { texto: 'Pontuação de 1 ou menos previu sobrevida sem intervenção com sensibilidade de 98,6% e especificidade de 34,6%; pontuação de 7 ou mais previu tratamento endoscópico com sensibilidade de 80% e especificidade de 57%.', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
  },
  'meld-3': {
    resumo: 'Estima a sobrevida em até 90 dias do paciente com doença hepática avançada, atualizando o MELD-Na com sexo e albumina.',
    instrucoes: 'Informe bilirrubina total, INR, creatinina, sódio e albumina, o sexo e se há diálise duas ou mais vezes na semana; a calculadora mostra também o MELD-Na e o MELD original para comparação.',
    quandoUsar: [
      { texto: 'Foi criado para substituir o MELD-Na na priorização de pacientes com cirrose na lista de transplante hepático dos EUA.', ref: { fonte: 'Mazumder e Fontana, Annu Rev Med 2024', pagina: 'resumo' } },
      { texto: 'O uso do MELD 3.0 para estratificar risco antes de cirurgia abdominal maior, TIPS e outras intervenções no paciente com cirrose ainda precisa de estudo.', ref: { fonte: 'Mazumder e Fontana, Annu Rev Med 2024', pagina: 'resumo' } },
      { texto: 'O MELD é medida confiável do risco de morte na doença hepática terminal e serve como índice de gravidade da doença.', ref: { fonte: 'Kamath et al., Hepatology 2001', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na lista de transplante dos EUA, o MELD 3.0 discriminou melhor que o MELD-Na (estatística C de 0,869 contra 0,862) e reclassificou para faixa mais alta 8,8% dos pacientes que morreram, sobretudo mulheres.', ref: { fonte: 'Kim et al., Gastroenterology 2021', pagina: 'resumo' } },
      { texto: 'O MELD original previu bem a morte em 3 meses: estatística C de 0,87 em internados por descompensação, 0,80 em ambulatoriais sem colestase, 0,87 em cirrose biliar primária e 0,78 numa coorte histórica de cirróticos.', ref: { fonte: 'Kamath et al., Hepatology 2001', pagina: 'resumo' } },
      { texto: 'O sódio sérico soma informação ao MELD: razão de risco de morte de 1,21 por ponto de MELD e de 1,05 a cada 1 unidade de queda do sódio entre 125 e 140 mmol/L.', ref: { fonte: 'Kim et al., N Engl J Med 2008', pagina: 'resumo' } },
    ],
  },
  'ranson': {
    resumo: 'Prevê pancreatite aguda grave combinando dados da admissão com dados das primeiras 48 horas.',
    instrucoes: 'Marque os cinco critérios da admissão e, ao completar 48 horas, os seis critérios do período; cada critério presente vale 1 ponto.',
    quandoUsar: [
      { texto: 'Ao contrário da maioria dos escores, aplicados na admissão, o Ranson também depende de dados de 48 horas.', ref: { fonte: 'Cárdenas-Jaén et al., UEG J 2026 (iLATAM-AP)', pagina: 'Q6 (comentários)' } },
      { texto: 'Para a predição precoce da gravidade, a diretriz ibero-latino-americana recomenda o BISAP e a SIRS persistente pela simplicidade, apesar da acurácia limitada.', ref: { fonte: 'Cárdenas-Jaén et al., UEG J 2026 (iLATAM-AP)', pagina: 'Tabela 1 (Q6)', grau: 'Forte; evidência de baixa qualidade' } },
      { texto: 'A metanálise conclui que os escores mais usados para prever pancreatite grave, Ranson inclusive, têm desempenho fraco e não ajudam na decisão.', ref: { fonte: 'Capurso et al., UEG J 2023', pagina: 'resumo (conclusão)' } },
    ],
    porQueUsar: [
      { texto: 'Em metanálise, com probabilidade pré-teste de pancreatite grave de 16,6% a 25,3%, o Ranson positivo elevou a probabilidade para 48% e o negativo a reduziu para 5%.', ref: { fonte: 'Capurso et al., UEG J 2023', pagina: 'resumo' } },
      { texto: 'Em 18 estudos que compararam BISAP, APACHE II e Ranson (6.740 pacientes, probabilidade pré-teste de 18,7%), o Ranson positivo levou a 50% e o negativo a 6%.', ref: { fonte: 'Capurso et al., UEG J 2023', pagina: 'resumo' } },
      { texto: 'Esses escores, Ranson inclusive, têm acurácia limitada (70% a 80%), com valor preditivo negativo alto e positivo baixo para pancreatite grave.', ref: { fonte: 'Cárdenas-Jaén et al., UEG J 2026 (iLATAM-AP)', pagina: 'Q6 (comentários)' } },
    ],
  },
  'rockall': {
    resumo: 'Classifica o paciente com hemorragia digestiva alta aguda pelo risco de morte, na apresentação e depois da endoscopia.',
    instrucoes: 'Pontue idade, estado hemodinâmico e comorbidade; o diagnóstico endoscópico e o estigma de sangramento recente só pontuam depois da endoscopia e formam o Rockall completo.',
    quandoUsar: [
      { texto: 'Serve para ajustar a casuística em auditoria e pesquisa e para reconhecer quem tem baixo risco de ressangramento e risco de morte desprezível, candidato a alta precoce: 15% dos casos na apresentação e 26% depois da endoscopia.', ref: { fonte: 'Rockall et al., Gut 1996', pagina: 'resumo' } },
      { texto: 'Para prever morte, os cortes ótimos foram Rockall de admissão de 4 ou mais e Rockall completo de 5 ou mais.', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
      { texto: 'Nenhum escore, Rockall inclusive, ajudou a prever ressangramento ou tempo de internação.', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Veio de estudo prospectivo, multicêntrico e de base populacional com 4.185 casos de hemorragia digestiva alta acima de 16 anos e outros 1.625 casos no ano seguinte.', ref: { fonte: 'Rockall et al., Gut 1996', pagina: 'resumo' } },
      { texto: 'Testado numa segunda população, previu de forma reprodutível a mortalidade em cada categoria de risco.', ref: { fonte: 'Rockall et al., Gut 1996', pagina: 'resumo' } },
      { texto: 'Para mortalidade, o Rockall de admissão teve área sob a curva de 0,72, abaixo de AIMS65 e PNED (0,77) e acima do Glasgow-Blatchford (0,64).', ref: { fonte: 'Stanley et al., BMJ 2017', pagina: 'resumo' } },
    ],
  },
  'fast-ed': {
    resumo: 'Identifica, com cinco itens do NIHSS, o paciente com AVC isquêmico com provável oclusão de grande vaso.',
    instrucoes: 'Pontue paralisia facial, fraqueza do braço, alteração da fala, desvio do olhar e negação ou negligência pelas equivalências do NIHSS; o total vai de 0 a 9 e o horário é registrado sem pontuar.',
    quandoUsar: [
      { texto: 'Foi feita para o atendimento pré-hospitalar: se validada em campo, pode ajudar a equipe de emergência a reconhecer a oclusão de grande vaso e agilizar a triagem.', ref: { fonte: 'Lima et al., Stroke 2016', pagina: 'resumo (conclusão)' } },
      { texto: 'No estudo, oclusão de grande vaso foi a oclusão total de carótida interna intracraniana, ACM M1, ACM M2 ou basilar; oclusões parciais, bi-hemisféricas e de circulação anterior e posterior juntas foram excluídas.', ref: { fonte: 'Lima et al., Stroke 2016', pagina: 'resumo (métodos)' } },
    ],
    porQueUsar: [
      { texto: 'Em 727 pacientes (oclusão de grande vaso em 240, 33%), a FAST-ED teve área sob a curva de 0,81, semelhante ao NIHSS (0,80) e maior que RACE (0,77) e CPSS (0,75).', ref: { fonte: 'Lima et al., Stroke 2016', pagina: 'resumo' } },
      { texto: 'FAST-ED de 4 ou mais: sensibilidade de 0,60, especificidade de 0,89, valor preditivo positivo de 0,72 e negativo de 0,82.', ref: { fonte: 'Lima et al., Stroke 2016', pagina: 'resumo' } },
    ],
  },
  'race': {
    resumo: 'Prevê oclusão de grande vaso no AVC agudo com uma escala simples, feita para ser aplicada antes da chegada ao hospital.',
    instrucoes: 'Pontue paralisia facial, função motora do braço e da perna, desvio da cabeça e do olhar e, conforme o lado da hemiparesia, afasia (direita) ou agnosia (esquerda); o total vai de 0 a 9.',
    quandoUsar: [
      { texto: 'Os autores sugerem estudar a escala primeiro como ferramenta de triagem em regiões onde os centros primários de AVC não ficam longe de um centro abrangente.', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'p. 90 (discussão)' } },
      { texto: 'Especificidade e valor preditivo positivo são moderados, sobretudo porque o AVC hemorrágico grave também pontua alto.', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'p. 90 (discussão)' } },
      { texto: 'Foi desenhada com pacientes com AVC isquêmico da circulação anterior; a validação prospectiva incluiu poucos casos de circulação posterior (7%) e de hemorragia cerebral (14,6%).', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'p. 90 (limitações)' } },
    ],
    porQueUsar: [
      { texto: 'Na validação prospectiva pré-hospitalar, houve oclusão de grande vaso em 76 de 357 pacientes (21%), e a área sob a curva da RACE foi 0,82, próxima à do NIHSS (0,85).', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'resumo, p. 87' } },
      { texto: 'O melhor corte foi 5: sensibilidade de 0,85, especificidade de 0,68, valor preditivo positivo de 0,42 e negativo de 0,94.', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'p. 89; Tabela 3' } },
      { texto: 'Com RACE de 5 ou mais, 29 de 154 pacientes (19%) receberam tratamento endovascular, contra 4 de 203 (2%) com RACE abaixo de 5.', ref: { fonte: 'Pérez de la Ossa et al., Stroke 2014', pagina: 'p. 89' } },
    ],
  },
  'news2': {
    resumo: 'Mede a gravidade da doença aguda no adulto pelos sinais vitais à beira do leito e ajuda a detectar a deterioração clínica.',
    instrucoes: 'Registre os seis parâmetros fisiológicos e diga se o paciente está em ar ambiente ou em oxigênio. Use a escala 2 de SpO₂ só no paciente com hipercapnia e alvo de saturação de 88–92%.',
    quandoUsar: [
      { texto: 'No pronto-socorro, para apoiar a avaliação inicial, a monitorização contínua e as decisões de triagem.', ref: { fonte: 'RCP, NEWS2 2017', pagina: 'rec. 8, p. xvii' } },
      { texto: 'Escore total de 5 ou 6 é risco médio e o limiar-chave para resposta clínica urgente; 7 ou mais é risco alto.', ref: { fonte: 'RCP, NEWS2 2017', pagina: 'rec. 11, p. xvii' } },
      { texto: 'Não usar em menores de 16 anos nem na gestante, porque a resposta fisiológica à doença aguda é diferente.', ref: { fonte: 'RCP, NEWS2 2017', pagina: 'rec. 2, p. xvii' } },
    ],
    porQueUsar: [
      { texto: 'Em quase 200.000 registros de sinais vitais de mais de 35.000 internações clínicas agudas no Reino Unido, o NEWS foi superior a todos os outros escores de alerta avaliados para prever parada cardíaca, UTI não planejada ou morte em 24 horas.', ref: { fonte: 'RCP, NEWS2 2017', pagina: 'seção 3, p. 10' } },
      { texto: 'Na triagem do pronto-socorro, NEWS de 3 ou mais teve sensibilidade de 93% e especificidade de 77% para identificar o paciente em risco de sepse grave.', ref: { fonte: 'RCP, NEWS2 2017', pagina: 'seção 3, p. 12' } },
      { texto: 'Na versão brasileira, em 295 adultos com sepse suspeita ou confirmada num pronto-socorro do sul do Brasil, a AUC para deterioração clínica foi 0,703 na classificação de risco e 0,871 na última avaliação; para mortalidade hospitalar, 0,770 na segunda avaliação.', ref: { fonte: 'Sousa et al., Rev Gaúcha Enferm 2025', pagina: 'resumo' } },
    ],
  },
  'cam-icu': {
    resumo: 'Diagnostica delirium no paciente de UTI, inclusive no intubado em ventilação mecânica, por avaliações padronizadas que não dependem da fala.',
    instrucoes: 'Registre primeiro o RASS do momento: com −4 ou −5 o paciente não é avaliável. Depois marque cada uma das quatro características.',
    quandoUsar: [
      { texto: 'Todo adulto crítico deve ser avaliado regularmente para delirium com um instrumento válido.', ref: { fonte: 'PADIS 2018 (SCCM)', pagina: 'seção Delirium, Assessment', grau: 'boa prática (sem graduação)' } },
      { texto: 'Sem instrumento validado de rastreio, enfermeiros e médicos à beira do leito deixam de reconhecer o delirium.', ref: { fonte: 'PADIS 2018 (SCCM)', pagina: 'seção Delirium, Assessment' } },
    ],
    porQueUsar: [
      { texto: 'Em pacientes em ventilação mecânica (471 pares de avaliações diárias), dois enfermeiros usando o CAM-ICU tiveram sensibilidade de 100% e 93% e especificidade de 98% e 100% contra especialistas pelo DSM-IV, com concordância kappa de 0,96.', ref: { fonte: 'Ely et al., JAMA 2001', pagina: 'resumo' } },
      { texto: 'A aplicação levou em média 2 minutos, e o delirium ocorreu em 83,3% dos pacientes ventilados durante a internação na UTI.', ref: { fonte: 'Ely et al., JAMA 2001', pagina: 'resumo' } },
    ],
  },
  'canadian-ct-head': {
    resumo: 'Indica qual adulto com traumatismo craniano leve (Glasgow 13 a 15) precisa de tomografia de crânio.',
    instrucoes: 'Responda sim ou não a cada critério: cinco de alto risco e dois de risco médio.',
    quandoUsar: [
      { texto: 'Adulto com trauma craniano fechado que teve perda de consciência testemunhada, desorientação ou amnésia definida, com Glasgow de 13 a 15.', ref: { fonte: 'Stiell et al., JAMA 2005', pagina: 'resumo' } },
      { texto: 'As recomendações do NICE para tomografia de crânio a partir de 16 anos se baseiam em grande parte na Canadian CT Head Rule, a regra mais custo-efetiva entre as avaliadas.', ref: { fonte: 'NICE NG232, 2023', pagina: 'justificativa das rec. 1.5.8 a 1.5.14' } },
      { texto: 'No TCE leve sem indicação de imagem por regra de decisão validada, não há literatura que apoie a tomografia; a Canadian CT Head Rule vale a partir de 16 anos.', ref: { fonte: 'ACR Appropriateness Criteria, Head Trauma 2021', pagina: 'variante 1' } },
    ],
    porQueUsar: [
      { texto: 'Na derivação em hospitais canadenses (3.121 adultos), os critérios de alto risco tiveram sensibilidade de 100% para necessidade de intervenção neurológica e exigiriam tomografia em só 32%; os de risco médio, sensibilidade de 98,4% e especificidade de 49,6% para lesão cerebral clinicamente importante.', ref: { fonte: 'Stiell et al., Lancet 2001', pagina: 'resumo' } },
      { texto: 'Na validação com 2.707 adultos com Glasgow de 13 a 15, a regra teve sensibilidade de 100% para os 41 pacientes que precisaram de neurocirurgia e para os 231 com lesão cerebral clinicamente importante. No subgrupo com Glasgow 15 (1.822 adultos), foi tão sensível quanto os critérios de New Orleans e mais específica para lesão cerebral clinicamente importante (50,6% contra 12,7%).', ref: { fonte: 'Stiell et al., JAMA 2005', pagina: 'resumo' } },
      { texto: 'Numa coorte japonesa recente e mais idosa (1.706 pacientes, mediana de 71 anos), a sensibilidade caiu para 91,1% com especificidade de 33,8%; os autores a veem como apoio ao julgamento clínico, não como exclusão isolada.', ref: { fonte: 'Kimoto et al., Am J Emerg Med 2026', pagina: 'resumo' } },
    ],
  },
  'rass': {
    resumo: 'Mede o nível de agitação ou sedação do adulto em UTI numa escala de 10 níveis, de +4 (combativo) a −5 (não desperta).',
    instrucoes: 'Observe o paciente e escolha o nível que descreve o que ele faz, de +4 (combativo) a −5 (não desperta à voz nem ao estímulo físico).',
    quandoUsar: [
      { texto: 'Quando o paciente precisa de sedativo, avaliar o estado de sedação e reavaliar com frequência por escalas válidas e confiáveis.', ref: { fonte: 'PADIS 2018 (SCCM)', pagina: 'seção Agitation/Sedation' } },
      { texto: 'No adulto crítico em ventilação mecânica, a diretriz sugere sedação leve em vez de profunda; nos estudos avaliados, sedação leve foi RASS de −2 a +1.', ref: { fonte: 'PADIS 2018 (SCCM)', pagina: 'seção Light Sedation', grau: 'condicional, qualidade baixa' } },
    ],
    porQueUsar: [
      { texto: 'Em 192 avaliações de adultos em UTI, a concordância entre examinadores foi excelente (r = 0,956; kappa 0,73), e a escala se correlacionou com uma escala visual analógica (r = 0,93), com ou sem ventilação mecânica e com ou sem sedativo.', ref: { fonte: 'Sessler et al., Am J Respir Crit Care Med 2002', pagina: 'resumo' } },
      { texto: 'Em 290 pares de observações de enfermeiros, a concordância (kappa ponderado 0,91) superou a do Glasgow (0,64); foi a primeira escala de sedação validada para detectar mudanças ao longo de dias consecutivos na UTI.', ref: { fonte: 'Ely et al., JAMA 2003', pagina: 'resumo' } },
    ],
  },
  'iss': {
    resumo: 'Descreve a gravidade do paciente com múltiplas lesões e serve para avaliar o atendimento de emergência.',
    instrucoes: 'Marque o AIS (0 a 6) da lesão mais grave em cada uma das seis regiões. O ISS soma os quadrados dos três maiores valores (0 a 75).',
  },
  'ckd-epi-2021': {
    resumo: 'Estima a taxa de filtração glomerular do adulto pela creatinina sérica, pela idade e pelo sexo, sem coeficiente de raça.',
    instrucoes: 'Informe creatinina sérica (mg/dL), idade e sexo. O resultado sai em mL/min/1,73 m² pelas equações de 2021 e de 2009, com a categoria G da KDIGO.',
    quandoUsar: [
      { texto: 'Na avaliação inicial da função renal, usar a creatinina sérica com uma equação de estimativa.', ref: { fonte: 'KDIGO 2024, DRC', pagina: 'PP 1.2.2.1, p. S151' } },
      { texto: 'Usar uma equação validada em vez da creatinina isolada, e evitar a raça no cálculo.', ref: { fonte: 'KDIGO 2024, DRC', pagina: 'rec. 1.2.4.1 e PP 1.2.4.2, p. S154', grau: '1D' } },
      { texto: 'Para a maioria das pessoas e situações clínicas, a TFG estimada pela creatinina serve para ajustar medicamentos.', ref: { fonte: 'KDIGO 2024, DRC', pagina: 'PP 4.2.2, p. S164' } },
    ],
    porQueUsar: [
      { texto: 'A equação de 2021 foi desenvolvida em 8.254 participantes de 10 estudos e validada em 4.050; em todas as equações, 85% ou mais das estimativas ficaram a até 30% da TFG medida.', ref: { fonte: 'Inker et al., N Engl J Med 2021', pagina: 'resumo' } },
      { texto: 'A equação de 2009 foi mais exata que a do MDRD: 84,1% contra 80,6% das estimativas a até 30% da TFG medida, na validação com 3.896 participantes.', ref: { fonte: 'Levey et al., Ann Intern Med 2009', pagina: 'resumo' } },
      { texto: 'No sul do Brasil (306 brancos e 48 negros), nenhuma equação chegou a 90% de estimativas a até 30%; a de 2021 não superou a de 2009, e os autores não recomendam trocar a de 2009 pela de 2021 na população brasileira.', ref: { fonte: 'Escott et al., J Nephrol 2024', pagina: 'resumo' } },
    ],
  },
  'cockcroft-gault': {
    resumo: 'Estima o clearance de creatinina do adulto pela creatinina sérica, pela idade e pelo peso, com valor 15% menor na mulher.',
    instrucoes: 'Informe creatinina sérica (mg/dL), idade, peso real e sexo. O resultado é o clearance de creatinina em mL/min.',
    quandoUsar: [
      { texto: 'Muitos estudos de farmacocinética que embasam a dose de medicamentos usaram o Cockcroft-Gault, mas a equação tem limitações: foi criada antes da padronização da creatinina, sem mulheres e sem pessoas negras, e o peso pode ser distorcido por edema ou obesidade.', ref: { fonte: 'KDIGO 2024, DRC', pagina: 'seção 4.2, p. S249' } },
      { texto: 'Na cirrose, os métodos baseados na creatinina superestimaram a função renal em cerca de 50% na literatura revisada.', ref: { fonte: 'Scappaticci e Regal, World J Hepatol 2017', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na derivação (249 pacientes de 18 a 92 anos) e na comparação com a média de dois clearances de 24 horas medidos em 236 pacientes, a correlação foi de 0,83.', ref: { fonte: 'Cockcroft e Gault, Nephron 1976', pagina: 'resumo' } },
      { texto: 'Em 34 gestantes com doença renal, usando o peso de antes da gestação, o Cockcroft-Gault se correlacionou com o clearance medido em urina de 24 horas (r = 0,87).', ref: { fonte: 'Quadri et al., Am J Kidney Dis 1994', pagina: 'resumo' } },
    ],
  },
  'ottawa-tornozelo-pe': {
    resumo: 'Indica qual adulto com trauma agudo de tornozelo ou de mediopé precisa de radiografia para afastar fratura.',
    instrucoes: 'Marque se a dor está na zona maleolar ou no mediopé, os pontos dolorosos à palpação e se o paciente consegue dar 4 passos. A regra do tornozelo usa os maléolos e a marcha; a do mediopé, a base do 5º metatarso, o navicular e a marcha.',
    quandoUsar: [
      { texto: 'As regras de Ottawa são o padrão atual para decidir se a radiografia é necessária no trauma agudo de tornozelo; estudos de validação confirmam que reduzem radiografias desnecessárias e custos.', ref: { fonte: 'ACR Appropriateness Criteria, Ankle 2020', pagina: 'introdução' } },
      { texto: 'Não usar com alteração neurológica da perna com perda de sensibilidade (por exemplo, no diabético), alteração do nível de consciência ou incapacidade de se comunicar.', ref: { fonte: 'ACR Appropriateness Criteria, Ankle 2020', pagina: 'critérios de exclusão' } },
    ],
    porQueUsar: [
      { texto: 'Na validação das regras refinadas, a sensibilidade foi de 1,0 para 50 fraturas maleolares e 19 do mediopé, com redução estimada de 34% das radiografias de tornozelo e de 30% das de pé.', ref: { fonte: 'Stiell et al., JAMA 1993', pagina: 'resumo' } },
      { texto: 'Em revisão sistemática (27 estudos, 15.581 pacientes), a razão de verossimilhança negativa foi 0,08 no tornozelo e no mediopé: com prevalência de fratura de 15%, a chance de fratura com a regra negativa fica abaixo de 1,4%.', ref: { fonte: 'Bachmann et al., BMJ 2003', pagina: 'resumo' } },
      { texto: 'Num pronto-socorro universitário brasileiro, a implantação reduziu em 31,8% os pedidos de exame de imagem, sem diferença significativa na detecção de fraturas.', ref: { fonte: 'Schiper et al., Acta Ortop Bras 2023', pagina: 'resumo' } },
    ],
  },
  'ottawa-joelho': {
    resumo: 'Indica qual adulto com trauma agudo de joelho precisa de radiografia para afastar fratura.',
    instrucoes: 'Responda sim ou não a cada um dos cinco critérios; um ou mais tornam a regra positiva.',
    quandoUsar: [
      { texto: 'Adulto com trauma agudo de joelho no pronto-socorro, para usar a radiografia de forma seletiva.', ref: { fonte: 'Stiell et al., Ann Emerg Med 1995', pagina: 'resumo' } },
      { texto: 'A regra negativa afasta com segurança a fratura de joelho após trauma agudo.', ref: { fonte: 'Bachmann et al., Ann Intern Med 2004', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na derivação (1.047 adultos), a regra identificou as 68 fraturas (sensibilidade 1,0; especificidade 0,54) e reduziria em 28,0% o uso de radiografia.', ref: { fonte: 'Stiell et al., Ann Emerg Med 1995', pagina: 'resumo' } },
      { texto: 'Em revisão sistemática (6 estudos, 4.249 adultos), sensibilidade de 98,5%, especificidade de 48,6% e razão de verossimilhança negativa de 0,05.', ref: { fonte: 'Bachmann et al., Ann Intern Med 2004', pagina: 'resumo' } },
    ],
  },
  'mcisaac-centor': {
    resumo: 'Estima a probabilidade de faringite por estreptococo do grupo A na dor de garganta, a partir de 3 anos de idade, e orienta o teste.',
    instrucoes: 'Some 1 ponto para cada achado presente (temperatura acima de 38 °C, ausência de tosse, adenopatia cervical anterior dolorosa, edema ou exsudato amigdaliano) e ajuste pela idade: +1 de 3 a 14 anos, 0 de 15 a 44 e −1 a partir de 45.',
    quandoUsar: [
      { texto: 'Os escores clínicos ajudam a reconhecer o paciente de risco tão baixo que o teste rápido ou a cultura costumam ser desnecessários; não bastam para fechar o diagnóstico.', ref: { fonte: 'IDSA 2012, faringite estreptocócica', pagina: 'texto sobre escores clínicos' } },
      { texto: 'Fora dos quadros claramente virais, confirmar com teste rápido e/ou cultura, porque os achados clínicos sozinhos não separam a faringite estreptocócica da viral.', ref: { fonte: 'IDSA 2012, faringite estreptocócica', pagina: 'rec. 1', grau: 'forte, alta' } },
      { texto: 'Abaixo de 3 anos, a investigação de estreptococo do grupo A não está indicada, salvo fator de risco como irmão mais velho com a infecção.', ref: { fonte: 'IDSA 2012, faringite estreptocócica', pagina: 'rec. 5', grau: 'forte, moderada' } },
    ],
    porQueUsar: [
      { texto: 'Em 206.870 pacientes a partir de 3 anos, o teste foi positivo em 8% com McIsaac 0, 14% com 1, 23% com 2, 37% com 3 e 55% com 4.', ref: { fonte: 'Fine et al., Arch Intern Med 2012', pagina: 'resumo' } },
      { texto: 'Na derivação (521 pacientes de 3 a 76 anos), a sensibilidade foi de 83,1% contra 69,4% do cuidado usual, e seguir o escore teria reduzido em 48% as prescrições iniciais de antibiótico, sem aumentar o uso de cultura.', ref: { fonte: 'McIsaac et al., CMAJ 1998', pagina: 'resumo' } },
    ],
  },
  '4at-delirium': {
    resumo: 'Rastreia delirium no idoso de forma rápida, na rotina do pronto-socorro e da enfermaria, sem treinamento especial.',
    instrucoes: 'Avalie os quatro itens e some os pontos (0 a 12); o item não testável também pontua. No estudo multicêntrico de validação, acima de 3 foi considerado positivo.',
    quandoUsar: [
      { texto: 'Para identificar o paciente com provável delirium no pronto-socorro e no hospital de agudos.', ref: { fonte: 'SIGN 157, 2019', pagina: 'rec. 2.1', grau: 'forte' } },
      { texto: 'Diante de indicadores de delirium, o profissional competente aplica o 4AT; na UTI e na recuperação pós-anestésica, usar o CAM-ICU ou o ICDSC no lugar.', ref: { fonte: 'NICE CG103 (atualizada em 2023)', pagina: 'rec. 1.6.1' } },
      { texto: 'No idoso no pronto-socorro, o 4AT está entre os instrumentos que podem ser usados para confirmar ou afastar delirium, em recomendação condicional de certeza muito baixa.', ref: { fonte: 'Geriatric ED Guidelines 2.0 (Lee et al., Acad Emerg Med 2025)', pagina: 'resumo', grau: 'condicional, certeza muito baixa' } },
    ],
    porQueUsar: [
      { texto: 'Em 785 pacientes de 70 anos ou mais no pronto-socorro ou na enfermaria clínica, o 4AT teve AUC de 0,90, sensibilidade de 76% e especificidade de 94%; o CAM teve sensibilidade de 40%.', ref: { fonte: 'Shenkin et al., BMC Med 2019', pagina: 'resumo' } },
      { texto: 'Em idosos internados (70 anos ou mais), sensibilidade de 89,7% e especificidade de 84,1%, com AUC de 0,93 no total, 0,92 sem demência e 0,89 com demência.', ref: { fonte: 'Bellelli et al., Age Ageing 2014', pagina: 'resumo' } },
    ],
  },
  'sofa-2': {
    resumo: 'Descreve a disfunção orgânica do adulto crítico em seis sistemas, com os tratamentos de suporte atuais e novos pontos de corte.',
    instrucoes: 'Em cada sistema, pontue o pior valor das 24 horas; o total vai de 0 a 24. Dado que falta no primeiro dia conta 0.',
    quandoUsar: [
      { texto: 'Adulto em UTI, para descrever a disfunção orgânica; o escore foi desenvolvido no primeiro dia de UTI e manteve a validade do dia 1 ao dia 7.', ref: { fonte: 'Ranzani et al., JAMA 2025', pagina: 'resumo' } },
      { texto: 'No pronto-socorro, no adulto com infecção suspeita, apoia a estratificação precoce de risco de morte hospitalar.', ref: { fonte: 'Yen et al., Int J Infect Dis 2026', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em 3,34 milhões de internações em 1.319 UTIs de 9 países, incluindo o Brasil, a AUROC para mortalidade na UTI foi 0,79 (SOFA original: 0,77).', ref: { fonte: 'Ranzani et al., JAMA 2025', pagina: 'resumo' } },
      { texto: 'No choque séptico do pronto-socorro (duas coortes coreanas, 2.669 e 1.443 pacientes), a AUROC para mortalidade hospitalar foi 0,734 contra 0,702 e 0,719 contra 0,671 do SOFA original.', ref: { fonte: 'Ahn et al., J Intensive Care 2026', pagina: 'resumo' } },
      { texto: 'Em 173.079 atendimentos no pronto-socorro por infecção suspeita, a AUROC foi 0,78, igual à do SOFA original e maior que a do qSOFA (0,72) e a da SIRS (0,63); o SOFA-2 deu pontuação menor em 62,3% dos pacientes.', ref: { fonte: 'Yen et al., Int J Infect Dis 2026', pagina: 'resumo' } },
    ],
  },
  'twist': {
    resumo: 'Estratifica o risco de torção testicular na dor testicular aguda a partir de cinco achados clínicos.',
    instrucoes: 'Some os pontos dos achados presentes (0 a 7): edema testicular e testículo endurecido valem 2; reflexo cremastérico ausente, náusea ou vômito e testículo elevado valem 1. Baixo risco 0 a 2, intermediário 3 a 4, alto 5 a 7.',
    quandoUsar: [
      { texto: 'Para apoiar uma avaliação estruturada do jovem com dor testicular.', ref: { fonte: 'GIRFT (NHS England), torção testicular 2026', pagina: 'seção 3.3' } },
      { texto: 'TWIST de 5 ou mais com dor há menos de 48 horas obriga a exploração escrotal, salvo diagnóstico alternativo que mude a conduta; TWIST de 0 a 4 não exclui torção.', ref: { fonte: 'GIRFT (NHS England), torção testicular 2026', pagina: 'seção 3.3' } },
      { texto: 'O escore ajuda a agilizar a decisão, mas não prova nem afasta a torção e não deve ser usado sozinho.', ref: { fonte: 'EAU, Urologia Pediátrica 2026', pagina: 'cap. 8, p. 28' } },
    ],
    porQueUsar: [
      { texto: 'Em metanálise de 10 estudos, comparando alto risco (5 a 7) com baixo risco (0 a 2), a sensibilidade foi de 94,2% e a especificidade de 98%.', ref: { fonte: 'Lewis et al., BJU Int 2026', pagina: 'resumo' } },
      { texto: 'Na derivação prospectiva (338 pacientes com escroto agudo, 51 com torção), os cortes de 2 e de 5 tiveram valores preditivos negativo e positivo de 100%, e o ultrassom ficaria só para o risco intermediário.', ref: { fonte: 'Barbosa et al., J Urol 2013', pagina: 'resumo' } },
      { texto: 'Mesmo assim, 1 em cada 25 jovens com torção teve TWIST de 0 a 2, e 1 em cada 3 teve de 0 a 4.', ref: { fonte: 'GIRFT (NHS England), torção testicular 2026', pagina: 'seção 7.1' } },
    ],
  },
}

export function topoDa(fichaId: string): Topo | undefined {
  return TOPOS[fichaId]
}
