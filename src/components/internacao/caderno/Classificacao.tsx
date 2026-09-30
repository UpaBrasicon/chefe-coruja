// Aba Classificação do leito (protótipo, index.html 3120–3142): a
// classificação de risco da porta que originou a internação, a vigente no
// topo e o histórico (quem classificou, vitais crus, motivo da reclassificação).
// Lida por classificacoes_do_leito: no leito vale quem pode atuar no paciente,
// não o setor da porta.
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { NIVEL_RISCO, textoAlvo, type CorRisco } from '@/domain/risco'
import { textoVitais } from '@/domain/vitais'
import { ESCALAS_DOR, type EscalaDor } from '@/clinico/triagem/dor'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Spinner } from '@/components/ui/spinner'

import { diaHora } from './comum'

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

export function AbaClassificacao({ internacaoId, prontuarioAberto }: { internacaoId: string; prontuarioAberto: boolean }) {
  const hist = useQuery({
    queryKey: ['classificacoes-leito', internacaoId],
    enabled: prontuarioAberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('classificacoes_do_leito', { p_internacao: internacaoId })
      if (error) throw error
      return (data ?? []) as unknown as Linha[]
    },
  })
  if (!prontuarioAberto || hist.isLoading) return <Spinner />
  if (hist.error) return <p className="text-apoio text-critico">{(hist.error as Error).message}</p>
  const lista = hist.data ?? []
  const atual = lista[0]

  return (
    <section className="overflow-hidden rounded-[14px] border border-fio bg-superficie">
      {atual ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-trilha px-4 py-3.5">
          <PilulaRisco cor={atual.cor} />
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
            <span className="text-corpo font-semibold text-tinta">{NIVEL_RISCO[atual.cor]} · classificação vigente da porta</span>
            <span className="text-apoio text-pretty text-tinta-sussurro">
              Alvo de atendimento: {textoAlvo(atual.cor)} · {lista.length === 1 ? 'sem reclassificação' : `${lista.length - 1} reclassificação(ões)`}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3.5 text-apoio text-tinta-sussurro">
          <Activity className="size-3.5" aria-hidden /> Sem classificação de risco registrada para este paciente.
        </div>
      )}
      {lista.map((c, i) => {
        const oxi = c.oxigenio ? (c.oxigenio.modo === 'ar_ambiente' ? 'SpO₂ em ar ambiente' : `SpO₂ com O₂${c.oxigenio.litros_min ? ` ${String(c.oxigenio.litros_min).replace('.', ',')} L/min` : ''}`) : ''
        const dor = c.dor ? `Dor pela ${ESCALAS_DOR[c.dor.escala]?.nome ?? c.dor.escala}: ${c.dor.total}` : ''
        return (
          <div key={c.id} className="flex flex-wrap items-start gap-3 border-b border-trilha px-4 py-3 last:border-b-0">
            <PilulaRisco cor={c.cor} />
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
              <span className="text-controle font-medium text-tinta">
                {NIVEL_RISCO[c.cor]} · {c.reclassificacao ? 'reclassificação' : i === lista.length - 1 ? 'classificação inicial' : 'classificação'}
              </span>
              <span className="text-apoio text-pretty text-tinta-sussurro">
                {[
                  `${c.autor_nome ?? 'Profissional'} (${PAPEL[c.autor_papel] ?? c.autor_papel})`,
                  diaHora(c.criado_em),
                  c.fluxograma_nome,
                  c.discriminador ? `${c.discriminador}${c.discriminador_livre ? ' (escrito pelo enfermeiro)' : ''}` : '',
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
