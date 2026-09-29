// Laudo de AIH (Fase 4.3): CID e procedimento vêm da terminologia do banco
// (CID-10 e SIGTAP), a lista de procedimentos é filtrada pelo CID principal e
// a conferência AVISA risco de glosa — não impede a impressão.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Aih } from './rascunho'

type Procedimento = { codigo: string; nome: string; compativel: boolean; como_principal: boolean; competencia: string | null }
type Conferencia = { avisos: { campo: string; texto: string }[]; competencia: string | null; nota: string }

// 0303140151 → 03.03.14.015-1 (como no SIGTAP)
const formatarSigtap = (c: string) => c.replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d)$/, '$1.$2.$3.$4-$5')

export function AihTerminologia({ pacienteId, aih, set }: { pacienteId?: string | null; aih: Aih; set: (nome: keyof Aih, valor: string) => void }) {
  const [alvoCid, setAlvoCid] = React.useState<'campo24' | 'campo25' | 'campo26'>('campo24')
  const [termoProc, setTermoProc] = React.useState('')
  const cid = aih.campo24?.trim() ?? ''

  const procedimentos = useQuery({
    queryKey: ['procedimentos-do-cid', cid, termoProc],
    enabled: !!cid || termoProc.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_do_cid', {
        p_cid: cid, p_termo: termoProc.trim() || undefined, p_limite: 30,
      })
      if (error) throw error
      return (data ?? []) as Procedimento[]
    },
  })

  const conferencia = useQuery({
    queryKey: ['conferir-aih', pacienteId, aih.campo24, aih.campo25, aih.campo26, aih.campo28],
    enabled: !!pacienteId && !!(aih.campo24 || aih.campo28),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('conferir_aih', {
        p_paciente: pacienteId!, p_cid_principal: aih.campo24 ?? '', p_cid_secundario: aih.campo25 || undefined,
        p_cid_causa: aih.campo26 || undefined, p_procedimento: aih.campo28 || undefined,
      })
      if (error) throw error
      return data as unknown as Conferencia
    },
  })

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">CID e procedimento (SIGTAP)</CardTitle>
        <CardDescription>Da tabela CID-10 e do SIGTAP do banco. A lista de procedimentos segue o CID principal.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {([['campo24', '24 · principal'], ['campo25', '25 · secundário'], ['campo26', '26 · causa assoc.']] as const).map(([k, r]) => (
            <button key={k} type="button" onClick={() => setAlvoCid(k)}
              className={`rounded-md border px-2 py-1 text-xs ${alvoCid === k ? 'border-acao bg-acao/10 text-acao' : 'border-fio'}`}>
              CID {r}{aih[k] ? `: ${aih[k]}` : ''}
            </button>
          ))}
        </div>
        <BuscaTerminologia tipo="cid10" placeholder="Buscar CID por código ou nome…"
          onSelecionar={(r) => set(alvoCid, r.codigo)} />

        <div className="flex flex-col gap-1">
          <Label htmlFor="aih-proc">Procedimento solicitado (28)</Label>
          <Input id="aih-proc" placeholder={cid ? `Filtrar os compatíveis com ${cid}…` : 'Digite parte do nome (3+ letras) ou o código'}
            value={termoProc} onChange={(e) => setTermoProc(e.target.value)} />
          <div className="max-h-56 overflow-y-auto rounded-md border border-fio">
            {(procedimentos.data ?? []).map((p) => (
              <button key={p.codigo} type="button"
                onClick={() => { set('campo28', formatarSigtap(p.codigo)); set('campo27', p.nome) }}
                className="flex w-full items-baseline gap-2 border-b border-fio px-2 py-1 text-left text-xs last:border-0 hover:bg-trilha">
                <span className="tabular-nums text-tinta-apoio">{formatarSigtap(p.codigo)}</span>
                <span className="flex-1">{p.nome}</span>
                {cid && !p.como_principal && <span className="text-atencao">só secundário</span>}
              </button>
            ))}
            {procedimentos.data?.length === 0 && (
              <p className="px-2 py-2 text-xs text-tinta-sussurro">Nenhum procedimento {cid ? `compatível com ${cid}` : 'encontrado'}.</p>
            )}
          </div>
        </div>

        {conferencia.data && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">Conferência (não impede a impressão)</div>
            {conferencia.data.avisos.length === 0 ? (
              <p className="flex items-center gap-1.5 text-conforme"><CheckCircle2 className="size-3.5" /> Sem aviso de glosa.</p>
            ) : (
              conferencia.data.avisos.map((a, k) => (
                <p key={k} className="flex gap-1.5 text-atencao"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Campo {a.campo}: {a.texto}</p>
              ))
            )}
            <p className="text-xs text-tinta-sussurro">
              SIGTAP competência {conferencia.data.competencia ? `${conferencia.data.competencia.slice(4)}/${conferencia.data.competencia.slice(0, 4)}` : '—'}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
