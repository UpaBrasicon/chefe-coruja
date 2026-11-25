// ─────────────────────────────────────────────────────────────────────────────
// Cabeçalho da folha de prescrição do leito (PM2, modelo do RT de 24/11/2026).
//
// Linha 1: "Prescrição médica", a validade de 24 h (Res. Cofen 689/2022, art.
// 4º: a enfermagem não executa prescrição fora da validade; as 24 h são regra
// da casa) e, à direita, quantos itens vigentes e a última mudança.
// Linha 2: Peso (valor · como foi obtido · quando; clique registra outro) e
// Alergias (três tons; clique marca "nega" ou inclui alergia). A trava da
// alergia continua a do banco (useTravas e public.prescrever), não o texto.
// ─────────────────────────────────────────────────────────────────────────────
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { AlertTriangle, Printer, Scale, ShieldCheck, ShieldQuestion } from 'lucide-react'
import * as React from 'react'

import { dataHora } from '@/lib/formato'
import { seloAlergiaFolha, teclasDoAtalho, textoItensVigentes } from '@/lib/folhaPrescricao'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SeloAcao } from '@/components/ui/selo-acao'
import { AlergiaRapida } from '@/components/paciente/AlergiaRapida'
import { GavetaAlergias } from '@/components/paciente/AlergiasEventos'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { CampoPeso } from '@/components/prescricao/CampoPeso'
import { rotuloMetodoPeso, useFaltaParaPrescrever } from '@/components/prescricao/pesoAtendimento'

const POPUP = 'w-[min(22rem,calc(100vw-2rem))] rounded-container border border-fio bg-superficie p-3 text-tinta shadow-lg'

/** Mac usa ⌘ no atalho. */
const ehMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export function CabecalhoFolha({ pacienteId, nome, nVigentes, ultima, aoImprimir, podeImprimir }: {
  pacienteId: string; nome: string; nVigentes: number; ultima: string | null
  aoImprimir: () => void; podeImprimir: boolean
}) {
  const [teclaMod, teclaEnter] = teclasDoAtalho(ehMac())
  return (
    <header className="flex flex-col">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-fio px-4 py-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <span className="text-secao font-semibold text-tinta">Prescrição médica</span>
          <span className="text-rotulo text-pretty text-tinta-apoio">
            Validade 24 h · a enfermagem não executa prescrição fora da validade (Res. Cofen 689/2022, art. 4º)
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-apoio font-medium text-tinta tabular-nums">{textoItensVigentes(nVigentes)}</span>
            {ultima && <span className="text-rotulo text-tinta-sussurro tabular-nums">Atualizada em {dataHora(ultima)}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={aoImprimir} disabled={!podeImprimir}><Printer aria-hidden /> Imprimir</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-fio bg-campo px-4 py-2">
        <Peso pacienteId={pacienteId} />
        <Alergias pacienteId={pacienteId} nome={nome} />
        <span className="ml-auto hidden items-center gap-1 text-rotulo text-tinta-sussurro pointer-fine:inline-flex" aria-hidden>
          <Tecla>{teclaMod}</Tecla><Tecla>{teclaEnter}</Tecla> prescreve
        </span>
      </div>
    </header>
  )
}

function Tecla({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-controle border border-fio-forte bg-superficie px-1.5 py-px font-sans text-rotulo font-medium text-tinta-apoio">{children}</kbd>
}

/** Rótulo e valor da barra do cabeçalho. */
function Chave({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="text-rotulo text-tinta-sussurro">{rotulo}</span>
      {children}
    </span>
  )
}

function Peso({ pacienteId }: { pacienteId: string }) {
  const f = useFaltaParaPrescrever(pacienteId)
  const [aberto, setAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const p = f.data?.peso
  const antigo = f.data?.peso_anterior
  // valor · como foi obtido · quando (o peso como foi registrado, sem conta)
  const texto = p ? `${p.valor} kg · ${rotuloMetodoPeso(p.metodo) ?? 'aferido'} · ${dataHora(p.em)}`
    : antigo ? `${antigo.valor} kg · de outro atendimento · ${dataHora(antigo.em)}`
      : f.isLoading ? 'Carregando…' : 'Sem peso deste atendimento'
  return (
    <Chave rotulo="Peso">
      <PopoverPrimitive.Root open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setErro(null) }}>
        <PopoverPrimitive.Trigger render={
          <SeloAcao tom={p ? 'neutro' : 'atencao'} className="tabular-nums" title="Registrar o peso deste atendimento">
            <Scale className="size-3.5 shrink-0" aria-hidden /> {texto}
          </SeloAcao>
        } />
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
            <PopoverPrimitive.Popup className={POPUP}>
              <div className="flex flex-col gap-2 text-apoio">
                <span className="font-medium text-tinta">Peso deste atendimento</span>
                {antigo && !p && <span className="text-rotulo text-atencao">O último é de outro atendimento: registre o de hoje.</span>}
                <CampoPeso id="folha-peso" pacienteId={pacienteId} aoErro={setErro} aoGravar={() => setAberto(false)} />
                {erro && <p role="alert" className="text-critico">{erro}</p>}
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </Chave>
  )
}

function Alergias({ pacienteId, nome }: { pacienteId: string; nome: string }) {
  const q = useAlergias(pacienteId)
  const [aberto, setAberto] = React.useState(false)
  const [gaveta, setGaveta] = React.useState(false)
  // sem leitura não se afirma nada: "Não verificada"
  const s = seloAlergiaFolha(q.isSuccess ? q.data?.estado : undefined, ativas(q.data).map((a) => a.substancia))
  const Icone = s.tom === 'critico' ? AlertTriangle : s.tom === 'seguro' ? ShieldCheck : ShieldQuestion
  return (
    <Chave rotulo="Alergias">
      <PopoverPrimitive.Root open={aberto} onOpenChange={setAberto}>
        <PopoverPrimitive.Trigger render={
          <SeloAcao tom={s.tom === 'critico' ? 'critico' : s.tom === 'seguro' ? 'neutro' : 'atencao'}
            className={cn(s.tom === 'seguro' && 'border-conforme/40 bg-alerta-conforme text-conforme hover:bg-alerta-conforme')}
            title="Alergias: marcar que nega ou incluir alergia">
            <Icone className="size-3.5 shrink-0" aria-hidden /> {s.texto}
          </SeloAcao>
        } />
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
            <PopoverPrimitive.Popup className={POPUP}>
              <AlergiaRapida pacienteId={pacienteId} aoAbrirPainel={() => { setAberto(false); setGaveta(true) }} />
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <GavetaAlergias pacienteId={pacienteId} nome={nome} aberta={gaveta} onAbertaChange={setGaveta} />
    </Chave>
  )
}
