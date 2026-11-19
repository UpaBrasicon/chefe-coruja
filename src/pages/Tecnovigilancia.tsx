import { Flag } from 'lucide-react'

import { FilaTecnovigilancia, RelatosDaUnidade } from '@/components/clinico/FilaTecnovigilancia'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useMeuPapelTecnico } from '@/hooks/useFerramentaClinica'

/**
 * Tecnovigilância (LG12) numa aba própria, fora da Revisão Clínica
 * (pedido do RT em 19/11/2026). O responsável técnico médico tem a fila com
 * andamento, conclusão e suspensão da versão na rede; o gestor vê só os
 * relatos da unidade. O banco confere o papel em cada RPC.
 */
export default function Tecnovigilancia() {
  const { data: papeis, isLoading } = useMeuPapelTecnico()
  const { papeisDaUnidade, unidadeAtiva } = useUnidade()
  const rt = papeis?.some((p) => p.tipo === 'medico') ?? false
  const ehGestor = papeisDaUnidade.includes('gestor')

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!rt && !ehGestor) {
    return (
      <p className="text-corpo text-tinta-sussurro">
        A tecnovigilância é do responsável técnico médico nomeado pela rede; o gestor vê os relatos da unidade. Seu perfil não tem essa nomeação.
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col gap-[22px]">
      <TituloPagina icone={Flag} titulo="Tecnovigilância"
        descricao={rt
          ? 'Relatos de problema no módulo clínico. Prazo da RDC 67/2009, art. 8º: óbito, 72 h; dano permanente ou internação, 10 dias; os outros, 30 dias.'
          : 'Relatos de problema no módulo clínico enviados da sua unidade, só para leitura.'} />
      {rt && <FilaTecnovigilancia />}
      {ehGestor && unidadeAtiva && <RelatosDaUnidade unidadeId={unidadeAtiva.unidade_id} />}
    </div>
  )
}
