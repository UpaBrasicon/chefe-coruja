import { lazy, type ComponentType } from 'react'
import { Activity, DoorOpen, Eye, Hospital, MapPin, type LucideIcon } from 'lucide-react'

/**
 * Registry da Central de Plantão — mesmo padrão de `content/registry.tsx`
 * (Central do Plantonista): seções → ferramentas, tudo declarativo e sob demanda.
 *
 * Regra de navegação: **seção com uma única ferramenta é a própria ferramenta**.
 * `/plantao/evolucao` renderiza a evolução direto, sem página intermediária de
 * um card só — e o `?paciente=` da URL sobrevive.
 */

/** Props injetadas pelo router em toda ferramenta de plantão. */
export type PropsFerramentaPlantao = {
  unidadeId?: string
  perfilId?: string
}

export type FerramentaPlantao = {
  slug: string
  label: string
  description: string
  component: ComponentType<PropsFerramentaPlantao>
}

export type SecaoPlantao = {
  slug: string
  label: string
  description: string
  icon: LucideIcon
  tools: FerramentaPlantao[]
}

function sobDemanda(
  importar: () => Promise<Record<string, unknown>>,
  nome: string
): ComponentType<PropsFerramentaPlantao> {
  return lazy(async () => ({
    default: (await importar())[nome] as ComponentType<PropsFerramentaPlantao>,
  }))
}

const f = (
  slug: string,
  label: string,
  description: string,
  component: ComponentType<PropsFerramentaPlantao>
): FerramentaPlantao => ({ slug, label, description, component })

export const SECOES_PLANTAO: SecaoPlantao[] = [
  {
    slug: 'check-in',
    label: 'Meu Plantão',
    description: 'Registre entrada e saída do plantão com geolocalização.',
    icon: MapPin,
    tools: [
      f(
        'check-in',
        'Check-in / Check-out',
        'Entrada e saída do plantão com geolocalização.',
        sobDemanda(() => import('@/pages/plantao/secoes/CheckIn'), 'CheckIn')
      ),
    ],
  },
  {
    slug: 'atendimento-porta',
    label: 'Atendimento Porta',
    description: 'Receituário, atestado, encaminhamento e pedido de exames.',
    icon: DoorOpen,
    tools: [
      f(
        'receituario-medico',
        'Receituário Médico',
        'Prescrição e receita digital.',
        sobDemanda(() => import('@/pages/plantao/atendimento/ReceituarioMedico'), 'ReceituarioMedico')
      ),
      f(
        'atestado-medico',
        'Atestado Médico',
        'Emissão de atestado.',
        sobDemanda(() => import('@/pages/plantao/atendimento/AtestadoMedico'), 'AtestadoMedico')
      ),
      f(
        'encaminhamento',
        'Encaminhamento',
        'Encaminhamento para especialidades.',
        sobDemanda(() => import('@/pages/plantao/atendimento/Encaminhamento'), 'Encaminhamento')
      ),
      f(
        'pedido-exames',
        'Pedido de Exames',
        'Solicitação de exames.',
        sobDemanda(() => import('@/pages/plantao/atendimento/PedidoExames'), 'PedidoExames')
      ),
    ],
  },
  {
    slug: 'internacao',
    label: 'Internação',
    description: 'Pacientes internados e o formulário completo de internação.',
    icon: Hospital,
    tools: [
      f(
        'pacientes',
        'Pacientes Internados',
        'Enfermarias e sala vermelha — dos setores onde você está na escala.',
        sobDemanda(() => import('@/pages/plantao/secoes/PacientesInternados'), 'PacientesInternados')
      ),
      f(
        'formulario',
        'Formulário de Internação',
        'Prescrição, evolução/admissão, exames, internação e exportação em PDF.',
        sobDemanda(() => import('@/pages/plantao/secoes/FormularioInternacao'), 'FormularioInternacao')
      ),
    ],
  },
  {
    slug: 'observacao',
    label: 'Observação',
    description: 'Pacientes em observação — no máximo 6 horas.',
    icon: Eye,
    tools: [
      f(
        'pacientes',
        'Pacientes em Observação',
        'Permanência máxima de 6 h, com alerta de fim de turno.',
        sobDemanda(() => import('@/pages/plantao/secoes/PacientesObservacao'), 'PacientesObservacao')
      ),
    ],
  },
  {
    slug: 'evolucao',
    label: 'Evolução Clínica',
    description: 'Gráfico de evolução, flowsheet e registro de sinais vitais.',
    icon: Activity,
    tools: [
      f(
        'evolucao',
        'Evolução Clínica',
        'Gráfico multi-conceito, flowsheet e sinais vitais.',
        sobDemanda(() => import('@/pages/plantao/secoes/EvolucaoTool'), 'EvolucaoTool')
      ),
    ],
  },
]

export function acharSecaoPlantao(slug: string) {
  return SECOES_PLANTAO.find((s) => s.slug === slug)
}

/** Seção de ferramenta única — a seção *é* a ferramenta, sem página intermediária. */
export function ehSecaoDireta(secao: SecaoPlantao) {
  return secao.tools.length === 1
}
