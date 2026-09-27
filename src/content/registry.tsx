import { lazy, type ComponentType } from 'react'
import {
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
      t('iot', 'Intubação Orotraqueal (sequência rápida)', 'Doses de pré-medicação, indução e bloqueio por peso.', sobDemanda(() => import('@/pages/plantonista/calculadoras/IOT'), 'IOT'), ['intubação', 'sequência rápida', 'sedação', 'anestesia', 'succinilcolina', 'propofol', 'IOT']),
      t('drogas-vasoativas', 'Drogas Vasoativas', 'Preparo das diluições e vazão (mL/h) por peso.', sobDemanda(() => import('@/pages/plantonista/calculadoras/DrogasVasoativas'), 'DrogasVasoativas'), ['noradrenalina', 'vasopressor', 'infusão', 'diluição', 'dopamina', 'adrenalina', 'DVA']),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Início e ajuste da infusão de insulina.', sobDemanda(() => import('@/pages/plantonista/calculadoras/ControleGlicemico'), 'ControleGlicemico'), ['insulina', 'glicemia', 'diabetes', 'hiperglicemia']),
      t('sedacao-continua', 'Sedação Contínua', 'Fentanil, midazolam, cetamina, dexmedetomidina e propofol.', sobDemanda(() => import('@/pages/plantonista/calculadoras/SedacaoContinua'), 'SedacaoContinua'), ['fentanil', 'midazolam', 'propofol', 'dexmedetomidina', 'cetamina', 'analgesia']),
      t('bloqueio-neuromuscular', 'Bloqueio Neuromuscular Contínuo', 'Atracúrio, cisatracúrio, rocurônio e pancurônio.', sobDemanda(() => import('@/pages/plantonista/calculadoras/BloqueioNeuromuscular'), 'BloqueioNeuromuscular'), ['atracúrio', 'rocurônio', 'curarizante', 'paralisia']),
      t('heparinizacao-venosa', 'Heparinização Venosa', 'Bólus inicial, infusão e ajuste pelo TTPa.', sobDemanda(() => import('@/pages/plantonista/calculadoras/HeparinizacaoVenosa'), 'HeparinizacaoVenosa'), ['heparina', 'TTPa', 'anticoagulação', 'TVP', 'TEP']),
      t('hiponatremia', 'Hiponatremia', 'Reposição de NaCl 3% nas primeiras 24 h.', sobDemanda(() => import('@/pages/plantonista/calculadoras/Hiponatremia'), 'Hiponatremia'), ['sódio', 'NaCl 3%', 'hiponatremia', 'eletrólitos']),
      t('hipernatremia', 'Hipernatremia', 'Volume de soluções hipotônicas para reduzir o Na⁺.', sobDemanda(() => import('@/pages/plantonista/calculadoras/Hipernatremia'), 'Hipernatremia'), ['sódio', 'água livre', 'hipernatremia', 'eletrólitos']),
      t('hidantalizacao', 'Hidantalização', 'Ataque com fenitoína e manutenção.', sobDemanda(() => import('@/pages/plantonista/calculadoras/Hidantalizacao'), 'Hidantalizacao'), ['fenitoína', 'hidantal', 'crise convulsiva', 'epilepsia']),
      t('nefropatia-contraste', 'Prevenção de Nefropatia por Contraste', 'Cockcroft–Gault e nefroproteção.', sobDemanda(() => import('@/pages/plantonista/calculadoras/NefropatiaContraste'), 'NefropatiaContraste'), ['contraste', 'rim', 'creatinina', 'TFG', 'nefroproteção']),
      t('profilaxia-tev', 'Profilaxia TEV', 'Pádua, Caprini, ortopédico e obstétrico.', sobDemanda(() => import('@/pages/plantonista/calculadoras/ProfilaxiaTEV'), 'ProfilaxiaTEV'), ['trombose', 'TEV', 'enoxaparina', 'Caprini', 'Pádua', 'TVP']),
      t('acesso-venoso', 'Escolha de Acesso Venoso', 'Recomendação de dispositivo por perfil e terapia.', sobDemanda(() => import('@/pages/plantonista/calculadoras/AcessoVenoso'), 'AcessoVenoso'), ['PICC', 'CVC', 'cateter', 'acesso venoso', 'periférico', 'central']),
      t('heparinizacao-ajuste', 'Heparinização Venosa (Ajuste)', 'Ajuste da infusão pelo TTPa.', sobDemanda(() => import('@/pages/plantonista/calculadoras/HeparinizacaoAjuste'), 'HeparinizacaoAjuste'), ['heparina', 'TTPa', 'ajuste', 'anticoagulação']),
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
