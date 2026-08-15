import { useQuery } from '@tanstack/react-query'
import { FolderUp, Plus, Search, Stethoscope, FileText, Loader2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { DadosPaciente } from './rascunho'

const DIETAS = ['Dieta livre', 'Dieta branda', 'Dieta líquida', 'Dieta zero (jejum)', 'Dieta para diabético', 'Dieta hipossódica', 'Outra']

function idadeTexto(nascimento: string, dataAtual: string) {
  if (!nascimento || !dataAtual) return ''
  const partes = nascimento.split('/')
  if (partes.length !== 3) return ''
  const dn = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]))
  const da = new Date(dataAtual)
  if (isNaN(dn.getTime()) || isNaN(da.getTime())) return ''
  let anos = da.getFullYear() - dn.getFullYear()
  let meses = da.getMonth() - dn.getMonth()
  if (meses < 0 || (meses === 0 && da.getDate() < dn.getDate())) {
    anos--
    meses += 12
  }
  if (da.getDate() < dn.getDate()) meses--
  if (anos > 0) return `${anos} anos`
  if (meses > 0) return `${meses} meses`
  const dias = Math.floor((da.getTime() - dn.getTime()) / (1000 * 3600 * 24))
  return `${Math.max(0, dias)} dias`
}

function hoje() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizarNome(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export function DadosPaciente({
  unidadeId,
  perfilId,
  dados,
  onChange,
  escalaSetores,
}: {
  unidadeId?: string
  perfilId?: string
  dados: DadosPaciente
  onChange: (p: Partial<DadosPaciente>) => void
  escalaSetores?: { id: string; nome: string }[]
}) {
  const [cpfBusca, setCpfBusca] = React.useState('')
  const [buscaAtiva, setBuscaAtiva] = React.useState('')
  const [novoPaciente, setNovoPaciente] = React.useState(false)
  const [formNovo, setFormNovo] = React.useState({ nome: '', cpf: '', data_nascimento: '', sexo: '' })
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [anexando, setAnexando] = React.useState(false)
  const [lendoArquivo, setLendoArquivo] = React.useState(false)
  const [statusArquivo, setStatusArquivo] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [criando, setCriando] = React.useState(false)

  const setorEscolhido = escalaSetores?.[0]?.id

  const { data: pacienteEncontrado, isLoading: buscando } = useQuery({
    queryKey: ['paciente-busca', buscaAtiva, unidadeId],
    enabled: !!buscaAtiva && !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('cpf', `%${buscaAtiva}%`)
        .maybeSingle()
      if (error) throw error
      return data
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
      dataAtual: dados.dataAtual || hoje(),
      leito: dados.leito,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteEncontrado])

  async function cadastrarPaciente() {
    if (!unidadeId || !setorEscolhido) {
      setErro('Nenhum setor da escala disponível para cadastrar o paciente.')
      return
    }
    setCriando(true)
    setErro(null)
    const { error } = await supabase.from('pacientes').insert({
      unidade_id: unidadeId,
      setor_id: setorEscolhido,
      nome: formNovo.nome,
      cpf: formNovo.cpf || null,
      data_nascimento: formNovo.data_nascimento || null,
      sexo: formNovo.sexo || null,
    })
    setCriando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setBuscaAtiva(formNovo.cpf || formNovo.nome)
    setNovoPaciente(false)
    setFormNovo({ nome: '', cpf: '', data_nascimento: '', sexo: '' })
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
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
          <Stethoscope className="size-4 text-muted-foreground" /> Dados do Paciente
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

          {!buscando && buscaAtiva && !pacienteEncontrado && (
            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              Paciente não encontrado.{' '}
              <button
                className="font-medium text-primary hover:underline"
                onClick={() => setNovoPaciente((v) => !v)}
              >
                Cadastrar novo paciente
              </button>
            </div>
          )}

          {novoPaciente && (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="int-nome">Nome</Label>
                  <Input id="int-nome" value={formNovo.nome} onChange={(e) => setFormNovo((f) => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="int-cpf">CPF</Label>
                  <Input id="int-cpf" value={formNovo.cpf} onChange={(e) => setFormNovo((f) => ({ ...f, cpf: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="int-nasc">Nascimento</Label>
                  <Input id="int-nasc" type="date" value={formNovo.data_nascimento} onChange={(e) => setFormNovo((f) => ({ ...f, data_nascimento: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="int-sexo">Sexo</Label>
                  <Input id="int-sexo" value={formNovo.sexo} onChange={(e) => setFormNovo((f) => ({ ...f, sexo: e.target.value }))} placeholder="M / F" />
                </div>
              </div>
              {escalaSetores && escalaSetores.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Setor (da escala atual): <Badge variant="outline">{escalaSetores[0].nome}</Badge>
                </p>
              )}
              <div>
                <Button onClick={cadastrarPaciente} disabled={criando || !formNovo.nome}>
                  {criando ? <Spinner /> : <Plus />} Cadastrar
                </Button>
              </div>
            </div>
          )}

          {!buscando && pacienteEncontrado && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="font-semibold text-emerald-900">{pacienteEncontrado.nome}</div>
              <div className="text-xs text-emerald-700">
                CPF {pacienteEncontrado.cpf ?? '—'} · {pacienteEncontrado.sexo ?? ''} ·{' '}
                {pacienteEncontrado.data_nascimento ?? ''}
              </div>
            </div>
          )}

          {/* Anexar / ler arquivo do atendimento */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <Label htmlFor="int-arquivo" className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
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
                <span className="text-sm text-muted-foreground">{arquivo.name}</span>
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
              <p className="text-xs text-sky-700">Lendo o arquivo, isso pode levar alguns segundos…</p>
            )}
            {statusArquivo && <p className="text-xs text-emerald-700">{statusArquivo}</p>}
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
              className="bg-muted"
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

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {perfilId && (
          <p className="text-xs text-muted-foreground">
            Salvo automaticamente para a unidade atual · ID do plantonista: {perfilId.slice(0, 8)}…
          </p>
        )}
      </CardContent>
    </Card>
  )
}
