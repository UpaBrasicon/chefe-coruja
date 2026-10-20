// ─────────────────────────────────────────────────────────────────────────────
// Recém-nascido vinculado à mãe (Portão 2, tarefa 5; decisões do RT em
// 16/10/2026). Cadastro "RN de <mãe>" (gêmeos: "RN 1 de", "RN 2 de") até 27
// dias de vida, ligado ao cadastro da mãe. Na regulação, o RN sai identificado
// pelo CNS/CPF da mãe. Usado na recepção (a mãe é buscada) e no leito da mãe.
// Toda regra é do servidor (public.cadastrar_rn); aqui só se pede e se mostra.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Baby } from 'lucide-react'
import * as React from 'react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUnidade } from '@/contexts/UnidadeContext'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export type RnCriado = { paciente_id: string; nome: string; prontuario: string | null; data_nascimento: string; nome_mae: string; mae_tem_documento: boolean }
const AVISO_MAE_SEM_DOCUMENTO = 'A mãe está sem CNS e sem CPF válidos: na regulação, o RN sai como não identificado até o documento dela ser completado.'
type Mae = { id: string; nome: string; data_nascimento: string | null; prontuario: string | null }

const hojeSP = () => dataIso()

export function FormRn({ mae: maeFixa, onCriado }: { mae?: Mae; onCriado: (rn: RnCriado) => void }) {
  const { unidadeAtiva } = useUnidade()
  const [termo, setTermo] = React.useState('')
  const [mae, setMae] = React.useState<Mae | null>(maeFixa ?? null)
  const [nasc, setNasc] = React.useState(hojeSP())
  const [sexo, setSexo] = React.useState('')
  const [gemelar, setGemelar] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  const busca = useQuery({
    queryKey: ['rn-busca-mae', unidadeAtiva?.unidade_id, termo.trim()],
    enabled: !maeFixa && !mae && !!unidadeAtiva && termo.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeAtiva!.unidade_id, p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as Mae[]
    },
  })

  async function cadastrar() {
    if (!mae) return
    setErro(null); setEnviando(true)
    const { data, error } = await supabase.rpc('cadastrar_rn', {
      p_mae: mae.id, p_data_nascimento: nasc, p_sexo: sexo || undefined, p_gemelar: gemelar ? Number(gemelar) : undefined,
    })
    setEnviando(false)
    if (error) return setErro(error.message)
    const r = data as unknown as { paciente_id: string; nome: string; prontuario: string | null; mae_tem_documento: boolean }
    onCriado({ paciente_id: r.paciente_id, nome: r.nome, prontuario: r.prontuario, data_nascimento: nasc, nome_mae: mae.nome, mae_tem_documento: r.mae_tem_documento })
  }

  return (
    <div className="flex flex-col gap-3 text-apoio">
      {!maeFixa && (
        mae ? (
          <div className="flex items-center justify-between rounded-controle border border-fio px-3 py-2">
            <span>Mãe: <span className="font-medium text-tinta">{mae.nome}</span>{mae.prontuario ? ` · pront. ${mae.prontuario}` : ''}</span>
            <Button size="xs" variant="ghost" onClick={() => setMae(null)}>Trocar</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Label htmlFor="rn-mae">Mãe (cadastro na unidade)</Label>
            <Input id="rn-mae" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, CPF ou Cartão SUS da mãe" />
            <div className="max-h-40 overflow-y-auto">
              {(busca.data ?? []).map((m) => (
                <BotaoLinha key={m.id} variante="linha" onClick={() => setMae(m)} className="gap-2 border-fio px-2 py-1 text-rotulo">
                  <span className="font-medium">{m.nome}</span>
                  <span className="text-tinta-apoio">{m.prontuario ? `pront. ${m.prontuario}` : ''}</span>
                </BotaoLinha>
              ))}
              {busca.data?.length === 0 && <p className="px-2 py-1 text-rotulo text-tinta-sussurro">Nenhum cadastro com esse nome. Cadastre a mãe primeiro.</p>}
            </div>
          </div>
        )
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="rn-nasc">Nascimento *</Label>
          <Input id="rn-nasc" type="date" max={hojeSP()} value={nasc} onChange={(e) => setNasc(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rn-sexo">Sexo</Label>
          <CampoSelecao id="rn-sexo" tamanho="compacto" value={sexo} onChange={(e) => setSexo(e.target.value)}>
            <option value="">Não informado</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </CampoSelecao>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rn-gemelar">Gêmeo: ordem</Label>
          <CampoSelecao id="rn-gemelar" tamanho="compacto" value={gemelar} onChange={(e) => setGemelar(e.target.value)}>
            <option value="">Parto único</option>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>RN {n}</option>)}
          </CampoSelecao>
        </div>
      </div>
      <p className="text-rotulo text-tinta-sussurro">
        Fica como “RN {gemelar ? `${gemelar} ` : ''}de {mae?.nome ?? '<mãe>'}”, ligado ao cadastro da mãe (até 27 dias de vida).
        Quando tiver nome e Cartão SUS, edite o cadastro normal: o vínculo com a mãe continua.
      </p>
      {erro && <p role="alert" className="text-critico">{erro}</p>}
      <Button className="self-start" disabled={!mae || !nasc || enviando} onClick={() => void cadastrar()}><Baby /> Cadastrar recém-nascido</Button>
    </div>
  )
}

/** Leito da mãe: abre o cadastro do recém-nascido já ligado a ela. */
export function BotaoRnDaMae({ maeId, maeNome }: { maeId: string; maeNome: string }) {
  const [aberto, setAberto] = React.useState(false)
  const [feito, setFeito] = React.useState<RnCriado | null>(null)
  const sexo = useQuery({
    queryKey: ['rn-sexo-mae', maeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('sexo, prontuario, data_nascimento').eq('id', maeId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  if (!sexo.data || sexo.data.sexo === 'M') return null
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => { setFeito(null); setAberto(true) }}><Baby /> Recém-nascido</Button>
      {feito && <span role="status" className="text-rotulo text-conforme">{feito.nome} cadastrado (pront. {feito.prontuario ?? '—'}).</span>}
      {feito && !feito.mae_tem_documento && <span className="text-rotulo text-atencao">{AVISO_MAE_SEM_DOCUMENTO}</span>}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">Cadastrar recém-nascido</DialogTitle>
            <DialogDescription className="text-controle">Filho(a) de {maeNome}. O cadastro fica ligado ao da mãe.</DialogDescription>
          </DialogHeader>
          <FormRn mae={{ id: maeId, nome: maeNome, prontuario: sexo.data.prontuario, data_nascimento: sexo.data.data_nascimento }}
            onCriado={(rn) => { setFeito(rn); setAberto(false) }} />
        </DialogContent>
      </Dialog>
    </>
  )
}
