import { Plus, Printer, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { fmtData, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

export type PedidoExames = {
  texto: string
}

export type RascunhoPedido = {
  paciente: DadosPacienteType
  pedido: PedidoExames
}

const PEDIDO_INICIAL: RascunhoPedido = {
  paciente: {
    nome: '',
    nascimento: '',
    dataAtual: '',
    idade: '',
    peso: '',
    alergias: '',
    dieta: 'Dieta livre',
    leito: '',
    diagnostico: '',
  },
  pedido: {
    texto: '',
  },
}

function carregarPedido(chave: string): RascunhoPedido {
  try {
    const raw = localStorage.getItem(chave)
    if (!raw) return PEDIDO_INICIAL
    const p = JSON.parse(raw) as Partial<RascunhoPedido>
    return {
      paciente: { ...PEDIDO_INICIAL.paciente, ...(p.paciente ?? {}), dataAtual: hojeLocal() },
      pedido: { ...PEDIDO_INICIAL.pedido, ...(p.pedido ?? {}) },
    }
  } catch {
    return PEDIDO_INICIAL
  }
}

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

export function PedidoExames({
  unidadeId,
  perfilId,
}: {
  unidadeId?: string
  perfilId?: string
}) {
  const { dados, atualizar, salvoEm, limpar } = useRascunho<RascunhoPedido>(
    'pedido-exames',
    unidadeId,
    perfilId,
    carregarPedido
  )
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)
  const [novo, setNovo] = React.useState('')

  function adicionarSugerido(exame: string) {
    const atual = dados.pedido.texto.trim()
    atualizar({ pedido: { texto: atual ? `${atual}\n- ${exame}` : `- ${exame}` } })
  }

  function adicionarCustom() {
    const v = novo.trim()
    if (!v) return
    const atual = dados.pedido.texto.trim()
    atualizar({ pedido: { texto: atual ? `${atual}\n- ${v}` : `- ${v}` } })
    setNovo('')
  }

  function imprimir() {
    const texto = dados.pedido.texto.trim()
    if (!texto) return
    const paciente = dados.paciente.nome.trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
    const data = fmtData(dados.paciente.dataAtual)
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
    <div className="flex flex-col gap-4">
      <DadosPaciente
        unidadeId={unidadeId}
        perfilId={perfilId}
        dados={dados.paciente}
        onChange={(p) => atualizar({ paciente: { ...dados.paciente, ...p } })}
        escalaSetores={escalaSetores}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedido de Exames</CardTitle>
          <CardDescription>Clique nos exames sugeridos ou digite livremente. Salvo automaticamente.</CardDescription>
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
            <Textarea
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Digite um exame livre…"
              className="min-h-10 flex-1"
            />
            <Button variant="secondary" onClick={adicionarCustom} disabled={!novo.trim()}>
              <Plus /> Adicionar
            </Button>
          </div>

          <Textarea
            value={dados.pedido.texto}
            onChange={(e) => atualizar({ pedido: { texto: e.target.value } })}
            placeholder="Os exames gerados aparecerão aqui…"
            className="min-h-[240px] font-mono text-xs leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button onClick={imprimir} disabled={!dados.pedido.texto.trim()}>
                <Printer /> Imprimir Pedido
              </Button>
              <Button variant="ghost" onClick={limpar}>
                <Trash2 /> Limpar
              </Button>
            </div>
            {salvoEm && <span className="text-xs text-emerald-700">Salvo às {salvoEm}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
