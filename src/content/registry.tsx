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
      t('saps3', 'SAPS 3', 'Estimativa de mortalidade na admissão em UTI.', sobDemanda(() => import('@/pages/plantonista/escores/Saps3'), 'Saps3'), ['mortalidade', 'UTI', 'gravidade', 'prognóstico']),
      t('pesi', 'Severidade do TEP (PESI)', 'PESI original e simplificado.', sobDemanda(() => import('@/pages/plantonista/escores/Pesi'), 'Pesi'), ['TEP', 'embolia', 'pulmonar', 'prognóstico']),
      t('nih-avc', 'NIH — Classificação AVC', 'Escala de déficit neurológico (NIHSS).', sobDemanda(() => import('@/pages/plantonista/escores/NihAvc'), 'NihAvc'), ['AVC', 'NIHSS', 'déficit', 'neurologia', 'stroke']),
      t('news', 'NEWS', 'Identificador precoce de deterioração (NEWS).', sobDemanda(() => import('@/pages/plantonista/escores/News'), 'News'), ['deterioração', 'escore', 'alerta', 'NEWS']),
      t('news2', 'NEWS 2', 'Identificador precoce de deterioração (NEWS 2).', sobDemanda(() => import('@/pages/plantonista/escores/News2'), 'News2'), ['deterioração', 'escore', 'alerta', 'NEWS 2']),
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
      t('hiperpotassemia', 'Hiperpotassemia', 'Manejo da hipercalemia aguda.', sobDemanda(() => import('@/pages/plantonista/protocolos/Hiperpotassemia'), 'Hiperpotassemia'), ['potássio', 'hipercalemia', 'glicoinsulinoterapia', 'gluconato']),
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
