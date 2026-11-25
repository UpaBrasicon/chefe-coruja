// Aba "Mais" do leito como "Documentos e pedidos" (MA1, revisão da Internação
// aprovada pelo RT em 24/11/2026): grupos Pedidos, Termos e Avaliações, cada
// item com a situação ao lado. As leituras são as mesmas das peças (cache comum
// quando a chave é a mesma); a situação é só para orientar.
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { GRUPOS_MAIS, situacoesMais, type ItemMais } from '@/lib/maisLeito'
import { useDocumentosEpisodio } from '@/components/documento/documentos'
import { cadastroFaltaAih, useIdentificacao } from '@/components/documentos/identificacao'
import { useEncaminhamentos } from '@/components/encaminhamento/useEncaminhamentos'
import { BotaoLinha } from '@/components/ui/botao-linha'

export function MaisDocumentos({ pacienteId, internacaoId, pediatrico, onAbrir }: {
  pacienteId: string; internacaoId: string; pediatrico: boolean | null; onAbrir: (id: ItemMais) => void
}) {
  const docs = useDocumentosEpisodio(pacienteId)
  const ident = useIdentificacao(pacienteId)
  const enc = useEncaminhamentos(pacienteId)
  const pareceres = useQuery({
    queryKey: ['mais-pareceres-abertos', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pareceres_do_paciente', { p_paciente: pacienteId }).in('status', ['solicitado', 'em_analise'])
      if (error) throw error
      return (data ?? []).length
    },
  })
  const apacs = useQuery({
    queryKey: ['apacs-do-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('apacs_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as { status: string }[]
    },
  })
  const sit = situacoesMais({
    internacaoId,
    documentos: docs.data ?? [],
    cadastroFaltaAih: ident.pac ? cadastroFaltaAih(ident.pac) : [],
    pareceresAbertos: pareceres.data ?? 0,
    encaminhamentoPendente: (enc.data ?? []).some((e) => e.estado === 'pendente'),
    apacs: apacs.data ?? [],
    pediatrico,
  })
  return (
    <div className="flex flex-col gap-4">
      {GRUPOS_MAIS.map((g) => (
        <section key={g.titulo} aria-label={g.titulo} className="flex flex-col overflow-hidden rounded-container border border-fio bg-superficie">
          <span className="border-b border-trilha px-4 py-2 text-apoio font-semibold text-tinta-sussurro">{g.titulo}</span>
          {g.itens.map((it) => (
            <BotaoLinha key={it.id} variante="linha" onClick={() => onAbrir(it.id)}
              className="items-center gap-3 rounded-none border-0 border-b border-trilha px-4 py-3 last:border-b-0 hover:bg-campo">
              <span className="text-controle font-medium text-tinta">{it.rotulo}</span>
              <span className={`text-apoio ${sit[it.id] === 'cadastro incompleto' ? 'text-atencao' : 'text-tinta-sussurro'}`}>· {sit[it.id]}</span>
              <ChevronRight className="ml-auto size-4 text-tinta-sussurro" aria-hidden />
            </BotaoLinha>
          ))}
        </section>
      ))}
    </div>
  )
}
