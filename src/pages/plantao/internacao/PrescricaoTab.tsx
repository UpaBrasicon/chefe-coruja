import { Check, Clipboard, FileCheck2, Printer } from 'lucide-react'
import { abrirImpressao, abrirProntuario } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DadosPaciente, Prescricao } from './rascunho'
import { CATEGORIAS, ITENS } from './prescricaoItens'

function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function PrescricaoTab({
  dados,
  prescricao,
  onChange,
  pacienteId,
}: {
  dados: DadosPaciente
  prescricao: Prescricao
  onChange: (p: Partial<Prescricao>) => void
  pacienteId?: string | null
}) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [copiado, setCopiado] = React.useState(false)
  const [registrando, setRegistrando] = React.useState(false)
  const [registrado, setRegistrado] = React.useState(false)
  const [erroRegistro, setErroRegistro] = React.useState<string | null>(null)
  const marcados = React.useMemo(() => new Set(prescricao.marcados), [prescricao.marcados])

  // Prescrição ativa do paciente (do banco) — para pré-marcar ao abrir
  const { data: prescricaoBanco } = useQuery({
    queryKey: ['prescricao-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      await abrirProntuario(pacienteId!)
      const { data, error } = await supabase
        .from('prescricoes')
        .select('id, status, observacoes, prescricao_itens(descricao, dose, posologia)')
        .eq('paciente_id', pacienteId!)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  // Extrai o "nome do medicamento" de um texto do catálogo (ex.: "DIPIRONA 01AMP"
  // → "dipirona"; "SORO FISIOLÓGICO 0,9%" → "soro fisiológico").
  function nomeMed(texto: string) {
    return texto
      .toLowerCase()
      .split(',')[0]
      .replace(/[0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // IDs do catálogo correspondentes aos itens do banco (pré-marcados)
  const idsDoBanco = React.useMemo(() => {
    const itens = prescricaoBanco?.prescricao_itens ?? []
    const set = new Set<string>()
    for (const it of itens) {
      const d = it.descricao.toLowerCase()
      const match = ITENS.find((i) => d.includes(nomeMed(i.med)) && nomeMed(i.med).length > 2)
      if (match) set.add(String(match.n))
    }
    return set
  }, [prescricaoBanco])

  // Marcados efetivos = rascunho + itens vindos do banco
  const marcadosEfetivos = React.useMemo(() => {
    return new Set([...marcados, ...idsDoBanco])
  }, [idsDoBanco, marcados])

  async function registrarPrescricao() {
    if (!unidadeId || !pacienteId) {
      setErroRegistro('Identifique o paciente (Dados do Paciente) antes de registrar a prescrição.')
      return
    }
    setRegistrando(true)
    setErroRegistro(null)
    const itens = ITENS.filter((i) => marcadosEfetivos.has(String(i.n))).map((i) => ({
      medicamento: i.med,
      dose: i.via !== '---' ? i.via : undefined,
      posologia: i.pos,
      ordem: i.n,
    }))
    const { error } = await supabase.rpc('registrar_prescricao_itens', {
      p_paciente: pacienteId,
      p_observacoes: prescricao.obs || undefined,
      p_itens: JSON.stringify(itens),
    })
    setRegistrando(false)
    if (error) {
      setErroRegistro(error.message)
      return
    }
    setRegistrado(true)
    setTimeout(() => setRegistrado(false), 4000)
  }

  function toggle(n: number) {
    const next = new Set(marcadosEfetivos)
    if (next.has(String(n))) next.delete(String(n))
    else next.add(String(n))
    onChange({ marcados: [...next] })
  }

  const itensSelecionados = ITENS.filter((i) => marcadosEfetivos.has(String(i.n)))
  const conteudoDoc = JSON.stringify({
    paciente: dados,
    itens: itensSelecionados.map((i) => ({ med: i.med, via: i.via, pos: i.pos, apr: i.apr ?? '' })),
    obs: prescricao.obs,
  })
  const servidor = useRascunhoServidor(dados.paciente_id, 'prescricao', conteudoDoc)

  async function copiar() {
    const linhas = itensSelecionados.map((i, idx) => `${String(idx + 1).padStart(2, '0')}\t${i.med}\t${i.via}\t${i.pos}`)
    const texto = [`Nome: ${dados.nome}`, `Data: ${fmtData(dados.dataAtual)}`, '', ...linhas].join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  async function imprimir() {
    const impressao = await abrirImpressao({
      pacienteId: dados.paciente_id, internacaoId: null, tipo: 'Prescrição',
      documento: { tipo: 'prescricao', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId(),
    })
    if (!impressao) return
    servidor.emitido(conteudoDoc)
    const printWindow = impressao.janela
    // a folha já veio pronta do servidor (Fase 4.2), ou é a provisória
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens da Prescrição</CardTitle>
          <CardDescription>Marque os itens desejados. O preview mostra apenas os selecionados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {CATEGORIAS.map((cat) => {
            const itens = ITENS.filter((i) => i.cat === cat.id)
            if (!itens.length) return null
            return (
              <div key={cat.id}>
                <div className="mb-2 border-b-2 border-primary pb-1 text-sm font-semibold text-primary">
                  {cat.label}{' '}
                  {cat.desc && <span className="font-normal text-muted-foreground">({cat.desc})</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {itens.map((i) => (
                    <label
                      key={i.n}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm transition-colors ${
                        marcadosEfetivos.has(String(i.n)) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <input type="checkbox" className="mt-0.5 size-4" checked={marcadosEfetivos.has(String(i.n))} onChange={() => toggle(i.n)} />
                      <span>
                        <span className="font-medium">
                          {i.n}. {i.med}
                        </span>
                        {i.via !== '---' && (
                          <span className="block text-xs text-muted-foreground">
                            {i.via} · {i.pos}
                            {i.apr ? ` · ${i.apr}` : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Pré-visualização</CardTitle>
          <CardDescription>Reflete os itens selecionados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {dados.alergias && dados.alergias.toUpperCase() !== 'NEGA' && (
            <div className="rounded-lg bg-critico px-4 py-3 text-center text-sm font-semibold text-white">
              ⚠ ALERGIA: {dados.alergias.toUpperCase()}
            </div>
          )}
          {prescricaoBanco && (
            <p className="rounded-lg border border-conforme/30 bg-conforme/[0.08] px-3 py-2 text-xs text-conforme">
              ✓ Prescrição carregada do sistema: {(prescricaoBanco.prescricao_itens ?? []).length} item(ns) — itens
              correspondentes marcados.
            </p>
          )}
          <div className="rounded-lg border bg-white p-3 text-xs">
            <div className="mb-2 text-center font-semibold uppercase">Prescrição Médica</div>
            <div className="mb-3 space-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <span><strong>Nome:</strong> {dados.nome || '…'}</span>
                <span><strong>Nascimento:</strong> {dados.nascimento || '…'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span><strong>Leito:</strong> {dados.leito || '…'}</span>
                <span><strong>Data:</strong> {fmtData(dados.dataAtual) || '…'}</span>
                <span><strong>Diagnóstico:</strong> {dados.diagnostico || '…'}</span>
              </div>
            </div>
            {itensSelecionados.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Nenhum item selecionado.</p>
            ) : (
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-y border-black bg-black text-white">
                    <th className="w-8 p-1.5">ITEM</th>
                    <th className="p-1.5">NOME</th>
                    <th className="w-10 p-1.5 text-center">VIA</th>
                    <th className="w-16 p-1.5">POSOLOGIA</th>
                  </tr>
                </thead>
                <tbody>
                  {itensSelecionados.map((i, idx) => (
                    <tr key={i.n} className="border-b border-black/20">
                      <td className="p-1.5 text-center font-semibold text-muted-foreground">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="p-1.5 font-medium">{i.med}</td>
                      <td className="p-1.5 text-center font-semibold text-primary">{i.via}</td>
                      <td className="p-1.5">{i.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presc-obs">Observações</Label>
            <Textarea id="presc-obs" value={prescricao.obs} onChange={(e) => onChange({ obs: e.target.value })} placeholder="Dúvidas com a equipe de enfermagem, assinatura, etc." />
          </div>
          <div className="flex gap-2">
            <Button onClick={imprimir} disabled={!itensSelecionados.length}>
              <Printer /> Imprimir
            </Button>
            <Button variant="outline" onClick={copiar} disabled={!itensSelecionados.length}>
              {copiado ? <Check className="text-conforme" /> : <Clipboard />} {copiado ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button
              variant="secondary"
              onClick={registrarPrescricao}
              disabled={registrando}
              title="Necessário para encaminhar o paciente à observação"
            >
              {registrando ? <span className="size-4 animate-spin rounded-full border-2 border-suprimento/30 border-t-sky-600" /> : <FileCheck2 />}
              {registrado ? 'Prescrição registrada!' : 'Registrar prescrição'}
            </Button>
          </div>
          {erroRegistro && <p className="text-sm text-destructive">{erroRegistro}</p>}
          {!pacienteId && (
            <p className="text-xs text-muted-foreground">
              Registre a prescrição após identificar o paciente — obrigatório para encaminhá-lo à
              observação.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
