// Tela "Sinais vitais" da UBS (percurso da UBS, U7, PR 4): o técnico de
// enfermagem e o enfermeiro veem as fichas abertas dos consultórios do plantão
// e registram os sinais vitais de cada paciente (P4 = A).
import { useQuery } from '@tanstack/react-query'
import { HeartPulse } from 'lucide-react'
import * as React from 'react'

import { ProcedimentosAps } from '@/components/clinico/ProcedimentosAps'
import { SinaisVitaisAps } from '@/components/clinico/SinaisVitaisAps'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { formatarDuracao } from '@/domain/plantao'
import { hora } from '@/lib/formato'
import { setoresNaEscalaAgora } from '@/lib/rpcCasca'
import { supabase } from '@/lib/supabase'

type Ficha = {
  id: string; chegada_em: string; queixa: string | null; etapa: string
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

export default function SinaisVitaisUbs() {
  const { unidadeAtiva } = useUnidade()
  const [aberta, setAberta] = React.useState<string | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 30_000); return () => window.clearInterval(t) }, [])

  const fichas = useQuery({
    queryKey: ['sinais-vitais-ubs', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 30_000,
    queryFn: async () => {
      const s = await setoresNaEscalaAgora()
      if (s.error) throw s.error
      const setores = (Array.isArray(s.data) ? s.data : []) as string[]
      if (setores.length === 0) return null
      const { data, error } = await supabase
        .from('episodios')
        .select('id, chegada_em, queixa, etapa, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', setores)
        .in('etapa', ['triagem', 'atendimento'])
        .not('tipo_atendimento_aps', 'is', null)
        .order('chegada_em')
      if (error) throw error
      return (data ?? []) as unknown as Ficha[]
    },
  })

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <TituloPagina icone={HeartPulse} titulo="Sinais vitais"
        descricao="Fichas abertas dos consultórios do seu plantão: sinais vitais e procedimentos. O que é registrado aqui entra no prontuário, no hiperdia e no pré-natal." />
      {fichas.isLoading && <Spinner />}
      {fichas.error && <p role="alert" className="text-apoio text-critico">{(fichas.error as Error).message}</p>}
      {fichas.data === null && <Vazio icone={HeartPulse} titulo="Sem plantão agora" texto="Você não está na escala de nenhum consultório agora." />}
      {fichas.data && fichas.data.length === 0 && <Vazio icone={HeartPulse} titulo="Nenhuma ficha aberta" texto="Nenhuma ficha aberta nos consultórios do seu plantão." />}
      {fichas.data && fichas.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {fichas.data.map((f) => {
            const nome = f.paciente?.nome_social || f.paciente?.nome || 'Paciente'
            const espera = formatarDuracao((agora - Date.parse(f.chegada_em)) / 60_000)
            return (
              <li key={f.id} className="flex flex-col gap-2">
                <BotaoLinha aria-expanded={aberta === f.id} onClick={() => setAberta((x) => (x === f.id ? null : f.id))} className="w-full">
                  <span className="flex w-full flex-wrap items-baseline gap-x-2">
                    <strong className="text-controle text-tinta">{nome}</strong>
                    <span className="text-apoio text-tinta-sussurro">
                      {f.paciente?.data_nascimento ? `${rotuloIdade(f.paciente.data_nascimento, f.chegada_em)} · ` : ''}chegou {hora(f.chegada_em)} · {espera}
                      {f.etapa === 'triagem' ? ' · aguarda a escuta' : ''}
                    </span>
                  </span>
                  {f.queixa && <span className="text-apoio text-tinta-apoio">{f.queixa}</span>}
                </BotaoLinha>
                {aberta === f.id && (
                  <>
                    <SinaisVitaisAps episodioId={f.id} nascimento={f.paciente?.data_nascimento ?? null} chegadaEm={f.chegada_em} />
                    {/* U7, PR 5: curativo, medicação e glicemia do técnico (P4 = A) */}
                    <ProcedimentosAps episodioId={f.id} />
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
