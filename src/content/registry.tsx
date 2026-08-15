import type { ComponentType } from 'react'
import {
  Calculator,
  ClipboardList,
  Gamepad2,
  GraduationCap,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import { IOT } from '@/pages/plantonista/calculadoras/IOT'
import { DrogasVasoativas } from '@/pages/plantonista/calculadoras/DrogasVasoativas'
import { ControleGlicemico } from '@/pages/plantonista/calculadoras/ControleGlicemico'
import { SedacaoContinua } from '@/pages/plantonista/calculadoras/SedacaoContinua'
import { BloqueioNeuromuscular } from '@/pages/plantonista/calculadoras/BloqueioNeuromuscular'
import { HeparinizacaoVenosa } from '@/pages/plantonista/calculadoras/HeparinizacaoVenosa'
import { Hiponatremia } from '@/pages/plantonista/calculadoras/Hiponatremia'
import { Hipernatremia } from '@/pages/plantonista/calculadoras/Hipernatremia'
import { Hidantalizacao } from '@/pages/plantonista/calculadoras/Hidantalizacao'
import { NefropatiaContraste } from '@/pages/plantonista/calculadoras/NefropatiaContraste'
import { ProfilaxiaTEV } from '@/pages/plantonista/calculadoras/ProfilaxiaTEV'
import { AcessoVenoso } from '@/pages/plantonista/calculadoras/AcessoVenoso'
import { HeparinizacaoAjuste } from '@/pages/plantonista/calculadoras/HeparinizacaoAjuste'
import { Saps3 } from '@/pages/plantonista/escores/Saps3'
import { Pesi } from '@/pages/plantonista/escores/Pesi'
import { NihAvc } from '@/pages/plantonista/escores/NihAvc'
import { News } from '@/pages/plantonista/escores/News'
import { News2 } from '@/pages/plantonista/escores/News2'
import { Timi } from '@/pages/plantonista/escores/Timi'
import { PredicaoFalenciaVni } from '@/pages/plantonista/ventilacao/PredicaoFalenciaVni'
import { RecrutabilidadePulmonar } from '@/pages/plantonista/ventilacao/RecrutabilidadePulmonar'
import { SuporteVentilatorio } from '@/pages/plantonista/ventilacao/SuporteVentilatorio'
import { ManobraRecrutamento } from '@/pages/plantonista/ventilacao/ManobraRecrutamento'
import { MobilidadeFuncional } from '@/pages/plantonista/ventilacao/MobilidadeFuncional'
import { ProfilaxiaHdaLamg } from '@/pages/plantonista/protocolos/ProfilaxiaHdaLamg'
import { Hiperpotassemia } from '@/pages/plantonista/protocolos/Hiperpotassemia'
import { Abstinencia } from '@/pages/plantonista/protocolos/Abstinencia'
import { PreparoColonoscopia } from '@/pages/plantonista/protocolos/PreparoColonoscopia'
import { Decanulacao } from '@/pages/plantonista/protocolos/Decanulacao'
import { ControleGlicemicoProtocolo } from '@/pages/plantonista/protocolos/ControleGlicemicoProtocolo'
import { NefropatiaProtocolo } from '@/pages/plantonista/protocolos/NefropatiaProtocolo'
import { ClassificacaoDengue } from '@/pages/plantonista/dengue/ClassificacaoDengue'
import { FluxogramaDengue } from '@/pages/plantonista/dengue/FluxogramaDengue'
import { ManualDengue } from '@/pages/plantonista/dengue/ManualDengue'
import { VideoDengue } from '@/pages/plantonista/dengue/VideoDengue'
import { Infection } from '@/pages/plantonista/games/Infection'
import { MinigameEmergencia } from '@/pages/plantonista/games/MinigameEmergencia'

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
      t('iot', 'Intubação Orotraqueal (sequência rápida)', 'Doses de pré-medicação, indução e bloqueio por peso.', IOT, ['intubação', 'sequência rápida', 'sedação', 'anestesia', 'succinilcolina', 'propofol', 'IOT']),
      t('drogas-vasoativas', 'Drogas Vasoativas', 'Preparo das diluições e vazão (mL/h) por peso.', DrogasVasoativas, ['noradrenalina', 'vasopressor', 'infusão', 'diluição', 'dopamina', 'adrenalina', 'DVA']),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Início e ajuste da infusão de insulina.', ControleGlicemico, ['insulina', 'glicemia', 'diabetes', 'hiperglicemia']),
      t('sedacao-continua', 'Sedação Contínua', 'Fentanil, midazolam, cetamina, dexmedetomidina e propofol.', SedacaoContinua, ['fentanil', 'midazolam', 'propofol', 'dexmedetomidina', 'cetamina', 'analgesia']),
      t('bloqueio-neuromuscular', 'Bloqueio Neuromuscular Contínuo', 'Atracúrio, cisatracúrio, rocurônio e pancurônio.', BloqueioNeuromuscular, ['atracúrio', 'rocurônio', 'curarizante', 'paralisia']),
      t('heparinizacao-venosa', 'Heparinização Venosa', 'Bólus inicial, infusão e ajuste pelo TTPa.', HeparinizacaoVenosa, ['heparina', 'TTPa', 'anticoagulação', 'TVP', 'TEP']),
      t('hiponatremia', 'Hiponatremia', 'Reposição de NaCl 3% nas primeiras 24 h.', Hiponatremia, ['sódio', 'NaCl 3%', 'hiponatremia', 'eletrólitos']),
      t('hipernatremia', 'Hipernatremia', 'Volume de soluções hipotônicas para reduzir o Na⁺.', Hipernatremia, ['sódio', 'água livre', 'hipernatremia', 'eletrólitos']),
      t('hidantalizacao', 'Hidantalização', 'Ataque com fenitoína e manutenção.', Hidantalizacao, ['fenitoína', 'hidantal', 'crise convulsiva', 'epilepsia']),
      t('nefropatia-contraste', 'Prevenção de Nefropatia por Contraste', 'Cockcroft–Gault e nefroproteção.', NefropatiaContraste, ['contraste', 'rim', 'creatinina', 'TFG', 'nefroproteção']),
      t('profilaxia-tev', 'Profilaxia TEV', 'Pádua, Caprini, ortopédico e obstétrico.', ProfilaxiaTEV, ['trombose', 'TEV', 'enoxaparina', 'Caprini', 'Pádua', 'TVP']),
      t('acesso-venoso', 'Escolha de Acesso Venoso', 'Recomendação de dispositivo por perfil e terapia.', AcessoVenoso, ['PICC', 'CVC', 'cateter', 'acesso venoso', 'periférico', 'central']),
      t('heparinizacao-ajuste', 'Heparinização Venosa (Ajuste)', 'Ajuste da infusão pelo TTPa.', HeparinizacaoAjuste, ['heparina', 'TTPa', 'ajuste', 'anticoagulação']),
    ],
  },
  {
    slug: 'escores',
    label: 'Escores',
    description: 'Escalas de gravidade e estratificação de risco.',
    icon: GraduationCap,
    tools: [
      t('saps3', 'SAPS 3', 'Estimativa de mortalidade na admissão em UTI.', Saps3, ['mortalidade', 'UTI', 'gravidade', 'prognóstico']),
      t('pesi', 'Severidade do TEP (PESI)', 'PESI original e simplificado.', Pesi, ['TEP', 'embolia', 'pulmonar', 'prognóstico']),
      t('nih-avc', 'NIH — Classificação AVC', 'Escala de déficit neurológico (NIHSS).', NihAvc, ['AVC', 'NIHSS', 'déficit', 'neurologia', 'stroke']),
      t('news', 'NEWS', 'Identificador precoce de deterioração (NEWS).', News, ['deterioração', 'escore', 'alerta', 'NEWS']),
      t('news2', 'NEWS 2', 'Identificador precoce de deterioração (NEWS 2).', News2, ['deterioração', 'escore', 'alerta', 'NEWS 2']),
      t('timi', 'TIMI — Risco', 'Risco em angina instável / IAM sem supra de ST.', Timi, ['TIMI', 'angina', 'IAM', 'coronariana', 'risco']),
    ],
  },
  {
    slug: 'protocolos',
    label: 'Protocolos',
    description: 'Condutas padronizadas para situações frequentes.',
    icon: ClipboardList,
    tools: [
      t('hda-lamg', 'Profilaxia HDA/LAMG', 'Prevenção de sangramento digestivo por estresse.', ProfilaxiaHdaLamg, ['LAMG', 'úlcera de estresse', 'pantoprazol', 'sangramento digestivo']),
      t('hiperpotassemia', 'Hiperpotassemia', 'Manejo da hipercalemia aguda.', Hiperpotassemia, ['potássio', 'hipercalemia', 'glicoinsulinoterapia', 'gluconato']),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Protocolo de insulina em infusão contínua.', ControleGlicemicoProtocolo, ['insulina', 'glicemia', 'protocolo']),
      t('abstinencia', 'Abstinência', 'Manejo da abstinência de sedativos/opioides.', Abstinencia, ['abstinência', 'sedativo', 'opioide', 'metadona', 'desmame']),
      t('preparo-colonoscopia', 'Preparo para Colonoscopia', 'Dieta e preparo intestinal por horário.', PreparoColonoscopia, ['colonoscopia', 'manitol', 'preparo', 'bisacodil']),
      t('decanulacao', 'Decanulação', 'Roteiro para retirada da traqueostomia.', Decanulacao, ['traqueostomia', 'decanulação', 'desmame', 'cânula']),
      t('nefropatia-contraste', 'Nefropatia Induzida por Contraste', 'Protocolo de nefroproteção.', NefropatiaProtocolo, ['contraste', 'nefropatia', 'nefroproteção', 'TFG']),
    ],
  },
  {
    slug: 'dengue',
    label: 'Dengue',
    description: 'Classificação, conduta e hidratação da dengue.',
    icon: Wind,
    tools: [
      t('classificacao-conduta-hidratacao', 'Classificação, Conduta e Hidratação', 'Grupos A–D e hidratação conforme o MS.', ClassificacaoDengue, ['dengue', 'arbovirose', 'hidratação', 'sinais de alarme', 'choque']),
      t('fluxograma-conduta', 'Fluxograma de Conduta', 'Fluxo A–D com a conduta correspondente.', FluxogramaDengue, ['dengue', 'fluxograma', 'conduta', 'grupos']),
      t('manual-dengue', 'Manual de Dengue', 'Síntese do manejo da dengue (MS).', ManualDengue, ['dengue', 'manual', 'ministério da saúde']),
      t('video-dengue', 'Vídeo Dr. Daniel Wagner', 'Conteúdo do vídeo do infectologista.', VideoDengue, ['dengue', 'vídeo', 'infectologia']),
    ],
  },
  {
    slug: 'games',
    label: 'Games',
    description: 'Jogos clínicos para fixar o conhecimento.',
    icon: Gamepad2,
    tools: [
      t('infection-pneumonia', 'Infection — Pneumonia', 'Quiz de antibioticoterapia em pneumonia na UTI.', Infection, ['game', 'quiz', 'antibiótico', 'pneumonia', 'stewardship']),
      t('minigame-emergencia', 'Minigame de Emergência', 'Cenários rápidos de emergência.', MinigameEmergencia, ['game', 'quiz', 'emergência', 'PCR', 'AVC', 'IAM', 'anafilaxia']),
    ],
  },
  {
    slug: 'ventilacao-mecanica',
    label: 'Ventilação Mecânica',
    description: 'Suporte ventilatório, VNI e recrutamento pulmonar.',
    icon: Wind,
    tools: [
      t('predicao-falencia-vni', 'Predição de Falência da VNI', 'Escala HACOR após 1 hora de VNI.', PredicaoFalenciaVni, ['VNI', 'HACOR', 'ventilação não invasiva', 'intubação', 'insuficiência respiratória']),
      t('recrutabilidade-pulmonar', 'Recrutabilidade Pulmonar', 'R/I ratio — potencial de recrutamento.', RecrutabilidadePulmonar, ['recrutamento', 'PEEP', 'R/I ratio', 'SARA', 'complacência']),
      t('manobra-recrutamento', 'Manobra de Recrutamento', 'Passo a passo com PEEP progressiva.', ManobraRecrutamento, ['recrutamento', 'PEEP', 'SARA', 'manobra']),
      t('suporte-ventilatorio', 'Suporte Ventilatório', 'Peso predito, VC ideal e P/F.', SuporteVentilatorio, ['ventilação mecânica', 'VM', 'volume corrente', 'P/F', 'proteção pulmonar']),
      t('mobilidade-funcional', 'Mobilidade Funcional', 'Níveis e critérios de mobilização.', MobilidadeFuncional, ['mobilização', 'fisioterapia', 'ambulação', 'UTI']),
    ],
  },
]

export function acharSecao(slug: string) {
  return SECOES.find((s) => s.slug === slug)
}
