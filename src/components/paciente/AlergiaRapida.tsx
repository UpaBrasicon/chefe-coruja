// ─────────────────────────────────────────────────────────────────────────────
// Registro rápido de alergia (folha de prescrição do leito, PM2, modelo do RT
// de 24/11/2026): "Nega alergias" num clique e a alergia nova por atalhos
// (os alergênios mais comuns do catálogo) ou escrita. Usa as mesmas RPCs do
// painel completo (AlergiasEventos): registrar_nega_alergia e registrar_alergia,
// com tipo, gravidade e substância obrigatórios. A trava da prescrição segue a
// do banco (alergia ativa trava o item); nada aqui decide sobre o item.
// ─────────────────────────────────────────────────────────────────────────────
import { ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { ALERGENOS, GRAVIDADES, ativas, negaVigente, useAlergias, useRecarregarAlergias, type GravidadeAlergia, type TipoAlergia } from './useAlergias'

/** Atalhos: os alergênios que mais aparecem na prescrição (do catálogo ALERGENOS). */
const ATALHOS = ['Penicilinas', 'Dipirona', 'Anti-inflamatórios não esteroides', 'Sulfonamidas', 'Contraste iodado', 'Látex']
  .map((n) => ALERGENOS.find((a) => a.nome === n)).filter((a): a is (typeof ALERGENOS)[number] => !!a)

export function AlergiaRapida({ pacienteId, aoAbrirPainel }: { pacienteId: string; aoAbrirPainel: () => void }) {
  const q = useAlergias(pacienteId)
  const recarregar = useRecarregarAlergias(pacienteId)
  const [sub, setSub] = React.useState('')
  const [tipo, setTipo] = React.useState<TipoAlergia>('medicamento')
  const [gravidade, setGravidade] = React.useState<GravidadeAlergia | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const lista = ativas(q.data)
  const nega = negaVigente(q.data)

  async function executar(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setOcupado(true)
    const { error } = await fn()
    setOcupado(false)
    if (error) { setErro(error.message); setAviso(null); return false }
    setErro(null); setAviso(ok); recarregar(); return true
  }
  async function registrar() {
    if (!gravidade || sub.trim().length < 3) return
    const feito = await executar(() => supabase.rpc('registrar_alergia', {
      p_paciente: pacienteId, p_substancia: sub.trim(), p_tipo: tipo, p_gravidade: gravidade,
    }), `Alergia a ${sub.trim()} registrada.`)
    if (feito) { setSub(''); setGravidade(null); setTipo('medicamento') }
  }

  return (
    <div className="flex flex-col gap-3 text-apoio">
      <Button size="sm" variant="outline" className="self-start" disabled={ocupado || lista.length > 0}
        title={lista.length > 0 ? 'Há alergia ativa: para registrar que nega, inative antes cada uma, no painel completo.' : undefined}
        onClick={() => void executar(() => supabase.rpc('registrar_nega_alergia', { p_paciente: pacienteId }),
          nega ? '"Nega alergias" reconfirmado agora.' : '"Nega alergias" registrado.')}>
        <ShieldCheck aria-hidden /> {nega ? 'Reconfirmar: nega alergias' : 'Nega alergias'}
      </Button>

      <div className="flex flex-col gap-2 border-t border-trilha pt-3">
        <span className="font-medium text-tinta">Incluir alergia</span>
        <div role="group" aria-label="Atalhos de alergênio" className="flex flex-wrap gap-1.5">
          {ATALHOS.map((a) => (
            <Chip key={a.nome} ativo={sub === a.nome} onClick={() => { setSub(a.nome); setTipo(a.tipo) }}>{a.nome}</Chip>
          ))}
        </div>
        <Input aria-label="Substância" placeholder="Ou escreva a substância" value={sub}
          onChange={(e) => { setSub(e.target.value); setTipo('medicamento') }} />
        <div role="radiogroup" aria-label="Gravidade" className="flex flex-wrap gap-1.5">
          {GRAVIDADES.map((g) => (
            <Chip key={g.valor} radio variante="opcao" ativo={gravidade === g.valor} onClick={() => setGravidade(g.valor)}>{g.rotulo}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={ocupado || !gravidade || sub.trim().length < 3} onClick={() => void registrar()}>Registrar alergia</Button>
          <Button size="sm" variant="link" className="px-0" onClick={aoAbrirPainel}>Painel completo (reação, evento adverso)</Button>
        </div>
      </div>
      {erro && <p role="alert" className="text-critico">{erro}</p>}
      {aviso && <p role="status" className="text-conforme">{aviso}</p>}
      <p className="text-rotulo text-tinta-sussurro">Alergia ativa trava na prescrição o medicamento correspondente, pelo banco.</p>
    </div>
  )
}
