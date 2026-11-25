// Impressão do pedido de exames do leito (EXM6, modelo do RT de 25/11/2026):
// folha única ou uma por setor (laboratório, imagem, ECG), com prioridade,
// indicação clínica e CID. A folha é a do documento "pedido_exames"
// (lib/folhas, a mesma da porta): o documento é emitido no servidor, que põe o
// médico e o CRM do login; não há campo de médico para editar (EXM11). O
// conteúdo não leva o texto do pedido: os exames já estão gravados, e a
// emissão só imprime.
import { useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import * as React from 'react'

import { invalidarDocumentos } from '@/components/documento/documentos'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { conteudoDaFolha, NOME_SETOR, type ExameParaFolha, type ModoFolha } from '@/lib/examesAba'
import { abrirImpressao } from '@/lib/prontuario'

export type PedidoParaImprimir = { exames: ExameParaFolha[]; geral?: { indicacao?: string; cid?: string | null; urgente?: boolean; obs?: string } }

export function ImprimirPedidoExames({ pedido, pacienteId, internacaoId, onFechar }: {
  pedido: PedidoParaImprimir; pacienteId: string; internacaoId: string; onFechar: () => void
}) {
  const qc = useQueryClient()
  const setores = [...new Set(pedido.exames.map((e) => e.grupo ?? 'laboratorio'))]
  const [modo, setModo] = React.useState<ModoFolha>(setores.length > 1 ? 'setor' : 'unica')
  const [imprimindo, setImprimindo] = React.useState(false)
  // o servidor só emite o pedido com indicação clínica (regra do documento): pedido
  // feito sem indicação ganha o campo aqui, em vez de falhar na janela de impressão
  const semIndicacao = !conteudoDaFolha(pedido.exames, modo, pedido.geral).pedido.indicacao
  const [indicacao, setIndicacao] = React.useState('')
  const conteudo = conteudoDaFolha(pedido.exames, modo, semIndicacao ? { ...pedido.geral, indicacao } : pedido.geral)
  const n = pedido.exames.length

  // a janela abre no clique (abrirImpressao): o bloqueador de pop-up barra a que abre depois
  const imprimir = async () => {
    setImprimindo(true)
    const impressao = await abrirImpressao({
      pacienteId, internacaoId, tipo: 'Pedido de exames',
      documento: { tipo: 'pedido_exames', conteudo: JSON.stringify(conteudo) },
    })
    setImprimindo(false)
    if (!impressao) return
    invalidarDocumentos(qc)
    impressao.janela.focus()
    setTimeout(() => impressao.janela.print(), 300)
    onFechar()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Imprimir pedido de exames</DialogTitle>
          <DialogDescription>
            {n} {n === 1 ? 'exame' : 'exames'} · {conteudo.pedido.carater}. O médico e o CRM saem do seu login.
          </DialogDescription>
        </DialogHeader>
        {setores.length > 1 && (
          <div role="radiogroup" aria-label="Formato da folha" className="flex flex-wrap gap-1.5">
            <Chip radio ativo={modo === 'unica'} onClick={() => setModo('unica')}>Folha única</Chip>
            <Chip radio ativo={modo === 'setor'} onClick={() => setModo('setor')}>Uma folha por setor</Chip>
          </div>
        )}
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-controle border border-fio p-3 text-apoio">
          {conteudo.pedido.folhas.map((f, k) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-rotulo font-semibold text-tinta-sussurro">{f.documento}{modo === 'setor' ? ` · folha ${k + 1} de ${conteudo.pedido.folhas.length}` : ''}</span>
              {f.grupos.map((g) => (
                <div key={g.nome} className="flex flex-col">
                  {modo === 'unica' && setores.length > 1 && <span className="text-rotulo text-tinta-apoio">{g.nome}</span>}
                  {g.itens.map((x) => <span key={x} className="text-tinta">{x}</span>)}
                </div>
              ))}
            </div>
          ))}
          {(conteudo.pedido.indicacao || conteudo.pedido.cid) && (
            <span className="border-t border-trilha pt-2 text-rotulo text-tinta-apoio">
              {conteudo.pedido.indicacao ? `Indicação: ${conteudo.pedido.indicacao}` : ''}
              {conteudo.pedido.indicacao && conteudo.pedido.cid ? ' · ' : ''}
              {conteudo.pedido.cid ? `CID-10 ${conteudo.pedido.cid}` : ''}
            </span>
          )}
          {conteudo.pedido.obs_pedido && <span className="text-rotulo text-tinta-apoio">Observação do pedido: {conteudo.pedido.obs_pedido}</span>}
        </div>
        {semIndicacao && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="imp-indicacao">Indicação clínica</Label>
            <Input id="imp-indicacao" value={indicacao} maxLength={500} onChange={(e) => setIndicacao(e.target.value)} />
            <span className="text-rotulo text-tinta-sussurro">Este pedido foi feito sem indicação, e a folha do pedido não sai sem ela.</span>
          </div>
        )}
        <p className="text-rotulo text-tinta-sussurro">
          A impressão fica registrada no prontuário como documento de pedido de exames. {setores.length > 1 ? `Setores: ${setores.map((s) => NOME_SETOR[s]).join(', ')}.` : ''}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={imprimindo || n === 0 || !conteudo.pedido.indicacao} onClick={() => void imprimir()}><Printer aria-hidden /> Imprimir</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
