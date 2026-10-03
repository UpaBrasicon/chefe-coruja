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
// ─────────────────────────────────────────────────────────────────────────────
import { ClipboardCheck, FileText, Plus, ShieldAlert, Stethoscope, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useTerminologia } from '@/hooks/useTerminologia'
import { useAlergias, ativas, negaVigente } from '@/components/paciente/useAlergias'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  CAMPOS_EF, CAMPOS_SV, FORM_VAZIO, avisosEvolucao, dataLonga, deEstruturado, diaHora, herdarDaUltima, mensagemErro, paraEstruturado,
  useContextoEvolucao, useRecarregarEvolucao, type ContextoEvolucao, type DadosEstruturados, type FormEvolucao,
} from './dados'
import { FONTE_LNNC as LNNC_FONTE, useNotificacaoCompulsoria } from '@/components/internacao/caderno/notificacao'
import { carregarEnvelope, salvarEnvelope } from '@/pages/plantao/shared/rascunho'
import { Bloco, CampoTexto, ChipEscolha, Mensagem, RotuloSecao, Selo, type Aviso } from './pecas'

type Modo = 'nova' | 'corrigir' | 'complemento'

// prefixo dos rascunhos clínicos (shared/rascunho.ts): some ao sair, na
// abertura sem sessão e por TTL de 12 h (envelope) — dado de paciente não
// fica no computador do posto entre plantões (LGPD).
const chaveRascunho = (internacaoId: string) => `cc:rascunho:evol:${internacaoId}`
function lerRascunho(internacaoId: string): FormEvolucao | null {
  const c = carregarEnvelope<Partial<FormEvolucao>>(chaveRascunho(internacaoId))
  return c ? ({ ...FORM_VAZIO, ...c.dados } as FormEvolucao) : null
}
function gravarRascunho(internacaoId: string, f: FormEvolucao | null) {
  try {
    if (f) salvarEnvelope(chaveRascunho(internacaoId), f)
    else localStorage.removeItem(chaveRascunho(internacaoId))
  } catch {
    /* navegador sem armazenamento: o rascunho só vive na tela */
  }
}

export function EvolucaoMedica({ pacienteId, internacaoId }: { pacienteId: string; internacaoId: string }) {
  const ctx = useContextoEvolucao(internacaoId)
  if (ctx.isLoading) return <Bloco><span className="flex items-center gap-2 text-apoio text-tinta-sussurro"><Spinner /> Carregando a evolução…</span></Bloco>
  if (ctx.error || !ctx.data) return <Bloco><Mensagem aviso={{ erro: true, texto: 'Não foi possível abrir a evolução: ' + mensagemErro(ctx.error) }} /></Bloco>
  return <Formulario key={internacaoId} ctx={ctx.data} pacienteId={pacienteId} internacaoId={internacaoId} />
}

function Formulario({ ctx, pacienteId, internacaoId }: { ctx: ContextoEvolucao; pacienteId: string; internacaoId: string }) {
  const jaTem = ctx.minha_do_dia
  const recarregar = useRecarregarEvolucao(internacaoId, pacienteId)
  const alergiasQ = useAlergias(pacienteId)
  const [modo, setModo] = React.useState<Modo>('nova')
  const [f, setF] = React.useState<FormEvolucao>(() => lerRascunho(internacaoId) ?? herdarDaUltima(ctx.ultima_estruturada?.dados))
  const [justificativa, setJustificativa] = React.useState('')
  const [complemento, setComplemento] = React.useState('')
  const [novoAtb, setNovoAtb] = React.useState({ nome: '', inicio: '' })
  const [salvando, setSalvando] = React.useState(false)
  const [aviso, setAviso] = React.useState<Aviso>(null)

  // o rascunho da evolução nova fica no navegador até ser registrada
  React.useEffect(() => {
    if (modo === 'nova' && !jaTem) gravarRascunho(internacaoId, f)
  }, [f, modo, jaTem, internacaoId])

  const set = (p: Partial<FormEvolucao>) => setF((x) => ({ ...x, ...p }))
  const setSv = (k: keyof FormEvolucao['sv'], v: string) => setF((x) => ({ ...x, sv: { ...x.sv, [k]: v } }))
  const setEf = (k: keyof FormEvolucao['exame_fisico'], v: string) => setF((x) => ({ ...x, exame_fisico: { ...x.exame_fisico, [k]: v } }))

  const painel = alergiasQ.data
  const alergias = painel?.estado === 'tem'
    ? 'Alergias: ' + ativas(painel).map((a) => a.substancia).join(', ')
    : painel?.estado === 'nega' || negaVigente(painel) ? 'Nega alergias'
    : painel?.estado === 'desconhece' ? 'Alergia não informada (não soube)' : 'Alergias não registradas'
  const tomAlergia = painel?.estado === 'tem' ? 'critico' : painel?.estado === 'nega' ? 'conforme' : 'atencao'

  const avisos = avisosEvolucao(f)
  // LNNC do banco (notificacao_compulsoria_dos_cids): só sugere, o médico marca
  const lnnc = useNotificacaoCompulsoria(f.cid.codigo.trim() ? [f.cid.codigo.trim()] : [])
  const itemLnnc = lnnc.data?.itens[0]
  const notificavel = itemLnnc ? { nome: itemLnnc.agravo, imediata: itemLnnc.imediata } : null
  const sv = ctx.sv_enfermagem
  const editavel = ctx.pode_registrar && (modo !== 'nova' || !jaTem)
  const temTexto = (f.s + f.a + f.p).trim().length >= 10

  function trazerSv() {
    if (!sv) return
    setF((x) => ({
      ...x,
      sv: { ...x.sv, pa: sv.pa ?? x.sv.pa, fc: sv.fc ?? x.sv.fc, fr: sv.fr ?? x.sv.fr, temp: sv.temp ?? x.sv.temp, spo2: sv.spo2 ?? x.sv.spo2, glic: sv.glic ?? x.sv.glic },
      sv_condicao: sv.condicao ?? x.sv_condicao,
    }))
  }

  async function registrar() {
    setSalvando(true)
    setAviso(null)
    const estruturado = paraEstruturado(f, ctx, alergias)
    const { error } = modo === 'corrigir' && jaTem
      ? await supabase.rpc('corrigir_evolucao', {
          p_documento: jaTem.documento_id, p_conteudo: '', p_justificativa: justificativa, p_estruturado: estruturado,
        })
      : await supabase.rpc('registrar_evolucao', {
          p_internacao: internacaoId, p_tipo: 'evolucao', p_conteudo: '', p_estruturado: estruturado,
        })
    setSalvando(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    // o dia seguinte herda lista de problemas, antimicrobianos incluídos à mão e CID
    setF(herdarDaUltima(estruturado as DadosEstruturados))
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
    const { error } = await supabase.rpc('marcar_agravo', { p_paciente: pacienteId, p_agravo: notificavel.nome, p_cid: f.cid.codigo.trim() })
    setAviso(error ? { erro: true, texto: error.message } : { erro: false, texto: 'Agravo marcado como suspeito: a notificação aparece em Exames e agravos e impede a alta até ser registrada ou descartada.' })
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
      {ctx.ativa && !ctx.pode_registrar && (
        <p className="rounded-controle border border-fio bg-campo px-3 py-2 text-apoio text-tinta-apoio">
          A evolução médica é registrada pelo médico de plantão no setor do paciente. Você lê as evoluções no histórico.
        </p>
      )}

      {jaTem && ctx.pode_registrar && modo === 'nova' && (
        <div className="flex flex-col gap-2 rounded-bloco border border-marca/30 bg-marca/[0.06] px-3.5 py-3">
          <span className="flex items-center gap-2 text-controle text-tinta">
            <ClipboardCheck className="size-4 text-acao" aria-hidden />
            Sua evolução de hoje foi registrada às {diaHora(jaTem.criado_em).split(' · ')[1]}{jaTem.versao > 1 ? ` (corrigida, versão ${jaTem.versao})` : ''}.
          </span>
          <span className="text-apoio text-tinta-apoio">
            Para mudar o que escreveu, corrija: vira nova versão, com justificativa. Para um fato novo do dia (febre, resultado, conduta), registre um complemento.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!jaTem.estruturada}
              onClick={() => { setF(deEstruturado(jaTem.dados)); setModo('corrigir'); setAviso(null) }}>
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

          <CampoTexto id="evol-problemas" rotulo="Diagnósticos / lista de problemas" dica="(um por linha)" valor={f.problemas}
            onValor={(v) => set({ problemas: v })} placeholder={'Pneumonia adquirida na comunidade (J18.9)\nHipertensão arterial sistêmica'} />

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
                  <button type="button" aria-label={`Remover ${a.nome}`} className="p-0.5 text-tinta-sussurro hover:text-critico"
                    onClick={() => set({ antimicrobianosManuais: f.antimicrobianosManuais.filter((_, j) => j !== i) })}>
                    <X className="size-3.5" aria-hidden />
                  </button>
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

          <CampoTexto id="evol-s" rotulo="S · Subjetivo" valor={f.s} onValor={(v) => set({ s: v })}
            placeholder="Queixas, sono, aceitação da dieta, relato das últimas 24 h" />

          <div className="flex flex-col gap-2.5 border-t border-trilha pt-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-controle font-semibold text-tinta">O · Objetivo</span>
              {sv && (
                <Button variant="outline" size="sm" className="ml-auto" onClick={trazerSv}>
                  <Stethoscope /> Trazer SV da enfermagem · {diaHora(sv.aferido_em)}{sv.por ? ` · ${sv.por}` : ''}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {CAMPOS_SV.map((c) => (
                <label key={c.k} className={`flex min-w-0 flex-col gap-1 ${c.unidade ? 'flex-[1_1_90px]' : 'flex-[1_1_180px]'}`}>
                  <span className="text-rotulo font-medium text-grafite">{c.rotulo}{c.unidade ? ` (${c.unidade})` : ''}</span>
                  <Input value={f.sv[c.k]} onChange={(e) => setSv(c.k, e.target.value)} inputMode={c.unidade ? 'decimal' : undefined} />
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
            <div className="flex flex-col gap-2">
              {CAMPOS_EF.map((c) => (
                <div key={c.k} className="flex flex-wrap items-start gap-2.5">
                  <label htmlFor={`evol-ef-${c.k}`} className="flex-[0_0_96px] pt-2 text-apoio font-medium text-grafite">{c.rotulo}</label>
                  <Textarea id={`evol-ef-${c.k}`} rows={1} className="min-h-0 w-auto flex-[1_1_240px] leading-[1.5]"
                    value={f.exame_fisico[c.k]} onChange={(e) => setEf(c.k, e.target.value)} />
                </div>
              ))}
            </div>
            <CampoTexto id="evol-outros" rotulo="Outros achados" linhas={1} valor={f.outros_achados} onValor={(v) => set({ outros_achados: v })} />
            <CampoTexto id="evol-exames" rotulo="Exames complementares" valor={f.exames} onValor={(v) => set({ exames: v })} placeholder="Resultados do dia, com data" />
          </div>

          <CampoTexto id="evol-a" rotulo="A · Avaliação / impressão" valor={f.a} onValor={(v) => set({ a: v })}
            placeholder="Evolução do quadro e hipóteses, com achados objetivos" />
          <CampoTexto id="evol-p" rotulo="P · Conduta / plano" valor={f.p} onValor={(v) => set({ p: v })}
            placeholder="Condutas, metas e critérios de alta" />

          {avisos.length > 0 && (
            <div className="flex flex-col gap-1 rounded-controle border border-nota bg-alerta-atencao px-3 py-2.5">
              {avisos.map((a) => <span key={a} className="text-apoio leading-[1.45] text-atencao">{a}</span>)}
            </div>
          )}

          <CampoCid valor={f.cid} onValor={(cid) => set({ cid })} />

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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-trilha pt-3">
            {modo === 'corrigir' && <Button variant="ghost" onClick={() => { setModo('nova'); setF(herdarDaUltima(ctx.ultima_estruturada?.dados)) }}>Cancelar</Button>}
            {modo === 'nova' && (
              <Button variant="ghost" onClick={() => setF(herdarDaUltima(ctx.ultima_estruturada?.dados))}>Limpar o dia</Button>
            )}
            <Button onClick={() => void registrar()} disabled={salvando || !temTexto || (modo === 'corrigir' && justificativa.trim().length < 10)}>
              {salvando && <Spinner />} {modo === 'corrigir' ? 'Salvar correção' : 'Registrar evolução do dia'}
            </Button>
          </div>
        </fieldset>
      )}
    </Bloco>
  )
}

function diaDeUso(inicio: string, hoje: string): string {
  const a = Date.parse(`${inicio}T12:00:00Z`), b = Date.parse(`${hoje}T12:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return '?'
  const n = Math.round((b - a) / 86_400_000) + 1
  return n >= 1 ? String(n) : '?'
}

/** CID-10 principal com sugestões da terminologia e o estado (hipótese × confirmado). */
function CampoCid({ valor, onValor }: { valor: FormEvolucao['cid']; onValor: (v: FormEvolucao['cid']) => void }) {
  const texto = valor.codigo ? `${valor.codigo}${valor.descricao ? ' — ' + valor.descricao : ''}` : ''
  const [termo, setTermo] = React.useState(texto)
  const [aberto, setAberto] = React.useState(false)
  const busca = useTerminologia('cid10', aberto ? termo : '', 8)
  const sugestoes = aberto ? busca.data ?? [] : []
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative flex flex-[1_1_220px] flex-col gap-[5px]">
        <label htmlFor="evol-cid" className="text-apoio font-medium text-grafite">Diagnóstico principal · CID-10</label>
        <Input id="evol-cid" value={termo} placeholder="Ex.: J44.1 — DPOC com exacerbação aguda" autoComplete="off"
          onChange={(e) => {
            const t = e.target.value
            setTermo(t)
            setAberto(true)
            const m = /^\s*([A-Za-z]\d{2}(?:\.\d{1,2})?)\s*(?:[—-]\s*(.*))?$/.exec(t)
            onValor({ ...valor, codigo: m ? m[1].toUpperCase() : t.trim(), descricao: m?.[2]?.trim() ?? '' })
          }}
          onBlur={() => setTimeout(() => setAberto(false), 150)} />
        {sugestoes.length > 0 && (
          <div role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[280px] overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
            {sugestoes.map((s) => (
              <button key={s.codigo} type="button" role="option" aria-selected={false}
                className="flex w-full items-baseline gap-2.5 border-b border-trilha px-3 py-2 text-left hover:bg-campo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onValor({ ...valor, codigo: s.codigo, descricao: s.descricao }); setTermo(`${s.codigo} — ${s.descricao}`); setAberto(false) }}>
                <span className="text-controle text-tinta">{s.codigo} — {s.descricao}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <ChipEscolha ativo={valor.estado === 'hipotese'} onClick={() => onValor({ ...valor, estado: 'hipotese' })}>Hipótese</ChipEscolha>
        <ChipEscolha ativo={valor.estado === 'confirmado'} onClick={() => onValor({ ...valor, estado: 'confirmado' })}>Confirmado</ChipEscolha>
      </div>
    </div>
  )
}
