// Sumário de alta da internação (AL2, revisão da Internação aprovada pelo RT
// em 24/11/2026). O rascunho é montado do caderno — motivo e CID, resumo do
// caso, última avaliação, exames com o valor cru e a data, prescrição para
// casa (a receita que o médico escreveu nesta aba), seguimento —, marcado
// "veio do prontuário, revise" e editável. Só sai depois de o médico revisar
// (editar ou marcar "Revisei"). Emitido como documento sumario_alta pelo
// rascunho do banco (abrirImpressao), ligado à internação; o autor é quem
// está logado (o servidor grava).
import { FileText, Printer } from 'lucide-react'
import * as React from 'react'

import { abrirImpressao } from '@/lib/prontuario'
import { MARCA_PRONTUARIO, sumarioAlta } from '@/lib/doProntuario'
import type { EstadoDocs } from '@/lib/documentosAlta'
import { useResumoClinico } from '@/components/evolucao/dados'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { ROTULO_ALTA, type Internacao } from './comum'
import { useDoProntuario } from './useDoProntuario'

export function SumarioAlta({ i, pacienteId, tipoSaida, receita, podeEmitir, aoEmitir }: {
  i: Internacao; pacienteId: string; tipoSaida: string; receita: EstadoDocs['receita']; podeEmitir: boolean; aoEmitir: () => void
}) {
  const dp = useDoProntuario(pacienteId, i.id)
  const resumo = useResumoClinico(i.id)
  const [texto, setTexto] = React.useState<string | null>(null)
  const [revisado, setRevisado] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const pronto = dp.pronto && !resumo.isLoading

  const montar = () => sumarioAlta({
    admissao: i.internado_em ?? i.data_admissao,
    motivo: ROTULO_ALTA[tipoSaida],
    diagnosticos: dp.diagnosticos,
    resumoCaso: resumo.data?.resumo?.texto ?? null,
    evolucao: dp.evolucao,
    exames: dp.exames,
    prescricaoCasa: receita.map((r) => `${r.medicamento}${r.posologia ? ` — ${r.posologia}` : ''}${r.quantidade ? ` (${r.quantidade})` : ''}`).join('\n'),
  })
  const valor = texto ?? (pronto ? montar() : '')

  async function emitir() {
    setErro(null)
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: i.id, tipo: 'Sumário de alta',
      documento: { tipo: 'sumario_alta', conteudo: JSON.stringify({ texto: valor }) },
    })
    if (!impressao) return setErro('Não foi possível emitir o sumário.')
    impressao.janela.focus()
    window.setTimeout(() => impressao.janela.print(), 300)
    aoEmitir()
  }

  if (!pronto) return <p className="text-apoio text-tinta-sussurro">Montando o rascunho do sumário com o prontuário…</p>
  return (
    <div className="flex flex-col gap-2">
      {!revisado && (
        <p role="status" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
          Rascunho: {MARCA_PRONTUARIO}. Complete a condição na alta e os procedimentos; o que vier errado, corrija aqui.
        </p>
      )}
      <Textarea aria-label="Sumário de alta" rows={16} value={valor} className="leading-[1.5]" disabled={!podeEmitir}
        onChange={(e) => { setTexto(e.target.value); setRevisado(true) }} />
      {podeEmitir && (
        <div className="flex flex-wrap items-center gap-2">
          {!revisado && <Button size="sm" variant="outline" onClick={() => setRevisado(true)}>Revisei o rascunho</Button>}
          <Button size="sm" disabled={!revisado || valor.trim().length < 20} onClick={() => void emitir()}><Printer aria-hidden /> Emitir sumário de alta</Button>
          {texto !== null && <Button size="sm" variant="outline" onClick={() => { setTexto(null); setRevisado(false) }}><FileText aria-hidden /> Montar de novo do prontuário</Button>}
          {!revisado && <span className="text-rotulo text-tinta-sussurro">Sai só depois de revisado.</span>}
        </div>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
    </div>
  )
}
