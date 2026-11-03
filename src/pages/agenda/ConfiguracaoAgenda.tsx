// Configuração da agenda (5A, tarefa 3, parte 3.2; F1 e F2 do RT): o gestor
// define, por profissional, os dias, os períodos com início e fim e a duração
// da consulta (Manual do PEC, seção 3.5.5), e fecha a agenda por um período
// com motivo (seção 3.5.6). Mudar a grade não mexe no que já está marcado.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarX, Save } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DIAS_SEMANA, MOTIVOS_FECHAMENTO, PERIODOS, rotuloMotivo,
  type HorarioConfig, type MotivoFechamento, type Periodo, type ProfissionalConfig,
} from '@/domain/agenda'
import { dataIso, dataPura } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

import { useConfiguracaoAgenda } from './useAgenda'

type Celula = { ativo: boolean; inicio: string; fim: string; duracao: number }
const PADRAO: Record<Periodo, Omit<Celula, 'ativo'>> = {
  manha: { inicio: '07:00', fim: '11:00', duracao: 20 },
  tarde: { inicio: '13:00', fim: '17:00', duracao: 20 },
  noite: { inicio: '18:00', fim: '21:00', duracao: 20 },
}
const DURACOES = [10, 15, 20, 30, 40, 60]
// segunda a sábado, e o domingo por último
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]
const chave = (dia: number, p: Periodo) => `${dia}-${p}`
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

function gradeDe(p: ProfissionalConfig | undefined): Record<string, Celula> {
  const g: Record<string, Celula> = {}
  for (const dia of ORDEM_DIAS) for (const { valor } of PERIODOS) g[chave(dia, valor)] = { ativo: false, ...PADRAO[valor] }
  for (const h of p?.horarios ?? []) g[chave(h.dia, h.periodo)] = { ativo: true, inicio: h.inicio, fim: h.fim, duracao: h.duracao }
  return g
}

export function ConfiguracaoAgenda({ unidadeId }: { unidadeId: string }) {
  const config = useConfiguracaoAgenda(unidadeId)
  const lista = config.data ?? []
  const [perfil, setPerfil] = React.useState('')
  const prof = lista.find((p) => p.perfil_id === perfil) ?? lista[0]

  if (config.isLoading) return <Spinner />
  if (config.error) return <p className="text-apoio text-critico">{msg(config.error)}</p>
  if (lista.length === 0) return <p className="text-apoio text-tinta-sussurro">Nenhum médico ou enfermeiro com vínculo ativo nesta unidade.</p>

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Profissional" className="flex flex-wrap gap-2">
        {lista.map((p) => (
          <Chip key={p.perfil_id} variante="opcao" radio ativo={p.perfil_id === prof?.perfil_id} contagem={p.horarios.length || undefined}
            onClick={() => setPerfil(p.perfil_id)}>
            {p.nome} <span className="text-tinta-sussurro">· {p.papel === 'enfermeiro' ? 'enfermagem' : 'médico'}</span>
          </Chip>
        ))}
      </div>
      {prof && <Grade key={prof.perfil_id} unidadeId={unidadeId} prof={prof} />}
      {prof && <Fechamentos key={`f-${prof.perfil_id}`} unidadeId={unidadeId} prof={prof} />}
    </div>
  )
}

function Grade({ unidadeId, prof }: { unidadeId: string; prof: ProfissionalConfig }) {
  const qc = useQueryClient()
  const [g, setG] = React.useState(() => gradeDe(prof))
  const [salvo, setSalvo] = React.useState(false)
  const mudar = (k: string, v: Partial<Celula>) => { setSalvo(false); setG((x) => ({ ...x, [k]: { ...x[k], ...v } })) }
  const copiarSegunda = () => {
    setSalvo(false)
    setG((x) => {
      const n = { ...x }
      for (const dia of [2, 3, 4, 5]) for (const { valor } of PERIODOS) n[chave(dia, valor)] = { ...x[chave(1, valor)] }
      return n
    })
  }
  const salvar = useMutation({
    mutationFn: async () => {
      const horarios: HorarioConfig[] = []
      for (const dia of ORDEM_DIAS) for (const { valor } of PERIODOS) {
        const c = g[chave(dia, valor)]
        if (c.ativo) horarios.push({ dia, periodo: valor, inicio: c.inicio, fim: c.fim, duracao: c.duracao })
      }
      const { error } = await supabase.rpc('agenda_definir_configuracao', { p_unidade: unidadeId, p_perfil: prof.perfil_id, p_horarios: horarios })
      if (error) throw error
    },
    onSuccess: () => {
      setSalvo(true)
      void qc.invalidateQueries({ queryKey: ['agenda-configuracao'] })
      void qc.invalidateQueries({ queryKey: ['agenda-dia'] })
    },
  })

  return (
    <section aria-label={`Grade de ${prof.nome}`} className="overflow-x-auto rounded-cartao border border-fio bg-superficie">
      <Table aria-label={`Grade de ${prof.nome}`} className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Dia</TableHead>
            {PERIODOS.map((p) => <TableHead key={p.valor}>{p.rotulo}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ORDEM_DIAS.map((dia) => (
            <TableRow key={dia}>
              <TableCell className="font-medium text-tinta">{DIAS_SEMANA[dia]}</TableCell>
              {PERIODOS.map((p) => {
                const k = chave(dia, p.valor)
                const c = g[k]
                return (
                  <TableCell key={k} className="align-top">
                    <div className="flex flex-col gap-1.5">
                      <CaixaMarcar marcado={c.ativo} onChange={(m) => mudar(k, { ativo: m })}>
                        <span className="text-apoio text-tinta-apoio">{c.ativo ? 'Atende' : 'Não atende'}</span>
                      </CaixaMarcar>
                      {c.ativo && (
                        <div className="flex items-center gap-1.5">
                          <Input type="time" aria-label={`${DIAS_SEMANA[dia]}, ${p.rotulo}: início`} value={c.inicio} className="w-[104px]"
                            onChange={(e) => mudar(k, { inicio: e.target.value })} />
                          <span className="text-tinta-sussurro">a</span>
                          <Input type="time" aria-label={`${DIAS_SEMANA[dia]}, ${p.rotulo}: fim`} value={c.fim} className="w-[104px]"
                            onChange={(e) => mudar(k, { fim: e.target.value })} />
                          <CampoSelecao tamanho="compacto" aria-label={`${DIAS_SEMANA[dia]}, ${p.rotulo}: duração`} value={c.duracao}
                            onChange={(e) => mudar(k, { duracao: Number(e.target.value) })}>
                            {DURACOES.map((d) => <option key={d} value={d}>{d} min</option>)}
                          </CampoSelecao>
                        </div>
                      )}
                    </div>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-2 border-t border-trilha px-4 py-3">
        <Button variant="outline" size="sm" onClick={copiarSegunda}>Copiar a segunda para terça a sexta</Button>
        <span className="mr-auto text-rotulo text-tinta-sussurro">O que já está marcado não muda; os horários novos valem para as próximas marcações.</span>
        {salvar.error && <span role="alert" className="text-apoio text-critico">{msg(salvar.error)}</span>}
        {salvo && <span role="status" className="text-apoio text-conforme">Grade salva.</span>}
        <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}><Save /> Salvar a grade</Button>
      </div>
    </section>
  )
}

function Fechamentos({ unidadeId, prof }: { unidadeId: string; prof: ProfissionalConfig }) {
  const qc = useQueryClient()
  const hoje = dataIso()
  const [inicio, setInicio] = React.useState(hoje)
  const [fim, setFim] = React.useState(hoje)
  const [motivo, setMotivo] = React.useState<MotivoFechamento | null>(null)
  const [especifique, setEspecifique] = React.useState('')
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['agenda-configuracao'] })
    void qc.invalidateQueries({ queryKey: ['agenda-dia'] })
  }
  const fechar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('agenda_fechar', {
        p_unidade: unidadeId, p_perfil: prof.perfil_id, p_inicio: inicio, p_fim: fim, p_motivo: motivo!, p_especifique: especifique.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setMotivo(null); setEspecifique(''); invalidar() },
  })
  const reabrir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('agenda_reabrir', { p_fechamento: id })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const pronto = !!motivo && fim >= inicio && (motivo !== 'outro' || especifique.trim().length >= 3)

  return (
    <section aria-label="Fechamentos da agenda" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3.5">
      <span className="flex items-center gap-2 text-controle font-semibold text-tinta"><CalendarX className="size-4 text-acao" aria-hidden /> Fechar a agenda</span>
      {prof.fechamentos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {prof.fechamentos.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-apoio text-tinta-apoio">
              <span className="tabular-nums">{dataPura(f.inicio)}{f.fim !== f.inicio ? ` a ${dataPura(f.fim)}` : ''}</span>
              <span>· {rotuloMotivo(MOTIVOS_FECHAMENTO, f.motivo)}{f.especifique ? `: ${f.especifique}` : ''}</span>
              <Button size="xs" variant="outline" disabled={reabrir.isPending} onClick={() => reabrir.mutate(f.id)}>Reabrir</Button>
            </li>
          ))}
        </ul>
      )}
      {reabrir.error && <p role="alert" className="text-apoio text-critico">{msg(reabrir.error)}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fech-inicio">De</Label>
          <Input id="fech-inicio" type="date" min={hoje} value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fech-fim">Até</Label>
          <Input id="fech-fim" type="date" min={inicio} value={fim} onChange={(e) => setFim(e.target.value)} className="w-[160px]" />
        </div>
      </div>
      <div role="radiogroup" aria-label="Motivo do fechamento" className="flex flex-wrap gap-2">
        {MOTIVOS_FECHAMENTO.map((m) => <Chip key={m.valor} variante="opcao" radio ativo={motivo === m.valor} onClick={() => setMotivo(m.valor)}>{m.rotulo}</Chip>)}
      </div>
      {motivo === 'outro' && <Input aria-label="Especifique" placeholder="Especifique" value={especifique} onChange={(e) => setEspecifique(e.target.value)} />}
      {fechar.error && <p role="alert" className="text-apoio text-critico">{msg(fechar.error)}</p>}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-rotulo text-tinta-sussurro">Com consulta marcada no período, a agenda não fecha: cancele ou remarque antes.</span>
        <Button disabled={!pronto || fechar.isPending} onClick={() => fechar.mutate()}><CalendarX /> Fechar a agenda</Button>
      </div>
    </section>
  )
}
