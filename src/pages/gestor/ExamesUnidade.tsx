// ─────────────────────────────────────────────────────────────────────────────
// Gestão — exames da unidade (Fase 5C, tarefa 1, etapa 1.1; decisões do RT de
// 18/10/2026 no BACKLOG).
//
// O gestor escolhe, no grupo 02.02 do SIGTAP (laboratório clínico), os exames
// que a unidade oferece, com um nome curto para a tela, e marca quais viram
// botão no pedido rápido do atendimento. O LOINC fica para a implantação
// preencher quando o LIS pedir; o sistema não deduz. Sem lista, a busca do
// pedido usa o grupo 02.02 inteiro. Migration 20261205000001_catalogo_exames.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TestTube } from 'lucide-react'
import * as React from 'react'

import { TituloCartao, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { codigoExameNaTela, loincValido, type ExameBuscado, type ExameUnidade, type ListaExamesUnidade } from '@/lib/exames'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Rascunho = { procedimento: string; nome_sigtap: string | null; nome_curto: string; loinc: string; botao: boolean; ordem: string }

// Revisão de perfis (Gestor, item 14, M1): grupo do exame na tela pelo
// subgrupo do SIGTAP. Só a exibição: o ECG (02.11, métodos gráficos) deixa de
// aparecer como "imagem"; a regra de tipoDoCodigo (pedido, laudo) não muda.
const GRUPOS_NA_TELA = [
  ['laboratorio', 'Laboratório'], ['citopatologia', 'Citopatológico'], ['imagem', 'Imagem'], ['grafico', 'Métodos gráficos'], ['outro', 'Outros'],
] as const
type GrupoNaTela = (typeof GRUPOS_NA_TELA)[number][0]
function grupoNaTela(codigo: string): GrupoNaTela {
  const sub = codigo.replace(/\D/g, '').slice(0, 4)
  if (sub === '0202') return 'laboratorio'
  if (sub === '0203') return 'citopatologia'
  if (['0204', '0205', '0206', '0207'].includes(sub)) return 'imagem'
  if (sub === '0211') return 'grafico'
  return 'outro'
}

export default function ExamesUnidade() {
  const [aba, setAba] = React.useState<'exames' | 'pacs'>('exames')
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [editando, setEditando] = React.useState<Rascunho | null>(null)
  const [retirando, setRetirando] = React.useState<ExameUnidade | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const lista = useQuery({
    queryKey: ['exames-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exames_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaExamesUnidade
    },
  })
  const termoBusca = useValorAdiado(termo.trim())
  const busca = useQuery({
    queryKey: ['buscar-exames-todos', unidadeId, termoBusca],
    enabled: !!unidadeId && termoBusca.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_exames', { p_unidade: unidadeId!, p_termo: termoBusca, p_todos: true })
      if (error) throw error
      return (data ?? []) as unknown as ExameBuscado[]
    },
  })
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['exames-unidade'] }) }
  const salvar = useMutation({
    mutationFn: async (r: Rascunho) => {
      const { error } = await supabase.rpc('definir_exame_unidade', {
        p_unidade: unidadeId!, p_procedimento: r.procedimento, p_nome_curto: r.nome_curto.trim(),
        p_loinc: r.loinc.trim() || undefined, p_botao: r.botao, p_ordem: Number(r.ordem) || 0,
      })
      if (error) throw error
    },
    onSuccess: () => { setEditando(null); setTermo(''); recarregar() },
  })
  const retirar = useMutation({
    mutationFn: async (e: ExameUnidade) => {
      const { error } = await supabase.rpc('retirar_exame_unidade', { p_unidade: unidadeId!, p_procedimento: e.procedimento, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setRetirando(null); setMotivo(''); recarregar() },
  })

  // SP2 (L2 = A): exames da sepse com SIGTAP e LOINC conferidos nas tabelas oficiais
  const sepse = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('aplicar_exames_sepse', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as { incluidos: string[]; loinc_preenchido: string[]; mantidos: { exame: string; loinc_atual: string; loinc_referencia: string }[] }
    },
    onSuccess: recarregar,
  })
  const exames = lista.data?.exames ?? []
  const pode = !!lista.data?.pode_definir
  const naLista = new Set(exames.map((e) => e.procedimento))
  const comLoinc = exames.filter((e) => !!e.loinc).length
  const botoes = exames.filter((e) => e.botao).sort((a, b) => a.ordem - b.ordem || a.nome_curto.localeCompare(b.nome_curto, 'pt-BR'))
  const abrir = (e: ExameUnidade) =>
    setEditando({ procedimento: e.procedimento, nome_sigtap: e.nome_sigtap, nome_curto: e.nome_curto, loinc: e.loinc ?? '', botao: e.botao, ordem: String(e.ordem) })

  return (
    <div className="flex w-full flex-col gap-4">
      <TituloPagina
        icone={TestTube}
        titulo="Exames da unidade"
        descricao="Exames que a unidade oferece, do SIGTAP: laboratório (02.02), imagem (02.04 a 02.07) e métodos gráficos como o ECG (02.11), com o nome que aparece no pedido. Os marcados como botão aparecem no pedido rápido do atendimento. Sem lista, o pedido busca nesses grupos inteiros."
      />
      <MensagemErro texto={(lista.error ?? salvar.error ?? retirar.error ?? sepse.error) ? ((lista.error ?? salvar.error ?? retirar.error ?? sepse.error) as Error).message : null} />
      {pode && (
        <section className="flex flex-wrap items-center gap-2 rounded-container border border-fio bg-superficie p-3 text-apoio text-tinta-apoio">
          <span className="min-w-0 flex-[1_1_320px]">
            Exames da sepse (hemograma, creatinina, bilirrubina, gasometria, lactato, PCR e hemocultura) com o LOINC para o laboratório integrado. Entra o que falta; o que já tem outro LOINC fica como está.
          </span>
          <Button size="sm" variant="outline" disabled={sepse.isPending} onClick={() => sepse.mutate()}>Aplicar exames da sepse</Button>
          {sepse.data && (
            <span role="status" className="basis-full text-tinta">
              {sepse.data.incluidos.length ? `Incluídos: ${sepse.data.incluidos.join(', ')}. ` : ''}
              {sepse.data.loinc_preenchido.length ? `LOINC preenchido: ${sepse.data.loinc_preenchido.join(', ')}. ` : ''}
              {sepse.data.mantidos.length ? `Mantidos com outro LOINC (confira): ${sepse.data.mantidos.map((m) => `${m.exame} (${m.loinc_atual}; referência ${m.loinc_referencia})`).join(', ')}. ` : ''}
              {!sepse.data.incluidos.length && !sepse.data.loinc_preenchido.length && !sepse.data.mantidos.length ? 'Os exames da sepse já estavam na lista com o LOINC.' : ''}
            </span>
          )}
        </section>
      )}

      {/* M3: o PACS em aba própria */}
      <Tabs value={aba} onValueChange={(v) => setAba(v as 'exames' | 'pacs')}>
        <TabsList aria-label="Exames da unidade" className="gap-5">
          <TabsTrigger value="exames">Exames <span className="text-rotulo font-semibold text-acao tabular-nums">{exames.length}</span></TabsTrigger>
          <TabsTrigger value="pacs">Visualizador de imagem (PACS)</TabsTrigger>
        </TabsList>
      </Tabs>
      {aba === 'pacs' && unidadeId && <DominiosImagem unidadeId={unidadeId} pode={pode} />}
      {aba === 'exames' && <>

      {exames.length > 0 && (
        <div className="flex flex-col gap-2 rounded-container border border-fio bg-superficie p-3 text-apoio">
          {/* M3: LOINC como progresso, com o porquê do vazio */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-tinta">LOINC em {comLoinc} de {exames.length}</span>
            <span className="h-1.5 w-32 overflow-hidden rounded-capsula bg-trilha" aria-hidden>
              <span className="block h-full bg-acao" style={{ width: `${Math.round((comLoinc / exames.length) * 100)}%` }} />
            </span>
            <span className="text-rotulo text-tinta-sussurro">O LOINC é preenchido na implantação, quando o laboratório (LIS) pedir; o sistema não deduz o código. Vazio não impede o pedido.</span>
          </div>
          {/* M2 (versão mínima): prévia do pedido rápido na ordem em que aparece; a ordem muda em Editar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-rotulo text-tinta-sussurro">Pedido rápido:</span>
            {botoes.length === 0
              ? <span className="text-rotulo text-tinta-sussurro">nenhum exame marcado como botão; o atendimento mostra os botões padrão.</span>
              : botoes.map((e) => <span key={e.id} className="rounded-capsula border border-fio px-2 text-rotulo text-tinta">{e.nome_curto}</span>)}
          </div>
        </div>
      )}

      {pode && !editando && (
        <section className="flex flex-col gap-2 rounded-container border border-fio bg-superficie p-3">
          <Label htmlFor="exame-busca">Incluir exame do SIGTAP</Label>
          <Input id="exame-busca" className="h-9" placeholder="Nome ou código (ex.: hemograma, radiografia, eletrocardiograma)" value={termo} onChange={(e) => setTermo(e.target.value)} />
          {(busca.data ?? []).length > 0 && (
            <div className="flex max-h-56 flex-col overflow-y-auto rounded-controle border border-fio">
              {(busca.data ?? []).map((x) => (
                <Button key={x.procedimento} type="button" variant="ghost" size="sm" className="justify-start" disabled={naLista.has(x.procedimento)}
                  onClick={() => setEditando({ procedimento: x.procedimento, nome_sigtap: x.nome, nome_curto: '', loinc: '', botao: false, ordem: '0' })}>
                  <span className="text-rotulo text-tinta-sussurro">{codigoExameNaTela(x.procedimento)}</span>
                  <span className="ml-1">{x.nome}</span>
                  {naLista.has(x.procedimento) && <span className="ml-1 text-rotulo text-tinta-sussurro">(já na lista)</span>}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      {editando && (
        <section className="flex flex-col gap-2 rounded-container border border-fio bg-superficie p-3">
          <span className="text-apoio"><span className="font-medium">{codigoExameNaTela(editando.procedimento)}</span> · {editando.nome_sigtap ?? ''}</span>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="exame-nome">Nome no pedido</Label>
              <Input id="exame-nome" className="h-9 min-w-48" maxLength={80} value={editando.nome_curto} onChange={(e) => setEditando({ ...editando, nome_curto: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="exame-loinc">LOINC (implantação)</Label>
              <Input id="exame-loinc" className="h-9 w-32" placeholder="12345-6" value={editando.loinc} onChange={(e) => setEditando({ ...editando, loinc: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="exame-ordem">Ordem</Label>
              <Input id="exame-ordem" className="h-9 w-20" inputMode="numeric" value={editando.ordem} onChange={(e) => setEditando({ ...editando, ordem: e.target.value.replace(/\D/g, '') })} />
            </div>
            <label className="flex h-9 items-center gap-2 text-apoio">
              <input type="checkbox" checked={editando.botao} onChange={(e) => setEditando({ ...editando, botao: e.target.checked })} />
              Botão no pedido rápido
            </label>
          </div>
          {!loincValido(editando.loinc) && <span className="text-rotulo text-critico">LOINC no formato 12345-6, ou vazio.</span>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button size="sm" disabled={editando.nome_curto.trim().length < 2 || !loincValido(editando.loinc) || salvar.isPending}
              onClick={() => salvar.mutate(editando)}>Salvar</Button>
          </div>
        </section>
      )}

      {lista.isLoading ? <Spinner /> : exames.length === 0 ? (
        <Vazio icone={TestTube} titulo="Nenhum exame na lista da unidade" texto="Sem lista, o pedido do atendimento busca no grupo 02.02 do SIGTAP inteiro e mostra os botões padrão." />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[640px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow><TableHead className="px-3 py-2 font-medium">Nome no pedido</TableHead><TableHead className="px-3 py-2 font-medium">SIGTAP</TableHead>
                <TableHead className="px-3 py-2 font-medium">LOINC</TableHead><TableHead className="px-3 py-2 font-medium">Botão</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {GRUPOS_NA_TELA.flatMap(([g, rotulo]) => {
                const doGrupo = exames.filter((e) => grupoNaTela(e.procedimento) === g)
                if (doGrupo.length === 0) return []
                return [
                  <TableRow key={`g-${g}`} className="bg-trilha hover:bg-trilha">
                    <TableCell colSpan={5} className="px-3 py-1.5 font-semibold text-tinta">{rotulo} <span className="font-normal text-tinta-sussurro tabular-nums">{doGrupo.length}</span></TableCell>
                  </TableRow>,
                  ...doGrupo.map((e) => (
                <TableRow key={e.id} className="border-b border-trilha align-top last:border-0">
                  <TableCell className="px-3 py-2 font-medium text-tinta">{e.nome_curto}</TableCell>
                  <TableCell className="px-3 py-2">{codigoExameNaTela(e.procedimento)}<span className="block text-rotulo text-tinta-sussurro">{e.nome_sigtap ?? ''}</span></TableCell>
                  <TableCell className="px-3 py-2">{e.loinc ?? <span className="text-tinta-sussurro">a preencher na implantação</span>}</TableCell>
                  <TableCell className="px-3 py-2">{e.botao ? <Badge variant="info">botão · {e.ordem}</Badge> : <span className="text-tinta-sussurro">—</span>}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2 text-right">
                    {pode && (
                      <>
                        <Button size="xs" variant="ghost" onClick={() => abrir(e)}>Editar</Button>
                        <Button size="xs" variant="ghost" onClick={() => { setRetirando(e); setMotivo('') }}>Retirar</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                  )),
                ]
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {retirando && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio bg-superficie p-3">
          <Label htmlFor="exame-motivo">Retirar {retirando.nome_curto} da lista: motivo</Label>
          <Textarea id="exame-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRetirando(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < 10 || retirar.isPending} onClick={() => retirar.mutate(retirando)}>Retirar</Button>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}

// Fase 5C-2, etapa 2.2 (decisão 4a de 20/10/2026): o link da imagem, vindo do
// RIS ou digitado na tela, só vale em https e de um domínio cadastrado aqui.
// Migration 20261211000001_api_imagem.sql.
type DominioImagem = { dominio: string; criado_em: string; criado_por: string | null }

function DominiosImagem({ unidadeId, pode }: { unidadeId: string; pode: boolean }) {
  const qc = useQueryClient()
  const [novo, setNovo] = React.useState('')
  const lista = useQuery({
    queryKey: ['dominios-imagem', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dominios_imagem', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as DominioImagem[]
    },
  })
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['dominios-imagem', unidadeId] }) }
  const incluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_dominio_imagem', { p_unidade: unidadeId, p_dominio: novo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setNovo(''); recarregar() },
  })
  const retirar = useMutation({
    mutationFn: async (dominio: string) => {
      const { error } = await supabase.rpc('retirar_dominio_imagem', { p_unidade: unidadeId, p_dominio: dominio })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const dominios = lista.data ?? []

  return (
    <section aria-labelledby="dominios-imagem" className="flex flex-col gap-2 rounded-container border border-fio bg-superficie p-3">
      <TituloCartao id="dominios-imagem" className="mb-0">Visualizador de imagem (PACS)</TituloCartao>
      <p className="text-apoio text-tinta-sussurro">
        Endereços aceitos para o link da imagem, do RIS ou digitado na tela. Só https; vale o domínio e os subdomínios dele.
        Sem domínio cadastrado, nenhum link de imagem é aceito.
      </p>
      <MensagemErro texto={(lista.error ?? incluir.error ?? retirar.error) ? ((lista.error ?? incluir.error ?? retirar.error) as Error).message : null} />
      {lista.isLoading ? <Spinner /> : dominios.length === 0 ? (
        <span className="text-apoio text-tinta-sussurro">Nenhum domínio cadastrado.</span>
      ) : (
        <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
          {dominios.map((d) => (
            <li key={d.dominio} className="flex items-center justify-between gap-2 px-3 py-1.5 text-apoio">
              <span className="font-medium text-tinta">{d.dominio}</span>
              {pode && <Button size="xs" variant="outline" disabled={retirar.isPending} onClick={() => retirar.mutate(d.dominio)}>Retirar</Button>}
            </li>
          ))}
        </ul>
      )}
      {pode && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (novo.trim()) incluir.mutate() }}>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="dominio-imagem">Incluir domínio</Label>
            <Input id="dominio-imagem" className="h-9 min-w-48" placeholder="pacs.hospital.com.br" value={novo} onChange={(e) => setNovo(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={!novo.trim() || incluir.isPending}>Incluir</Button>
        </form>
      )}
    </section>
  )
}
