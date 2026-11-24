// Lotes de vacina da UBS (percurso da UBS, U15, vacina, PR 3; VC3 = A).
//
// O gestor e o enfermeiro cadastram os lotes que a UBS recebe: imunobiológico,
// lote, fabricante (código da RNDS) e validade. Na aplicação (sala de vacina),
// o lote é escolhido desta lista e o vencido não aparece. Sem estoque.
// Banco: migration 20270415000027.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Syringe } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  conferirLote, normalizarLote, ROTULO_SITUACAO, situacaoLote, type PainelLotes, type SituacaoLote,
} from '@/domain/vacinaLotes'
import { dataPura } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5 align-top'
const VARIANTE: Record<SituacaoLote, 'success' | 'warning' | 'destructive' | 'ghost'> = {
  valido: 'success', vence_logo: 'warning', vencido: 'destructive', desativado: 'ghost',
}

export default function LotesVacina() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const painel = useQuery({
    queryKey: ['vacina-lotes', unidade],
    enabled: !!unidade,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vacina_lotes_da_unidade', { p_unidade: unidade! })
      if (error) throw error
      return data as unknown as PainelLotes
    },
  })
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Syringe} titulo="Lotes de vacina"
        descricao="Os lotes que a UBS recebe. Na sala de vacina, o lote é escolhido desta lista, e o vencido ou desativado não aparece." />
      {!unidade && <Vazio icone={Syringe} titulo="Escolha a unidade" texto="Os lotes são cadastrados por UBS." />}
      {painel.isLoading && <EsqueletoLinhas linhas={3} rotulo="Carregando os lotes…" className="px-0" />}
      {painel.error && <MensagemErro texto={(painel.error as Error).message} />}
      {painel.data && unidade && (
        <>
          {painel.data.pode_cadastrar && <NovoLote p={painel.data} unidade={unidade} />}
          <ListaLotes p={painel.data} />
        </>
      )}
    </div>
  )
}

function NovoLote({ p, unidade }: { p: PainelLotes; unidade: string }) {
  const qc = useQueryClient()
  const vazio = { imunobiologico: '', lote: '', fabricante: '', validade: '' }
  const [f, setF] = React.useState(vazio)
  const [tocado, setTocado] = React.useState(false)
  const problema = conferirLote(f, p.hoje)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('vacina_lote_salvar', {
        p_unidade: unidade, p_imunobiologico: Number(f.imunobiologico), p_lote: normalizarLote(f.lote),
        p_fabricante: f.fabricante, p_validade: f.validade,
      })
      if (error) throw error
    },
    onSuccess: () => { setF(vazio); setTocado(false); void qc.invalidateQueries({ queryKey: ['vacina-lotes', unidade] }) },
  })
  const mudar = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Cadastrar lote</CardTitle>
        <CardDescription>Imunobiológico e fabricante pelas tabelas do e-SUS APS e da RNDS. Lote como está na caixa.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_10rem_minmax(0,1.5fr)_10rem]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lote-imuno" className="text-rotulo">Imunobiológico</Label>
            <CampoSelecao id="lote-imuno" value={f.imunobiologico} onChange={mudar('imunobiologico')}>
              <option value="">Escolha</option>
              {p.imunobiologicos.map((i) => <option key={i.codigo} value={i.codigo}>{i.nome} ({i.sigla})</option>)}
            </CampoSelecao>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lote-codigo" className="text-rotulo">Lote</Label>
            <Input id="lote-codigo" className="h-9" maxLength={30} value={f.lote} onChange={mudar('lote')} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lote-fab" className="text-rotulo">Fabricante</Label>
            <CampoSelecao id="lote-fab" value={f.fabricante} onChange={mudar('fabricante')}>
              <option value="">Escolha</option>
              {p.fabricantes.map((x) => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}
            </CampoSelecao>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lote-validade" className="text-rotulo">Validade</Label>
            <Input id="lote-validade" type="date" className="h-9" min={p.hoje} value={f.validade} onChange={mudar('validade')} />
          </div>
        </div>
        {tocado && problema && <span role="alert" className="text-critico">{problema}</span>}
        <Button size="sm" className="self-start" disabled={salvar.isPending}
          onClick={() => { setTocado(true); if (!problema) salvar.mutate() }}>
          {salvar.isPending && <Spinner className="size-4" />} Cadastrar lote
        </Button>
        {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

function ListaLotes({ p }: { p: PainelLotes }) {
  const qc = useQueryClient()
  const desativar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('vacina_lote_desativar', { p_lote: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vacina-lotes'] }),
  })
  if (p.lotes.length === 0) return <Vazio icone={Syringe} titulo="Nenhum lote cadastrado" texto="Cadastre os lotes que a UBS recebeu para a sala de vacina." />
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Lotes da UBS</CardTitle>
        <CardDescription>Avisa o lote que vence em até 30 dias. O desativado sai da sala de vacina e volta se for cadastrado de novo.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <Table className="text-apoio">
          <TableHeader>
            <TableRow>
              <TableHead className={th}>Imunobiológico</TableHead>
              <TableHead className={th}>Lote</TableHead>
              <TableHead className={th}>Fabricante</TableHead>
              <TableHead className={th}>Validade</TableHead>
              <TableHead className={th}>Situação</TableHead>
              {p.pode_cadastrar && <TableHead className={th}><span className="sr-only">Ações</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.lotes.map((l) => {
              const s = situacaoLote(l, p.hoje)
              return (
                <TableRow key={l.id}>
                  <TableCell className={td}>{l.imunobiologico_nome} <span className="text-tinta-sussurro">({l.sigla})</span></TableCell>
                  <TableCell className={`${td} tabular`}>{l.lote}</TableCell>
                  <TableCell className={td}>{l.fabricante_nome}</TableCell>
                  <TableCell className={`${td} tabular`}>{dataPura(l.validade)}</TableCell>
                  <TableCell className={td}><Badge variant={VARIANTE[s]}>{ROTULO_SITUACAO[s]}</Badge></TableCell>
                  {p.pode_cadastrar && (
                    <TableCell className={`${td} text-right`}>
                      {l.ativo && (
                        <Button size="xs" variant="outline" disabled={desativar.isPending} onClick={() => desativar.mutate(l.id)}>Desativar</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {desativar.error && <div className="px-6 pt-2"><MensagemErro texto={(desativar.error as Error).message} /></div>}
      </CardContent>
    </Card>
  )
}
