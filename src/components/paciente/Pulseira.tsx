// ─────────────────────────────────────────────────────────────────────────────
// Pulseira de identificação (lacuna 2 do Portão de 11/10/2026; decisão do RT
// em 10/11/2026, A em P1–P8).
//  - BotaoPulseira: "Imprimir pulseira" (recepção, logo depois da ficha, do
//    não identificado e do RN) e "Reimprimir pulseira" (triagem, PS e lista
//    de internados). A reimpressão pede o motivo; depois de identificar o
//    paciente, o motivo já vem dado.
//  - AvisoTrocarPulseira: depois de "Identificar paciente", pede a troca da
//    pulseira provisória e oferece a nova.
// Na UBS não há pulseira: os dois não aparecem. Os dados e o registro são do
// servidor (registrar_impressao_pulseira).
// ─────────────────────────────────────────────────────────────────────────────
import { Printer } from 'lucide-react'
import * as React from 'react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { DETALHE_MAX, erroMotivo, MOTIVOS_REIMPRESSAO, type MotivoReimpressao } from '@/domain/pulseira'
import { imprimirPulseira } from '@/lib/pulseira'
import { cn } from '@/lib/utils'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Campo, Escolhas } from '@/components/paciente/CamposCadastro'

/** Na UBS não há pulseira (P7). */
function useSemPulseira() {
  const { unidadeAtiva } = useUnidade()
  return unidadeAtiva?.unidade.tipo === 'ubs'
}

export function BotaoPulseira({ pacienteId, nome, reimpressao = false, motivo, compacto = false, variant = 'outline', className }: {
  pacienteId: string
  /** para o diálogo do motivo */
  nome?: string
  reimpressao?: boolean
  /** motivo já conhecido (ex.: paciente identificado): reimprime sem perguntar */
  motivo?: MotivoReimpressao
  /** só o ícone, para linhas de tabela */
  compacto?: boolean
  variant?: 'outline' | 'ghost' | 'default'
  className?: string
}) {
  const semPulseira = useSemPulseira()
  const [aberto, setAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  // depois da primeira impressão, o mesmo botão vira reimpressão (pede motivo):
  // clique duplo não gera duas pulseiras sem registro do porquê
  const [impressa, setImpressa] = React.useState(false)
  if (semPulseira) return null

  const ehReimpressao = reimpressao || impressa
  const rotulo = ehReimpressao ? 'Reimprimir pulseira' : 'Imprimir pulseira'
  async function clicar() {
    if (enviando) return
    setErro(null)
    if (ehReimpressao && !motivo) return setAberto(true)
    setEnviando(true)
    const falha = await imprimirPulseira({ pacienteId, reimpressao: ehReimpressao, motivo })
    setEnviando(false)
    setErro(falha)
    if (!falha) setImpressa(true)
  }

  return (
    <>
      <span className={cn('inline-flex flex-col items-start gap-1', className)}>
        <Button size={compacto ? 'icon-sm' : 'sm'} variant={variant} disabled={enviando} onClick={() => void clicar()}
          aria-label={compacto ? `${rotulo}${nome ? ` de ${nome}` : ''}` : undefined} title={compacto ? rotulo : undefined}>
          <Printer />{!compacto && ` ${rotulo}`}
        </Button>
        {erro && <span role="alert" className="text-rotulo text-critico">{erro}</span>}
      </span>
      {ehReimpressao && !motivo && (
        <DialogoReimpressao pacienteId={pacienteId} nome={nome} aberto={aberto} onFechar={() => setAberto(false)} />
      )}
    </>
  )
}

function DialogoReimpressao({ pacienteId, nome, aberto, onFechar }: {
  pacienteId: string; nome?: string; aberto: boolean; onFechar: () => void
}) {
  const [motivo, setMotivo] = React.useState<MotivoReimpressao | ''>('')
  const [detalhe, setDetalhe] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  function fechar() {
    setMotivo(''); setDetalhe(''); setErro(null)
    onFechar()
  }

  async function imprimir() {
    const e = erroMotivo(motivo, detalhe)
    if (e) return setErro(e)
    setEnviando(true)
    const falha = await imprimirPulseira({ pacienteId, reimpressao: true, motivo: motivo as MotivoReimpressao, detalhe })
    setEnviando(false)
    if (falha) return setErro(falha)
    fechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) fechar() }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">Reimprimir pulseira</DialogTitle>
          <DialogDescription className="text-controle">
            {nome ? `${nome}. ` : ''}A reimpressão fica registrada com o motivo, quem imprimiu e a hora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <Escolhas rotulo="Motivo" opcoes={MOTIVOS_REIMPRESSAO} valor={motivo} onChange={(v) => { setMotivo(v); setErro(null) }} />
          {motivo === 'outro' && (
            <Campo id="pulseira-detalhe" rotulo="Qual é o motivo" dica="Só o motivo, sem dados do paciente.">
              <Input id="pulseira-detalhe" maxLength={DETALHE_MAX} value={detalhe} placeholder="Ex.: rasgou no banho"
                onChange={(e) => { setDetalhe(e.target.value); setErro(null) }} />
            </Campo>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_200px] text-apoio text-critico">{erro}</span>
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button disabled={enviando} onClick={() => void imprimir()}><Printer /> Imprimir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Depois de identificar: o aviso de troca da pulseira provisória, com a nova. */
export function AvisoTrocarPulseira({ paciente, className }: {
  paciente: { paciente_id: string; nome: string; prontuario: string | null }
  className?: string
}) {
  const semPulseira = useSemPulseira()
  const texto = `Paciente identificado: ${paciente.nome}${paciente.prontuario ? ` · prontuário ${paciente.prontuario}` : ''}.`
  if (semPulseira) return <Aviso tom="conforme" className={className}>{texto}</Aviso>
  return (
    <Aviso tom="conforme" className={className}
      acao={<BotaoPulseira pacienteId={paciente.paciente_id} nome={paciente.nome} reimpressao motivo="paciente_identificado" />}>
      {texto} Troque a pulseira: imprima a nova e retire a provisória.
    </Aviso>
  )
}
