// Resumo do envio da UBS dentro da ficha da UPA (teste de fluxo UBS → UPA,
// 25/11/2026): o que o médico da UBS mandou (motivo, escuta, sinais, SOAP)
// aparecia só no painel da recepção. O enfermeiro da triagem e o médico da UPA
// passam a ver o mesmo resumo na ficha que a chegada ligou ao envio. Lê a
// mesma RPC do painel (encaminhamentos_upa_destino), que já atende enfermeiro,
// técnico, médico, recepção e gestor da unidade de destino.
import { useQuery } from '@tanstack/react-query'
import { Ambulance } from 'lucide-react'

import { envioDaFicha, type EnvioUpa } from '@/domain/encaminhamento'
import { textoVitais } from '@/domain/vitais'
import { hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function ResumoDaUbs({ unidadeId, episodioId }: { unidadeId: string | null | undefined; episodioId: string }) {
  const lista = useQuery({
    queryKey: ['encaminhamentos-upa', 'destino', unidadeId],
    enabled: !!unidadeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('encaminhamentos_upa_destino', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as EnvioUpa[]
    },
  })
  const e = envioDaFicha(lista.data ?? [], episodioId)
  // sem o resumo clínico (quem não é da enfermagem nem médico), nada a mostrar
  if (!e || e.resumo_clinico === false || !e.motivo) return null
  const r = e.resumo
  const sinais = textoVitais(r.sinais)
  return (
    <section aria-label="Vindo da UBS" className="flex flex-col gap-1 rounded-controle border border-atencao/30 bg-alerta-atencao/40 px-3.5 py-2.5">
      <span className="flex items-center gap-2 text-controle font-semibold text-tinta">
        <Ambulance className="size-4 shrink-0 text-atencao" aria-hidden /> Vindo da {e.unidade_origem} · envio nº {e.numero}
      </span>
      <span className="text-apoio text-pretty text-tinta"><strong className="font-semibold">Motivo do envio:</strong> {e.motivo}</span>
      {r.queixa && <span className="text-apoio text-pretty text-tinta-apoio">Queixa na UBS: {r.queixa}</span>}
      {r.cor_escuta && <span className="text-apoio text-tinta-apoio">Escuta inicial da enfermagem da UBS (CAB 28): {r.cor_escuta}</span>}
      {sinais && <span className="text-apoio text-pretty text-tinta-apoio">Sinais vitais na UBS{r.sinais_em ? ` às ${hora(r.sinais_em)}` : ''}: {sinais}</span>}
      {r.soap && (
        <div className="flex flex-col gap-0.5 text-apoio text-pretty text-tinta-apoio">
          {r.soap.subjetivo && <span><strong className="font-semibold text-tinta">S</strong> {r.soap.subjetivo}</span>}
          {r.soap.objetivo && <span><strong className="font-semibold text-tinta">O</strong> {r.soap.objetivo}</span>}
          {r.soap.avaliacao && <span><strong className="font-semibold text-tinta">A</strong> {r.soap.avaliacao}{r.soap.cid ? ` · CID ${r.soap.cid}` : ''}</span>}
          {r.soap.plano && <span><strong className="font-semibold text-tinta">P</strong> {r.soap.plano}</span>}
        </div>
      )}
      <span className="text-rotulo text-tinta-sussurro">
        Enviado às {hora(e.enviado_em)}{e.enviado_por ? ` por ${e.enviado_por}` : ''}{e.chegada_em ? ` · chegada às ${hora(e.chegada_em)}` : ''}. Registro da UBS; confira com o paciente.
      </span>
    </section>
  )
}
