// ─────────────────────────────────────────────────────────────────────────────
// Termo de consentimento livre e esclarecido (protótipo: leito › "Parecer e
// termos", ESTADO.md etapa 11).
//
// O médico escolhe um modelo da unidade (ou escreve do zero), ajusta o texto,
// diz quem assina e gera o termo: vira DOCUMENTO NUMERADO no prontuário.
// Quem assina: o paciente; o responsável (nome, documento e vínculo) quando o
// paciente não tem condições ou é menor de 14 anos; ou ninguém presente — o
// menor sem responsável pode ser atendido, e o termo registra a ausência com
// o motivo. Nada se apaga: corrigir é RETIFICAR (versão nova, a anterior fica)
// e cancelar pede justificativa. Toda regra é do servidor
// (20261004000004_termo_consentimento.sql).
//
// A folha do TCLE sai montada no servidor (lib/prontuario › imprimirDocumento),
// ao gerar e em cada termo da lista. A assinatura digital do médico e do
// paciente/responsável espera a etapa 4.8 (ICP-Brasil).
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown, ChevronUp, FilePen, FileX, Printer, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { imprimirDocumento } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import {
  mensagemErro, normalizar, preencherCampos, quando, quemAssina, useCancelarTermo, useEmitirTermo, usePainelTermos,
  type Assinante, type DadosTermo, type PainelTermos, type TermoRegistrado,
} from './termo'

export type AbaTermoConsentimentoProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

type Formulario = {
  busca: string
  modeloId: string | null
  procedimento: string
  texto: string
  informacoes: string
  semCondicoes: boolean
  semCondicoesMotivo: string
  presenca: 'responsavel' | 'ninguem'
  respNome: string
  respDocumento: string
  respVinculo: string
  ausencia: string
  testNome: string
  testDocumento: string
  /** termo em correção (retificação) */
  retifica: TermoRegistrado | null
  motivoRetificacao: string
}

const VAZIO: Formulario = {
  busca: '', modeloId: null, procedimento: '', texto: '', informacoes: '', semCondicoes: false, semCondicoesMotivo: '',
  presenca: 'responsavel', respNome: '', respDocumento: '', respVinculo: '', ausencia: '', testNome: '', testDocumento: '',
  retifica: null, motivoRetificacao: '',
}

const cheio = (s: string, min = 1) => s.trim().length >= min

function Opcao({ ativa, onClick, children, disabled }: { ativa: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={ativa}
      className={cn('rounded-capsula border px-3 py-1 text-apoio transition-colors disabled:opacity-45',
        ativa ? 'border-acao bg-acao/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
      {children}
    </button>
  )
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-apoio font-medium text-grafite">
      <span>{rotulo}{dica && <span className="font-normal text-tinta-sussurro"> {dica}</span>}</span>
      {children}
    </label>
  )
}

function Aviso({ children, tom = 'atencao' }: { children: React.ReactNode; tom?: 'atencao' | 'critico' }) {
  return (
    <p className={cn('rounded-controle px-3 py-2 text-apoio leading-[1.45] [text-wrap:pretty]',
      tom === 'atencao' ? 'bg-alerta-atencao text-atencao' : 'bg-alerta-critico text-critico')}>
      {children}
    </p>
  )
}

/** Valores conhecidos agora, para a pré-visualização dos {campos} do modelo. */
function valoresCampos(p: PainelTermos, procedimento: string) {
  const idade = p.paciente.idade_anos
  const crm = p.medico?.crm ? `${p.medico.crm}${p.medico.uf_crm ? `/${p.medico.uf_crm}` : ''}` : ''
  return {
    paciente: p.paciente.nome,
    idade: idade == null ? '' : idade === 1 ? '1 ano' : `${idade} anos`,
    procedimento,
    medico: p.medico?.nome ?? '',
    crm,
    unidade: p.unidade ?? '',
    data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    // {responsavel} e {vinculo} ficam para o servidor: dependem de quem assina
  }
}

export function AbaTermoConsentimento({ pacienteId, episodioId, internacaoId }: AbaTermoConsentimentoProps) {
  const painel = usePainelTermos(pacienteId, episodioId, internacaoId)
  const emitir = useEmitirTermo(pacienteId, episodioId, internacaoId)
  const cancelar = useCancelarTermo(pacienteId)
  const [f, setF] = React.useState<Formulario>(VAZIO)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  // o termo recém-gerado: o aviso oferece imprimir a folha para as assinaturas
  const [gerado, setGerado] = React.useState<string | null>(null)
  const [aCancelar, setACancelar] = React.useState<TermoRegistrado | null>(null)
  const [motivoCancelar, setMotivoCancelar] = React.useState('')
  const [erroCancelar, setErroCancelar] = React.useState<string | null>(null)
  const topo = React.useRef<HTMLElement>(null)

  const mudar = (p: Partial<Formulario>) => setF((x) => ({ ...x, ...p }))

  if (painel.isLoading) return <div className="flex h-32 items-center justify-center"><Spinner rotulo="Carregando termos" /></div>
  if (painel.error || !painel.data) {
    return <Aviso tom="critico">Não foi possível carregar os termos de consentimento: {mensagemErro(painel.error)}</Aviso>
  }
  const p = painel.data
  // quem assina (decisão do RT 02/10/2026): < 16 o responsável; 16–17 o paciente
  // assistido pelo responsável; ≥ 18 o paciente. Sem nascimento, o termo não sai.
  const menor = p.paciente.faixa === 'representado'
  const idadeDesconhecida = p.paciente.idade_anos == null
  const assistido = p.paciente.faixa === 'assistido' && !f.semCondicoes

  const pedeResponsavel = menor || f.semCondicoes || assistido
  const assinante: Assinante = assistido || !pedeResponsavel ? 'paciente' : f.presenca === 'responsavel' ? 'responsavel' : 'ninguem_presente'
  const comResponsavel = assinante === 'responsavel' || (assistido && f.presenca === 'responsavel')
  const semResponsavel = assinante === 'ninguem_presente' || (assistido && f.presenca === 'ninguem')

  const faltas: string[] = []
  if (!cheio(f.procedimento, 3)) faltas.push('procedimento')
  if (!cheio(f.texto, 20)) faltas.push('informações sobre o procedimento')
  if (!menor && f.semCondicoes && !cheio(f.semCondicoesMotivo, 5)) faltas.push('por que o paciente não tem condições de assinar')
  if (idadeDesconhecida) faltas.push('data de nascimento no cadastro do paciente')
  if (comResponsavel) {
    if (!cheio(f.respNome, 3)) faltas.push('nome do responsável')
    if (!cheio(f.respDocumento, 3)) faltas.push('documento do responsável')
    if (!cheio(f.respVinculo, 2)) faltas.push('vínculo do responsável')
  }
  if (semResponsavel && !cheio(f.ausencia, 10)) faltas.push('por que não há responsável presente')
  if (f.testNome.trim() && !cheio(f.testNome, 3)) faltas.push('nome da testemunha')
  if (f.retifica && !cheio(f.motivoRetificacao, 10)) faltas.push('motivo da retificação')

  const busca = normalizar(f.busca)
  const modelos = p.modelos.filter((m) => !busca || normalizar(`${m.titulo} ${m.procedimento}`).includes(busca))
  const modeloEscolhido = p.modelos.find((m) => m.id === f.modeloId) ?? null
  const declaracao = modeloEscolhido?.declaracao?.trim() || p.declaracao_padrao

  function escolherModelo(id: string) {
    const m = p.modelos.find((x) => x.id === id)
    if (!m) return
    mudar({ modeloId: m.id, procedimento: m.procedimento, texto: preencherCampos(m.texto, valoresCampos(p, m.procedimento)) })
  }

  function escolherPresenca(presenca: Formulario['presenca']) {
    const r = p.paciente.responsavel
    // o responsável do cadastro já vem preenchido; o médico confere
    if (presenca === 'responsavel' && r && !f.respNome && !f.respDocumento && !f.respVinculo) {
      mudar({ presenca, respNome: r.nome ?? '', respDocumento: r.documento ?? '', respVinculo: r.vinculo ?? '' })
    } else mudar({ presenca })
  }

  function alternarSemCondicoes() {
    const liga = !f.semCondicoes
    mudar({ semCondicoes: liga })
    if (liga) escolherPresenca(f.presenca)
  }

  function retificar(t: TermoRegistrado) {
    const c = t.conteudo
    if (!c) return
    setF({
      ...VAZIO,
      modeloId: c.modelo?.id ?? null,
      procedimento: c.procedimento,
      texto: c.texto,
      informacoes: c.informacoes ?? '',
      semCondicoes: !c.paciente.menor_14 && c.assinante !== 'paciente',
      semCondicoesMotivo: c.sem_condicoes_motivo ?? '',
      presenca: c.assinante === 'ninguem_presente' || (c.assinante === 'paciente' && !!c.ausencia_motivo) ? 'ninguem' : 'responsavel',
      respNome: c.responsavel?.nome ?? '',
      respDocumento: c.responsavel?.documento ?? '',
      respVinculo: c.responsavel?.vinculo ?? '',
      ausencia: c.ausencia_motivo ?? '',
      testNome: c.testemunha?.nome ?? '',
      testDocumento: c.testemunha?.documento ?? '',
      retifica: t,
    })
    setErro(null)
    setAviso(null)
    setGerado(null)
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function gerar() {
    if (faltas.length > 0 || emitir.isPending) return
    setErro(null)
    setAviso(null)
    setGerado(null)
    const dados: DadosTermo = {
      modelo_id: f.modeloId,
      procedimento: f.procedimento.trim(),
      texto: f.texto.trim(),
      informacoes: f.informacoes.trim(),
      assinante,
      sem_condicoes_motivo: !menor && f.semCondicoes ? f.semCondicoesMotivo.trim() : '',
      responsavel: comResponsavel
        ? { nome: f.respNome.trim(), documento: f.respDocumento.trim(), vinculo: f.respVinculo.trim() }
        : null,
      ausencia_motivo: semResponsavel ? f.ausencia.trim() : '',
      testemunha: f.testNome.trim() ? { nome: f.testNome.trim(), documento: f.testDocumento.trim() } : null,
    }
    try {
      const r = await emitir.mutateAsync({ dados, retifica: f.retifica?.id ?? null, motivo: f.motivoRetificacao })
      setAviso(f.retifica
        ? `Termo retificado: versão ${r.versao}, nº ${r.numero}. A versão anterior continua no prontuário.`
        : `Termo gerado no prontuário, nº ${r.numero}.`)
      setF(VAZIO)
      setGerado(r.id)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function confirmarCancelamento() {
    if (!aCancelar || motivoCancelar.trim().length < 10) return
    setErroCancelar(null)
    try {
      await cancelar.mutateAsync({ documentoId: aCancelar.id, motivo: motivoCancelar })
      if (f.retifica?.raiz_id === aCancelar.raiz_id) setF(VAZIO)
      setAviso(`Termo nº ${aCancelar.numero ?? ''} cancelado. Ele continua no prontuário, marcado como cancelado.`)
      setGerado(null)
      setACancelar(null)
      setMotivoCancelar('')
    } catch (e) {
      setErroCancelar(mensagemErro(e))
    }
  }

  const ativos = p.termos.filter((t) => t.estado === 'ativo').length

  return (
    <div className="flex flex-col gap-3.5">
      <section ref={topo} className="flex flex-col gap-3 rounded-container border border-fio bg-superficie p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
            <ShieldCheck className="size-[15px] text-acao" aria-hidden />
            Termo de consentimento
          </h3>
          {f.retifica && <Badge variant="warning">Retificando nº {f.retifica.numero}</Badge>}
        </div>

        {!p.pode_emitir ? (
          <p className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
            O termo é gerado pelo médico de plantão no setor do paciente. Aqui você vê os termos já registrados.
          </p>
        ) : (
          <>
            {p.modelos.length === 0 ? (
              <Aviso>
                A unidade ainda não cadastrou modelos de termo (Unidade › Termos de consentimento). Dá para escrever o procedimento e as informações abaixo.
              </Aviso>
            ) : (
              <>
                <Input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })}
                  placeholder="Pesquisar modelo pelo nome" aria-label="Pesquisar modelo" />
                <div role="group" aria-label="Modelos da unidade" className="flex flex-wrap gap-1.5">
                  {modelos.map((m) => (
                    <Opcao key={m.id} ativa={f.modeloId === m.id} onClick={() => escolherModelo(m.id)}>{m.titulo}</Opcao>
                  ))}
                  {modelos.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum modelo com esse nome.</span>}
                </div>
              </>
            )}

            <Input value={f.procedimento} onChange={(e) => mudar({ procedimento: e.target.value })}
              placeholder="Procedimento, ex.: punção venosa central" aria-label="Procedimento" maxLength={200} />
            <Textarea value={f.texto} onChange={(e) => mudar({ texto: e.target.value })} rows={5}
              placeholder="Informações sobre o procedimento: o que é, benefícios, riscos e alternativas" aria-label="Texto do termo" />
            <Textarea value={f.informacoes} onChange={(e) => mudar({ informacoes: e.target.value })} rows={2}
              placeholder="Informações específicas deste paciente (opcional)" aria-label="Informações do paciente" />

            {/* quem assina */}
            {menor ? (
              <Aviso>
                Paciente com menos de 16 anos: o termo é assinado pelo responsável legal. Sem responsável presente (abrigo, escola, outro local), registre por quê.
              </Aviso>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <Opcao ativa={f.semCondicoes} onClick={alternarSemCondicoes}>Paciente sem condições de assinar</Opcao>
                </div>
                {idadeDesconhecida && (
                  <p className="text-rotulo text-critico">Sem data de nascimento no cadastro: o termo não pode ser gerado, porque a idade define quem assina. Cadastre a data de nascimento.</p>
                )}
                {assistido && (
                  <p className="text-rotulo text-tinta-sussurro">Paciente de 16 ou 17 anos: assina o termo junto com o responsável legal (assistência). Sem responsável presente, registre por quê.</p>
                )}
                {f.semCondicoes && (
                  <Input value={f.semCondicoesMotivo} onChange={(e) => mudar({ semCondicoesMotivo: e.target.value })}
                    placeholder="Por quê? ex.: rebaixamento de consciência" aria-label="Por que o paciente não tem condições de assinar" />
                )}
              </div>
            )}

            {pedeResponsavel && (
              <div className="flex flex-col gap-2">
                <div role="group" aria-label="Responsável" className="flex flex-wrap gap-1.5">
                  <Opcao ativa={f.presenca === 'responsavel'} onClick={() => escolherPresenca('responsavel')}>Responsável presente</Opcao>
                  <Opcao ativa={f.presenca === 'ninguem'} onClick={() => escolherPresenca('ninguem')}>Sem responsável presente</Opcao>
                </div>
                {f.presenca === 'responsavel' ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
                    <Input value={f.respNome} onChange={(e) => mudar({ respNome: e.target.value })} placeholder="Nome do responsável" aria-label="Nome do responsável" />
                    <Input value={f.respDocumento} onChange={(e) => mudar({ respDocumento: e.target.value })} placeholder="Documento (RG, CPF)" aria-label="Documento do responsável" />
                    <Input value={f.respVinculo} onChange={(e) => mudar({ respVinculo: e.target.value })} placeholder="Vínculo, ex.: mãe" aria-label="Vínculo" />
                  </div>
                ) : (
                  <Textarea value={f.ausencia} onChange={(e) => mudar({ ausencia: e.target.value })} rows={2}
                    placeholder="Por que não há responsável para assinar, ex.: trazida pela escola; mãe avisada por telefone"
                    aria-label="Por que não há responsável presente" />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Input value={f.testNome} onChange={(e) => mudar({ testNome: e.target.value })} placeholder="Testemunha (opcional)" aria-label="Testemunha" />
              <Input value={f.testDocumento} onChange={(e) => mudar({ testDocumento: e.target.value })} placeholder="Documento da testemunha"
                aria-label="Documento da testemunha" disabled={!f.testNome.trim()} />
            </div>

            <p className="text-rotulo leading-[1.5] text-tinta-sussurro [text-wrap:pretty]">
              <span className="font-semibold">Declaração que sai no termo:</span> “Eu, {assinante === 'responsavel' ? (f.respNome.trim() || '[responsável]') : p.paciente.nome}, {declaracao}”
            </p>

            {f.retifica && (
              <Campo rotulo="Motivo da retificação" dica="(mínimo de 10 letras; a versão anterior fica no prontuário)">
                <Input value={f.motivoRetificacao} onChange={(e) => mudar({ motivoRetificacao: e.target.value })}
                  placeholder="O que muda e por quê" />
              </Campo>
            )}

            {erro && <Aviso tom="critico">{erro}</Aviso>}
            {faltas.length > 0 && (f.procedimento || f.texto || f.retifica) && (
              <p className="text-rotulo text-tinta-sussurro">Falta: {faltas.join(', ')}.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setF(VAZIO); setErro(null) }}>
                {f.retifica ? 'Desistir da retificação' : 'Limpar'}
              </Button>
              <Button size="sm" onClick={() => void gerar()} disabled={faltas.length > 0 || emitir.isPending}>
                {emitir.isPending ? <Spinner className="size-3.5 text-white" /> : <FilePen />}
                {f.retifica ? 'Salvar retificação' : 'Gerar termo'}
              </Button>
            </div>
          </>
        )}
        {aviso && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-controle bg-alerta-conforme px-3 py-2 text-apoio text-conforme">
            <span className="flex-[1_1_220px]">{aviso}</span>
            {gerado && (
              <Button variant="outline" size="xs" onClick={() => void imprimirDocumento(gerado, 'Termo de consentimento')}>
                <Printer /> Imprimir para as assinaturas
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-corpo font-semibold text-tinta">Termos {episodioId || internacaoId ? 'deste atendimento' : 'do paciente'}</h3>
          <span className="text-apoio text-tinta-sussurro">{ativos} em vigor</span>
        </div>
        {p.termos.length === 0 ? (
          <p className="rounded-container border border-dashed border-fio bg-superficie px-4 py-6 text-center text-apoio text-tinta-sussurro">
            Nenhum termo de consentimento registrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.termos.map((t) => (
              <ItemTermo key={t.id} t={t} painel={p}
                emEdicao={f.retifica?.raiz_id === t.raiz_id}
                onRetificar={() => retificar(t)}
                onCancelar={() => { setACancelar(t); setMotivoCancelar(''); setErroCancelar(null) }} />
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!aCancelar} onOpenChange={(o) => { if (!o) setACancelar(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar termo nº {aCancelar?.numero}</DialogTitle>
            <DialogDescription>
              {aCancelar?.conteudo?.procedimento}. O termo não se apaga: fica no prontuário marcado como cancelado, com a sua justificativa.
            </DialogDescription>
          </DialogHeader>
          <Campo rotulo="Justificativa" dica="(mínimo de 10 letras)">
            <Textarea value={motivoCancelar} onChange={(e) => setMotivoCancelar(e.target.value)} rows={3}
              placeholder="Ex.: procedimento suspenso; paciente retirou o consentimento" />
          </Campo>
          {erroCancelar && <Aviso tom="critico">{erroCancelar}</Aviso>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setACancelar(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => void confirmarCancelamento()}
              disabled={motivoCancelar.trim().length < 10 || cancelar.isPending}>
              {cancelar.isPending ? <Spinner className="size-3.5" /> : <FileX />}
              Cancelar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ItemTermo({ t, painel, emEdicao, onRetificar, onCancelar }: {
  t: TermoRegistrado; painel: PainelTermos; emEdicao: boolean; onRetificar: () => void; onCancelar: () => void
}) {
  const [aberto, setAberto] = React.useState(false)
  const c = t.conteudo
  const cancelado = t.estado === 'cancelado'
  const souAutor = !!painel.medico && t.autor_original_id === painel.medico.id
  const podeRetificar = !cancelado && souAutor && painel.pode_emitir
  const podeCancelar = !cancelado && ((souAutor && painel.pode_emitir) || painel.sou_gestor)
  const crm = t.crm ? ` · CRM ${t.crm}${t.uf_crm ? `/${t.uf_crm}` : ''}` : ''

  return (
    <li className={cn('flex flex-col gap-1.5 rounded-container border bg-superficie px-4 py-3', emEdicao ? 'border-acao' : 'border-fio')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-corpo font-medium text-tinta', cancelado && 'text-tinta-sussurro line-through decoration-fio-forte')}>
          {c?.procedimento ?? 'Termo de consentimento'}{c?.modelo ? ` · ${c.modelo.titulo}` : ''}
        </span>
        {cancelado ? <Badge variant="destructive">Cancelado</Badge> : <Badge variant="success">Em vigor</Badge>}
        {t.versao > 1 && <Badge variant="secondary">Versão {t.versao}</Badge>}
      </div>
      <p className="text-rotulo leading-[1.5] text-tinta-sussurro">
        Nº {t.numero ?? '—'} · registrado em {quando(t.primeira_emissao_em)} por {t.autor ?? '—'}{crm}
        {t.versao > 1 && <> · retificado em {quando(t.emitido_em)}</>} · {quemAssina(c)}
      </p>
      {cancelado && t.cancelamento && (
        <p className="text-rotulo text-critico">
          Cancelado em {quando(t.cancelamento.em)} por {t.cancelamento.por ?? '—'}: {t.cancelamento.motivo}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button variant="ghost" size="xs" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
          {aberto ? <ChevronUp /> : <ChevronDown />}
          {aberto ? 'Fechar' : 'Ver termo'}
        </Button>
        {/* folha do TCLE, montada no servidor; cancelado sai marcado CANCELADO. Assinatura digital: etapa 4.8. */}
        <Button variant="outline" size="xs" onClick={() => void imprimirDocumento(t.id, 'Termo de consentimento')}>
          <Printer />
          Imprimir
        </Button>
        {podeRetificar && (
          <Button variant="outline" size="xs" onClick={onRetificar} disabled={emEdicao}>
            <FilePen />
            Retificar
          </Button>
        )}
        {podeCancelar && (
          <Button variant="destructive" size="xs" onClick={onCancelar}>
            <FileX />
            Cancelar
          </Button>
        )}
      </div>
      {aberto && c && (
        <div className="mt-1 flex flex-col gap-2.5 border-t border-trilha pt-2.5 text-apoio text-tinta-apoio">
          <Bloco titulo="Informações sobre o procedimento">{c.texto}</Bloco>
          {c.informacoes && <Bloco titulo="Informações específicas deste paciente">{c.informacoes}</Bloco>}
          <Bloco titulo="Declaração">
            Eu, {c.assinante === 'responsavel' && c.responsavel ? `${c.responsavel.nome}, ${c.responsavel.vinculo} de ${c.paciente.nome}` : c.paciente.nome}, {c.declaracao}
          </Bloco>
          {c.sem_condicoes_motivo && <Bloco titulo="Paciente sem condições de assinar">{c.sem_condicoes_motivo}</Bloco>}
          {c.responsavel && <Bloco titulo="Responsável">{c.responsavel.nome} · {c.responsavel.vinculo} · documento {c.responsavel.documento}</Bloco>}
          {c.ausencia_motivo && <Bloco titulo="Sem responsável presente">{c.ausencia_motivo}</Bloco>}
          {c.testemunha && <Bloco titulo="Testemunha">{c.testemunha.nome}{c.testemunha.documento ? ` · documento ${c.testemunha.documento}` : ''}</Bloco>}
          {t.versoes.length > 1 && (
            <div>
              <p className="text-rotulo font-semibold tracking-[0.04em] text-tinta-sussurro uppercase">Versões</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-rotulo text-tinta-sussurro">
                {t.versoes.map((v) => (
                  <li key={v.id}>
                    v{v.versao} · nº {v.numero ?? '—'} · {quando(v.emitido_em)} · {v.autor ?? '—'}
                    {v.motivo_retificacao && <> · “{v.motivo_retificacao}”</>}
                    {v.estado === 'retificado' && <> · substituída</>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-rotulo font-semibold tracking-[0.04em] text-tinta-sussurro uppercase">{titulo}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-tinta [text-wrap:pretty]">{children}</p>
    </div>
  )
}
