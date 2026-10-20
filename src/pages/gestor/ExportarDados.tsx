// ─────────────────────────────────────────────────────────────────────────────
// Exportar dados (Fase 3, tarefa 9; decisões do RT de 10/10/2026).
//
// • Gestor: exporta a unidade em foco. Super admin: escolhe a unidade.
// • Conjuntos: atendimentos, internações, leitos (agora), cadastro de
//   pacientes e lista de documentos (sem texto clínico). CSV ou JSON (campos
//   do contrato da API v1). Período de até 12 meses.
// • Dados do paciente mascarados por padrão. A versão completa pede motivo e o
//   código do segundo fator (o banco confere se foi digitado nos últimos 5 min)
//   e entra no log de acesso de cada paciente.
// • O arquivo é montado aqui, página por página (1.000 linhas por chamada).
// Migration 20261105000001_exportacao_estruturada.sql; src/lib/exportacao.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileDown, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { ConfirmarSegundoFator, ConfirmarSegundoFatorEmail } from '@/components/seguranca/SegundoFator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { CONJUNTOS, erroPeriodo, montarArquivo, nomeArquivo, type Conjunto, type Formato } from '@/lib/exportacao'
import { supabase } from '@/lib/supabase'
import { MensagemErro } from '@/components/ui/mensagem-erro'

type Registro = {
  id: string; conjunto: Conjunto; formato: Formato; desde: string | null; ate: string | null
  mascarado: boolean; motivo: string | null; linhas: number
  solicitada_por: string | null; solicitada_em: string; concluida_em: string | null
}

const hoje = () => new Date().toLocaleDateString('sv-SE')
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('sv-SE')

function baixar(nome: string, conteudo: string, formato: Formato) {
  const tipo = formato === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportarDados() {
  const { ehSuperAdmin, unidadeAtiva } = useUnidade()
  const qc = useQueryClient()
  const todas = useQuery({
    queryKey: ['exportar-unidades'],
    enabled: ehSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data ?? []
    },
  })
  const [unidadeEscolhida, setUnidadeEscolhida] = React.useState<string>('')
  const unidadeId = (ehSuperAdmin ? unidadeEscolhida || unidadeAtiva?.unidade_id : unidadeAtiva?.unidade_id) ?? ''
  const unidadeNome = (ehSuperAdmin ? todas.data?.find((u) => u.id === unidadeId)?.nome : undefined) ?? unidadeAtiva?.unidade.nome ?? ''

  const [conjunto, setConjunto] = React.useState<Conjunto>('atendimentos')
  const [formato, setFormato] = React.useState<Formato>('csv')
  const [desde, setDesde] = React.useState(diasAtras(30))
  const [ate, setAte] = React.useState(hoje())
  const [mascarado, setMascarado] = React.useState(true)
  const [motivo, setMotivo] = React.useState('')
  const [confirmar, setConfirmar] = React.useState(false)
  const [progresso, setProgresso] = React.useState<{ feitas: number; total: number } | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [pronto, setPronto] = React.useState<string | null>(null)

  const fator = useQuery({
    queryKey: ['exportar-fator-totp'],
    queryFn: async () => {
      const { data } = await supabase.auth.mfa.listFactors()
      return data?.totp.find((f) => f.status === 'verified')?.id ?? null
    },
  })
  const lista = useQuery({
    queryKey: ['exportacoes', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exportacoes_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Registro[]
    },
  })

  const c = CONJUNTOS[conjunto]
  const problema = !unidadeId ? 'Escolha a unidade.'
    : c.comPeriodo ? erroPeriodo(desde, ate)
    : null
  const faltaMotivo = !mascarado && motivo.trim().length < 10
  const ocupado = progresso !== null

  async function exportar() {
    setErro(null); setPronto(null)
    setProgresso({ feitas: 0, total: 0 })
    try {
      const { data: aberta, error } = await supabase.rpc('exportacao_iniciar', {
        p_unidade: unidadeId, p_conjunto: conjunto, p_formato: formato,
        p_desde: c.comPeriodo ? desde : null, p_ate: c.comPeriodo ? ate : null,
        p_mascarado: mascarado, p_motivo: mascarado ? null : motivo.trim(),
      })
      if (error) {
        // versão completa sem código recente: pede o código e tenta de novo
        if (error.message.startsWith('CONFIRMACAO')) { setConfirmar(true); return }
        throw error
      }
      const { id, total } = aberta as unknown as { id: string; total: number }
      setProgresso({ feitas: 0, total })
      const linhas: Record<string, unknown>[] = []
      let desloc: number | null = 0
      while (desloc !== null) {
        const { data, error: e } = await supabase.rpc('exportacao_pagina', { p_id: id, p_desloc: desloc })
        if (e) throw e
        const pagina = data as unknown as { dados: Record<string, unknown>[]; proximo: number | null }
        linhas.push(...pagina.dados)
        setProgresso({ feitas: linhas.length, total })
        desloc = pagina.proximo
      }
      const { error: fim } = await supabase.rpc('exportacao_concluir', { p_id: id })
      if (fim) throw fim
      const ctx = { unidade: unidadeNome, conjunto, desde: c.comPeriodo ? desde : null, ate: c.comPeriodo ? ate : null,
        mascarado, geradoEm: new Date().toISOString(), fuso: Intl.DateTimeFormat().resolvedOptions().timeZone }
      const nome = nomeArquivo(formato, ctx)
      baixar(nome, montarArquivo(formato, ctx, linhas), formato)
      setPronto(`${nome} — ${linhas.length === 1 ? '1 linha' : `${linhas.length} linhas`}.`)
      if (!mascarado) setMotivo('')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setProgresso(null)
      void qc.invalidateQueries({ queryKey: ['exportacoes', unidadeId] })
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={FileDown} titulo="Exportar dados"
        descricao="Atendimentos, internações, leitos, cadastro de pacientes e lista de documentos, em CSV ou JSON. Os dados do paciente saem mascarados, a menos que você peça a versão completa. Toda exportação fica registrada." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova exportação</CardTitle>
          <CardDescription>{c.descricao}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <div className="grid gap-3 sm:grid-cols-3">
            {ehSuperAdmin && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="exp-unidade" className="text-xs">Unidade</Label>
                <select id="exp-unidade" className="h-8 rounded-controle border border-fio bg-campo px-2" value={unidadeId}
                  onChange={(e) => setUnidadeEscolhida(e.target.value)} disabled={ocupado}>
                  <option value="">Escolha…</option>
                  {(todas.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="exp-conjunto" className="text-xs">Conjunto</Label>
              <select id="exp-conjunto" className="h-8 rounded-controle border border-fio bg-campo px-2" value={conjunto}
                onChange={(e) => setConjunto(e.target.value as Conjunto)} disabled={ocupado}>
                {(Object.keys(CONJUNTOS) as Conjunto[]).map((k) => <option key={k} value={k}>{CONJUNTOS[k].rotulo}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="exp-formato" className="text-xs">Formato</Label>
              <select id="exp-formato" className="h-8 rounded-controle border border-fio bg-campo px-2" value={formato}
                onChange={(e) => setFormato(e.target.value as Formato)} disabled={ocupado}>
                <option value="csv">CSV (Excel)</option>
                <option value="json">JSON (campos da API)</option>
              </select>
            </div>
          </div>

          {c.comPeriodo ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="exp-desde" className="text-xs">De</Label>
                <Input id="exp-desde" type="date" className="h-8" value={desde} max={ate} onChange={(e) => setDesde(e.target.value)} disabled={ocupado} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="exp-ate" className="text-xs">Até</Label>
                <Input id="exp-ate" type="date" className="h-8" value={ate} min={desde} onChange={(e) => setAte(e.target.value)} disabled={ocupado} />
              </div>
              <p className="self-end text-rotulo text-tinta-sussurro">Até 12 meses por exportação.</p>
            </div>
          ) : (
            <p className="text-rotulo text-tinta-sussurro">Leitos saem como estão agora; não há período.</p>
          )}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs text-tinta-apoio">Dados do paciente (nome, CPF, CNS, nascimento)</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="exp-mascara" className="size-4" checked={mascarado} onChange={() => { setMascarado(true); setConfirmar(false) }} disabled={ocupado} />
              Mascarados (iniciais, CPF e CNS parciais, só o ano de nascimento)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="exp-mascara" className="size-4" checked={!mascarado} onChange={() => setMascarado(false)} disabled={ocupado} />
              Completos (pede o motivo e o código do segundo fator)
            </label>
          </fieldset>

          {!mascarado && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="exp-motivo" className="text-xs">Motivo da exportação completa</Label>
              <Input id="exp-motivo" className="h-8" placeholder="ex.: auditoria do SUS pediu a lista nominal de setembro"
                value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={ocupado} />
              <span className="text-rotulo text-tinta-sussurro">
                Mínimo de 10 letras. O motivo e cada paciente exportado ficam registrados na auditoria.
              </span>
            </div>
          )}

          {confirmar && !mascarado && (
            <div className="flex flex-col gap-2 rounded-md border border-acao/40 bg-campo p-3">
              <span className="flex items-center gap-1.5 font-medium text-tinta"><ShieldCheck className="size-4" aria-hidden /> Confirme que é você</span>
              {fator.data ? (
                <ConfirmarSegundoFator fatorId={fator.data} rotulo="Confirmar e exportar"
                  onPronto={() => { setConfirmar(false); void exportar() }} />
              ) : (
                <ConfirmarSegundoFatorEmail permitirConfiar={false}
                  onPronto={() => { setConfirmar(false); void exportar() }} />
              )}
            </div>
          )}

          <MensagemErro texto={erro} />
          {pronto && <p role="status" className="text-apoio text-sucesso">Arquivo gerado: {pronto}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void exportar()} disabled={ocupado || !!problema || faltaMotivo || confirmar}>
              {ocupado ? <Spinner /> : <Download className="size-4" aria-hidden />} Exportar
            </Button>
            {progresso && (
              <span className="text-apoio text-tinta-apoio" aria-live="polite">
                {progresso.total ? `${progresso.feitas} de ${progresso.total} linhas…` : 'Preparando…'}
              </span>
            )}
            {!ocupado && problema && <span className="text-apoio text-atencao">{problema}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportações desta unidade</CardTitle>
          <CardDescription>As 50 mais recentes, de qualquer pessoa: quem pediu, quando, o quê e se saiu completa.</CardDescription>
        </CardHeader>
        <CardContent className="text-apoio">
          {!unidadeId ? null : lista.isLoading ? <Spinner /> : lista.error ? <MensagemErro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
            <Vazio icone={FileDown} titulo="Nenhuma exportação" texto="As exportações desta unidade aparecem aqui." />
          ) : (
            <ul className="flex flex-col divide-y divide-fio">
              {(lista.data ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-medium text-tinta">{CONJUNTOS[r.conjunto]?.rotulo ?? r.conjunto}</span>
                  <Badge variant="secondary">{r.formato.toUpperCase()}</Badge>
                  <Badge variant={r.mascarado ? 'success' : 'warning'}>{r.mascarado ? 'mascarada' : 'completa'}</Badge>
                  <span className="text-tinta-apoio">
                    {r.desde && r.ate ? `${fmtData(r.desde)} a ${fmtData(r.ate)}` : 'situação no momento'} · {r.linhas === 1 ? '1 linha' : `${r.linhas} linhas`}
                  </span>
                  <span className="ml-auto text-tinta-sussurro">
                    {r.solicitada_por ?? '—'} · {fmtDataHora(r.solicitada_em)}{r.concluida_em ? '' : ' · não concluída'}
                  </span>
                  {r.motivo && <span className="w-full text-rotulo text-tinta-sussurro">Motivo: {r.motivo}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
