// ─────────────────────────────────────────────────────────────────────────────
// Internados sem laudo de AIH. A internação ativa (admitido ou internado) que
// não tem AIH solicitada nem aprovada aparece com o leito e o tempo desde a
// internação. Leitura só.
//
// • Gestor (revisão de perfis, item 17, M1): faixa de alerta, porque cobrar o
//   laudo do médico assistente e do NIR é com ele.
// • Médico regulador (MR3 = A, RT 24/11/2026): uma linha neutra. A cobrança é
//   do assistente e do NIR; a cor forte fica para o que o regulador decide.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Internado = {
  id: string; status: string; data_admissao: string; internado_em: string | null
  paciente: { nome: string; nome_social: string | null } | null
  leito: { identificador: string } | null
}

const tempo = (dias: number) => (dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`)

export function InternadosSemLaudo({ unidade, comAih, tom = 'alerta' }: {
  unidade: string
  /** Internações que já têm AIH solicitada ou aprovada. */
  comAih: Set<string>
  tom?: 'alerta' | 'neutro'
}) {
  const internados = useQuery({
    queryKey: ['internados-sem-laudo-aih', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('internacoes')
        .select('id, status, data_admissao, internado_em, paciente:pacientes!internacoes_paciente_id_fkey(nome, nome_social), leito:leitos!internacoes_leito_atual_id_fkey(identificador)')
        .eq('unidade_id', unidade).in('status', ['admitido', 'internado'])
      if (error) throw error
      const agora = Date.now()
      return ((data ?? []) as unknown as Internado[])
        .map((i) => ({ ...i, dias: Math.max(0, Math.floor((agora - new Date(i.internado_em ?? i.data_admissao).getTime()) / 86_400_000)) }))
    },
  })
  const sem = (internados.data ?? []).filter((i) => !comAih.has(i.id)).sort((a, b) => b.dias - a.dias)
  if (sem.length === 0) return null
  const titulo = sem.length === 1 ? '1 internado sem laudo de AIH' : `${sem.length} internados sem laudo de AIH`

  if (tom === 'neutro') {
    return (
      <section aria-label="Internados sem laudo de AIH" className="mb-4 flex flex-col gap-1 text-apoio text-tinta-apoio">
        <p>
          <span className="text-tinta">{titulo}</span>
          {': '}
          {sem.map((i, k) => (
            <span key={i.id}>
              {k > 0 && ' · '}
              {i.leito ? `leito ${i.leito.identificador}` : 'sem leito'}, <span className="tabular-nums">{tempo(i.dias)}</span>
            </span>
          ))}
          .
        </p>
        <p className="text-rotulo text-tinta-sussurro">O laudo é do médico assistente, e o NIR acompanha. Quando emitido, entra em Solicitadas.</p>
      </section>
    )
  }
  return (
    <section aria-label="Internados sem laudo de AIH" className={cn('mb-4 flex flex-col gap-2 rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-3 text-apoio')}>
      <span className="font-semibold text-critico">{titulo}</span>
      <ul className="flex flex-col gap-1">
        {sem.map((i) => (
          <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 text-tinta">
            <span className="font-medium">{i.paciente?.nome_social || i.paciente?.nome || 'Paciente'}</span>
            {i.leito && <span className="text-tinta-apoio">leito {i.leito.identificador}</span>}
            <span className="tabular-nums text-critico">{tempo(i.dias)}</span>
          </li>
        ))}
      </ul>
      <span className="text-rotulo text-tinta-apoio">Sem o laudo a internação não é faturada. Cobre o laudo do médico assistente e o NIR; quando emitido, entra em Solicitadas.</span>
    </section>
  )
}
