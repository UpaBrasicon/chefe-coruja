// Aba Prescrição da internação (Fase 4.4): a prescrição estruturada do banco.
// O catálogo antigo, com doses escritas no código, saiu (decisão de 27/09/2026).
// Folha do RT (24/11/2026): a dieta na linha 01 e o painel do paciente à direita.
import { PrescricaoEstruturada, type DietaFolha } from '@/components/prescricao/PrescricaoEstruturada'
import type { ContextoPacienteFolha } from '@/components/prescricao/PainelPacienteFolha'
import type { DadosPaciente } from '@/lib/rascunhoInternacao'

export function PrescricaoTab({ dados, pacienteId, dieta, contexto }: {
  dados: DadosPaciente; pacienteId?: string | null; dieta?: DietaFolha; contexto?: ContextoPacienteFolha
}) {
  if (!pacienteId) {
    return <p className="text-apoio text-tinta-sussurro">Identifique o paciente em Dados do Paciente para prescrever.</p>
  }
  return (
    <PrescricaoEstruturada
      pacienteId={pacienteId}
      paciente={{ nome: dados.nome, dataAtual: dados.dataAtual, leito: dados.leito, diagnostico: dados.diagnostico }}
      dieta={dieta}
      contexto={contexto}
    />
  )
}
