import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import ComboboxMedico from './ComboboxMedico'

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export default function ModalPedirTroca({ plantao, aberto, onFechar, onSucesso }) {
  const { profissional } = useAuth()
  const [medicos, setMedicos] = useState([])
  const [paraId, setParaId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [trocaExistente, setTrocaExistente] = useState(false)

  useEffect(() => {
    if (!aberto || !plantao) return
    setParaId('')
    setMensagem('')
    setErro('')

    async function carregar() {
      // Busca médicos aprovados (exceto o próprio)
      const { data: listaMedicos } = await supabase
        .from('profissionais')
        .select('id, nome, crm')
        .eq('status_aprovacao', 'aprovado')
        .eq('ativo', true)
        .neq('id', profissional.id)
        .order('nome')

      setMedicos(listaMedicos ?? [])

      // Verifica se já existe troca pendente para este plantão
      const { data: trocas } = await supabase
        .from('trocas')
        .select('id')
        .eq('plantao_id', plantao.id)
        .eq('status', 'pendente')
        .limit(1)

      setTrocaExistente((trocas ?? []).length > 0)
    }

    carregar()
  }, [aberto, plantao, profissional?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!paraId) { setErro('Selecione o médico para quem deseja transferir o plantão.'); return }
    setErro('')
    setCarregando(true)

    const { error } = await supabase.from('trocas').insert({
      plantao_id: plantao.id,
      de_profissional_id: profissional.id,
      para_profissional_id: paraId,
      mensagem: mensagem.trim() || null,
    })

    setCarregando(false)

    if (error) {
      setErro('Erro ao enviar pedido: ' + error.message)
    } else {
      onSucesso?.()
      onFechar()
    }
  }

  if (!plantao) return null

  const [, mesStr, diaStr] = (plantao.data ?? '').split('-')
  const descricaoPlantao = `${parseInt(diaStr, 10)} de ${MESES_PT[parseInt(mesStr, 10) - 1]} — ${plantao.setores?.nome} (${plantao.tipos_turno?.hora_inicio?.slice(0, 5)}–${plantao.tipos_turno?.hora_fim?.slice(0, 5)})`

  return (
    <Dialog open={aberto} onOpenChange={v => !v && onFechar()}>
      <DialogContent style={{ borderColor: 'var(--cor-borda)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cor-texto)' }}>Pedir transferência de plantão</DialogTitle>
          <DialogDescription style={{ color: 'var(--cor-texto-suave)' }}>
            Escolha um colega para assumir o seu plantão. Ele precisará confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Info do plantão */}
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: '#F0FDFA', border: '1px solid var(--cor-primaria)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--cor-primaria)' }}>Seu plantão</p>
          <p style={{ color: 'var(--cor-texto)' }}>{descricaoPlantao}</p>
        </div>

        {trocaExistente ? (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: '#FEF9C3', border: '1px solid #CA8A04', color: '#854D0E' }}
          >
            Já existe um pedido pendente para este plantão. Aguarde a resposta do colega ou cancele o pedido anterior.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            <div className="space-y-1">
              <Label style={{ color: 'var(--cor-texto)' }}>Transferir para</Label>
              <ComboboxMedico
                medicos={medicos}
                value={paraId}
                onChange={setParaId}
                disabled={carregando}
              />
            </div>

            <div className="space-y-1">
              <Label style={{ color: 'var(--cor-texto)' }}>
                Mensagem <span style={{ color: 'var(--cor-texto-suave)' }}>(opcional)</span>
              </Label>
              <Textarea
                placeholder="Ex: Preciso de folga nesse dia, você pode me ajudar?"
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={3}
                style={{ borderColor: 'var(--cor-borda)' }}
              />
            </div>

            {erro && (
              <p className="text-sm rounded-md p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>
                {erro}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onFechar}
                style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={carregando}
                style={{ background: 'var(--cor-primaria)', color: '#fff' }}
              >
                {carregando ? 'Enviando...' : 'Enviar pedido'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
