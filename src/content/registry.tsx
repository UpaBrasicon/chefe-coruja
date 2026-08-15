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

export type ToolDef = {
  slug: string
  label: string
  description: string
  component: ComponentType
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
  component: ComponentType
): ToolDef => ({ slug, label, description, component })

export const SECOES: SectionDef[] = [
  {
    slug: 'calculadoras',
    label: 'Calculadoras',
    description: 'Cálculos de doses, diluições e decisões para o plantão.',
    icon: Calculator,
    tools: [
      t('iot', 'Intubação Orotraqueal (sequência rápida)', 'Doses de pré-medicação, indução e bloqueio por peso.', IOT),
      t('drogas-vasoativas', 'Drogas Vasoativas', 'Preparo das diluições e vazão (mL/h) por peso.', DrogasVasoativas),
      t('controle-glicemico', 'Controle Glicêmico Intensivo', 'Início e ajuste da infusão de insulina.', ControleGlicemico),
      t('sedacao-continua', 'Sedação Contínua', 'Fentanil, midazolam, cetamina, dexmedetomidina e propofol.', SedacaoContinua),
      t('bloqueio-neuromuscular', 'Bloqueio Neuromuscular Contínuo', 'Atracúrio, cisatracúrio, rocurônio e pancurônio.', BloqueioNeuromuscular),
      t('heparinizacao-venosa', 'Heparinização Venosa', 'Bólus inicial, infusão e ajuste pelo TTPa.', HeparinizacaoVenosa),
      t('hiponatremia', 'Hiponatremia', 'Reposição de NaCl 3% nas primeiras 24 h.', Hiponatremia),
      t('hipernatremia', 'Hipernatremia', 'Volume de soluções hipotônicas para reduzir o Na⁺.', Hipernatremia),
      t('hidantalizacao', 'Hidantalização', 'Ataque com fenitoína e manutenção.', Hidantalizacao),
      t('nefropatia-contraste', 'Prevenção de Nefropatia por Contraste', 'Cockcroft–Gault e nefroproteção.', NefropatiaContraste),
      t('profilaxia-tev', 'Profilaxia TEV', 'Pádua, Caprini, ortopédico e obstétrico.', ProfilaxiaTEV),
      t('acesso-venoso', 'Escolha de Acesso Venoso', 'Recomendação de dispositivo por perfil e terapia.', AcessoVenoso),
      t('heparinizacao-ajuste', 'Heparinização Venosa (Ajuste)', 'Ajuste da infusão pelo TTPa.', HeparinizacaoAjuste),
    ],
  },
  {
    slug: 'escores',
    label: 'Escores',
    description: 'Escalas de gravidade e estratificação de risco.',
    icon: GraduationCap,
    tools: [
      t('saps3', 'SAPS 3', 'Estimativa de mortalidade na admissão em UTI.', Saps3),
      t('pesi', 'Severidade do TEP (PESI)', 'PESI original e simplificado.', Pesi),
      t('nih-avc', 'NIH — Classificação AVC', 'Escala de déficit neurológico (NIHSS).', NihAvc),
      t('news', 'NEWS', 'Identificador precoce de deterioração (NEWS).', News),
      t('news2', 'NEWS 2', 'Identificador precoce de deterioração (NEWS 2).', News2),
      t('timi', 'TIMI — Risco', 'Risco em angina instável / IAM sem supra de ST.', Timi),
    ],
  },
  {
    slug: 'protocolos',
    label: 'Protocolos',
    description: 'Condutas padronizadas para situações frequentes.',
    icon: ClipboardList,
    tools: [],
  },
  {
    slug: 'dengue',
    label: 'Dengue',
    description: 'Classificação, conduta e hidratação da dengue.',
    icon: Wind,
    tools: [],
  },
  {
    slug: 'games',
    label: 'Games',
    description: 'Jogos clínicos para fixar o conhecimento.',
    icon: Gamepad2,
    tools: [],
  },
  {
    slug: 'ventilacao-mecanica',
    label: 'Ventilação Mecânica',
    description: 'Suporte ventilatório, VNI e recrutamento pulmonar.',
    icon: Wind,
    tools: [],
  },
]

export function acharSecao(slug: string) {
  return SECOES.find((s) => s.slug === slug)
}
