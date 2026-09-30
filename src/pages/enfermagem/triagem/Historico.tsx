import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { NIVEL_RISCO, type CorRisco } from '@/domain/risco'
import { textoVitais } from '@/domain/vitais'
import { ESCALAS_DOR, type EscalaDor } from '@/clinico/triagem/dor'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { quando } from './comum'

// Histórico de classificações do episódio (mais recente primeiro): quem
// classificou, fluxograma, discriminador, sinais vitais crus e, na
// reclassificação, o motivo. Reaproveitável na tela do médico.

type Linha = {
  id: string
  cor: CorRisco
  publico: string
  grupo_trocado: boolean
  fluxograma_nome: string | null
  discriminador: string | null
  discriminador_livre: boolean
  queixa: string | null
  reclassificacao: boolean
  motivo: string | null
  justificativa: string | null
  autor_nome: string | null
  autor_papel: string
  criado_em: string
  dor: { escala: EscalaDor; total: number } | null
  oxigenio: { modo: string; litros_min?: number } | null
  sinais: Record<string, number> | null
}

const PAPEL: Record<string, string> = { enfermeiro: 'Enfermagem', plantonista: 'Médico' }

export function HistoricoClassificacoes({ episodioId }: { episodioId: string }) {
  const hist = useQuery({
    queryKey: ['classificacoes-episodio', episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('classificacoes_do_episodio', { p_episodio: episodioId })
      if (error) throw error
      return (data ?? []) as unknown as Linha[]
    },
  })
  const lista = hist.data ?? []

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex items-center gap-2.5 border-b border-trilha px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
          <History className="size-4 text-acao" aria-hidden /> Histórico de classificações do episódio
        </h2>
        <span className="text-apoio text-tinta-sussurro">{lista.length} {lista.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      {hist.isLoading && <div className="px-5 py-3.5 text-apoio text-tinta-sussurro">Carregando…</div>}
      {hist.error && <div className="px-5 py-3.5 text-apoio text-critico">{(hist.error as Error).message}</div>}
      {!hist.isLoading && !hist.error && lista.length === 0 && (
        <div className="px-5 py-3.5 text-apoio text-tinta-sussurro">Nenhuma classificação registrada neste episódio.</div>
      )}
      {lista.map((c, i) => {
        const oxi = c.oxigenio ? (c.oxigenio.modo === 'ar_ambiente' ? 'SpO₂ em ar ambiente' : `SpO₂ com O₂${c.oxigenio.litros_min ? ` ${String(c.oxigenio.litros_min).replace('.', ',')} L/min` : ''}`) : ''
        const dor = c.dor ? `Dor pela ${ESCALAS_DOR[c.dor.escala]?.nome ?? c.dor.escala}: ${c.dor.total}` : ''
        return (
          <div key={c.id} className="flex flex-wrap items-start gap-3 border-b border-trilha px-5 py-3 last:border-b-0">
            <PilulaRisco cor={c.cor} />
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className="text-controle font-medium text-tinta">
                {NIVEL_RISCO[c.cor]} · {c.reclassificacao ? 'reclassificação' : i === lista.length - 1 ? 'classificação inicial' : 'classificação'}
              </span>
              <span className="text-apoio text-pretty text-tinta-sussurro">
                {[
                  `${c.autor_nome ?? 'Profissional'} (${PAPEL[c.autor_papel] ?? c.autor_papel})`,
                  quando(c.criado_em),
                  c.fluxograma_nome,
                  c.discriminador ? `${c.discriminador}${c.discriminador_livre ? ' (escrito pelo enfermeiro)' : ''}` : '',
                  c.grupo_trocado ? `grupo trocado à mão: ${c.publico === 'pediatrico' ? 'pediatria' : 'adulto'}` : '',
                ].filter(Boolean).join(' · ')}
              </span>
              {c.queixa && <span className="text-apoio text-pretty text-tinta-apoio">Queixa: {c.queixa}</span>}
              <span className="text-apoio text-pretty text-tinta-apoio">{[textoVitais(c.sinais), dor, oxi].filter(Boolean).join(' · ') || 'Sem sinais vitais'}</span>
              {(c.motivo || c.justificativa) && (
                <span className="text-apoio text-pretty text-grafite">
                  Motivo: {[c.motivo, c.justificativa && `baixou a prioridade: ${c.justificativa}`].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
