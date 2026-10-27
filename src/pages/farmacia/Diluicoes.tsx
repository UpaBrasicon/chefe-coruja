// ─────────────────────────────────────────────────────────────────────────────
// Diluição — aba da Central do Farmacêutico (Fase 4.5; revisão visual 3.7b,
// opção B do RT em 26/10/2026: uma aba só, como biblioteca).
//
// Abas internas: "Valendo na unidade" (o que chega ao prescritor desta unidade:
// o modelo da rede ou o ajuste da unidade), "Rascunhos" e "Substituídas". À
// esquerda a lista, à direita a ficha (valendo) ou o editor (rascunho,
// substituída). Ajustar uma linha que vale cria o rascunho da unidade e leva a
// ele na mesma tela.
//
// O farmacêutico revisa o rascunho (o HU-UFGD v3 é só o ponto de partida,
// decisão de 27/09/2026) e publica com o CRF do revisor. Publicada não se
// edita: mudar é criar uma nova versão, que substitui a anterior a partir de
// agora — a anterior continua visível como "substituída", e as prescrições
// feitas sob ela continuam mostrando a versão delas.
//
// Ponto 2 das telas do farmacêutico (decisão do RT de 27/10/2026): "Nova
// diluição" fica no topo, em todas as abas, e a diluição nova é da unidade. O
// modelo da rede só o super admin cria e muda; aqui ele aparece para leitura e
// para "Ajustar esta linha". Migration 20270109000001_diluicao_da_unidade.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FlaskConical, Plus, Search } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { useUnidade } from '@/contexts/UnidadeContext'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { data as dataFmt, dataHora } from '@/lib/formato'
import { Estado } from '@/components/porta/Estado'
import { tomDaVariante } from '@/components/porta/tomEstado'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'
import { EnviarArquivo } from './EnviarArquivo'

type Diluicao = {
  id: string; medicamento_id: string | null; principio_ativo: string; apresentacao: string; via: string; status: string; versao: number
  reconstituicao_diluente: string | null; reconstituicao_volume_ml: number | null; reconstituicao_concentracao: string | null
  diluicao_solucao: string[] | null; diluicao_volume_min_ml: number | null; concentracao_maxima: string | null
  tempo_infusao_min: number | null; velocidade_max: string | null; bolus_permitido: boolean | null
  estabilidade_ta_h: number | null; estabilidade_refrig_h: number | null; fotossensivel: boolean | null; acesso: string | null
  observacoes: string | null; fonte: string; revisor_crf: string | null; vigente_desde: string | null; vigente_ate: string | null
  motivo_alteracao: string | null; origem_id: string | null
  alta_vigilancia: boolean | null; risco_flebite: boolean | null; unidade_id: string | null
}
/** Linha que vale para a unidade (padrao_diluicao_unidade): o modelo da rede ou o ajuste dela. */
type Campos = Record<string, unknown>
type LinhaPadrao = {
  id: string; medicamento_id: string; principio_ativo: string; apresentacao: string; via: string; versao: number; da_unidade: boolean
  texto: string; campos: Campos; modelo: { id: string; versao: number; texto: string; campos: Campos } | null
  alta_vigilancia: boolean; risco_flebite: boolean | null; fonte: string; revisor_crf: string | null; motivo_alteracao: string | null
  publicado_por: string | null; vigente_desde: string | null; rascunho_id: string | null
}
const CAMPOS_PADRAO: [string, string, (v: unknown) => string][] = [
  ['reconstituicao_diluente', 'Reconstituir com', (v) => String(v)],
  ['diluicao_solucao', 'Diluir em', (v) => (Array.isArray(v) ? v.join(' ou ') : String(v))],
  ['diluicao_volume_min_ml', 'Volume mínimo', (v) => `${v} mL`],
  ['concentracao_maxima', 'Concentração máxima', (v) => String(v)],
  ['tempo_infusao_min', 'Tempo de infusão', (v) => `${v} min`],
  ['acesso', 'Acesso', (v) => String(v)],
  ['estabilidade_ta_h', 'Estabilidade em TA', (v) => `${v} h`],
]
const valorCampo = (c: Campos, k: string, f: (v: unknown) => string) => {
  const v = c[k]
  return v == null || (Array.isArray(v) && v.length === 0) ? '—' : f(v)
}
const STATUS: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'secondary' }> = {
  publicado: { rotulo: 'vigente', variante: 'success' },
  rascunho: { rotulo: 'rascunho', variante: 'warning' },
  revisado: { rotulo: 'rascunho', variante: 'warning' },
  substituido: { rotulo: 'substituída', variante: 'secondary' },
}
const dia = (iso: string | null) => (iso ? dataFmt(iso) : '—')
const hora = (iso: string | null) => (iso ? dataHora(iso) : '—')
type AbaDil = 'valendo' | 'rascunho' | 'substituido'
const ehRascunho = (d: Diluicao) => d.status === 'rascunho' || d.status === 'revisado'

export default function Diluicoes({ unidade, selecionadaInicial = null }: { unidade: string; selecionadaInicial?: string | null }) {
  const qc = useQueryClient()
  const [aba, setAba] = React.useState<AbaDil>(selecionadaInicial ? 'rascunho' : 'valendo')
  const [selecionada, setSelecionada] = React.useState<string | null>(selecionadaInicial)
  const [nova, setNova] = React.useState(false)
  const [busca, setBusca] = React.useState('')
  const [soAv, setSoAv] = React.useState(false)
  const [soUnidade, setSoUnidade] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const valendo = useQuery({
    queryKey: ['padrao-diluicao-unidade', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('padrao_diluicao_unidade', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as LinhaPadrao[]
    },
  })
  const tabela = useQuery({
    queryKey: ['diluicoes-farmacia'],
    queryFn: async () => {
      const { data, error } = await supabase.from('diluicao').select('*').order('principio_ativo').order('via').order('versao')
      if (error) throw error
      return (data ?? []) as unknown as Diluicao[]
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['padrao-diluicao-unidade'] })
    void qc.invalidateQueries({ queryKey: ['diluicoes-farmacia'] })
  }
  const trocarAba = (a: AbaDil) => { setAba(a); setSelecionada(null); setNova(false); setErro(null) }
  /** Depois de ajustar uma linha que vale: o rascunho, na mesma tela. */
  const abrirRascunho = (id: string) => { recarregar(); setAba('rascunho'); setSelecionada(id); setNova(false) }

  const termo = busca.trim().toLowerCase()
  const confere = (principio: string, apres: string, av: boolean | null) =>
    (!soAv || !!av) && (principio.toLowerCase().includes(termo) || apres.toLowerCase().includes(termo))
  const linhas = (valendo.data ?? []).filter((l) => (!soUnidade || l.da_unidade) && confere(l.principio_ativo, l.apresentacao, l.alta_vigilancia))
  // rascunhos: só os desta unidade (o da rede é do super admin); substituídas: a rede e esta unidade
  const rascunhos = (tabela.data ?? []).filter((d) => ehRascunho(d) && d.unidade_id === unidade)
  const substituidas = (tabela.data ?? []).filter((d) => d.status === 'substituido' && (d.unidade_id === null || d.unidade_id === unidade))
  const abrirNova = () => { setAba('rascunho'); setSelecionada(null); setNova(true); setErro(null) }
  const daAba = (aba === 'rascunho' ? rascunhos : substituidas).filter((d) => confere(d.principio_ativo, d.apresentacao, d.alta_vigilancia))

  const selLinha = aba === 'valendo' ? linhas.find((l) => l.id === selecionada) ?? linhas[0] : undefined
  const selDil = aba !== 'valendo' && !nova ? daAba.find((d) => d.id === selecionada) ?? daAba[0] : undefined
  const erroLista = (valendo.error ?? tabela.error) as Error | null

  return (
    <div className="flex flex-col gap-3">
      <EnviarArquivo compacto unidade={unidade} tipo="padrao_diluicao" icone={FlaskConical} rotulo="Enviar padrão da unidade"
        ajuda="O padrão de diluição da unidade no formato em que a farmácia já mantém. Fica registrado como comprovante; o que chega ao prescritor é o que você publica linha a linha." />
      <MensagemErro texto={erro ?? (erroLista ? erroLista.message : null)} />
      <Tabs value={aba} onValueChange={(v) => trocarAba(v as AbaDil)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-fio">
          <TabsList aria-label="Diluição" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            <TabsTrigger value="valendo">Valendo na unidade <span className="text-rotulo font-semibold text-acao tabular-nums">{(valendo.data ?? []).length}</span></TabsTrigger>
            <TabsTrigger value="rascunho">Rascunhos <span className={cn('text-rotulo font-semibold tabular-nums', rascunhos.length ? 'text-atencao' : 'text-acao')}>{rascunhos.length}</span></TabsTrigger>
            <TabsTrigger value="substituido">Substituídas <span className="text-rotulo font-semibold text-acao tabular-nums">{substituidas.length}</span></TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
              <Input aria-label="Buscar diluição" className="h-8 w-52 pl-8" placeholder="Princípio ativo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            {aba === 'valendo' && <Chip ativo={soUnidade} onClick={() => setSoUnidade(!soUnidade)}>Só da unidade</Chip>}
            <Chip ativo={soAv} onClick={() => setSoAv(!soAv)}><AlertTriangle className="size-3.5" aria-hidden /> Só AV</Chip>
            <Button size="sm" onClick={abrirNova}><Plus aria-hidden /> Nova diluição</Button>
          </div>
        </div>
      </Tabs>

      <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex max-h-[70vh] flex-col overflow-y-auto border-b border-fio md:border-r md:border-b-0">
          {aba === 'valendo' && linhas.map((l) => (
            <BotaoLinha key={l.id} variante="linha" aria-current={l.id === selLinha?.id ? 'true' : undefined} onClick={() => { setSelecionada(l.id); setErro(null) }}
              className={cn('flex-col gap-0.5 px-4', l.id === selLinha?.id && 'bg-alerta-marca')}>
              <span className="flex flex-wrap items-center gap-2 text-apoio font-semibold text-tinta">{l.principio_ativo}{l.alta_vigilancia && <SeloAltaVigilancia curto />}</span>
              <span className="text-rotulo text-tinta-sussurro">{l.apresentacao} · {l.via}</span>
              <span className={cn('text-rotulo', l.da_unidade ? 'text-acao' : 'text-tinta-sussurro')}>
                {l.da_unidade ? `da unidade · v${l.versao}` : `modelo da rede · v${l.versao}`}{l.rascunho_id ? ' · ajuste em rascunho' : ''}
              </span>
            </BotaoLinha>
          ))}
          {aba !== 'valendo' && daAba.map((d) => (
            <BotaoLinha key={d.id} variante="linha" aria-current={d.id === selDil?.id ? 'true' : undefined} onClick={() => { setSelecionada(d.id); setNova(false); setErro(null) }}
              className={cn('flex-col gap-0.5 px-4', d.id === selDil?.id && 'bg-alerta-marca')}>
              <span className="flex flex-wrap items-center gap-2 text-apoio font-semibold text-tinta">{d.principio_ativo}{d.alta_vigilancia && <SeloAltaVigilancia curto />}</span>
              <span className="text-rotulo text-tinta-sussurro">{d.apresentacao} · {d.via} · v{d.versao}</span>
              <span className="text-rotulo text-tinta-sussurro">
                {d.unidade_id ? 'da unidade' : 'modelo da rede'}
                {aba === 'substituido' && d.vigente_ate ? ` · substituída em ${dia(d.vigente_ate)}` : ''}
                {!d.medicamento_id ? ' · sem cadastro' : ''}
              </span>
            </BotaoLinha>
          ))}
          {(aba === 'valendo' ? linhas.length : daAba.length) === 0 && (
            <p className="px-4 py-4 text-apoio text-tinta-sussurro">
              {aba === 'valendo' ? 'Nenhuma diluição valendo com esse filtro.' : aba === 'rascunho' ? 'Nenhum rascunho. "Ajustar esta linha" numa que vale cria o rascunho aqui.' : 'Nenhuma diluição substituída.'}
            </p>
          )}
        </div>
        <div className="min-w-0">
          {aba === 'valendo' && selLinha && <FichaValendo key={selLinha.id} l={selLinha} unidade={unidade} aoErro={setErro} aoMudar={recarregar} abrirRascunho={abrirRascunho} />}
          {aba !== 'valendo' && selDil && <Editor key={`${selDil.id}:${selDil.status}`} d={selDil} aoErro={setErro}
            aoMudar={(novoId) => { recarregar(); if (novoId) setSelecionada(novoId) }} />}
          {aba === 'rascunho' && (nova || !selDil) && <NovaDiluicao unidade={unidade} aoCriar={(id) => { recarregar(); setNova(false); setSelecionada(id) }}
            aoPublicar={() => { recarregar(); setNova(false); setAba('valendo'); setSelecionada(null) }} aoErro={setErro} />}
          {((aba === 'valendo' && !selLinha) || (aba === 'substituido' && !selDil)) && (
            <p className="px-5 py-4 text-apoio text-tinta-sussurro">Escolha uma linha na lista.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** A ficha de uma linha que vale: os campos (com o valor do modelo riscado quando a unidade mudou), a fonte e as ações. */
function FichaValendo({ l, unidade, aoErro, aoMudar, abrirRascunho }: {
  l: LinhaPadrao; unidade: string; aoErro: (m: string | null) => void; aoMudar: () => void; abrirRascunho: (id: string) => void
}) {
  const [voltando, setVoltando] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const flebite = l.risco_flebite == null ? 'não informado' : l.risco_flebite ? 'sim' : 'não'
  return (
    <section aria-label={`Diluição de ${l.principio_ativo}`} className="flex flex-col gap-3 px-5 py-4 text-apoio">
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-corpo font-semibold text-tinta">{l.principio_ativo}{l.alta_vigilancia && <SeloAltaVigilancia />}</h3>
        <p className="text-tinta-sussurro">{l.apresentacao} · {l.via}</p>
        <div className="mt-1"><Estado tom={l.da_unidade ? 'teal' : 'cinza'}>{l.da_unidade ? `da unidade · v${l.versao}` : `modelo da rede · v${l.versao}`}</Estado></div>
      </div>
      <dl className="flex flex-col">
        {CAMPOS_PADRAO.map(([k, rot, f]) => {
          const atual = valorCampo(l.campos, k, f)
          const original = l.modelo ? valorCampo(l.modelo.campos, k, f) : null
          return (
            <div key={k} className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 border-b border-trilha py-1.5">
              <dt className="text-tinta-sussurro">{rot}</dt>
              <dd className="text-tinta">
                {atual}
                {original != null && original !== atual && <span className="ml-1.5 text-tinta-sussurro line-through" title="Valor do modelo da rede">{original}</span>}
              </dd>
            </div>
          )
        })}
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2 py-1.5">
          <dt className="text-tinta-sussurro">Risco de flebite</dt>
          <dd className={cn(l.risco_flebite ? 'font-medium text-atencao' : 'text-tinta')}>{flebite}</dd>
        </div>
      </dl>
      <p className="text-rotulo text-tinta-sussurro">
        Fonte: {l.fonte}{l.revisor_crf ? ` · revisado por ${l.revisor_crf}` : ''}{l.publicado_por ? ` · publicado por ${l.publicado_por}` : ''}{l.vigente_desde ? ` em ${hora(l.vigente_desde)}` : ''}
      </p>
      {l.da_unidade && l.motivo_alteracao && <p className="text-acao">Por que muda: {l.motivo_alteracao}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-fio pt-3">
        <Button size="sm" variant="outline" onClick={async () => {
          if (l.rascunho_id) return abrirRascunho(l.rascunho_id)
          const { data, error } = await supabase.rpc('ajustar_diluicao_unidade', { p_diluicao: l.id, p_unidade: unidade })
          if (error) return aoErro(error.message)
          aoErro(null); abrirRascunho(data)
        }}><FlaskConical className="size-3.5" aria-hidden />{l.rascunho_id ? 'Continuar o ajuste' : 'Ajustar esta linha'}</Button>
        {l.da_unidade && l.modelo && !voltando && <Button size="sm" variant="ghost" onClick={() => setVoltando(true)}>Voltar ao modelo</Button>}
      </div>
      {voltando && (
        <div className="flex flex-wrap items-end gap-2.5 border-l-2 border-acao/40 pl-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-grafite">Por que volta ao modelo
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Fica registrado junto da linha encerrada" /></label>
          <Button size="sm" variant="ghost" onClick={() => { setVoltando(false); setMotivo('') }}>Cancelar</Button>
          <Button size="sm" disabled={motivo.trim().length < 10} onClick={async () => {
            const { error } = await supabase.rpc('diluicao_voltar_ao_modelo', { p_diluicao: l.id, p_motivo: motivo.trim() })
            if (error) return aoErro(error.message)
            aoErro(null); setVoltando(false); aoMudar()
          }}>Voltar ao modelo v{l.modelo?.versao}</Button>
          <span className="basis-full text-rotulo text-tinta-sussurro">A prescrição da unidade volta a receber o modelo da rede a partir de agora. A linha da unidade fica no histórico como substituída.</span>
        </div>
      )}
    </section>
  )
}

function NovaDiluicao({ unidade, aoCriar, aoPublicar, aoErro }: {
  unidade: string; aoCriar: (id: string) => void; aoPublicar: () => void; aoErro: (m: string | null) => void
}) {
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<{ id: string; principio_ativo: string; apresentacao: string | null } | null>(null)
  const [via, setVia] = React.useState('EV')
  const [f, setF] = React.useState<Record<string, string>>({})
  const [ocupado, setOcupado] = React.useState(false)
  const unidadeBusca = useUnidade().unidadeAtiva?.unidade_id
  const r = useQuery({
    queryKey: ['med-farmacia', busca, unidadeBusca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => (await supabase.from('medicamento').select('id, principio_ativo, apresentacao').or(filtroDaUnidade(unidadeBusca)).ilike('principio_ativo_norm', `%${normalizarMedicamento(busca.trim())}%`).limit(15)).data ?? [],
  })
  // um passo só: cria o rascunho já com os campos; publicar cria e publica
  async function criar(publicar: boolean) {
    setOcupado(true)
    const { data, error } = await supabase.rpc('salvar_diluicao', {
      p_id: undefined as unknown as string, p_dados: { ...paraDados(f), medicamento_id: med!.id, via, unidade_id: unidade } as never,
    })
    if (error) { setOcupado(false); return aoErro(error.message) }
    if (publicar) {
      const pub = await supabase.rpc('publicar_diluicao_versao', { p_id: data as string })
      setOcupado(false)
      // não publicou (falta campo): fica o rascunho, aberto no editor, com o motivo
      if (pub.error) { aoCriar(data as string); return aoErro(`Rascunho salvo, mas não publicou: ${pub.error.message}`) }
      aoErro(null); return aoPublicar()
    }
    setOcupado(false); aoErro(null); aoCriar(data as string)
  }
  return (
    <section aria-label="Nova diluição" className="flex flex-col gap-2 px-5 py-4 text-apoio">
      <div>
        <h3 className="text-corpo font-semibold text-tinta">Nova diluição</h3>
        <p className="text-tinta-sussurro">Para um medicamento do cadastro. Depois de publicada, vale só nesta unidade. Para mudar uma linha que já vale, use "Ajustar esta linha".</p>
      </div>
        {med ? <p><strong>{med.principio_ativo}</strong> · {med.apresentacao} <Button size="xs" variant="ghost" onClick={() => setMed(null)}>Trocar</Button></p> : (
          <>
            <Input placeholder="Medicamento do cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {(r.data ?? []).map((m) => (
              <Button key={m.id} variant="link" size="xs" className="h-auto min-h-0 justify-start self-start px-0 text-left whitespace-normal text-tinta hover:text-tinta" onClick={() => setMed(m)}>{m.principio_ativo} · {m.apresentacao}</Button>
            ))}
          </>
        )}
        {med && (
          <>
            <div className="flex flex-col gap-1 sm:w-1/2"><Label htmlFor="nd-via">Via</Label>
              <CampoSelecao id="nd-via" tamanho="compacto" value={via} onChange={(e) => setVia(e.target.value)}>
                {['EV', 'IM', 'SC', 'IN', 'VO'].map((v) => <option key={v}>{v}</option>)}
              </CampoSelecao>
            </div>
            <CamposDiluicao prefixo="nd" f={f} setF={setF} editavel />
            <p className="text-rotulo text-tinta-sussurro">
              Publicar exige fonte e CRF do revisor; na via EV, também volume mínimo e tempo de infusão. Cada valor vem da fonte informada.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void criar(false)}>Salvar rascunho</Button>
              <Button size="sm" disabled={ocupado} onClick={() => void criar(true)}>Publicar aos prescritores</Button>
            </div>
          </>
        )}
    </section>
  )
}

// a ordem do formulário: primeiro em que e quanto diluir, depois reconstituição, estabilidade e fonte
const CAMPOS: [keyof Diluicao, string, 'texto' | 'numero' | 'lista' | 'bool'][] = [
  ['diluicao_solucao', 'Diluir em (separe por vírgula: SF 0,9%, SG 5%)', 'lista'], ['diluicao_volume_min_ml', 'Volume mínimo de diluente (mL)', 'numero'],
  ['tempo_infusao_min', 'Tempo de infusão (min)', 'numero'], ['concentracao_maxima', 'Concentração máxima', 'texto'],
  ['velocidade_max', 'Velocidade máxima', 'texto'], ['bolus_permitido', 'Bolus permitido', 'bool'],
  ['reconstituicao_diluente', 'Reconstituir com', 'texto'], ['reconstituicao_volume_ml', 'Volume de reconstituição (mL)', 'numero'],
  ['reconstituicao_concentracao', 'Concentração após reconstituir', 'texto'], ['acesso', 'Acesso (periférico/central)', 'texto'],
  ['estabilidade_ta_h', 'Estabilidade em TA (h)', 'numero'], ['estabilidade_refrig_h', 'Estabilidade refrigerado (h)', 'numero'],
  ['fotossensivel', 'Fotossensível', 'bool'], ['risco_flebite', 'Risco de flebite (conforme a fonte)', 'bool'],
  ['alta_vigilancia', 'Alta vigilância (conforme a fonte)', 'bool'], ['observacoes', 'Observações', 'texto'],
  ['fonte', 'Fonte (manual, versão, página)', 'texto'], ['revisor_crf', 'Revisor (CRF)', 'texto'],
]

/** Os campos do formulário para o banco (lista separada por vírgula, sim/não). */
function paraDados(f: Record<string, string>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const [k, , t] of CAMPOS) {
    const v = f[k] ?? ''
    o[k] = t === 'lista' ? v.split(',').map((x) => x.trim()).filter(Boolean) : t === 'bool' ? (v === 'sim' ? true : v === 'não' ? false : null) : v
  }
  return o
}

function CamposDiluicao({ prefixo, f, setF, editavel }: {
  prefixo: string; f: Record<string, string>; setF: (f: Record<string, string>) => void; editavel: boolean
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CAMPOS.map(([k, r, t]) => (
        <div key={k} className="flex flex-col gap-1">
          <Label htmlFor={`${prefixo}-${k}`}>{r}</Label>
          {t === 'bool' ? (
            <CampoSelecao id={`${prefixo}-${k}`} tamanho="compacto" disabled={!editavel} value={f[k] ?? ''}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}>
              <option value="">—</option><option>sim</option><option>não</option>
            </CampoSelecao>
          ) : (
            <Input id={`${prefixo}-${k}`} disabled={!editavel} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}
              inputMode={t === 'numero' ? 'decimal' : undefined} />
          )}
        </div>
      ))}
    </div>
  )
}

function Editor({ d, aoMudar, aoErro }: { d: Diluicao; aoMudar: (novoId?: string) => void; aoErro: (m: string | null) => void }) {
  // o modelo da rede (sem unidade) é do super admin: aqui só se lê
  const daRede = d.unidade_id === null
  const editavel = (d.status === 'rascunho' || d.status === 'revisado') && !daRede
  const inicial = React.useCallback(() => Object.fromEntries(CAMPOS.map(([k, , t]) => {
    const v = d[k]
    return [k, t === 'lista' ? ((v as string[] | null) ?? []).join(', ') : t === 'bool' ? (v === null ? '' : v ? 'sim' : 'não') : v == null ? '' : String(v)]
  })) as Record<string, string>, [d])
  const [f, setF] = React.useState<Record<string, string>>(inicial)
  const [motivo, setMotivo] = React.useState(d.motivo_alteracao ?? '')

  const dados = () => {
    const o = paraDados(f)
    if (d.origem_id) o.motivo_alteracao = motivo
    return o
  }
  async function salvar() {
    const { error } = await supabase.rpc('salvar_diluicao', { p_id: d.id, p_dados: dados() as never })
    if (error) { aoErro(error.message); return false }
    aoErro(null); aoMudar(); return true
  }
  const st = STATUS[d.status] ?? { rotulo: d.status, variante: 'secondary' as const }

  return (
    <section aria-label={`Diluição de ${d.principio_ativo}`} className="flex flex-col gap-2 px-5 py-4 text-apoio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex flex-wrap items-center gap-2 text-corpo font-semibold text-tinta">
            {d.principio_ativo} · {d.via} {d.alta_vigilancia && <SeloAltaVigilancia />} <Estado tom={tomDaVariante(st.variante)}>{st.rotulo}</Estado> <span className="text-rotulo font-normal text-tinta-sussurro">versão {d.versao}</span>
          </h3>
          <p className="text-tinta-sussurro">
            {d.apresentacao}
            {d.vigente_desde && <> · vigente desde {dia(d.vigente_desde)}</>}
            {d.vigente_ate && <> · substituída em {dia(d.vigente_ate)}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {editavel ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void salvar()}>Salvar rascunho</Button>
              <Button size="sm" onClick={async () => {
                if (!(await salvar())) return
                const { error } = await supabase.rpc('publicar_diluicao_versao', { p_id: d.id })
                if (error) return aoErro(error.message)
                aoErro(null); aoMudar()
              }}>Publicar aos prescritores</Button>
            </>
          ) : d.status === 'publicado' && !daRede ? (
            <Button size="sm" variant="outline" onClick={async () => {
              const { data, error } = await supabase.rpc('salvar_diluicao', { p_id: d.id, p_dados: {} })
              if (error) return aoErro(error.message)
              aoErro(null); aoMudar(data as string)
            }}>Criar nova versão</Button>
          ) : null}
        </div>
      </div>
        {d.unidade_id && <p className="text-acao">Da unidade: publicada, vale só nesta unidade (e, se houver modelo da rede, o substitui nela).</p>}
        {daRede && <p className="text-tinta-apoio">Modelo da rede: só o super admin muda. Para a sua unidade, use "Ajustar esta linha" em Valendo na unidade.</p>}
        {!d.medicamento_id && <p className="text-atencao">Esta diluição não está ligada ao cadastro de medicamentos: não pode ser publicada até ser ligada.</p>}
        <CamposDiluicao prefixo="dil" f={f} setF={setF} editavel={editavel} />
        {editavel && d.origem_id && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="dil-motivo">O que mudou em relação à versão anterior *</Label>
            <Textarea id="dil-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
        <p className="text-rotulo text-tinta-sussurro">
          Publicar exige CRF do revisor e fonte; via EV exige também volume mínimo e tempo de infusão. Nova versão pede o que mudou.
        </p>
    </section>
  )
}
