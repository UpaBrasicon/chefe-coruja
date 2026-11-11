// Incluir paciente direto do painel do hiperdia (pendência da 5A, tarefa 7;
// pedida pelo RT em 05/11/2026). Busca o cadastro da UBS (buscar_pacientes,
// como na agenda) e inclui pela mesma RPC da consulta (programa_incluir), que só
// aceita o médico ou o enfermeiro da UBS. A saída continua na consulta, com
// motivo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserPlus } from 'lucide-react'
import * as React from 'react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROTULO_PROGRAMA, type Programa } from '@/domain/hiperdia'
import { rotuloIdade } from '@/domain/idade'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function IncluirNoHiperdia({ unidadeId, jaNoPrograma }: {
  unidadeId: string
  /** programas ativos por paciente, para não oferecer o que ele já tem */
  jaNoPrograma: Record<string, Programa[]>
}) {
  const [aberto, setAberto] = React.useState(false)
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}><UserPlus /> Incluir paciente</Button>
      {aberto && <Dialogo unidadeId={unidadeId} jaNoPrograma={jaNoPrograma} onFechar={() => setAberto(false)} />}
    </>
  )
}

function Dialogo({ unidadeId, jaNoPrograma, onFechar }: {
  unidadeId: string; jaNoPrograma: Record<string, Programa[]>; onFechar: () => void
}) {
  const qc = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [paciente, setPaciente] = React.useState<Achado | null>(null)
  const [feito, setFeito] = React.useState<string | null>(null)
  const t = useValorAdiado(termo.trim())
  const achados = useQuery({
    queryKey: ['hiperdia-busca-paciente', unidadeId, t],
    enabled: t.length >= 3 && !paciente,
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: t })
      if (error) throw error
      return ((data ?? []) as Achado[]).slice(0, 8)
    },
  })
  const incluir = useMutation({
    mutationFn: async (programa: Programa) => {
      const { error } = await supabase.rpc('programa_incluir', { p_paciente: paciente!.id, p_programa: programa })
      if (error) throw error
      return programa
    },
    onSuccess: (programa) => {
      setFeito(`${paciente!.nome_social || paciente!.nome} entrou no programa de ${ROTULO_PROGRAMA[programa].toLowerCase()}.`)
      setPaciente(null); setTermo('')
      void qc.invalidateQueries({ queryKey: ['hiperdia'] })
    },
  })
  const ativos = paciente ? jaNoPrograma[paciente.id] ?? [] : []
  const hoje = dataIso()

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Incluir no hiperdia</DialogTitle>
          <DialogDescription>Paciente com cadastro na unidade. Quem tem hipertensão ou diabetes registrado na consulta já entra sozinho.</DialogDescription>
        </DialogHeader>
        {feito && <p role="status" className="rounded-cartao bg-alerta-conforme px-3 py-2 text-apoio text-conforme">{feito}</p>}
        {!paciente ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hiperdia-busca">Paciente</Label>
            <Input id="hiperdia-busca" value={termo} onChange={(e) => { setTermo(e.target.value); setFeito(null) }}
              placeholder="Nome, CPF, CNS ou prontuário" autoComplete="off" autoFocus />
            {t.length > 0 && t.length < 3 && <span className="text-rotulo text-tinta-sussurro">Digite ao menos 3 letras.</span>}
            {achados.error && <p role="alert" className="text-apoio text-critico">{msg(achados.error)}</p>}
            {(achados.data ?? []).length > 0 && (
              <ul className="flex flex-col rounded-controle border border-fio bg-superficie">
                {(achados.data ?? []).map((a) => (
                  <li key={a.id}>
                    <BotaoLinha variante="linha" onClick={() => setPaciente(a)} className="py-2 text-apoio">
                      {a.nome_social || a.nome}
                      {a.data_nascimento && <span className="text-tinta-sussurro"> · {rotuloIdade(a.data_nascimento, hoje)}</span>}
                      {(jaNoPrograma[a.id] ?? []).length > 0 && <span className="text-tinta-sussurro"> · já no hiperdia</span>}
                    </BotaoLinha>
                  </li>
                ))}
              </ul>
            )}
            {t.length >= 3 && achados.isSuccess && (achados.data ?? []).length === 0 && (
              <span className="text-apoio text-tinta-sussurro">Nenhum cadastro com esse termo. O cadastro é feito na Nova ficha.</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-controle text-tinta">
              <strong>{paciente.nome_social || paciente.nome}</strong>
              {paciente.data_nascimento && <span className="text-apoio text-tinta-sussurro"> · {rotuloIdade(paciente.data_nascimento, hoje)}</span>}
            </span>
            <div className="flex flex-wrap gap-2">
              {(['hipertensao', 'diabetes'] as const).map((p) => ativos.includes(p)
                ? <span key={p} className="rounded-capsula bg-trilha px-2.5 py-1 text-apoio text-tinta-apoio">Já no programa de {ROTULO_PROGRAMA[p].toLowerCase()}</span>
                : <Button key={p} size="sm" variant="outline" disabled={incluir.isPending} onClick={() => incluir.mutate(p)}><Plus /> {ROTULO_PROGRAMA[p]}</Button>)}
            </div>
            {incluir.error && <p role="alert" className="text-apoio text-critico">{msg(incluir.error)}</p>}
            <Button size="sm" variant="outline" className="self-start" onClick={() => { setPaciente(null); incluir.reset() }}>Escolher outro paciente</Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
