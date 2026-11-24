// ─────────────────────────────────────────────────────────────────────────────
// Gaveta dos cuidados de enfermagem (protótipo enfP, P/index.html 8304–8487).
//
// O botão "Cuidados" do Pronto Socorro e da Internação da enfermagem, e o
// paciente de um item da Checagem, abrem o paciente aqui. Revisão do perfil
// Enfermeiro (RT 24/11/2026): CU3, o cabeçalho com o nome uma vez só e, na
// mesma linha, as fichas de alergia, isolamento e a cor da classificação (que
// é da enfermagem); CU2, contenção e intercorrência num menu de ações do
// cabeçalho; o PainelCuidados abre em "Agora" (CU1), com a checagem do
// paciente dentro da gaveta (CK0).
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown, Siren } from 'lucide-react'
import * as React from 'react'

import type { CorRisco } from '@/domain/risco'
import { PainelCuidados } from '@/components/enfermagem/PainelCuidados'
import { useCuidados } from '@/components/enfermagem/dadosCuidados'
import { usePacienteCurva } from '@/components/avaliacao/useAvaliacao'
import { BotaoIniciarContencao } from '@/components/prontuario/Contencao'
import { DialogoIntercorrencia } from '@/components/prontuario/Intercorrencias'
import { SeloClassificacao } from '@/components/paciente/CabecalhoPaciente'
import { GavetaAlergias, SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { GavetaIsolamento, SeloIsolamento } from '@/components/paciente/Isolamento'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'

import { duracao, idadeDe, useAgora } from './useEnfermagem'

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

// Fase 2, tarefa 4: enfermeiro e técnico também registram intercorrência (decisão do RT)
const REGISTRA_INTERCORRENCIA = ['enfermeiro', 'tecnico_enfermagem']
const ITEM_MENU = 'flex w-full items-center gap-2 px-3 py-2 text-left text-apoio text-tinta hover:bg-campo'

/** Menu de ações do cabeçalho. Os itens ficam montados (só escondidos), porque cada um guarda a sua janela. */
function MenuAcoes({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="outline" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        Ações <ChevronDown aria-hidden />
      </Button>
      {/* padrao-ok: menu simples; o app não tem componente de menu suspenso */}
      <div role="menu" hidden={!aberto} onClick={() => setAberto(false)}
        className="absolute top-full right-0 z-10 mt-1 flex min-w-[240px] flex-col rounded-container border border-fio bg-superficie py-1 shadow-popover">
        {children}
      </div>
    </div>
  )
}

function Cabecalho({ paciente }: { paciente: PacienteEmCuidado }) {
  const { papelAtivo } = useUnidade()
  const agora = useAgora(60_000)
  const [alergias, setAlergias] = React.useState(false)
  const [isolamento, setIsolamento] = React.useState(false)
  const [intercorrencia, setIntercorrencia] = React.useState(false)
  // o atendimento do paciente, resolvido no servidor quando a gaveta abre pela Checagem
  const q = useCuidados({ pacienteId: paciente.pacienteId, episodioId: paciente.episodioId, internacaoId: paciente.internacaoId })
  const episodioId = paciente.episodioId ?? q.data?.episodio_id ?? null
  const internacaoId = paciente.internacaoId ?? q.data?.internacao_id ?? null
  const podeIntercorrencia = !!papelAtivo && REGISTRA_INTERCORRENCIA.includes(papelAtivo) && (!!episodioId || !!internacaoId)
  const idade = idadeDe(usePacienteCurva(paciente.pacienteId).data?.data_nascimento)
  const detalhe = [idade, paciente.local, paciente.contexto, paciente.desde ? `${paciente.rotuloDesde ?? 'há'} ${duracao(paciente.desde, agora)}` : '']
    .filter(Boolean).join(' · ')

  return (
    <>
      <GavetaCabeca sobre="Cuidados de enfermagem" titulo={paciente.nome} detalhe={detalhe} />
      <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-[22px] py-3">
        <SeloAlergia pacienteId={paciente.pacienteId} onClick={() => setAlergias(true)} />
        <SeloIsolamento pacienteId={paciente.pacienteId} onClick={() => setIsolamento(true)} />
        {paciente.cor && <SeloClassificacao cor={paciente.cor} />}
        <div className="ml-auto">
          <MenuAcoes>
            <BotaoIniciarContencao pacienteId={paciente.pacienteId} className={ITEM_MENU} />
            {podeIntercorrencia && (
              <button type="button" role="menuitem" className={ITEM_MENU} onClick={() => setIntercorrencia(true)}>
                <Siren className="size-4" aria-hidden /> Registrar intercorrência
              </button>
            )}
          </MenuAcoes>
        </div>
      </div>
      <GavetaAlergias pacienteId={paciente.pacienteId} nome={paciente.nome} aberta={alergias} onAbertaChange={setAlergias} />
      <GavetaIsolamento pacienteId={paciente.pacienteId} nome={paciente.nome} aberta={isolamento} onAbertaChange={setIsolamento} />
      {intercorrencia && (
        <DialogoIntercorrencia pacienteId={paciente.pacienteId} episodioId={episodioId} internacaoId={internacaoId}
          retifica={null} aoFechar={() => setIntercorrencia(false)} />
      )}
    </>
  )
}

export function GavetaCuidados({ paciente, onFechar }: { paciente: PacienteEmCuidado | null; onFechar: () => void }) {
  return (
    <Gaveta aberta={!!paciente} onAbertaChange={(v) => { if (!v) onFechar() }}
      rotulo={paciente ? `Cuidados de ${paciente.nome}` : 'Cuidados de enfermagem'} className="max-w-[760px]">
      {paciente && (
        <>
          <Cabecalho paciente={paciente} />
          <div className="px-[22px] py-4">
            <PainelCuidados pacienteId={paciente.pacienteId} episodioId={paciente.episodioId} internacaoId={paciente.internacaoId} />
          </div>
        </>
      )}
    </Gaveta>
  )
}
