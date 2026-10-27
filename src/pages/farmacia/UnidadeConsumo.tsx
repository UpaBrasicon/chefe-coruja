// ─────────────────────────────────────────────────────────────────────────────
// Unidade de consumo dos medicamentos (Fase 5B, tarefa 3, etapa 3.1; decisões
// do RT de 17/10/2026). O cadastro é um só para todas as unidades: a unidade
// veio sugerida pela apresentação ("Ampola 10 mL" → ampola; frasco de pó →
// frasco-ampola) e a farmácia ou o gestor confere ou corrige, com histórico.
// A dispensação (3.2) e a conta (3.3) contam nesta unidade.
// Migration 20261129000001_unidade_consumo.sql.
//
// Ponto 4 das telas do farmacêutico (decisões do RT de 27/10/2026): a farmácia
// cadastra medicamento novo, com forma farmacêutica, apresentação e unidade de
// consumo. O item novo vale só nesta unidade; antes de gravar, a tela mostra
// os parecidos, e o item que outra unidade cadastrou entra por "Usar nesta
// unidade". O item da unidade se corrige e se inativa com motivo. Os itens da
// rede ganham a forma aqui. Migration 20270106000001_cadastro_medicamentos.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PackageCheck, Plus } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { FORMAS_FARMACEUTICAS, rotuloForma, type Parecido } from '@/lib/medicamentoCadastro'
import { supabase } from '@/lib/supabase'
import { rotuloUnidade, UNIDADES_CONSUMO, type MedicamentoUnidade, type UnidadeConsumo } from '@/lib/unidadeConsumo'
import { MensagemErro } from '@/components/ui/mensagem-erro'

const MINIMO = 10

export default function UnidadeConsumoPagina() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const [aConferir, setAConferir] = React.useState(true)
  const [novo, setNovo] = React.useState(false)
  const [termo, setTermo] = React.useState('')
  const [busca, setBusca] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300)
    return () => clearTimeout(t)
  }, [termo])

  const lista = useQuery({
    queryKey: ['unidade-consumo', busca, aConferir],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('medicamentos_unidade_consumo', { p_busca: busca || undefined, p_a_conferir: aConferir })
      if (error) throw error
      return data as unknown as { itens: MedicamentoUnidade[]; a_conferir: number; sem_unidade: number; sem_forma: number }
    },
  })

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina
        icone={PackageCheck}
        titulo="Unidade de consumo"
        descricao="O cadastro de medicamentos da farmácia: forma, apresentação e a unidade em que cada item é dispensado e contado na conta. Os itens da rede valem para todas as unidades; o que você cadastra vale só nesta."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips rotulo="Quais medicamentos">
          <Chip ativo={aConferir} onClick={() => setAConferir(true)} contagem={lista.data?.a_conferir}>a conferir</Chip>
          <Chip ativo={!aConferir} onClick={() => setAConferir(false)}>todos</Chip>
        </Chips>
        {unidade && !novo && <Button size="sm" onClick={() => setNovo(true)}><Plus /> Novo medicamento</Button>}
      </div>
      {unidade && novo && <NovoMedicamento unidade={unidade} fechar={() => setNovo(false)} />}
      <Input className="max-w-md" aria-label="Buscar medicamento" placeholder="Buscar pelo nome ou pela apresentação" value={termo} onChange={(e) => setTermo(e.target.value)} />
      {(lista.data?.sem_unidade ?? 0) > 0 && (
        <p className="text-apoio text-atencao">{lista.data!.sem_unidade} medicamento(s) sem unidade: a apresentação não diz a forma. Escolha na lista.</p>
      )}
      {(lista.data?.sem_forma ?? 0) > 0 && (
        <p className="text-apoio text-tinta-sussurro">{lista.data!.sem_forma} medicamento(s) sem forma farmacêutica: escolha na coluna Forma.</p>
      )}
      <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
      {lista.isLoading ? <Spinner /> : (lista.data?.itens ?? []).length === 0 ? (
        <Vazio icone={PackageCheck} titulo={aConferir ? 'Nada a conferir' : 'Nenhum medicamento'} texto={aConferir ? 'Todas as formas e unidades de consumo já foram conferidas.' : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table className="min-w-[820px] text-apoio">
            <TableHeader className="bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Medicamento</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Forma</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Unidade de consumo</TableHead>
                <TableHead className="px-3 py-2 text-rotulo font-medium tracking-normal normal-case">Conferida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.data!.itens.map((m) => <Linha key={m.id} m={m} unidade={unidade} />)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/** Forma farmacêutica: a lista fixa e, em "outra", qual. */
function CampoForma({ id, forma, outra, aoMudar }: { id: string; forma: string; outra: string; aoMudar: (forma: string, outra: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CampoSelecao id={id} aria-label="Forma farmacêutica" tamanho="compacto" value={forma} onChange={(e) => aoMudar(e.target.value, outra)}>
        <option value="">Escolha…</option>
        {FORMAS_FARMACEUTICAS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
      </CampoSelecao>
      {forma === 'outra' && (
        <Input className="h-8 w-44" aria-label="Qual forma" placeholder="Qual forma" value={outra} onChange={(e) => aoMudar(forma, e.target.value)} />
      )}
    </div>
  )
}

function NovoMedicamento({ unidade, fechar }: { unidade: string; fechar: () => void }) {
  const qc = useQueryClient()
  const [principio, setPrincipio] = React.useState('')
  const [forma, setForma] = React.useState('')
  const [formaOutra, setFormaOutra] = React.useState('')
  const [apresentacao, setApresentacao] = React.useState('')
  const [concentracao, setConcentracao] = React.useState('')
  const [uc, setUc] = React.useState<UnidadeConsumo | ''>('')
  const [ucOutra, setUcOutra] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [termo, setTermo] = React.useState('')
  React.useEffect(() => {
    const t = setTimeout(() => setTermo(principio.trim()), 300)
    return () => clearTimeout(t)
  }, [principio])

  const parecidos = useQuery({
    queryKey: ['medicamentos-parecidos', unidade, termo],
    enabled: termo.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('medicamentos_parecidos', { p_unidade: unidade, p_termo: termo })
      if (error) throw error
      return (data ?? []) as unknown as Parecido[]
    },
  })
  const recarregar = () => {
    for (const k of ['unidade-consumo', 'medicamentos-parecidos', 'farmacia-estoque']) void qc.invalidateQueries({ queryKey: [k] })
  }
  const cadastrar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cadastrar_medicamento', {
        p_unidade: unidade,
        p_dados: {
          principio_ativo: principio, apresentacao, concentracao, forma_farmaceutica: forma,
          forma_farmaceutica_outra: forma === 'outra' ? formaOutra : null, unidade_consumo: uc, unidade_consumo_outra: uc === 'outra' ? ucOutra : null,
        },
      })
      if (error) throw error
      return data as unknown as { id: string; alta_vigilancia: boolean; regra: string | null }
    },
    onSuccess: (r) => {
      setAviso(`${principio.trim()} cadastrado: vale só nesta unidade.${r.alta_vigilancia ? ` Entrou na lista de alta vigilância (${r.regra ?? 'regra do ISMP'}).` : ''}`)
      setPrincipio(''); setForma(''); setFormaOutra(''); setApresentacao(''); setConcentracao(''); setUc(''); setUcOutra('')
      recarregar()
    },
  })
  const usar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('usar_medicamento_na_unidade', { p_medicamento: id, p_unidade: unidade })
      if (error) throw error
    },
    onSuccess: () => { setAviso('Pronto: o item passa a valer nesta unidade.'); recarregar() },
  })
  const pronto = principio.trim().length >= 3 && apresentacao.trim().length >= 3 && !!forma && (forma !== 'outra' || formaOutra.trim().length >= 3)
    && !!uc && (uc !== 'outra' || ucOutra.trim().length >= 3)
  const erro = (cadastrar.error ?? usar.error ?? parecidos.error) as Error | null

  return (
    <section aria-label="Novo medicamento" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-5 py-4 text-apoio">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-corpo font-semibold text-tinta">Novo medicamento</h3>
          <p className="text-tinta-sussurro">Vale só nesta unidade. Confira os parecidos antes de cadastrar: o mesmo item não entra duas vezes.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={fechar}>Fechar</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="nm-principio">Princípio ativo</Label>
          <Input id="nm-principio" value={principio} onChange={(e) => { setPrincipio(e.target.value); setAviso(null) }} placeholder="Ex.: Tetracaína" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nm-forma">Forma farmacêutica</Label>
          <CampoForma id="nm-forma" forma={forma} outra={formaOutra} aoMudar={(f, o) => { setForma(f); setFormaOutra(o) }} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nm-apresentacao">Apresentação</Label>
          <Input id="nm-apresentacao" value={apresentacao} onChange={(e) => setApresentacao(e.target.value)} placeholder="Ex.: Frasco 10 mL" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nm-concentracao">Concentração (opcional)</Label>
          <Input id="nm-concentracao" value={concentracao} onChange={(e) => setConcentracao(e.target.value)} placeholder="Ex.: 1%" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nm-uc">Unidade de consumo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <CampoSelecao id="nm-uc" tamanho="compacto" value={uc} onChange={(e) => setUc(e.target.value as UnidadeConsumo | '')}>
              <option value="">Escolha…</option>
              {UNIDADES_CONSUMO.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </CampoSelecao>
            {uc === 'outra' && <Input className="h-8 w-40" aria-label="Qual unidade" placeholder="Qual unidade" value={ucOutra} onChange={(e) => setUcOutra(e.target.value)} />}
          </div>
        </div>
      </div>

      {termo.length >= 3 && (
        <div className="flex flex-col gap-1 border-t border-fio pt-3">
          <span className="text-rotulo font-semibold text-tinta-sussurro">Parecidos no cadastro</span>
          {(parecidos.data ?? []).length === 0 && !parecidos.isLoading && <span className="text-tinta-sussurro">Nenhum medicamento com esse nome.</span>}
          <ul>
            {(parecidos.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-trilha py-1.5 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-tinta">{p.principio_ativo}</span>{' '}
                  <span className="text-tinta-apoio">{[p.apresentacao, p.concentracao, p.forma_farmaceutica && rotuloForma(p.forma_farmaceutica, p.forma_farmaceutica_outra)].filter(Boolean).join(' · ')}</span>
                </span>
                {p.da_rede ? <Estado tom="cinza">da rede</Estado>
                  : p.na_unidade ? <Estado tom="teal">desta unidade</Estado>
                    : (
                      <>
                        <Estado tom="cinza">da farmácia de {p.origem ?? 'outra unidade'}</Estado>
                        <Button size="xs" variant="outline" disabled={usar.isPending} onClick={() => usar.mutate(p.id)}>Usar nesta unidade</Button>
                      </>
                    )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MensagemErro texto={erro ? erro.message : null} />
      {aviso && <p role="status" className="text-conforme">{aviso}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!pronto || cadastrar.isPending} onClick={() => cadastrar.mutate()}>Cadastrar</Button>
        <span className="text-rotulo text-tinta-sussurro">A alta vigilância segue a regra do ISMP também no item novo. O sistema não sugere dose.</span>
      </div>
    </section>
  )
}

function Linha({ m, unidade }: { m: MedicamentoUnidade; unidade: string | undefined }) {
  const qc = useQueryClient()
  const [ucSel, setUcSel] = React.useState<UnidadeConsumo | ''>(m.unidade_consumo ?? '')
  const [outra, setOutra] = React.useState(m.unidade_consumo_outra ?? '')
  const [forma, setForma] = React.useState(m.forma_farmaceutica ?? '')
  const [formaOutra, setFormaOutra] = React.useState(m.forma_farmaceutica_outra ?? '')
  const [ficha, setFicha] = React.useState<'corrigir' | 'inativar' | null>(null)
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['unidade-consumo'] })
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_unidade_consumo', {
        p_medicamento: m.id, p_unidade: ucSel as UnidadeConsumo, p_outra: ucSel === 'outra' ? outra.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const salvarForma = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_forma_farmaceutica', {
        p_medicamento: m.id, p_forma: forma, p_outra: forma === 'outra' ? formaOutra.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const mudou = ucSel !== (m.unidade_consumo ?? '') || (ucSel === 'outra' && outra.trim() !== (m.unidade_consumo_outra ?? ''))
  const pronto = !!ucSel && (ucSel !== 'outra' || outra.trim().length >= 3)
  const formaMudou = forma !== (m.forma_farmaceutica ?? '') || (forma === 'outra' && formaOutra.trim() !== (m.forma_farmaceutica_outra ?? ''))
  const formaPronta = !!forma && (forma !== 'outra' || formaOutra.trim().length >= 3)
  const daUnidade = !!m.unidades_locais
  const minha = daUnidade && !!unidade && m.cadastrado_na_unidade === unidade
  return (
    <>
      <TableRow className="align-top hover:bg-transparent">
        <TableCell className="px-3 py-2 align-top whitespace-normal">
          <span className="font-medium text-tinta">{m.principio_ativo}</span>
          <span className="block text-rotulo text-tinta-sussurro">{[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')}</span>
          {daUnidade && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-rotulo text-tinta-sussurro">
              <Estado tom="teal">{minha ? 'desta unidade' : `da farmácia de ${m.origem ?? 'outra unidade'}`}</Estado>
              {m.cadastrado_por && <>cadastrado por {m.cadastrado_por}{m.cadastrado_em ? `, ${fmtDataHora(m.cadastrado_em)}` : ''}</>}
              {minha && !ficha && (
                <>
                  <Button size="xs" variant="ghost" onClick={() => setFicha('corrigir')}>Corrigir</Button>
                  <Button size="xs" variant="ghost" onClick={() => setFicha('inativar')}>Inativar</Button>
                </>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="px-3 py-2 align-top whitespace-normal">
          <div className="flex flex-wrap items-center gap-2">
            <CampoForma id={`forma-${m.id}`} forma={forma} outra={formaOutra} aoMudar={(f, o) => { setForma(f); setFormaOutra(o) }} />
            {formaMudou && (
              <Button size="sm" disabled={!formaPronta || salvarForma.isPending} onClick={() => salvarForma.mutate()}><Check /> Salvar</Button>
            )}
          </div>
          {salvarForma.error && <span role="alert" className="block text-rotulo text-critico">{(salvarForma.error as Error).message}</span>}
        </TableCell>
        <TableCell className="px-3 py-2 align-top whitespace-normal">
          <div className="flex flex-wrap items-center gap-2">
            <CampoSelecao aria-label={`Unidade de consumo de ${m.principio_ativo}`} tamanho="compacto" value={ucSel}
              onChange={(e) => setUcSel(e.target.value as UnidadeConsumo | '')}>
              <option value="">Escolha…</option>
              {UNIDADES_CONSUMO.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </CampoSelecao>
            {ucSel === 'outra' && (
              <Input className="h-8 w-40" aria-label="Qual unidade" placeholder="Qual unidade" value={outra} onChange={(e) => setOutra(e.target.value)} />
            )}
            <Button size="sm" variant={mudou ? 'default' : 'outline'} disabled={!pronto || salvar.isPending || (!mudou && !!m.conferida_em)}
              onClick={() => salvar.mutate()}>
              <Check /> {mudou ? 'Salvar' : 'Confirmar'}
            </Button>
          </div>
          {salvar.error && <span role="alert" className="block text-rotulo text-critico">{(salvar.error as Error).message}</span>}
        </TableCell>
        <TableCell className="px-3 py-2 align-top whitespace-normal text-tinta-apoio">
          {m.conferida_em ? `${rotuloUnidade(m.unidade_consumo, m.unidade_consumo_outra)} · ${m.conferida_por ?? '—'}, ${fmtDataHora(m.conferida_em)}` : 'sugerida, a conferir'}
        </TableCell>
      </TableRow>
      {ficha && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="px-3 pb-3 whitespace-normal">
            {ficha === 'corrigir'
              ? <Corrigir m={m} fechar={() => setFicha(null)} aoMudar={recarregar} />
              : <Inativar m={m} fechar={() => setFicha(null)} aoMudar={recarregar} />}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/** Corrigir o item que esta unidade cadastrou: o antes e o depois ficam no registro, com o motivo. */
function Corrigir({ m, fechar, aoMudar }: { m: MedicamentoUnidade; fechar: () => void; aoMudar: () => void }) {
  const [principio, setPrincipio] = React.useState(m.principio_ativo)
  const [apresentacao, setApresentacao] = React.useState(m.apresentacao ?? '')
  const [concentracao, setConcentracao] = React.useState(m.concentracao ?? '')
  const [forma, setForma] = React.useState(m.forma_farmaceutica ?? '')
  const [formaOutra, setFormaOutra] = React.useState(m.forma_farmaceutica_outra ?? '')
  const [motivo, setMotivo] = React.useState('')
  const corrigir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('corrigir_medicamento', {
        p_medicamento: m.id, p_motivo: motivo.trim(),
        p_dados: { principio_ativo: principio, apresentacao, concentracao, forma_farmaceutica: forma, forma_farmaceutica_outra: forma === 'outra' ? formaOutra : null },
      })
      if (error) throw error
    },
    onSuccess: () => { fechar(); aoMudar() },
  })
  return (
    <div className="flex flex-col gap-2 border-l-2 border-acao/40 pl-3 text-apoio">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Princípio ativo" value={principio} onChange={(e) => setPrincipio(e.target.value)} />
        <CampoForma id={`corrigir-forma-${m.id}`} forma={forma} outra={formaOutra} aoMudar={(f, o) => { setForma(f); setFormaOutra(o) }} />
        <Input aria-label="Apresentação" value={apresentacao} onChange={(e) => setApresentacao(e.target.value)} />
        <Input aria-label="Concentração" placeholder="Concentração (opcional)" value={concentracao} onChange={(e) => setConcentracao(e.target.value)} />
      </div>
      <Input aria-label="Motivo da correção" placeholder={`Motivo (mínimo de ${MINIMO} letras)`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={motivo.trim().length < MINIMO || corrigir.isPending} onClick={() => corrigir.mutate()}>Salvar correção</Button>
        <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
      </div>
      <MensagemErro texto={corrigir.error ? (corrigir.error as Error).message : null} />
    </div>
  )
}

/** Inativar o item que esta unidade cadastrou: sai das buscas; o que já foi prescrito continua apontando para ele. */
function Inativar({ m, fechar, aoMudar }: { m: MedicamentoUnidade; fechar: () => void; aoMudar: () => void }) {
  const [motivo, setMotivo] = React.useState('')
  const inativar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('inativar_medicamento', { p_medicamento: m.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { fechar(); aoMudar() },
  })
  return (
    <div className="flex flex-col gap-2 border-l-2 border-critico/40 pl-3 text-apoio">
      <span className="text-tinta-apoio">O item sai das buscas de todas as unidades que o usam. Prescrições e dispensações antigas continuam com ele.</span>
      <Input aria-label="Motivo da inativação" placeholder={`Motivo (mínimo de ${MINIMO} letras)`} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" disabled={motivo.trim().length < MINIMO || inativar.isPending} onClick={() => inativar.mutate()}>Inativar</Button>
        <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
      </div>
      <MensagemErro texto={inativar.error ? (inativar.error as Error).message : null} />
    </div>
  )
}
