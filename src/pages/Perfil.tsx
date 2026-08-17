import { Camera, Check, ChevronRight, Loader2, User } from 'lucide-react'
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

export default function Perfil() {
  const { perfil } = useAuth()
  const [foto, setFoto] = React.useState<string | null>(perfil?.foto_url ?? null)
  const [tipoSanguineo, setTipoSanguineo] = React.useState(perfil?.tipo_sanguineo ?? '')
  const [dados, setDados] = React.useState<Record<string, string>>(() => {
    const d = perfil?.dados_pessoais as Record<string, unknown> | null
    if (!d) return {}
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v ?? '')]))
  })
  const [enviando, setEnviando] = React.useState(false)
  const [salvo, setSalvo] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const CHAVES = [
    ['telefone_emergencia', 'Telefone de emergência'],
    ['contato', 'Contato alternativo'],
    ['registro_corporativo', 'Registro / matrícula'],
    ['alergias', 'Alergias'],
    ['restricao', 'Restrição / observação'],
  ]

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
    const dadosLimpos = Object.fromEntries(
      Object.entries(dados)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, v])
    )
    const { error } = await supabase
      .from('perfis')
      .update({ foto_url: foto, tipo_sanguineo: tipoSanguineo || null, dados_pessoais: dadosLimpos })
      .eq('id', perfil.id)
    setEnviando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setSalvo(true)
    setTimeout(() => setSalvo(false), 3000)
  }

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
          Foto e dados pessoais. A foto aparece ao lado do seu nome no sistema.
        </p>
      </div>

      {salvo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ Perfil salvo com sucesso.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-muted-foreground" /> Foto de perfil
          </CardTitle>
          <CardDescription>
            Sua foto aparecerá como símbolo ao lado do nome (ex.: ao lado de &quot;{perfil?.nome_completo}&quot;).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {foto ? (
              <img src={foto} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <User className="size-8 text-muted-foreground" />
            )}
          </div>
          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && fazerUpload(e.target.files[0])} />
            <Camera /> {foto ? 'Trocar foto' : 'Enviar foto'}
          </label>
          {foto && (
            <Button variant="ghost" size="sm" onClick={() => setFoto(null)}>
              Remover
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
          <CardDescription>Informe os dados que considerar pertinentes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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

          <div className="h-px bg-border" />

          <div className="grid gap-4 sm:grid-cols-2">
            {CHAVES.map(([chave, rotulo]) => (
              <div key={chave} className="flex flex-col gap-1.5">
                <Label htmlFor={`perf-${chave}`}>{rotulo}</Label>
                <Input
                  id={`perf-${chave}`}
                  value={dados[chave] ?? ''}
                  onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={salvar} disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : <Check />} Salvar perfil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
