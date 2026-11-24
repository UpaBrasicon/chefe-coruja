// ─────────────────────────────────────────────────────────────────────────────
// Minha agenda › Minha escala (revisão de tela do RT, 24/11/2026, M1): a linha
// "Próximo plantão" no topo, com o caminho para o Plantão e o check-in, e os
// plantões dos próximos 7 dias em todas as unidades. Lê escala_plantao pela
// RLS da própria pessoa (a mesma leitura da aba Todas as unidades).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { dataIso, diaMes, hora, semanaCurta } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

type Linha = {
  id: string; data: string; inicio: string; duracao_min: number; unidade_id: string
  setores: { nome: string } | null; unidades: { nome: string } | null
}

const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "19h", "07h", "13:30" */
const hh = (v: number | string) => hora(v).replace(':00', 'h')

function quando(inicio: number, hoje: string) {
  const d = dataIso(inicio)
  if (d === hoje) return 'hoje'
  if (d === somaDias(hoje, 1)) return 'amanhã'
  return `${semanaCurta(inicio)} ${diaMes(inicio)}`
}

export function ProximosPlantoes({ perfilId, unidadeId }: { perfilId: string | undefined; unidadeId: string | undefined }) {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const hoje = dataIso(agora)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['meus-proximos-plantoes', perfilId, hoje],
    enabled: !!perfilId,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      // desde ontem: a noite que começou ontem ainda pode estar em curso
      const { data, error } = await supabase
        .from('escala_plantao')
        .select('id, data, inicio, duracao_min, unidade_id, setores(nome), unidades(nome)')
        .eq('perfil_id', perfilId!)
        .eq('ativo', true)
        .gte('data', somaDias(hoje, -1))
        .lte('data', somaDias(hoje, 7))
        .order('inicio', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Linha[]
    },
  })

  const proximos = (data ?? [])
    .map((p) => ({ ...p, ini: Date.parse(p.inicio), fim: Date.parse(p.inicio) + p.duracao_min * 60_000 }))
    .filter((p) => p.fim > agora)
  const primeiro = proximos[0]
  const emCurso = !!primeiro && primeiro.ini <= agora
  // o check-in abre perto do início; antes disso, o caminho é o Plantão
  const pertoDoInicio = !!primeiro && primeiro.ini - agora <= 2 * 3_600_000
  const setor = (p: Linha) => [p.setores?.nome, p.unidade_id !== unidadeId ? p.unidades?.nome : null].filter(Boolean).join(' · ')

  return (
    <section aria-label="Próximos plantões" className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <CalendarClock className="size-4 text-tinta-sussurro" aria-hidden />
        {isLoading ? (
          <Spinner rotulo="Lendo a escala" />
        ) : isError ? (
          <span className="text-apoio text-tinta-sussurro">Não foi possível ler a escala agora. A tela tenta de novo em alguns minutos.</span>
        ) : !primeiro ? (
          <span className="text-apoio text-tinta-apoio">Nenhum plantão nos próximos 7 dias.</span>
        ) : (
          <>
            <span className="text-corpo text-tinta">
              <span className="font-semibold">{emCurso ? 'Plantão agora' : 'Próximo plantão'}:</span>{' '}
              <span className="tabular">{emCurso ? '' : `${quando(primeiro.ini, hoje)} `}{hh(primeiro.ini)}–{hh(primeiro.fim)}</span>
              {setor(primeiro) && <span className="text-tinta-apoio"> · {setor(primeiro)}</span>}
            </span>
            <Link to={pertoDoInicio ? '/plantao/check-in' : '/plantao'} className="ml-auto text-apoio font-medium text-acao hover:underline">
              {pertoDoInicio ? 'Ir ao check-in' : 'Abrir Plantão'}
            </Link>
          </>
        )}
      </div>
      {proximos.length > 1 && (
        <ul aria-label="Plantões dos próximos 7 dias" className="flex flex-col border-t border-trilha pt-2">
          {proximos.slice(1).map((p) => (
            <li key={p.id} className={cn('flex flex-wrap items-baseline gap-x-3 py-1 text-apoio')}>
              <span className="w-24 shrink-0 text-tinta-apoio">{quando(p.ini, hoje)}</span>
              <span className="w-24 shrink-0 tabular text-tinta">{hh(p.ini)}–{hh(p.fim)}</span>
              <span className="min-w-0 text-tinta-apoio">{setor(p)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
