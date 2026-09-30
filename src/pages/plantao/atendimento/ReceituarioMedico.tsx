// Receituário no desenho e no fluxo do protótipo (Documentos do Atendimento,
// bloco ehRec; index.html valsProtocolos ~22378; a Receita de Controle
// Especial como em Prescrição Médica.dc.html).
//
// - Identificação SEMPRE do cadastro (paciente), do login (médico) e da
//   unidade (CNES): nada de nome, CNS ou CNES digitado aqui.
// - Tipo de receita: Simples ou Controle especial. Na simples, um item pode ser
//   marcado como de controle especial. Item de controle especial sai na
//   Receita de Controle Especial (Portaria SVS/MS 344/98) em 2 vias — 1ª retida
//   na farmácia, 2ª do paciente — com a identificação do comprador e do
//   fornecedor em branco, para a farmácia preencher (lib/folhas.ts).
// - Protocolos da instituição (escritos pelo gestor) e favoritos do médico
//   (Preferências de prescrição). Paciente pediátrico não recebe nenhum dos
//   dois: são de adulto. A trava de alergia é a regra do banco
//   (alergia_trava_medicamento); item digitado fora do cadastro só avisa.
// - Dose, posologia e quantidade são escritas pelo médico: nada é sugerido.
// - A barra comum do documento (estado, copiar como novo, histórico,
//   cancelar, emitir) fica no alto; a emissão é a de sempre (abrirImpressao
//   com o rascunho do servidor).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardPlus, PencilLine, Pill, Plus, Star, Trash2, TriangleAlert, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { abrirImpressao } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { invalidarDocumentos, useDocumentosEpisodio } from '@/components/documento/documentos'
import { useIdentificacao } from '@/components/documentos/identificacao'
import { SeletorPaciente, usePacienteDoDocumento } from '@/components/documentos/SeletorPaciente'
import { Aviso, Bloco, Chip, Leitura, Pilulas, Rodape, Sugestoes, Texto } from '@/components/documentos/ui'
import { carregarEnvelope, useRascunho } from '../shared/rascunho'

type ItemRx = {
  id: string
  medicamento: string
  /** apresentação (comprimido, frasco…) */
  dose: string
  posologia: string
  quantidade: string
  controle_especial: boolean
  /** do cadastro de medicamentos: a trava de alergia do banco vale para ele */
  medicamento_id: string | null
}
type Rx = { controle: boolean; itens: ItemRx[]; obs: string }
export type RascunhoReceita = { receita: Rx }

type Identificacao = ReturnType<typeof useIdentificacao>

const TEXTO_PEDIATRICO =
  'Paciente pediátrico. Os protocolos e favoritos desta unidade têm dose e apresentação de adulto e não são oferecidos. Sem referência pediátrica cadastrada, prescreva item a item pela busca, por peso aferido.'

/** Lê a receita do rascunho local, do conteúdo copiado ou de documento antigo ({tipo, itens, obs}). */
function normalizar(r: unknown): Rx {
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
  const controle = o.controle === true || o.controle_especial === true || o.tipo === 'controle_especial'
  const itens = (Array.isArray(o.itens) ? o.itens : []).map((x): ItemRx => {
    const i = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    const s = (...ks: string[]) => {
      for (const k of ks) if (typeof i[k] === 'string' && (i[k] as string).trim()) return i[k] as string
      return ''
    }
    return {
      id: s('id') || crypto.randomUUID(),
      medicamento: s('medicamento', 'nome', 'med'),
      dose: s('dose', 'apresentacao'),
      posologia: s('posologia', 'uso'),
      quantidade: s('quantidade', 'qtd'),
      controle_especial: i.controle_especial === true,
      medicamento_id: s('medicamento_id') || null,
    }
  }).filter((i) => i.medicamento.trim())
  return { controle, itens, obs: typeof o.obs === 'string' ? o.obs : '' }
}

function carregarReceita(chave: string): RascunhoReceita {
  const env = carregarEnvelope<{ receita?: unknown }>(chave)
  return { receita: normalizar(env?.dados?.receita) }
}

/**
 * O conteúdo gravado no documento. `receita` é o que lib/folhas.ts lê
 * ({tipo, obs, controle_especial, itens:[{medicamento, dose, posologia,
 * quantidade, controle_especial}]}); `paciente` é o bloco antigo, para quem já
 * lê documentos emitidos; pac/cab/unidade/usuario é o retrato do protótipo.
 */
function montarConteudo(rx: Rx, ident: Identificacao) {
  return {
    ...ident.retrato,
    paciente: ident.pacienteAntigo(),
    receita: {
      tipo: rx.controle ? 'controle_especial' : 'branca',
      controle_especial: rx.controle,
      obs: rx.obs.trim(),
      itens: rx.itens.map((i) => ({
        id: i.id, medicamento: i.medicamento.trim(), dose: i.dose.trim(), posologia: i.posologia.trim(), quantidade: i.quantidade.trim(),
        controle_especial: rx.controle || i.controle_especial, medicamento_id: i.medicamento_id,
      })),
    },
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Item escrito à mão: só avisa se o nome contém uma alergia registrada (a trava que vale é a do banco). */
function alergiaNoTexto(nome: string, alergias: string[]): string | null {
  const n = norm(nome)
  return alergias.find((a) => norm(a).length >= 3 && n.includes(norm(a))) ?? null
}

/** A regra do banco: a substância registrada que trava cada medicamento do cadastro. */
function useTravas(pacienteId: string | null | undefined, ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))].sort()
  return useQuery({
    queryKey: ['trava-receita', pacienteId, unicos.join(',')],
    enabled: !!pacienteId && unicos.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const pares = await Promise.all(unicos.map(async (id) => {
        const { data, error } = await supabase.rpc('alergia_trava_medicamento', { p_paciente: pacienteId!, p_medicamento: id })
        if (error) throw error
        return [id, (data as string | null) ?? null] as const
      }))
      return Object.fromEntries(pares) as Record<string, string | null>
    },
  })
}

type Favorito = {
  id: string; receita_padrao: string | null; dose: string | null; posologia: string; quantidade: string | null; medicamento_id: string
  medicamento: { principio_ativo: string; apresentacao: string | null } | null
}
type Protocolo = { id: string; nome: string; indicacao: string | null; versao: string | null; ativo: boolean; itens: { medicamento: string; posologia: string; quantidade: string }[] }
type Med = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null }

export function ReceituarioMedico({ unidadeId, perfilId }: { unidadeId?: string; perfilId?: string }) {
  const qc = useQueryClient()
  const [pacienteId, escolher] = usePacienteDoDocumento('receituario', unidadeId, perfilId)
  const ident = useIdentificacao(pacienteId)
  const { dados, atualizar, salvoEm, limpar } = useRascunho<RascunhoReceita>(
    `receituario-doc:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfilId, carregarReceita,
  )
  const rx = dados.receita
  const temAlgo = rx.itens.length > 0 || rx.obs.trim() !== ''
  // sem nada escrito, nada vai ao servidor (abrir e fechar não deixa rascunho)
  const conteudo = temAlgo ? JSON.stringify(montarConteudo(rx, ident)) : ''
  const servidor = useRascunhoServidor(pacienteId, 'receita', conteudo)
  const docs = useDocumentosEpisodio(pacienteId, servidor.salvoEm)
  const rascunhoNoBanco = (docs.data ?? []).find((d) => d.tipo === 'receita' && d.estado === 'rascunho' && d.meu)?.id ?? null
  /** rascunho aberto por "Copiar como novo" (já existe no banco) */
  const copia = React.useRef<string | null>(null)

  const [editando, setEditando] = React.useState<string | null>(null) // id do item, 'novo' ou null
  const [protoAberto, setProtoAberto] = React.useState<Protocolo | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const pediatrico = ident.pediatrico === true
  const alergias = ident.cab.temAlergia ? ident.cab.alergias.split(',').map((s) => s.trim()).filter(Boolean) : []

  const favoritos = useQuery({
    queryKey: ['preferencias-prescricao'],
    enabled: !!pacienteId && !pediatrico,
    queryFn: async () => {
      const { data, error } = await supabase.from('preferencias_prescricao')
        .select('id, receita_padrao, dose, posologia, quantidade, medicamento_id, medicamento:medicamento(principio_ativo, apresentacao)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Favorito[]
    },
  })
  const protocolos = useQuery({
    queryKey: ['receita-protocolos', unidadeId],
    enabled: !!pacienteId && !!unidadeId && !pediatrico,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('receita_protocolos_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return ((data ?? []) as unknown as Protocolo[]).filter((p) => p.ativo)
    },
  })
  const favs = pediatrico ? [] : favoritos.data ?? []
  const travas = useTravas(pacienteId, [...rx.itens.map((i) => i.medicamento_id), ...favs.map((f) => f.medicamento_id)]).data ?? {}

  const ehControle = (i: ItemRx) => rx.controle || i.controle_especial
  const itensControle = rx.itens.filter(ehControle)
  const temControle = itensControle.length > 0

  const mudar = (receita: Partial<Rx>) => atualizar({ receita: { ...rx, ...receita } })
  const jaTem = (nome: string) => rx.itens.some((i) => norm(i.medicamento) === norm(nome))
  const juntar = (novos: Omit<ItemRx, 'id'>[]) =>
    mudar({ itens: [...rx.itens, ...novos.filter((n) => !jaTem(n.medicamento)).map((n) => ({ ...n, id: crypto.randomUUID() }))] })
  const deFavorito = (f: Favorito): Omit<ItemRx, 'id'> => ({
    medicamento: f.medicamento?.principio_ativo ?? 'Medicamento', dose: [f.medicamento?.apresentacao, f.dose].filter(Boolean).join(' · '),
    posologia: f.posologia, quantidade: f.quantidade ?? '', controle_especial: false, medicamento_id: f.medicamento_id,
  })

  // ── o que falta para emitir ──
  const pendencias: string[] = []
  if (!pacienteId) pendencias.push('escolher o paciente')
  else {
    if (ident.alergiasCarregadas && !ident.cab.temAlergia && !ident.cab.semAlergia) pendencias.push('registrar a alergia do paciente (tem ou nega)')
    if (!rx.itens.length) pendencias.push('ao menos um medicamento')
    for (const i of rx.itens) {
      const t = i.medicamento_id ? travas[i.medicamento_id] : null
      if (t) pendencias.push(`${i.medicamento}: bloqueado pela alergia a ${t} — remova o item`)
      if (!i.posologia.trim()) pendencias.push(`como tomar ${i.medicamento}`)
      if (ehControle(i) && !i.quantidade.trim()) pendencias.push(`quantidade de ${i.medicamento} (controle especial)`)
    }
    if (temControle && !ident.usuario.registro) pendencias.push('seu registro no conselho no perfil (vai na receita de controle especial)')
    if (temControle && ident.pac && !ident.pac.endereco) pendencias.push('endereço do paciente no cadastro (vai na receita de controle especial)')
  }

  async function emitir() {
    if (!pacienteId || pendencias.length) return
    setErro(null)
    const texto = JSON.stringify(montarConteudo(rx, ident))
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Receituário', documento: { tipo: 'receita', conteudo: texto },
      rascunhoId: servidor.rascunhoId() ?? copia.current ?? rascunhoNoBanco,
    })
    if (!impressao) return
    impressao.janela.focus()
    window.setTimeout(() => impressao.janela.print(), 300)
    servidor.emitido('') // o formulário volta vazio: não recriar rascunho
    copia.current = null
    setEditando(null)
    limpar() // LGPD: tira do aparelho o que já virou documento
    invalidarDocumentos(qc)
  }

  function novo() {
    copia.current = null
    setEditando(null)
    limpar()
  }

  function copiar(texto: string, rascunhoId: string) {
    try {
      const d = JSON.parse(texto) as { receita?: unknown }
      copia.current = rascunhoId
      setEditando(null)
      atualizar({ receita: normalizar(d.receita) })
    } catch {
      setErro('Não foi possível ler o documento copiado.')
    }
  }

  async function descartar() {
    const ids = [copia.current, rascunhoNoBanco].filter((x): x is string => !!x)
    copia.current = null
    setEditando(null)
    await servidor.descartar()
    for (const id of ids) await supabase.rpc('descartar_rascunho', { p_rascunho: id }).then(() => undefined, () => undefined)
    limpar()
    invalidarDocumentos(qc)
  }

  const mensagem = pendencias.length
    ? 'Complete o que falta para emitir.'
    : temControle
      ? `Pronto para emitir: ${itensControle.length === rx.itens.length ? '' : 'receituário e '}receita de controle especial em 2 vias.`
      : 'Pronto para emitir.'

  return (
    <div className="flex flex-col gap-3.5">
      <BarraDocumento pacienteId={pacienteId} tipo="receita" rotulo="Receita" salvoEm={servidor.salvoEm} pendencias={pendencias}
        aoEmitir={() => void emitir()} aoNovo={novo} aoCopiar={copiar} />

      <SeletorPaciente pacienteId={pacienteId} onEscolher={escolher} pac={ident.pac} unidadeId={unidadeId} perfilId={perfilId} />

      {erro && <Aviso tom="critico">{erro}</Aviso>}

      {pacienteId && (
        <>
          <section className="flex flex-col gap-4 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex flex-col gap-[5px]">
                <span className="text-apoio font-medium text-grafite">Tipo de receita</span>
                <Pilulas rotuloAria="Tipo de receita" opcoes={['simples', 'controle'] as const} valor={rx.controle ? 'controle' : 'simples'}
                  rotulos={{ simples: 'Simples', controle: 'Controle especial' }} onChange={(v) => mudar({ controle: v === 'controle' })} />
              </div>
              <div className="flex min-w-60 flex-1 flex-col gap-[5px]">
                <span className="text-apoio font-medium text-grafite">Alergias</span>
                {ident.cab.temAlergia ? (
                  <span className="flex items-center gap-[7px] rounded-controle border border-critico/30 bg-alerta-critico px-3 py-[7px] text-apoio font-semibold text-critico">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {ident.cab.alergias}
                  </span>
                ) : ident.cab.semAlergia ? (
                  <span className="text-corpo text-tinta">Nega alergias</span>
                ) : (
                  <span className="text-apoio text-atencao">{ident.alergiasCarregadas ? 'Não registrada: registre no prontuário (tem ou nega) antes de emitir.' : 'Carregando…'}</span>
                )}
              </div>
            </div>
            <p className="text-apoio text-pretty text-tinta-sussurro">
              {rx.controle
                ? 'Todos os itens saem na Receita de Controle Especial (Portaria SVS/MS 344/98), em 2 vias: 1ª retida na farmácia, 2ª do paciente.'
                : 'Na receita simples, marque um a um o item de controle especial: ele sai numa folha própria, em 2 vias, e os outros no receituário comum.'}
            </p>
          </section>

          {pediatrico ? (
            <Aviso>{TEXTO_PEDIATRICO}</Aviso>
          ) : (
            <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
              <div className="flex items-center gap-2.5 border-b border-trilha px-5 py-[13px]">
                <ClipboardPlus className="size-4 text-marca" aria-hidden />
                <h2 className="text-corpo font-semibold text-tinta">Protocolos da instituição</h2>
              </div>
              <div className="flex flex-wrap gap-2 px-5 py-3.5">
                {(protocolos.data ?? []).map((p) => (
                  <button key={p.id} type="button" onClick={() => setProtoAberto(p)}
                    className="flex max-w-[260px] flex-col items-start gap-0.5 rounded-container border border-fio bg-superficie px-3.5 py-2.5 text-left hover:border-marca hover:bg-alerta-marca">
                    <span className="text-controle font-medium text-tinta">{p.nome}</span>
                    <span className="text-apoio text-tinta-sussurro">{[p.indicacao, `${p.itens.length} ${p.itens.length === 1 ? 'item' : 'itens'}`].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
                {protocolos.isSuccess && !protocolos.data.length && (
                  <span className="text-apoio text-tinta-sussurro">Nenhum protocolo de receita escrito pelo gestor desta unidade.</span>
                )}
                {protocolos.isLoading && <span className="text-apoio text-tinta-sussurro">Carregando…</span>}
              </div>
              <div className="flex items-center gap-2.5 border-y border-trilha bg-campo px-5 py-[13px]">
                <Star className="size-[15px] text-atencao" aria-hidden />
                <h2 className="text-corpo font-semibold text-tinta">Meus favoritos</h2>
                <Link to="/preferencias-prescricao" className="ml-auto text-apoio text-acao hover:underline">Editar</Link>
              </div>
              <div className="flex flex-wrap gap-2 px-5 py-3.5">
                {favs.map((f) => {
                  const nome = f.medicamento?.principio_ativo ?? 'Favorito'
                  const trava = travas[f.medicamento_id]
                  const dentro = !trava && jaTem(nome)
                  return (
                    <button key={f.id} type="button" disabled={!!trava || dentro} onClick={() => juntar([deFavorito(f)])}
                      title={trava ? `Bloqueado pela alergia a ${trava}` : dentro ? 'Já está na receita' : [f.receita_padrao, f.posologia].filter(Boolean).join(' · ')}
                      className={cn('flex items-center gap-[7px] rounded-capsula border px-[13px] py-1.5 text-apoio whitespace-nowrap',
                        trava ? 'cursor-not-allowed border-critico/25 bg-alerta-critico text-critico'
                          : dentro ? 'cursor-default border-conforme/25 bg-alerta-conforme text-conforme'
                          : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
                      {trava && <TriangleAlert className="size-[13px]" aria-hidden />}
                      {dentro && <Check className="size-[13px]" aria-hidden />}
                      {nome}{f.receita_padrao ? <span className="text-tinta-sussurro"> · {f.receita_padrao}</span> : null}
                    </button>
                  )
                })}
                {favoritos.isSuccess && !favs.length && (
                  <span className="text-apoio text-tinta-sussurro">
                    Nenhum favorito ainda. <Link to="/preferencias-prescricao" className="text-acao hover:underline">Preferências de prescrição</Link>
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            <div className="flex items-center gap-2.5 border-b border-trilha px-5 py-3.5">
              <Pill className="size-4 text-marca" aria-hidden />
              <h2 className="text-corpo font-semibold text-tinta">Medicamentos</h2>
              <span className="ml-auto text-apoio text-tinta-sussurro">{rx.itens.length} {rx.itens.length === 1 ? 'item' : 'itens'}</span>
            </div>
            {rx.itens.map((i, idx) => editando === i.id ? (
              <div key={i.id} className="border-b border-trilha px-5 py-3.5">
                <EditorItem pacienteId={pacienteId} inicial={i} modoControle={rx.controle} alergias={alergias}
                  onSalvar={(n) => { mudar({ itens: rx.itens.map((x) => (x.id === i.id ? { ...n, id: i.id } : x)) }); setEditando(null) }}
                  onCancelar={() => setEditando(null)} />
              </div>
            ) : (
              <LinhaItem key={i.id} ordem={idx + 1} item={i} controle={ehControle(i)}
                trava={i.medicamento_id ? travas[i.medicamento_id] ?? null : null}
                alergiaTexto={i.medicamento_id ? null : alergiaNoTexto(i.medicamento, alergias)}
                onEditar={() => setEditando(i.id)} onRemover={() => mudar({ itens: rx.itens.filter((x) => x.id !== i.id) })} />
            ))}
            <div className="px-5 py-3.5">
              {editando === 'novo' ? (
                <EditorItem pacienteId={pacienteId} modoControle={rx.controle} alergias={alergias}
                  onSalvar={(n) => { mudar({ itens: [...rx.itens, { ...n, id: crypto.randomUUID() }] }); setEditando(null) }}
                  onCancelar={() => setEditando(null)} />
              ) : (
                <button type="button" onClick={() => setEditando('novo')}
                  className="flex w-full items-center gap-[7px] rounded-controle border border-dashed border-[#CBD5E1] bg-campo px-3.5 py-2.5 text-apoio text-tinta-apoio hover:border-marca hover:bg-alerta-marca hover:text-acao">
                  <ClipboardPlus className="size-[15px]" aria-hidden /> Adicionar medicamento
                </button>
              )}
            </div>
            <div className="flex border-t border-trilha px-5 py-3.5">
              <Texto id="rx-obs" rotulo="Observações (opcional)" longo linhas={2} valor={rx.obs} onChange={(v) => mudar({ obs: v })}
                dica="Uso contínuo, retorno, orientações gerais" />
            </div>
          </section>

          {temControle && <ControleEspecial itens={itensControle} ident={ident} />}

          <Rodape pendencias={pendencias} mensagem={mensagem} salvoEm={salvoEm} servidorSalvoEm={servidor.salvoEm}>
            {temAlgo && (
              <Button variant="ghost" onClick={() => void descartar()}>
                <Trash2 /> Descartar rascunho
              </Button>
            )}
          </Rodape>

          <DialogoProtocolo protocolo={protoAberto} alergias={alergias} jaTem={jaTem} nomePaciente={ident.cab.nome}
            onFechar={() => setProtoAberto(null)}
            onAdicionar={(itens) => {
              juntar(itens.map((it) => ({ medicamento: it.medicamento, dose: '', posologia: it.posologia, quantidade: it.quantidade ?? '', controle_especial: false, medicamento_id: null })))
              setProtoAberto(null)
            }} />
        </>
      )}
    </div>
  )
}

function LinhaItem({ ordem, item, controle, trava, alergiaTexto, onEditar, onRemover }: {
  ordem: number; item: ItemRx; controle: boolean; trava: string | null; alergiaTexto: string | null; onEditar: () => void; onRemover: () => void
}) {
  return (
    <div className={cn('flex flex-wrap items-start gap-3 border-b border-trilha px-5 py-3.5', trava && 'bg-alerta-critico/60')}>
      <span className="pt-0.5 text-apoio tabular-nums text-tinta-sussurro">{ordem}</span>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
        <span className="text-corpo font-medium text-tinta">
          {item.medicamento}{item.dose && <span className="font-normal text-tinta-apoio"> — {item.dose}</span>}
        </span>
        <span className={cn('text-apoio text-pretty', item.posologia ? 'text-tinta-sussurro' : 'text-atencao')}>{item.posologia || 'Falta: como tomar'}</span>
        <div className="flex flex-wrap gap-1.5">
          {controle && (
            <span className="rounded-capsula bg-alerta-marca px-2.5 py-[3px] text-rotulo font-semibold text-acao">Controle especial · 2 vias</span>
          )}
          {trava && (
            <span className="flex items-center gap-[5px] text-apoio font-semibold text-critico">
              <TriangleAlert className="size-[13px]" aria-hidden /> Bloqueado · alergia a {trava}
            </span>
          )}
          {!trava && alergiaTexto && (
            <span className="flex items-center gap-[5px] text-apoio text-atencao">
              <TriangleAlert className="size-[13px]" aria-hidden /> Confira: alergia registrada a {alergiaTexto} (item escrito fora do cadastro)
            </span>
          )}
        </div>
      </div>
      <span className={cn('text-apoio whitespace-nowrap', item.quantidade ? 'text-tinta-apoio' : 'text-tinta-sussurro')}>{item.quantidade || 'sem quantidade'}</span>
      <div className="flex gap-1">
        <Button size="xs" variant="ghost" onClick={onEditar}><PencilLine /> Editar</Button>
        <Button size="xs" variant="ghost" onClick={onRemover} className="hover:text-atencao"><X /> Remover</Button>
      </div>
    </div>
  )
}

function EditorItem({ pacienteId, inicial, modoControle, alergias, onSalvar, onCancelar }: {
  pacienteId: string; inicial?: ItemRx; modoControle: boolean; alergias: string[]
  onSalvar: (i: Omit<ItemRx, 'id'>) => void; onCancelar: () => void
}) {
  const [medicamento, setMedicamento] = React.useState(inicial?.medicamento ?? '')
  const [medId, setMedId] = React.useState<string | null>(inicial?.medicamento_id ?? null)
  const [dose, setDose] = React.useState(inicial?.dose ?? '')
  const [posologia, setPosologia] = React.useState(inicial?.posologia ?? '')
  const [quantidade, setQuantidade] = React.useState(inicial?.quantidade ?? '')
  const [controle, setControle] = React.useState(inicial?.controle_especial ?? false)
  const [foco, setFoco] = React.useState(false)
  const termo = medicamento.trim()

  const busca = useQuery({
    queryKey: ['busca-medicamento-receita', termo],
    enabled: foco && !medId && termo.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo, apresentacao, concentracao')
        .eq('ativo', true).ilike('principio_ativo', `%${termo}%`).order('principio_ativo').limit(8)
      if (error) throw error
      return (data ?? []) as Med[]
    },
  })
  const achados = foco && !medId && termo.length >= 3 ? busca.data ?? [] : []
  const trava = useTravas(pacienteId, [medId]).data?.[medId ?? ''] ?? null
  const alergiaTexto = medId ? null : alergiaNoTexto(medicamento, alergias)
  const pode = !!termo && !!posologia.trim() && !trava

  return (
    <div className="flex flex-col gap-3.5 rounded-container border border-fio bg-campo p-3.5">
      <div className="flex flex-wrap gap-3">
        <Texto id="rx-med" rotulo="Medicamento" largura="cheio" valor={medicamento} dica="Busque no cadastro (3 letras) ou escreva"
          onChange={(v) => { setMedicamento(v); setMedId(null) }} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
          ajuda={medId ? 'Do cadastro de medicamentos: a alergia registrada é conferida pelo banco.' : termo ? 'Escrito fora do cadastro.' : undefined}>
          <Sugestoes itens={achados.map((m) => ({ chave: m.id, nome: [m.principio_ativo, m.concentracao, m.apresentacao].filter(Boolean).join(' · ') }))}
            aoEscolher={(k) => {
              const m = achados[k]
              setMedicamento([m.principio_ativo, m.concentracao].filter(Boolean).join(' '))
              setMedId(m.id)
              if (!dose.trim() && m.apresentacao) setDose(m.apresentacao)
              setFoco(false)
            }} />
        </Texto>
        <Texto id="rx-dose" rotulo="Apresentação" largura="medio" valor={dose} onChange={setDose} dica="Ex.: comprimido, frasco" />
        <Texto id="rx-qtd" rotulo="Quantidade" largura="curto" valor={quantidade} onChange={setQuantidade}
          ajuda={modoControle || controle ? 'Obrigatória no controle especial; sai também por extenso.' : undefined} />
        <Texto id="rx-pos" rotulo="Como tomar" largura="cheio" valor={posologia} onChange={setPosologia} dica="Escrito pelo médico" />
      </div>
      {trava && <Aviso tom="critico">Bloqueado pela alergia registrada a {trava}. Escolha outro medicamento.</Aviso>}
      {!trava && alergiaTexto && <Aviso>Confira: alergia registrada a {alergiaTexto}. O item foi escrito fora do cadastro, então o banco não confere.</Aviso>}
      <div className="flex flex-wrap items-center gap-2">
        {!modoControle && (
          <Chip ativo={controle} onClick={() => setControle((c) => !c)} titulo="Sai na Receita de Controle Especial, em 2 vias">
            {controle && <Check className="size-[13px]" aria-hidden />} Controle especial (Portaria 344/98)
          </Chip>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button disabled={!pode} title={pode ? undefined : 'Informe o medicamento e como tomar'}
            onClick={() => onSalvar({ medicamento: termo, dose: dose.trim(), posologia: posologia.trim(), quantidade: quantidade.trim(), controle_especial: controle, medicamento_id: medId })}>
            {inicial ? <Check /> : <Plus />} {inicial ? 'Salvar item' : 'Adicionar à receita'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Como sai a Receita de Controle Especial (Prescrição Médica.dc.html). */
function ControleEspecial({ itens, ident }: { itens: ItemRx[]; ident: Identificacao }) {
  const u = ident.unidade
  const pac = ident.pac
  return (
    <section className="flex flex-col gap-4 rounded-cartao border border-fio bg-superficie px-[26px] py-[22px] shadow-repouso">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-secao font-semibold text-tinta">Receita de Controle Especial</h2>
          <span className="text-apoio text-tinta-sussurro">Portaria SVS/MS 344/98 · 1ª via retida na farmácia, 2ª via do paciente</span>
        </div>
        <span className="shrink-0 rounded-capsula bg-alerta-critico px-2.5 py-[3px] text-rotulo font-semibold text-critico">Duas vias</span>
      </div>
      <Bloco titulo="Identificação do emitente" nota="Do seu login e da unidade.">
        <Leitura rotulo="Médico(a)" valor={ident.usuario.nome} />
        <Leitura rotulo="Registro no conselho" valor={ident.usuario.registro} largura="curto" />
        <Leitura rotulo="Unidade" valor={[u.nome, [u.municipio, u.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')} />
        <Leitura rotulo="CNES" valor={u.cnes} largura="curto" />
      </Bloco>
      <Bloco titulo="Paciente" nota="Do cadastro.">
        <Leitura rotulo="Nome" valor={pac?.nome} />
        <Leitura rotulo="Nascimento" valor={pac?.nascimento ? pac.nascimento.split('-').reverse().join('/') : ''} largura="curto" />
        <Leitura rotulo="Endereço" valor={[pac?.endereco, [pac?.municipio, pac?.uf].filter(Boolean).join('/')].filter(Boolean).join(' – ')} largura="cheio" />
      </Bloco>
      <div className="flex flex-col gap-3.5">
        {itens.map((i, k) => (
          <div key={i.id} className="flex gap-3 text-corpo leading-[1.55]">
            <span className="font-semibold text-acao">{k + 1}</span>
            <div className="min-w-0">
              <strong className="font-semibold text-tinta">{i.medicamento}</strong>
              {i.dose && <span className="text-tinta"> — {i.dose}</span>}
              {i.quantidade && <span className="text-tinta"> · {i.quantidade}</span>}
              <br /><span className="text-tinta-apoio">{i.posologia}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-5 text-apoio text-tinta-sussurro">
        <div className="min-w-[190px] flex-1">Identificação do comprador<div className="mt-5 border-b border-fio" /><div className="mt-1">Nome, documento e telefone</div></div>
        <div className="min-w-[190px] flex-1">Identificação do fornecedor<div className="mt-5 border-b border-fio" /><div className="mt-1">Farmácia, data e assinatura</div></div>
      </div>
      <p className="text-rotulo text-pretty text-tinta-sussurro">
        Comprador e fornecedor ficam em branco na folha: quem preenche é a farmácia, na dispensação. A quantidade sai também por extenso.
      </p>
    </section>
  )
}

function DialogoProtocolo({ protocolo, alergias, jaTem, nomePaciente, onFechar, onAdicionar }: {
  protocolo: Protocolo | null; alergias: string[]; jaTem: (nome: string) => boolean; nomePaciente: string
  onFechar: () => void; onAdicionar: (itens: Protocolo['itens']) => void
}) {
  const [sel, setSel] = React.useState<Record<number, boolean>>({})
  const [aberto, setAberto] = React.useState<string | null>(null)
  const itens = protocolo?.itens ?? []
  const trava = (nome: string) => alergiaNoTexto(nome, alergias)
  // ao abrir outro protocolo, tudo o que não trava vem marcado (protótipo)
  if (protocolo && aberto !== protocolo.id) {
    setAberto(protocolo.id)
    setSel(Object.fromEntries(itens.map((it, i) => [i, !trava(it.medicamento) && !jaTem(it.medicamento)])))
  }
  const escolhidos = itens.filter((it, i) => sel[i] && !trava(it.medicamento))
  const temBloqueado = itens.some((it) => trava(it.medicamento))

  return (
    <Dialog open={!!protocolo} onOpenChange={(o) => { if (!o) { onFechar(); setAberto(null) } }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{protocolo?.nome}</DialogTitle>
          {(protocolo?.indicacao || protocolo?.versao) && (
            <DialogDescription>{[protocolo?.indicacao, protocolo?.versao].filter(Boolean).join(' · ')}</DialogDescription>
          )}
        </DialogHeader>
        <div className="overflow-hidden rounded-container border border-fio">
          {itens.map((it, i) => {
            const t = trava(it.medicamento)
            const marcado = !!sel[i] && !t
            return (
              <button key={i} type="button" disabled={!!t} onClick={() => setSel((s) => ({ ...s, [i]: !s[i] }))}
                className={cn('flex w-full items-start gap-[11px] border-b border-trilha px-3.5 py-3 text-left last:border-0',
                  t ? 'cursor-not-allowed bg-alerta-critico/50' : 'hover:bg-alerta-marca')}>
                <span aria-hidden className={cn('mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-[12px] font-bold leading-none',
                  t ? 'border-fio bg-trilha text-tinta-sussurro' : marcado ? 'border-acao bg-acao text-white' : 'border-[#CBD5E1] bg-superficie text-transparent')}>
                  {t ? '×' : marcado ? '✓' : ''}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-controle font-medium text-tinta">{it.medicamento}{jaTem(it.medicamento) && <span className="font-normal text-conforme"> · já na receita</span>}</span>
                  <span className="text-apoio text-tinta-sussurro">{[it.posologia, it.quantidade].filter(Boolean).join(' · ')}</span>
                  {t && (
                    <span className="flex items-center gap-[5px] text-apoio font-semibold text-critico">
                      <TriangleAlert className="size-[13px]" aria-hidden /> Bloqueado · alergia a {t}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {temBloqueado && (
          <span className="text-apoio text-pretty text-atencao">
            Item travado pela alergia registrada de {nomePaciente || 'este paciente'}. O resto do protocolo continua disponível.
          </span>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { onFechar(); setAberto(null) }}>Cancelar</Button>
          <Button disabled={!escolhidos.length} onClick={() => { onAdicionar(escolhidos); setAberto(null) }}>
            <ClipboardPlus /> {escolhidos.length === 1 ? 'Adicionar 1 item' : `Adicionar ${escolhidos.length} itens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
