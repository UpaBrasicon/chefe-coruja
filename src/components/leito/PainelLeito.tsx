// ─────────────────────────────────────────────────────────────────────────────
// Painel do leito (revisão do gestor, RT 24/11/2026): clicar no leito do mapa
// ou na lista de internados não sai mais da Internação. Abre uma gaveta à
// direita (tela cheia no celular) com o caderno do leito em leitura — o mesmo
// LeitoAberto da lista, com ehGestor, que só lê e registra a consulta ao
// prontuário — e, para o leito sem paciente, a situação do leito com as
// mesmas ações da Unidade › Setores. Fecha no X, com Esc ou no voltar do
// navegador (a página guarda o leito aberto em ?leito=).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { StatusLeito } from '@/types/database'
import { LeitoAberto } from '@/components/internacao/LeitoAberto'
import { AcoesLeito } from '@/components/leito/AcoesLeito'
import { ROTULO_STATUS_LEITO, type LeitoDoMapa } from '@/components/leito/mapaDados'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'

export type AlvoPainelLeito = {
  /** o leito no mapa; sem ele, paciente ainda sem leito */
  leito: LeitoDoMapa | null
  setorNome: string | null
  /** setor lido pelo status do leito (a RPC do mapa não traz o paciente) */
  peloStatus?: boolean
  paciente: { id: string; nome: string | null } | null
}

export function PainelLeito({ alvo, unidadeId, abaInicial, aoFechar }: {
  alvo: AlvoPainelLeito | null
  unidadeId: string | undefined
  abaInicial?: string
  aoFechar: () => void
}) {
  // na animação de saída, a gaveta segue mostrando o que tinha
  const [ultimo, setUltimo] = React.useState<AlvoPainelLeito | null>(alvo)
  if (alvo && alvo !== ultimo) setUltimo(alvo)
  const a = alvo ?? ultimo

  const pacienteId = a?.paciente?.id
  const semNome = !!pacienteId && !a?.paciente?.nome
  const nome = useQuery({
    queryKey: ['painel-leito-nome', pacienteId],
    enabled: semNome,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome').eq('id', pacienteId!).maybeSingle()
      if (error) throw error
      return data?.nome ?? null
    },
  })
  const pacienteNome = a?.paciente?.nome ?? nome.data ?? 'Paciente'

  const l = a?.leito
  const situacao = l ? (l.aguardando_corpo ? 'aguardando liberação do corpo' : ROTULO_STATUS_LEITO[l.status] ?? l.status) : 'sem leito'
  const detalhe = [a?.setorNome, l && `leito ${situacao}`, l?.vencidas ? `${l.vencidas} ${l.vencidas === 1 ? 'pendência vencida' : 'pendências vencidas'}` : '', (l?.banda ?? 0) >= 1 ? 'escore em alerta' : '']
    .filter(Boolean).join(' · ')

  return (
    <Gaveta aberta={!!alvo} onAbertaChange={(v) => { if (!v) aoFechar() }}
      rotulo={l ? `Leito ${l.identificador}` : `Leito de ${pacienteNome}`}
      className={cn(pacienteId ? 'max-w-[1040px]' : 'max-w-[460px]')}>
      {a && (
        <>
          <GavetaCabeca sobre={a.setorNome ?? 'Internação'} titulo={l ? `Leito ${l.identificador}` : pacienteNome} detalhe={detalhe} />
          <div className="flex flex-1 flex-col gap-4 px-[22px] py-4">
            {pacienteId ? (
              <>
                <LeitoAberto key={pacienteId} modo="caderno" pacienteId={pacienteId} pacienteNome={pacienteNome} ehGestor abaInicial={abaInicial} />
                <div>
                  <Button size="sm" variant="outline" render={<Link to={`/prontuarios/${pacienteId}`} />}>
                    <ExternalLink /> Abrir o prontuário completo
                  </Button>
                </div>
              </>
            ) : l ? (
              <LeitoSemPaciente key={l.id} l={l} situacao={situacao} peloStatus={!!a.peloStatus} unidadeId={unidadeId} />
            ) : null}
          </div>
          <GavetaPe>
            {pacienteId
              ? 'O gestor lê o caderno do leito; abrir registra a consulta ao prontuário. Feche no X, com Esc ou no voltar do navegador.'
              : 'Feche no X, com Esc ou no voltar do navegador.'}
          </GavetaPe>
        </>
      )}
    </Gaveta>
  )
}

/** Leito sem paciente: a situação e as ações do leito, como na Unidade › Setores. */
function LeitoSemPaciente({ l, situacao, peloStatus, unidadeId }: { l: LeitoDoMapa; situacao: string; peloStatus: boolean; unidadeId: string | undefined }) {
  const [erro, setErro] = React.useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3 text-apoio">
      <p className="text-tinta-apoio">
        {l.ocupado
          ? peloStatus
            ? 'Leito ocupado pelo status do cadastro. Este setor não registra o paciente no leito, então não há caderno para abrir.'
            : 'Leito ocupado sem paciente vinculado.'
          : `Leito ${situacao}, sem paciente.`}
      </p>
      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-critico">{erro}</p>}
      {!l.ocupado && (
        <div className="flex flex-wrap gap-2">
          {/* status só pelas RPCs (o banco confere papel e transição) */}
          <AcoesLeito leitoId={l.id} identificador={l.identificador} status={l.status as StatusLeito}
            podeHigienizar podeBloquear podeReservar podeCancelarReserva unidadeId={unidadeId}
            invalidar={[['leitos'], ['situacao-leitos'], ['mapa-leitos-gestor'], ['mapa-leitos-outros-setores'], ['censo']]}
            onErro={setErro} />
        </div>
      )}
    </div>
  )
}
