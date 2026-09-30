import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FolderUp, History, PencilLine, Plus, Search, Stethoscope, FileText, Loader2, TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { CATEGORIAS, faltasParaAih, RACAS_COR, SEXOS } from '@/lib/cadastro'
import { formatarCns, formatarCpf } from '@/lib/documentos'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import type { CorRisco } from '@/domain/risco'
import { Campo, CamposCadastro } from '@/pages/recepcao/CamposCadastro'
import { CADASTRO_VAZIO, errosCadastro, hojeSP, idadeLegivel, normalizarCadastro, type Cadastro, type CampoCadastro } from '@/pages/recepcao/cadastroForm'
import { DIETAS, hojeLocal, idadeTexto, type DadosPaciente } from './rascunho'

function normalizarNome(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function extrairTextoPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    texto += tc.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return texto
}

async function extrairTextoImagem(file: File) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('por')
  try {
    const ret = await worker.recognize(file)
    return ret.data.text
  } finally {
    await worker.terminate()
  }
}

// ── cadastro completo (protótipo: cadastro da porta e aba "Dados do paciente") ──

type PacienteLinha = Record<CampoCadastro, string | null> & { id: string; prontuario: string | null; setor_id: string | null }
type Atendimento = {
  id: string
  setor: string
  etapa: string
  chegada_em: string
  encerrado_em: string | null
  desfecho: string | null
  cor_atual: CorRisco | null
  prestador: string | null
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const isoParaBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const brParaIso = (br: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const rotuloDe = (lista: readonly { valor: string; rotulo: string }[], v: string | null) => lista.find((o) => o.valor === v)?.rotulo ?? v ?? ''

const SITUACAO: Record<string, string> = {
  triagem: 'Aguardando triagem',
  atendimento: 'No Pronto Socorro',
  observacao: 'Em observação',
  internacao: 'Internado',
}
const DESFECHO: Record<string, string> = {
  alta: 'Alta',
  alta_apos_medicacao: 'Alta após medicação',
  alta_a_pedido: 'Alta a pedido',
  transferencia: 'Transferência',
  evasao: 'Evasão',
  obito: 'Óbito',
  observacao: 'Observação',
  internacao: 'Internação',
  cancelado: 'Cancelado',
}

function paraFormulario(p: PacienteLinha | null | undefined): Cadastro {
  if (!p) return { ...CADASTRO_VAZIO }
  const f = { ...CADASTRO_VAZIO }
  for (const k of Object.keys(CADASTRO_VAZIO) as CampoCadastro[]) f[k] = p[k] ?? ''
  return f
}

/** Blocos só de leitura, no desenho da aba "Dados do paciente" do protótipo. */
function BlocosCadastro({ p }: { p: PacienteLinha }) {
  const hoje = hojeSP()
  const blocos: { titulo: string; campos: [string, string][] }[] = [
    {
      titulo: 'Identificação',
      campos: [
        ['Nome', p.nome_social ? `${p.nome_social} (${p.nome})` : (p.nome ?? '')],
        ['Prontuário', p.prontuario ?? ''],
        ['Nascimento', p.data_nascimento ? `${isoParaBr(p.data_nascimento)} · ${idadeLegivel(p.data_nascimento, hoje)}` : ''],
        ['Sexo', rotuloDe(SEXOS, p.sexo)],
        ['Raça/cor', rotuloDe(RACAS_COR, p.raca_cor)],
        ['Nome da mãe', p.nome_mae ?? ''],
        ['CPF', p.cpf ? formatarCpf(p.cpf) : ''],
        ['Cartão SUS', p.cns ? formatarCns(p.cns) : ''],
        ['Estado civil', p.estado_civil ?? ''],
        ['Categoria', [rotuloDe(CATEGORIAS, p.categoria), p.categoria === 'convenio' ? p.convenio : ''].filter(Boolean).join(' · ')],
      ],
    },
    {
      titulo: 'Contato e endereço',
      campos: [
        ['Telefone', p.telefone ?? ''],
        ['Endereço', p.endereco ?? ''],
        ['Município', [p.municipio, p.uf].filter(Boolean).join(' / ')],
      ],
    },
    {
      titulo: 'Responsável',
      campos: [
        ['Nome', p.responsavel_nome ?? ''],
        ['Parentesco ou vínculo', p.responsavel_parentesco ?? ''],
        ['Documento', p.responsavel_documento ?? ''],
        ['Telefone', p.responsavel_telefone ?? ''],
      ],
    },
  ]
  return (
    <>
      {blocos.map((b) => (
        <div key={b.titulo} className="flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
          <h3 className="text-corpo font-semibold text-tinta">{b.titulo}</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-[18px] gap-y-3">
            {b.campos.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{rotulo}</span>
                <span className={cn('text-controle break-words', valor ? 'text-tinta' : 'text-tinta-sussurro')}>{valor || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

export function DadosPaciente({
  unidadeId,
  perfilId,
  dados,
  onChange,
  escalaSetores,
  setoresInternacao,
  setorDestino,
  onSetorDestino,
}: {
  unidadeId?: string
  perfilId?: string
  dados: DadosPaciente
  onChange: (p: Partial<DadosPaciente>) => void
  escalaSetores?: { id: string; nome: string }[]
  setoresInternacao?: { id: string; nome: string }[]
  setorDestino?: string
  onSetorDestino?: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const [cpfBusca, setCpfBusca] = React.useState('')
  const [buscaAtiva, setBuscaAtiva] = React.useState('')
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [anexando, setAnexando] = React.useState(false)
  const [lendoArquivo, setLendoArquivo] = React.useState(false)
  const [statusArquivo, setStatusArquivo] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  // cadastro: 'novo' (pessoa nova) ou 'editar' (completar ou corrigir)
  const [cadastro, setCadastro] = React.useState<'fechado' | 'novo' | 'editar'>('fechado')
  const [form, setForm] = React.useState<Cadastro>(CADASTRO_VAZIO)
  const [formPeso, setFormPeso] = React.useState('')
  const [formAlergias, setFormAlergias] = React.useState('')
  const [salvando, setSalvando] = React.useState(false)
  const [erroCadastro, setErroCadastro] = React.useState<string | null>(null)
  const [duplicata, setDuplicata] = React.useState<{ tipo: 'documento' | 'provavel'; id: string; texto: string } | null>(null)
  const [salvo, setSalvo] = React.useState<string | null>(null)
  const [verDados, setVerDados] = React.useState(false)

  const setorEscolhido = escalaSetores?.[0]?.id

  const { data: pacienteEncontrado, isLoading: buscando } = useQuery({
    queryKey: ['paciente-busca', buscaAtiva, unidadeId],
    enabled: !!buscaAtiva && !!unidadeId,
    queryFn: async () => {
      const termo = `%${buscaAtiva}%`
      // Busca por CPF ou nome
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .or(`cpf.ilike.${termo},nome.ilike.${termo}`)
        .limit(20)
      if (error) throw error
      // Se mais de um resultado, usa o primeiro (exato ou mais recente)
      const lista = data ?? []
      if (lista.length === 0) return null
      const exato = lista.find(
        (p) => (p.cpf && p.cpf.replace(/\D/g, '') === buscaAtiva.replace(/\D/g, '')) || p.nome.toLowerCase() === buscaAtiva.toLowerCase()
      )
      return exato ?? lista[0]
    },
  })

  React.useEffect(() => {
    if (!pacienteEncontrado) return
    const nasc = pacienteEncontrado.data_nascimento
      ? (() => {
          const [a, m, d] = pacienteEncontrado.data_nascimento.split('-')
          return `${d}/${m}/${a}`
        })()
      : dados.nascimento
    onChange({
      nome: pacienteEncontrado.nome,
      nascimento: nasc,
      dataAtual: dados.dataAtual || hojeLocal(),
      leito: dados.leito,
      paciente_id: pacienteEncontrado.id,
      setor_id: pacienteEncontrado.setor_id ?? dados.setor_id ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteEncontrado])

  // o cadastro do paciente em uso (a RLS decide se dá para ler)
  const pacienteId = dados.paciente_id ?? null
  const cadastroAtual = useQuery({
    queryKey: ['paciente-cadastro', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('*').eq('id', pacienteId!).maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as PacienteLinha | null
    },
  })
  const paciente = cadastroAtual.data ?? null

  const atendimentos = useQuery({
    queryKey: ['paciente-atendimentos', pacienteId],
    enabled: !!pacienteId && verDados,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimentos_do_paciente', { p_paciente: pacienteId! })
      if (error) throw error
      return (data ?? []) as Atendimento[]
    },
  })

  const faltasAih = paciente ? faltasParaAih(paciente) : []

  function abrirCadastro(tipo: 'novo' | 'editar') {
    setErroCadastro(null)
    setDuplicata(null)
    setSalvo(null)
    setFormPeso(dados.peso)
    setFormAlergias(dados.alergias)
    if (tipo === 'editar') {
      setForm(paraFormulario(paciente))
    } else {
      // começa com o que já foi digitado no documento ou na busca
      const t = buscaAtiva || cpfBusca
      const digitos = t.replace(/\D/g, '')
      setForm({
        ...CADASTRO_VAZIO,
        nome: dados.nome || (/\d/.test(t) ? '' : t.trim()),
        data_nascimento: brParaIso(dados.nascimento),
        cpf: digitos.length === 11 ? digitos : '',
      })
    }
    setCadastro(tipo)
  }

  const mudarForm = (k: CampoCadastro, v: string) => {
    setErroCadastro(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function salvarCadastro({ outraPessoa = false, usarId }: { outraPessoa?: boolean; usarId?: string } = {}) {
    setErroCadastro(null)
    if (usarId) {
      // duplicata: usar o cadastro que já existe
      onChange({ paciente_id: usarId })
      setCadastro('fechado')
      setDuplicata(null)
      return
    }
    if (form.nome.trim().length < 3) return setErroCadastro('Nome é obrigatório.')
    const primeiro = Object.values(errosCadastro(form))[0]
    if (primeiro) return setErroCadastro(primeiro)
    const novo = cadastro === 'novo'
    if (novo && (!unidadeId || !setorEscolhido)) return setErroCadastro('Nenhum setor da escala disponível para cadastrar o paciente.')

    // na edição, só o que mudou; no cadastro novo, tudo
    const antes = paraFormulario(paciente)
    const normal = normalizarCadastro(form)
    const enviados = novo
      ? normal
      : Object.fromEntries(Object.entries(normal).filter(([k, v]) => v !== normalizarCadastro(antes)[k as CampoCadastro]))

    setSalvando(true)
    const { data, error } = await supabase.rpc('salvar_cadastro_paciente', {
      p_paciente: novo ? undefined : pacienteId!,
      p_dados: enviados,
      p_setor: novo ? setorEscolhido : undefined,
      p_outra_pessoa: outraPessoa,
    })
    setSalvando(false)
    if (error) {
      const m = error.message.match(/^CADASTRO_DUPLICATA_(DOCUMENTO|PROVAVEL):([0-9a-f-]{36}) (.*)$/)
      if (m) setDuplicata({ tipo: m[1] === 'DOCUMENTO' ? 'documento' : 'provavel', id: m[2], texto: m[3] })
      else setErroCadastro(error.message)
      return
    }
    const r = data as { paciente_id: string; prontuario: string; setor_id: string | null }
    // "Salvar e usar neste atendimento": o documento passa a usar este cadastro
    onChange({
      nome: form.nome.trim(),
      nascimento: isoParaBr(form.data_nascimento) || dados.nascimento,
      dataAtual: dados.dataAtual || hojeLocal(),
      paciente_id: r.paciente_id,
      setor_id: r.setor_id ?? dados.setor_id ?? null,
      peso: formPeso,
      alergias: formAlergias,
    })
    void queryClient.invalidateQueries({ queryKey: ['paciente-cadastro', r.paciente_id] })
    void queryClient.invalidateQueries({ queryKey: ['paciente-busca'] })
    setSalvo(novo ? `Cadastro criado · prontuário ${r.prontuario}.` : 'Cadastro atualizado.')
    setCadastro('fechado')
    setDuplicata(null)
  }

  async function anexarArquivo() {
    if (!arquivo || !unidadeId) return
    setAnexando(true)
    setErro(null)
    try {
      const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const caminho = `${unidadeId}/atendimento/${crypto.randomUUID()}-${nomeSeguro}`
      const { error } = await supabase.storage.from('atendimento').upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      setStatusArquivo('Arquivo anexado com sucesso.')
    } catch {
      setErro('Falha ao anexar o arquivo.')
    } finally {
      setAnexando(false)
    }
  }

  async function lerArquivo() {
    if (!arquivo) return
    setLendoArquivo(true)
    setStatusArquivo('Lendo arquivo, aguarde...')
    setErro(null)
    try {
      const MAX = 10 * 1024 * 1024
      if (arquivo.size > MAX) throw new Error('Arquivo muito grande (máximo 10 MB).')

      let texto = ''
      if (arquivo.type === 'application/pdf') {
        texto = await extrairTextoPdf(arquivo)
        if (!texto.trim()) throw new Error('PDF sem texto pesquisável. Digite os dados manualmente.')
      } else if (arquivo.type.startsWith('image/')) {
        texto = await extrairTextoImagem(arquivo)
      } else {
        throw new Error('Formato de arquivo não suportado.')
      }

      const nomeAtual = dados.nome.trim()
      if (nomeAtual) {
        const pac = normalizarNome(nomeAtual)
        const flat = normalizarNome(texto)
        const regex = /paciente:\s*([^\n\r]+)/i
        const match = texto.match(regex)
        let valido = false
        if (match?.[1]) {
          const lido = normalizarNome(match[1].trim())
          valido = lido.includes(pac)
        }
        if (!valido) valido = flat.includes(pac)
        if (!valido) {
          throw new Error(
            `O nome no arquivo não corresponde ao paciente (${nomeAtual}). Upload bloqueado para evitar troca de exames.`
          )
        }
      }
      setStatusArquivo('Dados extraídos do arquivo. Confira os campos abaixo.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao ler o arquivo.')
      setStatusArquivo(null)
    } finally {
      setLendoArquivo(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="size-4 text-tinta-sussurro" /> Dados do Paciente
        </CardTitle>
        <CardDescription>
          Identifique o paciente (busca por CPF/nome, cadastro ou anexo do arquivo de atendimento). Os
          dados refletem em prescrições e documentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Identificação */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="CPF ou nome do paciente…"
              value={cpfBusca}
              onChange={(e) => setCpfBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setBuscaAtiva(cpfBusca.trim())
              }}
            />
            <Button onClick={() => setBuscaAtiva(cpfBusca.trim())}>
              <Search /> Buscar
            </Button>
          </div>

          {buscando && (
            <div className="flex h-10 items-center justify-center">
              <Spinner />
            </div>
          )}

          {!buscando && buscaAtiva && !pacienteEncontrado && cadastro === 'fechado' && (
            <div className="rounded-xl border border-dashed p-3 text-sm text-tinta-sussurro">
              Paciente não encontrado.{' '}
              <button className="font-medium text-acao hover:underline" onClick={() => abrirCadastro('novo')}>
                Cadastrar novo paciente
              </button>
            </div>
          )}

          {pacienteId && paciente && cadastro === 'fechado' && (
            <div className="flex flex-col gap-2 rounded-xl border border-conforme/30 bg-conforme/[0.08] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-conforme">{paciente.nome_social ? `${paciente.nome_social} (${paciente.nome})` : paciente.nome}</div>
                  <div className="text-xs text-conforme">
                    {[
                      paciente.prontuario ? `Pront. ${paciente.prontuario}` : null,
                      paciente.cpf ? `CPF ${formatarCpf(paciente.cpf)}` : null,
                      paciente.cns ? `CNS ${formatarCns(paciente.cns)}` : null,
                      rotuloDe(SEXOS, paciente.sexo) || null,
                      paciente.data_nascimento ? `${isoParaBr(paciente.data_nascimento)} · ${idadeLegivel(paciente.data_nascimento)}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setVerDados((v) => !v)} aria-expanded={verDados}>
                    <History /> {verDados ? 'Esconder dados' : 'Dados e atendimentos'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirCadastro('editar')}>
                    <PencilLine /> Completar ou corrigir cadastro
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!pacienteId && cadastro === 'fechado' && !buscaAtiva && (
            <button type="button" className="self-start text-sm font-medium text-acao hover:underline" onClick={() => abrirCadastro('novo')}>
              <Plus className="mr-1 inline size-3.5" />Novo paciente
            </button>
          )}

          {pacienteId && paciente && faltasAih.length > 0 && cadastro === 'fechado' && (
            <div role="status" className="flex items-start gap-2 rounded-container border border-atencao/25 bg-alerta-atencao px-3.5 py-2.5 text-apoio text-atencao">
              <TriangleAlert className="mt-0.5 size-[15px] shrink-0" aria-hidden />
              <span className="text-pretty">
                Para o laudo de AIH sair completo, falta no cadastro: {faltasAih.join(', ')}.{' '}
                <button type="button" className="font-medium underline underline-offset-2" onClick={() => abrirCadastro('editar')}>Completar agora</button>
              </span>
            </div>
          )}

          {salvo && cadastro === 'fechado' && (
            <p role="status" className="flex items-center gap-1.5 text-apoio text-acao"><Check className="size-4" /> {salvo}</p>
          )}

          {pacienteId && paciente && verDados && cadastro === 'fechado' && (
            <div className="flex flex-col gap-3.5">
              <BlocosCadastro p={paciente} />
              <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
                <div className="border-b border-trilha px-5 py-3.5"><h3 className="text-corpo font-semibold text-tinta">Atendimentos</h3></div>
                {atendimentos.isLoading && <div className="px-5 py-4"><Spinner /></div>}
                {atendimentos.error && <p className="px-5 py-3 text-apoio text-critico">{(atendimentos.error as Error).message}</p>}
                {atendimentos.data?.length === 0 && (
                  <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum atendimento que você possa ver agora.</p>
                )}
                {atendimentos.data?.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
                    <span className="flex-none text-apoio font-semibold tabular-nums text-acao">{a.id.slice(0, 8).toUpperCase()}</span>
                    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                      <span className="text-controle text-tinta">{a.setor}</span>
                      <span className="text-apoio text-pretty text-tinta-sussurro">
                        {dataHora(a.chegada_em)}{a.encerrado_em ? ` a ${dataHora(a.encerrado_em)}` : ''} · {a.prestador ?? 'sem médico'}
                      </span>
                    </div>
                    {a.cor_atual && <PilulaRisco cor={a.cor_atual} />}
                    <span className="text-apoio text-tinta-apoio">
                      {a.etapa === 'encerrado' ? (DESFECHO[a.desfecho ?? ''] ?? 'Encerrado') : (SITUACAO[a.etapa] ?? a.etapa)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-apoio text-tinta-sussurro">Os dados vêm do cadastro do paciente. Atendimentos de setores fora do seu plantão não aparecem.</p>
            </div>
          )}

          {cadastro !== 'fechado' && (
            <section aria-label="Cadastro do paciente" className="flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-corpo font-semibold text-tinta">{cadastro === 'editar' ? 'Completar cadastro' : 'Novo paciente'}</h3>
                {cadastro === 'novo' && escalaSetores && escalaSetores.length > 0 && (
                  <span className="text-xs text-tinta-sussurro">Setor (da escala atual): <Badge variant="outline">{escalaSetores[0].nome}</Badge></span>
                )}
              </div>
              {duplicata && (
                <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-container border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5">
                  <TriangleAlert className="size-[15px] text-atencao" aria-hidden />
                  <span className="min-w-0 flex-[1_1_240px] text-apoio text-atencao">{duplicata.texto}</span>
                  <Button variant="outline" onClick={() => void salvarCadastro({ usarId: duplicata.id })}>Usar o cadastro existente</Button>
                  {duplicata.tipo === 'provavel' && (
                    <Button variant="outline" onClick={() => void salvarCadastro({ outraPessoa: true })}>É outra pessoa</Button>
                  )}
                </div>
              )}
              <CamposCadastro
                prefixo="dp"
                valores={form}
                onChange={mudarForm}
                extras={
                  <>
                    <Campo id="dp-peso" rotulo="Peso (kg)" className="flex-[1_1_120px]">
                      <Input id="dp-peso" type="number" min={0} step="0.1" value={formPeso} onChange={(e) => setFormPeso(e.target.value)} />
                    </Campo>
                    <Campo id="dp-alergias" rotulo="Alergias (separe por vírgula)" className="basis-full" dica="Vai para este documento; o registro de alergias do paciente fica no cabeçalho.">
                      <Input id="dp-alergias" value={formAlergias} onChange={(e) => setFormAlergias(e.target.value)} placeholder="Ex.: Dipirona (ou NEGA)" />
                    </Campo>
                  </>
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {erroCadastro ? (
                  <span role="alert" className="flex items-center gap-1.5 text-apoio text-critico"><TriangleAlert className="size-3.5" />{erroCadastro}</span>
                ) : <span />}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => setCadastro('fechado')}>Cancelar</Button>
                  <Button disabled={salvando} onClick={() => void salvarCadastro()}>
                    {salvando ? <Spinner className="size-4" /> : <Check />} Salvar e usar neste atendimento
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Anexar / ler arquivo do atendimento */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <Label htmlFor="int-arquivo" className="flex items-center gap-2">
              <FileText className="size-4 text-tinta-sussurro" />
              Anexar arquivo do atendimento (PDF ou imagem)
            </Label>
            <Input
              id="int-arquivo"
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-tinta-sussurro">{arquivo.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={anexarArquivo} disabled={anexando || !unidadeId}>
                    {anexando ? <Spinner /> : <FolderUp />} Anexar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={lerArquivo} disabled={lendoArquivo}>
                    {lendoArquivo ? <Loader2 className="animate-spin" /> : <FileText />} Extrair dados
                  </Button>
                </div>
              </div>
            )}
            {lendoArquivo && (
              <p className="text-xs text-suprimento">Lendo o arquivo, isso pode levar alguns segundos…</p>
            )}
            {statusArquivo && <p className="text-xs text-conforme">{statusArquivo}</p>}
          </div>
        </div>

        {/* Campos estáticos */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="pac-nome">Nome do paciente</Label>
            <Input id="pac-nome" value={dados.nome} onChange={(e) => onChange({ nome: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-nasc">Data de Nascimento</Label>
            <Input
              id="pac-nasc"
              value={dados.nascimento}
              placeholder="dd/mm/aaaa"
              maxLength={10}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 8)
                if (v.length >= 5) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4)
                else if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2)
                onChange({ nascimento: v })
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-dataatual">Data Atual</Label>
            <Input id="pac-dataatual" type="date" value={dados.dataAtual} onChange={(e) => onChange({ dataAtual: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-idade">Idade</Label>
            <Input
              id="pac-idade"
              value={idadeTexto(dados.nascimento, dados.dataAtual) || dados.idade}
              readOnly
              placeholder="Auto"
              className="bg-trilha"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-peso">Peso (kg)</Label>
            <Input id="pac-peso" type="number" min={0} step="0.1" value={dados.peso} onChange={(e) => onChange({ peso: e.target.value })} placeholder="Ex: 70" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-leito">Leito</Label>
            <Input id="pac-leito" value={dados.leito} onChange={(e) => onChange({ leito: e.target.value })} placeholder="Ex: Enf. A-01" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-dieta">Dieta</Label>
            <Select value={dados.dieta || null} onValueChange={(v) => onChange({ dieta: v ?? 'Dieta livre' })}>
              <SelectTrigger id="pac-dieta" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DIETAS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pac-alergias">Alergias</Label>
            <Input id="pac-alergias" value={dados.alergias} onChange={(e) => onChange({ alergias: e.target.value })} placeholder="Ex: Dipirona (ou 'NEGA')" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="pac-diag">Diagnóstico / Hipótese diagnóstica</Label>
            <Input id="pac-diag" value={dados.diagnostico} onChange={(e) => onChange({ diagnostico: e.target.value })} placeholder="Ex: Dengue com sinais de alarme" />
          </div>
        </div>

        {setoresInternacao && setorDestino !== undefined && onSetorDestino && (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <Label htmlFor="pac-setor-destino">Setor de destino (internação)</Label>
            <Select value={setorDestino || null} onValueChange={(v) => onSetorDestino(v ?? '')}>
              <SelectTrigger id="pac-setor-destino" className="w-full">
                <SelectValue placeholder="Selecione para onde o paciente será direcionado" />
              </SelectTrigger>
              <SelectContent>
                {setoresInternacao.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-tinta-sussurro">
              Ao salvar/continuar, o paciente será vinculado a este setor. Transferências entre
              setores ficam registradas em auditoria.
            </p>
          </div>
        )}

        {erro && <p className="text-sm text-critico">{erro}</p>}
        {perfilId && (
          <p className="text-xs text-tinta-sussurro">
            Salvo automaticamente para a unidade atual · ID do plantonista: {perfilId.slice(0, 8)}…
          </p>
        )}
      </CardContent>
    </Card>
  )
}
