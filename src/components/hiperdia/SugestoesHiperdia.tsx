// Sugestões do hiperdia vindas do retorno da UPA ou do hospital (percurso da UBS,
// U12 = A): o retorno com CID de hipertensão ou diabetes, de quem ainda não está
// no programa (hiperdia_sugestoes, migration 20270415000018). O médico ou o
// enfermeiro inclui (programa_incluir) ou diz por que não inclui.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROTULO_PROGRAMA, type Programa } from '@/domain/hiperdia'
import { dataPura } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Sugestao = {
  contrarreferencia_id: string; paciente_id: string; nome: string; programa: Programa; cid: string | null
  unidade_origem: string; saida_em: string
}

export function SugestoesHiperdia({ unidadeId, podeIncluir }: { unidadeId: string; podeIncluir: boolean }) {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['hiperdia', 'sugestoes', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hiperdia_sugestoes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Sugestao[]
    },
  })
  const [dispensando, setDispensando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const chave = (s: Sugestao) => `${s.contrarreferencia_id}:${s.programa}`
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['hiperdia'] })

  async function incluir(s: Sugestao) {
    const { error } = await supabase.rpc('programa_incluir', { p_paciente: s.paciente_id, p_programa: s.programa })
    if (error) return setErro(error.message)
    setErro(null); recarregar()
  }
  async function dispensar(s: Sugestao) {
    const { error } = await supabase.rpc('hiperdia_dispensar_sugestao', { p_contrarreferencia: s.contrarreferencia_id, p_programa: s.programa, p_motivo: motivo })
    if (error) return setErro(error.message)
    setErro(null); setDispensando(null); setMotivo(''); recarregar()
  }

  if (!lista.data || lista.data.length === 0) return null
  return (
    <section aria-label="Sugestões do retorno da UPA" className="mb-4 flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="text-controle font-semibold text-tinta">Sugestões do retorno da UPA</span>
      <span className="text-apoio text-tinta-sussurro">Retornos com CID de hipertensão ou diabetes, de quem ainda não está no programa.</span>
      {lista.data.map((s) => (
        <div key={chave(s)} className="flex flex-col gap-1.5 border-t border-trilha pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-apoio font-medium text-tinta">{s.nome}</span>
            <span className="text-apoio text-tinta-apoio">
              {ROTULO_PROGRAMA[s.programa]}{s.cid ? ` · CID ${s.cid}` : ''} · {s.unidade_origem}, {dataPura(s.saida_em.slice(0, 10))}
            </span>
            {podeIncluir && dispensando !== chave(s) && (
              <span className="ml-auto flex gap-2">
                <Button size="xs" onClick={() => void incluir(s)}>Incluir no hiperdia</Button>
                <Button size="xs" variant="outline" onClick={() => { setDispensando(chave(s)); setMotivo('') }}>Não incluir</Button>
              </span>
            )}
          </div>
          {dispensando === chave(s) && (
            <div className="flex flex-wrap items-center gap-2">
              <Input className="h-8 min-w-60 flex-1" aria-label="Motivo de não incluir" placeholder="Motivo (ex.: pressão alta só pela dor)"
                value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
              <Button size="xs" disabled={motivo.trim().length < 5} onClick={() => void dispensar(s)}>Confirmar</Button>
              <Button size="xs" variant="outline" onClick={() => setDispensando(null)}>Voltar</Button>
            </div>
          )}
        </div>
      ))}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
    </section>
  )
}
