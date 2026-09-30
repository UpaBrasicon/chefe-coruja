// Aba "Reavaliação" (protótipo): "Reavaliar às", o que se aguarda (exame ou
// medicação), o texto da reavaliação (≥ 10 letras) e a LINHA DO ATENDIMENTO
// montada do banco (triagem, início, prescrito, administrado, exame,
// resultado, reavaliação), com o nome de quem fez.
import { useMutation } from '@tanstack/react-query'
import { History } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { hora, msg, type PainelPS } from './comum'

export function AbaReavaliacao({ episodioId, painel, reavHora, setReavHora, aoMudar }: {
  episodioId: string; painel: PainelPS; reavHora: string; setReavHora: (v: string) => void; aoMudar: () => void
}) {
  const [texto, setTexto] = React.useState('')
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_reavaliacao', { p_episodio: episodioId, p_texto: texto })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); aoMudar() },
  })
  const pend = painel.pendencias
  const curto = texto.trim().length < 10

  return (
    <div className="flex flex-col gap-4">
      {painel.reavaliar_em && (
        <p className="rounded-container border border-atencao/25 bg-alerta-atencao px-3.5 py-2.5 text-apoio text-atencao">
          Em reavaliação: prevista para as {hora(painel.reavaliar_em)}. Registrar a reavaliação tira o paciente desse estado.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reav-hora">Reavaliar às</Label>
          <Input id="reav-hora" type="time" value={reavHora} onChange={(e) => setReavHora(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-tinta-apoio">Aguardando</span>
          <span className="rounded-controle border border-fio bg-campo px-3 py-2 text-apoio text-tinta [text-wrap:pretty]">
            {pend.length ? pend.join(' · ') : 'Nada pendente. Peça exame ou prescreva medicação para pôr o paciente em reavaliação.'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reav-texto">Reavaliação · resultado dos exames, resposta à medicação, conduta</Label>
        <Textarea id="reav-texto" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
        {texto && curto && <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras.</span>}
      </div>
      {registrar.error && <p className="text-apoio text-critico">{msg(registrar.error)}</p>}
      <Button className="self-start" disabled={curto || registrar.isPending} onClick={() => registrar.mutate()}>
        <History /> Registrar reavaliação
      </Button>

      <section className="flex flex-col rounded-cartao border border-fio bg-superficie">
        <div className="border-b border-trilha px-4 py-3 text-controle font-semibold text-tinta">Linha do atendimento</div>
        {painel.linha.length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Nada registrado ainda.</p>}
        {painel.linha.map((l, i) => (
          <div key={`${l.em}-${i}`} className="flex gap-3 border-b border-trilha px-4 py-2.5 last:border-0">
            <span className="w-12 shrink-0 text-apoio tabular-nums text-tinta-sussurro">{hora(l.em)}</span>
            <div className="flex min-w-0 flex-col">
              <span className="text-controle font-medium text-tinta">{l.titulo}</span>
              {l.texto && <span className="text-apoio text-tinta-apoio [text-wrap:pretty]">{l.texto}</span>}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
