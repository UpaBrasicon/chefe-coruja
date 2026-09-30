// Pedido de exames no desenho do protótipo (Documentos do Atendimento.dc.html,
// index.html pedFolhas/pedPendencias/pedConferir): exames por serviço
// (laboratório; imagem e métodos gráficos), perfis de um clique que só MARCAM
// — nada é pedido sem o médico ver a lista marcada —, item fora da lista,
// caráter, indicação clínica, CID e observações ao serviço.
//
// A identificação vem do cadastro, do login e da unidade (useIdentificacao):
// não há campo de nome, CNS ou CNES para digitar. A folha A4 (lib/folhas,
// pedidoExames) sai uma por serviço, a partir de `pedido.folhas`; `pedido.texto`
// continua gravado para quem lê o formato antigo (documentos da alta).
import { useQueryClient } from '@tanstack/react-query'
import { Activity, FlaskConical, Plus, Send, X } from 'lucide-react'
import * as React from 'react'

import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { invalidarDocumentos } from '@/components/documento/documentos'
import { EXAMES_PEDIDO, PERFIS_EXAME, folhasDoPedido } from '@/components/documentos/catalogos'
import { useIdentificacao } from '@/components/documentos/identificacao'
import { SeletorPaciente, usePacienteDoDocumento } from '@/components/documentos/SeletorPaciente'
import { BuscaCid } from '@/components/documentos/busca'
import { Aviso, Bloco, Campo, Cartao, Chip, Pilulas, Texto } from '@/components/documentos/ui'
import { cn } from '@/lib/utils'
import { carregarEnvelope, useRascunho } from '../shared/rascunho'

const CARATERES = ['Urgência', 'Rotina'] as const
type Carater = (typeof CARATERES)[number]

type Pedido = {
  itens: string[]
  carater: Carater
  cid: string
  cidOk: boolean
  indicacao: string
  obs: string
}

const VAZIO: Pedido = { itens: [], carater: 'Urgência', cid: '', cidOk: false, indicacao: '', obs: '' }

const TODOS_DO_CARDAPIO = EXAMES_PEDIDO.flatMap((d) => d.grupos.flatMap((g) => g[1]))

/** Título e nota de cada folha (pedFolhas do protótipo). */
// `documento`: o título da folha no protótipo (pedFolhas)
const FOLHA: Record<string, { titulo: string; documento: string; nota?: string }> = {
  'laboratório': { titulo: 'Laboratório', documento: 'Solicitação de exames laboratoriais' },
  'radiologia/imagem': { titulo: 'Radiologia / imagem', documento: 'Solicitação de exames de radiologia / imagem', nota: 'Tomografia, ressonância e outros exames de alto custo: usar formulário próprio de regulação.' },
  'métodos gráficos': { titulo: 'Métodos gráficos', documento: 'Solicitação de métodos gráficos' },
  'outros exames': { titulo: 'Outros exames', documento: 'Solicitação de exames' },
}

const ICONE_DESTINO: Record<string, React.ReactNode> = {
  'Laboratório': <FlaskConical className="size-[15px]" aria-hidden />,
  'Imagem e métodos gráficos': <Activity className="size-[15px]" aria-hidden />,
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '')

/** Lê o pedido gravado (rascunho do aparelho ou conteúdo copiado). Aceita o formato antigo {pedido:{texto}}. */
function lerPedido(p: Record<string, unknown> | null | undefined): Pedido {
  if (!p) return VAZIO
  const itens = Array.isArray(p.itens)
    ? p.itens.map(String).filter(Boolean)
    : texto(p.texto).split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
  const cid = texto(p.cid)
  return {
    itens: [...new Set(itens)],
    carater: CARATERES.includes(p.carater as Carater) ? (p.carater as Carater) : 'Urgência',
    cid,
    cidOk: typeof p.cidOk === 'boolean' ? p.cidOk : !!cid,
    indicacao: texto(p.indicacao),
    obs: texto(p.obs),
  }
}

function carregar(chave: string): Pedido {
  const env = carregarEnvelope<Partial<Pedido>>(chave)
  return env ? lerPedido(env.dados as Record<string, unknown>) : VAZIO
}

/** Hipótese: a escrita no CID ("J18.9 — Pneumonia…"), como pedHipotese do protótipo. */
function hipoteseDe(cid: string) {
  const m = /^\s*[A-Z]\d{2}(?:\.?\d)?\s*[—–-]\s*(.+)$/i.exec(cid)
  return m ? m[1].trim() : ''
}

export function PedidoExames({ unidadeId, perfilId }: { unidadeId?: string; perfilId?: string }) {
  const qc = useQueryClient()
  const [pacienteId, escolherPaciente] = usePacienteDoDocumento('pedido-exames', unidadeId, perfilId)
  const id = useIdentificacao(pacienteId)
  const { dados, atualizar, salvoEm, limpar } = useRascunho<Pedido>(`pedido-exames:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfilId, carregar)
  const [outro, setOutro] = React.useState('')
  // "Copiar como novo": o rascunho novo já existe no banco; a emissão usa ele
  const copiado = React.useRef<string | null>(null)

  const itens = dados.itens
  const marcado = (x: string) => itens.includes(x)
  const extras = itens.filter((x) => !TODOS_DO_CARDAPIO.includes(x))
  const folhas = folhasDoPedido(itens)
  const hipotese = hipoteseDe(dados.cid)
  const codCid = dados.cid.trim().split(/\s/)[0]

  const pedidoGravado = {
    itens,
    carater: dados.carater,
    cid: dados.cid.trim(),
    cidOk: dados.cidOk,
    hipotese,
    indicacao: dados.indicacao.trim(),
    obs: dados.obs.trim(),
    folhas: folhas.map((f) => ({
      titulo: FOLHA[f.nome]?.titulo ?? f.nome,
      documento: FOLHA[f.nome]?.documento,
      // o cardápio inteiro do serviço vai junto: a folha imprime tudo, com os marcados em destaque (protótipo montarPedHtml)
      grupos: [
        ...f.grupos.map(([nome, xs]) => ({ nome, itens: xs.filter(marcado), cardapio: xs })),
        ...(f.extras.length ? [{ nome: 'Outros', itens: f.extras }] : []),
      ],
      ...(FOLHA[f.nome]?.nota ? { nota: FOLHA[f.nome].nota } : {}),
    })),
    // formato antigo, lido pelos documentos da alta (lerPedidoExames)
    texto: itens.map((x) => `- ${x}`).join('\n'),
  }
  const conteudoDoc = JSON.stringify({ paciente: id.pacienteAntigo({ diagnostico: hipotese }), pedido: pedidoGravado })
  // só espelha no banco com o cadastro e as alergias carregados: abrir e fechar não deixa rascunho
  const pronto = !!pacienteId && !!id.pac && id.alergiasCarregadas
  const servidor = useRascunhoServidor(pronto ? pacienteId : null, 'pedido_exames', conteudoDoc)

  // pedPendencias + pedConferir (E) do protótipo
  const pendencias: string[] = []
  if (!pacienteId) pendencias.push('Escolher ou cadastrar o paciente')
  else if (!id.pac) pendencias.push('Aguardar o cadastro do paciente')
  if (!itens.length) pendencias.push('Marcar ao menos um exame')
  if (!dados.indicacao.trim()) pendencias.push('Indicação clínica')
  if (codCid && !/^[A-Z]\d{2}(\.?\d)?$/i.test(codCid)) pendencias.push('CID-10 fora do formato (ex.: J18.9): escolha da lista')
  if (!id.usuario.registro) pendencias.push('Registro no conselho do solicitante não cadastrado no login')

  // pedConferir (A): avisam, não travam
  const avisos: string[] = []
  if (itens.length && !hipotese) avisos.push('Hipótese diagnóstica não informada: escolha o CID com o nome da doença.')
  if (id.pac && !id.pac.cns) avisos.push('CNS do paciente não cadastrado.')
  if (id.pac && !id.pac.mae) avisos.push('Nome da mãe não cadastrado.')
  if (!id.usuario.cns) avisos.push('CNS do profissional solicitante não cadastrado (usado na produção ambulatorial).')

  function marcar(x: string) {
    atualizar({ itens: marcado(x) ? itens.filter((i) => i !== x) : itens.concat(x) })
  }

  // Perfil já todo marcado desmarca; é o mesmo botão dos dois lados (pedPerfil).
  function aplicarPerfil(lista: string[]) {
    const faltando = lista.filter((x) => !marcado(x))
    atualizar({ itens: faltando.length ? itens.concat(faltando) : itens.filter((x) => !lista.includes(x)) })
  }

  function adicionarOutro(v: string) {
    const x = v.trim()
    if (!x) return
    if (!itens.some((i) => i.toLowerCase() === x.toLowerCase())) atualizar({ itens: itens.concat(x) })
    setOutro('')
  }

  function novo() {
    copiado.current = null
    void servidor.descartar()
    limpar()
  }

  function aoCopiar(conteudo: string, rascunhoId: string) {
    copiado.current = rascunhoId
    let j: Record<string, unknown> | null
    try {
      j = JSON.parse(conteudo) as Record<string, unknown>
    } catch {
      j = null
    }
    const p = (j?.pedido ?? j?.exames) as Record<string, unknown> | undefined
    atualizar(lerPedido(p))
  }

  async function emitir() {
    if (!pacienteId || pendencias.length) return
    const final = JSON.stringify({ ...(JSON.parse(conteudoDoc) as object), retrato: id.retrato })
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Pedido de exames',
      documento: { tipo: 'pedido_exames', conteudo: final }, rascunhoId: servidor.rascunhoId() ?? copiado.current,
    })
    if (!impressao) return
    // o conteúdo já virou documento: não recriar rascunho com ele nem com o formulário em branco
    copiado.current = null
    servidor.emitido(conteudoDoc)
    void servidor.descartar()
    limpar() // LGPD: remove do navegador os dados do paciente
    invalidarDocumentos(qc)
    const janela = impressao.janela
    janela.focus()
    setTimeout(() => janela.print(), 300)
  }

  const n = itens.length
  const resumo = !n
    ? 'Nenhum exame marcado'
    : `${n} ${n === 1 ? 'exame' : 'exames'} · ${folhas.length === 1 ? `1 folha (${folhas[0].nome})` : `${folhas.length} folhas, uma por serviço (${folhas.map((f) => f.nome).join(', ')})`}`

  return (
    <div className="flex flex-col gap-3.5">
      <SeletorPaciente pacienteId={pacienteId} onEscolher={escolherPaciente} pac={id.pac} unidadeId={unidadeId} perfilId={perfilId} />

      <BarraDocumento pacienteId={pacienteId} tipo="pedido_exames" salvoEm={servidor.salvoEm} pendencias={pendencias}
        aoEmitir={() => void emitir()} aoNovo={novo} aoCopiar={aoCopiar} />

      {pacienteId && (
        <>
          <Cartao icone={<FlaskConical />} titulo="Pedido de exames">
            <div className="flex flex-wrap items-end gap-3.5">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                <span className="text-apoio font-medium text-grafite">Perfis de um clique</span>
                <div className="flex flex-wrap gap-[7px]">
                  {PERFIS_EXAME.map(([rotulo, lista]) => (
                    <Chip key={rotulo} tom="suave" ativo={lista.every(marcado)} onClick={() => aplicarPerfil(lista)}
                      titulo={lista.every(marcado) ? 'Desmarcar os exames deste perfil' : `Marca: ${lista.join(', ')}`}>
                      {rotulo}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-apoio font-medium text-grafite">Caráter</span>
                <Pilulas opcoes={CARATERES} valor={dados.carater} onChange={(v) => atualizar({ carater: v })} rotuloAria="Caráter do pedido" />
              </div>
            </div>
            <p className="-mt-3 text-apoio text-pretty text-tinta-sussurro">
              O perfil só marca: confira a lista antes de emitir. Clique de novo no perfil todo marcado para desmarcá-lo.
            </p>

            {EXAMES_PEDIDO.map((d) => {
              const qtd = d.grupos.reduce((s, [, xs]) => s + xs.filter(marcado).length, 0)
              return (
                <div key={d.destino} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline gap-2.5 border-b border-fio pb-[7px]">
                    <span className="flex items-center gap-[7px] text-apoio font-semibold tracking-[0.04em] text-grafite uppercase">
                      {ICONE_DESTINO[d.destino]}{d.destino}
                    </span>
                    <span className={cn('text-apoio', qtd ? 'font-medium text-acao' : 'text-tinta-sussurro')}>
                      {qtd ? `${qtd} ${qtd === 1 ? 'exame marcado' : 'exames marcados'}` : 'nada marcado'}
                    </span>
                  </div>
                  {d.grupos.map(([grupo, xs]) => (
                    <div key={grupo} role="group" aria-label={grupo} className="flex flex-col gap-[7px]">
                      <span className="text-apoio font-medium text-tinta-sussurro">{grupo}</span>
                      <div className="flex flex-wrap gap-[7px]">
                        {xs.map((x) => <Chip key={x} ativo={marcado(x)} onClick={() => marcar(x)}>{x}</Chip>)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}

            <Bloco titulo="Fora da lista" nota="Exame que não está no cardápio da unidade: sai em “Outros” na última folha.">
              <Campo id="ped-outro" rotulo="Outro exame" largura="medio">
                <div className="flex gap-2">
                  <Input id="ped-outro" value={outro} placeholder="Ex.: Vitamina B12" onChange={(e) => setOutro(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarOutro(outro) } }} className="md:text-corpo" />
                  <Button variant="outline" disabled={!outro.trim()} onClick={() => adicionarOutro(outro)}><Plus /> Adicionar</Button>
                </div>
              </Campo>
              <Campo rotulo="Ou busque o exame padronizado (LOINC)" largura="medio">
                <BuscaTerminologia tipo="loinc" onSelecionar={(r) => adicionarOutro(r.descricao)} placeholder="Ex.: vitamina D, ácido úrico…" />
              </Campo>
              {extras.length > 0 && (
                <div className="flex basis-full flex-wrap gap-[7px]">
                  {extras.map((x) => (
                    <Chip key={x} ativo onClick={() => marcar(x)} titulo={`Tirar ${x} do pedido`}>
                      {x} <X className="size-3.5" aria-hidden />
                    </Chip>
                  ))}
                </div>
              )}
            </Bloco>

            <div className="flex flex-wrap gap-3">
              <Texto id="ped-indicacao" rotulo="Indicação clínica / hipótese diagnóstica" longo linhas={3} valor={dados.indicacao}
                onChange={(v) => atualizar({ indicacao: v })} dica="O que motiva o pedido — o serviço precisa disso para priorizar" />
              <BuscaCid id="ped-cid" rotulo="CID-10 (opcional)" largura="medio" valor={dados.cid} confirmado={dados.cidOk}
                onDigitar={(v) => atualizar({ cid: v, cidOk: false })} onEscolher={(c, nome) => atualizar({ cid: `${c} — ${nome}`, cidOk: true })}
                ajuda={hipotese ? `Hipótese na folha: ${hipotese}` : undefined} />
              <Texto id="ped-obs" rotulo="Observações ao serviço (lado, jejum, preparo)" largura="medio" valor={dados.obs}
                onChange={(v) => atualizar({ obs: v })} dica="Ex.: raio-X de membro superior direito" />
            </div>
          </Cartao>

          {pendencias.length > 0 && (
            <div role="status" className="flex flex-col gap-1.5 rounded-container border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-atencao">
              <span className="text-apoio font-semibold">Falta preencher</span>
              {pendencias.map((p) => <span key={p} className="text-apoio">· {p}</span>)}
            </div>
          )}
          {avisos.length > 0 && <Aviso>{avisos.join(' ')}</Aviso>}

          <div className="flex flex-wrap items-center gap-3 rounded-cartao border border-fio bg-superficie px-5 py-3.5 shadow-repouso">
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className={cn('text-apoio font-medium', n ? 'text-acao' : 'text-tinta-sussurro')}>{resumo}</span>
              <span className="text-apoio text-pretty text-tinta-sussurro">
                {pendencias.length
                  ? 'Confira as pendências antes de emitir.'
                  : 'Cada serviço sai em folha própria: laboratório, radiologia/imagem e métodos gráficos, só com os exames marcados.'}
              </span>
              <span className="text-rotulo text-tinta-sussurro/80">
                {servidor.salvoEm
                  ? `Rascunho salvo no servidor às ${servidor.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : salvoEm ? `Rascunho salvo neste aparelho às ${salvoEm}` : 'O rascunho deste pedido fica salvo neste aparelho, por paciente.'}
              </span>
            </div>
            <Button disabled={pendencias.length > 0} onClick={() => void emitir()}><Send /> Emitir e imprimir</Button>
          </div>
        </>
      )}
    </div>
  )
}
