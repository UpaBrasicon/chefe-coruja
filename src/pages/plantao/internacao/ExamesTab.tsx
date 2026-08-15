import { Plus, Printer, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DadosPaciente, Exames } from './rascunho'

const EXAMES_SUGERIDOS = [
  'Hemograma completo',
  'Plaquetas',
  'Proteínas totais e frações',
  'TGO / TGP',
  'Eletrólitos (Na, K)',
  'Ureia e Creatinina',
  'Gasometria arterial',
  'Coagulograma (TP, TTPa)',
  'Raio-X de Tórax',
  'USG de Abdome',
  'Eletrocardiograma (ECG)',
  'Sorologias (dengue, zika, chikungunya)',
  'PCR / Procalcitonina',
  'Glicemia de jejum',
]

function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ExamesTab({
  dados,
  exames,
  onChange,
}: {
  dados: DadosPaciente
  exames: Exames
  onChange: (p: Partial<Exames>) => void
}) {
  const [novo, setNovo] = React.useState('')

  function adicionarSugerido(exame: string) {
    const atual = exames.texto.trim()
    onChange({ texto: atual ? `${atual}\n- ${exame}` : `- ${exame}` })
  }

  function adicionarCustom() {
    const v = novo.trim()
    if (!v) return
    const atual = exames.texto.trim()
    onChange({ texto: atual ? `${atual}\n- ${v}` : `- ${v}` })
    setNovo('')
  }

  function imprimir() {
    const texto = exames.texto.trim()
    if (!texto) return
    const paciente = dados.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
    const data = fmtData(dados.dataAtual)
    const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
    const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${l}</div>`).join('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Pedido de Exames</title>
      <style>
        @page{size:A4 landscape;margin:0}
        html,body{width:297mm;height:210mm;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:transparent}
        .folha{position:relative;width:297mm;height:209mm;overflow:hidden}
        .folha>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block}
        .overlay{position:absolute;z-index:10;background:transparent}
        .nome{top:40mm;left:33mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap}
        .data{top:193mm;left:20mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap}
        .exames{top:80mm;left:20mm;width:250mm;height:110mm;font-family:Arial;font-weight:bold;font-size:14px;color:black}
      </style></head>
      <body>
        <div class="folha">
          <img src="/plantao/MODELO_EXAMES.png">
          <div class="overlay nome">${paciente}</div>
          <div class="overlay data">DATA: ${data}</div>
          <div class="overlay exames">${listaHtml}</div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Gerador de Exames</CardTitle>
          <CardDescription>Clique nos exames sugeridos ou digite livremente. O texto é salvo automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {EXAMES_SUGERIDOS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => adicionarSugerido(ex)}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
              >
                + {ex}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Label htmlFor="ex-novo" className="sr-only">
              Digitar exame
            </Label>
            <Textarea
              id="ex-novo"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Digite um exame livre…"
              className="min-h-10 flex-1"
            />
            <Button variant="secondary" onClick={adicionarCustom} disabled={!novo.trim()}>
              <Plus /> Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: use Enter ou o botão Imprimir abaixo para gerar o pedido em folha de exames (paisagem).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Texto do Pedido</CardTitle>
            <CardDescription>Pode ser ajustado antes de imprimir.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onChange({ texto: '' })}>
            <Trash2 /> Limpar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={exames.texto}
            onChange={(e) => onChange({ texto: e.target.value })}
            placeholder="Os exames gerados aparecerão aqui…"
            className="min-h-[320px] font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <Button onClick={imprimir} disabled={!exames.texto.trim()}>
              <Printer /> Imprimir Pedido
            </Button>
            <span className="text-xs text-muted-foreground">salvo automaticamente</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
