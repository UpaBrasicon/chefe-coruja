import { Plus, Printer, Trash2 } from 'lucide-react'
import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
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
  const conteudoDoc = JSON.stringify({ paciente: dados, exames })
  const servidor = useRascunhoServidor(dados.paciente_id, 'pedido_exames', conteudoDoc)

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

  async function imprimir() {
    const texto = exames.texto.trim()
    if (!texto) return

    const impressao = await abrirImpressao({
      pacienteId: dados.paciente_id, internacaoId: null, tipo: 'Pedido de exames (internação)',
      documento: { tipo: 'pedido_exames', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId(),
    })
    if (impressao) servidor.emitido(conteudoDoc)
    if (!impressao) return
    const printWindow = impressao.janela
    // a folha já veio pronta do servidor (Fase 4.2), ou é a provisória
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
                className="rounded-lg border border-fio bg-campo px-2.5 py-1 text-xs font-medium text-tinta transition-colors hover:border-acao hover:bg-acao/5"
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
          <p className="text-xs text-tinta-sussurro">
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
            <span className="text-xs text-tinta-sussurro">salvo automaticamente</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
