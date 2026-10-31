// Aba Encaminhamento do leito (ponto 13 do plantonista, RT 31/10/2026): duas
// opções — "Dentro da unidade" (encaminhar_interno, a de antes) e "Para outra
// unidade" (o formulário SMS003a da porta, com o paciente fixo e ligado à
// internação). Transferir o internado é regulação; a opção de fora lembra isso.
import { ArrowRightLeft, ArrowUpRight } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { AbaEncaminhamentoInterno } from './AbaEncaminhamentoInterno'
import { Encaminhamento } from './EncaminhamentoSms003a'

type Opcao = 'dentro' | 'fora'

const OPCOES: { id: Opcao; rotulo: string; Icone: typeof ArrowUpRight }[] = [
  { id: 'dentro', rotulo: 'Dentro da unidade', Icone: ArrowRightLeft },
  { id: 'fora', rotulo: 'Para outra unidade', Icone: ArrowUpRight },
]

export function AbaEncaminhamento({ pacienteId, episodioId, internacaoId, leito }: {
  pacienteId: string
  episodioId?: string | null
  internacaoId?: string | null
  leito?: string
}) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const [opcao, setOpcao] = React.useState<Opcao>('dentro')
  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Encaminhamento" className="mb-3.5 flex flex-wrap gap-1.5">
        {OPCOES.map(({ id, rotulo, Icone }) => (
          // a mesma subaba da Evolução: o Button no papel de aba
          <Button key={id} role="tab" aria-selected={opcao === id} onClick={() => setOpcao(id)}
            variant={opcao === id ? 'default' : 'outline'}
            className={cn('min-h-10 px-3.5 py-2 text-controle', opcao === id && 'border-acao')}>
            <Icone className="size-[15px]" aria-hidden /> {rotulo}
          </Button>
        ))}
      </div>
      <div role="tabpanel">
        {opcao === 'dentro'
          ? <AbaEncaminhamentoInterno pacienteId={pacienteId} episodioId={episodioId} internacaoId={internacaoId} />
          : <Encaminhamento unidadeId={unidadeAtiva?.unidade_id} perfilId={perfil?.id} pacienteFixo={pacienteId} leito={leito} />}
      </div>
    </div>
  )
}
