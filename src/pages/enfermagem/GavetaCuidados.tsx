// ─────────────────────────────────────────────────────────────────────────────
// Gaveta dos cuidados de enfermagem (protótipo enfP, P/index.html 8304–8487).
//
// O botão "Cuidados" do Pronto Socorro e da Internação da enfermagem abre o
// paciente aqui: o cabeçalho único (nome, local, alergia, cor da porta) e o
// PainelCuidados (SAE, aprazamento e checagem, sinais vitais e balanço,
// curativos, dispositivos e escalas), que é da frente dos cuidados.
// ─────────────────────────────────────────────────────────────────────────────
import type { CorRisco } from '@/domain/risco'
import { PainelCuidados } from '@/components/enfermagem/PainelCuidados'
import { Intercorrencias } from '@/components/prontuario/Intercorrencias'
import { CabecalhoPaciente } from '@/components/paciente/CabecalhoPaciente'
import { QuadroProcedimentos } from '@/components/paciente/ProcedimentosRealizados'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'

export type PacienteEmCuidado = {
  pacienteId: string
  episodioId?: string | null
  internacaoId?: string | null
  nome: string
  /** Leito, box ou "Pronto Socorro". */
  local: string
  setorId?: string | null
  contexto?: string | null
  desde?: string | null
  rotuloDesde?: string
  cor?: CorRisco | null
}

export function GavetaCuidados({ paciente, onFechar }: { paciente: PacienteEmCuidado | null; onFechar: () => void }) {
  const unidadeId = useUnidade().unidadeAtiva?.unidade_id
  return (
    <Gaveta aberta={!!paciente} onAbertaChange={(v) => { if (!v) onFechar() }}
      rotulo={paciente ? `Cuidados de ${paciente.nome}` : 'Cuidados de enfermagem'} className="max-w-[760px]">
      {paciente && (
        <>
          <GavetaCabeca sobre={`Cuidados de enfermagem · ${paciente.local}`} titulo={paciente.nome} />
          <div className="flex flex-col gap-4 px-[22px] py-5">
            <CabecalhoPaciente pacienteId={paciente.pacienteId} nome={paciente.nome} local={paciente.local} setorId={paciente.setorId}
              contexto={paciente.contexto} desde={paciente.desde} rotuloDesde={paciente.rotuloDesde} corClassificacao={paciente.cor}
              acuidade className="shadow-none" />
            {/* Fase 2, tarefa 4: enfermeiro e técnico também registram intercorrência (decisão do RT) */}
            <Intercorrencias pacienteId={paciente.pacienteId} episodioId={paciente.episodioId} internacaoId={paciente.internacaoId} />
            <PainelCuidados pacienteId={paciente.pacienteId} episodioId={paciente.episodioId} internacaoId={paciente.internacaoId} />
            {/* Fase 3, tarefa 3: no Pronto Socorro, o que a enfermagem faz vai para o BPA (internação vai na AIH) */}
            {unidadeId && !paciente.internacaoId && (
              <QuadroProcedimentos pacienteId={paciente.pacienteId} unidadeId={unidadeId} episodioId={paciente.episodioId} />
            )}
          </div>
        </>
      )}
    </Gaveta>
  )
}
