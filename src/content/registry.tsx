import { lazy, type ComponentType } from 'react'
import { Baby, Siren,
  Calculator,
  ClipboardList,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import { chaveFerramenta } from '@/lib/useFavoritos'

/**
 * Carrega um export nomeado sob demanda (code-splitting por ferramenta).
 * O `ToolRouter` já envolve a renderização em <Suspense>.
 */
function sobDemanda(
  importar: () => Promise<Record<string, unknown>>,
  nome: string
): ComponentType {
  return lazy(async () => ({ default: (await importar())[nome] as ComponentType }))
}

export type ToolDef = {
  slug: string
  label: string
  description: string
  component: ComponentType
  tags?: string[]
}

export type SectionDef = {
  slug: string
  label: string
  description: string
  icon: LucideIcon
  tools: ToolDef[]
}

const t = (
  slug: string,
  label: string,
  description: string,
  component: ComponentType,
  tags?: string[]
): ToolDef => ({ slug, label, description, component, tags })

export const SECOES: SectionDef[] = [
  {
    slug: 'calculadoras',
    label: 'Calculadoras',
    description: 'Cálculos de doses, diluições e decisões para o plantão.',
    icon: Calculator,
    tools: [
      t('iot', 'Intubação Orotraqueal (sequência rápida)', 'Indução, analgesia e bloqueio por peso (padrão HC).', sobDemanda(() => import('@/pages/plantonista/calculadoras/IsrAdulto'), 'IsrAdulto'), ['intubação', 'sequência rápida', 'sedação', 'anestesia', 'succinilcolina', 'propofol', 'IOT']),
      t('drogas-vasoativas', 'Drogas Vasoativas', 'Preparo padrão HC, mL/h pela dose e dose pela bomba.', sobDemanda(() => import('@/pages/plantonista/calculadoras/InfusoesAdulto'), 'DrogasVasoativas'), ['noradrenalina', 'vasopressor', 'infusão', 'diluição', 'dopamina', 'adrenalina', 'DVA']),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Início e ajuste da infusão de insulina.', sobDemanda(() => import('@/pages/plantonista/calculadoras/ControleGlicemico'), 'ControleGlicemico'), ['insulina', 'glicemia', 'diabetes', 'hiperglicemia']),
      t('sedacao-continua', 'Sedação Contínua', 'Propofol, midazolam, dexmedetomidina, quetamina e fentanil.', sobDemanda(() => import('@/pages/plantonista/calculadoras/InfusoesAdulto'), 'SedacaoContinua'), ['fentanil', 'midazolam', 'propofol', 'dexmedetomidina', 'cetamina', 'analgesia']),
      t('bloqueio-neuromuscular', 'Bloqueio Neuromuscular Contínuo', 'Rocurônio e cisatracúrio (padrão HC).', sobDemanda(() => import('@/pages/plantonista/calculadoras/InfusoesAdulto'), 'BloqueioNeuromuscular'), ['atracúrio', 'rocurônio', 'curarizante', 'paralisia']),
      t('heparinizacao-venosa', 'Heparina não fracionada EV', '80 UI/kg + 18 UI/kg/h e ajuste pelo TTPa (manual HC).', sobDemanda(() => import('@/pages/plantonista/manual/HeparinaNaoFracionadaAdulto'), 'HeparinaNaoFracionadaAdulto'), ['heparina', 'TTPa', 'anticoagulação', 'TVP', 'TEP']),
      t('hiponatremia', 'Hiponatremia', 'NaCl 3%: preparo, bolus e limites de correção (manual HC).', sobDemanda(() => import('@/pages/plantonista/manual/HiponatremiaManual'), 'HiponatremiaManual'), ['sódio', 'NaCl 3%', 'hiponatremia', 'eletrólitos']),
      t('hipernatremia', 'Hipernatremia', 'Água livre e Adrogué-Madias (manual HC).', sobDemanda(() => import('@/pages/plantonista/manual/HipernatremiaManual'), 'HipernatremiaManual'), ['sódio', 'água livre', 'hipernatremia', 'eletrólitos']),
      t('hidantalizacao', 'Estado de mal epiléptico', '1ª, 2ª e 3ª linha por peso (manual HC).', sobDemanda(() => import('@/pages/plantonista/manual/EstadoDeMalAdulto'), 'EstadoDeMalAdulto'), ['fenitoína', 'hidantal', 'crise convulsiva', 'epilepsia']),
      t('nefropatia-contraste', 'Prevenção de Nefropatia por Contraste', 'Cockcroft–Gault e nefroproteção.', sobDemanda(() => import('@/pages/plantonista/calculadoras/NefropatiaContraste'), 'NefropatiaContraste'), ['contraste', 'rim', 'creatinina', 'TFG', 'nefroproteção']),
      t('profilaxia-tev', 'Profilaxia TEV', 'Pádua, Caprini, ortopédico e obstétrico.', sobDemanda(() => import('@/pages/plantonista/calculadoras/ProfilaxiaTEV'), 'ProfilaxiaTEV'), ['trombose', 'TEV', 'enoxaparina', 'Caprini', 'Pádua', 'TVP']),
      t('acesso-venoso', 'Escolha de Acesso Venoso', 'Recomendação de dispositivo por perfil e terapia.', sobDemanda(() => import('@/pages/plantonista/calculadoras/AcessoVenoso'), 'AcessoVenoso'), ['PICC', 'CVC', 'cateter', 'acesso venoso', 'periférico', 'central']),
      t('heparinizacao-ajuste', 'Heparina — ajuste pelo TTPa', 'Nomograma da Tabela 7 do manual HC.', sobDemanda(() => import('@/pages/plantonista/manual/HeparinaNaoFracionadaAdulto'), 'HeparinaNaoFracionadaAdulto'), ['heparina', 'TTPa', 'ajuste', 'anticoagulação']),
    ],
  },
  {
    slug: 'pediatria',
    label: 'Pediatria',
    description: 'PS Pediatria ICr-HCFMUSP: doses, infusões, RCP, via aérea, hidratação e escores (até antes dos 14 anos; sem neonato).',
    icon: Baby,
    tools: [
      t('bolus', 'Doses por peso', 'Apêndice do PS Pediatria ICr: emergência, RCP, sedação e antídotos.', sobDemanda(() => import('@/pages/plantonista/pediatria/BolusPediatrico'), 'BolusPediatrico'), ['pediatria', 'criança', 'dose', 'peso', 'emergência', 'antídoto']),
      t('infusoes', 'Infusões contínuas', 'Faixa de dose do livro e mL/h pela concentração do seu preparo.', sobDemanda(() => import('@/pages/plantonista/pediatria/InfusoesPediatricas'), 'InfusoesPediatricas'), ['pediatria', 'infusão', 'vasoativo', 'sedação', 'mL/h']),
      t('rcp-pediatrica', 'RCP pediátrica', 'Compressão/ventilação por faixa, cargas de desfibrilação e cardioversão por peso, drogas da PCR, bradicardia e TSV.', sobDemanda(() => import('@/pages/plantonista/pediatria/RcpPediatrica'), 'RcpPediatrica'), ['pediatria', 'RCP', 'PCR', 'parada', 'desfibrilação', 'cardioversão', 'joules', 'epinefrina']),
      t('via-aerea', 'Via aérea pediátrica', 'Tubo com e sem cuff, profundidade, equipamento por idade e doses da SRI.', sobDemanda(() => import('@/pages/plantonista/pediatria/ViaAereaPediatrica'), 'ViaAereaPediatrica'), ['pediatria', 'tubo', 'cuff', 'intubação', 'via aérea', 'SRI', 'laringoscópio', 'lâmina']),
      t('anafilaxia-pediatrica', 'Anafilaxia — criança', 'Epinefrina IM por peso ou dose fixa por idade, 2ª/3ª linha e refratária.', sobDemanda(() => import('@/pages/plantonista/pediatria/AnafilaxiaPediatrica'), 'AnafilaxiaPediatrica'), ['pediatria', 'anafilaxia', 'alergia', 'epinefrina', 'adrenalina', 'difenidramina', 'glucagon', 'fenoterol']),
      t('asma-pediatrica', 'Crise asmática — criança', 'Corticoide, ipratrópio, magnésio e salbutamol contínuo por peso; classificação da crise como referência.', sobDemanda(() => import('@/pages/plantonista/pediatria/AsmaPediatrica'), 'AsmaPediatrica'), ['pediatria', 'asma', 'crise asmática', 'broncoespasmo', 'salbutamol', 'ipratrópio', 'sulfato de magnésio', 'prednisolona']),
      t('crise-epileptica-pediatrica', 'Crise epiléptica — criança', 'Benzodiazepínicos, ataque, fenobarbital e EME refratário por peso, com tempo de infusão.', sobDemanda(() => import('@/pages/plantonista/pediatria/CriseEpilepticaPediatrica'), 'CriseEpilepticaPediatrica'), ['pediatria', 'convulsão', 'crise epiléptica', 'estado de mal', 'diazepam', 'midazolam', 'fenitoína', 'fenobarbital']),
      t('sinais-vitais-pediatricos', 'Sinais vitais por idade', 'FC normal, valores anormais no choque, PA sistólica baixa e FR normal para a idade (só referência).', sobDemanda(() => import('@/pages/plantonista/pediatria/SinaisVitaisPediatricos'), 'SinaisVitaisPediatricos'), ['pediatria', 'sinais vitais', 'frequência cardíaca', 'frequência respiratória', 'pressão arterial', 'hipotensão']),
      t('choque-pediatrico', 'Choque séptico — criança', 'Expansão volêmica em mL/kg, vasoativas em µg/min e metas da primeira hora.', sobDemanda(() => import('@/pages/plantonista/pediatria/ChoquePediatrico'), 'ChoquePediatrico'), ['pediatria', 'choque', 'sepse', 'choque séptico', 'expansão volêmica', 'bolus', 'epinefrina', 'dopamina']),
      t('tce-grave-pediatrico', 'TCE grave — criança', 'NaCl 3% e manitol por peso; metas de PaCO₂, PIC, PPC e osmolaridade.', sobDemanda(() => import('@/pages/plantonista/pediatria/TcePediatrico'), 'TcePediatrico'), ['pediatria', 'TCE', 'trauma craniano', 'hipertensão intracraniana', 'salina hipertônica', 'NaCl 3%', 'manitol']),
      t('pecarn-menor-2-anos', 'TCE leve — menores de 2 anos (PECARN)', 'Figura 2 do cap. 16.', sobDemanda(() => import('@/pages/plantonista/pediatria/EscoresPediatricosP2'), 'PecarnMenor2'), ['pediatria', 'TCE', 'PECARN', 'tomografia', 'lactente']),
      t('pecarn-2-anos-ou-mais', 'TCE leve — 2 anos ou mais (PECARN)', 'Figura 3 do cap. 16.', sobDemanda(() => import('@/pages/plantonista/pediatria/EscoresPediatricosP2'), 'PecarnMaior2'), ['pediatria', 'TCE', 'PECARN', 'tomografia']),
      t('glasgow-pediatrico', 'Escala de Coma de Glasgow — criança', 'Com a escala modificada (James) para menores de 5 anos.', sobDemanda(() => import('@/pages/plantonista/pediatria/EscoresPediatricosP2'), 'GlasgowPediatrico'), ['pediatria', 'Glasgow', 'coma', 'consciência', 'TCE']),
      t('pops', 'POPS', 'Escore de Observação de Prioridade Pediátrica (Tabela 4 do cap. 82).', sobDemanda(() => import('@/pages/plantonista/pediatria/EscoresPediatricosP2'), 'PopsPediatrico'), ['pediatria', 'triagem', 'POPS', 'escore de alerta']),
      t('pews', 'PEWS', 'Escore de Alerta Precoce Pediátrico (Figura 2 do cap. 82).', sobDemanda(() => import('@/pages/plantonista/pediatria/EscoresPediatricosP2'), 'PewsPediatrico'), ['pediatria', 'triagem', 'PEWS', 'escore de alerta', 'deterioração']),
      t('fluidoterapia-manutencao-ped', 'Fluidoterapia de manutenção — criança', 'Holliday-Segar, regra prática (teto 100 mL/h), soluções-padrão e categorias da Figura 1.', sobDemanda(() => import('@/pages/plantonista/pediatria/FluidoterapiaManutencaoPed'), 'FluidoterapiaManutencaoPed'), ['soro de manutenção', 'Holliday-Segar', '4-2-1', 'hidratação venosa', 'soro isotônico', 'SIHAD']),
      t('desidratacao-diarreia-ped', 'Diarreia aguda — desidratação e planos', 'Escala clínica, grau pelo peso perdido, planos A/B/C por peso e idade.', sobDemanda(() => import('@/pages/plantonista/pediatria/DesidratacaoDiarreiaPed'), 'DesidratacaoDiarreiaPed'), ['diarreia', 'gastroenterite', 'desidratação', 'SRO', 'plano A', 'plano B', 'plano C', 'reidratação']),
      t('sodio-ped', 'Hipo e hipernatremia — criança', 'Na corrigido, osmolalidade efetiva, NaCl 3% por peso, Tabela 3 por litro, déficit de água livre.', sobDemanda(() => import('@/pages/plantonista/pediatria/DisturbiosSodioPed'), 'DisturbiosSodioPed'), ['sódio', 'hiponatremia', 'hipernatremia', 'NaCl 3%', 'salina hipertônica', 'água livre', 'Adrogué-Madias']),
      t('eletrolitos-ped', 'Potássio, cálcio, magnésio e fósforo — criança', 'Reposições e hipercalemia por peso, máximos, FEMg.', sobDemanda(() => import('@/pages/plantonista/pediatria/EletrolitosPed'), 'EletrolitosPed'), ['potássio', 'hipocalemia', 'hipercalemia', 'cálcio', 'gluconato', 'magnésio', 'sulfato de magnésio', 'fósforo']),
      t('cad-ehh-ped', 'Cetoacidose diabética e EHH — criança', 'Critérios, gravidade, Quadro 6, fluidos, K, insulina EV/SC, bicarbonato, edema cerebral.', sobDemanda(() => import('@/pages/plantonista/pediatria/CadEhhPed'), 'CadEhhPed'), ['cetoacidose', 'CAD', 'EHH', 'diabetes', 'insulina', 'potássio', 'edema cerebral', 'manitol']),
      t('hipoglicemia-ped', 'Hipoglicemia — glicose e glucagon por peso', 'Glicose VO/EV por idade (texto e Tabela 2), glucagon, VIG → mL/h.', sobDemanda(() => import('@/pages/plantonista/pediatria/HipoglicemiaPed'), 'HipoglicemiaPed'), ['hipoglicemia', 'glicose', 'soro glicosado', 'glucagon', 'VIG', 'TIG']),
      t('acidobase-ped', 'Distúrbios acidobásicos — criança', 'Leitura em 3 etapas, compensação (Tabela 3), ânion-gap, ΔAG/ΔHCO3, bicarbonato 1,4%, HCl.', sobDemanda(() => import('@/pages/plantonista/pediatria/AcidoBasePed'), 'AcidoBasePed'), ['gasometria', 'acidose', 'alcalose', 'ânion-gap', 'compensação', 'bicarbonato', 'delta-delta']),
      t('queimadura-ped', 'Queimadura — superfície queimada e Parkland (criança)', 'Lund e Browder por região e idade, Parkland (3 mL/kg/%SCQ) com manutenção e diurese-alvo.', sobDemanda(() => import('@/pages/plantonista/pediatria/QueimaduraPed'), 'QueimaduraPed'), ['queimadura', 'SCQ', 'Lund-Browder', 'Parkland', 'grande queimado', 'reposição volêmica']),
    ],
  },
  {
    slug: 'emergencias',
    label: 'Emergências — manual HC',
    description: 'Doses, reposições e fórmulas do Manual de Medicina de Emergência do HCFMUSP (adulto).',
    icon: Siren,
    tools: [
      t('hipocalemia-reposicao-potassio', 'Hipocalemia — potássio', 'Classificação, KCl EV e VO, mEq/h e mL/h.', sobDemanda(() => import('@/pages/plantonista/manual/ReposicaoPotassio'), 'ReposicaoPotassio'), ['potássio', 'hipocalemia', 'KCl', 'reposição']),
      t('hipomagnesemia-reposicao-magnesio', 'Hipomagnesemia — magnésio', 'Esquemas de MgSO4 e preparo.', sobDemanda(() => import('@/pages/plantonista/manual/ReposicaoMagnesio'), 'ReposicaoMagnesio'), ['magnésio', 'hipomagnesemia', 'sulfato de magnésio']),
      t('hipocalcemia-reposicao-calcio', 'Hipocalcemia — cálcio', 'Cálcio corrigido, bolus e infusão.', sobDemanda(() => import('@/pages/plantonista/manual/DisturbiosCalcio'), 'ReposicaoCalcio'), ['cálcio', 'hipocalcemia', 'gluconato']),
      t('hipercalcemia', 'Hipercalcemia', 'Gravidade, FECa e tratamento agudo.', sobDemanda(() => import('@/pages/plantonista/manual/DisturbiosCalcio'), 'HipercalcemiaAdulto'), ['cálcio', 'hipercalcemia', 'calcitonina', 'bifosfonato']),
      t('hipofosfatemia-reposicao-fosforo', 'Hipofosfatemia — fósforo', 'Reposição IV e VO com limites.', sobDemanda(() => import('@/pages/plantonista/manual/ReposicaoFosforo'), 'ReposicaoFosforo'), ['fósforo', 'fosfato', 'hipofosfatemia']),
      t('gasometria-acidobase', 'Gasometria e distúrbios acidobásicos', 'Compensação, ânion-gap, delta-delta, gap osmolar.', sobDemanda(() => import('@/pages/plantonista/manual/AcidoBase'), 'GasometriaAcidoBase'), ['gasometria', 'acidose', 'alcalose', 'ânion-gap', 'Winter']),
      t('bicarbonato-de-sodio', 'Bicarbonato de sódio', 'Déficit e esquemas de preparo.', sobDemanda(() => import('@/pages/plantonista/manual/AcidoBase'), 'BicarbonatoAdulto'), ['bicarbonato', 'acidose metabólica', 'NaHCO3']),
      t('cad-ehh-criterios', 'CAD e EHH — critérios e fórmulas', 'Na corrigido, osmolaridade, ânion-gap e gravidade.', sobDemanda(() => import('@/pages/plantonista/manual/CadEhhAvaliacao'), 'CadEhhAvaliacao'), ['cetoacidose', 'CAD', 'EHH', 'osmolaridade']),
      t('cad-ehh-tratamento', 'CAD e EHH — tratamento', 'Hidratação, insulina EV, potássio e transição.', sobDemanda(() => import('@/pages/plantonista/manual/CadEhhTratamento'), 'CadEhhTratamento'), ['cetoacidose', 'CAD', 'EHH', 'insulina', 'potássio']),
      t('hipoglicemia-adulto', 'Hipoglicemia', 'Limiar e doses de glicose, glucagon e tiamina.', sobDemanda(() => import('@/pages/plantonista/manual/HipoglicemiaAdulto'), 'HipoglicemiaAdulto'), ['hipoglicemia', 'glicose', 'glucagon']),
      t('pcr-adulto', 'PCR — drogas e desfibrilação', 'Doses da Tabela 2 do HC e carga do choque.', sobDemanda(() => import('@/pages/plantonista/manual/PcrAdulto'), 'PcrAdulto'), ['PCR', 'parada', 'adrenalina', 'amiodarona', 'desfibrilação']),
      t('bradicardia-adulto', 'Bradicardia sintomática', 'Atropina, dopamina e adrenalina.', sobDemanda(() => import('@/pages/plantonista/manual/BradicardiaAdulto'), 'BradicardiaAdulto'), ['bradicardia', 'atropina', 'dopamina', 'marca-passo']),
      t('taquiarritmias-adulto', 'Taquiarritmias — drogas EV', 'Adenosina, amiodarona, lidocaína, verapamil, diltiazem, magnésio.', sobDemanda(() => import('@/pages/plantonista/manual/TaquiarritmiasAdulto'), 'TaquiarritmiasAdulto'), ['taquicardia', 'TSV', 'adenosina', 'amiodarona']),
      t('anafilaxia-adulto', 'Anafilaxia', 'Adrenalina IM/EV/infusão, volume e segunda linha.', sobDemanda(() => import('@/pages/plantonista/manual/AnafilaxiaAdulto'), 'AnafilaxiaAdulto'), ['anafilaxia', 'adrenalina', 'choque anafilático']),
      t('anticoagulacao-plena-adulto', 'Anticoagulação plena por peso', 'Enoxaparina com ajuste renal/idade, fondaparinux e outros.', sobDemanda(() => import('@/pages/plantonista/manual/AnticoagulacaoPlenaAdulto'), 'AnticoagulacaoPlenaAdulto'), ['enoxaparina', 'HBPM', 'fondaparinux', 'TVP', 'TEP', 'IAM']),
      t('fibrinoliticos-adulto', 'Fibrinolíticos', 'Estreptoquinase, alteplase e tenecteplase.', sobDemanda(() => import('@/pages/plantonista/manual/FibrinoliticosAdulto'), 'FibrinoliticosAdulto'), ['trombólise', 'alteplase', 'tenecteplase', 'IAM com supra', 'TEP']),
    ],
  },
  {
    slug: 'escores',
    label: 'Escores',
    description: 'Escalas de gravidade e estratificação de risco.',
    icon: GraduationCap,
    tools: [
      t('glasgow', 'Escala de Coma de Glasgow (GCS-P)', 'Abertura ocular, resposta verbal e resposta motora, com o GCS-P pelas pupilas.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Glasgow'), ['Escala', 'Coma', 'Glasgow', 'GCS-P']),
      t('curb-65', 'CURB-65', 'Gravidade da pneumonia comunitária e mortalidade em 30 dias da coorte original.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Curb65'), ['CURB-65', 'gravidade', 'pneumonia', 'comunitária']),
      t('cha2ds2-va', 'CHA₂DS₂-VA', 'Risco de AVC na fibrilação atrial, sem a categoria de sexo (ESC 2024).', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Cha2ds2va'), ['CHA₂DS₂-VA', 'risco', 'fibrilação', 'atrial']),
      t('has-bled', 'HAS-BLED', 'No paciente em anticoagulação oral por fibrilação atrial.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'HasBled'), ['HAS-BLED', 'risco', 'sangramento', 'maior']),
      t('child-pugh', 'Child-Pugh', 'Classe A, B ou C, e a sobrevida estimada.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'ChildPugh'), ['Child-Pugh', 'gravidade', 'cirrose']),
      t('heart', 'HEART', 'Risco de evento cardíaco maior em 6 semanas.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Heart'), ['HEART', 'torácica', 'pronto-socorro']),
      t('wells-tvp', 'Wells para TVP', 'Probabilidade clínica de TVP: nove itens e um subtrator.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'WellsTvp'), ['Wells', 'para', 'probabilidade', 'trombose', 'venosa', 'profunda']),
      t('alvarado', 'Alvarado', 'Oito itens de história, exame e hemograma, de 0 a 10.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Alvarado'), ['Alvarado', 'probabilidade', 'apendicite', 'aguda']),
      t('abcd2', 'ABCD2', 'Risco de AVC em 2 e 7 dias após ataque isquêmico transitório.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Abcd2'), ['ABCD2', 'risco', 'depois']),
      t('4t-hit', '4T', 'Probabilidade pré-teste de trombocitopenia induzida por heparina, de 0 a 8 pontos.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'QuatroT'), ['probabilidade', 'trombocitopenia', 'induzida', 'heparina']),
      t('aims65', 'AIMS65', 'Mortalidade hospitalar na hemorragia digestiva alta com cinco itens da chegada.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Aims65'), ['AIMS65', 'mortalidade', 'hemorragia', 'digestiva', 'alta']),
      t('bisap', 'BISAP', 'Gravidade da pancreatite aguda nas primeiras 24 horas e mortalidade da coorte original.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Bisap'), ['BISAP', 'gravidade', 'pancreatite', 'aguda']),
      t('cam-icu', 'CAM-ICU', 'Delirium no paciente crítico por quatro características, incluindo o intubado.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'CamIcu'), ['CAM-ICU', 'delirium', 'paciente', 'crítico']),
      t('civd-isth', 'CIVD manifesta', 'Quatro parâmetros laboratoriais, 0 a 8 pontos, com a doença de base como pré-requisito.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'CivdIsth'), ['CIVD', 'manifesta', 'escore', 'ISTH']),
      t('canadian-ct-head', 'Canadian CT Head Rule', 'TCE leve no adulto: cinco critérios de alto risco e dois de risco médio.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'CanadianCtHead'), ['Canadian', 'Head', 'Rule', 'leve', 'adulto']),
      t('light', 'Critérios de Light', 'Exsudato ou transudato no derrame pleural, com o gradiente de albumina.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Light'), ['Critérios', 'Light', 'exsudato', 'transudato']),
      t('four', 'FOUR Score', 'Quatro domínios de 0 a 4, sem depender de resposta verbal.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Four'), ['FOUR', 'Score', 'consciência', 'paciente', 'crítico']),
      t('grace', 'GRACE', 'Mortalidade hospitalar na síndrome coronariana aguda por oito variáveis da admissão.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Grace'), ['GRACE', 'risco', 'síndrome', 'coronariana', 'aguda']),
      t('genebra-revisado', 'Genebra revisado', 'Probabilidade pré-teste de embolia pulmonar só com itens objetivos.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'GenebraRevisado'), ['Genebra', 'revisado', 'probabilidade', 'embolia', 'pulmonar']),
      t('glasgow-blatchford', 'Glasgow-Blatchford', 'Risco de necessidade de intervenção na hemorragia digestiva alta, com dados anteriores à endoscopia.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'GlasgowBlatchford'), ['Glasgow-Blatchford', 'hemorragia', 'digestiva', 'alta']),
      t('killip', 'Killip', 'Classe de congestão no infarto, de I a IV, pelo exame físico da admissão.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Killip'), ['Killip', 'classe', 'congestão', 'infarto']),
      t('meld-3', 'MELD 3.0', 'Mortalidade em 3 meses na doença hepática avançada, com MELD-Na e MELD original para comparação.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Meld3'), ['MELD', 'mortalidade', 'doença', 'hepática']),
      t('psi-port', 'PSI / PORT', 'Classe de gravidade da pneumonia adquirida na comunidade e mortalidade em 30 dias da coorte original.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Psi'), ['PORT', 'gravidade', 'pneumonia', 'adquirida', 'comunidade']),
      t('rass', 'RASS', 'Nível de agitação ou sedação, de +4 combativo a −5 sem despertar.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Rass'), ['RASS', 'escala', 'agitação', 'sedação', 'Richmond']),
      t('ranson', 'Ranson', 'Gravidade da pancreatite aguda não biliar: cinco critérios na admissão e seis nas primeiras 48 horas.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Ranson'), ['Ranson', 'gravidade', 'pancreatite', 'biliar']),
      t('rockall', 'Rockall', 'Mortalidade e ressangramento na hemorragia digestiva alta, na forma clínica ou completa.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'Rockall'), ['Rockall', 'ressangramento', 'mortalidade']),
      t('sepse-adulto', 'Sepse no adulto', 'Sinal de alerta qSOFA, disfunção orgânica pelo SOFA e clareamento de lactato.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'SepseAdulto'), ['Sepse', 'adulto', 'qSOFA', 'SOFA', 'lactato']),
      t('wells-tep', 'Wells para TEP', 'Probabilidade pré-teste de embolia pulmonar, nas leituras de três níveis e dicotomizada, com o limiar de D-dímero ajustado pela idade.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'WellsTep'), ['Wells', 'para', 'probabilidade', 'embolia', 'pulmonar']),
      t('saps3', 'SAPS 3', 'Estimativa de mortalidade na admissão em UTI.', sobDemanda(() => import('@/pages/plantonista/escores/Saps3'), 'Saps3'), ['mortalidade', 'UTI', 'gravidade', 'prognóstico']),
      t('pesi', 'Severidade do TEP (PESI)', 'PESI original e simplificado.', sobDemanda(() => import('@/pages/plantonista/escores/Pesi'), 'Pesi'), ['TEP', 'embolia', 'pulmonar', 'prognóstico']),
      t('nih-avc', 'NIH — Classificação AVC', 'Escala de déficit neurológico (NIHSS).', sobDemanda(() => import('@/pages/plantonista/escores/NihAvc'), 'NihAvc'), ['AVC', 'NIHSS', 'déficit', 'neurologia', 'stroke']),
      t('news', 'NEWS', 'Identificador precoce de deterioração (NEWS).', sobDemanda(() => import('@/pages/plantonista/escores/News'), 'News'), ['deterioração', 'escore', 'alerta', 'NEWS']),
      t('news2', 'NEWS2', 'Alerta precoce de deterioração; rastreio de sepse pela SSC 2026.', sobDemanda(() => import('@/pages/plantonista/escores/EscoresPacote'), 'News2'), ['deterioração', 'escore', 'alerta', 'NEWS 2', 'NEWS2', 'sepse', 'rastreio']),
      t('timi', 'TIMI — Risco', 'Risco em angina instável / IAM sem supra de ST.', sobDemanda(() => import('@/pages/plantonista/escores/Timi'), 'Timi'), ['TIMI', 'angina', 'IAM', 'coronariana', 'risco']),
    ],
  },
  {
    slug: 'protocolos',
    label: 'Protocolos',
    description: 'Condutas padronizadas para situações frequentes.',
    icon: ClipboardList,
    tools: [
      t('hda-lamg', 'Profilaxia HDA/LAMG', 'Prevenção de sangramento digestivo por estresse.', sobDemanda(() => import('@/pages/plantonista/protocolos/ProfilaxiaHdaLamg'), 'ProfilaxiaHdaLamg'), ['LAMG', 'úlcera de estresse', 'pantoprazol', 'sangramento digestivo']),
      t('hiperpotassemia', 'Hiperpotassemia', 'Gravidade, cálcio pelo ECG e conduta em três tempos.', sobDemanda(() => import('@/pages/plantonista/protocolos/Hiperpotassemia'), 'Hiperpotassemia'), ['potássio', 'hipercalemia', 'glicoinsulinoterapia', 'gluconato', 'ECG']),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Protocolo de insulina em infusão contínua.', sobDemanda(() => import('@/pages/plantonista/protocolos/ControleGlicemicoProtocolo'), 'ControleGlicemicoProtocolo'), ['insulina', 'glicemia', 'protocolo']),
      t('abstinencia', 'Abstinência', 'Manejo da abstinência de sedativos/opioides.', sobDemanda(() => import('@/pages/plantonista/protocolos/Abstinencia'), 'Abstinencia'), ['abstinência', 'sedativo', 'opioide', 'metadona', 'desmame']),
      t('preparo-colonoscopia', 'Preparo para Colonoscopia', 'Dieta e preparo intestinal por horário.', sobDemanda(() => import('@/pages/plantonista/protocolos/PreparoColonoscopia'), 'PreparoColonoscopia'), ['colonoscopia', 'manitol', 'preparo', 'bisacodil']),
      t('decanulacao', 'Decanulação', 'Roteiro para retirada da traqueostomia.', sobDemanda(() => import('@/pages/plantonista/protocolos/Decanulacao'), 'Decanulacao'), ['traqueostomia', 'decanulação', 'desmame', 'cânula']),
      t('nefropatia-contraste', 'Nefropatia Induzida por Contraste', 'Protocolo de nefroproteção.', sobDemanda(() => import('@/pages/plantonista/protocolos/NefropatiaProtocolo'), 'NefropatiaProtocolo'), ['contraste', 'nefropatia', 'nefroproteção', 'TFG']),
    ],
  },
  {
    slug: 'farmacia',
    label: 'Farmácia',
    description: 'Consulta de medicamentos, diluições e compatibilidades.',
    icon: FlaskConical,
    tools: [
      t('consulta-medicamentos', 'Consulta de Medicamentos', 'Busca por nome com apresentação, dose e diluição.', sobDemanda(() => import('@/pages/plantonista/farmacia/ConsultaMedicamentos'), 'ConsultaMedicamentos'), ['medicamento', 'prescrição', 'droga', 'diluição', 'apresentação', 'CMED', 'farmácia']),
      t('referencia-diluicao', 'Referência de Diluição', 'Diluições publicadas e revisadas por farmacêutico.', sobDemanda(() => import('@/pages/plantonista/farmacia/ReferenciaDiluicaoTool'), 'ReferenciaDiluicaoTool'), ['diluição', 'reconstituição', 'estabilidade', 'infusão', 'farmácia', 'compatibilidade']),
    ],
  },
  {
    slug: 'dengue',
    label: 'Dengue',
    description: 'Classificação, conduta e hidratação da dengue.',
    icon: Wind,
    tools: [
      t('classificacao-conduta-hidratacao', 'Classificação, Conduta e Hidratação', 'Grupos A–D e hidratação conforme o MS.', sobDemanda(() => import('@/pages/plantonista/dengue/ClassificacaoDengue'), 'ClassificacaoDengue'), ['dengue', 'arbovirose', 'hidratação', 'sinais de alarme', 'choque']),
      t('fluxograma-conduta', 'Fluxograma de Conduta', 'Fluxo A–D com a conduta correspondente.', sobDemanda(() => import('@/pages/plantonista/dengue/FluxogramaDengue'), 'FluxogramaDengue'), ['dengue', 'fluxograma', 'conduta', 'grupos']),
      t('manual-dengue', 'Manual de Dengue', 'Síntese do manejo da dengue (MS).', sobDemanda(() => import('@/pages/plantonista/dengue/ManualDengue'), 'ManualDengue'), ['dengue', 'manual', 'ministério da saúde']),
      t('video-dengue', 'Vídeo Dr. Daniel Wagner', 'Conteúdo do vídeo do infectologista.', sobDemanda(() => import('@/pages/plantonista/dengue/VideoDengue'), 'VideoDengue'), ['dengue', 'vídeo', 'infectologia']),
    ],
  },
  {
    slug: 'games',
    label: 'Games',
    description: 'Jogos clínicos para fixar o conhecimento.',
    icon: Gamepad2,
    tools: [
      t('infection-pneumonia', 'Infection — Pneumonia', 'Quiz de antibioticoterapia em pneumonia na UTI.', sobDemanda(() => import('@/pages/plantonista/games/Infection'), 'Infection'), ['game', 'quiz', 'antibiótico', 'pneumonia', 'stewardship']),
      t('minigame-emergencia', 'Minigame de Emergência', 'Cenários rápidos de emergência.', sobDemanda(() => import('@/pages/plantonista/games/MinigameEmergencia'), 'MinigameEmergencia'), ['game', 'quiz', 'emergência', 'PCR', 'AVC', 'IAM', 'anafilaxia']),
    ],
  },
  {
    slug: 'ventilacao-mecanica',
    label: 'Ventilação Mecânica',
    description: 'Suporte ventilatório, VNI e recrutamento pulmonar.',
    icon: Wind,
    tools: [
      t('predicao-falencia-vni', 'Predição de Falência da VNI', 'Escala HACOR após 1 hora de VNI.', sobDemanda(() => import('@/pages/plantonista/ventilacao/PredicaoFalenciaVni'), 'PredicaoFalenciaVni'), ['VNI', 'HACOR', 'ventilação não invasiva', 'intubação', 'insuficiência respiratória']),
      t('recrutabilidade-pulmonar', 'Recrutabilidade Pulmonar', 'R/I ratio — potencial de recrutamento.', sobDemanda(() => import('@/pages/plantonista/ventilacao/RecrutabilidadePulmonar'), 'RecrutabilidadePulmonar'), ['recrutamento', 'PEEP', 'R/I ratio', 'SARA', 'complacência']),
      t('manobra-recrutamento', 'Manobra de Recrutamento', 'Passo a passo com PEEP progressiva.', sobDemanda(() => import('@/pages/plantonista/ventilacao/ManobraRecrutamento'), 'ManobraRecrutamento'), ['recrutamento', 'PEEP', 'SARA', 'manobra']),
      t('suporte-ventilatorio', 'Suporte Ventilatório', 'Peso predito, VC ideal e P/F.', sobDemanda(() => import('@/pages/plantonista/ventilacao/SuporteVentilatorio'), 'SuporteVentilatorio'), ['ventilação mecânica', 'VM', 'volume corrente', 'P/F', 'proteção pulmonar']),
      t('mobilidade-funcional', 'Mobilidade Funcional', 'Níveis e critérios de mobilização.', sobDemanda(() => import('@/pages/plantonista/ventilacao/MobilidadeFuncional'), 'MobilidadeFuncional'), ['mobilização', 'fisioterapia', 'ambulação', 'UTI']),
    ],
  },
]

/** Todas as chaves `secao/slug` — usado para migrar favoritos/recentes antigos. */
export const CHAVES_FERRAMENTAS: string[] = SECOES.flatMap((s) =>
  s.tools.map((tool) => chaveFerramenta(s.slug, tool.slug))
)

export function acharSecao(slug: string) {
  return SECOES.find((s) => s.slug === slug)
}
