import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { AREAS_FUGULIN, categoriaFugulin, fichaFugulin, totalFugulin, type RespostasFugulin } from '@/clinico/enfermagem/fugulin'
import { textoFontes } from '@/clinico/ficha'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { dataBr, msg, quando } from './dadosCuidados'
import { Aviso, Cartao } from './pecas'

// Fugulin, 12 áreas (Fase 2, tarefa 5; migration 20261031000006). Enfermeiro
// de plantão, uma vez por dia, na internação; corrigir no mesmo dia é
// retificar com motivo. Na tela, só o resumo de cada graduação (decisão do RT).

type Registro = {
  id: string; dia: string; total: number; categoria: string; respostas: RespostasFugulin
  por: string | null; em: string; motivo: string | null; retificada: boolean
}

const COR: Record<string, string> = { conforme: 'text-conforme', atencao: 'text-observacao', alerta: 'text-mts-laranja', critico: 'text-critico' }

export function CartaoFugulin({ internacaoId }: { internacaoId: string }) {
  const { papelAtivo } = useUnidade()
  const podeClassificar = papelAtivo === 'enfermeiro'
  const qc = useQueryClient()
  const [resp, setResp] = React.useState<RespostasFugulin>({})
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  const hist = useQuery({
    queryKey: ['fugulin', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fugulin_da_internacao', { p_internacao: internacaoId })
      if (error) throw error
      return (data ?? []) as unknown as Registro[]
    },
  })
  const vigentes = (hist.data ?? []).filter((r) => !r.retificada)
  // hoje = o dia do registro vigente mais novo é o de hoje (o servidor decide o dia; aqui só a tela)
  const hoje = vigentes.find((r) => r.dia === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })) ?? null
  const total = totalFugulin(resp)
  const cat = total !== null ? categoriaFugulin(total) : null
  const respondidas = AREAS_FUGULIN.filter((a) => resp[a.id]).length

  async function registrar() {
    if (total === null) return
    setOcupado(true)
    const { error } = await supabase.rpc('registrar_fugulin', {
      p_internacao: internacaoId, p_respostas: resp, p_motivo: hoje ? motivo.trim() : undefined,
    })
    setOcupado(false)
    if (error) { setErro(msg(error)); setAviso(null); return }
    setErro(null); setAviso(`Fugulin: ${total} · ${cat!.rotulo}.`); setResp({}); setMotivo('')
    void qc.invalidateQueries({ queryKey: ['fugulin', internacaoId] })
    void qc.invalidateQueries({ queryKey: ['fugulin-hoje'] })
  }

  return (
    <Cartao titulo="Fugulin — classificação de pacientes (12 áreas)"
      extra={<span className={cn('text-apoio font-semibold', cat ? COR[cat.tom] : 'text-tinta-sussurro')}>
        {total !== null && cat ? `${total} · ${cat.rotulo}` : `${respondidas} de ${AREAS_FUGULIN.length} áreas`}
      </span>}>
      <span className={cn('text-apoio', hoje ? 'text-conforme' : 'text-atencao')}>
        {hoje ? `Hoje: ${hoje.total} · ${hoje.categoria} (${hoje.por ?? '—'}, ${quando(hoje.em)})` : 'Hoje: pendente (uma classificação por dia).'}
      </span>
      {podeClassificar && AREAS_FUGULIN.map((a) => (
        <div key={a.id} className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">{a.rotulo}</span>
          <div className="flex flex-wrap gap-1.5">
            {a.niveis.map((n, i) => (
              <Chip key={n} ativo={resp[a.id] === i + 1} onClick={() => setResp({ ...resp, [a.id]: i + 1 })}>{i + 1} · {n}</Chip>
            ))}
          </div>
        </div>
      ))}
      {podeClassificar && hoje && (
        <Input className="h-8" placeholder="Já classificado hoje: para retificar, diga o motivo (mínimo de 10 letras)" value={motivo}
          onChange={(e) => setMotivo(e.target.value)} />
      )}
      <Aviso erro={erro} aviso={aviso} />
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-[1_1_260px] text-rotulo text-pretty text-tinta-sussurro">
          Resumo das graduações, não o texto do instrumento. Fontes: {textoFontes(fichaFugulin)}
        </span>
        {podeClassificar && (
          <Button size="sm" disabled={total === null || ocupado || (!!hoje && motivo.trim().length < 10)} onClick={() => void registrar()}>
            {hoje ? 'Retificar o de hoje' : 'Registrar'}
          </Button>
        )}
      </div>
      {vigentes.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-fio pt-2 text-apoio">
          <span className="text-rotulo font-medium text-tinta-sussurro">Histórico</span>
          {(hist.data ?? []).slice(0, 14).map((r) => (
            <span key={r.id} className={cn('text-tinta-apoio', r.retificada && 'line-through opacity-60')}>
              {dataBr(r.dia)} · {r.total} · {r.categoria} · {r.por ?? '—'}{r.motivo ? ` — retificação: “${r.motivo}”` : ''}
            </span>
          ))}
        </div>
      )}
    </Cartao>
  )
}
