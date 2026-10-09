import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { horariosPorIntervalo, INTERVALOS_GRADE, lerHorarios, mesmaLista, type Grade } from '@/lib/aprazamento'
import { supabase } from '@/lib/supabase'

// Grade de aprazamento da unidade (Fase 2, tarefa 2; migration 20261031000002).
// O gestor define a hora em que o dia de medicação começa; cada intervalo
// segue essa hora, salvo quando a unidade escreve outra grade para ele. A
// enfermagem recebe a sugestão na Checagem e ajusta caso a caso.

export function GradeAprazamento({ unidadeId, podeEditar }: { unidadeId: string; podeEditar: boolean }) {
  const grade = useQuery({
    queryKey: ['grade-aprazamento', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('grade_aprazamento_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Grade
    },
  })
  if (grade.isLoading) return <Spinner />
  if (grade.error) return <p className="text-sm text-critico">{(grade.error as Error).message}</p>
  return <FormGrade key={grade.data!.atualizado_em ?? 'padrao'} inicial={grade.data!} unidadeId={unidadeId} podeEditar={podeEditar} />
}

function FormGrade({ inicial, unidadeId, podeEditar }: { inicial: Grade; unidadeId: string; podeEditar: boolean }) {
  const qc = useQueryClient()
  const [inicio, setInicio] = React.useState(inicial.inicio)
  // texto de cada intervalo; vazio = segue o início
  const [textos, setTextos] = React.useState<Record<number, string>>(() => Object.fromEntries(INTERVALOS_GRADE.map((n) => {
    const g = inicial.grades[String(n)]
    return [n, g?.origem === 'grade da unidade' ? g.horarios.join(', ') : '']
  })))
  const [salvando, setSalvando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const inicioOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(inicio)

  async function salvar() {
    setSalvando(true); setErro(null); setMsg(null)
    const grades: Record<string, string[]> = {}
    for (const n of INTERVALOS_GRADE) {
      const t = textos[n]?.trim()
      if (!t) continue
      const { horarios, invalidos } = lerHorarios(t)
      if (invalidos.length) { setSalvando(false); return setErro(`${n}/${n} h: horário inválido (${invalidos.join(', ')}).`) }
      // igual ao que o início já dá: não precisa guardar
      if (!mesmaLista(horarios, horariosPorIntervalo(inicio, n))) grades[String(n)] = horarios
    }
    const { error } = await supabase.rpc('salvar_grade_aprazamento', { p_unidade: unidadeId, p_inicio: inicio, p_grades: grades })
    setSalvando(false)
    if (error) return setErro(error.message)
    setMsg('Grade salva.')
    void qc.invalidateQueries({ queryKey: ['grade-aprazamento', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['sugestoes-aprazamento'] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-tinta-sussurro" />
          Grade de aprazamento
        </CardTitle>
        <CardDescription>
          Horários sugeridos à enfermagem na Checagem, pela frequência escrita na prescrição (8/8h, 12/12h, 2x ao dia…).
          Sem configuração, o dia começa às 06:00. A enfermagem ajusta caso a caso e o ajuste fica registrado.
          {!podeEditar && ' Só o gestor da unidade altera.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grade-inicio">Início do dia de medicação</Label>
          <Input id="grade-inicio" type="time" className="w-32" value={inicio} disabled={!podeEditar} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {INTERVALOS_GRADE.map((n) => {
            const derivada = inicioOk ? horariosPorIntervalo(inicio, n).join(', ') : '—'
            return (
              <div key={n} className="flex flex-col gap-1">
                <Label htmlFor={`grade-${n}`}>{n}/{n} h <span className="font-normal text-tinta-sussurro">({24 / n} horário{24 / n > 1 ? 's' : ''})</span></Label>
                <Input id={`grade-${n}`} value={textos[n] ?? ''} disabled={!podeEditar} placeholder={derivada}
                  onChange={(e) => setTextos((t) => ({ ...t, [n]: e.target.value }))} />
                <span className="text-xs text-tinta-sussurro">{textos[n]?.trim() ? 'Grade própria da unidade.' : `Segue o início: ${derivada}.`}</span>
              </div>
            )
          })}
        </div>
        {erro && <p className="text-sm text-critico">{erro}</p>}
        {msg && <p className="text-sm text-conforme">{msg}</p>}
        {podeEditar && (
          <div>
            <Button onClick={salvar} disabled={salvando || !inicioOk}>
              {salvando ? <Loader2 className="animate-spin" /> : <Check />} Salvar grade
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
