// ─────────────────────────────────────────────────────────────────────────────
// Painel "Cuidados" da enfermagem (porte do protótipo: enfP — PS da
// enfermagem e internação da enfermagem). O formato de entrada é fixo: o PS
// da enfermagem e a internação da enfermagem importam daqui.
//
// Abas: SAE (cinco etapas, COFEN 736/2024), aprazamento e checagem (a tela de
// Checagem que já existe), sinais vitais, anotação e evolução de enfermagem,
// dispositivos, balanço hídrico, curativos e escalas (Braden e Morse).
// Quem pode o quê vem do servidor (cuidados_enfermagem): a enfermagem de
// plantão com o paciente registra; a SAE e a evolução são do enfermeiro.
// ─────────────────────────────────────────────────────────────────────────────
import { ClipboardCheck } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { ehPediatrico } from '@/domain/idade'
import { cn } from '@/lib/utils'
import { usePacienteCurva } from '@/components/avaliacao/useAvaliacao'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { AbaSae } from './AbaSae'
import { AbaBalanco, AbaCurativos, AbaDispositivos } from './AbasLeito'
import { AbaAnotacao, AbaEscalas, AbaSinaisVitais } from './AbasRegistro'
import { hojeSP, msg, useCuidados } from './dadosCuidados'
import { Cartao, Nota } from './pecas'

export type PainelCuidadosProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

type Aba = 'sae' | 'apraz' | 'sv' | 'anot' | 'disp' | 'bh' | 'cur' | 'esc'

export function PainelCuidados({ pacienteId, episodioId, internacaoId }: PainelCuidadosProps) {
  const ctx = React.useMemo(() => ({ pacienteId, episodioId, internacaoId }), [pacienteId, episodioId, internacaoId])
  const q = useCuidados(ctx)
  const pac = usePacienteCurva(pacienteId)
  const [aba, setAba] = React.useState<Aba>('sae')

  if (q.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (q.error || !q.data) return <p role="alert" className="text-apoio text-critico">{q.error ? msg(q.error) : 'Sem dados.'}</p>
  const dados = q.data
  const nasc = pac.data?.data_nascimento ?? null
  const ped = nasc ? ehPediatrico(nasc, hojeSP()) : null
  const publico = ped === null ? null : ped ? 'pediatrico' : 'adulto'
  const emUso = dados.dispositivos.filter((d) => !d.retirado_em).length

  const abas: { id: Aba; rotulo: string; contagem?: number }[] = [
    { id: 'sae', rotulo: 'SAE' },
    { id: 'apraz', rotulo: 'Aprazamento e checagem' },
    { id: 'sv', rotulo: 'Sinais vitais' },
    { id: 'anot', rotulo: dados.pode_sae ? 'Evolução de enfermagem' : 'Anotação de enfermagem' },
    { id: 'disp', rotulo: 'Dispositivos', contagem: emUso || undefined },
    { id: 'bh', rotulo: 'Balanço hídrico' },
    { id: 'cur', rotulo: 'Curativos' },
    { id: 'esc', rotulo: 'Escalas' },
  ]

  return (
    <div className="flex flex-col gap-3.5">
      <div role="tablist" aria-label="Cuidados de enfermagem" className="flex flex-wrap gap-1.5">
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-capsula border px-[13px] py-[5px] text-apoio transition-colors',
              aba === a.id ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao',
            )}>
            {a.rotulo}
            {a.contagem !== undefined && <span className="tabular-nums opacity-80">{a.contagem}</span>}
          </button>
        ))}
      </div>
      {!dados.atendimento_aberto && (
        <Nota>Sem atendimento ou internação em aberto para este paciente: os cuidados ficam só para leitura.</Nota>
      )}

      <div role="tabpanel" aria-label={abas.find((a) => a.id === aba)?.rotulo}>
        {aba === 'sae' && <AbaSae ctx={ctx} dados={dados} />}
        {aba === 'apraz' && (
          <Cartao titulo="Aprazamento e checagem">
            <Nota>
              O aprazamento dos itens da prescrição médica é do enfermeiro; a checagem é por horário (feito, não feito ou recusado, com motivo).
              Os dois ficam na tela de Checagem, com todos os pacientes do seu plantão.
            </Nota>
            <div>
              <Link to="/checagem" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <ClipboardCheck /> Abrir a Checagem
              </Link>
            </div>
          </Cartao>
        )}
        {aba === 'sv' && <AbaSinaisVitais ctx={ctx} dados={dados} publico={publico} />}
        {aba === 'anot' && <AbaAnotacao ctx={ctx} dados={dados} />}
        {aba === 'disp' && <AbaDispositivos ctx={ctx} dados={dados} />}
        {aba === 'bh' && <AbaBalanco ctx={ctx} dados={dados} />}
        {aba === 'cur' && <AbaCurativos ctx={ctx} dados={dados} />}
        {aba === 'esc' && <AbaEscalas ctx={ctx} dados={dados} publico={publico} />}
      </div>
    </div>
  )
}
