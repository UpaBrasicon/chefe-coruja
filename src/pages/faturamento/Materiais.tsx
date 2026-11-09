// ─────────────────────────────────────────────────────────────────────────────
// Faturamento — materiais da unidade (pendências da 5B, L4; decisão L4 = A e
// opção A da tela, RT em 05/11/2026, ref. Dock e Lemon Squeezy).
//
// Cadastro simples para lançar na conta: nome, unidade de consumo e o código
// SIGTAP do grupo 07 (opcional). Sem valor e sem estoque. Desativar tira da
// lista de lançamento sem apagar o histórico. Cadastram o faturamento e o
// gestor; o lançamento na conta é do faturamento (Contas do atendimento).
// Migration 20270226000001_materiais.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { codigoSigtapNaTela } from '@/lib/bpa'
import { type MaterialUnidade } from '@/lib/contas'
import { filtrarMateriais } from '@/lib/materiais'
import { supabase } from '@/lib/supabase'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Editando = { id: string | null; nome: string; unidade_consumo: string; procedimento: string | null; procedimento_nome: string | null; ativo: boolean }
const NOVO: Editando = { id: null, nome: '', unidade_consumo: '', procedimento: null, procedimento_nome: null, ativo: true }
export default function Materiais() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [busca, setBusca] = React.useState('')
  const [ativos, setAtivos] = React.useState(true)
  const [editando, setEditando] = React.useState<Editando | null>(null)
  const lista = useQuery({
    queryKey: ['materiais', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('materiais_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as MaterialUnidade[]
    },
  })
  const todos = lista.data ?? []
  const visiveis = filtrarMateriais(todos, busca, ativos)
  const nAtivos = todos.filter((m) => m.ativo).length

  return (
    <>
      <TituloPagina titulo="Materiais" descricao="Cadastro da unidade para lançar na conta do atendimento, sem valor e sem estoque."
        acoes={unidadeId && !lista.error ? <Button size="sm" onClick={() => setEditando(NOVO)}><Plus /> Novo material</Button> : undefined} />
      {lista.isLoading ? <Spinner /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} />
        : todos.length === 0 ? (
          <Vazio icone={Package} titulo="Nenhum material cadastrado"
            texto="Cadastre os materiais que o faturamento lança à mão na conta (gaze, fio de sutura, equipo). O código SIGTAP do grupo 07 é opcional." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Buscar material" placeholder="Buscar material ou código SIGTAP" className="h-9 min-w-[220px] flex-1" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Chips rotulo="Situação do material">
                <Chip ativo={ativos} contagem={nAtivos} onClick={() => setAtivos(true)}>Ativos</Chip>
                <Chip ativo={!ativos} contagem={todos.length - nAtivos} onClick={() => setAtivos(false)}>Desativados</Chip>
              </Chips>
            </div>
            <div className="overflow-x-auto rounded-cartao border border-fio bg-superficie">
              <Table aria-label="Materiais da unidade">
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>SIGTAP</TableHead>
                    <TableHead>Na conta</TableHead>
                    <TableHead><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((m) => (
                    <TableRow key={m.id} className={m.ativo ? undefined : 'text-tinta-sussurro'}>
                      <TableCell><strong className={m.ativo ? 'text-tinta' : 'font-normal'}>{m.nome}</strong>{!m.ativo && <Badge variant="outline" className="ml-1.5">desativado</Badge>}</TableCell>
                      <TableCell>{m.unidade_consumo}</TableCell>
                      <TableCell>
                        {m.procedimento
                          ? <span title={m.procedimento_nome ?? undefined}>{codigoSigtapNaTela(m.procedimento)}</span>
                          : <Badge variant="warning">sem código</Badge>}
                      </TableCell>
                      <TableCell className="text-apoio text-tinta-apoio">{m.lancamentos === 1 ? '1 lançamento' : `${m.lancamentos} lançamentos`}</TableCell>
                      <TableCell className="text-right">
                        <Button size="xs" variant="ghost" onClick={() => setEditando({ ...m })}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {visiveis.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Nenhum material neste filtro.</p>}
              <p className="border-t border-fio bg-campo px-4 py-2.5 text-rotulo text-tinta-sussurro">
                Material sem código SIGTAP gera só um aviso na pré-auditoria; não trava o fechamento. Lançar na conta é do faturamento, em Contas do atendimento.
              </p>
            </div>
          </div>
        )}
      {editando && unidadeId && <PainelMaterial unidadeId={unidadeId} inicial={editando} onFechar={() => setEditando(null)} />}
    </>
  )
}

function PainelMaterial({ unidadeId, inicial, onFechar }: { unidadeId: string; inicial: Editando; onFechar: () => void }) {
  const qc = useQueryClient()
  const [m, setM] = React.useState<Editando>(inicial)
  const [termo, setTermo] = React.useState('')
  const t = useValorAdiado(termo.trim())
  const busca = useQuery({
    queryKey: ['buscar-sigtap-material', t],
    enabled: t.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_sigtap', { p_termo: t })
      if (error) throw error
      // materiais: só o grupo 07 (órteses, próteses e materiais especiais)
      return ((data ?? []) as unknown as { codigo: string; nome: string }[]).filter((p) => p.codigo.startsWith('07')).slice(0, 8)
    },
  })
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('material_salvar', {
        p_unidade: unidadeId, p_id: m.id, p_nome: m.nome.trim(), p_unidade_consumo: m.unidade_consumo.trim(),
        p_procedimento: m.procedimento ?? undefined, p_ativo: m.ativo,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['materiais'] }); onFechar() },
  })
  const valido = m.nome.trim().length >= 3 && m.nome.trim().length <= 120 && m.unidade_consumo.trim().length >= 1 && m.unidade_consumo.trim().length <= 20

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo={m.id ? 'Editar material' : 'Novo material'}>
      <GavetaCabeca sobre="Materiais" titulo={m.id ? 'Editar material' : 'Novo material'} />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-nome">Nome</Label>
          <Input id="mat-nome" maxLength={120} value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Ex.: Fio de sutura nylon 4-0" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-unidade">Unidade de consumo</Label>
          <Input id="mat-unidade" maxLength={20} value={m.unidade_consumo} onChange={(e) => setM({ ...m, unidade_consumo: e.target.value })} placeholder="Ex.: unidade, par, pacote, metro" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-sigtap">Código SIGTAP (grupo 07, opcional)</Label>
          {m.procedimento ? (
            <div className="flex items-center justify-between gap-2 rounded-controle border border-fio px-3 py-2 text-apoio">
              <span><strong>{codigoSigtapNaTela(m.procedimento)}</strong>{m.procedimento_nome ? ` · ${m.procedimento_nome}` : ''}</span>
              <Button size="xs" variant="ghost" onClick={() => setM({ ...m, procedimento: null, procedimento_nome: null })}>Tirar</Button>
            </div>
          ) : (
            <>
              <Input id="mat-sigtap" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar no SIGTAP pelo nome ou código" autoComplete="off" />
              {(busca.data ?? []).length > 0 && (
                <ul className="flex flex-col rounded-controle border border-fio bg-superficie">
                  {(busca.data ?? []).map((p) => (
                    <li key={p.codigo}>
                      <BotaoLinha variante="linha" className="py-2 text-apoio" onClick={() => { setM({ ...m, procedimento: p.codigo, procedimento_nome: p.nome }); setTermo('') }}>
                        {codigoSigtapNaTela(p.codigo)} · {p.nome}
                      </BotaoLinha>
                    </li>
                  ))}
                </ul>
              )}
              {t.length >= 3 && busca.isSuccess && (busca.data ?? []).length === 0 && (
                <span className="text-rotulo text-tinta-sussurro">Nenhum procedimento do grupo 07 com esse termo.</span>
              )}
            </>
          )}
        </div>
        <CaixaMarcar marcado={m.ativo} onChange={(v) => setM({ ...m, ativo: v })}>Ativo (aparece no lançamento da conta)</CaixaMarcar>
        <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!valido || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </div>
      </div>
      <GavetaPe>Sem valor e sem estoque. Desativar tira da lista de lançamento; o que já foi lançado nas contas continua lá.</GavetaPe>
    </Gaveta>
  )
}
