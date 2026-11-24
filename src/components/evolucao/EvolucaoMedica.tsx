// ─────────────────────────────────────────────────────────────────────────────
// Evolução médica estruturada (protótipo: aba Evolução do leito, evolDoc;
// modelo do usuário uploads/evolucao.html): lista de problemas,
// antimicrobianos com dia de uso, dispositivos (vêm da enfermagem), SOAP com
// sinais vitais, SpO₂ em ar ou O₂, exame físico por sistema, exames, A/P,
// avisos, CID principal com estado e o aviso de notificação compulsória.
//
// Uma por dia por profissional, decidido NO SERVIDOR: se o médico já registrou
// a de hoje, a tela oferece corrigi-la (nova versão, com justificativa) ou
// acrescentar um complemento (texto livre, entra como documento próprio ligado
// à evolução do dia). O texto do documento é montado pelo servidor a partir do
// JSON, então o que se lê no histórico é sempre o que foi preenchido.
//
// "Evoluir hoje" (EV2 e EV3, RT 24/11/2026): os sinais vitais vêm da última
// aferição da enfermagem (crus, com a hora, editáveis); "Copiar da evolução
// anterior" por bloco, e o bloco copiado fica marcado até o médico editar ou
// confirmar (não se registra com bloco copiado sem revisão); "sem alterações"
// por sistema; a última evolução ao lado, em leitura; o diagnóstico mora num
// lugar só, a lista de problemas com CID por busca, dentro do formulário; o
// que falta preencher numa lista curta ao lado do botão.
// ─────────────────────────────────────────────────────────────────────────────
import { useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, Copy, FileText, Plus, ShieldAlert, Stethoscope, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { FormularioCheckin } from '@/components/checkin/FormularioCheckin'
import { useAlergias, ativas, negaVigente } from '@/components/paciente/useAlergias'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  CAMPOS_EF, CAMPOS_SV, FORM_VAZIO, avisosEvolucao, dataLonga, deEstruturado, diaHora, herdarDaUltima, mensagemErro, paraEstruturado,
  useContextoEvolucao, useMotivoEvolucao, useRecarregarEvolucao, type ContextoEvolucao, type DadosEstruturados, type FormEvolucao,
} from './dados'
import { FONTE_LNNC as LNNC_FONTE, useNotificacaoCompulsoria } from '@/components/internacao/caderno/notificacao'
import { type DiagnosticoLinha, useDiagnosticos } from '@/components/internacao/caderno/diagnosticos'
import { AbaDiagnostico } from '@/components/internacao/caderno/Diagnostico'
import type { Acao } from '@/components/internacao/caderno/comum'
import { carregarEnvelope, salvarEnvelope } from '@/lib/rascunho'
import {
  BLOCOS_COPIAVEIS, SEM_ALTERACOES, copiadosSemRevisao, copiarBloco, temNoAnterior, vitaisDaEnfermagem, type BlocoCopiavel,
} from '@/lib/evolucaoCopia'
import { Bloco, CampoTexto, ChipEscolha, Mensagem, RotuloSecao, Selo, type Aviso } from './pecas'

type Modo = 'nova' | 'corrigir' | 'complemento'

/** O que o formulário precisa para mostrar e mudar o diagnóstico ali mesmo (EV3). */
export type DiagnosticoNaEvolucao = { podeEditar: boolean; acao: Acao; onAbrirNotificacao: () => void }

// prefixo dos rascunhos clínicos (shared/rascunho.ts): some ao sair, na
// abertura sem sessão e por TTL de 12 h (envelope) — dado de paciente não
// fica no computador do posto entre plantões (LGPD).
const chaveRascunho = (internacaoId: string) => `cc:rascunho:evol:${internacaoId}`
type Rascunho = FormEvolucao & { copiados?: BlocoCopiavel[] }
function lerRascunho(internacaoId: string): Rascunho | null {
  const c = carregarEnvelope<Partial<Rascunho>>(chaveRascunho(internacaoId))
  return c ? ({ ...FORM_VAZIO, ...c.dados } as Rascunho) : null
}
function gravarRascunho(internacaoId: string, f: Rascunho | null) {
  try {
    if (f) salvarEnvelope(chaveRascunho(internacaoId), f)
    else localStorage.removeItem(chaveRascunho(internacaoId))
  } catch {
    /* navegador sem armazenamento: o rascunho só vive na tela */
  }
}

export function EvolucaoMedica({ pacienteId, internacaoId, diagnostico }: {
  pacienteId: string; internacaoId: string
  /** O diagnóstico (lista de problemas com CID) fica dentro do formulário (EV3). */
  diagnostico: DiagnosticoNaEvolucao
}) {
  const ctx = useContextoEvolucao(internacaoId)
  if (ctx.isLoading) return <Bloco><span className="flex items-center gap-2 text-apoio text-tinta-sussurro"><Spinner /> Carregando a evolução…</span></Bloco>
  if (ctx.error || !ctx.data) return <Bloco><Mensagem aviso={{ erro: true, texto: 'Não foi possível abrir a evolução: ' + mensagemErro(ctx.error) }} /></Bloco>
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <div className="min-w-0 flex-[3_1_520px]">
        <Formulario key={internacaoId} ctx={ctx.data} pacienteId={pacienteId} internacaoId={internacaoId} diagnostico={diagnostico} />
      </div>
      {/* EV2: a última evolução ao lado, em leitura */}
      <div className="min-w-0 flex-[1_1_260px]">
        <UltimaEvolucao ctx={ctx.data} />
      </div>
    </div>
  )
}

/** A última evolução médica estruturada, só para ler ao lado do formulário. */
function UltimaEvolucao({ ctx }: { ctx: ContextoEvolucao }) {
  const u = ctx.ultima_estruturada
  const d = u?.dados
  const linha = (rotulo: string, texto: string | undefined) => (texto?.trim()
    ? <div className="flex flex-col gap-0.5"><RotuloSecao>{rotulo}</RotuloSecao><span className="text-apoio leading-[1.45] whitespace-pre-wrap text-grafite">{texto}</span></div>
    : null)
  const ef = d?.exame_fisico ? CAMPOS_EF.filter((c) => d.exame_fisico?.[c.k]?.trim()).map((c) => `${c.rotulo}: ${d.exame_fisico![c.k]}`).join('\n') : ''
  const sv = d?.sv ? CAMPOS_SV.filter((c) => d.sv?.[c.k]?.trim()).map((c) => `${c.rotulo} ${d.sv![c.k]}${c.unidade ? ` ${c.unidade}` : ''}`).join(' · ') : ''
  return (
    <aside aria-label="Última evolução" className="flex min-w-0 flex-col gap-2.5 rounded-container border border-fio bg-campo p-3.5">
      <span className="flex items-center gap-[7px] text-controle font-semibold text-tinta"><FileText className="size-[15px] text-acao" aria-hidden /> Última evolução</span>
      {!u ? <span className="text-apoio text-tinta-sussurro">Nenhuma evolução médica estruturada nesta internação ainda.</span> : (
        <>
          <span className="text-rotulo text-tinta-sussurro">{diaHora(u.criado_em)} · leitura</span>
          {linha('Subjetivo', d?.s)}
          {linha('Sinais vitais', sv)}
          {linha('Exame físico', ef)}
          {linha('Exames', d?.exames)}
          {linha('Avaliação', d?.a)}
          {linha('Plano', d?.p)}
        </>
      )}
    </aside>
  )
}

/**
 * Ponto 9: em vez da frase genérica, o motivo de não poder evoluir e, quando
 * existe, o que fazer (por_que_nao_evoluo). A regra é do servidor.
 */
function PorQueNaoEvoluo({ internacaoId, aoMudar }: { internacaoId: string; aoMudar: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const qc = useQueryClient()
  const m = useMotivoEvolucao(internacaoId, true).data
  const setores = m?.meus_setores_agora.join(', ')
  const texto = !m ? 'A evolução médica é registrada pelo médico de plantão no setor do paciente.'
    : m.motivo === 'checkin_pendente' ? 'Seu check-in deste plantão não foi feito. Faça o check-in para evoluir.'
    : m.motivo === 'outro_setor' ? `Você está de plantão em ${setores}; este paciente está em ${m.setor_paciente ?? 'outro setor'}. A evolução é do médico de plantão no setor do paciente.`
    : m.motivo === 'sem_plantao' ? 'Você não tem plantão agora nesta unidade. A evolução é do médico de plantão no setor do paciente.'
    : m.motivo === 'papel' ? 'Seu papel nesta unidade não registra evolução médica.'
    : 'A evolução médica é registrada pelo médico de plantão no setor do paciente.'
  return (
    <div role="status" className="flex flex-col gap-2 rounded-controle border border-fio bg-campo px-3 py-2.5">
      <span className="flex items-center gap-2 text-controle font-medium text-tinta">
        <ShieldAlert className="size-4 text-atencao" aria-hidden /> Você não pode registrar a evolução agora
      </span>
      <span className="text-apoio text-tinta-apoio">{texto} As evoluções ficam para leitura no histórico.</span>
      {m?.motivo === 'checkin_pendente' && (
        <FormularioCheckin unidadeId={unidadeAtiva?.unidade_id} comObservacao={false} rotulo="Fazer check-in"
          onFeito={() => { void qc.invalidateQueries({ queryKey: ['evolucao-motivo', internacaoId] }); aoMudar() }} />
      )}
    </div>
  )
}

/**
 * Marca de cópia de um bloco (EV2): "Copiar da evolução anterior" quando a
 * anterior tem texto; copiado, a faixa âmbar com "Confirmar" até o médico
 * revisar (editar o campo também tira a marca).
 */
function MarcaCopia({ bloco, copiado, podeCopiar, dataAnterior, aoCopiar, aoConfirmar }: {
  bloco: string; copiado: boolean; podeCopiar: boolean; dataAnterior: string; aoCopiar: () => void; aoConfirmar: () => void
}) {
  if (copiado) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2.5 py-1.5">
        <Copy className="size-3.5 shrink-0 text-atencao" aria-hidden />
        <span className="text-apoio text-atencao">{bloco}: veio da evolução de {dataAnterior}. Revise antes de registrar.</span>
        <Button size="xs" variant="outline" className="ml-auto" onClick={aoConfirmar}><Check aria-hidden /> Revisei</Button>
      </div>
    )
  }
  if (!podeCopiar) return null
  return (
    <Button size="xs" variant="ghost" className="self-start px-1.5 text-acao" onClick={aoCopiar}>
      <Copy aria-hidden /> Copiar da evolução de {dataAnterior}
    </Button>
  )
}

function Formulario({ ctx, pacienteId, internacaoId, diagnostico }: {
  ctx: ContextoEvolucao; pacienteId: string; internacaoId: string; diagnostico: DiagnosticoNaEvolucao
}) {
  const jaTem = ctx.minha_do_dia
  const recarregar = useRecarregarEvolucao(internacaoId, pacienteId)
  const alergiasQ = useAlergias(pacienteId)
  const sv = ctx.sv_enfermagem
  const anterior = ctx.ultima_estruturada
  const dataAnterior = anterior ? diaHora(anterior.criado_em) : ''
  const [modo, setModo] = React.useState<Modo>('nova')
  // EV2: os vitais da última aferição da enfermagem entram crus, nos campos vazios
  const [inicio] = React.useState(() => {
    const r = lerRascunho(internacaoId)
    const base: FormEvolucao = r ?? herdarDaUltima(anterior?.dados)
    if (!sv || jaTem) return { f: base, copiados: r?.copiados ?? [], trouxe: [] as string[] }
    const v = vitaisDaEnfermagem(base.sv, base.sv_condicao, sv)
    return { f: { ...base, sv: v.sv, sv_condicao: v.sv_condicao }, copiados: r?.copiados ?? [], trouxe: v.trouxe }
  })
  const [f, setF] = React.useState<FormEvolucao>(inicio.f)
  const [copiados, setCopiados] = React.useState<Set<BlocoCopiavel>>(() => new Set(inicio.copiados))
  const [svTrazidos, setSvTrazidos] = React.useState<string[]>(inicio.trouxe)
  const [justificativa, setJustificativa] = React.useState('')
  const [complemento, setComplemento] = React.useState('')
  const [novoAtb, setNovoAtb] = React.useState({ nome: '', inicio: '' })
  const [salvando, setSalvando] = React.useState(false)
  const [aviso, setAviso] = React.useState<Aviso>(null)

  // o rascunho da evolução nova fica no navegador até ser registrada (com as marcas de cópia)
  React.useEffect(() => {
    if (modo === 'nova' && !jaTem) gravarRascunho(internacaoId, { ...f, copiados: [...copiados] })
  }, [f, copiados, modo, jaTem, internacaoId])

  const revisado = (b: BlocoCopiavel) => setCopiados((x) => {
    if (!x.has(b)) return x
    const n = new Set(x)
    n.delete(b)
    return n
  })
  const set = (p: Partial<FormEvolucao>) => {
    for (const k of Object.keys(p)) if (BLOCOS_COPIAVEIS.some((b) => b.k === k)) revisado(k as BlocoCopiavel)
    setF((x) => ({ ...x, ...p }))
  }
  const setSv = (k: keyof FormEvolucao['sv'], v: string) => setF((x) => ({ ...x, sv: { ...x.sv, [k]: v } }))
  const setEf = (k: keyof FormEvolucao['exame_fisico'], v: string) => {
    revisado('exame_fisico')
    setF((x) => ({ ...x, exame_fisico: { ...x.exame_fisico, [k]: v } }))
  }
  const copiar = (b: BlocoCopiavel) => {
    if (!anterior) return
    setF((x) => copiarBloco(x, anterior.dados, b))
    setCopiados((x) => new Set(x).add(b))
  }
  const marca = (b: BlocoCopiavel, rotulo: string) => (
    <MarcaCopia bloco={rotulo} copiado={copiados.has(b)} podeCopiar={temNoAnterior(anterior?.dados, b)} dataAnterior={dataAnterior}
      aoCopiar={() => copiar(b)} aoConfirmar={() => revisado(b)} />
  )
  const moldura = (b: BlocoCopiavel) => cn('flex flex-col gap-1.5', copiados.has(b) && 'rounded-controle border-l-4 border-atencao pl-2.5')

  const painel = alergiasQ.data
  const alergias = painel?.estado === 'tem'
    ? 'Alergias: ' + ativas(painel).map((a) => a.substancia).join(', ')
    : painel?.estado === 'nega' || negaVigente(painel) ? 'Nega alergias'
    : painel?.estado === 'desconhece' ? 'Alergia não informada (não soube)' : 'Alergias não registradas'
  const tomAlergia = painel?.estado === 'tem' ? 'critico' : painel?.estado === 'nega' ? 'conforme' : 'atencao'

  // EV3 (RT, 24/11/2026): o diagnóstico tem um lugar só — a lista de problemas
  // com CID, aqui dentro; a evolução grava o retrato dela
  const diagnosticos = useDiagnosticos(internacaoId)
  const vigentes = (diagnosticos.data ?? []).filter((d) => !d.encerrado_em)
  const primario = vigentes.find((d) => d.tipo === 'primario')
  const cidAtual: FormEvolucao['cid'] = primario
    ? { codigo: primario.cid, descricao: primario.descricao ?? '', estado: primario.status }
    : { codigo: '', descricao: '', estado: 'hipotese' }
  const problemas = textoProblemas(vigentes)
  const avisos = avisosEvolucao(f, diagnosticos.isSuccess ? vigentes.length : undefined)
  // LNNC do banco (notificacao_compulsoria_dos_cids): só sugere, o médico marca
  const lnnc = useNotificacaoCompulsoria(cidAtual.codigo ? [cidAtual.codigo] : [])
  const itemLnnc = lnnc.data?.itens[0]
  const notificavel = itemLnnc ? { nome: itemLnnc.agravo, imediata: itemLnnc.imediata } : null
  const editavel = ctx.pode_registrar && (modo !== 'nova' || !jaTem)
  const temTexto = (f.s + f.a + f.p).trim().length >= 10
  const semRevisao = copiadosSemRevisao(copiados)
  const falta = [
    ...(temTexto ? [] : ['escrever S, A ou P (mínimo de 10 letras)']),
    ...semRevisao.map((b) => `revisar o bloco copiado: ${b}`),
    ...(modo === 'corrigir' && justificativa.trim().length < 10 ? ['justificativa da correção'] : []),
  ]

  function trazerSv() {
    if (!sv) return
    setF((x) => ({
      ...x,
      sv: { ...x.sv, pa: sv.pa ?? x.sv.pa, fc: sv.fc ?? x.sv.fc, fr: sv.fr ?? x.sv.fr, temp: sv.temp ?? x.sv.temp, spo2: sv.spo2 ?? x.sv.spo2, glic: sv.glic ?? x.sv.glic },
      sv_condicao: sv.condicao ?? x.sv_condicao,
    }))
    setSvTrazidos(['pa', 'fc', 'fr', 'temp', 'spo2', 'glic'].filter((k) => sv[k as 'pa'] != null))
  }

  function recomecar() {
    setF(herdarDaUltima(anterior?.dados))
    setCopiados(new Set())
    setSvTrazidos([])
  }

  async function registrar() {
    if (falta.length) return
    setSalvando(true)
    setAviso(null)
    const estruturado = paraEstruturado({ ...f, problemas, cid: cidAtual }, ctx, alergias)
    const { error } = modo === 'corrigir' && jaTem
      ? await supabase.rpc('corrigir_evolucao', {
          p_documento: jaTem.documento_id, p_conteudo: '', p_justificativa: justificativa, p_estruturado: estruturado,
        })
      : await supabase.rpc('registrar_evolucao', {
          p_internacao: internacaoId, p_tipo: 'evolucao', p_conteudo: '', p_estruturado: estruturado,
        })
    setSalvando(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    // o dia seguinte herda antimicrobianos incluídos à mão e CID; o resto se copia por bloco
    setF(herdarDaUltima(estruturado as DadosEstruturados))
    setCopiados(new Set())
    setSvTrazidos([])
    setAviso({ erro: false, texto: modo === 'corrigir' ? 'Correção registrada: nova versão, com a justificativa; a anterior fica guardada.' : 'Evolução do dia registrada no prontuário.' })
    setModo('nova')
    setJustificativa('')
    recarregar()
  }

  async function registrarComplemento() {
    setSalvando(true)
    setAviso(null)
    const { error } = await supabase.rpc('registrar_evolucao', { p_internacao: internacaoId, p_tipo: 'evolucao', p_conteudo: complemento })
    setSalvando(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    setComplemento('')
    setModo('nova')
    setAviso({ erro: false, texto: 'Complemento registrado, ligado à evolução de hoje.' })
    recarregar()
  }

  async function marcarAgravo() {
    if (!notificavel) return
    const { error } = await supabase.rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: notificavel.nome, p_cid: cidAtual.codigo })
    setAviso(error ? { erro: true, texto: error.message } : { erro: false, texto: 'Agravo marcado como suspeito: a notificação aparece no Resumo e impede a alta até ser registrada ou descartada.' })
  }

  return (
    <Bloco aria-label="Evolução médica">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h3 className="flex items-center gap-[7px] text-corpo font-semibold text-tinta">
          <FileText className="size-[15px] text-acao" aria-hidden /> Evolução médica · D{ctx.dih}
        </h3>
        <span className="text-apoio text-tinta-sussurro">Uma por dia por profissional · a segunda do dia entra como complemento</span>
      </div>

      {!ctx.ativa && <Mensagem aviso={{ erro: true, texto: 'Internação encerrada: a evolução fica só para leitura no histórico.' }} />}
      {ctx.ativa && !ctx.pode_registrar && <PorQueNaoEvoluo internacaoId={internacaoId} aoMudar={recarregar} />}

      {jaTem && ctx.pode_registrar && modo === 'nova' && (
        <div className="flex flex-col gap-2 rounded-container border border-acao/30 bg-alerta-marca px-3.5 py-3">
          <span className="flex items-center gap-2 text-controle text-tinta">
            <ClipboardCheck className="size-4 text-acao" aria-hidden />
            Sua evolução de hoje foi registrada às {diaHora(jaTem.criado_em).split(' · ')[1]}{jaTem.versao > 1 ? ` (corrigida, versão ${jaTem.versao})` : ''}.
          </span>
          <span className="text-apoio text-tinta-apoio">
            Para mudar o que escreveu, corrija: vira nova versão, com justificativa. Para um fato novo do dia (febre, resultado, conduta), registre um complemento.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!jaTem.estruturada}
              onClick={() => { setF(deEstruturado(jaTem.dados)); setCopiados(new Set()); setModo('corrigir'); setAviso(null) }}>
              Corrigir a evolução de hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setModo('complemento'); setAviso(null) }}>
              <Plus /> Registrar complemento
            </Button>
          </div>
          {!jaTem.estruturada && <span className="text-rotulo text-tinta-sussurro">A de hoje foi escrita em texto livre: a correção dela é pela lista de documentos da internação.</span>}
        </div>
      )}

      {modo === 'complemento' && (
        <div className="flex flex-col gap-2">
          <CampoTexto id="evol-complemento" rotulo="Complemento da evolução de hoje" dica="(fato novo do dia, com hora)" linhas={4}
            valor={complemento} onValor={setComplemento} placeholder="15h: febre de 38,2 °C; colhidas hemoculturas, iniciado…" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void registrarComplemento()} disabled={complemento.trim().length < 10 || salvando}>
              {salvando && <Spinner />} Registrar complemento
            </Button>
            <Button variant="ghost" onClick={() => setModo('nova')}>Cancelar</Button>
          </div>
        </div>
      )}

      <Mensagem aviso={aviso} />

      {editavel && modo !== 'complemento' && (
        <fieldset className="flex flex-col gap-3" disabled={salvando}>
          {modo === 'corrigir' && <RotuloSecao className="text-acao">Corrigindo a evolução de hoje</RotuloSecao>}
          <div className="flex flex-wrap items-center gap-2">
            <Selo>DIH {ctx.dih} · admissão {dataLonga(ctx.data_admissao)}</Selo>
            <Selo tom={tomAlergia}>{alergias}</Selo>
          </div>

          {/* EV3: a lista de problemas é o diagnóstico (CID por busca, um por linha), num lugar só */}
          <div className="flex flex-col gap-2 rounded-controle border border-fio bg-campo px-3 py-2.5">
            <span className="text-apoio font-medium text-grafite">Diagnósticos / lista de problemas <span className="font-normal text-tinta-sussurro">· CID-10, um principal e os secundários</span></span>
            <AbaDiagnostico internacaoId={internacaoId} podeEditar={diagnostico.podeEditar} acao={diagnostico.acao}
              onAbrirNotificacao={diagnostico.onAbrirNotificacao} compacto />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
              <span className="text-apoio font-medium text-grafite">Antimicrobianos</span>
              {ctx.antimicrobianos.map((a) => (
                <span key={a.item_id} className="text-controle text-tinta">
                  {a.nome} · D{a.dia} <span className="text-tinta-sussurro">(prescrição, início {dataLonga(a.inicio)})</span>
                </span>
              ))}
              {f.antimicrobianosManuais.map((a, i) => (
                <span key={`${a.nome}-${i}`} className="flex items-center gap-2 text-controle text-tinta">
                  {a.nome} · D{diaDeUso(a.inicio, ctx.hoje)} <span className="text-tinta-sussurro">(início {dataLonga(a.inicio)})</span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remover ${a.nome}`} className="hover:text-critico"
                    onClick={() => set({ antimicrobianosManuais: f.antimicrobianosManuais.filter((_, j) => j !== i) })}>
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </span>
              ))}
              {ctx.antimicrobianos.length === 0 && f.antimicrobianosManuais.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum em uso.</span>}
              <div className="flex flex-wrap gap-1.5">
                <Input className="w-auto flex-[1_1_140px]" placeholder="Antimicrobiano (fora da prescrição)" aria-label="Antimicrobiano"
                  value={novoAtb.nome} onChange={(e) => setNovoAtb((x) => ({ ...x, nome: e.target.value }))} />
                <Input className="w-auto flex-[0_1_150px]" type="date" aria-label="Início" max={ctx.hoje}
                  value={novoAtb.inicio} onChange={(e) => setNovoAtb((x) => ({ ...x, inicio: e.target.value }))} />
                <Button variant="outline" disabled={!novoAtb.nome.trim() || !novoAtb.inicio}
                  onClick={() => { set({ antimicrobianosManuais: [...f.antimicrobianosManuais, { nome: novoAtb.nome.trim(), inicio: novoAtb.inicio }] }); setNovoAtb({ nome: '', inicio: '' }) }}>
                  Incluir
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
              <span className="text-apoio font-medium text-grafite">Dispositivos <span className="font-normal text-tinta-sussurro">(registrados pela enfermagem)</span></span>
              {ctx.dispositivos.map((d) => <span key={d} className="text-controle text-tinta">{d}</span>)}
              {ctx.dispositivos.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum registrado.</span>}
            </div>
          </div>

          <div className={moldura('s')}>
            {marca('s', 'Subjetivo')}
            <CampoTexto id="evol-s" rotulo="S · Subjetivo" valor={f.s} onValor={(v) => set({ s: v })}
              placeholder="Queixas, sono, aceitação da dieta, relato das últimas 24 h" />
          </div>

          <div className="flex flex-col gap-2.5 border-t border-trilha pt-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-controle font-semibold text-tinta">O · Objetivo</span>
              {sv && (
                <Button variant="outline" size="sm" className="ml-auto" onClick={trazerSv}>
                  <Stethoscope /> Trazer SV da enfermagem · {diaHora(sv.aferido_em)}{sv.por ? ` · ${sv.por}` : ''}
                </Button>
              )}
            </div>
            {sv && svTrazidos.length > 0 && (
              <span className="text-rotulo text-tinta-apoio">
                Sinais vitais da enfermagem de {diaHora(sv.aferido_em)}{sv.por ? ` (${sv.por})` : ''}, como foram registrados: veio do prontuário, revise. Corrija se aferiu de novo.
              </span>
            )}
            <div className="flex flex-wrap gap-2.5">
              {CAMPOS_SV.map((c) => (
                <label key={c.k} className={`flex min-w-0 flex-col gap-1 ${c.unidade ? 'flex-[1_1_90px]' : 'flex-[1_1_180px]'}`}>
                  <span className="text-rotulo font-medium text-grafite">{c.rotulo}{c.unidade ? ` (${c.unidade})` : ''}</span>
                  <Input value={f.sv[c.k]} onChange={(e) => { setSv(c.k, e.target.value); setSvTrazidos((x) => x.filter((k) => k !== c.k)) }}
                    inputMode={c.unidade ? 'decimal' : undefined} className={cn(svTrazidos.includes(c.k) && 'border-atencao/50')} />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-rotulo font-medium text-grafite">SpO₂ em</span>
              <ChipEscolha ativo={f.sv_condicao === 'ar'} onClick={() => set({ sv_condicao: f.sv_condicao === 'ar' ? '' : 'ar' })}>Ar ambiente</ChipEscolha>
              <ChipEscolha ativo={f.sv_condicao === 'o2'} onClick={() => set({ sv_condicao: f.sv_condicao === 'o2' ? '' : 'o2' })}>Em O₂</ChipEscolha>
              {f.sv_condicao === 'o2' && (
                <Input className="w-[90px]" placeholder="L/min" aria-label="Fluxo de O₂" value={f.o2_litros} onChange={(e) => set({ o2_litros: e.target.value })} />
              )}
            </div>
            <div className={moldura('exame_fisico')}>
              {marca('exame_fisico', 'Exame físico')}
              {CAMPOS_EF.map((c) => (
                <div key={c.k} className="flex flex-wrap items-start gap-2.5">
                  <label htmlFor={`evol-ef-${c.k}`} className="flex-[0_0_96px] pt-2 text-apoio font-medium text-grafite">{c.rotulo}</label>
                  <Textarea id={`evol-ef-${c.k}`} rows={1} className="min-h-0 w-auto flex-[1_1_240px] leading-[1.5]"
                    value={f.exame_fisico[c.k]} onChange={(e) => setEf(c.k, e.target.value)} />
                  {/* EV2: atalho por sistema; o texto fica no campo e pode ser editado */}
                  {!f.exame_fisico[c.k].trim() && (
                    <Button size="xs" variant="outline" className="mt-1.5" onClick={() => setEf(c.k, SEM_ALTERACOES)}>Sem alterações</Button>
                  )}
                </div>
              ))}
            </div>
            <div className={moldura('outros_achados')}>
              {marca('outros_achados', 'Outros achados')}
              <CampoTexto id="evol-outros" rotulo="Outros achados" linhas={1} valor={f.outros_achados} onValor={(v) => set({ outros_achados: v })} />
            </div>
            <div className={moldura('exames')}>
              {marca('exames', 'Exames complementares')}
              <CampoTexto id="evol-exames" rotulo="Exames complementares" valor={f.exames} onValor={(v) => set({ exames: v })} placeholder="Resultados do dia, com data" />
            </div>
          </div>

          <div className={moldura('a')}>
            {marca('a', 'Avaliação')}
            <CampoTexto id="evol-a" rotulo="A · Avaliação / impressão" valor={f.a} onValor={(v) => set({ a: v })}
              placeholder="Evolução do quadro e hipóteses, com achados objetivos" />
          </div>
          <div className={moldura('p')}>
            {marca('p', 'Conduta / plano')}
            <CampoTexto id="evol-p" rotulo="P · Conduta / plano" valor={f.p} onValor={(v) => set({ p: v })}
              placeholder="Condutas, metas e critérios de alta" />
          </div>

          {notificavel && (
            <div className="flex flex-wrap items-start gap-2 text-apoio leading-[1.45] text-atencao">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                CID de notificação compulsória: {notificavel.nome}{notificavel.imediata ? ' (notificação imediata)' : ''}. Marque o agravo
                suspeito: ele impede a alta até a notificação ser registrada. <span className="text-tinta-sussurro">{LNNC_FONTE}; o mapeamento CID → agravo está em conferência pela vigilância.</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => void marcarAgravo()}>Marcar agravo suspeito</Button>
            </div>
          )}

          {modo === 'corrigir' && (
            <Input placeholder="Justificativa da correção (mínimo de 10 letras)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          )}
          <div className="flex flex-wrap items-start justify-end gap-3 border-t border-trilha pt-3">
            {/* EV3: o que falta e os avisos numa lista curta ao lado do botão */}
            {(falta.length > 0 || avisos.length > 0) && (
              <ul aria-label="Falta preencher" className="mr-auto flex min-w-0 flex-[1_1_260px] flex-col gap-0.5 text-apoio leading-[1.4]">
                {falta.map((x) => <li key={x} className="text-critico">Falta {x}.</li>)}
                {avisos.map((x) => <li key={x} className="text-atencao">{x}</li>)}
              </ul>
            )}
            {modo === 'corrigir' && <Button variant="ghost" onClick={() => { setModo('nova'); recomecar() }}>Cancelar</Button>}
            {modo === 'nova' && (
              <Button variant="ghost" onClick={recomecar}>Limpar o dia</Button>
            )}
            <Button onClick={() => void registrar()} disabled={salvando || falta.length > 0}>
              {salvando && <Spinner />} {modo === 'corrigir' ? 'Salvar correção' : 'Registrar evolução do dia'}
            </Button>
          </div>
        </fieldset>
      )}
    </Bloco>
  )
}

/** A lista de problemas como texto (o JSON da evolução guarda o retrato): uma linha por diagnóstico vigente. */
function textoProblemas(vigentes: DiagnosticoLinha[]): string {
  return [...vigentes].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'primario' ? -1 : 1))
    .map((d) => `${d.descricao ?? d.cid} (${d.cid})${d.status === 'hipotese' ? ' — hipótese' : ''}`).join('\n')
}

function diaDeUso(inicio: string, hoje: string): string {
  const a = Date.parse(`${inicio}T12:00:00Z`), b = Date.parse(`${hoje}T12:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return '?'
  const n = Math.round((b - a) / 86_400_000) + 1
  return n >= 1 ? String(n) : '?'
}
