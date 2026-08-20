import { CheckCircle2, History, Loader2, Printer, Save, Sparkles } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { escapeHtml } from '@/lib/utils'
import {
  useDocumentos,
  useSalvarDocumento,
} from '@/hooks/useDocumentos'
import type { DadosPaciente, Evolucao } from './rascunho'

function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function EvolucaoTab({
  dados,
  evolucao,
  onChange,
  pacienteId,
  unidadeId,
  internacaoId,
}: {
  dados: DadosPaciente
  evolucao: Evolucao
  onChange: (p: Partial<Evolucao>) => void
  pacienteId?: string | null
  unidadeId?: string | null
  internacaoId?: string | null
}) {
  const { data: documentos, isLoading: carregandoDocs } = useDocumentos(pacienteId ?? undefined)
  const salvarDoc = useSalvarDocumento()
  const [msg, setMsg] = React.useState<string | null>(null)

  const evolucoesSalvas = React.useMemo(
    () => (documentos ?? []).filter((d) => d.tipo_documento === 'evolucao'),
    [documentos]
  )
  const admissaoSalva = React.useMemo(
    () => (documentos ?? []).find((d) => d.tipo_documento === 'admissao_anamnese'),
    [documentos]
  )

  function gerarTexto() {
    const idade = dados.idade || 'N/I'
    const dieta = dados.dieta || 'Dieta livre'
    const alergia = dados.alergias && dados.alergias.toUpperCase() !== 'NEGA' ? `\nALERGIAS: ${dados.alergias.toUpperCase()}` : ''
    const diagnostico = dados.diagnostico || 'Diagnóstico em avaliação'

    const admissao = `TERMO DE ADMISSÃO\n\nPaciente: ${dados.nome || '______________'}\nIdade: ${idade} | Peso: ${dados.peso || '___'} kg | Data: ${fmtData(dados.dataAtual)}\nDiagnóstico: ${diagnostico}${alergia}\n\nQueixa principal:\n[Preencher]\n\nHistória da doença atual:\n[Preencher]\n\nAntecedentes pessoais:\n[Preencher]\n\nExame físico (sinais vitais e achados):\n[Preencher]\n\nConduta:\n- Dieta: ${dieta}\n- Prescrição médica conforme sistema.\n\nObservações de enfermagem:\n[Preencher]`

    const evolucaoSOAP = `EVOLUÇÃO MÉDICA (SOAP)\n\nS (SUBJETIVO):\nPaciente em acompanhamento. Refere sintomas conforme quadro de ${diagnostico}.\n[Preencher queixas, evolução dos sintomas]\n\nO (OBJETIVO):\nExame físico: [Preencher sinais vitais e achados]\n\nA (AVALIAÇÃO):\nDiagnóstico: ${diagnostico}.\n[Preencher análise]\n\nP (PLANO):\n- Dieta: ${dieta}\n- Conduta / ajustes de prescrição: [Preencher]\n- Exames complementares: [Preencher]\n- Retorno / Reavaliação: [Preencher]${alergia ? `\n\nALERGIAS: ${dados.alergias.toUpperCase()}` : ''}`

    const texto = evolucao.tipo === 'admissao' ? admissao : evolucaoSOAP
    onChange({ texto })
  }

  function imprimir() {
    const alergiaHtml =
      dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
        ? `<div style="background:#dc2626;color:#fff;padding:4px;text-align:center;font-weight:800;font-size:11px;margin-bottom:8px;">⚠️ ALERGIA: ${escapeHtml(dados.alergias).toUpperCase()} ⚠️</div>`
        : ''
    const cabecalho = evolucao.tipo === 'admissao' ? 'TERMO DE ADMISSÃO' : 'EVOLUÇÃO MÉDICA'
    const textoHtml = escapeHtml(evolucao.texto).replace(/\n/g, '<br>')
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>${cabecalho}</title>
      <style>
        @page{size:A4 portrait;margin:0}
        html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .folha{position:relative;width:210mm;height:297mm;overflow:hidden}
        .folha>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1}
        .conteudo{position:relative;z-index:10;margin:120px auto 0;width:90%;display:flex;flex-direction:column;height:calc(297mm - 150px)}
        .cabec{border:1px solid #000;padding:6px 10px;margin-bottom:6px;font-size:13px;line-height:1.6;text-transform:uppercase;background:#fff}
        .titulo{text-align:center;font-weight:bold;font-size:14px;margin-bottom:6px;text-decoration:underline;background:#fff}
        .texto{flex-grow:1;border:1px solid #000;padding:10px 14px;font-size:11.5pt;line-height:1.5;overflow:hidden;background:#fff;white-space:pre-wrap}
        .ass{margin-top:auto;padding-top:15px;padding-bottom:20px;text-align:center;font-size:11pt;background:#fff}
      </style></head>
      <body>
        <div class="folha">
          <img src="/plantao/background.png">
          <div class="conteudo">
            <div class="cabec">
              <div style="display:flex;justify-content:space-between"><strong>Nome:</strong> ${escapeHtml(dados.nome) || '____________________'} <strong>Data de Nascimento:</strong> ${escapeHtml(dados.nascimento) || '____/___/____'}</div>
              <div style="display:flex;justify-content:space-between;margin-top:4px"><strong>Leito:</strong> ${escapeHtml(dados.leito) || '___'} <strong>Data:</strong> ${fmtData(dados.dataAtual)} <strong>Diagnóstico:</strong> ${escapeHtml(dados.diagnostico) || '____'}</div>
            </div>
            <div class="titulo">${cabecalho}</div>
            ${alergiaHtml}
            <div class="texto">${textoHtml}</div>
            <div class="ass">_________________________________________<br>Assinatura / Carimbo do Médico</div>
          </div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  async function salvarNoProntuario() {
    if (!pacienteId || !unidadeId || !evolucao.texto.trim()) return
    setMsg(null)
    try {
      const tipo = evolucao.tipo === 'admissao' ? 'admissao_anamnese' : 'evolucao'
      await salvarDoc.mutateAsync({
        paciente_id: pacienteId,
        unidade_id: unidadeId,
        internacao_id: internacaoId ?? null,
        tipo_documento: tipo,
        conteudo: evolucao.texto,
      })
      setMsg('Documento salvo no prontuário (nova versão, retificação rastreável).')
    } catch (e) {
      setMsg('Erro ao salvar: ' + (e as Error).message)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Gerador de Documento</CardTitle>
          <CardDescription>Escolha o modelo e clique em Gerar Texto para aplicar os dados do paciente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                checked={evolucao.tipo === 'admissao'}
                onChange={() => onChange({ tipo: 'admissao' })}
                className="size-4 accent-primary"
              />
              Admissão
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                checked={evolucao.tipo === 'evolucao'}
                onChange={() => onChange({ tipo: 'evolucao' })}
                className="size-4 accent-primary"
              />
              Evolução (SOAP)
            </label>
          </div>
          <Button onClick={gerarTexto}>
            <Sparkles /> Gerar Texto
          </Button>
          <p className="text-xs text-muted-foreground">
            O texto gerado pode ser editado à vontade. Ele é salvo automaticamente no navegador.
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <div className="mb-1 font-semibold">Documentos no prontuário</div>
            {carregandoDocs ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="animate-spin" /> carregando…
              </span>
            ) : (
              <div className="flex flex-col gap-1">
                {admissaoSalva && (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Admissão v{admissaoSalva.versao}{' '}
                    <Badge variant="success">{admissaoSalva.estado}</Badge>
                  </span>
                )}
                {evolucoesSalvas.length === 0 && !admissaoSalva && (
                  <span className="text-muted-foreground">Nenhum documento persistido ainda.</span>
                )}
                {evolucoesSalvas.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <History className="size-3" /> {evolucoesSalvas.length} versão(ões) de evolução
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Área de Edição</CardTitle>
          <CardDescription>Revise o texto antes de salvar/ imprimir.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={evolucao.texto}
            onChange={(e) => onChange({ texto: e.target.value })}
            placeholder="Clique em Gerar Texto para preencher a partir dos dados do paciente…"
            className="min-h-[360px] font-mono text-xs leading-relaxed"
          />
          {msg && (
            <div
              className={`rounded-lg border p-2.5 text-xs ${
                msg.startsWith('Erro')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {msg}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={salvarNoProntuario}
                disabled={!pacienteId || !evolucao.texto.trim() || salvarDoc.isPending}
              >
                {salvarDoc.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar no prontuário
              </Button>
              <Button onClick={imprimir} disabled={!evolucao.texto}>
                <Printer /> Imprimir
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {evolucao.texto.length} caracteres · salvo automaticamente
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
