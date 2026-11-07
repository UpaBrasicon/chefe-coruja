import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import {
  DOMINIOS_DINI, INDICADORES_DINI, categoriaDini, fichaDini, notaDiniMenorDe6, totalDini, type RespostasDini,
} from '@/clinico/enfermagem/dini'
import { textoFontes } from '@/clinico/ficha'
import { idadeEm } from '@/domain/idade'
import { usePacienteCurva } from '@/components/avaliacao/useAvaliacao'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { dataBr, msg, quando } from './dadosCuidados'
import { Aviso, Cartao, Nota } from './pecas'
import { dataIso } from '@/lib/formato'

// Dini, classificação de pacientes pediátricos (decisão do RT: A em D1 a D7,
// 06/11/2026; migration 20270303000001). Espelho do CartaoFugulin: enfermeiro
// de plantão, uma vez por dia, na internação; corrigir no mesmo dia é
// retificar com motivo. Na tela, só o resumo de cada situação, por domínio.
// D6: abaixo de 6 anos em mínimos ou intermediários, uma nota; a categoria
// não muda.

type Registro = {
  id: string; dia: string; total: number; categoria: string; respostas: RespostasDini
  por: string | null; em: string; motivo: string | null; retificada: boolean
}

const COR: Record<string, string> = { conforme: 'text-conforme', atencao: 'text-observacao', alerta: 'text-mts-laranja', critico: 'text-critico' }

export function CartaoDini({ internacaoId, pacienteId }: { internacaoId: string; pacienteId: string }) {
  const { papelAtivo } = useUnidade()
  const podeClassificar = papelAtivo === 'enfermeiro'
  const qc = useQueryClient()
  const pac = usePacienteCurva(pacienteId)
  const [resp, setResp] = React.useState<RespostasDini>({})
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  const hist = useQuery({
    queryKey: ['dini', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dini_da_internacao', { p_internacao: internacaoId })
      if (error) throw error
      return (data ?? []) as unknown as Registro[]
    },
  })
  const vigentes = (hist.data ?? []).filter((r) => !r.retificada)
  // hoje = o dia do registro vigente mais novo é o de hoje (o servidor decide o dia; aqui só a tela)
  const hoje = vigentes.find((r) => r.dia === dataIso()) ?? null
  const total = totalDini(resp)
  const cat = total !== null ? categoriaDini(total) : null
  const respondidas = INDICADORES_DINI.filter((a) => resp[a.id]).length
  const nasc = pac.data?.data_nascimento ?? null
  const anos = nasc ? (idadeEm(nasc, dataIso())?.anos ?? null) : null
  // D6: a nota vale para a soma em preenchimento ou, sem ela, para a de hoje
  const somaD6 = total ?? hoje?.total ?? null
  const notaD6 = somaD6 !== null ? notaDiniMenorDe6(somaD6, anos) : null

  async function registrar() {
    if (total === null) return
    setOcupado(true)
    const { error } = await supabase.rpc('registrar_dini', {
      p_internacao: internacaoId, p_respostas: resp, p_motivo: hoje ? motivo.trim() : undefined,
    })
    setOcupado(false)
    if (error) { setErro(msg(error)); setAviso(null); return }
    setErro(null); setAviso(`Dini: ${total} · ${cat!.rotulo}.`); setResp({}); setMotivo('')
    void qc.invalidateQueries({ queryKey: ['dini', internacaoId] })
    void qc.invalidateQueries({ queryKey: ['dini-hoje'] })
  }

  return (
    <Cartao titulo="Dini — classificação de pacientes pediátricos (11 indicadores)"
      extra={<span className={cn('text-apoio font-semibold', cat ? COR[cat.tom] : 'text-tinta-sussurro')}>
        {total !== null && cat ? `${total} · ${cat.rotulo}` : `${respondidas} de ${INDICADORES_DINI.length} indicadores`}
      </span>}>
      <span className={cn('text-apoio', hoje ? 'text-conforme' : 'text-atencao')}>
        {hoje ? `Hoje: ${hoje.total} · ${hoje.categoria} (${hoje.por ?? '—'}, ${quando(hoje.em)})` : 'Hoje: pendente (uma classificação por dia).'}
      </span>
      {notaD6 && <Nota>{notaD6}</Nota>}
      {podeClassificar && DOMINIOS_DINI.map((d) => (
        <div key={d} className="flex flex-col gap-2.5">
          <span className="text-rotulo font-semibold uppercase tracking-wide text-tinta-sussurro">Domínio {d}</span>
          {INDICADORES_DINI.filter((a) => a.dominio === d).map((a) => (
            <div key={a.id} className="flex flex-col gap-1.5">
              <span className="text-apoio font-medium text-grafite">{a.rotulo}</span>
              {a.nota && <span className="text-rotulo text-pretty text-tinta-sussurro">{a.nota}</span>}
              <div className="flex flex-wrap gap-1.5">
                {a.situacoes.map((n, i) => (
                  <Chip key={n} ativo={resp[a.id] === i + 1} onClick={() => setResp({ ...resp, [a.id]: i + 1 })}>{i + 1} · {n}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {podeClassificar && hoje && (
        <Input className="h-8" placeholder="Já classificado hoje: para retificar, diga o motivo (mínimo de 10 letras)" value={motivo}
          onChange={(e) => setMotivo(e.target.value)} />
      )}
      <Aviso erro={erro} aviso={aviso} />
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-[1_1_260px] text-rotulo text-pretty text-tinta-sussurro">
          Resumo das situações, não o texto do instrumento. Fontes: {textoFontes(fichaDini)}
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
