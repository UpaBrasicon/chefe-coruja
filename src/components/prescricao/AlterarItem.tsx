import { Pencil } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resumoMudanca, type CamposItem } from '@/lib/alteracaoPrescricao'
import { supabase } from '@/lib/supabase'

// Alterar item de medicamento (Fase 2, tarefa 6; migration 20261031000004).
// Só o médico; com motivo. A versão anterior fica guardada (suspensa, com as
// checagens dela) e a nova passa pelas mesmas travas da prescrição. A
// enfermagem vê o aviso na Checagem.

const VIAS = ['VO', 'EV', 'IM', 'SC', 'SL', 'INAL', 'TÓPICA', 'RETAL', 'SNE', 'OCULAR']

export function AlterarItem({ itemId, atual, aoMudar }: { itemId: string; atual: CamposItem; aoMudar: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [f, setF] = React.useState({ dose: atual.dose ?? '', via: atual.via ?? '', posologia: atual.posologia ?? '', se_necessario: atual.se_necessario })
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const mudanca = resumoMudanca(atual, f)

  if (!aberto) return <Button size="xs" variant="ghost" onClick={() => setAberto(true)}><Pencil /> Alterar</Button>

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.rpc('alterar_item_prescricao', {
      p_item: itemId, p_motivo: motivo.trim(),
      p_mudancas: { dose: f.dose.trim(), via: f.via, posologia: f.posologia.trim(), se_necessario: f.se_necessario },
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setErro(null); setAberto(false); setMotivo(''); aoMudar()
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-acao/30 bg-acao/[0.04] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-40" aria-label="Dose" placeholder="Dose" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
        <select aria-label="Via" className="h-8 rounded-controle border border-fio bg-campo px-2 text-xs" value={f.via} onChange={(e) => setF({ ...f, via: e.target.value })}>
          {[...new Set([f.via, ...VIAS])].filter(Boolean).map((v) => <option key={v}>{v}</option>)}
        </select>
        <Input className="h-8 w-36" aria-label="Frequência" placeholder="Frequência" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })} />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={f.se_necessario} onChange={(e) => setF({ ...f, se_necessario: e.target.checked })} /> se necessário
        </label>
      </div>
      <Input className="h-8" placeholder="Motivo da alteração (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {mudanca && <span className="text-xs text-tinta-apoio">Muda: {mudanca}. A versão anterior fica guardada.</span>}
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!mudanca || motivo.trim().length < 5 || salvando} onClick={() => void salvar()}>Salvar alteração</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAberto(false); setErro(null) }}>Voltar</Button>
      </div>
    </div>
  )
}
