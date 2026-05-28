import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function diasAte(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  return Math.ceil((new Date(dataStr + 'T12:00:00') - hoje) / 86400000)
}

export default function ModalDesistir({ plantao, aberto, onFechar, onSucesso }) {
  const { profissional } = useAuth()
  const [motivo, setMotivo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmou, setConfirmou] = useState(false)

  function resetar() { setMotivo(''); setErro(''); setConfirmou(false) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!confirmou) { setErro('Confirme que entendeu a regra de responsabilidade.'); return }
    setErro(''); setCarregando(true)

    const reposicaoAte = new Date(Date.now() + 15 * 86400000).toISOString()
    const { error } = await supabase.from('desistencias').insert({
      plantao_id: plantao.id,
      profissional_id: profissional.id,
      motivo: motivo.trim() || null,
      avisado_em: new Date().toISOString(),
      responsavel_ate: reposicaoAte,
      status: 'aguardando_candidato',
    })

    setCarregando(false)
    if (error) { setErro('Erro ao registrar: ' + error.message) }
    else { resetar(); onSucesso?.(); onFechar() }
  }

  if (!plantao) return null
  const [, mesStr, diaStr] = (plantao.data ?? '').split('-')
  const dias = diasAte(plantao.data)
  const dentroDosPrazo = dias <= 15
  const dataLimite = new Date(Date.now() + 15 * 86400000).toLocaleDateString('pt-BR')

  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) { resetar(); onFechar() } }}>
      <DialogContent style={{ borderColor: 'var(--cor-borda)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cor-texto)' }}>Desistir do plantão</DialogTitle>
          <DialogDescription style={{ color: 'var(--cor-texto-suave)' }}>
            Leia as condições com atenção antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#FEF9C3', border: '1px solid #CA8A04' }}>
          <p className="font-semibold" style={{ color: '#92400E' }}>
            {parseInt(diaStr, 10)} de {MESES_PT[parseInt(mesStr, 10) - 1]} — {plantao.setores?.nome}
          </p>
          <p style={{ color: '#78350F' }}>{plantao.tipos_turno?.hora_inicio?.slice(0,5)}–{plantao.tipos_turno?.hora_fim?.slice(0,5)}</p>
        </div>

        <div className="rounded-lg px-4 py-3 text-sm space-y-1" style={{ background: '#FEF2F2', border: '1px solid var(--cor-vago)' }}>
          <p className="font-semibold" style={{ color: 'var(--cor-vago)' }}>⚠️ Regra de responsabilidade</p>
          {dentroDosPrazo ? (
            <p style={{ color: '#7F1D1D' }}>
              Este plantão é em <strong>{dias} dia{dias !== 1 ? 's' : ''}</strong> — dentro dos 15 dias.
              Mesmo desistindo, <strong>você continua responsável</strong> e deverá cumpri-lo.
            </p>
          ) : (
            <p style={{ color: '#7F1D1D' }}>
              Você permanece responsável até <strong>{dataLimite}</strong>.
              Após essa data, o slot ficará vago e a unidade buscará reposição.
            </p>
          )}
          <p className="font-medium" style={{ color: '#7F1D1D' }}>Esta ação não pode ser cancelada.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label style={{ color: 'var(--cor-texto)' }}>Motivo <span style={{ color: 'var(--cor-texto-suave)' }}>(opcional)</span></Label>
            <Textarea placeholder="Descreva o motivo..." value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} style={{ borderColor: 'var(--cor-borda)' }} />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmou} onChange={e => setConfirmou(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: 'var(--cor-primaria)' }} />
            <span className="text-sm" style={{ color: 'var(--cor-texto)' }}>
              Entendo as condições e confirmo. Sei que <strong>não poderei cancelar</strong>.
            </span>
          </label>

          {erro && <p className="text-sm rounded-md p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { resetar(); onFechar() }} style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>Cancelar</Button>
            <Button type="submit" disabled={carregando || !confirmou} style={{ background: 'var(--cor-vago)', color: '#fff', opacity: !confirmou ? 0.5 : 1 }}>
              {carregando ? 'Registrando...' : 'Confirmar desistência'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
