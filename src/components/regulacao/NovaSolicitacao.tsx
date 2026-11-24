// ─────────────────────────────────────────────────────────────────────────────
// Nova solicitação de regulação (Fase 4, tarefa 1; campos do MIRA).
// Saiu da página Regulação (src/pages/regulacao/Regulacao.tsx) para servir
// também dentro do paciente (pedido do RT de 24/11/2026): na aba Regulação do
// caderno do leito, da janela da porta e do cartão da observação, o "Novo
// pedido" abre ali mesmo, com o paciente já escolhido, e volta à aba
// (NovoPedidoPaciente, abaixo).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, FileText, Paperclip, Send, X } from 'lucide-react'
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
import { dataIso, diaMes } from '@/lib/formato'
import { MARCA_PRONTUARIO, quadroParaRegulacao } from '@/lib/doProntuario'
import { Chip } from '@/components/monitor/Pagina'
import { rotuloDocumento } from '@/components/documento/documentos'
import { useDoProntuario } from '@/components/internacao/caderno/useDoProntuario'
import {
  ANEXO_LIMITE_BYTES, ANEXO_TIPOS, CARATER, FORMULARIO_VAZIO, caraterDaPrioridade, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, TIPOS,
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

type Passo = 1 | 2 | 3
const PASSOS: { n: Passo; rotulo: string }[] = [
  { n: 1, rotulo: 'O que pedir' }, { n: 2, rotulo: 'Quadro clínico' }, { n: 3, rotulo: 'Revisar e enviar' },
]
/** Campos do quadro clínico que o caderno do leito preenche (RG2). */
type CampoQuadro = 'cid' | 'hipotese' | 'quadro_clinico' | 'sinais_vitais' | 'exames' | 'medicacoes'

/** "veio do prontuário, revise" ao lado do rótulo; some quando o médico edita o campo. */
function Marca({ ligada }: { ligada: boolean }) {
  if (!ligada) return null
  return <span className="ml-1.5 text-rotulo font-normal text-atencao">· {MARCA_PRONTUARIO}</span>
}

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
  // RG1: "Ligar a" vem escolhido (internação aberta, senão o atendimento) e só aparece em "trocar"
  const [trocarLigar, setTrocarLigar] = React.useState(false)
  const [medico, setMedico] = React.useState('')
  const [naoIdentificado, setNaoIdentificado] = React.useState(false)
  const [vulnerabilidades, setVulnerabilidades] = React.useState<Vulnerabilidade[]>([])
  const [buscaVul, setBuscaVul] = React.useState('')
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
  // RG1: dentro do paciente, o pedido vai em três passos com o resumo ao lado
  const passos = pacienteFixo
  const [passo, setPasso] = React.useState<Passo>(1)
  // RG2: o que veio do caderno fica marcado até o médico mexer no campo
  const [doProntuario, setDoProntuario] = React.useState<Set<CampoQuadro>>(new Set())
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setDoProntuario((x) => {
      if (!x.has(k as CampoQuadro)) return x
      const n = new Set(x)
      n.delete(k as CampoQuadro)
      return n
    })
  }

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

  // RG2: quadro clínico a partir do caderno (última evolução, vitais crus com a hora,
  // exames com resultado e data, prescrição vigente e CID da lista de problemas)
  const dp = useDoProntuario(pacienteFixo ? paciente?.id : null, pacienteFixo ? v?.internacao?.id : null)
  // uma vez, quando o caderno terminou de ler (ajuste de estado no render, sem efeito)
  const [aplicado, setAplicado] = React.useState(false)
  if (!aplicado && dp.pronto) {
    setAplicado(true)
    const q = quadroParaRegulacao(dp)
    const marcados = new Set<CampoQuadro>()
    const n = { ...f }
    for (const k of ['cid', 'hipotese', 'quadro_clinico', 'sinais_vitais', 'exames', 'medicacoes'] as const) {
      if (!f[k].trim() && q[k].trim()) { n[k] = q[k]; marcados.add(k) }
    }
    setF(n)
    if (q.cid && !cidRotulo) setCidRotulo(q.cid)
    setDoProntuario(marcados)
  }

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
  // RG1: o caráter vem da prioridade (1 e 2 urgência, 3 e 4 eletivo); sem classificação, escolhe-se
  const caraterDerivado = caraterDaPrioridade(f.prioridade || null)
  const escolherPrioridade = (k: Prioridade) => {
    set('prioridade', k)
    const c = caraterDaPrioridade(k)
    if (c) set('carater', c)
  }
  const termoVul = buscaVul.trim().toLowerCase()
  const vulOpcoes = (Object.keys(VULNERABILIDADES) as Vulnerabilidade[])
    .filter((k) => !vulnerabilidades.includes(k) && (!termoVul || VULNERABILIDADES[k].toLowerCase().includes(termoVul)))
  const nomeDocumento = (d: DocumentoProntuario) => `${rotuloDocumento(d.tipo)} ${diaMes(d.emitido_em)}`

  const blocoLigar = (v?.episodio || v?.internacao) && (
    <div className="flex flex-wrap items-center gap-2 text-tinta-apoio">
      <span>
        Ligado a {ligar === 'internacao' && v?.internacao ? `internação aberta${v.internacao.leito ? `, leito ${v.internacao.leito}` : ''} (desde ${fmtDataHora(v.internacao.admissao_em)})`
          : ligar === 'episodio' && v?.episodio ? `atendimento aberto (chegada ${fmtDataHora(v.episodio.chegada_em)})` : 'só ao paciente'}
      </span>
      {!trocarLigar && <Button size="xs" variant="outline" onClick={() => setTrocarLigar(true)}>Trocar</Button>}
      {trocarLigar && (
        <span className="flex flex-wrap gap-1.5">
          {v?.internacao && <Chip variante="opcao" radio ativo={ligar === 'internacao'} onClick={() => setLigar('internacao')}>Internação</Chip>}
          {v?.episodio && <Chip variante="opcao" radio ativo={ligar === 'episodio'} onClick={() => setLigar('episodio')}>Atendimento</Chip>}
          <Chip variante="opcao" radio ativo={ligar === 'nenhum'} onClick={() => setLigar('nenhum')}>Só ao paciente</Chip>
        </span>
      )}
    </div>
  )

  const oQuePedir = paciente && v && (
    <>
      {!v.tem_documento && (
        <label className="flex items-start gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-atencao">
          <input type="checkbox" className="mt-0.5 size-4" checked={naoIdentificado} onChange={(e) => setNaoIdentificado(e.target.checked)} />
          O paciente está sem CNS e sem CPF válidos. Complete o cadastro, ou marque aqui para enviar como paciente não identificado.
        </label>
      )}
      {blocoLigar}

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

      {/* prioridade (o caráter vem dela) */}
      <fieldset className="flex flex-col gap-1">
        <legend className="text-rotulo text-tinta-apoio">Prioridade proposta (o regulador da central revisa)</legend>
        <div role="radiogroup" aria-label="Prioridade proposta" className="flex flex-wrap gap-1.5">
          {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => (
            <Chip key={k} variante="opcao" radio ativo={f.prioridade === k} onClick={() => escolherPrioridade(k)}
              titulo={criterios.data?.[k]?.texto ?? PRIORIDADES[k].descricao}>{PRIORIDADES[k].rotulo}</Chip>
          ))}
        </div>
        {f.prioridade && f.prioridade !== 'nao_classificada' && criterios.data?.[f.prioridade]?.texto && (
          <span className="text-rotulo text-tinta-apoio">Critério da central: {criterios.data[f.prioridade]!.texto}</span>
        )}
        {caraterDerivado && <span className="text-rotulo text-tinta-sussurro">Caráter: {CARATER[caraterDerivado]} (pela prioridade)</span>}
      </fieldset>
      {!caraterDerivado && f.prioridade && (
        <Campo id="reg-carater" rotulo="Caráter" className="sm:max-w-xs">
          <CampoSelecao id="reg-carater" tamanho="compacto" value={f.carater} onChange={(e) => set('carater', e.target.value as Carater)}>
            <option value="">Escolha…</option>
            {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
          </CampoSelecao>
        </Campo>
      )}

      {/* vulnerabilidade: selos, sem pontuação; a idade já marca idoso ou criança; busca em vez de parede de caixas */}
      <div className="flex flex-col gap-1.5">
        <span className="text-rotulo text-tinta-apoio">Vulnerabilidade (aparece como selo para o regulador; a idade já sugere)</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {vulnerabilidades.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-capsula border border-acao/35 bg-acao/10 px-2.5 py-0.5 text-apoio text-acao">
              {VULNERABILIDADES[k]}
              <Button variant="ghost" size="icon-xs" aria-label={`Tirar ${VULNERABILIDADES[k]}`} onClick={() => setVulnerabilidades((x) => x.filter((y) => y !== k))}><X aria-hidden /></Button>
            </span>
          ))}
          <Input className="h-8 w-56" aria-label="Acrescentar vulnerabilidade" placeholder="Acrescentar: gestante, situação de rua…"
            value={buscaVul} onChange={(e) => setBuscaVul(e.target.value)} />
        </div>
        {termoVul && (
          <div className="flex flex-wrap gap-1.5">
            {vulOpcoes.map((k) => (
              <Chip key={k} ativo={false} onClick={() => { setVulnerabilidades((x) => [...x, k]); setBuscaVul('') }}>{VULNERABILIDADES[k]}</Chip>
            ))}
            {vulOpcoes.length === 0 && <span className="text-rotulo text-tinta-sussurro">Nada com esse nome.</span>}
          </div>
        )}
      </div>
    </>
  )

  const quadro = paciente && v && (
    <>
      {doProntuario.size > 0 && (
        <p role="status" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-atencao">
          Os campos marcados vieram do prontuário (última evolução, sinais vitais da enfermagem, exames, prescrição e lista de problemas). Revise e edite antes de enviar.
        </p>
      )}
      <CampoTerminologia tipo="cid10" escolhido={cidRotulo} rotulo={<>CID-10<Marca ligada={doProntuario.has('cid')} /></>}
        onEscolher={(c, r) => { set('cid', c); setCidRotulo(r) }} onLimpar={() => { set('cid', ''); setCidRotulo('') }} />
      <Campo id="reg-quadro" rotulo={<>Quadro clínico (obrigatório)<Marca ligada={doProntuario.has('quadro_clinico')} /></>}>
        <textarea id="reg-quadro" rows={5} className="rounded-controle border border-fio bg-campo px-2 py-1.5"
          value={f.quadro_clinico} onChange={(e) => set('quadro_clinico', e.target.value)} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="reg-evol" rotulo="Tempo de evolução"><Input id="reg-evol" className="h-8" value={f.tempo_evolucao} onChange={(e) => set('tempo_evolucao', e.target.value)} /></Campo>
        <Campo id="reg-sv" rotulo={<>Sinais vitais, com a hora<Marca ligada={doProntuario.has('sinais_vitais')} /></>}>
          <Input id="reg-sv" className="h-8" placeholder="PA, FC, FR, SpO₂, Tax, às hh:mm (PA não obrigatória na criança)" value={f.sinais_vitais} onChange={(e) => set('sinais_vitais', e.target.value)} />
        </Campo>
        <Campo id="reg-exames" rotulo={<>Exames realizados, com a data<Marca ligada={doProntuario.has('exames')} /></>}>
          <textarea id="reg-exames" rows={2} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={f.exames} onChange={(e) => set('exames', e.target.value)} />
        </Campo>
        <Campo id="reg-meds" rotulo={<>Tratamento feito e medicações em uso<Marca ligada={doProntuario.has('medicacoes')} /></>}>
          <textarea id="reg-meds" rows={2} className="rounded-controle border border-fio bg-campo px-2 py-1.5" value={f.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} />
        </Campo>
        <Campo id="reg-hip" rotulo={<>Hipótese diagnóstica<Marca ligada={doProntuario.has('hipotese')} /></>}>
          <Input id="reg-hip" className="h-8" value={f.hipotese} onChange={(e) => set('hipotese', e.target.value)} />
        </Campo>
        <Campo id="reg-tel" rotulo="Telefone de contato da origem"><Input id="reg-tel" className="h-8" value={f.telefone_contato} onChange={(e) => set('telefone_contato', e.target.value)} /></Campo>
      </div>
    </>
  )

  const revisar = paciente && v && (
    <>
      {/* anexos: escolhidos aqui, enviados junto com o pedido */}
      <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
        <span className="flex items-center gap-1.5 font-medium text-tinta"><Paperclip className="size-4" aria-hidden /> Anexos (opcional){totalAnexos > 0 ? ` · ${totalAnexos}` : ''}</span>
        {(documentos.data ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-rotulo text-tinta-apoio"><FileText className="size-3.5" aria-hidden /> Documentos do prontuário deste paciente</span>
            {/* RG2: nome legível e "Anexar" por item, sem parede de caixas */}
            {documentos.data!.map((d) => {
              const vai = docsEscolhidos.includes(d.id)
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-2 border-t border-trilha py-1 first:border-0">
                  <span className="text-tinta">{nomeDocumento(d)}</span>
                  <span className="text-rotulo text-tinta-sussurro">{d.numero ? `nº ${d.numero} · ` : ''}{d.autor ?? '—'}</span>
                  <Button size="xs" variant={vai ? 'default' : 'outline'} className="ml-auto" aria-pressed={vai}
                    onClick={() => setDocsEscolhidos((x) => (vai ? x.filter((y) => y !== d.id) : [...x, d.id]))}>
                    {vai ? <><Check aria-hidden /> Vai junto</> : 'Anexar'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
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
  )

  const resumo = paciente && v && (
    <aside aria-label="Resumo do pedido" className="flex flex-col gap-1.5 self-start rounded-controle border border-fio bg-campo p-3 text-apoio lg:sticky lg:top-2">
      <span className="text-controle font-semibold text-tinta">Resumo do pedido</span>
      <span className="text-tinta">{paciente.nome_social ?? paciente.nome}</span>
      <span className="text-tinta-apoio">{TIPOS[f.tipo]}{f.tipo_leito ? ` · ${TIPOS_LEITO[f.tipo_leito]}` : ''}</span>
      {procRotulo && <span className="text-tinta-apoio">{procRotulo}</span>}
      <span className="text-tinta-apoio">Destino: {f.destino_tipo === 'a_definir' ? 'a definir pela regulação' : f.destino_tipo === 'rede'
        ? ctx.unidades_rede.find((u) => u.id === f.destino_unidade_id)?.nome ?? 'unidade da rede' : f.destino_externo || 'fora da rede'}</span>
      <span className="text-tinta-apoio">{f.prioridade ? PRIORIDADES[f.prioridade].rotulo : 'Prioridade não escolhida'}{f.carater ? ` · ${CARATER[f.carater]}` : ''}</span>
      {vulnerabilidades.length > 0 && <span className="text-tinta-apoio">{vulnerabilidades.map((k) => VULNERABILIDADES[k]).join(', ')}</span>}
      <span className="text-tinta-apoio">CID: {cidRotulo || 'falta'}</span>
      <span className="text-tinta-apoio">Anexos: {totalAnexos}</span>
      {faltas.length > 0
        ? <span className="text-atencao">Falta: {faltas.join(', ')}.</span>
        : <span className="text-conforme">Pronto para enviar.</span>}
    </aside>
  )

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

        {paciente && v && !passos && (
          <>
            {oQuePedir}
            {quadro}
            {revisar}
          </>
        )}

        {/* RG1: três passos, o aberto à esquerda e o resumo fixo à direita */}
        {paciente && v && passos && (
          <>
            <ol aria-label="Passos do pedido" className="flex flex-wrap gap-1.5">
              {PASSOS.map((p) => (
                <li key={p.n}>
                  <Chip variante="opcao" radio ativo={passo === p.n} onClick={() => setPasso(p.n)}>{p.n}. {p.rotulo}</Chip>
                </li>
              ))}
            </ol>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex min-w-0 flex-col gap-3">
                {passo === 1 && oQuePedir}
                {passo === 2 && quadro}
                {passo === 3 && revisar}
                <div className="flex flex-wrap gap-2 border-t border-trilha pt-3">
                  {passo > 1 && <Button size="sm" variant="outline" onClick={() => setPasso((passo - 1) as Passo)}><ArrowLeft /> Voltar</Button>}
                  {passo < 3 && <Button size="sm" onClick={() => setPasso((passo + 1) as Passo)}>Próximo: {PASSOS[passo].rotulo}</Button>}
                </div>
              </div>
              {resumo}
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
