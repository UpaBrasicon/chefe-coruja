// Aba Prescrição da internação (Fase 4.4): a prescrição estruturada do banco.
// O catálogo antigo, com doses escritas no código, saiu (decisão de 27/09/2026).
import { PrescricaoEstruturada } from '@/components/prescricao/PrescricaoEstruturada'
import type { DadosPaciente } from './rascunho'

export function PrescricaoTab({ dados, pacienteId }: { dados: DadosPaciente; pacienteId?: string | null }) {
  if (!pacienteId) {
    return <p className="text-sm text-tinta-sussurro">Identifique o paciente em Dados do Paciente para prescrever.</p>
  }
  return (
    <PrescricaoEstruturada
      pacienteId={pacienteId}
      paciente={{ nome: dados.nome, dataAtual: dados.dataAtual, leito: dados.leito, diagnostico: dados.diagnostico }}
    />
  )
}
