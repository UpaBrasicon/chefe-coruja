import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Input } from '@/components/ui/input'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { origemAltaVigilancia, type ItemAltaVigilancia, type SemLiberacao } from '@/lib/duplaChecagem'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Estado } from '@/components/porta/Estado'

// Alta vigilância (Fase 2, tarefa 1, revista pelo RT em 09/10/2026). Três abas:
//  • sem liberação — a enfermagem administrou com justificativa, sem a
//    liberação da farmácia; o farmacêutico confere e libera o item;
//  • exige liberação — a lista da unidade, das regras do ISMP Brasil 2019
//    (Boletim v. 8, n. 1, fev. 2019) e dos ajustes da unidade;
//  • ajustes da unidade — o que a farmácia ou o gestor marcou e desmarcou, com motivo.
// A liberação do dia a dia é a validação do item (Central do Farmacêutico ›
// Validação). Migrations 20261031000001 e 20261101000002.
// Revisão visual 3.7b (26/10/2026, opção B do RT): tabela e ficha, como a Disponibilidade.

type Aba = 'sem' | 'exige' | 'ajustes'

export default function AltaVigilancia() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const daFarmacia = papelAtivo === 'farmaceutico' || papelAtivo === 'gestor'

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={ShieldAlert}
        titulo="Alta vigilância"
        descricao="Medicamentos que a farmácia libera antes da administração. Sem liberação, a enfermagem administra com justificativa e o farmacêutico confere depois."
      />
      {unidadeId && <Telas key={unidadeId} unidadeId={unidadeId} veSemLiberacao={daFarmacia} podeLiberar={papelAtivo === 'farmaceutico'} podeAjustar={daFarmacia} />}
    </div>
  )
}

function Telas({ unidadeId, veSemLiberacao, podeLiberar, podeAjustar }: { unidadeId: string; veSemLiberacao: boolean; podeLiberar: boolean; podeAjustar: boolean }) {
  const qc = useQueryClient()
  const [aba, setAba] = React.useState<Aba | null>(null)
  const [escolhido, setEscolhido] = React.useState<string | null>(null)
  const [busca, setBusca] = React.useState('')
  const [termo, setTermo] = React.useState('')

  const sem = useQuery({
    queryKey: ['sem-liberacao', unidadeId],
    enabled: veSemLiberacao,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('administracoes_sem_liberacao', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as SemLiberacao[]
    },
  })
  const lerLista = (t: string) => async () => {
    const { data, error } = await supabase.rpc('alta_vigilancia_da_unidade', { p_unidade: unidadeId, p_busca: t || undefined })
    if (error) throw error
    return (data ?? []) as unknown as ItemAltaVigilancia[]
  }
  const lista = useQuery({ queryKey: ['alta-vigilancia', unidadeId, ''], queryFn: lerLista('') })
  const achados = useQuery({ queryKey: ['alta-vigilancia', unidadeId, termo], queryFn: lerLista(termo), enabled: !!termo })

  const semLib = sem.data ?? []
  const exige = (lista.data ?? []).filter((i) => i.exige)
  const ajustes = (lista.data ?? []).filter((i) => i.ajuste)
  const abaAtual: Aba = aba ?? (veSemLiberacao && semLib.length > 0 ? 'sem' : 'exige')
  const trocarAba = (a: Aba) => { setAba(a); setEscolhido(null) }
  const itens = abaAtual === 'ajustes' ? ajustes : termo ? achados.data ?? [] : exige
  const carregando = abaAtual === 'sem' ? sem.isLoading : termo && abaAtual === 'exige' ? achados.isLoading : lista.isLoading
  const erro = (abaAtual === 'sem' ? sem.error : (achados.error ?? lista.error)) as Error | null

  const selSem = abaAtual === 'sem' ? semLib.find((a) => a.id === escolhido) ?? semLib[0] : undefined
  const selItem = abaAtual !== 'sem' ? itens.find((i) => i.id === escolhido) ?? itens[0] : undefined
  const aoAjustar = (id: string) => {
    void qc.invalidateQueries({ queryKey: ['alta-vigilancia', unidadeId] })
    setAba('ajustes'); setEscolhido(id)
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={abaAtual} onValueChange={(v) => trocarAba(v as Aba)}>
        <TabsList aria-label="Alta vigilância" className="gap-5">
          {veSemLiberacao && (
            <TabsTrigger value="sem">Sem liberação <span className={cn('text-rotulo font-semibold tabular-nums', semLib.length ? 'text-atencao' : 'text-acao')}>{semLib.length}</span></TabsTrigger>
          )}
          <TabsTrigger value="exige">Exige liberação <span className="text-rotulo font-semibold text-acao tabular-nums">{exige.length}</span></TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes da unidade <span className="text-rotulo font-semibold text-acao tabular-nums">{ajustes.length}</span></TabsTrigger>
        </TabsList>
      </Tabs>
      <MensagemErro texto={erro ? erro.message : null} />

      {abaAtual === 'sem' && !carregando && semLib.length === 0 ? (
        <Vazio icone={ShieldAlert} titulo="Nada para conferir" texto="Quando a enfermagem administrar alta vigilância sem a liberação da farmácia, com justificativa, aparece aqui." />
      ) : (
        <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label={abaAtual === 'sem' ? 'Administradas sem liberação' : 'Medicamentos'} className="flex min-w-0 flex-col border-fio md:border-r">
            <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-2.5">
              <span className="text-apoio text-tinta-sussurro">
                {abaAtual === 'sem' ? 'A enfermagem administrou com justificativa: confira e libere o item'
                  : abaAtual === 'ajustes' ? 'Marcados e desmarcados pela unidade, com motivo'
                    : termo ? `Cadastro: “${termo}”` : 'ISMP 2019 e ajustes da unidade'}
              </span>
              {abaAtual === 'exige' && (
                <form className="ml-auto flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setTermo(busca.trim()); setEscolhido(null) }}>
                  <label className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
                    <Input aria-label="Buscar medicamento no cadastro" className="h-8 w-56 pl-8" placeholder="Buscar no cadastro" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </label>
                  {termo && <Button type="button" size="xs" variant="ghost" onClick={() => { setBusca(''); setTermo(''); setEscolhido(null) }}>Ver a lista</Button>}
                </form>
              )}
            </div>
            {carregando && <p className="px-4 py-4 text-apoio text-tinta-sussurro">Carregando…</p>}
            {!carregando && abaAtual === 'sem' && (
              <Table aria-label="Administradas sem liberação">
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Paciente</TableHead><TableHead>Item</TableHead><TableHead className="pr-4">Quando</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {semLib.map((a) => (
                    <TableRow key={a.id} aria-selected={a.id === selSem?.id} onClick={() => setEscolhido(a.id)}
                      className={cn('cursor-pointer', a.id === selSem?.id && 'bg-alerta-marca hover:bg-alerta-marca')}>
                      <TableCell className="pl-4 whitespace-normal">
                        <BotaoLinha variante="linha" className="flex-col gap-0.5 border-0 p-0 hover:bg-transparent" onClick={() => setEscolhido(a.id)}>
                          <span className="font-medium text-tinta">{a.paciente}</span>
                          <span className="text-rotulo text-tinta-sussurro">{a.local ?? '—'}</span>
                        </BotaoLinha>
                      </TableCell>
                      <TableCell className="whitespace-normal text-tinta">{a.descricao} · {a.dose ?? '—'} · {a.via ?? '—'}</TableCell>
                      <TableCell className="pr-4 text-tinta-apoio">{fmtDataHora(a.administrado_em)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!carregando && abaAtual !== 'sem' && itens.length === 0 && (
              <p className="px-4 py-4 text-apoio text-tinta-sussurro">
                {termo && abaAtual === 'exige' ? 'Nada encontrado no cadastro.' : abaAtual === 'ajustes' ? 'Nenhum ajuste da unidade: vale a lista do ISMP.' : 'Nenhum medicamento de alta vigilância.'}
              </p>
            )}
            {!carregando && abaAtual !== 'sem' && itens.length > 0 && (
              <Table aria-label="Medicamentos de alta vigilância">
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Medicamento</TableHead><TableHead className="pr-4">Por que</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id} aria-selected={i.id === selItem?.id} onClick={() => setEscolhido(i.id)}
                      className={cn('cursor-pointer', i.id === selItem?.id && 'bg-alerta-marca hover:bg-alerta-marca')}>
                      <TableCell className="pl-4 whitespace-normal">
                        <BotaoLinha variante="linha" className="flex-col gap-0.5 border-0 p-0 hover:bg-transparent" onClick={() => setEscolhido(i.id)}>
                          <span className="font-medium text-tinta">{i.principio_ativo}</span>
                          <span className="text-rotulo text-tinta-sussurro">{apresentacao(i)}</span>
                        </BotaoLinha>
                      </TableCell>
                      <TableCell className="pr-4 whitespace-normal text-tinta-apoio"><PorQue i={i} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
          <div className="order-first min-w-0 border-b border-fio md:order-none md:border-b-0">
            {selSem && <FichaSemLiberacao key={selSem.id} a={selSem} unidadeId={unidadeId} podeLiberar={podeLiberar} />}
            {selItem && <FichaItem key={`${selItem.id}:${selItem.exige}`} i={selItem} unidadeId={unidadeId} podeAjustar={podeAjustar} aoMudar={() => aoAjustar(selItem.id)} />}
            {!selSem && !selItem && !carregando && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Escolha um item na lista.</p>}
          </div>
        </div>
      )}
      {abaAtual !== 'sem' && (
        <p className="text-rotulo text-tinta-sussurro">
          Base: ISMP Brasil, “Medicamentos potencialmente perigosos de uso hospitalar — lista atualizada 2019” (Boletim v. 8, n. 1, fev. 2019),
          aplicada por regra ao cadastro. Vias epidural/intratecal e antineoplásicos dependem da marcação da farmácia.
        </p>
      )}
    </div>
  )
}

const apresentacao = (i: ItemAltaVigilancia) => `${i.apresentacao}${i.concentracao && !i.apresentacao.includes(i.concentracao) ? ` · ${i.concentracao}` : ''}`

function PorQue({ i }: { i: ItemAltaVigilancia }) {
  if (i.ajuste) return <Estado tom={i.ajuste.exige ? 'teal' : 'cinza'}>{i.ajuste.exige ? 'marcado pela unidade' : 'desmarcado pela unidade'}</Estado>
  if (!i.exige) return <Estado tom="cinza">não exige</Estado>
  return <>{i.regra ?? 'marcado no cadastro'}</>
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-trilha py-2 last:border-b-0">
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-apoio text-tinta">{children}</dd>
    </div>
  )
}

function FichaSemLiberacao({ a, unidadeId, podeLiberar }: { a: SemLiberacao; unidadeId: string; podeLiberar: boolean }) {
  const qc = useQueryClient()
  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('validar_item', { p_item: a.item_id, p_confere: true })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sem-liberacao', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['fila-validacao-av', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['fila-validacao', unidadeId] })
    },
  })
  return (
    <section aria-label={`Administração de ${a.descricao} para ${a.paciente}`} className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-corpo font-semibold text-tinta">{a.paciente}</h3>
        <p className="text-apoio text-tinta-sussurro">{a.local ?? '—'}{a.horario ? ` · horário ${a.horario}` : ''}</p>
        <div className="mt-1"><Estado tom="ambar">administrado sem liberação</Estado></div>
      </div>
      <dl className="flex flex-col">
        <Campo rotulo="Item">{a.descricao} · {a.dose ?? '—'} · {a.via ?? '—'} · {a.posologia ?? '—'}</Campo>
        <Campo rotulo="Administrado por">{a.administrado_por ?? '—'}, {fmtDataHora(a.administrado_em)}</Campo>
        <Campo rotulo="Justificativa">“{a.justificativa ?? '—'}”</Campo>
      </dl>
      <MensagemErro texto={liberar.error ? (liberar.error as Error).message : null} />
      {podeLiberar && (
        <div className="flex flex-col gap-1.5">
          <div><Button size="sm" disabled={liberar.isPending} onClick={() => liberar.mutate()}>Conferi: liberar o item</Button></div>
          <span className="text-rotulo text-tinta-sussurro">Libera o item da prescrição, como a validação da Central.</span>
        </div>
      )}
    </section>
  )
}

function FichaItem({ i, unidadeId, podeAjustar, aoMudar }: { i: ItemAltaVigilancia; unidadeId: string; podeAjustar: boolean; aoMudar: () => void }) {
  const [abrindo, setAbrindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const ajustar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_alta_vigilancia', {
        p_unidade: unidadeId, p_medicamento: i.id, p_exige: !i.exige, p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setAbrindo(false); setMotivo(''); aoMudar() },
  })

  return (
    <section aria-label={`Ficha de ${i.principio_ativo}`} className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-corpo font-semibold text-tinta">{i.principio_ativo}</h3>
        <p className="text-apoio text-tinta-sussurro">{apresentacao(i)}</p>
        <div className="mt-1"><Estado tom={i.exige ? 'vermelho' : 'cinza'}>{i.exige ? 'exige liberação da farmácia' : 'não exige liberação'}</Estado></div>
      </div>
      <dl className="flex flex-col">
        <Campo rotulo="Por que">{origemAltaVigilancia(i)}</Campo>
        {i.ajuste && i.regra && <Campo rotulo="Na lista do ISMP">{i.regra}</Campo>}
        {i.ajuste && <Campo rotulo="Motivo">“{i.ajuste.motivo}”</Campo>}
        {i.ajuste && <Campo rotulo="Quem e quando">{i.ajuste.por ?? '—'}, {fmtDataHora(i.ajuste.em)}</Campo>}
      </dl>
      {podeAjustar && !abrindo && (
        <div className="flex flex-col gap-1.5">
          <div><Button size="sm" variant="outline" onClick={() => setAbrindo(true)}>{i.exige ? 'Desmarcar na unidade' : 'Marcar na unidade'}</Button></div>
          <span className="text-rotulo text-tinta-sussurro">Pede motivo (mínimo de 10 letras) e fica no histórico.</span>
        </div>
      )}
      {abrindo && (
        <div className="flex flex-col gap-2 border-l-2 border-acao/40 pl-3">
          <Input aria-label="Motivo" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={motivo.trim().length < 10 || ajustar.isPending} onClick={() => ajustar.mutate()}>{i.exige ? 'Desmarcar' : 'Marcar'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAbrindo(false)}>Voltar</Button>
          </div>
          <MensagemErro texto={ajustar.error ? (ajustar.error as Error).message : null} />
        </div>
      )}
    </section>
  )
}
