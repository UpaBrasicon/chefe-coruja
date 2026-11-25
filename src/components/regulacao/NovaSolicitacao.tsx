// ─────────────────────────────────────────────────────────────────────────────
// Nova solicitação de regulação (Fase 4, tarefa 1; campos do MIRA).
// Saiu da página Regulação (src/pages/regulacao/Regulacao.tsx) para servir
// também dentro do paciente (pedido do RT de 24/11/2026): na aba Regulação do
// caderno do leito, da janela da porta e do cartão da observação, o "Novo
// pedido" abre ali mesmo, com o paciente já escolhido, e volta à aba
// (NovoPedidoPaciente, abaixo).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, Paperclip, Send } from 'lucide-react'
import * as React from 'react'

import { ESPECIALIDADES } from '@/components/encaminhamento/useEncaminhamentos'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { AreaDeAnexo } from '@/components/ui/area-de-anexo'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { dataIso } from '@/lib/formato'
import {
  ANEXO_LIMITE_BYTES, ANEXO_TIPOS, CARATER, FORMULARIO_VAZIO, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, TIPOS,
  TIPOS_LEITO, TRANSPORTES, VULNERABILIDADES, caminhoAnexo, dadosParaEnvio, ehNeonato, erroArquivo, faltasFormulario,
  marcadoresPelaIdade,
  type Carater, type DestinoTipo, type Formulario, type Prioridade, type TipoSolicitacao, type Vulnerabilidade,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

import { useCriterios } from './useCriterios'

type Ref = { id: string; nome: string }
/** O que o formulário usa do regulacao_contexto: a central e as unidades da rede. */
export type ContextoSolicitacao = { central: Ref | null; pode_solicitar: boolean; sou_central: boolean; unidades_rede: Ref[] }
/** O que volta do envio: a página abre o pedido; a aba do paciente mostra o aviso. */
export type PedidoEnviado = { id: string; numero: number; duplicidade: boolean; anexos: number; falhas: string[] }

const hoje = () => dataIso()

export type Paciente = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null; prontuario: string | null }
type Vinculos = {
  tem_documento: boolean; nascimento: string | null
  episodio: { id: string; chegada_em: string; etapa: string } | null
  internacao: { id: string; admissao_em: string; leito: string | null } | null
  medicos: Ref[]
}

export function Campo({ id, rotulo, children, className }: { id?: string; rotulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {id ? <Label htmlFor={id} className="text-rotulo">{rotulo}</Label> : <span className="text-rotulo text-tinta-apoio">{rotulo}</span>}
      {children}
    </div>
  )
}

/** Busca de terminologia em linha própria; escolhido o item, mostra o código e "Trocar". */
export function CampoTerminologia({ rotulo, tipo, escolhido, onEscolher, onLimpar }: {
  rotulo: React.ReactNode; tipo: 'sigtap_procedimento' | 'cbo' | 'cid10'; escolhido: string
  onEscolher: (codigo: string, rotulo: string) => void; onLimpar: () => void
}) {
  return (
    <Campo rotulo={rotulo}>
      {escolhido ? (
        <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-tinta">{escolhido}</span>
          <Button size="xs" variant="outline" onClick={onLimpar}>Trocar</Button>
        </div>
      ) : (
        <BuscaTerminologia tipo={tipo} onSelecionar={(r) => onEscolher(r.codigo, `${r.codigo} ${r.descricao}`)} />
      )}
    </Campo>
  )
}

type DocumentoProntuario = { id: string; tipo: string; numero: string | null; versao: number; emitido_em: string; autor: string | null }

export type InicialSolicitacao = { paciente: Paciente; tipo?: 'consulta' | 'exame' | 'leito'; cid?: string; quadro?: string; hipotese?: string }

export function NovaSolicitacao({ unidadeId, ctx, aoEnviar, inicial, pacienteFixo = false, aoFechar }: {
  unidadeId: string; ctx: ContextoSolicitacao; aoEnviar: (r: PedidoEnviado) => void
  /** 5A, tarefa 5 (H2): a solicitação aberta da consulta da UBS vem preenchida; o médico confere e completa */
  inicial?: InicialSolicitacao
  /** Dentro do paciente: o paciente não troca, e quem chamou mostra o aviso do envio. */
  pacienteFixo?: boolean
  /** Botão "Voltar" no topo (dentro do paciente). */
  aoFechar?: () => void
}) {
  const qc = useQueryClient()
  // quem é médico e gestor na unidade solicita como médico (o banco decide igual)
  const { papeisDaUnidade } = useUnidade()
  const souGestor = papeisDaUnidade.includes('gestor') && !papeisDaUnidade.includes('plantonista')
  // Fase 4, tarefa 11: o NIR abre o pedido em nome do médico assistente (obrigatório)
  const souNir = papeisDaUnidade.includes('nir') && !papeisDaUnidade.includes('plantonista') && !papeisDaUnidade.includes('gestor')
  const [termo, setTermo] = React.useState('')
  const [paciente, setPaciente] = React.useState<Paciente | null>(inicial?.paciente ?? null)
  const [ligar, setLigar] = React.useState<'episodio' | 'internacao' | 'nenhum'>('nenhum')
  const [medico, setMedico] = React.useState('')
  const [naoIdentificado, setNaoIdentificado] = React.useState(false)
  const [vulnerabilidades, setVulnerabilidades] = React.useState<Vulnerabilidade[]>([])
  const criterios = useCriterios(unidadeId)
  const [f, setF] = React.useState<Formulario>(() => ({
    ...FORMULARIO_VAZIO,
    ...(inicial?.tipo ? { tipo: inicial.tipo } : {}),
    cid: inicial?.cid ?? '', quadro_clinico: inicial?.quadro ?? '', hipotese: inicial?.hipotese ?? '',
  }))
  const [cidRotulo, setCidRotulo] = React.useState(inicial?.cid ?? '')
  const [procRotulo, setProcRotulo] = React.useState('')
  const [cboRotulo, setCboRotulo] = React.useState('')
  const [enviada, setEnviada] = React.useState<{ numero: number; duplicidade: boolean; anexos: number; falhas: string[] } | null>(null)
  // anexos escolhidos antes do envio; sobem logo depois que o pedido é criado
  const [arquivos, setArquivos] = React.useState<File[]>([])
  const [docsEscolhidos, setDocsEscolhidos] = React.useState<string[]>([])
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }))

  // pedido 3: a consulta espera a pessoa parar de digitar (300 ms)
  const termoAdiado = useValorAdiado(termo)
  const busca = useQuery({
    queryKey: ['regulacao-busca-paciente', unidadeId, termoAdiado],
    enabled: termoAdiado.trim().length >= 3 && !paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: termoAdiado.trim() })
      if (error) throw error
      return (data ?? []) as unknown as Paciente[]
    },
  })
  const vinculos = useQuery({
    queryKey: ['regulacao-vinculos', paciente?.id],
    enabled: !!paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_vinculos_paciente', { p_paciente: paciente!.id })
      if (error) throw error
      const v = data as unknown as Vinculos
      setLigar(v.internacao ? 'internacao' : v.episodio ? 'episodio' : 'nenhum')
      setVulnerabilidades(marcadoresPelaIdade(v.nascimento, hoje()))
      return v
    },
  })
  const v = vinculos.data
  const neonato = ehNeonato(v?.nascimento, hoje())
  const documentos = useQuery({
    queryKey: ['regulacao-docs-paciente', paciente?.id],
    enabled: !!paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_documentos_do_paciente', { p_paciente: paciente!.id })
      if (error) throw error
      return (data ?? []) as unknown as DocumentoProntuario[]
    },
  })
  const totalAnexos = arquivos.length + docsEscolhidos.length
  const enviar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_solicitar', {
        p_unidade: unidadeId, p_paciente: paciente!.id,
        p_dados: { ...dadosParaEnvio(f, {
          episodio_id: ligar === 'episodio' ? v?.episodio?.id : null,
          internacao_id: ligar === 'internacao' ? v?.internacao?.id : null,
          medico_assistente_id: souGestor || souNir ? medico || null : null,
          paciente_nao_identificado: !v?.tem_documento && naoIdentificado,
        }), vulnerabilidades },
      })
      if (error) throw error
      const r = data as unknown as { id: string; numero: number; aviso_duplicidade: boolean }
      // o pedido já existe: sobem os anexos; o que falhar fica avisado e pode ir pelo detalhe
      const falhas: string[] = []
      let anexos = 0
      for (const arquivo of arquivos) {
        const caminho = caminhoAnexo(r.id, arquivo.name, Date.now())
        const up = await supabase.storage.from('regulacao').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
        const reg = up.error ? up : await supabase.rpc('regulacao_registrar_anexo', {
          p_solicitacao: r.id, p_caminho: caminho, p_nome: arquivo.name, p_tamanho: arquivo.size, p_tipo_mime: arquivo.type,
        })
        if (reg.error) falhas.push(`${arquivo.name} (${reg.error.message})`); else anexos++
      }
      for (const doc of docsEscolhidos) {
        const { error: e } = await supabase.rpc('regulacao_anexar_documento', { p_solicitacao: r.id, p_documento: doc })
        if (e) falhas.push(`documento do prontuário (${e.message})`); else anexos++
      }
      return { ...r, anexos, falhas }
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
      // a aba do paciente e a lista "Em regulação" mostram o pedido novo
      void qc.invalidateQueries({ queryKey: ['regulacao-pacientes'] })
      const enviado: PedidoEnviado = { id: r.id, numero: r.numero, duplicidade: r.aviso_duplicidade, anexos: r.anexos, falhas: r.falhas }
      // dentro do paciente quem chamou fecha o formulário e dá o aviso
      if (!pacienteFixo) {
        setEnviada(enviado)
        setF(FORMULARIO_VAZIO); setCidRotulo(''); setProcRotulo(''); setCboRotulo(''); setPaciente(null); setTermo(''); setMedico('')
        setNaoIdentificado(false); setVulnerabilidades([]); setArquivos([]); setDocsEscolhidos([])
      }
      aoEnviar(enviado)
    },
  })
  const faltas = [...faltasFormulario(f, { neonato, semDocumento: v ? !v.tem_documento : false, naoIdentificado }),
    ...(souNir && !medico ? ['médico assistente'] : [])]
  const leitoOuTransf = f.tipo === 'leito' || f.tipo === 'transferencia'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="text-corpo">Nova solicitação</CardTitle>
            <CardDescription>Vai para a {ctx.central?.nome}. O autor é quem está logado. Os campos seguem o modelo nacional (MIRA).</CardDescription>
          </div>
          {aoFechar && (
            <Button size="sm" variant="outline" onClick={aoFechar}><ArrowLeft /> Voltar à regulação do paciente</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {enviada && <AvisoEnviado enviada={enviada} />}

        {/* paciente */}
        {paciente ? (
          <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-2">
            <span className="font-medium text-tinta">{paciente.nome_social ?? paciente.nome}</span>
            {paciente.data_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(paciente.data_nascimento)}</span>}
            {paciente.prontuario && <span className="text-tinta-sussurro">pront. {paciente.prontuario}</span>}
            {neonato && <Badge variant="info">recém-nascido</Badge>}
            {!pacienteFixo && <Button size="xs" variant="outline" className="ml-auto" onClick={() => { setPaciente(null); setTermo('') }}>Trocar</Button>}
          </div>
        ) : (
          <Campo id="reg-paciente" rotulo="Paciente (nome, CPF, CNS ou prontuário)">
            <Input id="reg-paciente" className="h-8" value={termo} onChange={(e) => { setTermo(e.target.value); setEnviada(null) }} />
            {busca.isFetching && <Spinner />}
            {(busca.data ?? []).length > 0 && (
              <ul className="flex flex-col divide-y divide-fio rounded-controle border border-fio">
                {(busca.data ?? []).slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <BotaoLinha variante="linha" className="block border-0 px-3 py-1.5 hover:bg-campo" onClick={() => setPaciente(p)}>
                      {p.nome_social ?? p.nome} {p.data_nascimento && <span className="text-tinta-sussurro">· {fmtData(p.data_nascimento)}</span>}
                    </BotaoLinha>
                  </li>
                ))}
              </ul>
            )}
            {termoAdiado.trim().length >= 3 && !busca.isFetching && (busca.data ?? []).length === 0 &&<span className="text-tinta-sussurro">Nenhum paciente com esse termo.</span>}
          </Campo>
        )}

        {paciente && v && (
          <>
            {!v.tem_documento && (
              <label className="flex items-start gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-atencao">
                <input type="checkbox" className="mt-0.5 size-4" checked={naoIdentificado} onChange={(e) => setNaoIdentificado(e.target.checked)} />
                O paciente está sem CNS e sem CPF válidos. Complete o cadastro, ou marque aqui para enviar como paciente não identificado.
              </label>
            )}
            {(v.episodio || v.internacao) && (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-rotulo text-tinta-apoio">Ligar a</legend>
                {v.internacao && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'internacao'} onChange={() => setLigar('internacao')} />
                    Internação aberta{v.internacao.leito ? `, leito ${v.internacao.leito}` : ''} (desde {fmtDataHora(v.internacao.admissao_em)})</label>
                )}
                {v.episodio && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'episodio'} onChange={() => setLigar('episodio')} />
                    Atendimento aberto (chegada {fmtDataHora(v.episodio.chegada_em)})</label>
                )}
                <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'nenhum'} onChange={() => setLigar('nenhum')} />
                  Só ao paciente</label>
              </fieldset>
            )}

            {/* o que se pede */}
            <Campo id="reg-tipo" rotulo="Tipo" className="sm:max-w-xs">
              <CampoSelecao id="reg-tipo" tamanho="compacto" value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoSolicitacao)}>
                {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
              </CampoSelecao>
            </Campo>
            <CampoTerminologia tipo="sigtap_procedimento" escolhido={procRotulo}
              rotulo={<>Procedimento (SIGTAP){f.tipo === 'leito' && ' — o da internação'}</>}
              onEscolher={(c, r) => { set('procedimento', c); setProcRotulo(r) }} onLimpar={() => { set('procedimento', ''); setProcRotulo('') }} />
            {f.tipo === 'consulta' && (
              <>
                <Campo id="reg-esp" rotulo="Especialidade" className="sm:max-w-md">
                  <Input id="reg-esp" className="h-8" list="reg-especialidades" value={f.especialidade} onChange={(e) => set('especialidade', e.target.value)} />
                  <datalist id="reg-especialidades">{ESPECIALIDADES.map((e) => <option key={e} value={e} />)}</datalist>
                </Campo>
                <CampoTerminologia tipo="cbo" escolhido={cboRotulo} rotulo="CBO da especialidade"
                  onEscolher={(c, r) => { set('cbo', c); setCboRotulo(r) }} onLimpar={() => { set('cbo', ''); setCboRotulo('') }} />
              </>
            )}
            {leitoOuTransf && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo id="reg-leito" rotulo={f.tipo === 'leito' ? 'Tipo de leito' : 'Leito no destino (se for internar)'}>
                  <CampoSelecao id="reg-leito" tamanho="compacto" value={f.tipo_leito} onChange={(e) => set('tipo_leito', e.target.value)}>
                    <option value="">{f.tipo === 'leito' ? 'Escolha…' : 'Não se aplica'}</option>
                    {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                  </CampoSelecao>
                </Campo>
                {f.tipo_leito === 'psiquiatrico' && (
                  <Campo id="reg-psiq" rotulo="Internação psiquiátrica">
                    <CampoSelecao id="reg-psiq" tamanho="compacto" value={f.internacao_psiquiatrica} onChange={(e) => set('internacao_psiquiatrica', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(INTERNACAO_PSIQUIATRICA).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </CampoSelecao>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && (
                  <Campo id="reg-transp" rotulo="Transporte solicitado (a central define o final)">
                    <CampoSelecao id="reg-transp" tamanho="compacto" value={f.transporte} onChange={(e) => set('transporte', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(TRANSPORTES).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </CampoSelecao>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && neonato && (
                  <Campo id="reg-incub" rotulo="Incubadora">
                    <CampoSelecao id="reg-incub" tamanho="compacto" value={f.incubadora} onChange={(e) => set('incubadora', e.target.value as Formulario['incubadora'])}>
                      <option value="">Escolha…</option><option value="sim">Sim</option><option value="nao">Não</option>
                    </CampoSelecao>
                  </Campo>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.isolamento} onChange={(e) => set('isolamento', e.target.checked)} />
                Precisa de isolamento</label>
              {f.isolamento && (
                <CampoSelecao aria-label="Tipo de isolamento" tamanho="compacto" value={f.isolamento_tipo} onChange={(e) => set('isolamento_tipo', e.target.value)}>
                  <option value="">Tipo…</option>
                  {Object.entries(ISOLAMENTOS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                </CampoSelecao>
              )}
            </div>

            {/* destino */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-destino" rotulo="Destino">
                <CampoSelecao id="reg-destino" tamanho="compacto" value={f.destino_tipo} onChange={(e) => set('destino_tipo', e.target.value as DestinoTipo)}>
                  <option value="a_definir">A definir pela regulação</option>
                  <option value="rede">Unidade da rede</option>
                  <option value="externo">Serviço fora da rede</option>
                </CampoSelecao>
              </Campo>
              {f.destino_tipo === 'rede' && (
                <Campo id="reg-dest-un" rotulo="Unidade" className="sm:col-span-2">
                  <CampoSelecao id="reg-dest-un" tamanho="compacto" value={f.destino_unidade_id} onChange={(e) => set('destino_unidade_id', e.target.value)}>
                    <option value="">Escolha…</option>
                    {ctx.unidades_rede.filter((u) => u.id !== unidadeId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </CampoSelecao>
                </Campo>
              )}
              {f.destino_tipo === 'externo' && (
                <Campo id="reg-dest-ext" rotulo="Serviço (nome e município)" className="sm:col-span-2">
                  <Input id="reg-dest-ext" className="h-8" value={f.destino_externo} onChange={(e) => set('destino_externo', e.target.value)} />
                </Campo>
              )}
            </div>

            {/* caráter e prioridade */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-carater" rotulo="Caráter">
                <CampoSelecao id="reg-carater" tamanho="compacto" value={f.carater} onChange={(e) => set('carater', e.target.value as Carater)}>
                  <option value="">Escolha…</option>
                  {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
                </CampoSelecao>
              </Campo>
              <fieldset className="flex flex-col gap-1 sm:col-span-2">
                <legend className="text-rotulo text-tinta-apoio">Prioridade proposta (o regulador da central revisa)</legend>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => (
                    <label key={k} className="flex items-center gap-1.5" title={criterios.data?.[k]?.texto ?? PRIORIDADES[k].descricao}>
                      <input type="radio" name="reg-prioridade" className="size-4" checked={f.prioridade === k} onChange={() => set('prioridade', k)} />
                      {PRIORIDADES[k].rotulo}
                    </label>
                  ))}
                </div>
                {f.prioridade && f.prioridade !== 'nao_classificada' && criterios.data?.[f.prioridade]?.texto && (
                  <span className="text-rotulo text-tinta-apoio">Critério da central: {criterios.data[f.prioridade]!.texto}</span>
                )}
              </fieldset>
            </div>

            {/* vulnerabilidade: selos, sem pontuação; a idade já marca idoso ou criança */}
            <fieldset className="flex flex-col gap-1">
              <legend className="text-rotulo text-tinta-apoio">Vulnerabilidade (aparece como selo para o regulador)</legend>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(VULNERABILIDADES) as Vulnerabilidade[]).map((k) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" className="size-4" checked={vulnerabilidades.includes(k)}
                      onChange={(e) => setVulnerabilidades((x) => e.target.checked ? [...x, k] : x.filter((y) => y !== k))} />
                    {VULNERABILIDADES[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* justificativa em blocos */}
            <CampoTerminologia tipo="cid10" escolhido={cidRotulo} rotulo="CID-10"
              onEscolher={(c, r) => { set('cid', c); setCidRotulo(r) }} onLimpar={() => { set('cid', ''); setCidRotulo('') }} />
            <Campo id="reg-quadro" rotulo="Quadro clínico (obrigatório)">
              <textarea id="reg-quadro" rows={4} className="rounded-controle border border-fio bg-campo px-2 py-1.5"
                value={f.quadro_clinico} onChange={(e) => set('quadro_clinico', e.target.value)} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="reg-evol" rotulo="Tempo de evolução"><Input id="reg-evol" className="h-8" value={f.tempo_evolucao} onChange={(e) => set('tempo_evolucao', e.target.value)} /></Campo>
              <Campo id="reg-sv" rotulo="Sinais vitais, com a hora">
                <Input id="reg-sv" className="h-8" placeholder="PA, FC, FR, SpO₂, Tax, às hh:mm (PA não obrigatória na criança)" value={f.sinais_vitais} onChange={(e) => set('sinais_vitais', e.target.value)} />
              </Campo>
              <Campo id="reg-exames" rotulo="Exames realizados, com a data"><Input id="reg-exames" className="h-8" value={f.exames} onChange={(e) => set('exames', e.target.value)} /></Campo>
              <Campo id="reg-meds" rotulo="Tratamento feito e medicações em uso"><Input id="reg-meds" className="h-8" value={f.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} /></Campo>
              <Campo id="reg-hip" rotulo="Hipótese diagnóstica"><Input id="reg-hip" className="h-8" value={f.hipotese} onChange={(e) => set('hipotese', e.target.value)} /></Campo>
              <Campo id="reg-tel" rotulo="Telefone de contato da origem"><Input id="reg-tel" className="h-8" value={f.telefone_contato} onChange={(e) => set('telefone_contato', e.target.value)} /></Campo>
            </div>

            {/* anexos: escolhidos aqui, enviados junto com o pedido */}
            <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 font-medium text-tinta"><Paperclip className="size-4" aria-hidden /> Anexos (opcional){totalAnexos > 0 ? ` · ${totalAnexos}` : ''}</span>
              </div>
              <AreaDeAnexo
                id="reg-anexos"
                multiple
                descricao="PDF, JPG ou PNG, até 10 MB cada"
                accept={ANEXO_TIPOS.join(',')}
                maxBytes={ANEXO_LIMITE_BYTES}
                validar={erroArquivo}
                valor={arquivos}
                onArquivos={(novos) => setArquivos((x) => [...x, ...novos])}
                onRemover={(i) => setArquivos((x) => x.filter((_, j) => j !== i))}
              />
              {(documentos.data ?? []).length > 0 && (
                <fieldset className="flex flex-col gap-1">
                  <legend className="flex items-center gap-1.5 text-rotulo text-tinta-apoio"><FileText className="size-3.5" aria-hidden /> Documentos do prontuário deste paciente</legend>
                  {documentos.data!.map((d) => (
                    <label key={d.id} className="flex flex-wrap items-center gap-2">
                      <input type="checkbox" className="size-4" checked={docsEscolhidos.includes(d.id)}
                        onChange={(e) => setDocsEscolhidos((x) => e.target.checked ? [...x, d.id] : x.filter((y) => y !== d.id))} />
                      <span className="text-tinta">{d.tipo.replace(/_/g, ' ')}{d.numero ? ` nº ${d.numero}` : ''}</span>
                      <span className="text-rotulo text-tinta-sussurro">versão {d.versao} · {d.autor ?? '—'} · {fmtDataHora(d.emitido_em)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {(souGestor || souNir) && (
              <Campo id="reg-medico" rotulo={souNir ? 'Médico assistente (obrigatório: o NIR abre em nome dele)' : 'Médico assistente (fica informado)'} className="max-w-sm">
                <CampoSelecao id="reg-medico" tamanho="compacto" value={medico} onChange={(e) => setMedico(e.target.value)}>
                  <option value="">{souNir ? 'Escolha…' : 'Não informar'}</option>
                  {v.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </CampoSelecao>
              </Campo>
            )}

            <MensagemErro texto={enviar.error ? (enviar.error as Error).message : null} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => enviar.mutate()} disabled={faltas.length > 0 || enviar.isPending}>
                {enviar.isPending ? <Spinner /> : <Send className="size-4" />} Enviar à central
              </Button>
              {faltas.length > 0 && <span className="text-atencao">Falta: {faltas.join(', ')}.</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Aviso do envio: número, anexos, pedido igual já aberto e o anexo que não subiu. */
export function AvisoEnviado({ enviada, onde = 'Ela está aberta abaixo.' }: { enviada: Omit<PedidoEnviado, 'id'>; onde?: string }) {
  return (
    <p role="status" className="text-sucesso">
      Solicitação nº {enviada.numero} enviada à central{enviada.anexos > 0 ? `, com ${enviada.anexos} anexo(s)` : ''}. {onde}
      {enviada.duplicidade && <span className="ml-1 text-atencao">Atenção: já havia um pedido aberto igual para este paciente.</span>}
      {enviada.falhas.length > 0 && (
        <span className="block text-critico">Não subiu: {enviada.falhas.join('; ')}. Anexe de novo no detalhe do pedido.</span>
      )}
    </p>
  )
}

/**
 * "Novo pedido" dentro do paciente (RT, 24/11/2026): o formulário abre no
 * lugar, com o paciente já escolhido; "Voltar" ou Esc fecham sem sair da
 * tela, e o envio devolve o pedido novo a quem chamou.
 */
export function NovoPedidoPaciente({ pacienteId, unidadeId, aoFechar, aoEnviar }: {
  pacienteId: string; unidadeId: string; aoFechar: () => void; aoEnviar: (r: PedidoEnviado) => void
}) {
  const ctx = useQuery({
    queryKey: ['regulacao-contexto', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as ContextoSolicitacao
    },
  })
  const paciente = useQuery({
    queryKey: ['regulacao-paciente-url', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id, nome, nome_social, data_nascimento, prontuario').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data as Paciente | null
    },
  })
  const c = ctx.data
  const p = paciente.data
  const erro = ctx.error ?? paciente.error
  const semFormulario = (texto: string) => (
    <div className="flex flex-col items-start gap-2 rounded-controle border border-fio px-3 py-3 text-apoio">
      <p className="text-tinta-apoio">{texto}</p>
      <Button size="sm" variant="outline" onClick={aoFechar}><ArrowLeft /> Voltar à regulação do paciente</Button>
    </div>
  )
  return (
    <div
      onKeyDown={(e) => {
        // Esc fecha o formulário, não a janela do paciente em volta
        if (e.key === 'Escape' && !e.defaultPrevented) { e.stopPropagation(); aoFechar() }
      }}
    >
      {ctx.isLoading || paciente.isLoading ? <Spinner />
        : erro ? (
          <div className="flex flex-col items-start gap-2">
            <MensagemErro texto={(erro as Error).message} />
            <Button size="sm" variant="outline" onClick={aoFechar}><ArrowLeft /> Voltar à regulação do paciente</Button>
          </div>
        )
        : !c?.central ? semFormulario('A rede ainda não tem Central de Regulação. Até a administração definir, não há para onde enviar.')
        : c.sou_central || !c.pode_solicitar ? semFormulario('Nesta unidade o pedido de regulação é aberto pelo médico, pelo gestor ou pelo NIR.')
        : !p ? semFormulario('Paciente não encontrado.')
        : <NovaSolicitacao key={p.id} unidadeId={unidadeId} ctx={c} inicial={{ paciente: p }} pacienteFixo aoFechar={aoFechar} aoEnviar={aoEnviar} />}
    </div>
  )
}
