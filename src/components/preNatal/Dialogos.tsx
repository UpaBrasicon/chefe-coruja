// Pré-natal da UBS (5A, tarefa 7; K2 do RT em 05/11/2026): incluir a gestante
// à mão, registrar ou corrigir a DUM, registrar o parto ou o aborto e retirar
// com motivo. As RPCs (migration 20270222000001) só aceitam o médico ou o
// enfermeiro da UBS.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rotuloIdade } from '@/domain/idade'
import { JANELA, diasEntre, rotuloIG, somarDias, type Gestacao } from '@/domain/preNatal'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const MAIS_ANTIGA = JANELA.fim + JANELA.puerperio

/** Campo da DUM, com a idade gestacional que ela dá hoje. */
export function CampoDum({ id, valor, onMudar }: { id: string; valor: string; onMudar: (v: string) => void }) {
  const hoje = dataIso()
  const ig = valor && valor <= hoje ? diasEntre(valor, hoje) : null
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>DUM (data da última menstruação)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} type="date" className="w-44" value={valor} max={hoje} min={somarDias(hoje, -MAIS_ANTIGA)} onChange={(e) => onMudar(e.target.value)} />
        {ig !== null && ig <= MAIS_ANTIGA && <span className="text-apoio text-tinta-apoio">IG hoje {rotuloIG(ig)} · DPP {somarDias(valor, 280).split('-').reverse().join('/')}</span>}
      </div>
    </div>
  )
}
const dumValida = (v: string) => !!v && v <= dataIso() && diasEntre(v, dataIso()) <= MAIS_ANTIGA

/** "Incluir gestante" no topo do painel: busca o cadastro da UBS e pede a DUM. */
export function IncluirGestante({ unidadeId }: { unidadeId: string }) {
  const [aberto, setAberto] = React.useState(false)
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}><UserPlus /> Incluir gestante</Button>
      {aberto && <DialogoIncluir unidadeId={unidadeId} onFechar={() => setAberto(false)} />}
    </>
  )
}

function DialogoIncluir({ unidadeId, onFechar }: { unidadeId: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [paciente, setPaciente] = React.useState<Achado | null>(null)
  const [dum, setDum] = React.useState('')
  const [feito, setFeito] = React.useState<string | null>(null)
  const t = termo.trim()
  const achados = useQuery({
    queryKey: ['pre-natal-busca-paciente', unidadeId, t],
    enabled: t.length >= 3 && !paciente,
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: t })
      if (error) throw error
      return ((data ?? []) as Achado[]).slice(0, 8)
    },
  })
  const incluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pre_natal_incluir', { p_paciente: paciente!.id, p_dum: dum || undefined })
      if (error) throw error
    },
    onSuccess: () => {
      setFeito(`${paciente!.nome_social || paciente!.nome} entrou no pré-natal.`)
      setPaciente(null); setTermo(''); setDum('')
      void qc.invalidateQueries({ queryKey: ['pre-natal'] })
    },
  })
  const hoje = dataIso()
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Incluir no pré-natal</DialogTitle>
          <DialogDescription>Paciente com cadastro na unidade. Quem tem "pré-natal" ou o CID/CIAP de gestação na consulta já entra sozinha.</DialogDescription>
        </DialogHeader>
        {feito && <p role="status" className="rounded-cartao bg-alerta-conforme px-3 py-2 text-apoio text-conforme">{feito}</p>}
        {!paciente ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pre-natal-busca">Paciente</Label>
            <Input id="pre-natal-busca" value={termo} onChange={(e) => { setTermo(e.target.value); setFeito(null) }}
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
          <div className="flex flex-col gap-3">
            <span className="text-controle text-tinta">
              <strong>{paciente.nome_social || paciente.nome}</strong>
              {paciente.data_nascimento && <span className="text-apoio text-tinta-sussurro"> · {rotuloIdade(paciente.data_nascimento, hoje)}</span>}
            </span>
            <CampoDum id="pre-natal-incluir-dum" valor={dum} onMudar={setDum} />
            <span className="text-rotulo text-tinta-sussurro">Sem a DUM a gestante entra, mas o painel não sabe a semana nem os prazos até alguém registrar.</span>
            {incluir.error && <p role="alert" className="text-apoio text-critico">{msg(incluir.error)}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={(!!dum && !dumValida(dum)) || incluir.isPending} onClick={() => incluir.mutate()}>Incluir no pré-natal</Button>
              <Button size="sm" variant="ghost" onClick={() => { setPaciente(null); incluir.reset() }}>Escolher outra paciente</Button>
            </div>
          </div>
        )}
        <div className="flex justify-end"><Button variant="ghost" onClick={onFechar}>Fechar</Button></div>
      </DialogContent>
    </Dialog>
  )
}

/** Registrar a DUM que falta ou corrigir a registrada. */
export function DialogoDum({ g, nome, onFechar }: { g: Gestacao; nome: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [dum, setDum] = React.useState(g.dum ?? '')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pre_natal_definir_dum', { p_gestacao: g.id, p_dum: dum })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['pre-natal'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{g.dum ? 'Corrigir a DUM' : 'Registrar a DUM'}</DialogTitle>
          <DialogDescription>{nome}. A DUM dá a semana da gestação, a DPP e os prazos da régua.</DialogDescription>
        </DialogHeader>
        <CampoDum id="pre-natal-dum" valor={dum} onMudar={setDum} />
        {salvar.error && <p role="alert" className="text-apoio text-critico">{msg(salvar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={!dumValida(dum) || dum === g.dum || salvar.isPending} onClick={() => salvar.mutate()}>Salvar a DUM</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Parto (abre o puerpério de 42 dias) ou aborto (interrompe o acompanhamento). */
export function DialogoDesfecho({ g, nome, onFechar }: { g: Gestacao; nome: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [desfecho, setDesfecho] = React.useState<'parto' | 'aborto' | null>(g.desfecho)
  const [quando, setQuando] = React.useState(g.desfecho_em ?? '')
  const hoje = dataIso()
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pre_natal_registrar_desfecho', { p_gestacao: g.id, p_desfecho: desfecho!, p_data: quando })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['pre-natal'] }); onFechar() },
  })
  const valida = !!desfecho && !!quando && quando <= hoje && (!g.dum || quando >= g.dum)
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fim da gestação</DialogTitle>
          <DialogDescription>{nome}. O parto abre o puerpério de 42 dias; o aborto encerra o acompanhamento (nota C3).</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Desfecho da gestação" className="flex flex-wrap gap-2">
          <Chip variante="opcao" radio ativo={desfecho === 'parto'} onClick={() => setDesfecho('parto')}>Parto</Chip>
          <Chip variante="opcao" radio ativo={desfecho === 'aborto'} onClick={() => setDesfecho('aborto')}>Aborto</Chip>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="pre-natal-desfecho-data">Data</Label>
          <Input id="pre-natal-desfecho-data" type="date" className="w-44" value={quando} max={hoje} min={g.dum ?? undefined} onChange={(e) => setQuando(e.target.value)} />
        </div>
        {salvar.error && <p role="alert" className="text-apoio text-critico">{msg(salvar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={!valida || salvar.isPending} onClick={() => salvar.mutate()}>Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DialogoRetirar({ g, nome, onFechar }: { g: Gestacao; nome: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = React.useState('')
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pre_natal_retirar', { p_gestacao: g.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['pre-natal'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar do pré-natal</DialogTitle>
          <DialogDescription>{nome} sai do painel. Para o fim da gestação, use "Fim da gestação" (parto ou aborto).</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pre-natal-retirar-motivo">Motivo</Label>
          <Input id="pre-natal-retirar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: mudou de território" />
        </div>
        {retirar.error && <p role="alert" className="text-apoio text-critico">{msg(retirar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button variant="destructive" disabled={motivo.trim().length < 5 || retirar.isPending} onClick={() => retirar.mutate()}>Retirar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
