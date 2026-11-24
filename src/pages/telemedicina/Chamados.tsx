// Chamados: a tela inicial do perfil Telemedicina (revisão do perfil, RT em
// 24/11/2026). TM1/CH1: um lugar só para o chamado, com abas por etapa e a
// contagem de cada uma (Esperando aceite · Em atendimento · Parecer por
// escrever · Falta assinar); a antiga "Minha fila", as Salas em andamento e as
// Assinaturas pendentes moram aqui. CH2: um selo só de situação no topo.
// SA1–SA3: a sala do chamado lado a lado (o chamado e o resumo do prontuário à
// esquerda, o parecer à direita), com o prontuário completo numa gaveta, sem
// sair da sala, e o parecer em três campos curtos que viram um texto só para o
// mesmo responder_teleinterconsulta (sem migration). A conduta é de quem está
// com o paciente (Res. CFM 2.314/2022, art. 7º).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { juntarParecer, MINIMO_PARECER, PARECER_VAZIO, parecerPronto, tamanhoParecer, type CamposParecer } from '@/lib/telemedicinaPerfil'
import { cn } from '@/lib/utils'

import { BotaoCheckinTele, ha, hhmm, Nota, semPlantaoTele, SituacaoTele, useTeles, VazioLinha, type Tele } from './comum'
import { localDoPaciente, useResumoPaciente } from './resumoPaciente'
import { ResumoPacienteTele } from './ResumoPacienteTele'

const ProntuarioLeitura = React.lazy(() => import('@/pages/prontuario/ProntuarioLeitura'))

const ABAS = ['espera', 'atendimento', 'parecer', 'assinar'] as const
type Aba = (typeof ABAS)[number]

const CONSENTIMENTO: Record<string, string> = {
  obtido: 'O paciente consentiu',
  representante_legal: 'O representante legal consentiu',
  emergencia_sem_condicao: 'Emergência, sem condição de consentir (art. 15)',
}

type Pendencias = {
  sem_parecer: { teleinterconsulta_id: string; aceita_em: string; urgencia: string; paciente: string; unidade: string; setor: string | null; solicitante: string }[]
  sem_assinatura: { teleinterconsulta_id: string; documento_id: string; numero: string; emitido_em: string; paciente: string; unidade: string; setor: string | null; solicitante: string }[]
}

function Erro({ e }: { e: unknown }) {
  return e ? <p role="alert" className="text-apoio text-critico">{(e as Error).message}</p> : null
}

/** Linha de lista: o que é, de quem, há quanto tempo; a ação à direita. */
function Linha({ titulo, detalhe, urgente, acao, children }: {
  titulo: React.ReactNode; detalhe: React.ReactNode; urgente?: boolean; acao?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-trilha px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-corpo font-medium text-tinta">
            {titulo}
            {urgente && <span className="ml-2 text-apoio font-semibold text-critico">Urgente</span>}
          </span>
          <span className="text-apoio text-tinta-sussurro">{detalhe}</span>
        </div>
        {acao}
      </div>
      {children}
    </li>
  )
}

const Lista = ({ children }: { children: React.ReactNode }) => (
  <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie empty:hidden">{children}</ul>
)

/** Aviso no topo só quando falta a inscrição (TM2): as credenciais moram no menu do usuário. */
function AvisoInscricao() {
  const { perfil } = useAuth()
  if (!perfil || perfil.crm) return null
  return (
    <Aviso tom="atencao" className="mb-4" titulo="Falta a sua inscrição no CRM"
      acao={<Button size="sm" variant="outline" nativeButton={false} render={<Link to="/telemedicina/credenciais" />}>Ver credenciais</Button>}>
      Ela vai em todo parecer. Peça à coordenação para completar o seu cadastro.
    </Aviso>
  )
}

export default function Chamados({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [params, setParams] = useSearchParams()
  const teles = useTeles(unidadeId)
  const semCheckin = semPlantaoTele(teles.error)
  // os rascunhos do parecer ficam aqui: trocar de aba ou abrir o prontuário não apaga o texto
  const [rascunhos, setRascunhos] = React.useState<Record<string, CamposParecer>>({})
  const [enviado, setEnviado] = React.useState<string | null>(null)

  const outras = useQuery({
    queryKey: ['tele-outras', unidadeId],
    refetchInterval: 30_000,
    retry: (n, e) => !semPlantaoTele(e) && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_outras_em_atendimento', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const pendencias = useQuery({
    queryKey: ['tele-pendencias'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tele_pendencias')
      if (error) throw error
      return data as unknown as Pendencias
    },
  })
  const aceitar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('aceitar_teleinterconsulta', { p_id: id })
      if (error) throw error
      return id
    },
    onSuccess: async (id) => {
      for (const k of ['situacao-tele', 'tele-pendencias', 'nota-tele']) void qc.invalidateQueries({ queryKey: [k] })
      // a sala abre com a lista já atualizada
      await qc.invalidateQueries({ queryKey: ['teleinterconsultas'] })
      abrirSala(id)
    },
  })

  const lista = teles.data ?? []
  // "minha" vale para quem pediu e para quem aceitou; quem também é Médico pode ter pedido pelo perfil Médico
  const eu = perfil?.nome_completo ?? null
  const abertas = lista.filter((t) => t.status === 'aberta' && !(t.minha && t.solicitante_nome === eu))
  const minhas = lista.filter((t) => t.minha && t.status === 'em_atendimento' && !!t.aceita_em && t.consultor_nome === eu)
  const idsMinhas = new Set(minhas.map((t) => t.id))
  // Parecer por escrever: os meus aceitos sem parecer que não estão abertos nesta unidade (outra unidade ou outro dia)
  const atrasados = (pendencias.data?.sem_parecer ?? []).filter((p) => !idsMinhas.has(p.teleinterconsulta_id))
  const semAssinatura = pendencias.data?.sem_assinatura ?? []

  const daUrl = params.get('aba') as Aba | null
  const aba: Aba = daUrl && ABAS.includes(daUrl) ? daUrl : minhas.length > 0 && abertas.length === 0 ? 'atendimento' : 'espera'
  const salaId = params.get('sala')
  const sala = salaId ? minhas.find((t) => t.id === salaId) ?? null : null

  function trocarAba(v: string) {
    const p = new URLSearchParams(params)
    p.set('aba', v); p.delete('sala')
    setParams(p, { replace: true })
  }
  function abrirSala(id: string) {
    setEnviado(null)
    const p = new URLSearchParams(params)
    p.set('aba', 'atendimento'); p.set('sala', id)
    setParams(p)
  }
  function fecharSala() {
    const p = new URLSearchParams(params)
    p.delete('sala')
    setParams(p)
  }

  if (salaId) {
    if (teles.isLoading) return <Spinner />
    if (!sala) {
      return (
        <div className="flex w-full max-w-3xl flex-col gap-3">
          <Trilha niveis={[{ rotulo: 'Chamados', to: '/teleinterconsulta?aba=atendimento' }, { rotulo: 'Sala' }]} />
          <VazioLinha>Esta sala não está aberta para você nesta unidade. O parecer pode já ter sido enviado, ou o chamado é de outra unidade.</VazioLinha>
          <Button variant="outline" className="w-fit" onClick={fecharSala}>Voltar aos chamados</Button>
        </div>
      )
    }
    return (
      <Sala key={sala.id} t={sala} campos={rascunhos[sala.id] ?? PARECER_VAZIO}
        onCampos={(c) => setRascunhos((r) => ({ ...r, [sala.id]: c }))}
        onVoltar={fecharSala}
        onEnviado={() => {
          setRascunhos((r) => { const n = { ...r }; delete n[sala.id]; return n })
          setEnviado(`Parecer de ${sala.paciente_nome} enviado. Entrou no prontuário como documento numerado e chegou a ${sala.solicitante_nome}.`)
          fecharSala()
        }} />
    )
  }

  const contagem: Record<Aba, number | undefined> = {
    espera: semCheckin ? undefined : abertas.length,
    atendimento: minhas.length,
    parecer: pendencias.data ? atrasados.length : undefined,
    assinar: pendencias.data ? semAssinatura.length : undefined,
  }
  const ROTULO: Record<Aba, string> = { espera: 'Esperando aceite', atendimento: 'Em atendimento', parecer: 'Parecer por escrever', assinar: 'Falta assinar' }

  return (
    <div className="flex w-full max-w-4xl flex-col">
      <TituloPagina titulo="Chamados" descricao="Teleinterconsultas da unidade, do pedido ao parecer. A conduta é de quem está com o paciente." />
      <AvisoInscricao />
      <div className="mb-4"><SituacaoTele unidadeId={unidadeId} /></div>
      {enviado && <Aviso tom="conforme" className="mb-4">{enviado}</Aviso>}
      <Tabs value={aba} onValueChange={(v) => trocarAba(String(v))}>
        <TabsList variant="line" className="w-full overflow-x-auto">
          {ABAS.map((a) => (
            <TabsTrigger key={a} value={a}>
              {ROTULO[a]}
              {contagem[a] !== undefined && <span className="tabular-nums text-tinta-sussurro">{contagem[a]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="espera" className="flex flex-col gap-3">
          {semCheckin ? (
            <div className="flex flex-wrap items-center gap-3 rounded-cartao border border-dashed border-fio px-4 py-4">
              <span className="flex-1 text-apoio text-tinta">Faça o check-in para ver e aceitar chamados.</span>
              <BotaoCheckinTele unidadeId={unidadeId} />
            </div>
          ) : teles.error ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-apoio text-critico">Não foi possível carregar os chamados.</span>
              <Button size="sm" variant="outline" onClick={() => void teles.refetch()}>Tentar de novo</Button>
            </div>
          ) : teles.isLoading ? <Spinner /> : abertas.length === 0 ? (
            <VazioLinha>Nenhum chamado esperando. Os urgentes aparecem primeiro, depois os mais antigos.</VazioLinha>
          ) : (
            <Lista>
              {abertas.map((t) => (
                <Linha key={t.id} urgente={t.urgencia === 'urgente'}
                  titulo={<>{t.paciente_nome}{t.setor_nome && <span className="font-normal text-tinta-sussurro"> · {t.setor_nome}</span>}</>}
                  detalhe={`Pedido de ${t.solicitante_nome} · esperando ${ha(t.criada_em).replace('há ', '')}`}
                  acao={<Button size="sm" onClick={() => aceitar.mutate(t.id)} disabled={aceitar.isPending}>Aceitar e abrir a sala</Button>}>
                  <p className="line-clamp-3 text-apoio text-tinta-apoio">{t.pergunta}</p>
                </Linha>
              ))}
            </Lista>
          )}
          <Erro e={aceitar.error} />
          <Nota icone={<Lock />}>O prontuário abre depois do aceite e fica para leitura até 24 h depois do parecer. Cada abertura vai para a trilha de auditoria.</Nota>
        </TabsContent>

        <TabsContent value="atendimento" className="flex flex-col gap-4">
          {semCheckin && minhas.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-cartao border border-dashed border-fio px-4 py-4">
              <span className="flex-1 text-apoio text-tinta">Faça o check-in para ver as salas desta unidade.</span>
              <BotaoCheckinTele unidadeId={unidadeId} variante="outline" />
            </div>
          ) : teles.isLoading ? <Spinner /> : minhas.length === 0 ? (
            <VazioLinha>Nenhuma sala sua aberta. Aceite um chamado em Esperando aceite.</VazioLinha>
          ) : (
            <Lista>
              {minhas.map((t) => (
                <Linha key={t.id} urgente={t.urgencia === 'urgente'}
                  titulo={<>{t.paciente_nome}{t.setor_nome && <span className="font-normal text-tinta-sussurro"> · {t.setor_nome}</span>}</>}
                  detalhe={`Aceito às ${hhmm(t.aceita_em)} (${ha(t.aceita_em)})${rascunhos[t.id] && tamanhoParecer(rascunhos[t.id]) > 0 ? ' · parecer começado' : ''}`}
                  acao={<Button size="sm" onClick={() => abrirSala(t.id)}>Abrir a sala</Button>} />
              ))}
            </Lista>
          )}
          {!semCheckin && (outras.data?.length ?? 0) > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-apoio font-semibold text-tinta">Salas de outros teleconsultores</h2>
              <Lista>
                {(outras.data ?? []).map((o) => (
                  <Linha key={o.id} urgente={o.urgencia === 'urgente'} titulo={o.setor ?? 'Setor não informado'}
                    detalhe={`${o.consultor} · desde ${hhmm(o.aceita_em)}`} />
                ))}
              </Lista>
              <p className="text-apoio text-tinta-sussurro">O paciente dessas salas não aparece: só quem aceitou lê o prontuário.</p>
            </section>
          )}
        </TabsContent>

        <TabsContent value="parecer" className="flex flex-col gap-3">
          <Erro e={pendencias.error} />
          {pendencias.isLoading ? <Spinner /> : atrasados.length === 0 ? (
            <VazioLinha>Nenhum parecer pendente de outra unidade ou de outro dia. Os chamados aceitos aqui ficam em Em atendimento.</VazioLinha>
          ) : (
            <Lista>
              {atrasados.map((p) => (
                <Linha key={p.teleinterconsulta_id} urgente={p.urgencia === 'urgente'}
                  titulo={<>{p.paciente}<span className="font-normal text-tinta-sussurro"> · {p.setor ?? p.unidade}</span></>}
                  detalhe={`${p.unidade} · pedido de ${p.solicitante} · aceito em ${fmtDataHora(p.aceita_em)}`}
                  acao={<span className="text-apoio text-tinta-sussurro">Abra pela unidade {p.unidade}</span>} />
              ))}
            </Lista>
          )}
        </TabsContent>

        <TabsContent value="assinar" className="flex flex-col gap-3">
          <Erro e={pendencias.error} />
          {pendencias.isLoading ? <Spinner /> : semAssinatura.length === 0 ? (
            <VazioLinha>Nenhum parecer seu esperando assinatura.</VazioLinha>
          ) : (
            <Lista>
              {semAssinatura.map((p) => (
                <Linha key={p.documento_id}
                  titulo={<>Parecer nº {p.numero}<span className="font-normal text-tinta-sussurro"> · {p.paciente}</span></>}
                  detalhe={`${p.setor ?? p.unidade} · emitido em ${fmtDataHora(p.emitido_em)} · pedido de ${p.solicitante}`} />
              ))}
            </Lista>
          )}
          <Nota icone={<ShieldCheck />}>
            A assinatura ICP-Brasil (Res. CFM 2.314/2022, art. 13) ainda não tem provedor. Até lá o parecer vale pela emissão numerada no prontuário, com o seu CRM, e já chegou ao médico que pediu.
          </Nota>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── sala do chamado (SA1–SA3) ────────────────────────────────────────────────
function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-t border-trilha px-4 py-2 first:border-t-0">
      <dt className="text-apoio text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-apoio text-tinta">{children}</dd>
    </div>
  )
}

function Sala({ t, campos, onCampos, onVoltar, onEnviado }: {
  t: Tele; campos: CamposParecer; onCampos: (c: CamposParecer) => void; onVoltar: () => void; onEnviado: () => void
}) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [gaveta, setGaveta] = React.useState(false)
  const resumo = useResumoPaciente(t.paciente_id)
  const local = localDoPaciente(resumo.data)
  const termo = useQuery({
    queryKey: ['tele-termo', t.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('teleinterconsultas')
        .select('consentimento, consentimento_forma, representante, testemunha, justificativa_emergencia').eq('id', t.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const responder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('responder_teleinterconsulta', { p_id: t.id, p_resposta: juntarParecer(campos) })
      if (error) throw error
    },
    onSuccess: () => {
      for (const k of ['teleinterconsultas', 'situacao-tele', 'tele-pendencias', 'tele-historico']) void qc.invalidateQueries({ queryKey: [k] })
      onEnviado()
    },
  })
  const texto = juntarParecer(campos)
  const falta = MINIMO_PARECER - tamanhoParecer(campos)
  const crm = perfil?.crm ? `CRM ${perfil.crm}${perfil.uf_crm ? `/${perfil.uf_crm}` : ''}` : 'CRM não cadastrado'
  const forma = termo.data?.consentimento_forma === 'verbal_testemunha' ? `verbal, com testemunha${termo.data.testemunha ? ` (${termo.data.testemunha})` : ''}`
    : termo.data?.consentimento_forma === 'assinatura_papel' ? 'termo impresso assinado' : null
  const campo = (k: keyof CamposParecer) => ({ value: campos[k], onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onCampos({ ...campos, [k]: e.target.value }) })

  return (
    <div className="flex w-full max-w-6xl flex-col">
      <Trilha niveis={[{ rotulo: 'Chamados', to: '/teleinterconsulta?aba=atendimento' }, { rotulo: t.paciente_nome }]} />
      <TituloPagina titulo={t.paciente_nome}
        descricao={[
          t.urgencia === 'urgente' ? 'Urgente' : 'Rotina',
          `aceito às ${hhmm(t.aceita_em)}, ${ha(t.aceita_em)}`,
          t.paciente_nascimento ? `nasc. ${fmtData(t.paciente_nascimento)}` : null,
        ].filter(Boolean).join(' · ')}
        acoes={<>
          <Button variant="outline" onClick={() => setGaveta(true)}>Ler prontuário completo</Button>
          <Button variant="ghost" onClick={onVoltar}>Voltar aos chamados</Button>
        </>} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section aria-label="O chamado" className="flex flex-col gap-2">
            <h2 className="text-apoio font-semibold text-tinta">O chamado</h2>
            <p className="rounded-cartao border border-fio bg-superficie px-4 py-3 text-corpo whitespace-pre-wrap text-tinta">{t.pergunta}</p>
            <dl className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              <Dado rotulo="Pediu">{t.solicitante_nome}{t.documento_solicitacao_numero ? `, documento nº ${t.documento_solicitacao_numero}` : ''}</Dado>
              <Dado rotulo="Setor e leito">{[local.setor ?? t.setor_nome, local.leito].filter(Boolean).join(' · ') || 'Não informado'}</Dado>
              <Dado rotulo="Urgência"><span className={cn(t.urgencia === 'urgente' && 'font-semibold text-critico')}>{t.urgencia === 'urgente' ? 'Urgente' : 'Rotina'}</span></Dado>
              <Dado rotulo="Espera">{t.aceita_em ? `pedido às ${hhmm(t.criada_em)}, aceito às ${hhmm(t.aceita_em)}` : `pedido às ${hhmm(t.criada_em)}`}</Dado>
              <Dado rotulo="Consentimento">
                {CONSENTIMENTO[t.consentimento] ?? t.consentimento}
                {forma ? `, ${forma}` : ''}
                {termo.data?.representante ? ` · ${termo.data.representante}` : ''}
                {termo.data?.justificativa_emergencia ? ` · ${termo.data.justificativa_emergencia}` : ''}
              </Dado>
            </dl>
          </section>
          <section aria-label="Resumo do prontuário" className="flex flex-col gap-2">
            <h2 className="text-apoio font-semibold text-tinta">Resumo do prontuário</h2>
            <ResumoPacienteTele pacienteId={t.paciente_id} />
          </section>
        </div>

        <section aria-label="Parecer" className="flex flex-col gap-3 lg:sticky lg:top-4">
          <h2 className="text-apoio font-semibold text-tinta">Parecer</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="par-hip">Hipóteses</Label>
            <Textarea id="par-hip" rows={3} placeholder="O que você pensa que é" {...campo('hipoteses')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="par-sug">Sugestão</Label>
            <Textarea id="par-sug" rows={3} placeholder="O que sugere a quem está com o paciente" {...campo('sugestao')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="par-rea">Reavaliar se</Label>
            <Textarea id="par-rea" rows={2} placeholder="Em que condição chamar de novo" {...campo('reavaliar')} />
          </div>
          <div className="flex flex-col gap-1.5 rounded-cartao border border-fio bg-campo px-4 py-3">
            <span className="text-apoio font-semibold text-tinta">Assim entra no prontuário</span>
            {texto ? <p className="text-apoio whitespace-pre-wrap text-tinta">{texto}</p> : <p className="text-apoio text-tinta-sussurro">O texto aparece aqui enquanto você escreve</p>}
            <p className="text-apoio text-tinta-sussurro">Documento numerado · {perfil?.nome_completo ?? 'você'} · {crm}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => responder.mutate()} disabled={responder.isPending || !parecerPronto(campos)}>Enviar parecer</Button>
            {falta > 0 && <span className="text-apoio text-tinta-sussurro">Escreva mais {falta} {falta === 1 ? 'caractere' : 'caracteres'}</span>}
          </div>
          <Erro e={responder.error} />
          <p className="text-apoio text-tinta-sussurro">O parecer vai ao médico que pediu. A conduta continua sendo dele.</p>
        </section>
      </div>

      <Gaveta aberta={gaveta} onAbertaChange={setGaveta} rotulo={`Prontuário de ${t.paciente_nome}`} className="max-w-[1100px]">
        <GavetaCabeca sobre="Prontuário completo" titulo={t.paciente_nome} detalhe="Somente leitura. O parecer continua na sala." />
        <div className="px-4 py-4">
          <React.Suspense fallback={<Spinner />}>
            {gaveta && <ProntuarioLeitura pacienteId={t.paciente_id} naGaveta />}
          </React.Suspense>
        </div>
      </Gaveta>
    </div>
  )
}
