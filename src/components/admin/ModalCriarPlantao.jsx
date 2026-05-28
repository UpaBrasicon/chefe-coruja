import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

function gerarDatas(dataInicio, semanas) {
  const datas = []
  const current = new Date(dataInicio + 'T12:00:00')
  for (let i = 0; i < semanas; i++) {
    datas.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 7)
  }
  return datas
}

function gerarRecId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function ModalCriarPlantao({ aberto, onFechar, onSucesso }) {
  const { profissional } = useAuth()
  const [setores, setSetores] = useState([])
  const [tiposTurno, setTiposTurno] = useState([])
  const [form, setForm] = useState({ data: '', setor_id: '', tipo_turno_id: '', recorrencia: 'unica' })
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberto) return
    setForm({ data: '', setor_id: '', tipo_turno_id: '', recorrencia: 'unica' })
    setErro('')
    async function carregar() {
      const [resS, resT] = await Promise.all([
        supabase.from('setores').select('id, nome').order('ordem_exibicao'),
        supabase.from('tipos_turno').select('id, nome, hora_inicio, hora_fim').order('hora_inicio'),
      ])
      setSetores(resS.data ?? [])
      setTiposTurno(resT.data ?? [])
    }
    carregar()
  }, [aberto])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.data || !form.setor_id || !form.tipo_turno_id) {
      setErro('Preencha todos os campos.'); return
    }
    setErro(''); setCarregando(true)

    try {
      const SEMANAS = 26 // 6 meses
      const datas = form.recorrencia === 'semanal' ? gerarDatas(form.data, SEMANAS) : [form.data]
      const recId = form.recorrencia === 'semanal' ? gerarRecId() : null

      // Busca slot_nums existentes para as datas + setor em uma só query
      const { data: existentes } = await supabase
        .from('plantoes').select('data, slot_num')
        .eq('setor_id', parseInt(form.setor_id))
        .in('data', datas)

      const maxPorData = {}
      for (const e of existentes ?? []) {
        maxPorData[e.data] = Math.max(maxPorData[e.data] ?? 0, e.slot_num)
      }

      // Monta array de plantões
      const novosPlantoes = datas.map((data, i) => ({
        data,
        setor_id: parseInt(form.setor_id),
        tipo_turno_id: parseInt(form.tipo_turno_id),
        slot_num: (maxPorData[data] ?? 0) + 1,
        profissional_id: null,
        status: 'vago',
        observacoes: recId ? `[REC:${recId}]` : null,
      }))

      // Insere todos de uma vez
      const { data: criados, error: errPlantao } = await supabase
        .from('plantoes').insert(novosPlantoes).select('id, data')

      if (errPlantao) throw new Error(errPlantao.message)

      // Cria desistências para abrir fila
      const agora = new Date().toISOString()
      const desistencias = (criados ?? []).map(p => {
        const dataPlantao = new Date(p.data + 'T12:00:00')
        return {
          plantao_id: p.id,
          profissional_id: profissional.id,
          motivo: '__vaga_admin__',
          avisado_em: agora,
          responsavel_ate: new Date(Math.min(dataPlantao.getTime(), Date.now() + 30 * 86400000)).toISOString(),
          status: 'aguardando_candidato',
        }
      })

      const { error: errDes } = await supabase.from('desistencias').insert(desistencias)
      if (errDes) throw new Error(errDes.message)

      onSucesso?.(); onFechar()
    } catch (err) {
      setErro('Erro: ' + err.message)
    }
    setCarregando(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) onFechar() }}>
      <DialogContent style={{ borderColor: 'var(--cor-borda)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cor-texto)' }}>Criar nova vaga</DialogTitle>
          <DialogDescription style={{ color: 'var(--cor-texto-suave)' }}>
            Vaga criada como <strong>VAGO</strong> e aberta para candidaturas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de recorrência */}
          <div className="space-y-2">
            <Label style={{ color: 'var(--cor-texto)' }}>Tipo de vaga</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: 'unica', label: '📅 Apenas este dia', desc: 'Uma única data' },
                { valor: 'semanal', label: '🔁 Toda semana', desc: 'Ativa até você excluir' },
              ].map(({ valor, label, desc }) => (
                <button key={valor} type="button" onClick={() => setForm(p => ({ ...p, recorrencia: valor }))}
                  className="rounded-lg p-3 text-left text-sm transition-all"
                  style={{
                    background: form.recorrencia === valor ? '#F0FDFA' : 'var(--cor-superficie)',
                    border: `2px solid ${form.recorrencia === valor ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
                  }}>
                  <p className="font-medium" style={{ color: 'var(--cor-texto)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--cor-texto-suave)' }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Data de início */}
          <div className="space-y-1">
            <Label style={{ color: 'var(--cor-texto)' }}>
              {form.recorrencia === 'semanal' ? 'Data de início (primeiro dia)' : 'Data'}
            </Label>
            <Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
              required style={{ borderColor: 'var(--cor-borda)' }} />
          </div>

          {/* Aviso recorrência */}
          {form.recorrencia === 'semanal' && (
            <div className="rounded-lg p-3 text-sm" style={{ background: '#FEF9C3', border: '1px solid #CA8A04' }}>
              <p style={{ color: '#92400E' }}>
                🔁 Serão criados <strong>26 plantões</strong> (6 meses) a partir da data escolhida, todo mesmo dia da semana.
                Para encerrar a recorrência, exclua os plantões futuros pela aba <strong>Escala</strong>.
              </p>
            </div>
          )}

          {/* Setor e turno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label style={{ color: 'var(--cor-texto)' }}>Setor</Label>
              <select value={form.setor_id} onChange={e => setForm(p => ({ ...p, setor_id: e.target.value }))}
                required className="w-full h-9 rounded-md border px-3 text-sm"
                style={{ borderColor: 'var(--cor-borda)', color: form.setor_id ? 'var(--cor-texto)' : '#94A3B8', background: '#fff' }}>
                <option value="">Selecione...</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label style={{ color: 'var(--cor-texto)' }}>Tipo de turno</Label>
              <select value={form.tipo_turno_id} onChange={e => setForm(p => ({ ...p, tipo_turno_id: e.target.value }))}
                required className="w-full h-9 rounded-md border px-3 text-sm"
                style={{ borderColor: 'var(--cor-borda)', color: form.tipo_turno_id ? 'var(--cor-texto)' : '#94A3B8', background: '#fff' }}>
                <option value="">Selecione...</option>
                {tiposTurno.map(t => (
                  <option key={t.id} value={t.id}>{t.nome} ({t.hora_inicio?.slice(0,5)}–{t.hora_fim?.slice(0,5)})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg p-3 text-sm" style={{ background: '#F0FDFA', border: '1px solid var(--cor-primaria)' }}>
            <p style={{ color: 'var(--cor-primaria)' }}>✓ A vaga aparecerá em <strong>Vagas em aberto</strong> para candidaturas.</p>
          </div>

          {erro && <p className="text-sm rounded-md p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onFechar}
              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>Cancelar</Button>
            <Button type="submit" disabled={carregando} style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
              {carregando ? 'Criando...' : form.recorrencia === 'semanal' ? 'Criar 26 vagas (6 meses)' : 'Criar vaga'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
