// ─────────────────────────────────────────────────────────────────────────────
// Integrações: chaves da API para integradores (Fase 3, tarefa 7; decisões
// do RT de 10/10/2026). Contrato em docs/api/openapi.yaml.
//
// • Super admin: cria a chave escolhendo unidades e recursos (ela aparece uma
//   única vez), ajusta o limite e os IPs, revoga e vê os acessos.
// • Gestor: vê as chaves que acessam a unidade dele, os acessos, e revoga.
// • Vencimento em 12 meses; aviso 30 dias antes, aqui.
// Migration 20261104000002_api_integradores.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'

type Recurso = 'pacientes' | 'atendimentos' | 'leitos' | 'producao' | 'laboratorio' | 'imagem'
const RECURSOS: Record<Recurso, string> = {
  pacientes: 'Pacientes', atendimentos: 'Atendimentos', leitos: 'Leitos', producao: 'Produção SUS (AIH, APAC, fechamentos)',
  // Fase 5C, etapa 1.3: chave do LIS (lê pedidos de exame, grava coleta e laudo pela porta FHIR)
  laboratorio: 'Laboratório (LIS): pedidos de exame, coleta e laudo — FHIR',
  // Fase 5C, etapa 2.2: chave do RIS (lê pedidos de imagem e ECG, grava exame feito, link do PACS e laudo)
  imagem: 'Imagem (RIS/PACS): pedidos de imagem e ECG, exame feito, link e laudo — FHIR',
}

type Chave = {
  id: string; nome: string; ambiente: 'live' | 'test'; prefixo: string
  unidades: { id: string; nome: string }[]; recursos: Recurso[]; ips: string[]; limite_por_minuto: number
  criada_por: string | null; criada_em: string; expira_em: string; vence_em_dias: number; vencida: boolean
  revogada_em: string | null; revogada_por: string | null; motivo_revogacao: string | null
  ultimo_uso_em: string | null; acessos_24h: number; pode_editar: boolean
}
type Acesso = { recurso: string; unidade: string | null; status: number; ip: string | null; requisicao: string | null; em: string }

export default function Integracoes() {
  const { ehSuperAdmin } = useUnidade()
  // o super admin escolhe entre todas as unidades ativas da plataforma
  const unidades = useQuery({
    queryKey: ['api-unidades-ativas'],
    enabled: ehSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data ?? []
    },
  })
  const lista = useQuery({
    queryKey: ['api-chaves'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_chaves_lista')
      if (error) throw error
      return (data ?? []) as unknown as Chave[]
    },
  })
  const ativas = (lista.data ?? []).filter((c) => !c.revogada_em)
  const vencendo = ativas.filter((c) => !c.vencida && c.vence_em_dias <= 30)
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={KeyRound} titulo="Integrações (API)"
        descricao={ehSuperAdmin ? 'Chaves dos integradores externos: unidades, recursos, limite e IPs. A chave aparece uma única vez, na criação.'
          : 'Chaves de integradores que acessam a sua unidade. Você pode revogar uma chave a qualquer hora.'} />
      {vencendo.length > 0 && (
        <p role="alert" className="rounded-container border border-atencao/30 bg-alerta-atencao px-3.5 py-2.5 text-apoio text-atencao">
          {vencendo.length === 1 ? '1 chave vence' : `${vencendo.length} chaves vencem`} em até 30 dias: {vencendo.map((c) => `${c.nome} (${c.vence_em_dias === 1 ? '1 dia' : `${c.vence_em_dias} dias`})`).join(', ')}.
          A renovação é uma chave nova, criada pela administração da plataforma.
        </p>
      )}
      {ehSuperAdmin && <NovaChave unidades={unidades.data ?? []} />}
      {lista.isLoading ? <Spinner /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
        <Vazio icone={KeyRound} titulo="Nenhuma chave" texto="Nenhum integrador tem chave para as suas unidades." />
      ) : (
        <div className="flex flex-col gap-3">{(lista.data ?? []).map((c) => <CartaoChave key={c.id} c={c} />)}</div>
      )}
    </div>
  )
}

function NovaChave({ unidades }: { unidades: { id: string; nome: string }[] }) {
  const qc = useQueryClient()
  const [nome, setNome] = React.useState('')
  const [ambiente, setAmbiente] = React.useState<'live' | 'test'>('live')
  const [sel, setSel] = React.useState<string[]>([])
  const [rec, setRec] = React.useState<Recurso[]>([])
  const [ips, setIps] = React.useState('')
  const [limite, setLimite] = React.useState('60')
  const [criada, setCriada] = React.useState<string | null>(null)
  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('api_criar_chave', {
        p_nome: nome.trim(), p_ambiente: ambiente, p_unidades: sel, p_recursos: rec,
        p_ips: ips.split(/[\s,;]+/).filter(Boolean), p_limite: Number(limite),
      })
      if (error) throw error
      return (data as unknown as { chave: string }).chave
    },
    onSuccess: (chave) => {
      setCriada(chave); setNome(''); setSel([]); setRec([]); setIps('')
      void qc.invalidateQueries({ queryKey: ['api-chaves'] })
    },
  })
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Nova chave</CardTitle>
        <CardDescription>Validade de 12 meses. Libere só as unidades e os recursos de que o integrador precisa.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {criada && (
          <div role="status" className="flex flex-col gap-1.5 rounded-controle border border-acao/40 bg-campo p-3">
            <span className="font-medium text-tinta">Copie a chave agora: ela não aparece de novo.</span>
            <code className="break-all text-rotulo">{criada}</code>
            <div className="flex gap-2">
              <Button size="xs" variant="outline" onClick={() => void navigator.clipboard?.writeText(criada)}><Copy className="size-3.5" /> Copiar</Button>
              <Button size="xs" variant="ghost" onClick={() => setCriada(null)}>Já copiei</Button>
            </div>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="api-nome" className="text-rotulo">Integrador</Label>
            <Input id="api-nome" className="h-8" placeholder="ex.: Secretaria Municipal de Saúde — Regulação" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="api-amb" className="text-rotulo">Ambiente</Label>
            <CampoSelecao id="api-amb" tamanho="compacto" value={ambiente} onChange={(e) => setAmbiente(e.target.value as 'live' | 'test')}>
              <option value="live">Produção (cc_live_)</option>
              <option value="test">Homologação (cc_test_)</option>
            </CampoSelecao>
          </div>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-rotulo text-tinta-apoio">Unidades</legend>
          <div className="flex flex-wrap gap-3">
            {unidades.map((u) => (
              <label key={u.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={sel.includes(u.id)} onChange={() => setSel((v) => alternar(v, u.id))} /> {u.nome}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-rotulo text-tinta-apoio">Recursos</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(RECURSOS) as Recurso[]).map((r) => (
              <label key={r} className="flex items-center gap-1.5">
                <input type="checkbox" checked={rec.includes(r)} onChange={() => setRec((v) => alternar(v, r))} /> {RECURSOS[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="api-ips" className="text-rotulo">IPs de origem (opcional; vazio aceita qualquer IP)</Label>
            <Input id="api-ips" className="h-8" placeholder="ex.: 200.10.20.30, 200.10.21.0/24" value={ips} onChange={(e) => setIps(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="api-lim" className="text-rotulo">Consultas por minuto</Label>
            <Input id="api-lim" className="h-8" inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
        </div>
        <Button size="sm" className="self-start" disabled={nome.trim().length < 3 || sel.length === 0 || rec.length === 0 || criar.isPending}
          onClick={() => criar.mutate()}>Criar chave</Button>
        {criar.error && <MensagemErro texto={(criar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

function CartaoChave({ c }: { c: Chave }) {
  const qc = useQueryClient()
  const [acao, setAcao] = React.useState<'revogar' | 'ajustar' | 'acessos' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [limite, setLimite] = React.useState(String(c.limite_por_minuto))
  const [ips, setIps] = React.useState(c.ips.join(', '))
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['api-chaves'] })
  const revogar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('api_revogar_chave', { p_id: c.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); invalidar() },
  })
  const ajustar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('api_ajustar_chave', { p_id: c.id, p_limite: Number(limite), p_ips: ips.split(/[\s,;]+/).filter(Boolean) })
      if (error) throw error
    },
    onSuccess: () => { setAcao(null); invalidar() },
  })
  const acessos = useQuery({
    queryKey: ['api-acessos', c.id],
    enabled: acao === 'acessos',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('api_acessos_da_chave', { p_id: c.id })
      if (error) throw error
      return (data ?? []) as unknown as Acesso[]
    },
  })
  const ativa = !c.revogada_em && !c.vencida
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 pt-4 text-apoio">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-tinta">{c.nome}</span>
          <code className="text-rotulo text-tinta-sussurro">{c.prefixo}…</code>
          <Badge variant={c.ambiente === 'live' ? 'info' : 'secondary'}>{c.ambiente === 'live' ? 'produção' : 'homologação'}</Badge>
          <Badge variant={c.revogada_em ? 'destructive' : !ativa ? 'secondary' : c.vence_em_dias <= 30 ? 'warning' : 'success'} className="ml-auto">
            {c.revogada_em ? 'revogada' : !ativa ? 'vencida' : c.vence_em_dias === 1 ? 'vence em 1 dia' : `vence em ${c.vence_em_dias} dias`}
          </Badge>
        </div>
        <span className="text-tinta-apoio">Unidades: {c.unidades.map((u) => u.nome).join(', ')}</span>
        <span className="text-tinta-apoio">Recursos: {c.recursos.map((r) => RECURSOS[r] ?? r).join(', ')}</span>
        <span className="text-rotulo text-tinta-sussurro">
          {c.limite_por_minuto} consultas/min · IPs: {c.ips.length ? c.ips.join(', ') : 'qualquer'} · {c.acessos_24h} consultas nas últimas 24 h
          {c.ultimo_uso_em && <> · último uso {fmtDataHora(c.ultimo_uso_em)}</>}
          {' '}· criada por {c.criada_por ?? '—'} em {fmtDataHora(c.criada_em)}
        </span>
        {c.revogada_em && <span className="text-rotulo text-critico">Revogada por {c.revogada_por ?? '—'} em {fmtDataHora(c.revogada_em)}: “{c.motivo_revogacao}”</span>}
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="ghost" onClick={() => setAcao(acao === 'acessos' ? null : 'acessos')}>{acao === 'acessos' ? 'Esconder acessos' : 'Ver acessos'}</Button>
          {ativa && c.pode_editar && <Button size="xs" variant="outline" onClick={() => setAcao('ajustar')}>Ajustar limite e IPs</Button>}
          {!c.revogada_em && <Button size="xs" variant="outline" onClick={() => setAcao('revogar')}>Revogar</Button>}
        </div>
        {acao === 'revogar' && (
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button size="xs" variant="destructive" disabled={motivo.trim().length < 10 || revogar.isPending} onClick={() => revogar.mutate()}>Revogar agora</Button>
            <Button size="xs" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            {revogar.error && <span role="alert" className="basis-full text-rotulo text-critico">{(revogar.error as Error).message}</span>}
          </div>
        )}
        {acao === 'ajustar' && (
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 w-28" inputMode="numeric" aria-label="Consultas por minuto" value={limite} onChange={(e) => setLimite(e.target.value)} />
            <Input className="h-8 flex-1" aria-label="IPs de origem" placeholder="vazio aceita qualquer IP" value={ips} onChange={(e) => setIps(e.target.value)} />
            <Button size="xs" disabled={ajustar.isPending} onClick={() => ajustar.mutate()}>Salvar</Button>
            <Button size="xs" variant="ghost" onClick={() => setAcao(null)}>Voltar</Button>
            {ajustar.error && <span role="alert" className="basis-full text-rotulo text-critico">{(ajustar.error as Error).message}</span>}
          </div>
        )}
        {acao === 'acessos' && (acessos.isLoading ? <Spinner /> : (acessos.data ?? []).length === 0 ? (
          <span className="text-rotulo text-tinta-sussurro">Nenhuma consulta ainda.</span>
        ) : (
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto text-rotulo">
            {(acessos.data ?? []).map((a, i) => (
              <li key={i} className={a.status >= 400 ? 'text-atencao' : 'text-tinta-apoio'}>
                {fmtDataHora(a.em)} · {a.recurso} · {a.status} · {a.unidade ?? '—'} · IP {a.ip ?? '—'} · {a.requisicao ?? ''}
              </li>
            ))}
          </ul>
        ))}
      </CardContent>
    </Card>
  )
}
