import * as React from 'react'
import { Loader2, LogIn } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { obterPosicao } from '@/lib/geolocalizacao'
import { EVENTO_CHECKIN } from '@/hooks/usePlantao'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * O check-in (registrar_checkin): lê o GPS de novo a cada tentativa e manda
 * sem posição quando não há GPS — nunca (0, 0). Fora do raio ou sem
 * localização, a 1ª recusa pede nova tentativa; da 2ª em diante pergunta se
 * o GPS está com problema e aceita justificativa (decisão de 26/09/2026). O
 * raio não é exigido: com a justificativa o check-in passa, registrado fora.
 * Serve à página Meu Plantão e à tela de check-in da casca (GateCheckIn).
 */
export function FormularioCheckin({
  unidadeId,
  onFeito,
  comObservacao = true,
  rotulo = 'Check-in agora',
  tamanho,
}: {
  unidadeId: string | undefined
  onFeito?: (mensagem: string) => void
  comObservacao?: boolean
  rotulo?: string
  tamanho?: 'lg'
}) {
  const [obs, setObs] = React.useState('')
  const [processando, setProcessando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [recusas, setRecusas] = React.useState(0)
  const [recusa, setRecusa] = React.useState<string | null>(null)
  const [justificativa, setJustificativa] = React.useState('')

  async function checkin(comJustificativa = false) {
    if (!unidadeId) return
    setProcessando(true)
    setErro(null)
    try {
      let lat: number | null = null
      let lng: number | null = null
      try {
        const p = await obterPosicao()
        lat = p.lat
        lng = p.lng
      } catch {
        // sem localização vai vazio
      }
      const { error } = await supabase.rpc('registrar_checkin', {
        p_unidade: unidadeId,
        p_lat: lat ?? undefined,
        p_lng: lng ?? undefined,
        p_observacao: obs || undefined,
        p_justificativa: comJustificativa ? justificativa.trim() : undefined,
      })
      if (error) {
        const m = error.message
        if (m.startsWith('CHECKIN_FORA_DO_RAIO') || m.startsWith('CHECKIN_SEM_LOCALIZACAO')) {
          setRecusas((n) => n + 1)
          setRecusa(m.replace(/^CHECKIN_[A-Z_]+:\s*/, ''))
          return
        }
        throw new Error(m.replace(/^CHECKIN_[A-Z_]+:\s*/, ''))
      }
      setObs('')
      setRecusa(null)
      setRecusas(0)
      setJustificativa('')
      window.dispatchEvent(new Event(EVENTO_CHECKIN))
      onFeito?.(comJustificativa ? 'Check-in registrado com a justificativa. O gestor verá o motivo.' : 'Check-in realizado com sucesso.')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <div role="alert" className="rounded-controle border border-critico/30 bg-critico/[0.08] p-3 text-apoio text-critico">{erro}</div>}
      {comObservacao && (
        <Textarea
          placeholder="Observação (opcional)"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          className="min-h-[70px]"
        />
      )}
      {recusa && recusas < 2 && (
        <div role="alert" className="rounded-controle bg-atencao/[0.08] p-3 text-apoio text-atencao">
          <p className="font-medium">Check-in não registrado: {recusa}</p>
          <p className="mt-0.5 text-tinta-apoio">Confira se você já está na unidade e tente de novo, de preferência perto de uma janela ou em área aberta.</p>
        </div>
      )}
      {recusa && recusas >= 2 ? (
        <div className="flex flex-col gap-2 rounded-controle border border-fio bg-campo p-3">
          <p className="text-apoio font-medium text-tinta">O GPS está com problema?</p>
          <p className="text-apoio text-tinta-sussurro">
            Duas tentativas deram “{recusa}”. Se o GPS está errado ou desligado, registre o check-in com uma justificativa. Ela fica visível para o gestor.
          </p>
          <Textarea
            placeholder="Ex.: o GPS do celular está marcando outro bairro"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="min-h-[70px]"
            aria-label="Justificativa do check-in"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => checkin(true)} disabled={processando || justificativa.trim().length < 10}>
              {processando ? <Loader2 className="animate-spin" /> : <LogIn />} Registrar com justificativa
            </Button>
            <Button variant="outline" onClick={() => checkin(false)} disabled={processando}>
              Tentar de novo
            </Button>
          </div>
          {justificativa.trim().length > 0 && justificativa.trim().length < 10 && (
            <p className="text-rotulo text-tinta-sussurro">Escreva pelo menos 10 caracteres.</p>
          )}
        </div>
      ) : (
        <div>
          <Button size={tamanho} className={tamanho === 'lg' ? 'w-full' : undefined} onClick={() => checkin(false)} disabled={processando}>
            {processando ? <Loader2 className="animate-spin" /> : <LogIn />} {recusa ? 'Tentar de novo' : rotulo}
          </Button>
        </div>
      )}
    </div>
  )
}
