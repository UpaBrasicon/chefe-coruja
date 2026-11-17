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
  // Condutas de emergências, lote 1 (16/11/2026): resumo e instruções descrevem a tela; "Quando usar"
  // e "Por que usar" com trecho literal do módulo ou da tela (livro ou diretriz já lidos, com página),
  // conferido por script. Campo sem fonte fica vazio.
  'adulto-reposicao-magnesio': {
    resumo: 'Classifica a hipomagnesemia e calcula o preparo do sulfato de magnésio 10% (mL, mEq, mmol e mL/h) pelos esquemas do manual do HC.',
    instrucoes: 'Informe o magnésio sérico para ver a faixa e o esquema do manual. No preparo, informe a dose em gramas, o diluente e o tempo e marque se o ClCr é menor que 30; na reposição VO, informe o magnésio elementar do dia.',
    quandoUsar: [
      { texto: 'Hipomagnesemia é o magnésio abaixo de 2 mg/dL: moderada de 1 a 1,5 e grave abaixo de 1.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, Anexo 5', pagina: 'p. 1501' } },
    ],
  },
  'adulto-reposicao-calcio': {
    resumo: 'Corrige o cálcio pela albumina e calcula o bolus, a infusão contínua e a reposição oral de cálcio na hipocalcemia pelo manual do HC.',
    instrucoes: 'Informe o cálcio total e a albumina para o cálcio corrigido. No bolus, escolha o sal e informe volume, diluente e tempo; na infusão contínua, o peso e a dose ou a velocidade da bomba.',
    quandoUsar: [
      { texto: 'Hipocalcemia é o cálcio total abaixo de 8,5 mg/dL.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 68 e Anexo 5', pagina: 'p. 919 e 1500' } },
      { texto: 'Hipocalcemia grave pela Society for Endocrinology: cálcio abaixo de 1,9 mmol/L (cerca de 7,6 mg/dL) ou com sintomas, tratada com gluconato de cálcio EV sob ECG.', ref: { fonte: 'Society for Endocrinology 2016, hipocalcemia aguda' } },
    ],
  },
  'adulto-hipercalcemia': {
    resumo: 'Corrige o cálcio pela albumina, calcula a fração de excreção de cálcio e as doses por peso do tratamento agudo da hipercalcemia pela Tabela 7 do manual do HC.',
    instrucoes: 'Informe o cálcio total e a albumina para o cálcio corrigido e o peso para as doses da Tabela 7. Para a FECa, informe cálcio urinário, fluxo urinário, cálcio plasmático e TFG, na mesma unidade nos dois cálcios e nos dois fluxos.',
    quandoUsar: [
      { texto: 'Hipercalcemia é o cálcio total acima de 10,5 mg/dL.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 68', pagina: 'p. 924' } },
      { texto: 'O manual indica o tratamento agudo na hipercalcemia grave (cálcio total acima de 14 mg/dL) ou na moderada (acima de 12 mg/dL) com sintomas.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 68', pagina: 'p. 927' } },
    ],
  },
  'adulto-reposicao-fosforo': {
    resumo: 'Classifica a hipofosfatemia e calcula a reposição IV de fosfato por peso, com o teto de cada esquema e a carga de potássio ou sódio, e os comprimidos VO, pelo manual do HC.',
    instrucoes: 'Informe o fósforo sérico para a faixa. Na reposição IV, escolha o esquema e o sal e informe peso, dose em mmol/kg e tempo; na VO, o fosfato do dia em mmol.',
    quandoUsar: [
      { texto: 'Hipofosfatemia é o fósforo abaixo de 2,5 mg/dL (0,8 mmol/L): moderada de 1 a 2 mg/dL e grave abaixo de 1 mg/dL (0,32 mmol/L).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, Anexo 5', pagina: 'p. 1501' } },
      { texto: 'Considerar a reposição endovenosa nos casos sintomáticos ou na hipofosfatemia grave, com o fósforo dosado a cada 6 horas.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, Anexo 5', pagina: 'p. 1501' } },
    ],
  },
  'adulto-gasometria': {
    resumo: 'Analisa a gasometria pelo passo a passo do manual do HC: acidemia ou alcalemia, distúrbio primário, compensação esperada, ânion-gap corrigido, delta-delta, ânion-gap urinário, cloro urinário e gap osmolar.',
    instrucoes: 'Informe pH, pCO2 e HCO3 e, se houver distúrbio respiratório, se é agudo ou crônico. Para os outros passos, preencha sódio, cloro e albumina, os eletrólitos urinários, as osmolaridades medida e calculada ou o pH venoso.',
    quandoUsar: [
      { texto: 'Referência da gasometria arterial no manual: pH 7,35 a 7,45, HCO3 21 a 27 mEq/L e pCO2 35 a 45 mmHg.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 69', pagina: 'Tab. 1, p. 931' } },
      { texto: 'Gap osmolar acima de 15 mOsm/kg aparece na fase precoce da intoxicação por álcoois tóxicos e tende a cair com a evolução.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP', pagina: 'p. 1326 e 1512' } },
    ],
  },
  'adulto-bicarbonato': {
    resumo: 'Estima o déficit de bicarbonato, confere o critério laboratorial do manual do HC e calcula os preparos de bicarbonato de sódio 8,4% da cetoacidose e da hipercalemia, com mL/h.',
    instrucoes: 'Informe peso e HCO3 para o déficit e o pH para conferir o critério do manual. Os preparos da cetoacidose e da hipercalemia já aparecem calculados.',
    quandoUsar: [
      { texto: 'Não há consenso sobre o bicarbonato; o manual o descreve na acidemia grave (pH abaixo de 7,1), aguda e sintomática, com HCO3 abaixo de 8 mEq/L.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 69', pagina: 'p. 937–938' } },
      { texto: 'Na cetoacidose diabética, o consenso ADA/EASD/JBDS só indica bicarbonato com pH abaixo de 7,0.', ref: { fonte: 'Consenso ADA/EASD/JBDS 2024 (Diabetes Care)', pagina: 'p. 1264 e 1266' } },
    ],
  },
  'adulto-cad-ehh-avaliacao': {
    resumo: 'Confere os critérios de cetoacidose diabética e de estado hiperosmolar, a gravidade e a resolução pelo consenso ADA/EASD/JBDS 2024, com o que o manual do HC trazia só para consulta.',
    instrucoes: 'Informe glicemia, sódio medido, cloro, bicarbonato, pH, diabetes prévio e o β-hidroxibutirato (ou a cetonúria, se não houver). Para a resolução, informe a cetona atual e, no estado hiperosmolar, a diurese em mL/kg/h.',
    quandoUsar: [
      { texto: 'Cetoacidose pelo consenso: glicose de 200 mg/dL ou mais ou diabetes prévio, β-hidroxibutirato de 3,0 mmol/L ou mais e pH abaixo de 7,3 e/ou bicarbonato abaixo de 18; o ânion-gap não entra.', ref: { fonte: 'Consenso ADA/EASD/JBDS 2024 (Diabetes Care)', pagina: 'Fig. 2, p. 1262' } },
      { texto: 'Estado hiperosmolar: glicose de 600 mg/dL ou mais; osmolalidade efetiva acima de 300 mOsm/kg ou total acima de 320; β-hidroxibutirato abaixo de 3,0; pH de 7,3 ou mais e bicarbonato de 15 ou mais. A alteração do sensório deixou de ser critério.', ref: { fonte: 'Consenso ADA/EASD/JBDS 2024 (Diabetes Care)', pagina: 'Fig. 2B, p. 1262' } },
    ],
  },
  'adulto-cad-ehh-tratamento': {
    resumo: 'Calcula a hidratação, a insulina regular EV em mL/h, o potássio, o bicarbonato e a transição para insulina SC na cetoacidose e no estado hiperosmolar pelo consenso ADA/EASD/JBDS 2024.',
    instrucoes: 'Informe peso, glicemia, sódio medido, potássio e pH e escolha o preparo da insulina: o da unidade (1 U/mL) ou o do manual (0,2 U/mL). O que o manual do HC trazia fica no fim, fechado, só para consulta.',
  },
  'adulto-hipoglicemia': {
    resumo: 'Confere a glicemia contra o limiar de hipoglicemia do manual do HC, com e sem diabetes, e mostra as doses de glicose 50%, glucagon e tiamina, com a ADA 2026 ao lado.',
    instrucoes: 'Informe a glicemia e se o paciente tem diabetes.',
    quandoUsar: [
      { texto: 'Limiar do manual: glicemia abaixo de 70 mg/dL com diabetes; sem diabetes, abaixo de 45 mg/dL no texto (a Figura 1 usa 50).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 65', pagina: 'p. 877 e 881' } },
      { texto: 'Classificação da ADA: nível 1, glicose abaixo de 70 e de 54 mg/dL ou mais; nível 2, abaixo de 54 mg/dL; nível 3, evento grave, com alteração mental ou física, que precisa de ajuda de outra pessoa, qualquer que seja a glicose.', ref: { fonte: 'ADA Standards of Care 2026, seção 6', pagina: 'Tabela 6.4' } },
    ],
  },
  'adulto-bradicardia': {
    resumo: 'Calcula o esquema de atropina e as doses de dopamina e adrenalina na bradicardia sintomática do adulto, enquanto se prepara o marca-passo, pelo manual do HC, com a ERC/RCUK 2025 e a AHA 2025 ao lado.',
    instrucoes: 'Informe o peso: a dopamina sai em µg/min, a adrenalina em mL/h no preparo do Anexo 1 e a atropina com o número de doses até o máximo.',
    quandoUsar: [
      { texto: 'O manual cita a atropina nos sintomas graves ou na instabilidade; em geral ela não funciona no Mobitz II nem no BAV total e não deve ser usada em transplantados.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 15', pagina: 'Figura 3, p. 231' } },
      { texto: 'A AHA considera razoável a atropina na bradicardia aguda com comprometimento hemodinâmico.', ref: { fonte: 'AHA 2025, Part 9 (suporte avançado de vida)', pagina: 'seção 19, recomendação 2', grau: '2a, B-NR' } },
    ],
  },
  'adulto-taquiarritmias': {
    resumo: 'Calcula doses, totais e tempos das drogas EV das taquiarritmias com pulso do adulto (adenosina, amiodarona, lidocaína, verapamil, diltiazem e magnésio) pelo manual do HC, com a AHA 2025 ao lado.',
    instrucoes: 'Informe o peso para a lidocaína e marque se a adenosina vai por acesso venoso central de cava superior, o que reduz a dose à metade.',
    quandoUsar: [
      { texto: 'Para o paciente estável. No instável (dor torácica, alteração do nível de consciência, edema pulmonar ou PAS abaixo de 90 mmHg), o manual indica cardioversão sincronizada com sedação.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 18', pagina: 'p. 262' } },
    ],
  },
  'adulto-anafilaxia': {
    resumo: 'Calcula a adrenalina IM, o bolus EV e a infusão com a conversão para a bomba, o volume por peso e a segunda linha da anafilaxia do adulto pelo manual do HC, com os critérios da WAO 2020 ao lado.',
    instrucoes: 'Informe o peso e marque os achados para conferir os critérios da WAO 2020. Na infusão, informe a velocidade em mL/min ou em mL/h; para a triptase, o valor basal.',
    quandoUsar: [
      { texto: 'Anafilaxia é muito provável com pele ou mucosa acometidas e mais comprometimento respiratório, PA reduzida ou sintoma de órgão-alvo, ou gastrointestinal grave; ou com hipotensão, broncoespasmo ou acometimento laríngeo após alérgeno conhecido ou muito provável, mesmo sem pele.', ref: { fonte: 'WAO 2020, anafilaxia', pagina: 'Tabela 2' } },
      { texto: 'Não é preciso preencher critério diagnóstico antes de dar adrenalina; nem a decisão de dar nem a resposta a ela confirmam o diagnóstico.', ref: { fonte: 'Practice Parameter de anafilaxia 2023 (AAAAI/ACAAI)', pagina: 'recomendações 6 e 7, p. 7', grau: 'condicional, muito baixa' } },
    ],
  },
  'adulto-anticoagulacao-plena': {
    resumo: 'Calcula a anticoagulação plena por peso no adulto pelo manual do HC: enoxaparina por contexto, com ajuste renal e por idade quando o capítulo traz, fondaparinux, HNF subcutânea, outras HBPM, bivalirudina e anticoagulantes orais.',
    instrucoes: 'Informe peso, idade e clearance de creatinina e escolha o contexto (IAM sem supra, IAM com supra após trombólise, TEP ou TVP); após trombólise, marque se foi com estreptoquinase. Sem clearance, a conta não aplica ajuste renal.',
  },
  'adulto-sca-inicial': {
    resumo: 'Monta a conduta inicial da síndrome coronariana aguda pelo manual do HC: reperfusão, antiagregantes e anticoagulante no IAM com e sem supra, com as doses e as páginas.',
    instrucoes: 'Informe peso, idade e clearance e escolha o achado do ECG. No supra, informe as horas de sintomas, o tempo previsto até a ICP e se há contraindicação ao fibrinolítico; sem supra, se a estratificação invasiva sai em menos de 6–24 h, AVC ou AIT prévio e candidatura à intervenção em até 6 h.',
    quandoUsar: [
      { texto: 'Supra de ST no ECG: 1 mm no ponto J em duas derivações contíguas; em V2–V3, 1,5 mm na mulher.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 14', pagina: 'p. 212' } },
    ],
  },
  'adulto-itu': {
    resumo: 'Mostra os esquemas e doses do manual do HC para cistite, pielonefrite e ITU na sonda vesical, com o aminoglicosídeo por peso e a duração e a troca para via oral pela IDSA 2025.',
    instrucoes: 'Informe o peso e escolha o quadro; marque se é homem e, no homem, se há febre com suspeita de prostatite.',
    quandoUsar: [
      { texto: 'Bacteriúria assintomática só se trata em gestantes, granulocitopênicos, transplantados de órgão sólido e no pré-operatório de cirurgia urológica ou de colocação de prótese.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 89', pagina: 'Tabela 3, p. 1212' } },
      { texto: 'Na ITU associada à sonda vesical, retirar a sonda; bacteriúria que persiste 48 h depois é indicação de tratamento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 89', pagina: 'p. 1214' } },
    ],
  },
  'adulto-pep-hiv': {
    resumo: 'Indica ou não a PEP de HIV pelos quatro passos do PCDT do Ministério da Saúde e mostra o esquema antirretroviral de 28 dias, a imunoglobulina da hepatite B por peso, as profilaxias da violência sexual e o seguimento.',
    instrucoes: 'Informe peso, horas desde a exposição e TFG, se conhecida; responda material e exposição de risco, teste rápido da pessoa exposta e situação da pessoa-fonte. Para o esquema, marque gestação, contraindicação ao tenofovir ou ao dolutegravir e uso de indutor.',
    quandoUsar: [
      { texto: 'Material com risco: sangue, sêmen, fluidos vaginais, líquidos de serosas, amniótico e líquor. Exposição com risco: percutânea, mucosas (inclui sexo desprotegido), pele não íntegra e mordedura com sangue.', ref: { fonte: 'PCDT PEP do Ministério da Saúde, 2024', pagina: 'Quadros 2 e 3, p. 5' } },
      { texto: 'Depois de 72 horas da exposição, a PEP não está mais indicada; seguem o acompanhamento sorológico e a prevenção combinada.', ref: { fonte: 'PCDT PEP do Ministério da Saúde, 2024', pagina: 'p. 6' } },
    ],
  },
  'adulto-cefaleia': {
    resumo: 'Junta os sinais de alarme da SNNOOP10 ao diferencial e à investigação do manual do HC e mostra o tratamento das cefaleias primárias, com as doses da crise de migrânea pelo consenso da SBCe (2000) e os níveis da AHS 2025.',
    instrucoes: 'Marque os sinais de alarme presentes e informe o peso para a dose da clorpromazina. A ausência de sinais não exclui causa secundária.',
    quandoUsar: [
      { texto: 'Cefaleia em thunderclap tem pico em segundos a minutos; hemorragia subaracnóidea, vasoconstrição arterial reversível, trombose venosa cerebral e dissecções são as causas mais comuns.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 41', pagina: 'p. 568–569' } },
    ],
  },
  'adulto-meningite': {
    resumo: 'Organiza a conduta inicial na meningite e na encefalite do adulto pelo manual do HC: suspeita clínica, primeira hora, esquema empírico com ampicilina quando há risco de Listeria, dexametasona e aciclovir por peso, padrões do LCR e quimioprofilaxia dos contatos.',
    instrucoes: 'Informe peso e idade, marque os sinais clássicos presentes e os fatores de risco para Listeria (imunossupressão, uso de corticoide, gestação).',
    quandoUsar: [
      { texto: 'Suspeitar de meningite com ao menos dois dos quatro sinais clássicos, presentes em mais de 90%. Na encefalite: crise, alteração de comportamento, rebaixamento mais proeminente e sinais focais.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 43', pagina: 'p. 589' } },
      { texto: 'Os quatro sinais clássicos são febre, cefaleia, alteração do nível de consciência e rigidez de nuca.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 43', pagina: 'p. 589' } },
    ],
  },
  'adulto-colica-renal': {
    resumo: 'Mostra a analgesia em degraus da cólica nefrética com as doses do manual do HC, a quetamina por peso, a conduta pelo tamanho do cálculo e as indicações de internação.',
    instrucoes: 'Informe o peso e o tamanho do cálculo ureteral em mm.',
  },
  'adulto-intermacao': {
    resumo: 'Acompanha o resfriamento na intermação: calcula a taxa de queda da temperatura central e o tempo até o alvo abaixo de 39 °C pela diretriz da SCCM 2025.',
    instrucoes: 'Informe a primeira temperatura central, a mais recente e os minutos entre as duas medidas.',
    quandoUsar: [
      { texto: 'Intermação é a temperatura central acima de 40 °C com alteração do sistema nervoso central.', ref: { fonte: 'SCCM 2025, intermação' } },
      { texto: 'Resfriamento ativo em vez de passivo; a imersão em água fria ou gelada é a mais rápida e chega antes ao alvo, abaixo de 39 °C.', ref: { fonte: 'SCCM 2025, intermação', pagina: 'Recomendação 1', grau: 'forte' } },
    ],
  },
  'adulto-queimadura': {
    resumo: 'Calcula a superfície corporal queimada pelo esquema de Lund e Browder e o volume inicial do choque do queimado pela American Burn Association 2024, com os limites que pedem vigilância.',
    instrucoes: 'Informe o peso e marque a fração queimada de cada superfície, na frente e nas costas, só com queimaduras de 2º e 3º graus; ou digite a SCQ estimada.',
    quandoUsar: [
      { texto: 'A diretriz da ABA vale para adultos com 20% ou mais de superfície corporal queimada, nas primeiras 48 h.', ref: { fonte: 'American Burn Association 2024, reposição do choque do queimado', pagina: 'p. 565–566' } },
    ],
  },
  'adulto-fibrinoliticos': {
    resumo: 'Calcula as doses e as velocidades da estreptoquinase, da alteplase e da tenecteplase no IAM com supra e no TEP do adulto pelo manual do HC, com AHA/ACC 2025, ESC 2023, SBC 2025 e AHA/ACC 2026 ao lado.',
    instrucoes: 'Informe o peso e a idade: acima de 75 anos a tenecteplase cai à metade.',
    quandoUsar: [
      { texto: 'No IAM com supra, fibrinolítico quando o atraso previsto até a angioplastia passa de 120 min, iniciado em até 10 min do diagnóstico e sem esperar biomarcador.', ref: { fonte: 'AHA/ACC 2025 e ESC 2023, síndrome coronariana aguda', pagina: 'AHA 2025 e782, e806; ESC 2023 p. 3749' } },
      { texto: 'No TEP, trombolisar é razoável nas categorias E1–E2 com risco de sangramento aceitável; pode ser considerado nas D1–D2, tem benefício incerto na C3 e não deve ser feito de A1 a C2.', ref: { fonte: 'AHA/ACC 2026, TEP agudo', pagina: 'seção 4.4.1', grau: '2a, C-LD; 2b, C-LD; 3: dano, B-R' } },
    ],
  },
  'adulto-intoxicacoes-antidotos': {
    resumo: 'Calcula carvão ativado, N-acetilcisteína, antídotos, anticorpo antidigoxina, bicarbonato, fomepizol e etanol, atropina nos organofosforados e hidroxocobalamina pelo manual do HC, com as contas por peso.',
    instrucoes: 'Informe o peso e, em cada bloco, o que a conta pede: massa ingerida, dados do paracetamol, digoxina ingerida ou digoxinemia, dose inicial de atropina e hidroxocobalamina já feita.',
    quandoUsar: [
      { texto: 'Carvão ativado pelo manual: ingesta há menos de 1 a 2 horas; apresentação depois de 2 h é contraindicação.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 97', pagina: 'p. 1299–1300; Figura 1, p. 1306' } },
      { texto: 'Anticorpo antidigoxina na intoxicação digitálica grave: arritmia ameaçadora à vida, potássio acima de 5–5,5 mEq/L, disfunção orgânica ou digoxinemia acima de 10 ng/mL (aguda) ou de 4 ng/mL (crônica).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 98', pagina: 'p. 1319, 1321–1322' } },
    ],
  },
  'adulto-animais-peconhentos': {
    resumo: 'Mostra o número de ampolas de soro pela gravidade — escorpião e aranhas pelo Ministério da Saúde (PCDT e portal), serpentes pelo manual do HC — e calcula a pré-medicação e a neostigmina por peso.',
    instrucoes: 'Informe o peso e escolha o acidente e a gravidade pelas manifestações de cada tabela do manual.',
  },
  'adulto-tetano-profilaxia': {
    resumo: 'Indica vacina e SAT ou IGHAT pelo ferimento e pelo histórico vacinal (Anexo 7 do manual do HC e Guia de Vigilância em Saúde 2024) e calcula as doses por peso do tratamento do tétano acidental.',
    instrucoes: 'Escolha a história de vacinação contra tétano e o tipo de ferimento; no bloco do Guia, marque também se é imunodeprimido, desnutrido grave ou idoso. Informe o peso para as doses do tratamento.',
    quandoUsar: [
      { texto: 'Ferimento de alto risco para tétano: profundo ou superficial sujo, com corpo estranho ou tecido desvitalizado, queimadura, puntiforme, por arma branca ou de fogo, mordedura, politrauma ou fratura exposta.', ref: { fonte: 'Guia de Vigilância em Saúde 2024 (MS), tétano acidental', pagina: 'Quadro 4, p. 335' } },
    ],
  },
  'adulto-raiva-pos-exposicao': {
    resumo: 'Indica observação do animal, vacina ou sorovacinação contra a raiva pelo fluxograma do Anexo 4 do manual do HC e calcula o soro e a imunoglobulina antirrábica por peso pelas Notas Técnicas do Ministério da Saúde.',
    instrucoes: 'Informe o peso e escolha o tipo de contato; no contato direto, a gravidade do acidente, o animal e, quando pedido, se a área tem raiva controlada.',
    quandoUsar: [
      { texto: 'Acidente grave: profundo, múltiplo ou extenso; na cabeça, face, pescoço, mãos ou polpas digitais; ou lambedura de mucosa ou de local com lesão grave.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, Anexo 4', pagina: 'p. 1497' } },
      { texto: 'Agressão por animal silvestre (morcego, mico, macaco, raposa, quati, capivara e outros, mesmo domiciliados) é sempre acidente grave: lavar com água e sabão, soro ou imunoglobulina e 4 doses de vacina.', ref: { fonte: 'Nota Técnica nº 8/2022 do Ministério da Saúde', pagina: 'item 2.3' } },
    ],
  },
  'adulto-hepatite-b-pos-exposicao': {
    resumo: 'Indica vacina e imunoglobulina anti-hepatite B (HBIG) na exposição ocupacional pela situação do paciente-fonte e do profissional exposto, pelo Anexo 6 do manual do HC, com o volume de HBIG por peso.',
    instrucoes: 'Informe o peso e escolha a situação do paciente-fonte e a situação vacinal do profissional exposto.',
    quandoUsar: [
      { texto: 'Fonte com risco, quando o HBsAg é desconhecido: politransfundidos, cirróticos, pessoas em hemodiálise, HIV-positivo, usuários de drogas, contatos domiciliares e sexuais de portadores do VHB, história de DST, procedentes de áreas de alta endemicidade, de instituições para deficiência mental e do sistema prisional.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, Anexo 6', pagina: 'p. 1504–1510' } },
    ],
  },
  'adulto-sedacao-procedimento': {
    resumo: 'Calcula dose e volume por peso das drogas de sedação e analgesia para procedimentos do adulto (etomidato, midazolam, propofol, quetamina, fentanil e morfina), dos adjuvantes e dos reversores, pelo manual do HC.',
    instrucoes: 'Informe o peso (no obeso, o peso que será usado no propofol e na quetamina) e marque se o paciente é virgem de opioide, para o teto da morfina.',
    quandoUsar: [
      { texto: 'ASA IV e V: grande risco de evento adverso; o manual diz que a sedação para procedimentos deve ser evitada.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 10', pagina: 'p. 159' } },
      { texto: 'Risco aumentado: idade acima de 65 anos ou abaixo de 2, obesidade, gestação, conteúdo e horário da última refeição, alteração da consciência basal, intoxicações e, principalmente, condição clínica instável.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 10', pagina: 'p. 155' } },
    ],
  },
  'adulto-dor-analgesia': {
    resumo: 'Leva a nota da escala numérica ao degrau da escada analgésica e calcula as doses dos opioides da Tabela 3 por peso e por dia e a quetamina em dose analgésica, pelo manual do HC.',
    instrucoes: 'Informe o peso e a nota da dor de 0 a 10. O manual não traz tabela de equianalgesia: a tela não converte um opioide em outro.',
    quandoUsar: [
      { texto: 'Escada analgésica do manual: dor leve de 1 a 3, moderada de 4 a 6 e intensa de 7 a 10.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 9', pagina: 'Figura 2, p. 147' } },
      { texto: 'Na dor aguda do adulto que recebe alta, a terapia sem opioide é pelo menos tão eficaz quanto o opioide em muitas dores comuns; considerar opioide só se o benefício esperado superar o risco.', ref: { fonte: 'CDC 2022, prescrição de opioides', grau: 'categoria B, evidência tipo 3' } },
    ],
  },
  'adulto-sintomas-paliativos': {
    resumo: 'Calcula o resgate de opioide, o escalonamento da morfina e do midazolam na dispneia, a furosemida e a quetamina por peso e a manutenção da sedação paliativa com midazolam, pelo manual do HC.',
    instrucoes: 'Informe o peso, a dose diária de morfina já em uso (em mg de morfina), o bolus de morfina atual e o bolus inicial de midazolam; a infusão atual é opcional.',
    quandoUsar: [
      { texto: 'Sinais indiretos de dor: frequência respiratória acima de 30 irpm ou cardíaca acima de 110 bpm, inquietação, musculatura acessória ou respiração paradoxal, gemência ou olhar de medo.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 104', pagina: 'p. 1383' } },
      { texto: 'A sedação paliativa é definida pelo princípio da proporcionalidade, diante de sofrimento refratário, físico, psicológico ou existencial.', ref: { fonte: 'EAPC 2024, sedação paliativa' } },
    ],
  },
  'adulto-trombolise-avc': {
    resumo: 'Calcula a alteplase e a tenecteplase por peso no AVC isquêmico, confere os critérios numéricos da Tabela 4 do manual do HC e mostra os alvos de PA, o nitroprussiato e o manejo do sangramento e do angioedema após a trombólise, com a AHA/ASA 2026 ao lado.',
    instrucoes: 'Informe peso, idade e horas desde a última vez assintomático; para conferir a Tabela 4, preencha NIHSS, plaquetas, INR, TTPa, TP, PA e glicemia.',
    quandoUsar: [
      { texto: 'Até 4,5 h do início ou da última vez bem, a AHA/ASA indica trombolítico: tenecteplase ou alteplase.', ref: { fonte: 'AHA/ASA 2026, AVC isquêmico agudo', pagina: 'p. 5 e 42 (4.6.2)', grau: 'Classe 1' } },
      { texto: 'Pelo manual, entre 3 e 4,5 h da última vez assintomático o critério da trombólise exige NIHSS de 25 ou menos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 38', pagina: 'p. 521' } },
    ],
  },
  'adulto-reversao-anticoagulacao': {
    resumo: 'Mostra a reversão da varfarina pelo INR e pelo sangramento e calcula CCP, plasma, crioprecipitado e protamina, com os anticoagulantes orais diretos e as metas da hemorragia intraparenquimatosa, pelo manual do HC.',
    instrucoes: 'Informe o peso e o INR e escolha se há sangramento leve ou grave; para a protamina, informe as unidades de heparina e o tempo desde a dose; na hemorragia intraparenquimatosa, a PAS.',
    quandoUsar: [
      { texto: 'Sangramento maior: intracraniano, retroperitoneal, síndrome compartimental ou gastrointestinal maciço. Menor: epistaxe, tecidos moles ou gastrointestinal lento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 79', pagina: 'p. 1044–1045' } },
    ],
  },
  'adulto-escala-numerica-dor': {
    resumo: 'Registra a intensidade da dor informada pelo paciente, de 0 a 10, e mostra o degrau correspondente da escada analgésica do manual do HC.',
    instrucoes: 'Peça ao paciente uma nota de 0 (sem dor) a 10 (pior dor possível).',
    quandoUsar: [
      { texto: 'Reavaliar a intensidade da dor para verificar a eficácia do tratamento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 9', pagina: 'p. 141' } },
      { texto: 'Faixas da escada analgésica: dor leve de 1 a 3, moderada de 4 a 6 e intensa de 7 a 10.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 9', pagina: 'Figura 2, p. 147' } },
    ],
  },
  'adulto-painad': {
    resumo: 'Pontua a dor no paciente com demência avançada pela observação de cinco comportamentos, de 0 a 10, na versão traduzida do manual do HC.',
    instrucoes: 'Observe o paciente por 5 minutos e pontue de 0 a 2 cada item: respiração, vocalização negativa, expressão facial, linguagem corporal e consolabilidade.',
    quandoUsar: [
      { texto: 'Pode ser aplicada em repouso, em atividade agradável, durante cuidados ou após medicação para dor.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 9', pagina: 'p. 142' } },
    ],
  },
  'adulto-bps': {
    resumo: 'Pontua a dor pelo comportamento no adulto inconsciente, sedado ou em ventilação mecânica, de 3 a 12, na versão traduzida do manual do HC.',
    instrucoes: 'Pontue de 1 a 4 a expressão facial, os movimentos dos membros superiores e o conforto com o ventilador mecânico. O manual não traz ponto de corte.',
    quandoUsar: [
      { texto: 'Adulto inconsciente, sedado ou em ventilação mecânica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 9', pagina: 'p. 143 (Tabela 2)' } },
    ],
  },
  'adulto-rankin-modificada': {
    resumo: 'Gradua a incapacidade funcional de 0 (assintomático) a 6 (morte) pela Tabela 12 do manual do HC e mostra os cortes de Rankin prévio citados no capítulo de AVC.',
    instrucoes: 'Escolha o grau que descreve o paciente. Os cortes do capítulo usam o Rankin prévio, o estado funcional antes do AVC.',
    quandoUsar: [
      { texto: 'Na seleção para trombectomia, Rankin prévio de 0 a 1 é critério da janela de até 6 horas e do DAWN; de 0 a 2, do DEFUSE 3.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 38', pagina: 'p. 529–530 e 532' } },
    ],
    porQueUsar: [
      { texto: 'Rankin prévio de 2 ou mais: o benefício da trombólise pode ser menor e a mortalidade, maior. De 3 ou mais: a hemicraniectomia é provavelmente desvantajosa.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 38', pagina: 'p. 523 e 535' } },
    ],
  },
  'adulto-escore-ich': {
    resumo: 'Estima a mortalidade em 30 dias da hemorragia intraparenquimatosa somando Glasgow, volume do hematoma, extensão intraventricular, origem infratentorial e idade, pela Tabela 2 do manual do HC.',
    instrucoes: 'Escolha a faixa do Glasgow e marque volume do hematoma (30 cm³ ou mais), extensão intraventricular, origem infratentorial e idade acima de 80 anos; o total vai de 0 a 6.',
    quandoUsar: [
      { texto: 'Escore prognóstico: não define conduta, e a mortalidade da tabela não decide limitação de suporte.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 39', pagina: 'p. 543–544' } },
      { texto: 'Pela diretriz de neuroprognóstico da NCS, nenhum escore, nem o ICH, é confiável sozinho para aconselhar paciente e família sobre o desfecho funcional em 3 meses ou a mortalidade em 30 dias; o prognóstico deve esperar pelo menos 48 a 72 horas de UTI, salvo nos casos mais devastadores.', ref: { fonte: 'NCS 2023, neuroprognóstico na hemorragia intraparenquimatosa (Hwang et al., Neurocrit Care 2024)', grau: 'boa prática (adiar o prognóstico)' } },
    ],
    porQueUsar: [
      { texto: 'Na Tabela 2 do manual, a mortalidade em 30 dias é de 13% com escore 1, 26% com 2, 72% com 3, 97% com 4 e 100% com 5.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 39', pagina: 'Tabela 2, p. 544' } },
      { texto: 'O texto do capítulo associa mau prognóstico a Glasgow abaixo de 9, hematoma acima de 60 mL e sangue no ventrículo.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 39', pagina: 'p. 543' } },
    ],
  },
  'adulto-transfusao-hemocomponentes': {
    resumo: 'Mostra os gatilhos de transfusão do manual do HC, com a AABB ao lado, e calcula pelo peso volume, velocidade e incremento esperado de hemácias, plaquetas, plasma e crioprecipitado, além do complexo protrombínico pelo INR.',
    instrucoes: 'Informe o peso e, conforme o hemocomponente, a Hb, o Ht e as unidades, os concentrados das últimas 24 h e da última hora, as plaquetas antes e depois, o fibrinogênio ou o INR.',
    quandoUsar: [
      { texto: 'Pelo manual, o gatilho de concentrado de hemácias é a Hb abaixo de 7 g/dL, exceto na instabilidade hemodinâmica, na doença cardiovascular estável ou síndrome coronariana aguda e na cirurgia ortopédica ou cardíaca.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 82', pagina: 'p. 1075–1076' } },
      { texto: 'A decisão considera também sintomas, sinais, outros exames, alternativas à transfusão e preferências do paciente; o limiar de 7 g/dL não vale para sangramento maciço, hipoxemia grave ou instabilidade.', ref: { fonte: 'AABB 2023 (Carson et al., JAMA 2023)', pagina: 'boa prática, p. 1894' } },
    ],
  },
  'adulto-abc-score': {
    resumo: 'Prevê a necessidade de transfusão maciça no trauma com quatro critérios de beira de leito e mostra os dois cortes que o manual do HC traz.',
    instrucoes: 'Responda Sim ou Não a cada critério: trauma penetrante, FAST positivo, PAS de 90 mmHg ou menos e FC de 120 bpm ou mais. Cada um vale 1 ponto, de 0 a 4.',
    quandoUsar: [
      { texto: 'A necessidade de transfusão maciça se prevê pelo julgamento clínico e pelo ABC score; a indicação de protocolo de transfusão maciça varia entre serviços.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, caps. 82 e 47', pagina: 'cap. 82, p. 1077; cap. 47, p. 647' } },
      { texto: 'Transfusão maciça, o desfecho que o escore prevê, é a de 10 unidades de concentrado de hemácias nas primeiras 24 horas.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 47', pagina: 'p. 647' } },
    ],
  },
  'adulto-ressuscitacao-volemica': {
    resumo: 'Calcula o volume de cristaloide pelo peso, as alíquotas e a vazão, lê a diurese e a queda do lactato contra as metas e mostra o gatilho de vasopressina no choque e na sepse, pelo manual do HC, a SSC 2026 e o ILAS.',
    instrucoes: 'Informe o peso. Para as metas, a diurese medida e o período, e o lactato inicial e após 2 horas; para a vasopressina, a dose de noradrenalina, a unidade e há quanto tempo está nessa dose.',
    quandoUsar: [
      { texto: 'Pelo manual, a expansão volêmica da sepse vale para o adulto hipotenso ou com lactato acima de 36 mg/dL.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 7', pagina: 'p. 122' } },
      { texto: 'Pela SSC, a hipoperfusão induzida por sepse é a hipotensão (PAM abaixo de 65 mmHg, PAS abaixo de 90 mmHg ou queda em relação à basal) ou o lactato elevado.', ref: { fonte: 'SSC 2026', pagina: 'p. 18' } },
    ],
  },
  'adulto-asma-exacerbacao': {
    resumo: 'Posiciona cada parâmetro da crise de asma na Tabela 1 do manual do HC, gradua a crise pela GINA 2026 e traz as medicações, com o preparo do sulfato de magnésio.',
    instrucoes: 'Informe FR, FC, pulso paradoxal, VEF1 ou peak-flow, SaO2, PaO2 e PaCO2 para ver a coluna de cada um na Tabela 1, e marque os achados clínicos para a gravidade pela GINA. O livro não combina parâmetros discordantes: a classificação é do médico.',
    quandoUsar: [
      { texto: 'Pela GINA, a crise é grave se o paciente não consegue falar, beber ou deitar, com SpO2 abaixo de 92%, FR acima de 30, tórax silente ou PEF abaixo de 50%; sonolência, confusão ou cianose indicam risco de vida.', ref: { fonte: 'GINA 2026, Summary Guide', pagina: 'Figura 9, p. 36' } },
    ],
  },
  'adulto-dpoc-exacerbacao': {
    resumo: 'Classifica a exacerbação da DPOC pelos sintomas cardinais, compara a gasometria com os cortes do manual do HC e mostra a VNI e os parâmetros iniciais da ventilação invasiva, com o GOLD 2026 ao lado.',
    instrucoes: 'Marque os sintomas cardinais presentes e informe PaO2, PaCO2 e pH. Para a ventilação invasiva, informe o peso, a FR e a relação I:E; as gotas do β2 são convertidas em mg.',
    quandoUsar: [
      { texto: 'As manifestações cardinais são piora da dispneia, aumento da expectoração e escarro purulento: a exacerbação é leve com 1, moderada com 2 e grave com 3.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 31', pagina: 'Tabela 1, p. 418' } },
      { texto: 'Indicações de VNI pelo manual: acidose respiratória (pH abaixo de 7,35 com PaCO2 acima de 60 mmHg), dispneia moderada a grave com musculatura acessória ou hipoxemia refratária.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 31', pagina: 'Tabela 6, p. 424' } },
    ],
  },
  'adulto-vm-ajuste-inicial': {
    resumo: 'Mostra as indicações e os parâmetros iniciais de PCV, VCV e PSV do manual do HC e calcula o volume corrente pelo peso e a relação I:E.',
    instrucoes: 'Informe PO2 e PCO2 para conferir os cortes de indicação, escolha o modo e informe o peso que quer usar, a FR e o tempo inspiratório (no VCV, o VC e o fluxo).',
    quandoUsar: [
      { texto: 'Hipoxemia com PO2 abaixo de 60 e esforço respiratório, sem melhora após oxigênio adequado (cateter nasal, máscara de Venturi, máscara não reinalante e VNI quando indicada).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 498' } },
      { texto: 'Hipercapnia com PCO2 acima de 55 em quem não é retentor crônico, sobretudo com falência ventilatória ou carbonarcose.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 498' } },
    ],
  },
  'adulto-vm-obstruido-grave': {
    resumo: 'Mostra o ajuste do ventilador no obstruído grave pela Tabela 4 do manual do HC, calcula o volume corrente pelo peso e a PEEP a 85% da auto-PEEP e confere os valores do ventilador contra a tabela.',
    instrucoes: 'Informe o peso que quer usar na conta e a auto-PEEP medida na pausa expiratória. Para conferir o ventilador, informe FR, tempo inspiratório, fluxo, Pplatô, Ppico e pH.',
    quandoUsar: [
      { texto: 'Auto-PEEP: na expiração, a curva de fluxo não toca a linha de base antes do novo disparo, ou a PEEP aferida na pausa expiratória é maior que a regulada.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 504' } },
    ],
  },
  'adulto-vm-mecanica': {
    resumo: 'Calcula resistência, complacência estática, constante de tempo e driving pressure com as fórmulas do manual do HC e compara com as faixas normais do livro.',
    instrucoes: 'Em VCV com fluxo quadrado, sem esforço do paciente e com pausa inspiratória, informe volume corrente, fluxo, Ppico, Pplatô e PEEP.',
    quandoUsar: [
      { texto: 'A medida vale em volume controlado com curva de fluxo quadrada, sem esforço muscular respiratório (de preferência sedado e bloqueado) e com pausa inspiratória de 2 a 3 segundos, sem vazamento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 499–500' } },
      { texto: 'Valores normais em ventilação mecânica: resistência de 4 a 8 cmH2O/L/s e complacência de 50 a 80 mL/cmH2O; o esvaziamento alveolar leva de 3 a 5 constantes de tempo.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 499' } },
    ],
  },
  'adulto-vm-sdra': {
    resumo: 'Classifica a SDRA pelos critérios de Berlim do manual do HC e pela definição global de 2024, calcula o volume corrente pela gravidade e marca a coluna das tabelas de PEEP × FiO2.',
    instrucoes: 'Informe PaO2, FiO2 e PEEP; para a definição global, a SpO2 e o suporte respiratório. Depois, o peso que quer usar na conta, a tabela de PEEP e os valores do ventilador para conferir a Tabela 5.',
    quandoUsar: [
      { texto: 'Pelos critérios de Berlim do manual, com PEEP de 5 cmH2O ou mais, a SDRA é leve com P/F de 201 a 300, moderada de 101 a 200 e grave com 100 ou menos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 505' } },
      { texto: 'Pela definição global de 2024, o critério de oxigenação é P/F de 300 ou menos ou S/F de 315 ou menos com SpO2 até 97%; o paciente não intubado entra se estiver em CNAF de 30 L/min ou mais ou em VNI/CPAP de 5 ou mais.', ref: { fonte: 'Definição global de SDRA 2024 (Matthay et al., Am J Respir Crit Care Med 2024)', pagina: 'Tabela 1' } },
    ],
  },
  'adulto-vm-desmame': {
    resumo: 'Confere os parâmetros para o teste de respiração espontânea e os critérios de falência durante o teste pela Figura 5 do manual do HC.',
    instrucoes: 'Confira os critérios subjetivos listados e informe PO2, FiO2, PEEP e FC antes do teste; durante o teste, informe FC, FR, SatO2 e PAS para ver os critérios de falência.',
    quandoUsar: [
      { texto: 'Para o teste de respiração espontânea: resolução do motivo da intubação, tosse e drive respiratório adequados, PO2 de 60 mmHg ou mais com FiO2 até 0,4, P/F de 150 ou mais, PEEP até 5 a 8 cmH2O e FC abaixo de 140.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'Figura 5, p. 510' } },
      { texto: 'Pela AARC 2024, o índice de respiração rápida e superficial não é necessário para decidir se o paciente está pronto para o teste, que pode ser feito com ou sem pressão de suporte, sem aumentar a FiO2.', ref: { fonte: 'AARC 2024 (Roberts et al., Respir Care 2024)', grau: 'condicional' } },
    ],
  },
  'adulto-oxigenacao-irpa': {
    resumo: 'Calcula o gradiente A-a e a relação P/F, classifica o tipo de insuficiência respiratória aguda e mostra os alvos de SatO2, a FiO2 dos dispositivos e os cortes de VNI e de intubação do manual do HC.',
    instrucoes: 'Informe PaO2, PaCO2, pH, a FiO2 na coleta, a SpO2 e a idade. Para a VNI, a FR e o APACHE II; para o cateter nasal, o fluxo; e diga se há DPOC ou risco de hipercapnia.',
    quandoUsar: [
      { texto: 'Insuficiência respiratória aguda em ar ambiente é PaO2 abaixo de 60 mmHg (ou SpO2 abaixo de 90%) ou PaCO2 acima de 45 mmHg; o tipo 1 tem PaCO2 abaixo de 45 e o tipo 2, acima de 45.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 27', pagina: 'p. 370 e 373–374' } },
      { texto: 'Na IRpA hipoxêmica, a ATS recomenda CNAF e sugere VNI ou CPAP, com vigilância próxima para escalar o suporte; o benefício é na necessidade de intubação.', ref: { fonte: 'ATS 2026, suporte respiratório não invasivo (Goel et al., Am J Respir Crit Care Med 2026)', grau: 'forte (CNAF); condicional (VNI ou CPAP)' } },
    ],
  },
  'adulto-dispneia-abordagem': {
    resumo: 'Compara sinais vitais, radiografia, BNP e história do paciente com dispneia com os cortes do manual do HC e mostra o que o livro diz de cada um, sem fazer diagnóstico.',
    instrucoes: 'Informe FR, SatO2, PaO2, FC e enchimento capilar; para exames e história, o índice cardiotorácico, o BNP, a idade e o tabagismo em maços-ano.',
    quandoUsar: [
      { texto: 'Critérios do livro para avaliação e tratamento imediatos: FR acima de 30 irpm, saturação abaixo de 90%, musculatura acessória, fala entrecortada, estridor, cianose, sudorese ou agitação psicomotora.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 26', pagina: 'p. 360' } },
    ],
  },
  'adulto-fibrilacao-atrial': {
    resumo: 'Calcula pelo peso as doses e a vazão das drogas de controle de frequência e de ritmo da fibrilação atrial nas diluições do manual do HC e mostra a anticoagulação pela duração da FA, com a ESC 2024 e a SBC 2025 ao lado.',
    instrucoes: 'Informe o peso e a duração da FA, ou marque tempo indeterminado. Para a anticoagulação, marque se o paciente é idoso e informe o clearance de creatinina.',
    quandoUsar: [
      { texto: 'Cardioversão elétrica: na instabilidade causada pela FA ou na FA com pré-excitação e, de emergência, na isquemia coronariana aguda, no edema agudo de pulmão ou na hipoperfusão.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 17', pagina: 'Figura 3, p. 255; p. 247–248' } },
      { texto: 'Para a ESC 2024 e a SBC 2025, com FA de mais de 24 horas ou de tempo desconhecido não se cardioverte sem pelo menos 3 semanas de anticoagulação ou ETE sem trombo; o manual usa a fronteira de 48 horas.', ref: { fonte: 'ESC 2024 e SBC/SOBRAC 2025, fibrilação atrial', pagina: 'ESC p. 3356; SBC p. 37' } },
    ],
  },
  'adulto-emergencia-hipertensiva': {
    resumo: 'Mostra os alvos de PA e FC por condição da Tabela 4 do manual do HC e calcula a PAM-alvo, a meta da regra geral e a vazão das drogas EV no preparo do livro, com a Diretriz Brasileira de 2025 ao lado.',
    instrucoes: 'Escolha a condição e informe a PAM atual para ver o alvo; nos demais casos, informe a PAS. Para as drogas EV, informe o peso e a dose do nitroprussiato ou da nitroglicerina.',
    quandoUsar: [
      { texto: 'Emergência hipertensiva é a PA elevada com doença orgânica modificada pela hipertensão (DOMH).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 19', pagina: 'Tabela 1, p. 270–271' } },
      { texto: 'São DOMH: encefalopatia hipertensiva, IAM ou angina instável, retinopatia bilateral avançada, edema agudo de pulmão, AVE, dissecção de aorta, insuficiência renal aguda, hemólise com trombocitopenia e pré-eclâmpsia ou eclâmpsia. Sem DOMH, o livro não vê benefício comprovado em medicar no PS.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 19', pagina: 'Tabela 1, p. 270–271; p. 276' } },
    ],
  },
  'adulto-sindrome-aortica': {
    resumo: 'Mostra o alvo de PAS e FC na dissecção de aorta, os cortes de diâmetro para cirurgia e as complicações anuais pelo tamanho da aorta, pelo manual do HC, com a ESC 2024 ao lado.',
    instrucoes: 'Informe o diâmetro da aorta, em centímetros, para ver a linha de complicações anuais da Tabela 3 do manual.',
    quandoUsar: [
      { texto: 'Na síndrome aórtica aguda, a ESC recomenda tratamento anti-impulso imediato com PAS abaixo de 120 mmHg e FC de 60 bpm ou menos.', ref: { fonte: 'ESC 2024, doenças arteriais periféricas e da aorta (slideset oficial)', pagina: 'slide 117', grau: 'I, B' } },
      { texto: 'Dissecção Stanford A: mortalidade de 1% a 2% por hora e de 50% nas primeiras 48 horas; o tratamento preconizado é a cirurgia de emergência.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 20', pagina: 'p. 283' } },
    ],
  },
  'adulto-add-rs': {
    resumo: 'Estima o risco de síndrome aórtica aguda pelo ADD-RS e, com 0 ou 1 ponto, usa o D-dímero para decidir entre encerrar a investigação e pedir a angiotomografia, pelo manual do HC.',
    instrucoes: 'Marque os itens presentes em antecedentes, características da dor e exame físico; cada grupo vale no máximo 1 ponto, de 0 a 3. Com 0 ou 1 ponto, informe o D-dímero, se colhido.',
    quandoUsar: [
      { texto: 'Na suspeita de síndrome aórtica aguda, a ESC recomenda um algoritmo multiparamétrico com o ADD-RS para confirmar ou afastar o diagnóstico.', ref: { fonte: 'ESC 2024, doenças arteriais periféricas e da aorta (slideset oficial)', pagina: 'slide 116', grau: 'I, B' } },
    ],
    porQueUsar: [
      { texto: 'Com ADD-RS de 0 ou 1 e D-dímero abaixo de 500 ng/mL FEU, o manual diz que não é preciso continuar a investigação de síndrome aórtica: o falso-negativo é de 0,3%.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 20', pagina: 'p. 282' } },
    ],
  },
  'adulto-ic-aguda': {
    resumo: 'Define o perfil hemodinâmico e a faixa de PAS da Figura 1 do manual do HC, calcula a furosemida pelo peso, a resposta ao diurético e a vazão das infusões, e lê peptídeos, prognóstico e critérios de UTI.',
    instrucoes: 'Informe o peso, a PAS e, se conhecida, a fração de ejeção; escolha a perfusão (quente ou frio) e a volemia (seco ou úmido). Na urinário, diurese em 6 h, exames e sinais vitais são opcionais.',
    quandoUsar: [
      { texto: 'IC é improvável com BNP abaixo de 100 pg/mL ou NT-proBNP abaixo de 300 pg/mL, e provável com BNP acima de 400 ou NT-proBNP de 450 ou mais (abaixo de 50 anos), 900 ou mais (50 a 75 anos) ou 1.800 ou mais (acima de 75 anos).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 21', pagina: 'Tabela 4, p. 293' } },
      { texto: 'Choque cardiogênico: PAS abaixo de 90 mmHg por pelo menos 30 minutos; índice cardíaco abaixo de 2,2 L/min/m²; pressão capilar pulmonar acima de 15 mmHg.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 21', pagina: 'p. 297' } },
    ],
  },
  'adulto-pos-pcr': {
    resumo: 'Lê as metas do paciente após o retorno da circulação pela diretriz ERC-ESICM 2025, com o manual do HC como referência, e calcula os tempos de resfriamento e de reaquecimento e as janelas do neuroprognóstico.',
    instrucoes: 'Informe o peso e PaCO2, SatO2, PaO2, PAM e glicemia para ver cada valor contra a meta; para a temperatura, a atual, o alvo e a final; e as horas desde o RCE para as janelas do prognóstico.',
    quandoUsar: [
      { texto: 'Nenhum achado precoce, antes de 24 horas, é confiável para o prognóstico, nem no paciente sedado.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 6', pagina: 'p. 111' } },
      { texto: 'A conclusão do neuroprognóstico só sai da avaliação clínica a partir de 72 horas do RCE.', ref: { fonte: 'ERC-ESICM 2025, cuidados pós-ressuscitação' } },
    ],
  },
  'adulto-trauma-inicial': {
    resumo: 'Calcula a janela e a velocidade do ácido tranexâmico, o débito do dreno no hemotórax, o tempo de torniquete e o cristaloide antes da transfusão no politraumatizado, pelo manual do HC.',
    instrucoes: 'Informe o tempo desde o trauma, a drenagem inicial e a subsequente com as horas, há quanto tempo o torniquete está aplicado e o cristaloide já infundido; cada bloco funciona sozinho.',
    quandoUsar: [
      { texto: 'Hemotórax: drenagem inicial de 1.500 mL ou mais, ou drenagem subsequente acima de 200 mL/h nas 2 a 4 horas seguintes, indica alta probabilidade de toracotomia de urgência.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 47', pagina: 'p. 644–645' } },
      { texto: 'Pela EAST, o ácido tranexâmico é de uso de rotina, no pré-hospitalar e no hospital, no traumatizado em risco de hemorragia: PAS de 90 ou menos, FC de 110 ou mais ou suspeita de sangramento ativo.', ref: { fonte: 'EAST 2025, ácido tranexâmico no trauma (Dumas et al., J Trauma Acute Care Surg 2025)', pagina: 'resumo', grau: 'condicional (GRADE)' } },
    ],
  },
  'adulto-nexus': {
    resumo: 'Diz, por cinco critérios clínicos, quando o colar cervical pode ser retirado sem exame de imagem no trauma, como o manual do HC imprime.',
    instrucoes: 'Informe a idade e responda Sim ou Não a cada um dos cinco critérios; o livro só libera sem imagem com os cinco presentes.',
    quandoUsar: [
      { texto: 'Não vale acima de 60 anos nem em criança: o livro diz que o NEXUS não pode ser usado acima de 60 anos e não foi validado na pediatria.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 47', pagina: 'p. 643' } },
      { texto: 'No paciente inconsciente, o exame físico não descarta lesão cervical, e a proteção da coluna é prioritária.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 47', pagina: 'p. 641' } },
    ],
  },
  'adulto-regra-canadense-coluna': {
    resumo: 'Decide em três passos (fatores de alto risco, fatores de baixo risco e rotação ativa do pescoço a 45°) quem precisa de imagem da coluna cervical no trauma, como a Tabela 1 do manual do HC imprime.',
    instrucoes: 'Informe a idade, marque mecanismo perigoso, parestesias e fatores de baixo risco presentes e diga se o paciente consegue girar o pescoço 45° para a direita e para a esquerda.',
    quandoUsar: [
      { texto: 'Em paciente alerta, a regra pode ser usada para retirar o colar sem exame de imagem; ela não foi validada em pediatria.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 47', pagina: 'p. 641 e 643' } },
    ],
  },
  'adulto-mgap': {
    resumo: 'Soma mecanismo do trauma, Glasgow, idade e pressão sistólica para estimar a gravidade do traumatizado no pré-hospitalar, com as faixas que o manual do HC imprime.',
    instrucoes: 'Escolha o mecanismo (aberto ou fechado), a faixa de idade e a de PAS, e informe o Glasgow, que entra com o próprio valor; a soma vai de 3 a 29.',
    quandoUsar: [
      { texto: 'Foi desenvolvido pelo SAMU da França para sistemas de atendimento pré-hospitalar com médico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 48', pagina: 'p. 671' } },
    ],
  },
  'adulto-triage-rts': {
    resumo: 'Pontua Glasgow, PAS e frequência ventilatória de 0 a 4 cada para a triagem do traumatizado, pela Tabela 4 do manual do HC.',
    instrucoes: 'Informe o Glasgow, a PAS e a frequência ventilatória; a soma vai de 0 a 12.',
    quandoUsar: [
      { texto: 'Triage-RTS abaixo de 11: o livro indica transporte a um centro de trauma.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 48', pagina: 'Tabela 4, p. 672' } },
      { texto: 'É a versão de triagem, por soma simples; o livro não traz o RTS com coeficientes.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 48', pagina: 'p. 671–672' } },
    ],
  },
  'adulto-hemorragia-digestiva': {
    resumo: 'Reúne metas, gatilhos e condutas da hemorragia digestiva alta e baixa pelo manual do HC, com o teste ortostático, a classificação de Forrest, os vasoativos do sangramento varicoso e o índice de choque.',
    instrucoes: 'Informe o peso e a PAS e a FC deitado e em pé para o teste ortostático, e escolha o achado endoscópico. Na HDB, informe FC, PAS, a queda do Ht e os concentrados transfundidos.',
    quandoUsar: [
      { texto: 'Queda da PAS acima de 10 mmHg ou aumento do pulso acima de 10 bpm do decúbito para a ortostase indica perda de pelo menos 1.000 mL de sangue.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 50', pagina: 'p. 696' } },
      { texto: 'Na HDB, queda do hematócrito de mais de 8 pontos e transfusão de mais de 2 concentrados de hemácias indicam HDB maciça; índice de choque acima de 1 indica instabilidade.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 51', pagina: 'p. 710–711 e 714' } },
    ],
  },
  'adulto-oakland': {
    resumo: 'Identifica, pela Tabela 6 do manual do HC, o paciente com hemorragia digestiva baixa de sangramento menor, candidato a alta e investigação ambulatorial.',
    instrucoes: 'Escolha a faixa de idade, o sexo, se houve HDB prévia e as faixas de FC, PAS e hemoglobina; o total vai de 0 a 34.',
    quandoUsar: [
      { texto: 'Para achar o paciente de baixo risco que pode ter alta precoce e investigação ambulatorial, a ACG sugere usar escore de risco, como o Oakland de 8 ou menos, para complementar o julgamento clínico, sem substituí-lo.', ref: { fonte: 'ACG 2023, hemorragia digestiva baixa (Sengupta et al., Am J Gastroenterol 2023)', grau: 'condicional, baixa' } },
      { texto: 'Pela tabela do manual, Oakland de 8 ou menos é sangramento menor, que pode ter alta; o texto do capítulo põe o corte em menos de 8 e manda internar acima de 8.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 51', pagina: 'p. 714–716' } },
    ],
  },
  'adulto-ascite-pbe-hepatorrenal': {
    resumo: 'Calcula o GASA, a albumina após paracentese, na PBE e na síndrome hepatorrenal, classifica o líquido ascítico e o estádio ICA-AKI e acompanha os degraus da terlipressina, pelo manual do HC.',
    instrucoes: 'Informe o peso e, conforme o bloco, a albumina sérica e a do líquido, o volume retirado, os PMN e a cultura do líquido, a creatinina basal e a atual e a dose do dia de terlipressina.',
    quandoUsar: [
      { texto: 'PBE clássica é PMN de 250/mm³ ou mais no líquido ascítico com cultura positiva para agente único; com cultura negativa (ascite neutrocítica), o livro manda tratar como PBE clássica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 57', pagina: 'p. 782–783' } },
      { texto: 'Síndrome hepatorrenal pelo manual: cirrose com ascite, creatinina subindo 0,3 mg/dL ou mais em 48 horas ou mais de 50% sobre a basal, sem melhora após 48 horas de albumina, sem choque, sem nefrotóxico e sem doença renal parenquimatosa.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 58', pagina: 'p. 791–793' } },
    ],
  },
  'adulto-encefalopatia-hepatites-graves': {
    resumo: 'Classifica a encefalopatia hepática por West Haven, calcula lactulose, meta nutricional, plasma e N-acetilcisteína pelo peso e aplica os critérios do King\'s College, pelo manual do HC.',
    instrucoes: 'Informe o peso e escolha o estádio de West Haven; para o King\'s College, escolha a etiologia (paracetamol ou outras) e marque os critérios presentes.',
    quandoUsar: [
      { texto: 'Hepatite fulminante é a encefalopatia em menos de 26 semanas do aparecimento da icterícia; é hiperaguda se em menos de 1 semana.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 60', pagina: 'p. 810' } },
      { texto: 'Na insuficiência hepática aguda, quem preenche os critérios do King\'s College ou tem MELD acima de 25 tem alto risco de evolução ruim.', ref: { fonte: 'ACG 2023, insuficiência hepática aguda (Shingina et al., Am J Gastroenterol 2023)', grau: 'condicional, baixa' } },
    ],
  },
  'adulto-maddrey': {
    resumo: 'Calcula a função discriminante de Maddrey para definir a hepatite alcoólica grave pelo corte do manual do HC.',
    instrucoes: 'Informe o TP do paciente e o TP controle, em segundos (não o INR), e a bilirrubina total em mg/dL.',
    quandoUsar: [
      { texto: 'Pelo manual, função discriminante acima de 32 define hepatite alcoólica grave.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 60', pagina: 'p. 817' } },
      { texto: 'A ACG, posterior ao livro, considera o MELD o escore mais acurado para estratificar a hepatite alcoólica; MELD acima de 20 define a forma grave.', ref: { fonte: 'ACG 2024, doença hepática alcoólica (Jophlin et al., Am J Gastroenterol 2024)' } },
    ],
    porQueUsar: [
      { texto: 'No STOPAH (1.068 pacientes), o Maddrey discriminou pior a mortalidade em 28 e 90 dias que o MELD, o GAHS e o ABIC.', ref: { fonte: 'ACG 2024, doença hepática alcoólica (Jophlin et al., Am J Gastroenterol 2024)' } },
    ],
  },
  'adulto-lesao-renal-aguda': {
    resumo: 'Estadia a lesão renal aguda pelo KDIGO, calcula FENa, FEUr e índices urinários e o teste de estresse com furosemida, e mostra as indicações de diálise do manual do HC.',
    instrucoes: 'Informe o peso, a creatinina basal e a atual e a diurese do período; para as frações excretórias, sódio, creatinina e ureia urinários e plasmáticos e a osmolaridade urinária.',
    quandoUsar: [
      { texto: 'LRA é a creatinina subir 0,3 mg/dL ou mais em 48 horas, ou chegar a 1,5 vez o basal conhecido ou presumido dos 7 dias anteriores, ou a diurese ficar abaixo de 0,5 mL/kg/h por 6 horas.', ref: { fonte: 'KDIGO 2012, lesão renal aguda', pagina: 'resumo das recomendações' } },
      { texto: 'Indicações de diálise pelo manual: hipervolemia refratária, acidose refratária (pH abaixo de 7,1), hipercalemia refratária, síndrome urêmica, intoxicação dialisável e azotemia progressiva ou oligúria sem resposta a fluido.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 61', pagina: 'Tabela 5, p. 837–838' } },
    ],
  },
  'adulto-rabdomiolise': {
    resumo: 'Calcula a CPK em múltiplos do limite superior, o alvo de diurese pelo peso e as soluções de bicarbonato e manitol da Tabela 3 do manual do HC.',
    instrucoes: 'Informe o peso, a CPK e o limite superior de normalidade do laboratório.',
    quandoUsar: [
      { texto: 'Rabdomiólise: estímulo miotóxico agudo ou urina escura com elevação aguda da CPK acima de 5 a 10 vezes o limite superior, em geral acima de 1.000 UI/L; não há corte rigoroso.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 63', pagina: 'p. 854' } },
      { texto: 'O workshop ENMC 2024, posterior ao livro, exige sintomas musculares e CPK acima de 10.000 UI/L na rabdomiólise por esforço ou acima de 5.000 UI/L na não relacionada ao esforço.', ref: { fonte: 'ENMC 2024 (Kruijt et al., Neuromuscul Disord 2025)' } },
    ],
  },
  'adulto-mcmahon-rabdomiolise': {
    resumo: 'Estima o risco de óbito ou diálise do paciente com rabdomiólise pela Tabela 2 do manual do HC.',
    instrucoes: 'Escolha a faixa de cada item: idade, sexo, creatinina, cálcio, CPK e fósforo iniciais, causa de base e bicarbonato; o total vai de 0 a 18.',
    quandoUsar: [
      { texto: 'O workshop ENMC recomenda tratar a rabdomiólise só quando o risco de LRA é alto, estimado pelo escore de McMahon.', ref: { fonte: 'ENMC 2024 (Kruijt et al., Neuromuscul Disord 2025)' } },
      { texto: 'O livro diz que o escore ainda precisa de mais estudos para validação clínica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 63', pagina: 'p. 857' } },
    ],
    porQueUsar: [
      { texto: 'Abaixo de 5 pontos, o risco de óbito ou diálise é de 2,3%; acima de 10, de 61%. O corte de 5 pontos tem valor preditivo negativo de 98% e positivo de 27%.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 63', pagina: 'p. 857' } },
    ],
  },
  'adulto-crise-tireotoxica': {
    resumo: 'Mostra as drogas da crise tireotóxica pelo manual do HC (tionamidas, iodo, lítio, betabloqueadores e corticoide), com os totais diários e o consenso europeu de 2026 ao lado.',
    instrucoes: 'Informe o peso para a conta do esmolol; as demais drogas não dependem do peso e aparecem com o total diário.',
    quandoUsar: [
      { texto: 'O diagnóstico é clínico, com o Burch-Wartofsky e os critérios JTA/JES como apoio; no idoso, o quadro pode ser apático.', ref: { fonte: 'ETA/BTA/SfE 2026, tempestade tireoidiana (Taylor et al., Eur Thyroid J 2026)', grau: 'consenso, sem graduação' } },
      { texto: 'Tratar em UTI ou semi-intensiva se houver vasopressor, rebaixamento, suporte ventilatório, insuficiência cardíaca, choque cardiogênico ou arritmia, disfunção de múltiplos órgãos ou piora apesar do tratamento.', ref: { fonte: 'ETA/BTA/SfE 2026, tempestade tireoidiana (Taylor et al., Eur Thyroid J 2026)', grau: 'consenso, sem graduação' } },
    ],
  },
  'adulto-burch-wartofsky': {
    resumo: 'Soma os critérios de Burch-Wartofsky para estimar a probabilidade de crise tireotóxica, pela Tabela 4 do manual do HC.',
    instrucoes: 'Escolha a faixa de temperatura e de FC e o grau de cada achado: efeitos no SNC, disfunção gastrointestinal ou hepática, insuficiência cardíaca, fibrilação atrial e fator precipitante.',
    quandoUsar: [
      { texto: 'O diagnóstico de crise tireotóxica é clínico; o escore ajuda nos casos duvidosos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 70', pagina: 'p. 947 e 950' } },
      { texto: 'Pelo consenso europeu, Burch-Wartofsky abaixo de 25 torna a crise improvável, de 25 a 44 indica crise iminente e de 45 ou mais é muito sugestivo; com 25 a 44, tratar como tempestade é decisão do intensivista com o endocrinologista.', ref: { fonte: 'ETA/BTA/SfE 2026, tempestade tireoidiana (Taylor et al., Eur Thyroid J 2026)', grau: 'consenso, sem graduação' } },
    ],
  },
  'adulto-estado-mixedematoso': {
    resumo: 'Reúne a reposição de T4, T3 e hidrocortisona e as medidas de suporte do estado mixedematoso do adulto pelo manual do HC, com o consenso de 2026 ao lado.',
    instrucoes: 'Não há campos para preencher: a tela mostra as doses como o livro traz, com o total diário de T3 e de hidrocortisona, sem ajuste por peso ou idade. O escore diagnóstico fica em ferramenta própria.',
    quandoUsar: [
      { texto: 'Tratar pela suspeita clínica, sem esperar o resultado dos exames; no hipotireoidismo central, o TSH pode vir baixo ou normal.', ref: { fonte: 'Consenso BTA/ETA/SfE/WEDS 2026, coma mixedematoso', pagina: 'tema "Quando tratar"', grau: 'consenso, sem graduação' } },
      { texto: 'Os níveis de hormônio tireoidiano não têm ponto de corte para o diagnóstico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 71', pagina: 'p. 960' } },
    ],
  },
  'adulto-escore-mixedema': {
    resumo: 'Soma os achados clínicos e laboratoriais da Tabela 3 do manual do HC para estimar a probabilidade de estado mixedematoso no adulto.',
    instrucoes: 'Escolha a faixa de temperatura, o SNC, o trato gastrointestinal, o fator precipitante e a bradicardia, e marque os achados cardiovasculares, metabólicos e os outros presentes. Total de 60 ou mais é extremamente sugestivo; de 25 a 59, sugestivo; abaixo de 25, improvável.',
    quandoUsar: [
      { texto: 'Os níveis de hormônio tireoidiano não têm ponto de corte para o diagnóstico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 71', pagina: 'p. 960' } },
      { texto: 'Sepse e eventos cardiovasculares graves podem dar pontuação parecida: interpretar o escore com a clínica e os exames.', ref: { fonte: 'Consenso BTA/ETA/SfE/WEDS 2026, coma mixedematoso', pagina: 'tema "Escore diagnóstico"', grau: 'consenso, sem graduação' } },
    ],
  },
  'adulto-insuficiencia-adrenal': {
    resumo: 'Interpreta o cortisol basal e o cortisol após ACTH e reúne hidrocortisona, fludrocortisona e volume da crise adrenal do adulto pelo manual do HC, com as diretrizes de 2016 e 2024 ao lado.',
    instrucoes: 'Informe o peso para o volume da Figura 1 e, se houver, o cortisol basal das 8 h e o cortisol 30 minutos após o ACTH, em µg/dL.',
    quandoUsar: [
      { texto: 'Cortisol basal das 8 h de 3 µg/dL ou menos confirma a insuficiência adrenal; acima de 19, praticamente exclui; entre 3 e 19, fazer o teste com ACTH.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 72', pagina: 'p. 969' } },
      { texto: 'Suspeitar de crise adrenal em quem usa ou usou qualquer glicocorticoide (oral, inalado, tópico ou intra-articular) e chega com instabilidade, vômito ou diarreia.', ref: { fonte: 'ESE/Endocrine Society 2024, insuficiência adrenal induzida por glicocorticoide', pagina: 'tema "Glicocorticoide em uso ou recente"', grau: 'boa prática' } },
    ],
  },
  'adulto-agitacao': {
    resumo: 'Reúne a contenção química e mecânica por nível de agitação, a quetamina por peso, os antipsicóticos do delirium e a síndrome neuroléptica maligna do adulto pelo manual do HC, com a ACEP 2024 ao lado.',
    instrucoes: 'Informe o peso e se o paciente é idoso. FC e PAS dão o shock index; no delirium, as doses já feitas mostram quanto falta para a máxima da Tabela 7.',
    quandoUsar: [
      { texto: 'O manual classifica a agitação pela descrição clínica: leve, conversa e colabora; moderada, disruptivo, sem perigo iminente; grave, combativo.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 76', pagina: 'p. 1006' } },
      { texto: 'Agitação de causa desconhecida: a via oral é sempre preferível; no paciente muito agitado, prioriza-se a via intramuscular.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 76', pagina: 'p. 1010' } },
    ],
  },
  'adulto-bars': {
    resumo: 'Gradua o comportamento do paciente de 1 a 7, da sedação profunda à agitação violenta, pela escala BARS da Tabela 1 do manual do HC.',
    instrucoes: 'Escolha a descrição que melhor corresponde ao comportamento observado; 4 é quieto e acordado. A tela mostra a conduta de triagem pré-hospitalar da Tabela 1.',
    quandoUsar: [
      { texto: 'A Tabela 1 é de triagem pré-hospitalar; no hospital, o manual classifica a agitação em leve, moderada e grave pela descrição clínica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 76', pagina: 'p. 1005–1006' } },
    ],
  },
  'adulto-hsa': {
    resumo: 'Calcula as doses diárias e o total do nimodipino em 21 dias e reúne as metas numéricas da hemorragia subaracnóidea do adulto pelo manual do HC, com a AHA/ASA 2023 ao lado.',
    instrucoes: 'Não há campos para preencher: a tela mostra a conta do nimodipino, as metas de hemoglobina, PA, PIC, PPC e pCO2 e a comparação com a AHA/ASA 2023. As escalas da HSA ficam em ferramentas próprias.',
    quandoUsar: [
      { texto: 'Nimodipino em todos os pacientes: não reduz comprovadamente o vasoespasmo, mas se relaciona a melhor prognóstico neurológico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 560' } },
      { texto: 'O início precoce do nimodipino enteral previne a isquemia cerebral tardia e melhora o desfecho.', ref: { fonte: 'AHA/ASA 2023, HSA aneurismática', pagina: 'e339–e340', grau: '1, A' } },
    ],
  },
  'adulto-ottawa-hsa': {
    resumo: 'Identifica, entre adultos com cefaleia súbita não traumática e sem rebaixamento da consciência, quem precisa ser investigado para hemorragia subaracnóidea.',
    instrucoes: 'Responda aos seis itens da Tabela 2; qualquer item presente torna a regra positiva e indica investigação.',
    quandoUsar: [
      { texto: 'Adulto com cefaleia súbita não traumática e sem rebaixamento do nível de consciência.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'Tabela 2, p. 553–554' } },
    ],
    porQueUsar: [
      { texto: 'Sensibilidade de 100% e especificidade de 15%: a regra não deixa passar HSA, mas exclui da investigação apenas 14% dos pacientes.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 553' } },
    ],
  },
  'adulto-hunt-hess': {
    resumo: 'Classifica de I a V a gravidade clínica da hemorragia subaracnóidea na admissão, pela Tabela 3 do manual do HC.',
    instrucoes: 'Escolha a descrição que corresponde ao quadro do paciente na admissão, de assintomático (I) a coma com descerebração (V).',
    quandoUsar: [
      { texto: 'Paciente com hemorragia subaracnóidea, para graduar o quadro clínico na admissão.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'Tabela 3, p. 554–555' } },
    ],
    porQueUsar: [
      { texto: 'Pode, com limitações, predizer o risco cirúrgico e o prognóstico; o manual não traz mortalidade por grau.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 554–555' } },
      { texto: 'O grau de Hunt-Hess é fator de risco de ressangramento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 558' } },
    ],
  },
  'adulto-wfns': {
    resumo: 'Gradua de 1 a 5 a hemorragia subaracnóidea pela escala de coma de Glasgow e pela presença de déficit motor (escala WFNS, chamada de CFIN no manual do HC).',
    instrucoes: 'Informe o Glasgow (3 a 15) e se há déficit motor. Glasgow 15 com déficit motor não tem linha na tabela.',
  },
  'adulto-fisher-hsa': {
    resumo: 'Classifica de 1 a 4 o padrão do sangramento na TC de crânio da hemorragia subaracnóidea, pela escala de Fisher clássica da Tabela 5 do manual do HC.',
    instrucoes: 'Escolha o achado da TC: sem sangramento, espessura abaixo ou acima de 1 mm, ou hemoventrículo ou hemorragia intraparenquimatosa.',
    porQueUsar: [
      { texto: 'A escala é usada para predizer o risco de vasoespasmo; não tem correlação clínica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 556' } },
      { texto: 'O melhor preditor de vasoespasmo é a quantidade de sangue na TC inicial e a escala de Fisher; o manual não traz risco percentual por grau.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 40', pagina: 'p. 559' } },
    ],
  },
  'adulto-hints-plus': {
    resumo: 'Separa o padrão periférico do central na síndrome vestibular aguda pelo impulso cefálico, pelo nistagmo e pelo desvio skew (HINTS), com a audição no HINTS plus.',
    instrucoes: 'Avalie os três achados do HINTS e, se possível, a audição pelo atrito dos dedos. Com qualquer achado de padrão central, o manual orienta conduzir como AVC agudo.',
    quandoUsar: [
      { texto: 'Síndrome vestibular aguda (episódio único e prolongado); não serve para a vertigem recorrente ou posicional.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 42', pagina: 'p. 578–579' } },
      { texto: 'Use o HINTS só se tiver treino no exame e só no paciente com nistagmo; o atrito dos dedos ajuda a excluir AVC nesse paciente.', ref: { fonte: 'GRACE-3 (SAEM 2023), tontura e vertigem na emergência', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'HINTS plus: sensibilidade de 99,2% e especificidade de 97% para origem central.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 42', pagina: 'p. 583' } },
      { texto: 'Feito na rotina por médicos da emergência sem treino específico, o HINTS é impreciso, em parte por ser usado no paciente errado.', ref: { fonte: 'GRACE-3 (SAEM 2023), tontura e vertigem na emergência', pagina: 'resumo' } },
    ],
  },
  'adulto-guillain-barre': {
    resumo: 'Calcula a imunoglobulina e a plasmaférese por peso, interpreta o liquor e reúne as recomendações da AAN na síndrome de Guillain-Barré do adulto pelo manual do HC, com a EAN/PNS 2023 ao lado.',
    instrucoes: 'Informe o peso para as contas da imunoterapia e, se houver, a proteína (mg/dL) e as células (/mm³) do liquor.',
    quandoUsar: [
      { texto: 'Escore de incapacidade de 3 ou mais: o manual trata sem discussão; no grau 2, tende a tratar. O benefício vai até 4 semanas do início.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'p. 604' } },
      { texto: 'Imunoglobulina no paciente que não anda sem ajuda, até 2 semanas do início da fraqueza; entre 2 e 4 semanas, como ponto de boa prática.', ref: { fonte: 'EAN/PNS 2023, síndrome de Guillain-Barré', pagina: 'resumo', grau: 'recomenda; 2–4 semanas: ponto de boa prática' } },
    ],
  },
  'adulto-criterios-vm-sgb': {
    resumo: 'Verifica, pelos critérios da Tabela 4 do manual do HC, se o paciente com síndrome de Guillain-Barré preenche a indicação de ventilação mecânica.',
    instrucoes: 'Informe o que foi medido (pCO2, pO2, CVF com o peso, PImáx em módulo) e marque os critérios menores; 1 critério maior ou 2 menores preenchem a regra.',
    quandoUsar: [
      { texto: 'Na síndrome de Guillain-Barré, CVF e PImáx devem ser medidas já na admissão no pronto-socorro.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'p. 602' } },
    ],
  },
  'adulto-gbs-incapacidade': {
    resumo: 'Gradua de 0 a 6 a incapacidade funcional na síndrome de Guillain-Barré, pela Tabela 5 do manual do HC.',
    instrucoes: 'Escolha o quadro que corresponde ao paciente, de assintomático (0) a morte (6).',
    quandoUsar: [
      { texto: 'Grau 3 ou mais, grave acometimento motor: o manual diz que o tratamento não se discute.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'p. 604' } },
      { texto: 'O escore medido 2 semanas após a admissão entra no EGOS (Tabela 7).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'p. 606' } },
    ],
  },
  'adulto-egos': {
    resumo: 'Estima o prognóstico de marcha em 6 meses na síndrome de Guillain-Barré pela idade, pela diarreia prévia e pelo escore de incapacidade com 2 semanas da admissão.',
    instrucoes: 'Escolha a faixa de idade de início, se houve diarreia prévia e o escore GBS de incapacidade 2 semanas após a admissão; o total vai de 1 a 7.',
    quandoUsar: [
      { texto: 'Calcular com o escore de incapacidade de 2 semanas após a admissão.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'p. 606' } },
    ],
    porQueUsar: [
      { texto: 'Quanto maior o EGOS, maior a proporção de pacientes sem marcha independente em 6 meses.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 44', pagina: 'Figura 1, p. 607' } },
    ],
  },
  'adulto-perc': {
    resumo: 'Ajuda a descartar TEP sem mais exames quando a probabilidade clínica é baixa e os oito critérios são todos negativos.',
    instrucoes: 'Informe idade, FC e SaO2 em ar ambiente e responda aos cinco itens de história; qualquer critério presente torna o PERC positivo.',
    quandoUsar: [
      { texto: 'Só quando a probabilidade pré-teste de TEP é improvável.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 32', pagina: 'p. 433' } },
      { texto: 'Só na probabilidade clínica baixa (abaixo de 15%): todo negativo, sem mais exames; algum positivo, D-dímero com os critérios do YEARS.', ref: { fonte: 'AHA/ACC 2026, TEP agudo no adulto', pagina: 'Figura 1' } },
    ],
  },
  'adulto-hestia': {
    resumo: 'Identifica, pelos onze critérios de exclusão HESTIA, o paciente com TEP confirmado candidato a tratamento ambulatorial.',
    instrucoes: 'Responda às onze perguntas. Com todas negativas e PESI classe I ou II, o manual considera o tratamento ambulatorial; o PESI fica em ferramenta própria.',
    quandoUsar: [
      { texto: 'Hestia, PESI ou sPESI nas categorias A e B do TEP, para achar o paciente de baixo risco.', ref: { fonte: 'AHA/ACC 2026, TEP agudo no adulto', pagina: 'seção 3.2.1', grau: '1, B-R' } },
      { texto: 'Nas categorias A e B selecionadas, tratar em casa é opção razoável, com anticoagulante na mão e seguimento rápido garantido; Hestia, PESI ou sPESI ajudam a decidir.', ref: { fonte: 'AHA/ACC 2026, TEP agudo no adulto', pagina: 'seção 4.1.1', grau: '2a, B-R' } },
    ],
  },
  'adulto-smart-cop': {
    resumo: 'Estima a necessidade de suporte intensivo (ventilação ou vasopressor) no adulto com pneumonia adquirida na comunidade, pelas oito variáveis da Tabela 6 do manual do HC.',
    instrucoes: 'Marque cada variável presente: PAS, oxigenação e pH valem 2 pontos e as demais, 1. Com 3 pontos ou mais, o manual associa a benefício de terapia intensiva.',
    quandoUsar: [
      { texto: 'Pneumonia adquirida na comunidade no adulto: é o escore adotado no protocolo institucional do HC.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 33', pagina: 'p. 458' } },
    ],
    porQueUsar: [
      { texto: 'Correlação acima de 90% com a necessidade de suporte ventilatório, invasivo ou não, e de vasopressores.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 33', pagina: 'p. 458' } },
    ],
  },
  'adulto-ats-idsa-pac': {
    resumo: 'Identifica a pneumonia adquirida na comunidade grave, com necessidade de terapia intensiva, pelos critérios maiores e menores ATS/IDSA.',
    instrucoes: 'Marque os critérios presentes (2 maiores e 9 menores). A tela mostra a regra do livro (1 maior ou 2 menores) e a da diretriz ATS/IDSA 2019 (1 maior ou 3 menores).',
  },
  'adulto-pac-antibiotico': {
    resumo: 'Mostra o esquema antibiótico da pneumonia adquirida na comunidade do adulto por grupo de risco, com destino, fatores de Pseudomonas, corticoide no choque e critérios de alta, pelo manual do HC, com a ATS 2026 ao lado.',
    instrucoes: 'Escolha o grupo de risco para ver as opções da Tabela 10; informe o peso para a conta da metilprednisolona.',
    quandoUsar: [
      { texto: 'O grupo de risco vem da classe PORT: baixo risco nas classes I e II, intermediário na III e alto na IV e V.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 33', pagina: 'Tabela 5, p. 457' } },
    ],
  },
  'adulto-mascc': {
    resumo: 'Identifica o paciente com neutropenia febril de baixo risco de complicações; abaixo de 21 pontos é critério de alto risco.',
    instrucoes: 'Escolha a intensidade dos sintomas e responda aos outros seis itens; o total vai de 0 a 26.',
    quandoUsar: [
      { texto: 'MASCC de 21 ou mais não basta para baixo risco: o manual também considera alto risco, entre outros, a neutropenia abaixo de 500 esperada por mais de 7 dias.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 81', pagina: 'p. 1067' } },
      { texto: 'O escore não foi validado em quem usa quimioterapia combinada com inibidor de checkpoint imune.', ref: { fonte: 'Consenso MASCC 2026', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na validação multinacional, MASCC de 21 ou mais identificou o baixo risco com valor preditivo positivo de 91%, especificidade de 68% e sensibilidade de 71%.', ref: { fonte: 'Klastersky et al., J Clin Oncol 2000', pagina: 'resumo' } },
      { texto: 'Os pesos vêm de 756 pacientes do grupo de derivação de um estudo prospectivo multinacional.', ref: { fonte: 'Klastersky et al., J Clin Oncol 2000', pagina: 'resumo' } },
    ],
  },
  'adulto-neutropenia-febril': {
    resumo: 'Reúne as definições, os β-lactâmicos do alto risco, as indicações de cobertura para Gram-positivo, os antifúngicos por peso e a duração do tratamento da neutropenia febril do adulto pelo manual do HC.',
    instrucoes: 'Informe o peso para as contas da anfotericina B lipossomal e do voriconazol; as demais doses são fixas. O MASCC fica em ferramenta própria.',
    quandoUsar: [
      { texto: 'Febre é a temperatura axilar de 37,8 °C ou mais sustentada por uma hora; não medir a temperatura retal.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 81', pagina: 'p. 1062' } },
      { texto: 'Neutropenia é a contagem abaixo de 500 células, ou entre 500 e 1.000 com perspectiva de queda nas 48 horas seguintes.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 81', pagina: 'p. 1062' } },
    ],
  },
  'adulto-cairo-bishop': {
    resumo: 'Define a síndrome de lise tumoral laboratorial e clínica pelos critérios de Cairo-Bishop da Tabela 3 do manual do HC.',
    instrucoes: 'Marque os critérios laboratoriais e clínicos presentes. Dois laboratoriais fecham a lise laboratorial; com mais um clínico, a lise clínica.',
    quandoUsar: [
      { texto: 'Os critérios laboratoriais valem de 3 dias antes a 7 dias depois da terapia citotóxica.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 84', pagina: 'p. 1102' } },
    ],
  },
  'adulto-lise-tumoral': {
    resumo: 'Reúne o risco por neoplasia, a hidratação pela superfície corporal, o alopurinol com ajuste renal, a rasburicase por peso e o produto cálcio × fósforo da síndrome de lise tumoral do adulto pelo manual do HC, com a BSH 2025 ao lado.',
    instrucoes: 'Informe o peso e a superfície corporal já calculada (o manual não traz a fórmula), escolha a função renal e, se quiser, informe o cálcio e o fósforo.',
    quandoUsar: [
      { texto: 'Em neoplasia hematológica, avaliar o risco de lise antes de toda nova linha de tratamento, pela doença, pelo paciente e pelo tratamento.', ref: { fonte: 'BSH 2025, síndrome de lise tumoral', pagina: 'tema "Avaliação de risco"', grau: '2B' } },
    ],
  },
  'adulto-falciforme': {
    resumo: 'Calcula a hidratação, a morfina e a quetamina por peso e reúne a analgesia por intensidade, o antibiótico e as metas da síndrome torácica aguda na anemia falciforme do adulto pelo manual do HC, com a diretriz francesa de 2025 ao lado.',
    instrucoes: 'Informe o peso: a tela calcula o volume em 24 h e as doses de morfina e de quetamina. A analgesia segue a intensidade da dor, de 1 a 10.',
    quandoUsar: [
      { texto: 'Na crise álgica, a dor é graduada de 1 a 10; com dor de 8 ou mais, opioide parenteral com tempo porta-opioide de até 30 minutos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 80', pagina: 'p. 1056' } },
      { texto: 'A síndrome torácica aguda é moderada a grave quando acomete mais de um lobo, pede O2 de 4 L/min ou mais ou piora.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 80', pagina: 'p. 1058' } },
    ],
  },
  'adulto-sindrome-toracica-aguda': {
    resumo: 'Confirma a síndrome torácica aguda na doença falciforme pelo infiltrado novo na radiografia e pelos critérios da Tabela 3 do manual do HC.',
    instrucoes: 'Diga se há infiltrado novo na radiografia e marque os critérios presentes; infiltrado com pelo menos 1 dos 7 critérios preenche.',
  },
  'adulto-szpilman': {
    resumo: 'Classifica o afogamento de 0 a VI pelos achados cardiopulmonares, com a sobrevida de cada grau e os indicadores de pior prognóstico do manual do HC.',
    instrucoes: 'Escolha o achado no departamento de emergência e marque os indicadores de pior prognóstico presentes.',
    porQueUsar: [
      { texto: 'A sobrevida cai com o grau: 100% nos graus 0 e I, 99% no II, 95–96% no III, 78–82% no IV, 56–69% no V e 7–12% no VI.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 100', pagina: 'Tabela 1, p. 1340–1341' } },
      { texto: 'O tempo de submersão é o principal preditor do desfecho; com submersão acima de 30 minutos, o prognóstico é ruim, qualquer que seja a temperatura da água.', ref: { fonte: 'WMS 2024, afogamento', pagina: 'tema "Prognóstico"' } },
    ],
  },
  'adulto-hipotermia': {
    resumo: 'Estadia a hipotermia acidental pela temperatura central e orienta RCP, adrenalina, desfibrilação e método de reaquecimento no adulto pelo manual do HC, com a ERC 2025 ao lado.',
    instrucoes: 'Informe a temperatura central e se há sinais vitais. As temperaturas inicial e atual com o intervalo dão a taxa de reaquecimento; FC, PAS e arritmia ventricular conferem os critérios de ECPR da ERC 2025.',
    quandoUsar: [
      { texto: 'No manual, os estágios HT I a III coincidem com os da ERC; o HT IV é definido pela ausência de sinais vitais, geralmente abaixo de 24 °C.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 102', pagina: 'Tabela 1, p. 1360' } },
      { texto: 'Estágios: I de 35 a 32 °C (consciente, com tremor), II de 32 a 28 °C (consciência alterada), III de 28 a 24 °C (inconsciente, com sinais vitais) e IV abaixo de 24 °C (sem sinais vitais).', ref: { fonte: 'ERC/RCUK 2025, hipotermia acidental', pagina: 'tema "Estágios"' } },
    ],
  },
  'adulto-regiscar': {
    resumo: 'Classifica o diagnóstico de DRESS como excluído, possível, provável ou definitivo pelo escore RegiSCAR da Tabela 4 do manual do HC.',
    instrucoes: 'Marque cada item como ausente ou presente e escolha as faixas de eosinofilia e de órgãos acometidos. O total vai de −4 a 9: abaixo de 2 exclui, 2 a 3 é possível, 4 a 5 provável e acima de 5 definitivo.',
    quandoUsar: [
      { texto: 'Suspeita de DRESS: a latência média é de 2 a 8 semanas, e a mortalidade, de 10 a 20%.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 96', pagina: 'p. 1281' } },
    ],
  },
  'adulto-scorten-uti': {
    resumo: 'Conta os itens do SCORTEN que o manual do HC usa na síndrome de Stevens-Johnson e na necrólise epidérmica tóxica para pedir vaga de UTI.',
    instrucoes: 'Responda aos sete itens; dois ou mais é o critério do manual para solicitar vaga de UTI. A tela não mostra a pontuação nem a mortalidade do SCORTEN.',
    quandoUsar: [
      { texto: 'SSJ/NET pela extensão: SSJ abaixo de 10%, sobreposição de 10 a 30% e NET acima de 30% da área corpórea.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 96', pagina: 'p. 1284' } },
    ],
  },
  'adulto-dermatoses-graves': {
    resumo: 'Calcula por peso a prednisona e a ciclosporina da SSJ/NET e a prednisona do DRESS e reúne as doses fixas de farmacodermias leves, herpes-zóster, erisipela e celulite pelo manual do HC, com a diretriz latino-americana de 2025 ao lado.',
    instrucoes: 'Informe o peso: a tela mostra a dose diária dos corticoides e da ciclosporina; as demais doses do capítulo são fixas. RegiSCAR e itens do SCORTEN ficam em ferramentas próprias.',
    quandoUsar: [
      { texto: 'No DRESS, os sinais de gravidade são TGO ou TGP 5 vezes acima ou acometimento de outros órgãos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 96', pagina: 'p. 1282' } },
      { texto: 'SSJ/NET pela extensão: SSJ abaixo de 10%, sobreposição de 10 a 30% e NET acima de 30% da área corpórea.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 96', pagina: 'p. 1284' } },
    ],
  },
  'adulto-acessos-calibres': {
    resumo: 'Converte French em milímetros e mostra os calibres dos dispositivos periféricos, a agulha intraóssea pelo peso, os sítios e a lidocaína intraóssea do adulto pelo manual do HC.',
    instrucoes: 'Informe o French ou o diâmetro em mm para converter; o peso e o tecido subcutâneo escolhem a agulha intraóssea e dão a conta da lidocaína.',
    quandoUsar: [
      { texto: 'Intraósseo na PCR quando o acesso periférico não puder ser obtido, e no choque, na queimadura extensa, no politrauma, no estado de mal e na desidratação grave após várias tentativas.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 105', pagina: 'p. 1409' } },
      { texto: 'Na sala de reanimação, ter pelo menos dois acessos venosos periféricos calibrosos, com fluxo de pelo menos 100 mL/min (por exemplo, 18 G).', ref: { fonte: 'Diretriz alemã S1 2025, acesso vascular na sala de reanimação', pagina: 'tema "Acessos periféricos na sala de reanimação"', grau: 'S1, consenso de especialistas' } },
    ],
  },
  'adulto-marca-passo-provisorio': {
    resumo: 'Calcula a corrente do marca-passo transcutâneo e a sensibilidade e a saída do transvenoso pelos limiares, com os parâmetros da passagem às cegas e do ímã, pelo manual do HC.',
    instrucoes: 'Informe o limiar de captura do transcutâneo (mA) e os limiares de sensibilidade (mV) e de comando (V ou mA) do transvenoso.',
    quandoUsar: [
      { texto: 'Estimulação transvenosa temporária na bradiarritmia com comprometimento hemodinâmico refratária a cronotrópico IV.', ref: { fonte: 'ESC 2021, estimulação cardíaca', pagina: 'p. 3438; 3486–3487', grau: 'I C' } },
      { texto: 'Estimulação transcutânea na bradiarritmia com comprometimento hemodinâmico quando a transvenosa temporária não é possível ou disponível.', ref: { fonte: 'ESC 2021, estimulação cardíaca', pagina: 'p. 3438; 3486–3487', grau: 'IIa C' } },
    ],
  },
  // Condutas, lote 2 (16/11/2026): pediatria e demais seções, no mesmo método do lote 1
  // (trecho literal do módulo ou da tela, conferido por script). Pediatria sem conteúdo de adulto.
  'adulto-heparina-nao-fracionada': {
    resumo: 'Calcula o bolus e a infusão de heparina não fracionada EV do adulto pelo peso e o ajuste pelo TTPA pela Tabela 7 do manual do HC, com a orientação da ISTH 2026 ao lado.',
    instrucoes: 'Informe o peso e, se quiser o mL/h, a concentração do seu preparo. Para o ajuste, informe o TTPA e a infusão atual em UI/kg/h.',
    quandoUsar: [
      { texto: 'O manual cita preferência pela HNF na instabilidade hemodinâmica, na disfunção renal, nos extremos de peso e de idade e no alto risco de sangramento.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 32', pagina: 'p. 442' } },
    ],
  },
  'adulto-hiponatremia': {
    resumo: 'Corrige o sódio pela glicemia, classifica a hiponatremia e estima o NaCl 3% pela regra do manual do HC (1 mL/kg sobe cerca de 1 mEq/L), com os limites e as condutas das Tabelas 4 e 5.',
    instrucoes: 'Informe peso e sódio; glicemia e osmolaridade são opcionais. Depois escolha a elevação desejada ou a infusão em mL/h e o cenário clínico das Tabelas 4 e 5.',
    quandoUsar: [
      { texto: 'Hiponatremia é o sódio abaixo de 135 mEq/L: leve de 130 a 134, moderada de 120 a 129 e grave abaixo de 120.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 66', pagina: 'p. 882; p. 888' } },
    ],
  },
  'adulto-hipernatremia': {
    resumo: 'Calcula a água corporal total, o déficit de água livre e a variação do sódio por litro de cada solução (Adrogué-Madias) na hipernatremia do adulto, com os limites de velocidade do manual do HC.',
    instrucoes: 'Informe peso, sódio, sexo, se é idoso e se a instalação é aguda ou crônica; a glicemia é opcional. Depois informe a redução desejada para ver os litros de cada solução.',
    quandoUsar: [
      { texto: 'Hipernatremia é o sódio acima de 145 mEq/L.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 66', pagina: 'p. 892' } },
    ],
  },
  'adulto-estado-de-mal-epileptico': {
    resumo: 'Calcula por peso as doses de 1ª, 2ª e 3ª linha do estado de mal epiléptico do adulto pelo manual do HC, com volume, tempo mínimo de infusão e mL/h, e o levetiracetam pelo ESETT ao lado.',
    instrucoes: 'Informe o peso: cada droga mostra a dose, o volume da apresentação e o tempo mínimo de infusão; as infusões de 3ª linha saem em mL/h no preparo do Anexo 1.',
    quandoUsar: [
      { texto: 'A primeira linha é para a crise prolongada por mais de 5 minutos.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 46', pagina: 'p. 627 (Tabela 3)' } },
    ],
  },
  'adulto-profilaxia-tev': {
    resumo: 'Reúne as doses de profilaxia de TEV do manual do HC, os capítulos em que o livro a cita e a reversão da heparina SC por protamina; o livro não traz escore de risco.',
    instrucoes: 'Não há conta para a profilaxia: a tela mostra as doses e onde o manual cita a profilaxia. Para a reversão, informe as UI de heparina SC recebidas.',
    quandoUsar: [
      { texto: 'Na sepse com disfunção orgânica, o manual indica considerar a profilaxia de TEV.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 7', pagina: 'p. 127' } },
      { texto: 'Na exacerbação de DPOC, profilaxia de TEV durante a internação, salvo contraindicação.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 31', pagina: 'p. 425' } },
    ],
  },
  'acesso-venoso': {
    resumo: 'Sugere o dispositivo de acesso venoso do adulto pela duração da terapia, pelo tipo de infusão, pela rede venosa e pela urgência.',
    instrucoes: 'Responda às cinco etapas: perfil, duração da terapia, característica da infusão, rede venosa e urgência. Para criança, a tela não tem referência.',
  },
  'adulto-qtc': {
    resumo: 'Corrige o QT pela frequência cardíaca pelas fórmulas de Bazett, Fridericia, Framingham e Hodges e compara o resultado com os limiares da AHA/ACCF 2010.',
    instrucoes: 'Informe o QT medido em ms, a frequência cardíaca e o sexo. O QTc basal antes da droga é opcional e mostra o aumento sobre ele.',
    quandoUsar: [
      { texto: 'Percentil 99 do QTc em pós-púberes: 470 ms no homem e 480 ms na mulher.', ref: { fonte: 'Drew et al., Circulation 2010 (AHA/ACCF)' } },
      { texto: 'QTc acima de 500 ms ou aumento de 60 ms ou mais sobre o basal pede ação imediata, pelo risco de torsades.', ref: { fonte: 'Drew et al., Circulation 2010 (AHA/ACCF)' } },
    ],
    porQueUsar: [
      { texto: 'Em 6.609 adultos em ritmo sinusal, Fridericia e Framingham corrigiram melhor a frequência e previram melhor a mortalidade em 30 dias; Bazett foi a pior e superestimou o número de pacientes com QTc perigosamente longo.', ref: { fonte: 'Vandenberk et al., J Am Heart Assoc 2016', pagina: 'resumo' } },
    ],
  },
  'ped-infusoes': {
    resumo: 'Converte dose em velocidade da bomba, e velocidade em dose, das infusões contínuas pediátricas, com as faixas do apêndice do PS Pediatria do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso (a idade é opcional), escolha o medicamento e informe a concentração final da solução que você preparou; depois, a dose ou a velocidade na bomba.',
    quandoUsar: [
      { texto: 'Não serve para o recém-nascido: o apêndice do livro não cobre o período neonatal.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 894' } },
    ],
  },
  'ped-rcp-icr': {
    resumo: 'Mostra compressão e ventilação por faixa etária e calcula pelo peso as cargas de desfibrilação e cardioversão e as drogas da parada cardiorrespiratória da criança, pelo livro do ICr-HCFMUSP, com a AHA/AAP 2025 ao lado.',
    instrucoes: 'Escolha a faixa do suporte básico para ver compressão e ventilação; informe o peso para as cargas e as doses.',
    quandoUsar: [
      { texto: 'Lactente é a criança com menos de 1 ano, fora do período de recém-nascido; no adolescente, com sinais de puberdade, o livro remete à RCP do adulto.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 25' } },
    ],
  },
  'ped-via-aerea': {
    resumo: 'Calcula o tubo traqueal com e sem cuff e a profundidade pela idade, mostra o equipamento por idade e peso e calcula as doses da sequência rápida da criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe a idade em anos e meses para o tubo e o equipamento, e o peso para as doses da sequência rápida.',
  },
  'ped-anafilaxia-icr': {
    resumo: 'Mostra os critérios clínicos da anafilaxia e calcula a epinefrina IM por peso ou por idade e as medidas de segunda, terceira linha e da forma refratária na criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso para as doses por kg; a idade em anos e meses dá a dose fixa de epinefrina IM, alternativa do próprio livro.',
    quandoUsar: [
      { texto: 'Anafilaxia: início súbito com acometimento de pele ou mucosa e comprometimento respiratório ou queda da PA ou sintomas de órgão-alvo.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Quadro 3, p. 97–98' } },
      { texto: 'Também é anafilaxia a queda da PA após exposição a alérgeno conhecido: na criança, PA sistólica baixa para a idade ou queda maior que 30%.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Quadro 3, p. 97–98' } },
    ],
  },
  'ped-asma-icr': {
    resumo: 'Calcula por peso o corticoide, o ipratrópio, o magnésio e o salbutamol contínuo da crise asmática da criança e mostra a classificação da crise como referência, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso: a tela mostra as doses da Tabela 3 e do texto, com as divergências. A classificação da Tabela 1 é só referência; a tela não classifica.',
    quandoUsar: [
      { texto: 'A gravidade da crise vem da tabela de classificação do livro: a presença de vários parâmetros, mas não necessariamente de todos, indica a classificação.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Tabela 1, p. 114' } },
    ],
  },
  'ped-crise-epileptica-icr': {
    resumo: 'Calcula por peso os benzodiazepínicos, a dose de ataque, o fenobarbital e as infusões do estado de mal refratário da criança, com o tempo de infusão, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso: cada etapa mostra a dose do livro; fenitoína e valproato mostram também o tempo de infusão.',
    quandoUsar: [
      { texto: 'Medicar as crises que duram mais de 3 a 5 minutos.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 126' } },
    ],
  },
  'ped-sinais-vitais-icr': {
    resumo: 'Mostra, para a idade da criança, as referências do livro do ICr-HCFMUSP: FC normal, valores anormais no choque séptico, PA sistólica baixa na anafilaxia e FR normal.',
    instrucoes: 'Informe a idade em anos, meses e dias. A tela só mostra a referência da idade; não marca valor como alterado.',
    quandoUsar: [
      { texto: 'Taquicardia é a FC acima de 180 bpm até 1 ano e acima de 120 bpm depois de 1 ano; bradicardia, abaixo de 60 bpm em qualquer idade.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'cap. 2, p. 40' } },
    ],
  },
  'ped-choque-icr': {
    resumo: 'Calcula a expansão volêmica em mL/kg e as drogas vasoativas do choque séptico da criança pelo livro do ICr-HCFMUSP, com o escore de Phoenix 2024 e a Surviving Sepsis Campaign pediátrica 2026 ao lado.',
    instrucoes: 'Informe o peso para os volumes e as vasoativas. Para o Phoenix, informe a idade em meses e os dados que houver: oxigenação, suporte respiratório, vasoativos, lactato, PAM, coagulação e Glasgow.',
    quandoUsar: [
      { texto: 'Sepse é a infecção suspeita com escore de Phoenix de 2 ou mais; choque séptico é a sepse com 1 ponto cardiovascular ou mais (hipotensão grave para a idade, lactato de 5 mmol/L ou mais ou vasoativo).', ref: { fonte: 'Schlapbach et al., JAMA 2024 (Phoenix)', pagina: 'JAMA 2024, p. E1–E5 do PDF (Tabela na p. E3)' } },
    ],
  },
  'ped-tce-icr': {
    resumo: 'Calcula por peso o NaCl 3% e o manitol da terapia hiperosmolar no TCE grave da criança e mostra as metas do capítulo (PaCO2, PIC, pressão de perfusão cerebral e osmolaridade), pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe o peso para as doses da terapia hiperosmolar; as metas e os critérios do capítulo aparecem abaixo, com página.',
    quandoUsar: [
      { texto: 'TCE grave é o Glasgow de 3 a 8 pela classificação do livro.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 172' } },
    ],
  },
  'ped-pecarn-menor2-icr': {
    resumo: 'Indica, pela Figura 2 do livro do ICr-HCFMUSP (baseada no PECARN), se a TC de crânio é recomendada, opcional com observação ou não recomendada no TCE leve abaixo de 2 anos.',
    instrucoes: 'Responda sim ou não aos três itens do 1º quadro e aos três do 2º. Qualquer sim no 1º leva a "TC recomendada"; só no 2º, a "TC ou observação".',
    quandoUsar: [
      { texto: 'Criança abaixo de 2 anos com TCE leve (Glasgow de 13 a 15).', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 172; Figura 2, p. 176' } },
    ],
  },
  'ped-pecarn-maior2-icr': {
    resumo: 'Indica, pela Figura 3 do livro do ICr-HCFMUSP (baseada no PECARN), se a TC de crânio é recomendada, opcional com observação ou não recomendada no TCE leve a partir de 2 anos.',
    instrucoes: 'Responda sim ou não aos três itens do 1º quadro e aos quatro do 2º. Qualquer sim no 1º leva a "TC recomendada"; só no 2º, a "TC ou observação".',
    quandoUsar: [
      { texto: 'Criança de 2 anos ou mais com TCE leve (Glasgow de 13 a 15).', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 172; Figura 3, p. 176' } },
    ],
  },
  'ped-pecarn-coluna-cervical': {
    resumo: 'Classifica o risco de lesão da coluna cervical na criança com trauma contuso pelos fatores do PECARN e mostra o que o algoritmo do estudo faz em cada faixa.',
    instrucoes: 'Responda sim ou não aos três itens de alto risco e aos cinco de risco não desprezível.',
    quandoUsar: [
      { texto: 'Criança com trauma contuso conhecido ou suspeito no pronto-socorro, para decidir quem precisa de imagem da coluna cervical.', ref: { fonte: 'Leonard et al., Lancet Child Adolesc Health 2024', pagina: 'resumo' } },
      { texto: 'No algoritmo do estudo: com fator de alto risco, tomografia; só com fator de risco não desprezível, radiografia simples; sem nenhum fator, liberação clínica sem imagem.', ref: { fonte: 'Leonard et al., Lancet Child Adolesc Health 2024', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Validada em 18 prontos-socorros pediátricos dos Estados Unidos, com sensibilidade de 94,3% e valor preditivo negativo de 99,9%; ainda sem validação fora da rede do estudo.', ref: { fonte: 'Leonard et al., Lancet Child Adolesc Health 2024', pagina: 'resumo' } },
      { texto: 'No estudo, 12,7% das crianças com algum fator de alto risco tinham lesão da coluna cervical.', ref: { fonte: 'Leonard et al., Lancet Child Adolesc Health 2024', pagina: 'resumo' } },
    ],
  },
  'ped-pecarn-abdome': {
    resumo: 'Identifica a criança com trauma contuso de tronco em risco muito baixo de lesão intra-abdominal que exige intervenção, pelos sete achados do PECARN.',
    instrucoes: 'Responda sim ou não aos sete achados de história e exame; o risco é muito baixo só com os sete ausentes.',
    quandoUsar: [
      { texto: 'Criança com trauma contuso de tronco, para identificar quem tem risco muito baixo de lesão intra-abdominal que exige intervenção e pode dispensar a TC.', ref: { fonte: 'Holmes et al., Ann Emerg Med 2013', pagina: 'resumo' } },
      { texto: 'Regra positiva não obriga tomografia: pedir TC para toda criança com regra positiva é uso inadequado da regra.', ref: { fonte: 'Holmes et al., Lancet Child Adolesc Health 2024 (validação)', pagina: 'texto' } },
    ],
    porQueUsar: [
      { texto: 'Na validação prospectiva de 2024, a regra teve sensibilidade de 100% (145 de 145 crianças com lesão que exigiu intervenção) e valor preditivo negativo de 100%.', ref: { fonte: 'Holmes et al., Lancet Child Adolesc Health 2024 (validação)', pagina: 'resumo' } },
      { texto: 'Na derivação, com 12.044 crianças em 20 prontos-socorros, o valor preditivo negativo foi de 99,9% e a sensibilidade de 97%.', ref: { fonte: 'Holmes et al., Ann Emerg Med 2013', pagina: 'resumo' } },
    ],
  },
  'ped-twist': {
    resumo: 'Estratifica o risco de torção testicular na criança com dor testicular aguda a partir de cinco achados clínicos.',
    instrucoes: 'Marque os achados presentes (0 a 7 pontos): edema testicular e testículo endurecido valem 2; reflexo cremastérico ausente, náusea ou vômito e testículo elevado valem 1. Baixo risco 0 a 2, intermediário 3 a 4, alto 5 a 7.',
    quandoUsar: [
      { texto: 'Criança com escroto agudo, para estratificar o risco de torção e reduzir os pedidos de ultrassom, que ficaria só para o risco intermediário.', ref: { fonte: 'Barbosa et al., J Urol 2013', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em metanálise de 10 estudos, comparando alto risco (5 a 7) com baixo risco (0 a 2), a sensibilidade foi de 94,2% e a especificidade de 98%.', ref: { fonte: 'Lewis et al., BJU Int 2026', pagina: 'resumo' } },
      { texto: 'Na derivação prospectiva (338 pacientes com escroto agudo, 51 com torção), os cortes de 2 e de 5 tiveram valores preditivos negativo e positivo de 100%.', ref: { fonte: 'Barbosa et al., J Urol 2013', pagina: 'resumo' } },
    ],
  },
  'ped-ten-4-facesp': {
    resumo: 'Rastreia, pela localização e pelo padrão do hematoma e pela idade, a criança abaixo de 4 anos com hematoma suspeito de maus-tratos.',
    instrucoes: 'Confirme que é criança abaixo de 4 anos com pelo menos um hematoma e responda aos quatro componentes (TEN, FACES, 4 e p); qualquer sim torna a regra positiva.',
    quandoUsar: [
      { texto: 'Criança abaixo de 4 anos com hematoma: qualquer componente positivo indica risco potencial de maus-tratos e pede avaliação adicional.', ref: { fonte: 'Pierce et al., JAMA Netw Open 2021', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Na validação em prontos-socorros de 5 hospitais pediátricos (2.161 crianças com hematoma), a regra teve sensibilidade de 95,6% e especificidade de 87,1% para separar maus-tratos de trauma acidental.', ref: { fonte: 'Pierce et al., JAMA Netw Open 2021', pagina: 'resumo' } },
      { texto: 'Com hematoma único (349 crianças, 27 por maus-tratos), a sensibilidade foi de 81,5% e a especificidade de 87,6%: regra negativa deve ser lida com cautela.', ref: { fonte: 'Raut et al., Pediatrics 2025', pagina: 'resumo' } },
    ],
  },
  'ped-glasgow-icr': {
    resumo: 'Calcula a Escala de Coma de Glasgow da criança, com a versão modificada para menores de 5 anos, e classifica a gravidade do TCE pelo total, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Escolha a melhor resposta ocular, verbal e motora; abaixo de 5 anos, use a descrição da escala modificada que aparece em cada opção.',
    quandoUsar: [
      { texto: 'Abaixo de 5 anos, o livro sugere a escala modificada (James, 1985).', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 172 (Tabela 1)' } },
      { texto: 'Gravidade do TCE pelo total: leve de 13 a 15, moderado de 9 a 12 e grave de 3 a 8.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 172' } },
    ],
  },
  'ped-pops-icr': {
    resumo: 'Calcula o POPS, escore de alerta da triagem pediátrica que soma sinais vitais, observação clínica, condição de base e a preocupação de quem avalia, pela Tabela 4 do livro do ICr-HCFMUSP.',
    instrucoes: 'Escolha a faixa etária da tabela e os cinco itens de observação (SO2, respiração, responsividade, impressão e condição de base) e informe pulso, FR e temperatura. Onde a tabela impressa tem lacuna ou sobreposição, o total sai como faixa.',
    quandoUsar: [
      { texto: 'Pontuação total acima de 8 indica avaliação imediata na sala de emergência.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 881' } },
    ],
  },
  'ped-pews-icr': {
    resumo: 'Calcula o PEWS, escore de alerta precoce pediátrico, pelos itens de comportamento, cardiovascular e respiratório da Figura 2 do livro do ICr-HCFMUSP.',
    instrucoes: 'Escolha a pontuação de 0 a 3 em comportamento, cardiovascular e respiratório, começando pelo pior parâmetro, e marque se está em oxigenoterapia (+2). O livro não traz ponto de corte.',
  },
  'ped-phoenix': {
    resumo: 'Calcula o escore de Phoenix 2024 e identifica sepse e choque séptico na criança com infecção suspeita pela disfunção respiratória, cardiovascular, de coagulação e neurológica.',
    instrucoes: 'Informe a idade em meses e os dados que houver: PaO2/FiO2 ou SpO2/FiO2, suporte respiratório, vasoativos, lactato, PAM, plaquetas, INR, D-dímero, fibrinogênio, Glasgow e pupilas. O escore pode ser calculado sem algumas variáveis.',
    quandoUsar: [
      { texto: 'Sepse é a infecção suspeita com escore de Phoenix de 2 ou mais; choque séptico é a sepse com 1 ponto cardiovascular ou mais (hipotensão grave para a idade, lactato de 5 mmol/L ou mais ou vasoativo).', ref: { fonte: 'Schlapbach et al., JAMA 2024 (Phoenix)', pagina: 'JAMA 2024, p. E1–E5 do PDF (Tabela na p. E3)' } },
      { texto: 'Não vale na internação de nascimento nem com idade pós-concepcional abaixo de 37 semanas, e não é ferramenta de triagem precoce.', ref: { fonte: 'Schlapbach et al., JAMA 2024 (Phoenix)', pagina: 'JAMA 2024, p. E1–E5 do PDF (Tabela na p. E3)' } },
    ],
    porQueUsar: [
      { texto: 'Escore de 2 ou mais: mortalidade hospitalar de 7,1% em locais de mais recursos e de 28,5% nos de menos recursos; no choque séptico, 10,8% e 33,5%.', ref: { fonte: 'Schlapbach et al., JAMA 2024 (Phoenix)', pagina: 'JAMA 2024, p. E1–E5 do PDF (Tabela na p. E3)' } },
      { texto: 'O escore foi desenvolvido com mais de 3 milhões de atendimentos em prontuário eletrônico de 10 locais em 4 continentes.', ref: { fonte: 'Schlapbach et al., JAMA 2024 (Phoenix)', pagina: 'resumo' } },
      { texto: 'Na validação externa em 11 prontos-socorros da Austrália e da Nova Zelândia (6.232 crianças), só 4,9% preencheram o Phoenix e a sensibilidade para morte hospitalar foi de 55,0%: o Phoenix define sepse, não faz triagem.', ref: { fonte: 'Long et al., JAMA Netw Open 2025 (SENTINEL)', pagina: 'resumo' } },
    ],
  },
  'ped-fluidoterapia-manutencao': {
    resumo: 'Calcula a necessidade hídrica basal da criança por Holliday-Segar e pela regra prática e mostra as soluções-padrão e as categorias da Figura 1, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade: a tela dá o volume em 24 h e o mL/h, com o teto de 100 mL/h do livro, e o volume de cada categoria da Figura 1.',
    quandoUsar: [
      { texto: 'Solução isotônica tem sódio próximo ao do plasma (131 a 154 mEq/L); hipotônica, abaixo de 130 mEq/L.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 838' } },
    ],
  },
  'ped-sodio': {
    resumo: 'Corrige o sódio pela glicemia, calcula a osmolalidade efetiva, o NaCl 3% por peso, a variação estimada por litro e o déficit de água livre na hipo e na hipernatremia da criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso, idade e sódio; glicemia e osmolalidade medida são opcionais. Para as contas, informe a variação desejada ou o sódio desejado.',
    quandoUsar: [
      { texto: 'Hiponatremia é o sódio abaixo de 135 mEq/L; hipernatremia, acima de 145 mEq/L.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 533; p. 540' } },
      { texto: 'Correção direta do sódio só na hiponatremia sintomática ou na hipovolêmica com sódio abaixo de 120 mEq/L.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 538–539; Figura 4' } },
    ],
  },
  'ped-eletrolitos': {
    resumo: 'Calcula por peso as doses, os máximos e as fórmulas dos distúrbios de potássio, cálcio, magnésio e fósforo da criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade e escolha o eletrólito; cada aba pede o valor sérico ou os dados da conta, como o acesso no potássio e a função renal no magnésio.',
    quandoUsar: [
      { texto: 'Hipocalemia é o potássio abaixo de 3,5 mEq/L (grave abaixo de 2,5); hipercalemia, acima de 5,5 mEq/L.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 544; p. 546' } },
      { texto: 'Hipocalcemia é o cálcio abaixo de 7 mg/dL no prematuro, de 8 no recém-nascido a termo e de 8,8 em crianças e adolescentes.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 550' } },
    ],
  },
  'ped-cad-ehh': {
    resumo: 'Confere os critérios e a gravidade da cetoacidose diabética e do estado hiperglicêmico hiperosmolar na criança e calcula por peso fluidos, potássio, insulina, bicarbonato e o tratamento do edema cerebral, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade, glicemia, pH, bicarbonato, sódio e cloro, a cetonemia ou a cetonúria e o tipo de gasometria, e escolha o corte do bicarbonato (15 ou 18).',
    quandoUsar: [
      { texto: 'CAD: glicemia acima de 200 mg/dL, pH abaixo de 7,3, bicarbonato abaixo de 15 (BSPED/NICE 2021) ou de 18 mEq/L (ISPAD 2022) e cetonemia de 3 mmol/L ou mais ou cetonúria de 2+ ou mais.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Quadro 2, p. 515' } },
      { texto: 'EHH (ISPAD): glicemia acima de 600 mg/dL, pH acima de 7,3 arterial ou de 7,25 venoso, bicarbonato acima de 15, cetonemia abaixo de 3 ou cetonúria ausente ou baixa e osmolalidade acima de 320.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'Quadro 2, p. 515' } },
    ],
  },
  'ped-hipoglicemia': {
    resumo: 'Calcula por peso e idade a glicose por via oral, o bolus de glicose EV e o glucagon na hipoglicemia da criança, e a velocidade de infusão de glicose depois da reversão, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade. Para a infusão depois da reversão, informe a VIG em mg/kg/min e escolha a dextrose a 5% ou a 10%.',
    quandoUsar: [
      { texto: 'Tríade de Whipple: glicemia venosa total abaixo de 40 mg/dL ou plasmática ou sérica abaixo de 45 mg/dL.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 507' } },
      { texto: 'Com sintomas, glicemia abaixo de 70 mg/dL confirma o diagnóstico.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 509' } },
    ],
  },
  'ped-acidobase': {
    resumo: 'Lê a gasometria da criança em três etapas, calcula a compensação esperada, o ânion-gap e a razão delta, e as doses de bicarbonato e de HCl, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe pH, pCO2 e HCO3 e, no distúrbio respiratório, se é agudo ou crônico. Sódio e cloro dão o ânion-gap; o peso entra nas contas de bicarbonato e de HCl.',
    quandoUsar: [
      { texto: 'Acidemia é o pH abaixo de 7,36; alcalemia, acima de 7,44.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 561–562' } },
      { texto: 'Bicarbonato: indicação geral com pH abaixo de 7,1 ou HCO3 abaixo de 8 mEq/L; na CAD, o critério é outro.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 566' } },
    ],
  },
  'ped-reanimacao-neonatal': {
    resumo: 'Mostra a sequência da reanimação do recém-nascido de 34 semanas ou mais em sala de parto, a saturação-alvo, a marca da cânula e as doses de adrenalina e de expansor pela diretriz 2026 da SBP.',
    instrucoes: 'Informe o peso estimado ou ao nascer para as doses e a idade gestacional para a marca da cânula traqueal.',
    quandoUsar: [
      { texto: 'RN com boa vitalidade (respirando ou chorando, tônus em flexão) fica com a mãe.', ref: { fonte: 'SBP, Reanimação do RN ≥ 34 semanas, 2026', pagina: 'p. 12–13' } },
      { texto: 'Apneia, respiração irregular ou FC abaixo de 100 bpm após os passos iniciais: VPP nos primeiros 60 segundos.', ref: { fonte: 'SBP, Reanimação do RN ≥ 34 semanas, 2026', pagina: 'p. 16–17' } },
    ],
  },
  'ped-ictericia-neonatal': {
    resumo: 'Mostra os limiares hora a hora de fototerapia, de escalonamento de cuidado e de exsanguineotransfusão no recém-nascido de 35 semanas ou mais, pela AAP 2022.',
    instrucoes: 'Informe a idade gestacional, as horas de vida e se há fator de risco de neurotoxicidade; a bilirrubina total sérica, e a transcutânea se houver, mostram em que faixa o RN está.',
    quandoUsar: [
      { texto: 'Recém-nascido de 35 semanas ou mais, até 14 dias de vida.', ref: { fonte: 'AAP 2022, hiperbilirrubinemia neonatal', pagina: 'Tabelas Suplementares 1–4' } },
      { texto: 'Dosar a bilirrubina sérica se a transcutânea estiver a até 3 mg/dL do limiar ou for de 15 mg/dL ou mais.', ref: { fonte: 'AAP 2022, hiperbilirrubinemia neonatal', pagina: 'KAS 6' } },
    ],
  },
  'ped-queimadura': {
    resumo: 'Calcula a superfície corporal queimada da criança pelo esquema de Lund e Browder e o volume de reposição pela fórmula de Parkland, com a diurese-alvo, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade e marque a fração queimada de cada superfície, ou informe a SCQ estimada. Depois informe as horas desde o acidente e se há hematúria ou mioglobinúria.',
    quandoUsar: [
      { texto: 'Grande queimado em pediatria é a criança com mais de 10% da superfície corporal queimada.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 159' } },
      { texto: 'Na superfície queimada, só entram as queimaduras de 2º e 3º graus.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 159' } },
    ],
  },
  'ped-intoxicacoes': {
    resumo: 'Calcula por peso a descontaminação, a eliminação e os antídotos da intoxicação exógena da criança e mostra as toxíndromes e os antídotos de eficácia comprovada, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe peso e idade: a tela mostra as doses do capítulo e do Apêndice; toxíndromes e antídotos aparecem como referência.',
    quandoUsar: [
      { texto: 'O capítulo recomenda consultar o centro de controle de intoxicações antes de um antídoto.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023', pagina: 'p. 205–206' } },
    ],
  },
  'ped-escorpiao-aranhas': {
    resumo: 'Mostra o soro e as medidas que o livro do ICr-HCFMUSP associa a cada gravidade do acidente por escorpião e por aranha, com o PCDT do Ministério da Saúde 2026 ao lado; a ferramenta não classifica o acidente.',
    instrucoes: 'Informe peso e idade, escolha o animal e a gravidade que o médico avaliou.',
    quandoUsar: [
      { texto: 'No acidente por escorpião, crianças de 10 anos ou menos, sobretudo as menores de 7, são mais vulneráveis a manifestações sistêmicas graves.', ref: { fonte: 'PCDT dos Acidentes Escorpiônicos, MS 2026', pagina: 'p. 10' } },
    ],
  },
  'ped-tetano-raiva': {
    resumo: 'Mostra a profilaxia do tétano no ferimento, o tratamento do tétano acidental e o soro e a vacina antirrábicos na criança pelo Ministério da Saúde, com o soro calculado pelo peso.',
    instrucoes: 'Informe o peso, a história de vacinação contra tétano e o tipo de ferimento, e marque se a criança é imunodeprimida ou desnutrida grave. A tela mostra o que o Quadro 4 traz para a combinação e o soro antirrábico para o peso.',
    quandoUsar: [
      { texto: 'Na criança, o uso do soro antirrábico deve ser avaliado caso a caso, considerando o tipo de exposição.', ref: { fonte: 'MS, Nota Técnica Conjunta nº 35/2026 (raiva)', pagina: 'item 4.7.3' } },
    ],
  },
  'ped-sedacao-procedimento': {
    resumo: 'Reúne jejum, classificação ASA, sugestões de sedação por tipo de procedimento e os sedativos e reversores por peso da criança pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso, a última ingesta e as horas desde ela: a tela diz se o jejum foi cumprido e mostra as doses do capítulo e do Apêndice para o peso.',
    quandoUsar: [
      { texto: 'ASA III ou mais tem maior risco de eventos adversos; procedimentos eletivos devem ser postergados.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 78', pagina: 'Tabela 1, p. 845' } },
    ],
  },
  'ped-vias-aereas-superiores': {
    resumo: 'Calcula por peso os antibióticos da otite média aguda, da faringite estreptocócica e da sinusite bacteriana e o corticoide do crupe, e mostra a gravidade do crupe pela Tabela 6 do livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso e escolha o quadro. No crupe, a tela mostra a tabela de gravidade, que não tem pontuação, e calcula a cânula reduzida a partir do DI calculado para a idade.',
    quandoUsar: [
      { texto: 'OMA pela AAP: abaulamento moderado ou grave da membrana timpânica, otorreia recente não atribuível a otite externa, ou abaulamento leve com otalgia de início recente (menos de 48 h) ou hiperemia importante da membrana.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 28', pagina: 'p. 286' } },
      { texto: 'Sinusite bacteriana pela AAP: sintomas persistentes por mais de 10 dias sem melhora, piora depois de melhora inicial, ou sintomas graves com 3 dias ou mais seguidos de temperatura de 39 °C ou mais e secreção purulenta.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 28', pagina: 'p. 291–292' } },
    ],
  },
  'ped-bronquiolite': {
    resumo: 'Lista as indicações de internação da bronquiolite, calcula o fluxo da cânula nasal de alto fluxo pelo peso e confere a elegibilidade ao nirsevimabe pelo Ministério da Saúde, com o livro do ICr-HCFMUSP e a diretriz australasiana de 2025.',
    instrucoes: 'Informe idade e peso, a frequência respiratória e marque os achados presentes. Para o nirsevimabe, informe a idade gestacional ao nascer, as comorbidades e se é período sazonal.',
    quandoUsar: [
      { texto: 'Bronquiolite: sibilância em criança com menos de 2 anos, com sinais de infecção viral e sem atopia; alguns autores limitam ao primeiro episódio em menores de 1 ano.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 29', pagina: 'p. 300–301' } },
      { texto: 'Nirsevimabe pelo MS: prematuro com idade gestacional até 36 semanas e 6 dias, o ano todo; criança com menos de 24 meses e comorbidade da lista, só no período sazonal (fevereiro a agosto).', ref: { fonte: 'MS, NT 109/2025 e Guia de estratégia contra o VSR 2026', pagina: 'NT 109/2025, item 3 (p. 1); Guia VSR 2026 via SMS-SP, p. 3–6, 10 e 13–14' } },
    ],
  },
  'ped-insuficiencia-cardiaca': {
    resumo: 'Calcula por peso diuréticos, iECA, betabloqueadores, digoxina e levosimendana da insuficiência cardíaca na criança e o índice cardiotorácico, com as classificações de Ross e ISHLT do livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso para as doses. Para o índice cardiotorácico, informe as medidas A, B e C da radiografia.',
    quandoUsar: [
      { texto: 'Disfunção sistólica do VE na criança: fração de encurtamento abaixo de 25% e/ou fração de ejeção abaixo de 55%.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 22', pagina: 'p. 237' } },
      { texto: 'Índice cardiotorácico acima de 0,55 na criança e de 0,6 no neonato sugere cardiomegalia.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 22', pagina: 'Figura 3, p. 237' } },
    ],
  },
  'ped-crise-hipertensiva': {
    resumo: 'Classifica a pressão arterial da criança pela Tabela 1 do livro do ICr-HCFMUSP, com os percentis da AAP 2017, mostra a meta de redução da PAM na emergência e calcula as drogas da crise hipertensiva por peso.',
    instrucoes: 'Informe idade, peso e a PA sistólica e diastólica; de 1 a menos de 13 anos, informe também sexo e estatura (ou os percentis lidos na tabela). Para a meta, informe a PAM medida.',
    quandoUsar: [
      { texto: 'Urgência hipertensiva é a elevação aguda sintomática sem lesão de órgão-alvo; emergência, com lesão de órgão-alvo ou ameaça à vida.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 26', pagina: 'p. 272' } },
      { texto: 'PA sistólica mais de 30 mmHg acima do p95 deve preocupar para lesão de órgão-alvo.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 26', pagina: 'p. 272' } },
    ],
  },
  'ped-meningite': {
    resumo: 'Corrige o liquor no acidente de punção, aplica o Bacterial Meningitis Score e calcula por peso os antibióticos empíricos, o aciclovir, a dexametasona e a quimioprofilaxia da meningite na criança pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe as contagens do liquor e do sangue para a correção, marque os critérios do BMS presentes e informe idade e peso para as doses.',
    quandoUsar: [
      { texto: 'O Bacterial Meningitis Score vale na criança com pleocitose: muito baixo risco só se todos os critérios estiverem ausentes; com qualquer critério presente, tratar como bacteriana até as culturas.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 40', pagina: 'p. 410' } },
      { texto: 'Quimioprofilaxia do meningococo no contato íntimo: mesmo domicílio, quarto ou secreções nos 7 dias anteriores, escola ou creche nos 7 dias, intubação sem paramentação ou voo de mais de 8 h ao lado.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 40', pagina: 'p. 412' } },
    ],
  },
  'ped-infeccao-urinaria': {
    resumo: 'Diz quem testar e lê a urinálise e a urocultura da criança pela AAP 2026 de 8 dias a 5 anos (pelo livro do ICr-HCFMUSP fora dessa faixa) e calcula por peso os antibióticos orais e parenterais do livro.',
    instrucoes: 'Escolha a faixa de idade, os achados da urinálise, a forma de coleta e a contagem da urocultura. Informe idade e peso para as doses.',
    quandoUsar: [
      { texto: 'Testar a urina de 2 a 24 meses com febre de 39 °C ou mais, bom estado geral e sem foco aparente, pesando os fatores de risco da Figura 2.', ref: { fonte: 'AAP 2026, ITU de 8 dias a 5 anos (Alverson et al., Pediatrics 2026)', pagina: 'Figura 2, p. 28' } },
      { texto: 'De 8 dias a 5 anos, a ITU pela AAP 2026 pede urocultura por sonda ou punção com 10.000 UFC/mL ou mais de um uropatógeno (jato médio, 100.000 ou mais, só a partir de 2 meses), sempre com piúria.', ref: { fonte: 'AAP 2026, ITU de 8 dias a 5 anos (Alverson et al., Pediatrics 2026)', pagina: 'Tabela 1, p. 5' } },
    ],
  },
  'ped-pneumonia': {
    resumo: 'Calcula por faixa etária e peso o antibiótico empírico domiciliar e hospitalar da pneumonia comunitária na criança, com situações especiais, sinais de gravidade e leitura do líquido pleural pelo livro do ICr-HCFMUSP, e a PAC complicada pela SBP 2024.',
    instrucoes: 'Informe idade e peso e escolha o regime, domiciliar ou hospitalar. No derrame, informe pH, glicose e DHL do líquido pleural.',
    quandoUsar: [
      { texto: 'Internar com toxemia ou sepse, hipoxemia, insuficiência respiratória, intolerância à via oral, fatores sociais, idade abaixo de 2 meses, doença de base ou complicações; os critérios variam entre instituições.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 30', pagina: 'p. 312' } },
    ],
  },
  'ped-hemoterapia': {
    resumo: 'Calcula por peso os volumes de concentrado de hemácias, plasma, plaquetas, fatores VIII e IX, crioprecipitado, albumina e cálcio na transfusão maciça da criança pelo livro do ICr-HCFMUSP, com os limiares pediátricos da AABB ao lado.',
    instrucoes: 'Informe idade e peso; para plaquetas e cálcio, informe também a volemia, que a tela não estima. O aumento desejado de Hb, plaquetas, fator e albumina é opcional.',
    quandoUsar: [
      { texto: 'Na anemia aguda, Hb entre 6 e 7 g/dL é tolerada; a reposição de hemácias na criança começa com perda aguda de 15 a 20% ou mais e se baseia mais nos sinais clínicos que na Hb.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 67', pagina: 'p. 724' } },
      { texto: 'Criança crítica ou em risco, estável, sem hemoglobinopatia transfusão-dependente, cardiopatia cianótica ou hipoxemia grave: transfundir hemácias com Hb abaixo de 7 g/dL.', ref: { fonte: 'AABB 2023 (Carson et al., JAMA 2023)', pagina: 'rec. 3, p. 1897', grau: 'forte, evidência moderada' } },
    ],
  },
  'ped-falciforme': {
    resumo: 'Gradua a crise álgica pela intensidade da dor e calcula a analgesia por peso, com febre, sequestro esplênico, AVC e síndrome torácica aguda da doença falciforme na criança, pelo livro do ICr-HCFMUSP e pelo PCDT do Ministério da Saúde de 2024.',
    instrucoes: 'Informe idade, peso e a nota da dor de 1 a 10. No sequestro esplênico, informe a Hb basal e a atual.',
    quandoUsar: [
      { texto: 'Crise álgica: dor leve de 1 a 3, moderada de 4 a 6 e intensa de 7 a 10; avaliar e medicar em até 1 h da chegada.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 63', pagina: 'Figura 1, p. 668' } },
      { texto: 'Sequestro esplênico: queda de Hb de 2 g/dL ou mais em relação ao basal, com baço aumentado.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 63', pagina: 'p. 670' } },
    ],
  },
  'ped-kawasaki': {
    resumo: 'Conta os critérios clássicos, aplica o algoritmo da AHA para a forma incompleta, classifica as coronárias pelo Z-score e calcula as doses da doença de Kawasaki por peso, pelo livro do ICr-HCFMUSP com a AHA 2024 ao lado.',
    instrucoes: 'Informe os dias de febre e marque as manifestações; na forma incompleta, informe PCR, VHS e as alterações laboratoriais. Informe o Z-score (e o diâmetro, se houver), a idade e o peso.',
    quandoUsar: [
      { texto: 'Forma clássica: febre alta por ao menos 5 dias com ao menos 4 das 5 manifestações.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 70', pagina: 'p. 747' } },
      { texto: 'Forma incompleta: febre de 5 dias ou mais com 2 ou 3 critérios, ou lactente com menos de 6 meses e febre de 7 dias ou mais sem explicação.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 70', pagina: 'Figura 1, p. 748' } },
    ],
  },
  'ped-dengue': {
    resumo: 'Classifica a dengue da criança nos grupos A a D pelos achados e calcula a hidratação por faixa de peso, as expansões dos grupos C e D, a albumina 5% e a prova do laço pelo livro do ICr-HCFMUSP, com o manual do Ministério da Saúde de 2024 ao lado.',
    instrucoes: 'Informe idade e peso, escolha a linha do Quadro 8 (criança ou adolescente) e marque os achados. No grupo B, informe hematócrito e plaquetas; para a prova do laço, a PA sistólica e a diastólica.',
    quandoUsar: [
      { texto: 'Caso suspeito na criança: quadro febril agudo de 2 a 7 dias, sem foco aparente, em quem vive ou veio de área com transmissão.', ref: { fonte: 'MS, Dengue: diagnóstico e manejo clínico, 6ª ed., 2024', pagina: 'p. 55' } },
      { texto: 'Suspeita sem sinais de alarme: febre de 2 a 7 dias com ao menos 2 entre cefaleia, dor retro-orbitária, mialgia, artralgia, exantema, vômitos ou náuseas, leucopenia e prova do laço positiva, em área de transmissão nos últimos 15 dias.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 44', pagina: 'Quadro 1, p. 445' } },
    ],
  },
  'ped-febre-sem-sinais': {
    resumo: 'Indica o fluxograma da febre sem sinais localizatórios pela idade, lê leucograma e PCR, aplica a AAP 2021 e a regra do PECARN no lactente de 8 a 60 dias e calcula os antibióticos por peso pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe a idade em dias (até 90) ou em meses, o leucograma e a PCR. De 8 a 60 dias, informe também temperatura, procalcitonina e o exame de urina; marque os fatores para a coleta de urina e informe o peso para as doses.',
    quandoUsar: [
      { texto: 'Febre sem sinais localizatórios: febre retal de 38 °C ou mais há menos de 7 dias, em criança em bom estado geral, sem causa na história e no exame.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 45', pagina: 'p. 461' } },
      { texto: 'Pela AAP, lactente em bom estado geral, de 8 a 60 dias, nascido de 37 a menos de 42 semanas, com temperatura retal de 38,0 °C ou mais nas últimas 24 h; prematuros e bronquiolite clínica ficam de fora.', ref: { fonte: 'AAP 2021, lactente febril de 8 a 60 dias (Pantell et al., Pediatrics 2021)', pagina: 'Elegibilidade e exclusões' } },
    ],
    porQueUsar: [
      { texto: 'A regra do PECARN foi derivada em 908 lactentes febris de até 60 dias e validada em 913; infecção bacteriana grave ocorreu em 9,3%.', ref: { fonte: 'Kuppermann et al., JAMA Pediatr 2019 (PECARN)', pagina: 'resumo' } },
      { texto: 'Na validação, sensibilidade de 97,7%, especificidade de 60,0% e valor preditivo negativo de 99,6%, sem meningite bacteriana perdida; os autores pedem nova validação antes do uso clínico.', ref: { fonte: 'Kuppermann et al., JAMA Pediatr 2019 (PECARN)', pagina: 'resumo' } },
    ],
  },
  'ped-insuficiencia-adrenal': {
    resumo: 'Calcula a hidrocortisona da crise adrenal pela superfície corpórea, a expansão com SF e a fludrocortisona na criança pelo livro do ICr-HCFMUSP, com a alternativa por peso do Apêndice ao lado.',
    instrucoes: 'Informe idade, peso e a superfície corpórea, que a tela não calcula. Para a fludrocortisona, informe a hidrocortisona EV das 24 h.',
    quandoUsar: [
      { texto: 'Crise adrenal: deterioração aguda com hipotensão absoluta ou relativa que melhora com glicocorticoide parenteral; sem melhora da hipotensão em 1 h, pensar em outra causa.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 53', pagina: 'p. 527' } },
      { texto: 'Suspeitar na insuficiência adrenal conhecida, na interrupção abrupta de corticoterapia prolongada ou no choque refratário às medidas habituais.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 53', pagina: 'p. 528–529' } },
    ],
  },
  'ped-injuria-renal': {
    resumo: 'Estadia a injúria renal aguda da criança pelo KDIGO pediátrico, estima a TFG por Schwartz e calcula FeNa, ureia/creatinina, sobrecarga hídrica e as doses da Tabela 8 pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe estatura, creatinina atual (e a basal, se conhecida) e o método do laboratório, e a diurese em mL/kg/h com o número de horas. Índices urinários, balanço e eletrólitos são opcionais; o peso libera as doses.',
    quandoUsar: [
      { texto: 'Estágio 1 do KDIGO pediátrico: aumento da creatinina de 0,3 mg/dL ou mais em menos de 48 h, ou de 1,5 a 1,9 vez a basal em 7 dias, ou diurese abaixo de 0,5 mL/kg/h por 6 a 12 h.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 56', pagina: 'Tabela 1, p. 576' } },
      { texto: 'Sem creatinina basal conhecida, usar a que corresponde a TFG de 120 mL/min/1,73 m² pela Schwartz.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 56', pagina: 'p. 575' } },
    ],
  },
  'ped-tfg-schwartz': {
    resumo: 'Estima a taxa de filtração glomerular da criança pela fórmula de Schwartz, com a constante do método de dosagem da creatinina, como o livro do ICr-HCFMUSP traz.',
    instrucoes: 'Informe estatura, creatinina sérica e o método da creatinina no laboratório (enzimático ou Jaffé, pela idade e sexo). A conta é estatura × k ÷ creatinina.',
  },
  'ped-glomerulopatias-shu': {
    resumo: 'Reúne as definições da síndrome nefrótica, a hipotensão postural, albumina 20% e diuréticos, a restrição hídrica da GNPE, os pulsos de metilprednisolona e os limiares da SHU na criança pelo livro do ICr-HCFMUSP, com KDIGO 2025 e IPNA 2023 ao lado.',
    instrucoes: 'Informe idade, peso e, se houver, a superfície corpórea. Conforme o quadro, informe a Pr/Cr, a albumina e a proteinúria de 24 h, a PA deitado e sentado ou a Hb e o Ht.',
    quandoUsar: [
      { texto: 'Proteinúria nefrótica: relação proteína/creatinina de 200 mg/mmol (2 g/g) ou mais em amostra isolada, ou 1.000 mg/m²/dia ou mais; síndrome nefrótica é a proteinúria nefrótica com hipoalbuminemia ou edema.', ref: { fonte: 'KDIGO 2025, síndrome nefrótica na criança', pagina: 'Practice Point 1.1.1, p. S255' } },
      { texto: 'SHU: tríade de anemia hemolítica microangiopática, trombocitopenia e lesão renal aguda.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 60', pagina: 'Tabela 2, p. 633' } },
    ],
  },
  'ped-hda-hepatica': {
    resumo: 'Calcula por peso octreotida, somatostatina e omeprazol da hemorragia digestiva e aplica o critério de coagulação do PALF, a dose tóxica de paracetamol, a amônia, a glicose e a oferta hídrica da insuficiência hepática aguda na criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso para as doses. Na IHA, informe INR ou TP e se há encefalopatia; o paracetamol ingerido, a amônia e a necessidade hídrica basal são opcionais.',
    quandoUsar: [
      { texto: 'IHA pelo PALF: sem hepatopatia crônica conhecida, com lesão hepática bioquímica e coagulopatia que não corrige com vitamina K, e INR acima de 1,5 ou TP de 15 s ou mais com encefalopatia, ou INR acima de 2 ou TP de 20 s ou mais sem encefalopatia.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 36', pagina: 'p. 357' } },
    ],
  },
  'ped-coma-hic': {
    resumo: 'Calcula o GCS-Pupilas, a pressão de perfusão cerebral com a meta por idade e o corte da bainha do nervo óptico, e as doses de glicose, midazolam e dexametasona do coma e da hipertensão intracraniana na criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe o Glasgow e quantas pupilas não reagem à luz; para a PPC, a PAM e a PIC. Para a bainha, a idade, o diâmetro medido e se a fontanela está aberta; o peso libera as doses.',
    quandoUsar: [
      { texto: 'PIC normal na criança: 9 a 21 mmHg (12 a 28 cmH2O).', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 41', pagina: 'p. 415' } },
      { texto: 'Via aérea avançada com Glasgow abaixo de 8 se o tratamento etiológico não for imediato, ou na suspeita de HIC.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 37', pagina: 'p. 374' } },
    ],
  },
  'ped-hemostasia-trombose': {
    resumo: 'Calcula por peso a reposição de fator na hemofilia, DDAVP, antifibrinolítico, von Willebrand, PTI, heparina com nomograma do TTPa, enoxaparina, varfarina e rt-PA na criança, pelo livro do ICr-HCFMUSP, com a ASH/ISTH 2025 ao lado.',
    instrucoes: 'Informe idade e peso, o fator e o tipo de hemorragia (ou o Δ de fator desejado). Para ajustar a anticoagulação, informe o TTPa ou o INR e a fase da varfarina.',
    quandoUsar: [
      { texto: 'Hemofilia pela atividade de fator: leve de 5 a 40%, moderada de 1 a 5% e grave abaixo de 1%.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 64', pagina: 'p. 678' } },
      { texto: 'PTI: plaquetas abaixo de 100.000 isoladas; tratar a recém-diagnosticada com menos de 20.000 e sangramento ativo.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 64', pagina: 'p. 682–684' } },
    ],
  },
  'ped-emergencias-oncologicas': {
    resumo: 'Reúne lise tumoral pelos critérios de Cairo e Bishop com hidratação por m², hemocomponentes, hiperviscosidade, neutropenia febril e síndromes compressivas da criança com câncer, pelo livro do ICr-HCFMUSP, com a diretriz pediátrica IPFNG 2023 ao lado.',
    instrucoes: 'Informe idade, peso e superfície corpórea. Na lise tumoral, informe ácido úrico, potássio, fósforo e cálcio; na hiperviscosidade e na neutropenia, leucócitos e neutrófilos; marque os critérios de alto risco.',
    quandoUsar: [
      { texto: 'Neutropenia: neutrófilos até 500/mm³, ou até 1.000 com queda prevista para 500 ou menos em 24 a 48 h; profunda abaixo de 100.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 66', pagina: 'p. 708' } },
      { texto: 'Febre no neutropênico: axilar de 38,5 °C ou mais, ou de 38 °C ou mais sustentada por 1 h.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 66', pagina: 'p. 709' } },
    ],
  },
  'ped-choque-toxico-partes-moles': {
    resumo: 'Aplica os critérios do CDC para síndrome do choque tóxico estafilocócica e estreptocócica e calcula por peso os antibióticos e a imunoglobulina do choque tóxico e os antibióticos das infecções de pele e partes moles na criança, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Marque os critérios clínicos, os sistemas acometidos e o critério laboratorial; na forma estreptocócica, a hipotensão, os órgãos e o sítio de isolamento. Informe idade e peso para as doses.',
    quandoUsar: [
      { texto: 'SCT estafilocócica: caso provável com critério laboratorial e 4 dos 5 critérios clínicos; confirmado com os 5, incluindo a descamação.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 46', pagina: 'Tabela 2, p. 473–474' } },
      { texto: 'SCT estreptocócica: hipotensão com 2 ou mais órgãos acometidos; provável com isolamento de sítio não estéril e confirmado com isolamento de sítio estéril.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 46', pagina: 'Tabela 3, p. 473–474' } },
    ],
  },
  'ped-febre-imunodeprimido': {
    resumo: 'Calcula por peso a terapia antimicrobiana empírica do imunodeprimido não oncológico, confere a dose imunossupressora de corticoide e mostra padrões por tipo de imunodeficiência e profilaxias, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso para as doses. Para o corticoide, informe a dose em mg/kg/dia de prednisona e há quantos dias está em uso.',
  },
  'ped-artrite-osteomielite': {
    resumo: 'Calcula por peso o antibiótico da artrite séptica e da osteomielite pela resistência local, mostra a cobertura por faixa etária, classifica a osteomielite pelo tempo e lê o líquido sinovial, pelo livro do ICr-HCFMUSP.',
    instrucoes: 'Informe idade e peso e escolha o cenário de resistência local. Para a classificação, os dias de sintomas; para o líquido sinovial, os leucócitos, o predomínio de PMN e o Gram.',
    quandoUsar: [
      { texto: 'Osteomielite aguda até 2 semanas; subaguda de 2 semanas a 3 meses; crônica depois disso.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 49', pagina: 'p. 494' } },
      { texto: 'Gram positivo, mais de 50.000 leucócitos/mm³ e predomínio de polimorfonucleares no líquido sinovial sugerem artrite séptica.', ref: { fonte: 'PS Pediatria ICr-HCFMUSP, 4ª ed., 2023, cap. 49', pagina: 'p. 496' } },
    ],
  },
  'adulto-pesi': {
    resumo: 'Estima a gravidade do TEP agudo confirmado no adulto pelo Pulmonary Embolism Severity Index, em cinco classes, com a conduta por classe do manual do HC.',
    instrucoes: 'Informe a idade em anos e o sexo e marque cada variável presente; o total é a idade mais os pontos. Classes I e II (até 85 pontos) são de baixo risco pelo livro.',
    quandoUsar: [
      { texto: 'No paciente com TEP confirmado.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 32', pagina: 'Tabela 10, p. 445–446' } },
      { texto: 'Nas categorias A e B, Hestia, PESI ou sPESI acham o baixo risco; nelas, tratar em casa é opção razoável, com anticoagulante na mão e seguimento garantido.', ref: { fonte: 'AHA/ACC 2026, TEP agudo no adulto', pagina: 'seções 3.2.1 e 4.1.1; Figura 2', grau: '1, B-R; 2a, B-R' } },
    ],
  },
  'adulto-nihss': {
    resumo: 'Pontua o déficit neurológico do AVC pela National Institutes of Health Stroke Scale como a Tabela 2 do manual do HC traz, com os cortes que o capítulo usa em cada decisão.',
    instrucoes: 'Escolha a resposta de cada item, de 1A a 11, com os membros separados por lado; o total vai de 0 a 42. Itens não testáveis entram com 0.',
    quandoUsar: [
      { texto: 'Entre 3 e 4,5 h do início, a trombólise exige NIHSS de 25 ou menos; NIHSS de 6 ou mais é critério clínico de angio-TC e trombectomia até 16 h.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 38', pagina: 'p. 520–521' } },
      { texto: 'Oclusão proximal de circulação anterior (ACI ou M1) com NIHSS de 6 ou mais, Rankin prévio de 0 a 1 e ASPECTS de 3 a 10, em até 6 h: trombectomia recomendada.', ref: { fonte: 'AHA/ASA 2026, AVC isquêmico agudo', pagina: 'p. 5 e 53', grau: 'COR 1' } },
    ],
  },
  'adulto-timi-nstemi': {
    resumo: 'Estratifica o risco na síndrome coronariana aguda sem supra de ST com os sete fatores do TIMI da Tabela 4 do manual do HC.',
    instrucoes: 'Marque cada fator presente; cada um vale 1 ponto, de 0 a 7. Baixo risco é 0 ou 1 ponto.',
    quandoUsar: [
      { texto: 'Com TIMI de 0 ou 1 e baixo risco na curva de troponina, descartar SCA é razoável quando ela é a única suspeita.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 13', pagina: 'p. 205' } },
      { texto: 'TIMI de 2 ou mais está entre os critérios de estratégia invasiva (72 h); 0 ou 1, entre os de estratégia conservadora.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 13', pagina: 'Tabela 2, p. 210' } },
    ],
  },
  'adulto-sincope-san-francisco': {
    resumo: 'Identifica o adulto com síncope em risco de evento grave pelos cinco fatores da regra de San Francisco, como o manual do HC traz.',
    instrucoes: 'Marque cada fator presente: insuficiência cardíaca, ECG anormal, hematócrito abaixo de 30%, dispneia e PAS abaixo de 90 mmHg. Basta 1 fator para o paciente ser de risco.',
    quandoUsar: [
      { texto: 'O consenso europeu de síncope no pronto-socorro estratifica pelas categorias de risco da ESC 2018 e não usa escores como San Francisco.', ref: { fonte: 'EUSEM 2024, síncope no pronto-socorro (Möckel et al., Eur J Emerg Med 2024)', grau: 'consenso de processo, sem graduação' } },
    ],
    porQueUsar: [
      { texto: 'Pelo manual, sensibilidade de 98% e especificidade de 56% para eventos graves em 7 dias, em 1.418 pacientes.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 16', pagina: 'p. 237–238' } },
    ],
  },
  'adulto-duke-modificado': {
    resumo: 'Classifica a endocardite infecciosa como definida, possível ou que não preenche pelos critérios de Duke-ISCVID 2023, com o Duke modificado do manual do HC como referência.',
    instrucoes: 'Marque o critério patológico e os critérios maiores e menores presentes. Definida: critério patológico, 2 maiores, 1 maior e 3 menores, ou 5 menores; possível: 1 maior e 1 menor, ou 3 menores.',
    porQueUsar: [
      { texto: 'O Duke-ISCVID 2023 atualiza os critérios de 1994, modificados em 2000: entram novos métodos microbiológicos, PET-CT com 18F-FDG, TC cardíaca e a inspeção na cirurgia como critério maior, e saem as exigências de tempo e de punções separadas nas hemoculturas.', ref: { fonte: 'Fowler et al., Clin Infect Dis 2023 (Duke-ISCVID)', pagina: 'resumo' } },
    ],
  },
  'adulto-profilaxia-ulcera-estresse': {
    resumo: 'Mostra o que o manual do HC traz para profilaxia de úlcera de estresse e confere o critério de IBP na dupla antiagregação plaquetária, com o REVISE e a SCCM/ASHP 2024 ao lado.',
    instrucoes: 'Marque se o paciente usa dupla antiagregação e os critérios presentes: qualquer um da primeira lista ou dois da segunda. O uso de álcool aparece à parte, sem somar.',
    quandoUsar: [
      { texto: 'Considerar profilaxia de úlcera de estresse no paciente em ventilação mecânica por mais de 48 horas, com coagulopatia ou choque.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 7', pagina: 'p. 127' } },
      { texto: 'IBP no paciente em dupla antiagregação plaquetária com risco de sangramento digestivo.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 13', pagina: 'p. 208' } },
    ],
  },
  'hiperpotassemia': {
    resumo: 'No adulto, classifica a hiperpotassemia pelo nível, indica o cálcio pelo ECG e organiza a conduta em estabilizar, deslocar e remover; na criança, mostra os limiares e as doses por peso do livro do ICr-HCFMUSP.',
    instrucoes: 'Escolha adulto ou criança (ou use o paciente da Central) e informe o potássio sérico, o peso e o ECG. No adulto, informe a diurese e se há acidose; na criança, se é recém-nascido.',
    quandoUsar: [
      { texto: 'No adulto, hiperpotassemia leve de 5,0 a 5,4, moderada de 5,5 a 6,0 e grave acima de 6,0 mEq/L.', ref: { fonte: 'Geldermann et al., Emerg Med J 2026' } },
      { texto: 'No adulto, o cálcio é indicado com alteração no ECG ou potássio de 6,5 mEq/L ou mais.', ref: { fonte: 'Geldermann et al., Emerg Med J 2026' } },
    ],
  },
  'adulto-abstinencia-alcoolica': {
    resumo: 'Pontua a abstinência alcoólica pela CIWA-Ar, confere os critérios de Caine para encefalopatia de Wernicke e mostra as doses do manual do HC no adulto, com a BAP 2026 ao lado.',
    instrucoes: 'Responda aos 10 itens da CIWA-Ar e marque os critérios de Caine presentes. As doses diárias do esquema citado aparecem calculadas.',
    quandoUsar: [
      { texto: 'Usar escala validada para identificar o risco de abstinência grave ou complicada e para monitorar os sintomas; quem tem alto risco de complicação fica internado.', ref: { fonte: 'BAP 2026 (Sinclair et al., J Psychopharmacol 2026)', grau: 'Level D' } },
      { texto: 'Encefalopatia de Wernicke pelos critérios de Caine: o manual exige dois critérios para o diagnóstico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 78', pagina: 'Tabela 4, p. 1032' } },
    ],
  },
  'dengue-classificacao': {
    resumo: 'Classifica a dengue nos grupos A a D pelo manual do Ministério da Saúde de 2024 e, no adulto, calcula a hidratação por peso, o grupo D com hemocomponentes, os eletrólitos e a conduta em hipertensos, cardiopatas, gestantes e em uso de antitrombóticos.',
    instrucoes: 'Escolha adulto ou criança, informe o peso e marque sangramento de pele, condição especial, sinais de alarme e de gravidade. A classificação vale para a criança; os volumes dela ficam em Dengue — criança.',
    quandoUsar: [
      { texto: 'Caso suspeito: quem vive em área com dengue ou viajou nos últimos 14 dias para área com transmissão, com febre de 2 a 7 dias e duas ou mais entre náuseas, vômitos, exantema, mialgias, artralgias, cefaleia, dor retro-orbital, petéquias, prova do laço positiva e leucopenia.', ref: { fonte: 'MS, Dengue: diagnóstico e manejo clínico, 6ª ed., 2024', pagina: 'p. 55' } },
    ],
  },
  'adulto-vm-cinco-passos': {
    resumo: 'Guia a ventilação mecânica do adulto em cinco passos (quem, modo, ajustes, acompanhamento e desmame) e confere os valores do ventilador contra as tabelas do cap. 37 do manual do HC, sem escolher o ajuste.',
    instrucoes: 'Em cada passo, informe o que a tela pede: gasometria e quadro, modo, ajustes e o peso que quer usar, mecânica e gasometria de controle, e os parâmetros do desmame e do teste de respiração espontânea.',
    quandoUsar: [
      { texto: 'Hipoxemia com PO2 abaixo de 60 e esforço respiratório, sem melhora após oxigênio adequado (cateter nasal, máscara de Venturi, máscara não reinalante e VNI quando indicada).', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 498' } },
      { texto: 'Hipercapnia com PCO2 acima de 55 em quem não é retentor crônico, sobretudo com falência ventilatória ou carbonarcose.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 37', pagina: 'p. 498' } },
    ],
  },
  'adulto-vni-cinco-passos': {
    resumo: 'Guia a ventilação não invasiva do adulto em cinco passos (quem, interface, ajustes, acompanhamento e retirada) com o que o manual do HC traz, e só compara pressões na DPOC, único quadro em que o livro dá valores.',
    instrucoes: 'No primeiro passo, escolha o quadro, informe FR, gasometria e FiO2 e marque as contraindicações; depois, a interface, o modo e as pressões, e os dados de acompanhamento.',
    quandoUsar: [
      { texto: 'Maior evidência de benefício na exacerbação de DPOC com acidose respiratória (PaCO2 acima de 45 mmHg ou pH abaixo de 7,3) e no edema pulmonar cardiogênico.', ref: { fonte: 'Manual de Medicina de Emergência do HCFMUSP, cap. 27', pagina: 'p. 383' } },
      { texto: 'Na IRpA hipercápnica, a ATS 2026 faz recomendação forte de VNI para reduzir mortalidade e intubação.', ref: { fonte: 'ATS 2026, suporte respiratório não invasivo (Goel et al., Am J Respir Crit Care Med 2026)', grau: 'forte' } },
    ],
  },
  // PRAM (16/11/2026): resumo do Ducharme 2008 no PubMed (PMID 18346499).
  'ped-pram': {
    resumo: 'Mede a gravidade da crise de asma na criança pelo exame à beira do leito, na triagem e depois do broncodilatador.',
    instrucoes: 'Pontue os cinco itens do exame (0 a 12 pontos): leve de 0 a 3, moderada de 4 a 7 e grave de 8 a 12.',
    quandoUsar: [
      { texto: 'Crise aguda de asma na criança, na triagem, depois do broncodilatador inicial e na decisão de destino.', ref: { fonte: 'Ducharme et al., J Pediatr 2008', pagina: 'resumo' } },
    ],
    porQueUsar: [
      { texto: 'Em 782 crianças de 2 a 17 anos, o PRAM na triagem e depois do broncodilatador se associou à internação (r = 0,4 e 0,5), mostrou boa resposta ao tratamento (0,7) e boa concordância entre examinadores (r = 0,78) em todas as idades.', ref: { fonte: 'Ducharme et al., J Pediatr 2008', pagina: 'resumo' } },
    ],
  },
}

export function topoDa(fichaId: string): Topo | undefined {
  return TOPOS[fichaId]
}
