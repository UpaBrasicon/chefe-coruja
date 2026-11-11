// Reabrir o atendimento da porta (lacuna 8, R9; decisão do RT em 10/11/2026).
// O diálogo pede o motivo da lista (e o detalhe no "Outro"), mostra antes de
// confirmar o que não volta e os documentos já emitidos, e chama
// public.reabrir_atendimento. Quem pode, o prazo e o que volta são do servidor
// (public.reabrir_atendimento_previa); a tela só mostra.
import { useMutation, useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import * as React from 'react'

import { rotuloDocumento } from '@/components/documento/documentos'
import { Chip } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { diaMesHora, hora } from '@/lib/formato'
import { rotuloDesfechoFinal } from '@/lib/historico'
import {
  avisosReabertura, DETALHE_MAXIMO, DETALHE_MINIMO, MOTIVOS_REABERTURA, motivoReaberturaValido, resumoQueVolta,
  type ImpactoReabertura, type MotivoReabertura, type PreviaReabertura,
} from '@/lib/reabrirAtendimento'
import { supabase } from '@/lib/supabase'

export type ResultadoReabertura = { episodio_id: string; avisos: string[] }

export function ReabrirAtendimento({ episodioId, nome, aberto, onFechar, onReaberto }: {
  episodioId: string
  nome: string
  aberto: boolean
  onFechar: () => void
  onReaberto: (r: ResultadoReabertura) => void
}) {
  const [motivo, setMotivo] = React.useState<MotivoReabertura | null>(null)
  const [detalhe, setDetalhe] = React.useState('')
  const [tentou, setTentou] = React.useState(false)

  const previa = useQuery({
    queryKey: ['reabrir-previa', episodioId],
    enabled: aberto,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reabrir_atendimento_previa', { p_episodio: episodioId })
      if (error) throw error
      return data as unknown as PreviaReabertura
    },
  })

  const reabrir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reabrir_atendimento', {
        p_episodio: episodioId, p_motivo: motivo ?? '', p_detalhe: detalhe.trim() || undefined,
      })
      if (error) throw error
      return data as unknown as ImpactoReabertura & { episodio_id: string }
    },
    onSuccess: (r) => onReaberto({ episodio_id: r.episodio_id, avisos: avisosReabertura(r) }),
  })

  const valido = motivoReaberturaValido(motivo, detalhe)
  const p = previa.data
  const faltaDetalhe = tentou && motivo === 'outro' && detalhe.trim().length < DETALHE_MINIMO
  const confirmar = () => {
    setTentou(true)
    if (valido) reabrir.mutate()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && !reabrir.isPending) onFechar() }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reabrir o atendimento de {nome}</DialogTitle>
          <DialogDescription>
            O atendimento volta para "Em atendimento". O desfecho anterior fica guardado no prontuário, com o seu login, a hora e o motivo.
          </DialogDescription>
        </DialogHeader>

        {previa.isLoading && <Spinner />}
        {previa.error && <MensagemErro erro={previa.error} acao="conferir a reabertura" />}
        {p && !p.pode && <Aviso tom="critico" titulo="Não dá para reabrir">{p.recusa}</Aviso>}

        {p?.pode && (
          <div className="flex flex-col gap-4">
            <p className="text-apoio text-tinta-apoio">
              Desfecho: {rotuloDesfechoFinal(p.desfecho)} às {hora(p.desfecho_em)}. Dá para reabrir até {diaMesHora(p.prazo_ate)}.
            </p>

            <div className="flex flex-col gap-[7px]">
              <span className={faltaDetalhe || (tentou && !motivo) ? 'text-apoio font-medium text-critico' : 'text-apoio font-medium text-grafite'}>
                Por que reabrir?
              </span>
              <div role="radiogroup" aria-label="Motivo da reabertura" className="flex flex-wrap gap-[7px]">
                {MOTIVOS_REABERTURA.map((m) => (
                  <Chip key={m.valor} variante="opcao" radio ativo={motivo === m.valor} onClick={() => setMotivo(m.valor)}>{m.rotulo}</Chip>
                ))}
              </div>
              {tentou && !motivo && <MensagemErro formato="linha" texto="Escolha o motivo da reabertura." />}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reabrir-detalhe">Detalhe{motivo === 'outro' ? ` (mínimo de ${DETALHE_MINIMO} letras)` : ' (opcional)'}</Label>
              <Textarea id="reabrir-detalhe" value={detalhe} maxLength={DETALHE_MAXIMO} rows={2}
                aria-invalid={faltaDetalhe || undefined} aria-describedby={faltaDetalhe ? 'reabrir-detalhe-erro' : undefined}
                onChange={(e) => setDetalhe(e.target.value)} />
              {faltaDetalhe && <MensagemErro formato="linha" id="reabrir-detalhe-erro" texto={`No "Outro", descreva o motivo com ${DETALHE_MINIMO} letras ou mais.`} />}
            </div>

            <Aviso tom="atencao" titulo="O que não volta">
              <ul className="flex list-disc flex-col gap-0.5 pl-4">
                {avisosReabertura(p).map((l) => <li key={l}>{l}</li>)}
              </ul>
              {resumoQueVolta(p) && <p className="mt-1 text-tinta-apoio">{resumoQueVolta(p)}</p>}
            </Aviso>

            {p.documentos.length > 0 && (
              <Aviso tom="informacao" titulo="Documentos já emitidos continuam valendo">
                <ul className="flex flex-col gap-0.5">
                  {p.documentos.map((d) => (
                    <li key={d.id}>{rotuloDocumento(d.tipo_documento)}{d.numero ? ` nº ${d.numero}` : ''} · {diaMesHora(d.emitido_em)}</li>
                  ))}
                </ul>
                <p className="mt-1">Se algum não serve mais, cancele pelo documento, com o motivo.</p>
              </Aviso>
            )}

            {reabrir.error && <MensagemErro erro={reabrir.error} acao="reabrir o atendimento" />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={reabrir.isPending}>{p?.pode ? 'Cancelar' : 'Fechar'}</Button>
          {p?.pode && (
            <Button onClick={confirmar} disabled={reabrir.isPending}>
              {reabrir.isPending ? <Spinner /> : <RotateCcw aria-hidden />} Reabrir atendimento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
