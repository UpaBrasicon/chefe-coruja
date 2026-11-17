// Sinais vitais da UBS fora da escuta inicial (percurso da UBS, U7, PR 4):
// na consulta (médico ou enfermeiro) e na tela do técnico e do enfermeiro.
// Grava pela registrar_sinais_aps, em observacao; o hiperdia e o pré-natal já
// leem a pressão, o peso e a altura daqui.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import * as React from 'react'

import { CamposVitais } from '@/components/clinico/CamposVitais'
import { Button } from '@/components/ui/button'
import { faixaEtaria } from '@/domain/idade'
import { paraNumeros, publicoDosVitais } from '@/domain/vitais'
import { supabase } from '@/lib/supabase'

export function SinaisVitaisAps({ episodioId, nascimento, chegadaEm, onRegistrado }: {
  episodioId: string
  nascimento: string | null
  chegadaEm: string
  onRegistrado?: (msg: string) => void
}) {
  const qc = useQueryClient()
  const publico = publicoDosVitais(faixaEtaria(nascimento, chegadaEm))
  const [valores, setValores] = React.useState<Record<string, string>>({})
  const [aviso, setAviso] = React.useState<string | null>(null)

  const erro = (() => { try { paraNumeros(valores); return null } catch (e) { return (e as Error).message } })()
  const vazio = Object.values(valores).every((v) => v.trim() === '')

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('registrar_sinais_aps', { p_episodio: episodioId, p_sinais: paraNumeros(valores) })
      if (error) throw error
      return data as number
    },
    onSuccess: (n) => {
      const msg = `${n} ${n === 1 ? 'sinal vital registrado' : 'sinais vitais registrados'}.`
      setAviso(msg)
      setValores({})
      void qc.invalidateQueries({ queryKey: ['painel-atendimento'] })
      onRegistrado?.(msg)
    },
  })

  return (
    <section aria-label="Sinais vitais" className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-3">
      <span className="text-controle font-semibold text-tinta">Sinais vitais <span className="font-normal text-tinta-sussurro">(os que forem aferidos agora)</span></span>
      <CamposVitais publico={publico} opcionais extras={['estatura']} prefixo={`sv-${episodioId}`} valores={valores}
        onChange={(k, v) => { setAviso(null); setValores((s) => ({ ...s, [k]: v })) }} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {erro && <span role="alert" className="mr-auto text-apoio text-critico">{erro}</span>}
        {salvar.error && <span role="alert" className="mr-auto text-apoio text-critico">{salvar.error.message}</span>}
        {aviso && <span role="status" className="mr-auto text-apoio text-conforme">{aviso}</span>}
        <Button size="sm" disabled={vazio || !!erro || salvar.isPending} onClick={() => salvar.mutate()}><Check /> Registrar sinais vitais</Button>
      </div>
    </section>
  )
}
