import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Search, ShieldCheck, SquareCheckBig } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ROTA_DA_FICHA } from '@/clinico/indice'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useDecidirVersao, useFilaAprovacao, useMeuPapelTecnico } from '@/hooks/useFerramentaClinica'

const PUBLICO: Record<string, string> = { adulto: 'Adulto', pediatrico: 'Pediatria', ambos: 'Adulto e pediatria' }

type Fonte = { citacao: string; url?: string; pediatrica?: boolean }

/**
 * Revisão Clínica (P/index.html 5567–5620).
 *
 * A decisão continua do responsável técnico médico nomeado pela rede (fase 5):
 * só ele aprova ou aponta correção, com o CRM registrado. O gestor da unidade
 * vê o panorama (revisao_clinica_panorama): cada ferramenta, quem conferiu,
 * o que aguarda e a correção apontada, e a camada da unidade.
 */
export default function RevisaoClinica() {
  const { data: papeis, isLoading } = useMeuPapelTecnico()
  const { papeisDaUnidade } = useUnidade()
  const rt = papeis?.find((p) => p.tipo === 'medico')
  const ehGestor = papeisDaUnidade.includes('gestor')

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (!rt && !ehGestor) {
    return (
      <p className="text-corpo text-tinta-sussurro">
        Esta fila é do responsável técnico médico nomeado pela rede. Seu perfil não tem essa nomeação.
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col gap-[22px]">
      <TituloPagina icone={ShieldCheck} titulo="Revisão Clínica"
        descricao={rt
          ? `Versões de regra da camada base aguardando sua decisão. Sua aprovação fica registrada com o seu nome e ${rt.conselho} ${rt.registro}/${rt.uf}.`
          : 'Toda ferramenta da Central carrega a ressalva de referência geral até o responsável técnico conferir. A conferência tira a ressalva da tela de quem prescreve; a correção apontada a troca por um aviso vermelho. A decisão é do responsável técnico nomeado pela rede; aqui o gestor acompanha.'} />
      {rt && <FilaRT />}
      <Panorama />
    </div>
  )
}

function FilaRT() {
  const { data: fila } = useFilaAprovacao(true)
  const decidir = useDecidirVersao()
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  async function decidirItem(ferramenta: string, versao: string, aprovar: boolean) {
    const chave = `${ferramenta}@${versao}`
    try {
      await decidir.mutateAsync({ ferramenta, versao, aprovar, nota: notas[chave] })
      setAviso({ ok: true, texto: aprovar ? 'Versão aprovada.' : 'Versão reprovada com a correção registrada.' })
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível registrar a decisão.' })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {aviso && (
        <p role="status" className={aviso.ok ? 'rounded-lg border border-fio bg-superficie p-3 text-sm text-tinta' : 'rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico'}>
          {aviso.texto}
        </p>
      )}
      {fila && fila.length === 0 && <p className="text-corpo text-tinta-sussurro">Nada aguardando sua decisão.</p>}
      {fila?.map((v) => {
        const chave = `${v.ferramenta_id}@${v.versao}`
        const fontes = (v.fontes ?? []) as unknown as Fonte[]
        const nota = notas[chave] ?? ''
        return (
          <Card key={chave}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {v.titulo}
                <Badge variant="secondary">versão {v.versao}</Badge>
                <Badge variant="outline">{PUBLICO[v.publico] ?? v.publico}</Badge>
              </CardTitle>
              <CardDescription>
                {v.vigente_versao ? `Substitui a versão aprovada ${v.vigente_versao}.` : 'Primeira versão desta ferramenta.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1 text-apoio text-tinta">
                {fontes.map((f) => (
                  <li key={f.citacao}>
                    {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.citacao}</a> : f.citacao}
                    {f.pediatrica && <Badge variant="outline" className="ml-2">fonte pediátrica</Badge>}
                  </li>
                ))}
              </ul>
              {ROTA_DA_FICHA[v.ferramenta_id] && (
                <Link to={ROTA_DA_FICHA[v.ferramenta_id]} className="text-apoio text-acao underline">Abrir a ferramenta para conferir</Link>
              )}
              <Textarea placeholder="Correção apontada (obrigatória para reprovar)" value={nota}
                onChange={(e) => setNotas((n) => ({ ...n, [chave]: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => decidirItem(v.ferramenta_id, v.versao, true)} disabled={decidir.isPending}>Confere — aprovar</Button>
                <Button variant="outline" onClick={() => decidirItem(v.ferramenta_id, v.versao, false)}
                  disabled={decidir.isPending || nota.trim().length < 10}>Aponta correção — reprovar</Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

type LinhaPanorama = {
  ferramenta_id: string; titulo: string; versao_vigente: string | null; versao_ultima: string | null
  status_ultima: string | null; publico: string | null; decidida_por: string | null; decisao_registro: string | null
  decidida_em: string | null; decisao_nota: string | null; pendentes: number; oculta: boolean; nota_local: string | null
}

const GRUPOS = [
  { chave: 'aguardando', titulo: 'Aguardando o responsável técnico' },
  { chave: 'correcao', titulo: 'Correção apontada' },
  { chave: 'conferida', titulo: 'Conferidas' },
  { chave: 'sem_versao', titulo: 'Sem versão registrada' },
] as const
type Grupo = (typeof GRUPOS)[number]['chave']

function grupoDe(l: LinhaPanorama): Grupo {
  if (!l.status_ultima) return 'sem_versao'
  if (l.status_ultima === 'aguardando_aprovacao') return 'aguardando'
  if (l.status_ultima === 'reprovada') return 'correcao'
  return 'conferida'
}
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Panorama() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const lista = useQuery({
    queryKey: ['revisao-panorama', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('revisao_clinica_panorama', { p_unidade: unidadeId! })
      if (error) throw error
      return (d ?? []) as LinhaPanorama[]
    },
  })
  const todas = useMemo(() => lista.data ?? [], [lista.data])
  const filtradas = todas.filter((l) =>
    (!busca.trim() || semAcento(l.titulo).includes(semAcento(busca.trim())))
    && (!soPendentes || grupoDe(l) !== 'conferida'))
  const conta = (g: Grupo) => todas.filter((l) => grupoDe(l) === g).length

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-end gap-3 border-b border-trilha px-5 py-4">
        <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-[5px]">
          <span className="text-apoio font-medium text-grafite">Filtrar</span>
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ferramenta, escore, questão…" className="pl-8" />
          </span>
        </label>
        <button type="button" aria-pressed={soPendentes} onClick={() => setSoPendentes((v) => !v)}
          className={cn('flex items-center gap-1.5 rounded-capsula border px-[13px] py-1.5 text-apoio',
            soPendentes ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
          <AlertTriangle className="size-3.5" aria-hidden /> Só pendentes
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-trilha bg-campo px-5 py-2.5 text-apoio text-tinta-sussurro">
        <span>{conta('conferida')} conferidas · {conta('aguardando')} aguardando · {conta('correcao')} com correção{conta('sem_versao') ? ` · ${conta('sem_versao')} sem versão` : ''}</span>
      </div>
      {lista.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
      {lista.error && <p className="px-5 py-3 text-apoio text-critico">{(lista.error as Error).message}</p>}
      {GRUPOS.map((g) => {
        const linhas = filtradas.filter((l) => grupoDe(l) === g.chave)
        if (!linhas.length) return null
        return (
          <div key={g.chave}>
            <div className="flex items-baseline justify-between gap-3 border-b border-trilha bg-campo/60 px-5 py-2">
              <span className="text-rotulo font-semibold tracking-[0.05em] text-grafite uppercase">{g.titulo}</span>
              <span className="text-rotulo text-tinta-sussurro">{linhas.length}</span>
            </div>
            {linhas.map((l) => <LinhaRevisao key={l.ferramenta_id} l={l} grupo={g.chave} />)}
          </div>
        )
      })}
      {!lista.isLoading && filtradas.length === 0 && (
        <p className="px-5 py-5 text-apoio text-tinta-sussurro">{soPendentes ? 'Nenhuma ferramenta pendente.' : 'Nenhuma ferramenta com esse nome.'}</p>
      )}
    </section>
  )
}

function LinhaRevisao({ l, grupo }: { l: LinhaPanorama; grupo: Grupo }) {
  const selo = {
    conferida: ['Conferida', 'bg-conforme/[0.08] text-conforme'],
    aguardando: ['Aguardando', 'bg-alerta-atencao text-atencao'],
    correcao: ['Correção apontada', 'bg-critico/[0.08] text-critico'],
    sem_versao: ['Sem versão', 'bg-trilha text-tinta-sussurro'],
  }[grupo]
  const rota = ROTA_DA_FICHA[l.ferramenta_id]
  return (
    <div className="flex flex-col gap-1.5 border-b border-trilha px-5 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-0 flex-[1_1_220px] flex-wrap items-baseline gap-x-2">
          {rota ? <Link to={rota} className="text-corpo font-medium text-tinta hover:text-acao">{l.titulo}</Link>
            : <span className="text-corpo font-medium text-tinta">{l.titulo}</span>}
          <span className="text-apoio text-tinta-sussurro">
            {[l.versao_ultima && `versão ${l.versao_ultima}`, l.publico && (PUBLICO[l.publico] ?? l.publico)].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className={cn('rounded-capsula px-2 py-[3px] text-rotulo font-semibold tracking-[0.03em] whitespace-nowrap uppercase', selo[1])}>{selo[0]}</span>
      </div>
      <span className="flex items-center gap-1.5 text-apoio text-tinta-sussurro">
        {grupo === 'conferida' || grupo === 'correcao'
          ? <><SquareCheckBig className="size-3.5" aria-hidden /> {l.decidida_por ?? '—'}{l.decisao_registro ? ` · ${l.decisao_registro}` : ''}{l.decidida_em ? ` · ${data(l.decidida_em)}` : ''}</>
          : grupo === 'aguardando'
            ? l.versao_vigente ? `Vale a versão ${l.versao_vigente} até a decisão.` : 'Sem versão aprovada: a tela mostra a ressalva de referência geral.'
            : 'Nenhuma versão registrada desta ferramenta.'}
      </span>
      {grupo === 'correcao' && l.decisao_nota && <span className="text-apoio text-pretty text-critico">Correção: {l.decisao_nota}</span>}
      {(l.oculta || l.nota_local) && (
        <span className="text-apoio text-pretty text-grafite">
          Na unidade: {l.oculta ? 'oculta' : 'visível'}{l.nota_local ? ` · nota local: ${l.nota_local}` : ''}
        </span>
      )}
    </div>
  )
}
