import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ClipboardPlus,
  FileText,
  FolderUp,
  Hospital,
  Pill,
  Plus,
  Search,
  Stethoscope,
} from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { uploadBannerImagem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export default function Internacao() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const unidadeId = unidadeAtiva?.unidade_id

  const [cpfBusca, setCpfBusca] = React.useState('')
  const [buscaAtiva, setBuscaAtiva] = React.useState('')
  const [novoPaciente, setNovoPaciente] = React.useState(false)
  const [formNovo, setFormNovo] = React.useState({ nome: '', cpf: '', data_nascimento: '', sexo: '' })
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [arquivoUrl, setArquivoUrl] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [criando, setCriando] = React.useState(false)

  // Setores da escala atual do plantonista (relógio do servidor)
  const { data: escalaSetores } = useQuery({
    queryKey: ['escala-setores-atual'],
    enabled: !!unidadeId,
    queryFn: async () => {
      const [turno, hoje] = await Promise.all([
        supabase.rpc('turno_atual'),
        supabase.rpc('data_atual'),
      ])
      if (!hoje.data) return []
      const { data } = await supabase
        .from('escala_plantoes')
        .select('setor_id, setores(id, nome)')
        .eq('perfil_id', perfil!.id)
        .eq('ativo', true)
        .eq('data', hoje.data as string)
        .eq('turno', turno.data as string)
      return (data ?? []).map((e) => e.setores as { id: string; nome: string } | null).filter((s): s is { id: string; nome: string } => !!s)
    },
  })

  const { data: pacienteEncontrado, isLoading: buscando } = useQuery({
    queryKey: ['paciente-busca', buscaAtiva],
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

  const setorEscolhido = escalaSetores?.[0]?.id

  async function anexarArquivo() {
    if (!arquivo || !unidadeId) return
    const url = await uploadBannerImagem(unidadeId, arquivo)
    setArquivoUrl(url)
  }

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

  const paciente = pacienteEncontrado

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantao" className="transition-colors hover:text-foreground">
            Central de Plantão
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Internação</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Internação</h1>
        <p className="text-sm text-muted-foreground">
          Identifique o paciente (ou anexe o arquivo do atendimento). A partir dos dados, siga com
          admissão, prescrição, exames e documento de internação.
        </p>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {/* Identificação do paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4 text-muted-foreground" /> Paciente
          </CardTitle>
          <CardDescription>
            Busque por CPF/nome ou cadastre um novo paciente do seu setor da escala.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="CPF ou nome do paciente…"
              value={cpfBusca}
              onChange={(e) => setCpfBusca(e.target.value)}
            />
            <Button onClick={() => setBuscaAtiva(cpfBusca.trim())}>
              <Search /> Buscar
            </Button>
          </div>

          {buscando && (
            <div className="flex h-16 items-center justify-center"><Spinner /></div>
          )}

          {!buscando && paciente && (
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{paciente.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    CPF {paciente.cpf ?? '—'} · {paciente.sexo ?? ''} · {paciente.data_nascimento ?? ''}
                  </div>
                </div>
                <Badge variant="success">Encontrado</Badge>
              </div>
            </div>
          )}

          {!buscando && buscaAtiva && !paciente && (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Paciente não encontrado.{' '}
              <button className="font-medium text-primary hover:underline" onClick={() => setNovoPaciente((v) => !v)}>
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

          {/* Anexar arquivo do atendimento */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <Label htmlFor="int-arquivo" className="flex items-center gap-2">
              <FolderUp className="size-4 text-muted-foreground" />
              Anexar arquivo do atendimento
            </Label>
            <Input id="int-arquivo" type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            {arquivo && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{arquivo.name}</span>
                <Button size="sm" variant="outline" onClick={anexarArquivo}>
                  <FolderUp /> Anexar
                </Button>
              </div>
            )}
            {arquivoUrl && (
              <p className="text-xs text-emerald-700">Arquivo anexado com sucesso.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Módulos a partir dos dados do paciente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seguir com o atendimento</CardTitle>
          <CardDescription>
            Módulos disponíveis a partir dos dados do paciente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: ClipboardPlus, label: 'Admissão', desc: 'Abrir ficha de admissão.' },
            { icon: Pill, label: 'Prescrição', desc: 'Prescrição médica (receituário).' },
            { icon: FileText, label: 'Solicitação de Exames', desc: 'Pedido de exames.' },
          ].map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => navigate('/plantao/atendimento-porta/' + (m.label === 'Prescrição' ? 'receituario-medico' : m.label === 'Admissão' ? 'encaminhamento' : 'pedido-exames'))}
              className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.desc}</span>
              </span>
            </button>
          ))}

          {/* Documento de Internação — AIH ou Encaminhamento */}
          <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Hospital className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium">Documento de Internação</div>
                <div className="text-xs text-muted-foreground">Escolha o tipo:</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/plantao/internacao/aih')}>
                AIH
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/plantao/atendimento-porta/encaminhamento')}>
                Encaminhamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
