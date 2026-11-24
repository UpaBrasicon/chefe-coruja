import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { TituloCartao, VazioLinha } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { conferirMeta, indicadorMeta, INDICADORES_META, SUFIXO, type Sentido } from '@/lib/boletim'
import { dataIso, dataPura, numeroAte } from '@/lib/formato'
import type { Indicadores } from '@/lib/secretariaCompleta'
import { supabase } from '@/lib/supabase'

// Metas do contrato de gestão por unidade (P2 do RT, 24/11/2026): o Gestor da
// secretaria escolhe a unidade e o indicador, põe a meta, o sentido, o peso e a
// vigência. O boletim mostra meta, realizado e "cumpriu". O banco confere quem
// grava e a vigência sobreposta (salvar_meta_contrato, migration 20270421000080).

type Meta = {
  id: string
  indicador: string
  meta: number
  sentido: string
  peso: number | null
  vigente_de: string
  vigente_ate: string | null
  observacao: string | null
}

type Form = { id: string | null; indicador: string; meta: string; sentido: Sentido; peso: string; vigente_de: string; vigente_ate: string; observacao: string }

const VAZIO = (): Form => ({
  id: null, indicador: '', meta: '', sentido: 'maior', peso: '', vigente_de: `${dataIso().slice(0, 4)}-01-01`, vigente_ate: '', observacao: '',
})

const numeroDoCampo = (s: string) => Number(s.replace(',', '.'))

export default function MetasContrato() {
  const queryClient = useQueryClient()
  const hoje = dataIso()
  const lista = useQuery({
    queryKey: ['secretaria-indicadores', hoje.slice(0, 7)],
    queryFn: async () => {
      const [ano, mes] = hoje.slice(0, 7).split('-').map(Number)
      const { data, error } = await supabase.rpc('secretaria_indicadores', { p_ano: ano, p_mes: mes })
      if (error) throw error
      return data as unknown as Indicadores
    },
  })
  const unidades = React.useMemo(() => lista.data?.unidades ?? [], [lista.data])
  const [escolhida, setUnidade] = React.useState('')
  const unidade = escolhida || unidades[0]?.id || ''
  const [form, setForm] = React.useState<Form | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  const metas = useQuery({
    queryKey: ['metas-contrato', unidade],
    enabled: !!unidade,
    queryFn: async () => {
      const { data, error } = await supabase.from('metas_contrato')
        .select('id, indicador, meta, sentido, peso, vigente_de, vigente_ate, observacao')
        .eq('unidade_id', unidade).order('indicador').order('vigente_de', { ascending: false })
      if (error) throw error
      return (data ?? []) as Meta[]
    },
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['metas-contrato', unidade] })
    queryClient.invalidateQueries({ queryKey: ['secretaria-boletim'] })
  }

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const { error } = await supabase.rpc('salvar_meta_contrato', {
        p_unidade: unidade, p_indicador: f.indicador, p_meta: numeroDoCampo(f.meta), p_sentido: f.sentido,
        p_vigente_de: f.vigente_de, p_id: f.id, p_peso: f.peso.trim() === '' ? null : numeroDoCampo(f.peso),
        p_vigente_ate: f.vigente_ate || null, p_observacao: f.observacao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => { setForm(null); invalidar() },
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remover_meta_contrato', { p_id: id })
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const problema = conferirMeta(form)
    setAviso(problema)
    if (!problema) salvar.mutate(form)
  }

  const escolherIndicador = (chave: string) => {
    const ind = indicadorMeta(chave)
    setForm((f) => f && { ...f, indicador: chave, sentido: ind?.sentido ?? f.sentido })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="metas-unidade">Unidade</Label>
            <CampoSelecao id="metas-unidade" value={unidade} onChange={(e) => { setUnidade(e.target.value); setForm(null) }} className="min-w-[220px]">
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </CampoSelecao>
          </div>
          <p className="max-w-[460px] text-apoio text-tinta-sussurro">
            As metas do contrato de gestão desta unidade. O boletim mostra a meta, o realizado e se cumpriu, mês a mês.
          </p>
          <Button className="ml-auto" disabled={!unidade || !!form} onClick={() => { setAviso(null); setForm(VAZIO()) }}>
            <Plus />
            Nova meta
          </Button>
        </CardContent>
      </Card>

      {lista.error && <MensagemErro erro={lista.error} acao="carregar as unidades" />}

      {form && (
        <Card>
          <CardContent>
            <form onSubmit={enviar} className="flex flex-col gap-4">
              <TituloCartao className="mb-0">{form.id ? 'Mudar meta' : 'Nova meta'}</TituloCartao>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label htmlFor="meta-indicador">Indicador</Label>
                  <CampoSelecao id="meta-indicador" value={form.indicador} onChange={(e) => escolherIndicador(e.target.value)}>
                    <option value="">Escolha o indicador</option>
                    {INDICADORES_META.map((i) => <option key={i.chave} value={i.chave}>{i.rotulo}</option>)}
                  </CampoSelecao>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-valor">Meta{form.indicador ? ` (${rotuloMedida(form.indicador)})` : ''}</Label>
                  <Input id="meta-valor" inputMode="decimal" value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-sentido">Cumpre quando o realizado fica</Label>
                  <CampoSelecao id="meta-sentido" value={form.sentido} onChange={(e) => setForm({ ...form, sentido: e.target.value as Sentido })}>
                    <option value="maior">Na meta ou acima</option>
                    <option value="menor">Na meta ou abaixo</option>
                  </CampoSelecao>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-de">Vigente desde</Label>
                  <Input id="meta-de" type="date" value={form.vigente_de} onChange={(e) => setForm({ ...form, vigente_de: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-ate">Vigente até (opcional)</Label>
                  <Input id="meta-ate" type="date" value={form.vigente_ate} onChange={(e) => setForm({ ...form, vigente_ate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-peso">Peso no repasse, em % (opcional)</Label>
                  <Input id="meta-peso" inputMode="decimal" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="meta-obs">Observação (opcional)</Label>
                  <Input id="meta-obs" maxLength={500} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
                </div>
              </div>
              {aviso && <MensagemErro texto={aviso} formato="linha" />}
              {salvar.error && <MensagemErro erro={salvar.error} acao="gravar a meta" />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? <Spinner /> : 'Gravar meta'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-2">
          <TituloCartao className="mb-0">Metas cadastradas</TituloCartao>
          {metas.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
          {metas.error && <MensagemErro erro={metas.error} acao="carregar as metas" />}
          {remover.error && <MensagemErro erro={remover.error} acao="remover a meta" />}
          {metas.data && metas.data.length === 0 && <VazioLinha>Esta unidade ainda não tem meta do contrato.</VazioLinha>}
          {metas.data && metas.data.length > 0 && (
            <Table className="w-full min-w-[640px] text-apoio">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left font-medium">Indicador</TableHead>
                  <TableHead className="text-right font-medium">Meta</TableHead>
                  <TableHead className="text-right font-medium">Peso</TableHead>
                  <TableHead className="text-left font-medium">Vigência</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metas.data.map((m) => {
                  const ind = indicadorMeta(m.indicador)
                  const suf = ind ? SUFIXO[ind.medida] : ''
                  return (
                    <TableRow key={m.id} className="border-t border-fio">
                      <TableCell className="py-2 text-tinta">
                        {ind?.rotulo ?? m.indicador}
                        {m.observacao && <span className="block text-rotulo text-tinta-sussurro">{m.observacao}</span>}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular">{m.sentido === 'maior' ? '≥' : '≤'} {numeroAte(m.meta, 2)}{suf}</TableCell>
                      <TableCell className="py-2 text-right tabular">{m.peso === null ? '—' : `${numeroAte(m.peso, 2)}%`}</TableCell>
                      <TableCell className="py-2 tabular">
                        {dataPura(m.vigente_de)}{m.vigente_ate ? ` a ${dataPura(m.vigente_ate)}` : ' em diante'}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Mudar meta" disabled={!!form}
                            onClick={() => {
                              setAviso(null)
                              setForm({
                                id: m.id, indicador: m.indicador, meta: String(m.meta).replace('.', ','), sentido: m.sentido as Sentido,
                                peso: m.peso === null ? '' : String(m.peso).replace('.', ','), vigente_de: m.vigente_de,
                                vigente_ate: m.vigente_ate ?? '', observacao: m.observacao ?? '',
                              })
                            }}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Remover meta" disabled={remover.isPending}
                            onClick={() => {
                              if (window.confirm(`Remover a meta "${ind?.rotulo ?? m.indicador}"? O registro fica na auditoria.`)) remover.mutate(m.id)
                            }}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function rotuloMedida(chave: string): string {
  const m = indicadorMeta(chave)?.medida
  return m === 'pct' ? 'em %' : m === 'min' ? 'em minutos' : m === 'dias' ? 'em dias' : 'quantidade'
}
