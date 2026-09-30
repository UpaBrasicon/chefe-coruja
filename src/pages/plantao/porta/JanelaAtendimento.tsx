// Janela do atendimento do Pronto-Socorro (protótipo, modal "atd"): cabeçalho
// do paciente, "em atendimento há X min", "Prontuário completo", abas e o
// rodapé "Salvar e fechar" / "Aguardar reavaliação" / "Finalizar atendimento".
// Abrir a janela = iniciar o atendimento no servidor (marca médico e hora e
// abre o prontuário, consulta registrada). Tudo o que grava é do servidor;
// a tela só mostra e pede. Nada sugere dose, cor ou conduta.
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Clock, FileText, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { rotulosPrioridade } from '@/domain/prioridade'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CabecalhoPaciente } from '@/components/paciente/CabecalhoPaciente'
import { AlergiasEventos } from '@/components/paciente/AlergiasEventos'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { AbaParecer } from '@/components/parecer/AbaParecer'
import { AbaAvaliacaoCrescimento } from '@/components/avaliacao/AbaAvaliacaoCrescimento'
import { AbaEncaminhamentoInterno } from '@/components/encaminhamento/AbaEncaminhamentoInterno'
import { AbaTermoConsentimento } from '@/components/termo/AbaTermoConsentimento'

import { AbaAtendimento, type Classificacao, type RegistroSoap } from './AbaAtendimento'
import { AbaAtestadoReceita } from './AbaAtestadoReceita'
import { AbaDesfecho } from './AbaDesfecho'
import { AbaExames } from './AbaExames'
import { AbaPrescricao } from './AbaPrescricao'
import { AbaReavaliacao } from './AbaReavaliacao'
import {
  DOCS_INICIAL, SOAP_VAZIO, hora, minutos, msg, nomeDe, soapVazio, useAgora, usePainelPS, useRecarregarAtendimento,
  type EpFila, type EstadoDocs, type Soap,
} from './comum'

type Aba = 'atend' | 'presc' | 'exames' | 'reav' | 'alg' | 'par' | 'aval' | 'enc' | 'termo' | 'docs' | 'fim'
const ESPERA_RASCUNHO_MS = 1500

export function JanelaAtendimento({ ep, onFechar }: { ep: EpFila; onFechar: (aviso?: string) => void }) {
  const agora = useAgora(30_000)
  const nome = nomeDe(ep)
  const recarregar = useRecarregarAtendimento(ep.id, ep.paciente_id)

  // abrir o atendimento = marcar médico e hora + abrir o prontuário (servidor)
  const abrir = useQuery({
    queryKey: ['iniciar-atendimento', ep.id],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.rpc('iniciar_atendimento', { p_episodio: ep.id })
      if (error) throw error
      return true
    },
  })
  const aberto = abrir.isSuccess

  const dados = useQuery({
    queryKey: ['atendimento', ep.id],
    enabled: aberto,
    queryFn: async () => {
      const [c, s, e] = await Promise.all([
        supabase.rpc('classificacoes_do_episodio', { p_episodio: ep.id }),
        supabase.from('atendimento_registros').select('id, subjetivo, objetivo, avaliacao, cid, plano, criado_em').eq('episodio_id', ep.id).order('criado_em'),
        supabase.from('episodios').select('atendimento_iniciado_em, reavaliar_em, etapa').eq('id', ep.id).maybeSingle(),
      ])
      for (const r of [c, s, e]) if (r.error) throw r.error
      return {
        classificacoes: ((c.data ?? []) as unknown as Classificacao[]).slice().reverse(), // da mais antiga para a mais nova
        registros: (s.data ?? []) as RegistroSoap[],
        episodio: e.data,
      }
    },
  })
  const painel = usePainelPS(ep.id, aberto)
  const alergias = useAlergias(ep.paciente_id)

  const [aba, setAba] = React.useState<Aba>(ep.reavaliar_em ? 'reav' : 'atend')
  const [erro, setErro] = React.useState<string | null>(null)
  const [reavHora, setReavHora] = React.useState('')
  const [docs, setDocs] = React.useState<EstadoDocs>(DOCS_INICIAL)

  // ── SOAP em rascunho contínuo (servidor) ────────────────────────────────────
  // Enquanto o médico não digita, vale o rascunho que está no servidor (volta
  // ao reabrir a janela); depois da primeira tecla, vale o que está na tela.
  const [soapLocal, setSoapLocal] = React.useState<Soap | null>(null)
  const doServidor = painel.data?.rascunho
  const soap: Soap = soapLocal ?? (doServidor
    ? { ...SOAP_VAZIO, ...Object.fromEntries(Object.entries(doServidor).map(([k, v]) => [k, String(v ?? '')])) } as Soap
    : SOAP_VAZIO)
  const [salvoEm, setSalvoEm] = React.useState<Date | null>(null)
  const enviado = React.useRef<string | null>(null)
  const salvarRascunho = React.useCallback(async (x: Soap) => {
    const texto = JSON.stringify(x)
    if (texto === enviado.current) return
    const { error } = await supabase.rpc('salvar_rascunho_atendimento', { p_episodio: ep.id, p_conteudo: x })
    if (error) return // sem conexão: o texto continua na tela; tenta de novo na próxima mudança
    enviado.current = texto
    setSalvoEm(new Date())
  }, [ep.id])
  React.useEffect(() => {
    if (!soapLocal) return // nada digitado nesta janela: nada a salvar
    const t = window.setTimeout(() => void salvarRascunho(soapLocal), ESPERA_RASCUNHO_MS)
    return () => window.clearTimeout(t)
  }, [soapLocal, salvarRascunho])
  const setSoap = (x: Soap) => { setSoapLocal(x); setErro(null) }

  const aoRegistrarSoap = () => {
    enviado.current = JSON.stringify(SOAP_VAZIO) // o servidor apagou o rascunho ao registrar
    setSoapLocal(SOAP_VAZIO)
    recarregar()
  }

  // ── rodapé ──────────────────────────────────────────────────────────────────
  const aguardar = useMutation({
    mutationFn: async () => {
      const [h, m] = reavHora.split(':').map(Number)
      const alvo = new Date()
      alvo.setHours(h, m, 0, 0)
      if (alvo.getTime() < Date.now() - 5 * 60_000) alvo.setDate(alvo.getDate() + 1) // "às 01:00" depois da meia-noite
      if (soapLocal) await salvarRascunho(soapLocal)
      const { error } = await supabase.rpc('aguardar_reavaliacao', { p_episodio: ep.id, p_reavaliar_em: alvo.toISOString() })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); onFechar(`${nome} aguarda reavaliação às ${reavHora}.`) },
    onError: (e) => setErro(msg(e)),
  })
  function clicarAguardar() {
    const pend = painel.data?.pendencias ?? []
    if (!pend.length) {
      setErro('Nada pendente para reavaliar. Peça exame ou prescreva medicação antes.')
      setAba(painel.data?.prescricao.length ? 'exames' : 'presc')
      return
    }
    if (!reavHora) {
      setErro('Informe a hora prevista da reavaliação.')
      setAba('reav')
      return
    }
    setErro(null)
    aguardar.mutate()
  }
  async function salvarEFechar() {
    if (soapLocal) await salvarRascunho(soapLocal)
    onFechar()
  }

  const cls = dados.data?.classificacoes ?? []
  const registros = dados.data?.registros ?? []
  const ultimaCor = cls.at(-1)?.cor ?? ep.cor_atual
  // a queixa revista pelo enfermeiro na triagem vale mais que a da recepção
  const queixa = [...cls].reverse().find((c) => c.queixa?.trim())?.queixa ?? ep.queixa
  const iniciado = dados.data?.episodio?.atendimento_iniciado_em ?? ep.atendimento_iniciado_em
  const pediatrico = ep.publico === 'pediatrico'
  const p = painel.data
  const cidAtend = soap.cid.trim() || [...registros].reverse().find((r) => r.cid)?.cid || ''

  const abas: { k: Aba; rotulo: string; n?: React.ReactNode }[] = [
    { k: 'atend', rotulo: 'Atendimento', n: registros.some((r) => r.avaliacao?.trim()) ? <Check className="size-3" aria-label="com hipótese" /> : undefined },
    { k: 'presc', rotulo: 'Prescrição', n: p?.prescricao.filter((i) => !i.suspenso_em).length || undefined },
    { k: 'exames', rotulo: 'Exames', n: p?.exames.filter((x) => x.situacao !== 'cancelado').length || undefined },
    { k: 'reav', rotulo: 'Reavaliação', n: p?.reavaliacoes.filter((r) => r.tipo === 'reavaliacao').length || undefined },
    { k: 'alg', rotulo: 'Alergias', n: ativas(alergias.data).length || undefined },
    { k: 'par', rotulo: 'Parecer' },
    { k: 'aval', rotulo: 'Avaliação' },
    { k: 'enc', rotulo: 'Encaminhar' },
    { k: 'termo', rotulo: 'Termo' },
    { k: 'docs', rotulo: 'Atestado e receita', n: ((docs.atEmitidoEm ? 1 : 0) + (docs.rxEmitidaEm ? 1 : 0)) || undefined },
    { k: 'fim', rotulo: 'Desfecho' },
  ]

  return (
    <div className="flex flex-col overflow-hidden rounded-cartao border border-fio bg-campo shadow-dialogo">
      {/* cabeçalho */}
      <div className="flex flex-col gap-3 border-b border-fio bg-superficie px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-apoio text-tinta-sussurro">
            {ep.prioridades_legais.length > 0 ? `Prioridade: ${rotulosPrioridade(ep.prioridades_legais).join(', ')}` : 'Atendimento do Pronto Socorro'}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {iniciado && (
              <span className="inline-flex items-center gap-1.5 rounded-capsula bg-alerta-marca px-3 py-1 text-apoio font-medium text-acao tabular-nums">
                <Clock className="size-3.5" aria-hidden /> Em atendimento há {minutos(iniciado, agora)}
              </span>
            )}
            <Button size="sm" variant="outline" render={<Link to={`/prontuarios/${ep.paciente_id}`} />}><FileText /> Prontuário completo</Button>
            <Button size="icon-sm" variant="outline" aria-label="Fechar e salvar" title="Fechar (o rascunho fica salvo)" onClick={() => void salvarEFechar()}><X /></Button>
          </span>
        </div>
        {/* D4: cabeçalho único (nome, idade, sexo, setor, alergia em três estados,
            cor, acuidade). D5: atendimento anterior só depois de abrir o prontuário. */}
        <CabecalhoPaciente
          pacienteId={ep.paciente_id}
          nome={nome}
          setorId={ep.setor_id}
          desde={ep.chegada_em}
          rotuloDesde="na porta há"
          contexto={<>{pediatrico && 'pediatria · '}chegou {hora(ep.chegada_em)} · Queixa: {queixa}</>}
          corClassificacao={ultimaCor}
          onClassificacao={() => { setAba('atend'); window.setTimeout(() => document.getElementById(`triagem-${ep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}
          acuidade={aberto}
          episodios={aberto}
          episodioAtualId={ep.id}
          className="border-0 p-0 shadow-none"
        />
        {pediatrico && (
          <div className="flex items-start gap-2 rounded-container border border-pediatria/25 bg-pediatria/[0.06] px-3.5 py-2.5 text-apoio text-pediatria">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Paciente pediátrico (0 a 14 anos). A dose é digitada por você, pelo peso aferido. O sistema não sugere nem converte dose de adulto.</span>
          </div>
        )}
        <Tabs value={aba} onValueChange={(v) => { setAba(v as Aba); setErro(null) }}>
          <TabsList aria-label="Partes do atendimento" className="gap-4">
            {abas.map((a) => (
              <TabsTrigger key={a.k} value={a.k} disabled={!aberto && a.k !== 'atend'}>
                {a.rotulo}
                {a.n !== undefined && <span className="inline-flex items-center rounded-capsula bg-alerta-marca px-[7px] py-px text-rotulo font-semibold text-acao">{a.n}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* conteúdo da aba */}
      <div className="flex flex-col gap-4 px-5 py-5">
        {abrir.isPending && <Spinner />}
        {abrir.error && <p className="text-apoio text-critico">{msg(abrir.error)}</p>}
        {dados.error && <p className="text-apoio text-critico">{msg(dados.error)}</p>}
        {painel.error && <p className="text-apoio text-critico">{msg(painel.error)}</p>}
        {aberto && dados.data && (
          <Tabs value={aba}>
            <TabsContent value="atend">
              <AbaAtendimento episodioId={ep.id} pacienteId={ep.paciente_id} publico={ep.publico} corAtual={ultimaCor}
                soap={soap} setSoap={setSoap} salvoEm={salvoEm} classificacoes={cls} registros={registros} aoRegistrar={aoRegistrarSoap} />
            </TabsContent>
            <TabsContent value="presc">
              {p && <AbaPrescricao pacienteId={ep.paciente_id} nome={nome} itens={p.prescricao} pediatrico={pediatrico} aoMudar={recarregar} />}
            </TabsContent>
            <TabsContent value="exames">
              {p && <AbaExames episodioId={ep.id} pacienteId={ep.paciente_id} exames={p.exames} aoMudar={recarregar} />}
            </TabsContent>
            <TabsContent value="reav">
              {p && <AbaReavaliacao episodioId={ep.id} painel={p} reavHora={reavHora} setReavHora={setReavHora} aoMudar={recarregar} />}
            </TabsContent>
            <TabsContent value="alg"><AlergiasEventos pacienteId={ep.paciente_id} /></TabsContent>
            <TabsContent value="par"><AbaParecer pacienteId={ep.paciente_id} episodioId={ep.id} /></TabsContent>
            <TabsContent value="aval"><AbaAvaliacaoCrescimento pacienteId={ep.paciente_id} episodioId={ep.id} /></TabsContent>
            <TabsContent value="enc"><AbaEncaminhamentoInterno pacienteId={ep.paciente_id} episodioId={ep.id} /></TabsContent>
            <TabsContent value="termo"><AbaTermoConsentimento pacienteId={ep.paciente_id} episodioId={ep.id} /></TabsContent>
            <TabsContent value="docs">
              <AbaAtestadoReceita episodioId={ep.id} pacienteId={ep.paciente_id} nome={nome} nascimento={ep.paciente?.data_nascimento ?? null}
                cid={cidAtend} estado={docs} setEstado={setDocs} />
            </TabsContent>
            <TabsContent value="fim">
              {p && <AbaDesfecho episodioId={ep.id} nome={nome} chegadaEm={ep.chegada_em} painel={p} registros={registros}
                soap={soap} agora={agora} onConfirmado={(aviso) => { recarregar(); onFechar(aviso) }} />}
            </TabsContent>
          </Tabs>
        )}
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {erro}
          </p>
        )}
      </div>

      {/* rodapé */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-fio bg-superficie px-5 py-3">
        <span className="mr-auto text-rotulo text-tinta-sussurro">
          {soapVazio(soap) ? 'Rascunho salvo ao digitar' : salvoEm ? `Rascunho salvo às ${hora(salvoEm.toISOString())}` : 'Rascunho salvo ao digitar'}
        </span>
        <Button variant="ghost" onClick={() => void salvarEFechar()}>Salvar e fechar</Button>
        <Button variant="outline" disabled={!aberto || aguardar.isPending} onClick={clicarAguardar}><Clock /> Aguardar reavaliação</Button>
        <Button disabled={!aberto} onClick={() => { setErro(null); setAba('fim') }}><Check /> Finalizar atendimento</Button>
      </div>
    </div>
  )
}
