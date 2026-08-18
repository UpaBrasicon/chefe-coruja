import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  HeartPulse,
  Loader2,
  MapPin,
  Plus,
  Stethoscope,
  Trash2,
  User,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const PARENTESCOS = ['Pai', 'Mãe', 'Cônjuge', 'Filho(a)', 'Irmão(ã)', 'Outro']
const TURNOS = [
  { id: 'manha', label: 'Manhã (07h–13h)' },
  { id: 'tarde', label: 'Tarde (13h–19h)' },
  { id: 'noite', label: 'Noite (19h–07h)' },
]
const ESPECIALIDADES_SUGERIDAS = [
  'Clínica Médica',
  'Emergência',
  'Pediatria',
  'UTI',
  'Cardiologia',
  'Anestesiologia',
  'Cirurgia Geral',
  'Ginecologia / Obstetrícia',
]
const CERTIFICACOES_SUGERIDAS = ['ATLS', 'ACLS', 'BLS', 'PALS', 'ALS']
const VACINAS_SUGERIDAS = ['Hepatite B', 'Influenza', 'COVID-19', 'Dupla adulto (dT)', 'Sarampo/Caxumba/Rubéola']

/** Estado tipado dos dados pessoais estendidos (persistidos em perfis.dados_pessoais). */
type DadosPessoaisEstendidos = {
  // Contato de emergência
  emergencia_nome: string
  emergencia_parentesco: string
  emergencia_telefone: string
  // Profissional
  formacao: string
  rqe: string
  especialidades: string[]
  certificacoes: { nome: string; validade: string }[]
  // Segurança
  alergias_medicamentosas: string
  restricoes_trabalho: string
  vacinas: { nome: string; data: string }[]
  // Escala
  preferencia_turno: string
  setores_preferidos: string[]
  disponibilidade_fim_semana: string
}

const INICIAL: DadosPessoaisEstendidos = {
  emergencia_nome: '',
  emergencia_parentesco: '',
  emergencia_telefone: '',
  formacao: '',
  rqe: '',
  especialidades: [],
  certificacoes: [],
  alergias_medicamentosas: '',
  restricoes_trabalho: '',
  vacinas: [],
  preferencia_turno: '',
  setores_preferidos: [],
  disponibilidade_fim_semana: 'sim',
}

/** Normaliza o jsonb (que pode ter vindo como strings soltas) para o estado tipado. */
function normalizar(d: Record<string, unknown> | null): DadosPessoaisEstendidos {
  const base: DadosPessoaisEstendidos = { ...INICIAL }
  if (!d) return base
  const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as string[]).filter((x) => typeof x === 'string') : [])
  const arrObj = (k: string) =>
    Array.isArray(d[k]) ? (d[k] as { nome?: string; validade?: string; data?: string }[]) : []
  return {
    ...base,
    emergencia_nome: s('emergencia_nome'),
    emergencia_parentesco: s('emergencia_parentesco'),
    emergencia_telefone: s('emergencia_telefone'),
    formacao: s('formacao'),
    rqe: s('rqe'),
    especialidades: arr('especialidades'),
    certificacoes: arrObj('certificacoes').map((c) => ({ nome: c.nome ?? '', validade: c.validade ?? '' })),
    alergias_medicamentosas: s('alergias_medicamentosas'),
    restricoes_trabalho: s('restricoes_trabalho'),
    vacinas: arrObj('vacinas').map((v) => ({ nome: v.nome ?? '', data: v.data ?? '' })),
    preferencia_turno: s('preferencia_turno'),
    setores_preferidos: arr('setores_preferidos'),
    disponibilidade_fim_semana: s('disponibilidade_fim_semana') || 'sim',
  }
}

/** Converte o estado para o objeto jsonb a persistir (remove vazios). */
function paraJson(d: DadosPessoaisEstendidos): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => {
    if (v !== '' && !(Array.isArray(v) && v.length === 0)) out[k] = v
  }
  set('emergencia_nome', d.emergencia_nome.trim())
  set('emergencia_parentesco', d.emergencia_parentesco)
  set('emergencia_telefone', d.emergencia_telefone.trim())
  set('formacao', d.formacao.trim())
  set('rqe', d.rqe.trim())
  set('especialidades', d.especialidades)
  set(
    'certificacoes',
    d.certificacoes.filter((c) => c.nome.trim())
  )
  set('alergias_medicamentosas', d.alergias_medicamentosas.trim())
  set('restricoes_trabalho', d.restricoes_trabalho.trim())
  set(
    'vacinas',
    d.vacinas.filter((v) => v.nome.trim())
  )
  set('preferencia_turno', d.preferencia_turno)
  set('setores_preferidos', d.setores_preferidos)
  set('disponibilidade_fim_semana', d.disponibilidade_fim_semana)
  return out as unknown as Record<string, unknown>
}

export default function Perfil() {
  const { perfil } = useAuth()
  const [foto, setFoto] = React.useState<string | null>(perfil?.foto_url ?? null)
  const [tipoSanguineo, setTipoSanguineo] = React.useState(perfil?.tipo_sanguineo ?? '')
  const [dados, setDados] = React.useState<DadosPessoaisEstendidos>(() =>
    normalizar(perfil?.dados_pessoais as Record<string, unknown> | null)
  )
  const [enviando, setEnviando] = React.useState(false)
  const [salvo, setSalvo] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const mudar = <K extends keyof DadosPessoaisEstendidos>(k: K, v: DadosPessoaisEstendidos[K]) =>
    setDados((d) => ({ ...d, [k]: v }))

  async function fazerUpload(file: File) {
    if (!perfil) return
    setErro(null)
    const nomeSeguro = `${perfil.id}-${Date.now()}.${file.name.split('.').pop() ?? 'png'}`
    const { error } = await supabase.storage.from('fotos').upload(nomeSeguro, file, {
      cacheControl: '3600',
      upsert: true,
    })
    if (error) {
      setErro('Falha ao enviar a foto: ' + error.message)
      return
    }
    const { data } = supabase.storage.from('fotos').getPublicUrl(nomeSeguro)
    setFoto(data.publicUrl)
  }

  async function salvar() {
    if (!perfil) return
    setEnviando(true)
    setErro(null)
    const { error } = await supabase
      .from('perfis')
      .update({
        foto_url: foto,
        tipo_sanguineo: tipoSanguineo || null,
        dados_pessoais: paraJson(dados) as unknown as Record<string, string>,
      })
      .eq('id', perfil.id)
    setEnviando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Meu Perfil</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Foto, dados profissionais e de segurança. A foto aparece ao lado do seu nome no sistema.
        </p>
      </div>

      {salvo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ Perfil salvo com sucesso.
        </div>
      )}
      {erro && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {/* Foto + identificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-muted-foreground" /> Foto e identificação
          </CardTitle>
          <CardDescription>Seus dados básicos e a foto exibida ao lado do nome.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border bg-muted">
              {foto ? (
                <img src={foto} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <User className="size-8 text-muted-foreground" />
              )}
            </div>
            <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && fazerUpload(e.target.files[0])} />
              <Camera /> {foto ? 'Trocar foto' : 'Enviar foto'}
            </label>
            {foto && (
              <Button variant="ghost" size="sm" onClick={() => setFoto(null)}>
                Remover
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-nome">Nome completo</Label>
              <Input id="perf-nome" value={perfil?.nome_completo ?? ''} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-email">E-mail</Label>
              <Input id="perf-email" value={perfil?.email ?? ''} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-sangue">Tipo sanguíneo</Label>
              <Select value={tipoSanguineo || null} onValueChange={(v) => setTipoSanguineo(v ?? '')}>
                <SelectTrigger id="perf-sangue" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SANGUINEOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {perfil?.crm && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="perf-crm">CRM</Label>
                <Input id="perf-crm" value={`${perfil.crm}${perfil.uf_crm ? `-${perfil.uf_crm}` : ''}`} disabled />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contato de emergência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-muted-foreground" /> Contato de emergência
          </CardTitle>
          <CardDescription>
            Pessoa para avisar em caso de urgência durante o plantão (familiar ou responsável).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perf-emergencia-nome">Nome</Label>
            <Input id="perf-emergencia-nome" className={inputClass} placeholder="Ex.: Maria da Silva" value={dados.emergencia_nome} onChange={(e) => mudar('emergencia_nome', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perf-emergencia-parentesco">Parentesco</Label>
            <Select value={dados.emergencia_parentesco || null} onValueChange={(v) => mudar('emergencia_parentesco', v ?? '')}>
              <SelectTrigger id="perf-emergencia-parentesco" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PARENTESCOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="perf-emergencia-telefone">Telefone</Label>
            <Input id="perf-emergencia-telefone" className={inputClass} placeholder="(00) 00000-0000" value={dados.emergencia_telefone} onChange={(e) => mudar('emergencia_telefone', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Profissional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4 text-muted-foreground" /> Dados profissionais
          </CardTitle>
          <CardDescription>Formação, especialidades e certificações — ajudam o gestor a alocar o setor certo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-formacao">Formação</Label>
              <Input id="perf-formacao" className={inputClass} placeholder="Instituição e ano de formatura" value={dados.formacao} onChange={(e) => mudar('formacao', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-rqe">RQE</Label>
              <Input id="perf-rqe" className={inputClass} placeholder="Registro de Qualificação de Especialista" value={dados.rqe} onChange={(e) => mudar('rqe', e.target.value)} />
            </div>
          </div>

          {/* Especialidades */}
          <div className="flex flex-col gap-1.5">
            <Label>Especialidades</Label>
            <div className="flex flex-wrap gap-1.5">
              {dados.especialidades.map((esp) => (
                <span key={esp} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {esp}
                  <button type="button" aria-label={`Remover ${esp}`} onClick={() => mudar('especialidades', dados.especialidades.filter((x) => x !== esp))}>
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value="" onValueChange={(v) => v && mudar('especialidades', [...dados.especialidades, v])}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Adicionar especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIALIDADES_SUGERIDAS.filter((e) => !dados.especialidades.includes(e)).map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Certificações */}
          <div className="flex flex-col gap-1.5">
            <Label>Certificações (ATLS, ACLS, etc.)</Label>
            <div className="flex flex-col gap-2">
              {dados.certificacoes.map((c, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Select value={c.nome} onValueChange={(v) => mudar('certificacoes', dados.certificacoes.map((x, j) => (j === i ? { ...x, nome: v ?? '' } : x)))}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICACOES_SUGERIDAS.filter((c2) => c2 === c.nome || !dados.certificacoes.some((x) => x.nome === c2)).map((c2) => (
                        <SelectItem key={c2} value={c2}>
                          {c2}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" className="w-40" value={c.validade} onChange={(e) => mudar('certificacoes', dados.certificacoes.map((x, j) => (j === i ? { ...x, validade: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon-sm" onClick={() => mudar('certificacoes', dados.certificacoes.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="outline" size="sm" onClick={() => mudar('certificacoes', [...dados.certificacoes, { nome: '', validade: '' }])}>
                  <Plus /> Adicionar certificação
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-muted-foreground" /> Segurança assistencial
          </CardTitle>
          <CardDescription>
            Informações que protegem você e a equipe durante o atendimento. Dado sensível — tratado conforme a LGPD.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-alergia-med">Alergias medicamentosas</Label>
              <Input id="perf-alergia-med" className={inputClass} placeholder="Ex.: penicilina, dipirona" value={dados.alergias_medicamentosas} onChange={(e) => mudar('alergias_medicamentosas', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-restricoes">Restrições de trabalho</Label>
              <Input id="perf-restricoes" className={inputClass} placeholder="Ex.: evitar turnos noturnos" value={dados.restricoes_trabalho} onChange={(e) => mudar('restricoes_trabalho', e.target.value)} />
            </div>
          </div>

          {/* Vacinas */}
          <div className="flex flex-col gap-1.5">
            <Label>Vacinas em dia</Label>
            <div className="flex flex-col gap-2">
              {dados.vacinas.map((v, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Select value={v.nome} onValueChange={(val) => mudar('vacinas', dados.vacinas.map((x, j) => (j === i ? { ...x, nome: val ?? '' } : x)))}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Vacina" />
                    </SelectTrigger>
                    <SelectContent>
                      {VACINAS_SUGERIDAS.filter((v2) => v2 === v.nome || !dados.vacinas.some((x) => x.nome === v2)).map((v2) => (
                        <SelectItem key={v2} value={v2}>
                          {v2}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" className="w-40" value={v.data} onChange={(e) => mudar('vacinas', dados.vacinas.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon-sm" onClick={() => mudar('vacinas', dados.vacinas.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="outline" size="sm" onClick={() => mudar('vacinas', [...dados.vacinas, { nome: '', data: '' }])}>
                  <Plus /> Adicionar vacina
                </Button>
              </div>
            </div>
          </div>

          {dados.alergias_medicamentosas || dados.restricoes_trabalho ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="size-3.5" /> Estas informações ficam visíveis à gestão para sua segurança no plantão.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Escala */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-muted-foreground" /> Preferências de escala
          </CardTitle>
          <CardDescription>Ajuda o gestor a montar a escala com mais aderência.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-pref-turno">Turno preferido</Label>
              <Select value={dados.preferencia_turno || null} onValueChange={(v) => mudar('preferencia_turno', v ?? '')}>
                <SelectTrigger id="perf-pref-turno" className="w-full">
                  <SelectValue placeholder="Sem preferência" />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perf-fim-semana">Disponibilidade de fim de semana</Label>
              <Select value={dados.disponibilidade_fim_semana} onValueChange={(v) => mudar('disponibilidade_fim_semana', v ?? 'sim')}>
                <SelectTrigger id="perf-fim-semana" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim, posso cobrir</SelectItem>
                  <SelectItem value="nao">Prefiro folgar</SelectItem>
                  <SelectItem value="eventual">Eventualmente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Setores de preferência</Label>
            <div className="flex flex-wrap gap-1.5">
              {dados.setores_preferidos.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {s}
                  <button type="button" aria-label={`Remover ${s}`} onClick={() => mudar('setores_preferidos', dados.setores_preferidos.filter((x) => x !== s))}>
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              className={inputClass}
              placeholder="Digite e pressione Enter (ex.: Enfermaria Clínica)"
              onKeyDown={(e) => {
                const v = (e.target as HTMLInputElement).value.trim()
                if (e.key === 'Enter' && v && !dados.setores_preferidos.includes(v)) {
                  e.preventDefault()
                  mudar('setores_preferidos', [...dados.setores_preferidos, v])
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={salvar} disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : <Check />} Salvar perfil
        </Button>
      </div>
    </div>
  )
}
