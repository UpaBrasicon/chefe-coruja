// ─────────────────────────────────────────────────────────────────────────────
// Checagem de enfermagem (Fase 4.6).
//
// Itens ativos das prescrições dos pacientes do meu plantão. O enfermeiro
// apraza; a enfermagem checa cada administração — feito, não feito ou
// recusado (os dois últimos com motivo). Nada se apaga: corrigir é checar de
// novo, e vale o último registro.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { AlergiaNaTela } from './AlergiaNaTela'

type Linha = {
  paciente_id: string; paciente_nome: string; local: string | null; item_id: string; tipo: string; descricao: string
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; horarios: string[] | null
  diluicao_texto: string | null; vasoativo: boolean; ultima_situacao: string | null; ultima_em: string | null
  ultima_por: string | null; ultima_horario: string | null
}
const SITUACAO: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'destructive' }> = {
  feito: { rotulo: 'feito', variante: 'success' },
  nao_feito: { rotulo: 'não feito', variante: 'warning' },
  recusado: { rotulo: 'recusado', variante: 'destructive' },
}
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default function Checagem() {
  const { papelAtivo } = useUnidade()
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const fila = useQuery({
    queryKey: ['fila-checagem'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_checagem')
      if (error) throw error
      return (data ?? []) as Linha[]
    },
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['fila-checagem'] })
  const pacientes = new Map<string, Linha[]>()
  for (const l of fila.data ?? []) pacientes.set(l.paciente_id, [...(pacientes.get(l.paciente_id) ?? []), l])

  return (
    <>
      <TituloPagina icone={ClipboardCheck} titulo="Checagem"
        descricao="Itens prescritos dos pacientes do seu plantão. Não feito e recusado pedem motivo; corrigir é checar de novo." />
      {erro && <p className="mb-3 rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
      {pacientes.size === 0 && !fila.isLoading && (
        <Vazio icone={ClipboardCheck} titulo="Nenhum item para checar" texto="Pacientes dos setores da sua escala com prescrição ativa aparecem aqui." />
      )}
      <div className="flex flex-col gap-4">
        {[...pacientes.entries()].map(([id, itens]) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="text-base">{itens[0].paciente_nome} <span className="text-sm font-normal text-tinta-sussurro">· {itens[0].local ?? '—'}</span></CardTitle>
              {/* alergia de cada paciente junto dos itens a administrar (R4) */}
              <AlergiaNaTela pacienteId={id} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {itens.map((l) => <ItemChecagem key={l.item_id} l={l} podeAprazar={papelAtivo === 'enfermeiro'} aoMudar={recarregar} aoErro={setErro} />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function ItemChecagem({ l, podeAprazar, aoMudar, aoErro }: { l: Linha; podeAprazar: boolean; aoMudar: () => void; aoErro: (m: string | null) => void }) {
  const [horarios, setHorarios] = React.useState((l.horarios ?? []).join(', '))
  const [horario, setHorario] = React.useState('')
  const [pedindo, setPedindo] = React.useState<'nao_feito' | 'recusado' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const st = l.ultima_situacao ? SITUACAO[l.ultima_situacao] : null

  async function checar(situacao: 'feito' | 'nao_feito' | 'recusado', m?: string) {
    const { error } = await supabase.rpc('checar', { p_item: l.item_id, p_situacao: situacao, p_horario: horario || undefined, p_motivo: m || undefined })
    if (error) return aoErro(error.message)
    aoErro(null); setPedindo(null); setMotivo(''); aoMudar()
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{l.descricao}</span>
        {l.tipo === 'medicamento' && <span>{l.dose} · {l.via} · {l.posologia}{l.se_necessario ? ' · se necessário' : ''}</span>}
        {l.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {st && <Badge variant={st.variante} className="ml-auto">{st.rotulo}{l.ultima_horario ? ` ${l.ultima_horario}` : ''}</Badge>}
      </div>
      {l.diluicao_texto && <p className="text-xs text-tinta-apoio">Diluição: {l.diluicao_texto}</p>}
      {l.ultima_em && <p className="text-xs text-tinta-sussurro">Última checagem: {hora(l.ultima_em)} · {l.ultima_por}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {podeAprazar ? (
          <>
            <Input className="h-8 w-44" placeholder="Horários: 08:00, 20:00" value={horarios} onChange={(e) => setHorarios(e.target.value)} />
            <Button size="xs" variant="outline" onClick={async () => {
              const lista = horarios.split(',').map((h) => h.trim()).filter(Boolean)
              const { error } = await supabase.rpc('aprazar', { p_item: l.item_id, p_horarios: lista })
              if (error) return aoErro(error.message)
              aoErro(null); aoMudar()
            }}>Aprazar</Button>
          </>
        ) : l.horarios?.length ? <span className="text-xs text-tinta-apoio">Aprazado: {l.horarios.join(', ')}</span> : null}
        {l.horarios?.length ? (
          <select className="h-8 rounded-controle border border-fio bg-campo px-2 text-xs" value={horario} onChange={(e) => setHorario(e.target.value)}
            aria-label="Horário da checagem">
            <option value="">horário…</option>
            {l.horarios.map((h) => <option key={h}>{h}</option>)}
          </select>
        ) : null}
        <Button size="xs" onClick={() => void checar('feito')}>Feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('nao_feito')}>Não feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('recusado')}>Recusado</Button>
      </div>
      {pedindo && (
        <div className="flex gap-2">
          <Input className="h-8" placeholder={pedindo === 'recusado' ? 'Motivo da recusa' : 'Por que não foi feito'} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" disabled={motivo.trim().length < 5} onClick={() => void checar(pedindo, motivo)}>Registrar</Button>
          <Button size="xs" variant="ghost" onClick={() => setPedindo(null)}>Voltar</Button>
        </div>
      )}
    </div>
  )
}
