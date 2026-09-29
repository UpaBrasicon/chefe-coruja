import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Search, Tv, UserPlus, UserRoundCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { UFS } from '@/lib/constants'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { ordemTriagem, PRIORIDADE_ROTULO, PRIORIDADES_INFORMADAS, rotulosPrioridade, type PrioridadeLegal } from '@/domain/prioridade'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { RetirarDaFila } from '@/components/porta/Chamada'

// Recepção (Fase 2.1): procurar antes de cadastrar, abrir a ficha — que abre o
// episódio — e ver a fila da triagem da porta. A Recepção não lê prontuário:
// a busca devolve só identificação, com CPF e CNS mascarados.

type Porta = { id: string; nome: string; publico: 'todos' | 'adulto' | 'pediatrico' }
type Achado = {
  id: string
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  nome_mae: string | null
  cpf_final: string | null
  cns_final: string | null
  prontuario: string | null
  episodio_etapa: string | null
}
type NaFila = {
  id: string
  chegada_em: string
  queixa: string
  prioridades_legais: string[]
  paciente: { nome: string; data_nascimento: string | null } | null
}

const VAZIO = {
  nome: '', nome_social: '', data_nascimento: '', sexo: '', nome_mae: '', cpf: '', cns: '', telefone: '',
  endereco: '', municipio: '', uf: '', responsavel_nome: '', responsavel_parentesco: '', responsavel_documento: '',
  responsavel_telefone: '',
}
type Dados = typeof VAZIO

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  )
}

export default function Recepcao() {
  const { unidadeAtiva, papeisDaUnidade } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papeisDaUnidade.includes('gestor')
  const queryClient = useQueryClient()

  // ── portas (setores de emergência) em que a pessoa pode abrir ficha ──────
  const { data: portas } = useQuery({
    queryKey: ['recepcao-portas', unidadeId, ehGestor],
    enabled: !!unidadeId,
    queryFn: async (): Promise<Porta[]> => {
      let q = supabase.from('setores').select('id, nome, publico').eq('unidade_id', unidadeId!).eq('tipo', 'emergencia').eq('ativo', true)
      if (!ehGestor) {
        const { data: ids, error } = await supabase.rpc('setores_na_escala_agora')
        if (error) throw error
        const lista = (Array.isArray(ids) ? ids : []) as string[]
        if (lista.length === 0) return []
        q = q.in('id', lista)
      }
      const { data, error } = await q.order('ordem')
      if (error) throw error
      return (data ?? []) as Porta[]
    },
  })
  const [portaId, setPortaId] = React.useState<string | null>(null)
  const porta = portas?.find((p) => p.id === portaId) ?? (portas?.length === 1 ? portas[0] : undefined)

  // ── busca ────────────────────────────────────────────────────────────────
  const [termo, setTermo] = React.useState('')
  const [buscado, setBuscado] = React.useState('')
  const busca = useQuery({
    queryKey: ['recepcao-busca', unidadeId, buscado],
    enabled: !!unidadeId && buscado.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId!, p_termo: buscado })
      if (error) throw error
      return (data ?? []) as Achado[]
    },
  })

  // ── ficha ────────────────────────────────────────────────────────────────
  const [modo, setModo] = React.useState<'nenhum' | 'existente' | 'novo'>('nenhum')
  const [existente, setExistente] = React.useState<Achado | null>(null)
  const [dados, setDados] = React.useState<Dados>(VAZIO)
  const [queixa, setQueixa] = React.useState('')
  const [prioridades, setPrioridades] = React.useState<PrioridadeLegal[]>([])
  const [duplicata, setDuplicata] = React.useState<{ tipo: 'documento' | 'provavel'; id: string; texto: string } | null>(null)
  const [aberta, setAberta] = React.useState<string | null>(null)

  const mudar = (k: keyof Dados) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDados((d) => ({ ...d, [k]: e.target.value }))

  function limpar() {
    setModo('nenhum')
    setExistente(null)
    setDados(VAZIO)
    setQueixa('')
    setPrioridades([])
    setDuplicata(null)
  }

  function usarExistente(a: Achado) {
    setExistente(a)
    setModo('existente')
    setDados(VAZIO)
    setDuplicata(null)
  }

  const registrar = useMutation({
    mutationFn: async ({ outraPessoa, pacienteId }: { outraPessoa?: boolean; pacienteId?: string } = {}) => {
      if (!porta) throw new Error('Escolha a porta de entrada.')
      // p_dados: pessoa nova manda tudo; cadastro existente manda só contato e
      // responsável preenchidos — a identificação dele não é trocada daqui
      const identidade = ['nome', 'nome_social', 'data_nascimento', 'sexo', 'nome_mae']
      const paraExistente = !!pacienteId || modo === 'existente'
      const enviados = Object.fromEntries(
        Object.entries(dados).filter(([k, v]) => (paraExistente ? v.trim() !== '' && !identidade.includes(k) : true))
      )
      const { data, error } = await supabase.rpc('registrar_ficha', {
        p_setor: porta.id,
        p_queixa: queixa,
        p_paciente: pacienteId ?? existente?.id ?? undefined,
        p_dados: enviados,
        p_prioridades: prioridades,
        p_outra_pessoa: outraPessoa ?? false,
      })
      if (error) throw error
      return data as { prontuario: string }
    },
    onSuccess: (r) => {
      setAberta(`Ficha aberta · prontuário ${r.prontuario}. O paciente está na fila da triagem.`)
      limpar()
      setTermo('')
      setBuscado('')
      void queryClient.invalidateQueries({ queryKey: ['recepcao-fila'] })
    },
    onError: (e: Error) => {
      const m = e.message.match(/^FICHA_DUPLICATA_(DOCUMENTO|PROVAVEL):([0-9a-f-]{36}) (.*)$/)
      if (m) setDuplicata({ tipo: m[1] === 'DOCUMENTO' ? 'documento' : 'provavel', id: m[2], texto: m[3] })
    },
  })

  // ── fila da triagem ──────────────────────────────────────────────────────
  const fila = useQuery({
    queryKey: ['recepcao-fila', porta?.id],
    enabled: !!porta,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodios')
        .select('id, chegada_em, queixa, prioridades_legais, paciente:pacientes(nome, data_nascimento)')
        .eq('setor_id', porta!.id)
        .eq('etapa', 'triagem')
      if (error) throw error
      return ((data ?? []) as unknown as NaFila[]).sort(ordemTriagem)
    },
  })

  const podeRegistrar =
    !!porta && queixa.trim().length >= 3 && (modo === 'existente' || (modo === 'novo' && dados.nome.trim().length >= 3))
  const erro = registrar.error && !duplicata ? registrar.error.message.replace(/^FICHA_[A-Z_]+:\s*/, '') : null

  return (
    <>
      <TituloPagina icone={ClipboardList} titulo="Recepção" descricao="Procure o paciente antes de cadastrar. A ficha abre o episódio e vai para a fila da triagem." />

      {portas && portas.length === 0 && (
        <Vazio icone={ClipboardList} titulo="Você não está escalado numa porta agora" texto="A ficha abre numa porta (setor de emergência) em que você está de plantão." />
      )}

      {portas && portas.length > 1 && (
        <Chips rotulo="Porta de entrada">
          {portas.map((p) => (
            <Chip key={p.id} ativo={porta?.id === p.id} onClick={() => setPortaId(p.id)}>
              {p.nome}
            </Chip>
          ))}
        </Chips>
      )}

      {porta && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              // a janela abre já (dentro do clique) e recebe o endereço depois
              const janela = window.open('', '_blank')
              const { data, error } = await supabase.rpc('gerar_link_painel', { p_setor: porta.id })
              if (error || !data) {
                janela?.close()
                setAberta(null)
                alert(error?.message ?? 'Não foi possível abrir o painel.')
                return
              }
              if (janela) janela.location.href = `/painel/${data as string}`
            }}
          >
            <Tv /> Abrir painel da TV
          </Button>
          <span className="text-xs text-tinta-sussurro">Gerar de novo desliga o link anterior.</span>
        </div>
      )}

      {aberta && <p role="status" className="text-sm text-conforme">{aberta}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-4">
          {modo === 'nenhum' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Procurar paciente</CardTitle>
                <CardDescription>Nome, nome da mãe, CPF, Cartão SUS ou número do prontuário.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setAberta(null)
                    setBuscado(termo.trim())
                  }}
                >
                  <Input aria-label="Buscar paciente" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: Maria de Souza" />
                  <Button type="submit" disabled={termo.trim().length < 3}>
                    <Search /> Buscar
                  </Button>
                </form>
                {busca.isFetching && <Spinner />}
                {busca.error && <p className="text-sm text-critico">{(busca.error as Error).message}</p>}
                {busca.data && buscado && (
                  <div className="flex flex-col gap-2">
                    {busca.data.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhum cadastro encontrado.</p>}
                    {busca.data.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-controle border border-fio p-3">
                        <div className="min-w-0">
                          <div className="font-medium text-tinta">
                            {a.nome_social ? `${a.nome_social} (${a.nome})` : a.nome}
                          </div>
                          <div className="text-xs text-tinta-sussurro">
                            {a.data_nascimento ? `${dataBr(a.data_nascimento)} · ${rotuloIdade(a.data_nascimento, hoje())}` : 'Nascimento não informado'}
                            {a.nome_mae && ` · mãe ${a.nome_mae}`}
                            {a.cpf_final && ` · CPF ${a.cpf_final}`}
                            {a.prontuario && ` · pront. ${a.prontuario}`}
                          </div>
                        </div>
                        {a.episodio_etapa ? (
                          <Badge variant="outline">Já está na unidade ({a.episodio_etapa})</Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => usarExistente(a)}>
                            <UserRoundCheck /> Usar este cadastro
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="ghost" className="self-start" onClick={() => { setModo('novo'); setDados({ ...VAZIO, nome: /\d/.test(buscado) ? '' : buscado }) }}>
                      <UserPlus /> Não encontrei: cadastrar novo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {modo !== 'nenhum' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{modo === 'existente' ? existente?.nome : 'Novo cadastro'}</CardTitle>
                <CardDescription>
                  {modo === 'existente'
                    ? `Prontuário ${existente?.prontuario ?? '—'}. Preencha só o que mudou (telefone, endereço, responsável).`
                    : 'Nome e queixa são obrigatórios. Paciente sem identificação pode ser cadastrado com o que se sabe.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {modo === 'novo' && (
                    <>
                      <Campo id="f-nome" rotulo="Nome completo *"><Input id="f-nome" value={dados.nome} onChange={mudar('nome')} /></Campo>
                      <Campo id="f-social" rotulo="Nome social"><Input id="f-social" value={dados.nome_social} onChange={mudar('nome_social')} /></Campo>
                      <Campo id="f-nasc" rotulo="Nascimento"><Input id="f-nasc" type="date" max={hoje()} value={dados.data_nascimento} onChange={mudar('data_nascimento')} /></Campo>
                      <Campo id="f-sexo" rotulo="Sexo">
                        <select id="f-sexo" className="h-9 rounded-controle border border-fio bg-superficie px-2 text-sm" value={dados.sexo} onChange={mudar('sexo')}>
                          <option value="">—</option>
                          <option value="F">Feminino</option>
                          <option value="M">Masculino</option>
                        </select>
                      </Campo>
                      <Campo id="f-mae" rotulo="Nome da mãe"><Input id="f-mae" value={dados.nome_mae} onChange={mudar('nome_mae')} /></Campo>
                    </>
                  )}
                  <Campo id="f-cpf" rotulo="CPF"><Input id="f-cpf" inputMode="numeric" value={dados.cpf} onChange={mudar('cpf')} /></Campo>
                  <Campo id="f-cns" rotulo="Cartão SUS"><Input id="f-cns" inputMode="numeric" value={dados.cns} onChange={mudar('cns')} /></Campo>
                  <Campo id="f-tel" rotulo="Telefone"><Input id="f-tel" inputMode="tel" value={dados.telefone} onChange={mudar('telefone')} /></Campo>
                  <Campo id="f-end" rotulo="Endereço"><Input id="f-end" value={dados.endereco} onChange={mudar('endereco')} /></Campo>
                  <Campo id="f-mun" rotulo="Município"><Input id="f-mun" value={dados.municipio} onChange={mudar('municipio')} /></Campo>
                  <Campo id="f-uf" rotulo="UF">
                    <select id="f-uf" className="h-9 rounded-controle border border-fio bg-superficie px-2 text-sm" value={dados.uf} onChange={mudar('uf')}>
                      <option value="">—</option>
                      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Campo>
                </div>

                <details className="rounded-controle border border-fio p-3">
                  <summary className="cursor-pointer text-sm font-medium text-tinta">Responsável legal (opcional)</summary>
                  <p className="mt-1 text-xs text-tinta-sussurro">Menor sem responsável pode ser cadastrado (abrigo, escola, outro local).</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Campo id="f-rnome" rotulo="Nome"><Input id="f-rnome" value={dados.responsavel_nome} onChange={mudar('responsavel_nome')} /></Campo>
                    <Campo id="f-rpar" rotulo="Parentesco ou vínculo"><Input id="f-rpar" value={dados.responsavel_parentesco} onChange={mudar('responsavel_parentesco')} /></Campo>
                    <Campo id="f-rdoc" rotulo="Documento"><Input id="f-rdoc" value={dados.responsavel_documento} onChange={mudar('responsavel_documento')} /></Campo>
                    <Campo id="f-rtel" rotulo="Telefone"><Input id="f-rtel" inputMode="tel" value={dados.responsavel_telefone} onChange={mudar('responsavel_telefone')} /></Campo>
                  </div>
                </details>

                <Campo id="f-queixa" rotulo="Queixa referida *">
                  <Textarea id="f-queixa" rows={2} value={queixa} onChange={(e) => setQueixa(e.target.value)} placeholder="Nas palavras do paciente ou do acompanhante" />
                </Campo>

                <Chips rotulo="Atendimento prioritário (Lei 10.048/2000) — 60+ e 80+ entram pela idade">
                  {PRIORIDADES_INFORMADAS.map((p) => (
                    <Chip key={p} ativo={prioridades.includes(p)} onClick={() => setPrioridades((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))}>
                      {PRIORIDADE_ROTULO[p]}
                    </Chip>
                  ))}
                </Chips>

                {duplicata && (
                  <div role="alert" className="flex flex-col gap-2 rounded-controle border border-atencao/40 p-3 text-sm">
                    <span className="text-atencao">{duplicata.texto}</span>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => registrar.mutate({ pacienteId: duplicata.id })}>Usar o cadastro existente</Button>
                      {duplicata.tipo === 'provavel' && (
                        <Button size="sm" variant="outline" onClick={() => registrar.mutate({ outraPessoa: true })}>É outra pessoa</Button>
                      )}
                    </div>
                  </div>
                )}
                {erro && <p className="text-sm text-critico">{erro}</p>}

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={limpar}>Cancelar</Button>
                  <Button disabled={!podeRegistrar || registrar.isPending} onClick={() => { setDuplicata(null); registrar.mutate({}) }}>
                    {registrar.isPending ? <Spinner className="size-4" /> : <ClipboardList />} Abrir ficha
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fila da triagem{porta ? ` · ${porta.nome}` : ''}</CardTitle>
            <CardDescription>80+ primeiro, depois as demais prioridades legais, depois a chegada.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {fila.isLoading && <Spinner />}
            {fila.data?.length === 0 && <p className="text-sm text-tinta-sussurro">Ninguém aguardando triagem.</p>}
            {fila.data?.map((e, i) => (
              <div key={e.id} className="flex items-start gap-3 border-b border-fio pb-2 last:border-0">
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-tinta-sussurro">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-tinta">{e.paciente?.nome}</div>
                  <div className="text-xs text-tinta-sussurro">
                    chegou {hora(e.chegada_em)} · {e.queixa}
                  </div>
                  {e.prioridades_legais.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rotulosPrioridade(e.prioridades_legais).map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
                    </div>
                  )}
                  <RetirarDaFila episodioId={e.id} aviso={false} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
