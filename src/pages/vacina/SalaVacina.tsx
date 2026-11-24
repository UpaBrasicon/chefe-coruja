// Sala de vacina da UBS (percurso da UBS, U15, vacina, PR 4; VC1, VC2 e VC4 = A).
//
// O técnico de enfermagem e o enfermeiro de plantão buscam o paciente, veem a
// caderneta e registram a vacina aplicada agora (com o lote da UBS) ou a
// transcrição da caderneta (registro anterior, com a data). As opções seguem
// as regras do LEDI APS 8.7.0; o banco confere de novo.
// Banco: migrations 20270415000025, 20270415000027 e 20270415000028.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Syringe, X } from 'lucide-react'
import * as React from 'react'

import { Chip, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import {
  ANTERIOR_VAZIO, APLICACAO_VAZIA, BCG, CONDICAO_MATERNAL, conferirAnterior, conferirAplicacao, dadosAnterior, dadosAplicacao,
  dosesAnterior, dosesDe, ESTRATEGIA_ESPECIAL, estrategiasDe, locaisDe, pedeCondicaoMaternal, rotuloPendencia,
  type Caderneta, type FormAnterior, type FormAplicacao, type Referencias,
} from '@/domain/salaVacina'
import { lotesParaAplicar, type PainelLotes } from '@/domain/vacinaLotes'
import { hojeSP } from '@/lib/cadastroPaciente'
import { soDigitos } from '@/lib/documentos'
import { dataPura } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null; prontuario: string | null }
const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5 align-top'
const nomeDe = (p: { nome: string; nome_social: string | null }) => p.nome_social || p.nome

export default function SalaVacina() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const [paciente, setPaciente] = React.useState<string | null>(null)
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Syringe} titulo="Sala de vacina"
        descricao="Busque o paciente, veja a caderneta e registre a vacina aplicada agora ou as doses que vieram na caderneta." />
      {!unidade && <Vazio icone={Syringe} titulo="Escolha a unidade" texto="A sala de vacina é da UBS." />}
      {unidade && !paciente && <BuscaPaciente unidade={unidade} onEscolher={setPaciente} />}
      {unidade && paciente && <Paciente unidade={unidade} pacienteId={paciente} onFechar={() => setPaciente(null)} />}
    </div>
  )
}

function BuscaPaciente({ unidade, onEscolher }: { unidade: string; onEscolher: (id: string) => void }) {
  const [termo, setTermo] = React.useState('')
  const [buscado, setBuscado] = React.useState('')
  React.useEffect(() => {
    const t = termo.trim()
    const id = setTimeout(() => setBuscado(t.replace(/[^\p{L}]/gu, '').length >= 3 || soDigitos(t).length >= 4 ? t : ''), 350)
    return () => clearTimeout(id)
  }, [termo])
  const busca = useQuery({
    queryKey: ['vacina-busca', unidade, buscado],
    enabled: !!buscado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidade, p_termo: buscado })
      if (error) throw error
      return (data ?? []) as Achado[]
    },
  })
  const hoje = hojeSP()
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 rounded-cartao border border-fio bg-superficie px-3.5 py-[11px] focus-within:border-acao">
        <Search className="size-[17px] shrink-0 text-tinta-sussurro" aria-hidden />
        <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, CPF, Cartão SUS ou prontuário"
          aria-label="Buscar paciente" className="min-w-0 flex-1 border-0 bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro" />
        {busca.isFetching && <Spinner className="size-4" />}
      </label>
      {busca.error && <MensagemErro texto={(busca.error as Error).message} />}
      {busca.data && busca.data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum cadastro com esse dado. O cadastro novo é feito na recepção.</p>}
      {busca.data && busca.data.length > 0 && (
        <ul className="flex flex-col divide-y divide-trilha rounded-cartao border border-fio bg-superficie">
          {busca.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-corpo text-tinta">
                {nomeDe(a)} <span className="text-apoio text-tinta-sussurro">{a.data_nascimento ? rotuloIdade(a.data_nascimento, hoje) : ''}{a.prontuario ? ` · pront. ${a.prontuario}` : ''}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => onEscolher(a.id)}>Abrir caderneta</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Paciente({ unidade, pacienteId, onFechar }: { unidade: string; pacienteId: string; onFechar: () => void }) {
  const [modo, setModo] = React.useState<'aplicar' | 'anterior'>('aplicar')
  const cad = useQuery({
    queryKey: ['vacina-caderneta', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vacina_caderneta', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as Caderneta
    },
  })
  const refs = useQuery({
    queryKey: ['vacina-referencias'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vacina_referencias')
      if (error) throw error
      return data as unknown as Referencias
    },
  })
  const lotes = useQuery({
    queryKey: ['vacina-lotes', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vacina_lotes_da_unidade', { p_unidade: unidade })
      if (error) throw error
      return data as unknown as PainelLotes
    },
  })
  const erro = cad.error ?? refs.error ?? lotes.error
  if (erro) return <MensagemErro texto={(erro as Error).message} />
  if (!cad.data || !refs.data || !lotes.data) return <EsqueletoLinhas linhas={4} rotulo="Carregando a caderneta…" className="px-0" />
  const c = cad.data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-corpo font-medium text-tinta">
          {nomeDe(c.paciente)}{' '}
          <span className="text-apoio font-normal text-tinta-sussurro">
            {c.paciente.data_nascimento ? `${rotuloIdade(c.paciente.data_nascimento, c.hoje)} · nasc. ${dataPura(c.paciente.data_nascimento)}` : 'sem data de nascimento'}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={onFechar}><X aria-hidden /> Outro paciente</Button>
      </div>
      <EmAtraso c={c} />
      {c.pode_registrar ? (
        <>
          <div role="radiogroup" aria-label="Registrar" className="flex flex-wrap gap-2">
            <Chip variante="opcao" radio ativo={modo === 'aplicar'} onClick={() => setModo('aplicar')}>Aplicar agora</Chip>
            <Chip variante="opcao" radio ativo={modo === 'anterior'} onClick={() => setModo('anterior')}>Transcrever caderneta</Chip>
          </div>
          {modo === 'aplicar'
            ? <FormAplicar c={c} r={refs.data} lotes={lotes.data} />
            : <FormTranscrever c={c} r={refs.data} />}
        </>
      ) : (
        <p className="text-apoio text-tinta-sussurro">Só o técnico de enfermagem e o enfermeiro de plantão na UBS registram vacina.</p>
      )}
      <ListaCaderneta c={c} />
    </div>
  )
}

function Selecao({ id, rotulo, value, onChange, children, className }: {
  id: string; rotulo: string; value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <Label htmlFor={id} className="text-rotulo">{rotulo}</Label>
      <CampoSelecao id={id} value={value} onChange={(e) => onChange(e.target.value)}>{children}</CampoSelecao>
    </div>
  )
}

function useRegistrar(pacienteId: string, rpc: 'vacina_aplicar' | 'vacina_registrar_anterior', aoSalvar: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: Record<string, unknown>) => {
      const { error } = await supabase.rpc(rpc, { p_paciente: pacienteId, p_dados: dados as never })
      if (error) throw error
    },
    onSuccess: () => { aoSalvar(); void qc.invalidateQueries({ queryKey: ['vacina-caderneta', pacienteId] }) },
  })
}

/** Via, local, condição maternal, viajante e hanseníase: comuns às duas entradas. */
function CamposComuns<T extends FormAplicacao | FormAnterior>({ r, f, set, sexo, prefixo }: {
  r: Referencias; f: T; set: (p: Partial<T>) => void; sexo: string | null; prefixo: string
}) {
  return (
    <>
      <Selecao id={`${prefixo}-via`} rotulo="Via" value={f.via} onChange={(v) => set({ via: v, local: '' } as Partial<T>)}>
        <option value="">Escolha</option>
        {r.vias.map((v) => <option key={v.codigo} value={v.codigo}>{v.nome}</option>)}
      </Selecao>
      <Selecao id={`${prefixo}-local`} rotulo="Local de aplicação" value={f.local} onChange={(v) => set({ local: v } as Partial<T>)}>
        <option value="">{f.via ? 'Escolha' : 'Escolha a via antes'}</option>
        {f.via && locaisDe(r, Number(f.via)).map((l) => <option key={l.codigo} value={l.codigo}>{l.nome}</option>)}
      </Selecao>
      {pedeCondicaoMaternal(sexo) && (
        <Selecao id={`${prefixo}-maternal`} rotulo="Condição maternal" value={f.condicao_maternal} onChange={(v) => set({ condicao_maternal: v } as Partial<T>)}>
          <option value="">Escolha</option>
          {CONDICAO_MATERNAL.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
        </Selecao>
      )}
      {Number(f.imunobiologico) === BCG && (
        <Selecao id={`${prefixo}-hans`} rotulo="Comunicante de hanseníase" value={f.comunicante_hanseniase}
          onChange={(v) => set({ comunicante_hanseniase: v } as Partial<T>)}>
          <option value="">Escolha</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </Selecao>
      )}
      <label className="flex items-center gap-2 self-end pb-2 text-apoio">
        <input type="checkbox" checked={f.viajante} onChange={(e) => set({ viajante: e.target.checked } as Partial<T>)} /> Viajante
      </label>
    </>
  )
}

function FormAplicar({ c, r, lotes }: { c: Caderneta; r: Referencias; lotes: PainelLotes }) {
  const [f, setF] = React.useState<FormAplicacao>(APLICACAO_VAZIA)
  const [tocado, setTocado] = React.useState(false)
  const set = (p: Partial<FormAplicacao>) => setF((x) => ({ ...x, ...p }))
  const validos = lotesParaAplicar(lotes.lotes, lotes.hoje)
  const comLote = new Set(validos.map((l) => l.imunobiologico))
  const vacinas = r.imunobiologicos.filter((i) => i.tem_regra && comLote.has(i.codigo))
  const imuno = Number(f.imunobiologico)
  const problema = conferirAplicacao(r, f, c.paciente.sexo)
  const salvar = useRegistrar(c.paciente.id, 'vacina_aplicar', () => { setF(APLICACAO_VAZIA); setTocado(false) })
  if (vacinas.length === 0) {
    return <p className="text-apoio text-atencao">Nenhum lote ativo e na validade na UBS. O gestor ou o enfermeiro cadastram em Lotes de vacina.</p>
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Aplicar agora</CardTitle>
        <CardDescription>Só aparecem as vacinas com lote da UBS na validade, e só a estratégia e a dose que o e-SUS APS aceita.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Selecao id="ap-vacina" rotulo="Vacina" value={f.imunobiologico}
            onChange={(v) => set({ imunobiologico: v, estrategia: '', dose: '', lote_id: '', comunicante_hanseniase: '' })}>
            <option value="">Escolha</option>
            {vacinas.map((i) => <option key={i.codigo} value={i.codigo}>{i.nome} ({i.sigla})</option>)}
          </Selecao>
          <Selecao id="ap-estrategia" rotulo="Estratégia" value={f.estrategia} onChange={(v) => set({ estrategia: v, dose: '' })}>
            <option value="">{imuno ? 'Escolha' : 'Escolha a vacina antes'}</option>
            {imuno > 0 && estrategiasDe(r, imuno).map((e) => <option key={e.codigo} value={e.codigo}>{e.nome}</option>)}
          </Selecao>
          <Selecao id="ap-dose" rotulo="Dose" value={f.dose} onChange={(v) => set({ dose: v })}>
            <option value="">{f.estrategia ? 'Escolha' : 'Escolha a estratégia antes'}</option>
            {imuno > 0 && f.estrategia && dosesDe(r, imuno, Number(f.estrategia)).map((d) => <option key={d.codigo} value={d.codigo}>{d.nome}</option>)}
          </Selecao>
          <Selecao id="ap-lote" rotulo="Lote" value={f.lote_id} onChange={(v) => set({ lote_id: v })}>
            <option value="">{imuno ? 'Escolha' : 'Escolha a vacina antes'}</option>
            {validos.filter((l) => l.imunobiologico === imuno).map((l) => (
              <option key={l.id} value={l.id}>{l.lote} · {l.fabricante_nome} · val. {dataPura(l.validade)}</option>
            ))}
          </Selecao>
          <Selecao id="ap-grupo" rotulo="Grupo de atendimento" value={f.grupo_atendimento} onChange={(v) => set({ grupo_atendimento: v })} className="sm:col-span-2">
            <option value="">Escolha</option>
            {r.grupos.map((g) => <option key={g.codigo} value={g.codigo}>{g.nome}</option>)}
          </Selecao>
          <CamposComuns r={r} f={f} set={set} sexo={c.paciente.sexo} prefixo="ap" />
          {Number(f.estrategia) === ESTRATEGIA_ESPECIAL && (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ap-cbo" className="text-rotulo">CBO de quem prescreveu</Label>
                <Input id="ap-cbo" className="h-9" maxLength={6} value={f.prescritor_cbo} onChange={(e) => set({ prescritor_cbo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ap-cid" className="text-rotulo">CID-10 do motivo</Label>
                <Input id="ap-cid" className="h-9" maxLength={5} value={f.cid10_motivo} onChange={(e) => set({ cid10_motivo: e.target.value })} />
              </div>
            </>
          )}
        </div>
        {tocado && problema && <span role="alert" className="text-critico">{problema}</span>}
        <Button size="sm" className="self-start" disabled={salvar.isPending}
          onClick={() => { setTocado(true); if (!problema) salvar.mutate(dadosAplicacao(f, c.paciente.sexo)) }}>
          {salvar.isPending && <Spinner className="size-4" />} Registrar vacina aplicada
        </Button>
        {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

function FormTranscrever({ c, r }: { c: Caderneta; r: Referencias }) {
  const [f, setF] = React.useState<FormAnterior>(ANTERIOR_VAZIO)
  const [tocado, setTocado] = React.useState(false)
  const set = (p: Partial<FormAnterior>) => setF((x) => ({ ...x, ...p }))
  const imuno = Number(f.imunobiologico)
  const problema = conferirAnterior(r, f, c.paciente.sexo, c.paciente.data_nascimento, c.hoje)
  const salvar = useRegistrar(c.paciente.id, 'vacina_registrar_anterior', () => { setF(ANTERIOR_VAZIO); setTocado(false) })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Transcrever caderneta</CardTitle>
        <CardDescription>Dose aplicada antes, com a data que está na caderneta. Sem lote e sem grupo. Conta nos painéis e vai ao SISAB como registro anterior.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Selecao id="an-vacina" rotulo="Vacina" value={f.imunobiologico}
            onChange={(v) => set({ imunobiologico: v, dose: '', comunicante_hanseniase: '', aplicado_exterior: '' })} className="sm:col-span-2">
            <option value="">Escolha</option>
            {r.imunobiologicos.map((i) => <option key={i.codigo} value={i.codigo}>{i.nome} ({i.sigla})</option>)}
          </Selecao>
          <Selecao id="an-dose" rotulo="Dose" value={f.dose} onChange={(v) => set({ dose: v })}>
            <option value="">{imuno ? 'Escolha' : 'Escolha a vacina antes'}</option>
            {imuno > 0 && dosesAnterior(r, imuno).map((d) => <option key={d.codigo} value={d.codigo}>{d.nome}</option>)}
          </Selecao>
          <div className="flex flex-col gap-1">
            <Label htmlFor="an-data" className="text-rotulo">Data da vacina</Label>
            <Input id="an-data" type="date" className="h-9" min={c.paciente.data_nascimento ?? undefined} max={c.hoje}
              value={f.data_aplicacao} onChange={(e) => set({ data_aplicacao: e.target.value })} />
          </div>
          <CamposComuns r={r} f={f} set={set} sexo={c.paciente.sexo} prefixo="an" />
          {r.covid.includes(imuno) && (
            <Selecao id="an-exterior" rotulo="Aplicada no exterior" value={f.aplicado_exterior} onChange={(v) => set({ aplicado_exterior: v as FormAnterior['aplicado_exterior'] })}>
              <option value="">Escolha</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Selecao>
          )}
        </div>
        {tocado && problema && <span role="alert" className="text-critico">{problema}</span>}
        <Button size="sm" className="self-start" disabled={salvar.isPending}
          onClick={() => { setTocado(true); if (!problema) salvar.mutate(dadosAnterior(r, f, c.paciente.sexo)) }}>
          {salvar.isPending && <Spinner className="size-4" />} Registrar dose da caderneta
        </Button>
        {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

// RF6 (RT, 23/11/2026): o que está em atraso ou a completar vem antes de tudo.
// Só o que o app calcula pelas notas da SAPS; não é o calendário nacional completo.
function EmAtraso({ c }: { c: Caderneta }) {
  const lista = c.pendencias ?? []
  if (lista.length === 0) return null
  return (
    <Card className="border-atencao/40" aria-label="Em atraso ou a completar">
      <CardHeader>
        <CardTitle className="text-corpo">Em atraso ou a completar</CardTitle>
        <CardDescription>Pelo que o app calcula nas notas metodológicas C2, C3, C6 e C7 da SAPS; não é o calendário nacional completo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {lista.map((p) => (
            <li key={`${p.indicador}-${p.vacina}`} className="text-apoio text-tinta">
              <strong className="font-semibold text-atencao">{rotuloPendencia(p.vacina)}</strong>: {p.texto}
              <span className="block text-rotulo text-tinta-sussurro">{p.indicador} · {p.fonte}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ListaCaderneta({ c }: { c: Caderneta }) {
  const qc = useQueryClient()
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('vacina_cancelar', { p_vacinacao: cancelando!, p_motivo: motivo })
      if (error) throw error
    },
    onSuccess: () => { setCancelando(null); setMotivo(''); void qc.invalidateQueries({ queryKey: ['vacina-caderneta', c.paciente.id] }) },
  })
  if (c.registros.length === 0) return <Vazio icone={Syringe} titulo="Caderneta vazia" texto="Nenhuma vacina registrada para este paciente." />
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Caderneta</CardTitle>
        <CardDescription>Da mais recente para a mais antiga. O registro cancelado fica, riscado, com o motivo.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <Table className="text-apoio">
          <TableHeader>
            <TableRow>
              <TableHead className={th}>Data</TableHead>
              <TableHead className={th}>Vacina</TableHead>
              <TableHead className={th}>Dose</TableHead>
              <TableHead className={th}>Estratégia</TableHead>
              <TableHead className={th}>Lote</TableHead>
              <TableHead className={th}>Registro</TableHead>
              {c.pode_registrar && <TableHead className={th}><span className="sr-only">Ações</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.registros.map((v) => (
              <TableRow key={v.id} className={v.cancelado ? 'text-tinta-sussurro line-through' : undefined}>
                <TableCell className={`${td} tabular`}>{dataPura(v.data_aplicacao)}</TableCell>
                <TableCell className={td}>{v.imunobiologico_nome} <span className="text-tinta-sussurro">({v.sigla})</span></TableCell>
                <TableCell className={td}>{v.dose}</TableCell>
                <TableCell className={td}>{v.estrategia ?? '—'}</TableCell>
                <TableCell className={`${td} tabular`}>{v.lote ?? '—'}</TableCell>
                <TableCell className={td}>
                  {v.registro_anterior ? <Badge variant="secondary">Caderneta</Badge> : <Badge variant="success">Aplicada na UBS</Badge>}
                  {v.cancelado && <span className="block text-rotulo no-underline">Cancelado: {v.motivo_cancelamento}</span>}
                </TableCell>
                {c.pode_registrar && (
                  <TableCell className={`${td} text-right`}>
                    {!v.cancelado && cancelando !== v.id && (
                      <Button size="xs" variant="outline" onClick={() => { setCancelando(v.id); setMotivo('') }}>Cancelar</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {cancelando && (
          <div className="flex flex-wrap items-end gap-2 px-6 pt-3">
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
              <Label htmlFor="vac-motivo" className="text-rotulo">Motivo do cancelamento</Label>
              <Input id="vac-motivo" className="h-9" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={() => setCancelando(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < 5 || cancelar.isPending} onClick={() => cancelar.mutate()}>Cancelar registro</Button>
          </div>
        )}
        {cancelar.error && <div className="px-6 pt-2"><MensagemErro texto={(cancelar.error as Error).message} /></div>}
      </CardContent>
    </Card>
  )
}
