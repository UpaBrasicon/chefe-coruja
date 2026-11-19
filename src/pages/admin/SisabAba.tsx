// ─────────────────────────────────────────────────────────────────────────────
// Integrações — aba SISAB (percurso da UBS, U15, PR 5). Só na UBS.
//
// O gestor configura o envio das fichas do LEDI APS ao PEC e-SUS APS do
// município (IBGE, INE e endereço do PEC), liga ou desliga o envio e
// acompanha a fila: o motivo de cada ficha retida ou com erro e o reenvio.
// A credencial da API do PEC fica no serviço de envio, não na tela.
// Banco: migrations 20270415000022 a 20270415000024.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCw, Send } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { diaMesHora } from '@/lib/formato'
import type { StatusItem } from '@/lib/rnds'
import {
  acaoDaFicha, conferirConfig, faltaParaLigar, motivoDaFicha, ROTULO_FICHA, ROTULO_STATUS, VARIANTE_STATUS,
  type ItemSisab, type PainelSisab,
} from '@/lib/sisab'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5 align-top'

function useRecarregar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['sisab-painel'] })
    void qc.invalidateQueries({ queryKey: ['sisab-itens'] })
  }
}

export function SisabAba() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const painel = useQuery({
    queryKey: ['sisab-painel', unidade],
    enabled: !!unidade,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledi_painel', { p_unidade: unidade! })
      if (error) throw error
      return data as unknown as PainelSisab
    },
    refetchInterval: 60_000,
  })
  if (!unidade) return <Vazio icone={Send} titulo="Escolha a unidade" texto="O envio ao SISAB é configurado por UBS." />
  if (!painel.data) return painel.error ? <MensagemErro texto={(painel.error as Error).message} /> : <Spinner />
  const p = painel.data
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-apoio text-tinta-apoio">
        Os atendimentos e os procedimentos da UBS vão ao SISAB pelo PEC e-SUS APS do município, em fichas do LEDI APS 8.7.0.
        Cada atendimento encerrado entra na fila; com o envio ligado, o serviço manda as fichas ao PEC.
      </p>
      <Contagem p={p} />
      {/* montado com a chave da última gravação: os campos nascem do que está no banco */}
      <SecaoConfig key={p.config?.atualizado_em ?? 'nova'} p={p} unidade={unidade} />
      <SecaoEnvio p={p} unidade={unidade} />
      <SecaoFila unidade={unidade} />
    </div>
  )
}

function Contagem({ p }: { p: PainelSisab }) {
  const itens: StatusItem[] = ['pendente', 'retido', 'erro', 'enviado']
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-container border border-fio bg-superficie sm:grid-cols-4">
      {itens.map((s, n) => (
        <div key={s} className={cn('flex flex-col gap-0.5 px-4 py-3', n > 0 && 'sm:border-l sm:border-trilha', n % 2 === 1 && 'border-l border-trilha', n >= 2 && 'border-t border-trilha sm:border-t-0')}>
          <dt className="text-rotulo text-tinta-sussurro">{ROTULO_STATUS[s]}</dt>
          <dd className="tabular text-corpo font-semibold text-tinta">{p.contagem[s]}</dd>
        </div>
      ))}
    </dl>
  )
}

function SecaoConfig({ p, unidade }: { p: PainelSisab; unidade: string }) {
  const recarregar = useRecarregar()
  const [ibge, setIbge] = React.useState(p.config?.codigo_ibge ?? '')
  const [ine, setIne] = React.useState(p.config?.ine ?? '')
  const [url, setUrl] = React.useState(p.config?.pec_url ?? '')
  const problema = conferirConfig(ibge, ine, url)
  const mudou = ibge !== (p.config?.codigo_ibge ?? '') || ine !== (p.config?.ine ?? '') || url !== (p.config?.pec_url ?? '')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('ledi_salvar_config', { p_unidade: unidade, p_ibge: ibge || null, p_ine: ine || null, p_pec_url: url || null })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Dados da UBS no e-SUS APS</CardTitle>
        <CardDescription>O código IBGE e o CNES vão em toda ficha. O INE é o da equipe no CNES e é opcional. O endereço do PEC é o da instalação do município, com HTTPS.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-3 sm:grid-cols-[10rem_12rem_1fr]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sisab-ibge" className="text-rotulo">Código IBGE do município</Label>
            <Input id="sisab-ibge" className="h-8" inputMode="numeric" placeholder="7 dígitos" value={ibge} onChange={(e) => setIbge(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sisab-ine" className="text-rotulo">INE da equipe</Label>
            <Input id="sisab-ine" className="h-8" inputMode="numeric" placeholder="10 dígitos" value={ine} onChange={(e) => setIne(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sisab-pec" className="text-rotulo">Endereço do PEC</Label>
            <Input id="sisab-pec" className="h-8" placeholder="https://pec.municipio.gov.br" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <span className="text-tinta-sussurro">CNES da unidade: {p.cnes ?? 'não cadastrado'}</span>
        {problema && <span className="text-critico">{problema}</span>}
        <Button size="sm" className="self-start" disabled={!mudou || !!problema || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

function SecaoEnvio({ p, unidade }: { p: PainelSisab; unidade: string }) {
  const recarregar = useRecarregar()
  const ligado = p.config?.envio_ligado ?? false
  const falta = faltaParaLigar(p)
  const mudar = useMutation({
    mutationFn: async (novo: boolean) => {
      const { error } = await supabase.rpc('ledi_ligar_envio', { p_unidade: unidade, p_ligado: novo })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Envio ao PEC</CardTitle>
        <CardDescription>
          A credencial da API do PEC, gerada pelo administrador da instalação do município, fica no serviço de envio. Peça ao suporte para cadastrá-la antes de ligar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <span className="text-tinta">{ligado ? 'Envio ligado: as fichas da fila vão ao PEC.' : 'Envio desligado: as fichas esperam na fila.'}</span>
        {!ligado && falta.length > 0 && <span className="text-tinta-apoio">Para ligar, falta: {falta.join('; ')}.</span>}
        <Button size="sm" variant={ligado ? 'outline' : 'default'} className="self-start"
          disabled={mudar.isPending || (!ligado && falta.length > 0)} onClick={() => mudar.mutate(!ligado)}>
          {ligado ? 'Desligar o envio' : 'Ligar o envio'}
        </Button>
        {mudar.error && <MensagemErro texto={(mudar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

const FILTROS: (StatusItem | 'todos')[] = ['todos', 'erro', 'retido', 'pendente', 'enviado']

function SecaoFila({ unidade }: { unidade: string }) {
  const recarregar = useRecarregar()
  const [filtro, setFiltro] = React.useState<StatusItem | 'todos'>('todos')
  const itens = useQuery({
    queryKey: ['sisab-itens', unidade, filtro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledi_itens', { p_unidade: unidade, p_status: filtro === 'todos' ? null : filtro, p_limite: 50 })
      if (error) throw error
      return (data ?? []) as unknown as ItemSisab[]
    },
    refetchInterval: 60_000,
  })
  const reenviar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('ledi_reenviar', { p_item: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const lista = itens.data ?? []
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-corpo font-semibold text-tinta">Fila</h3>
        <span className="text-rotulo text-tinta-sussurro">as 50 mais recentes</span>
      </div>
      <Chips rotulo="Filtrar a fila">
        {FILTROS.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f === 'todos' ? 'Todas' : ROTULO_STATUS[f]}</Chip>)}
      </Chips>
      {itens.isLoading ? <Spinner /> : itens.error ? <MensagemErro texto={(itens.error as Error).message} /> : lista.length === 0 ? (
        <Vazio icone={Send} titulo="Nenhuma ficha nesta situação" />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[760px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className={th}>Ficha</TableHead><TableHead className={th}>Situação</TableHead>
                <TableHead className={th}>Motivo</TableHead><TableHead className={th}>Quando</TableHead><TableHead className={th} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((i) => {
                const acao = acaoDaFicha(i)
                return (
                  <TableRow key={i.id} className="border-b border-trilha last:border-0">
                    <TableCell className={cn(td, 'font-medium text-tinta')}>{ROTULO_FICHA[i.tipo]}</TableCell>
                    <TableCell className={td}><Badge variant={VARIANTE_STATUS[i.status]}>{ROTULO_STATUS[i.status]}</Badge></TableCell>
                    <TableCell className={cn(td, 'max-w-[380px] text-tinta-apoio')}>{motivoDaFicha(i) ?? '—'}</TableCell>
                    <TableCell className={cn(td, 'tabular whitespace-nowrap text-tinta-sussurro')}>
                      {i.enviado_em ? `enviada ${diaMesHora(i.enviado_em)}` : i.status !== 'enviado' && i.proxima_tentativa_em ? `tenta ${diaMesHora(i.proxima_tentativa_em)}` : `criada ${diaMesHora(i.criado_em)}`}
                    </TableCell>
                    <TableCell className={cn(td, 'text-right')}>
                      {acao && <Button size="xs" variant="outline" disabled={reenviar.isPending} onClick={() => reenviar.mutate(i.id)}><RotateCw className="size-3.5" aria-hidden />{acao}</Button>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {reenviar.error && <MensagemErro texto={(reenviar.error as Error).message} />}
    </section>
  )
}
