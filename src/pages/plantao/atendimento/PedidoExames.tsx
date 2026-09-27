import { Plus, Printer, Trash2 } from 'lucide-react'
import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { usePacienteDaUrl } from '../shared/usePacienteDaUrl'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { carregarEnvelope, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

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
  const carregado = carregarEnvelope<RascunhoPedido>(chave)
  if (!carregado) return PEDIDO_INICIAL
  try {
    const p = carregado.dados as Partial<RascunhoPedido>
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
  const conteudoDoc = JSON.stringify(dados)
  const servidor = useRascunhoServidor(dados.paciente.paciente_id, 'pedido_exames', conteudoDoc)
  usePacienteDaUrl(dados.paciente, (p) => atualizar({ paciente: { ...dados.paciente, ...p } }))
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)
  const [novo, setNovo] = React.useState('')

  function adicionarSugerido(exame: string) {
    const atual = dados.pedido.texto.trim()
    atualizar({ pedido: { texto: atual ? `${atual}\n- ${exame}` : `- ${exame}` } })
  }

  function adicionarLoinc(descricao: string, codigo: string) {
    const exame = `${descricao} (${codigo})`
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

  async function imprimir() {
    const texto = dados.pedido.texto.trim()
    if (!texto) return
    const impressao = await abrirImpressao({ pacienteId: dados.paciente.paciente_id, internacaoId: null, tipo: 'Pedido de exames', documento: { tipo: 'pedido_exames', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId() })
    if (!impressao) return
    const printWindow = impressao.janela
    // a folha já veio pronta do servidor (Fase 4.2), ou é a provisória
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      servidor.emitido(conteudoDoc)
      limpar() // LGPD: remove dados de paciente do navegador após emissão
    }, 300)
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Buscar exame padronizado (LOINC)</span>
            <BuscaTerminologia
              tipo="loinc"
              onSelecionar={(r) => adicionarLoinc(r.descricao, r.codigo)}
              placeholder="Ex.: glicose, hemograma, potássio…"
            />
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
              <Button variant="ghost" onClick={() => { void servidor.descartar(); limpar() }}>
                <Trash2 /> Limpar
              </Button>
            </div>
            {salvoEm && <span className="text-xs text-conforme">Salvo às {salvoEm}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
