// "Enviar à UPA" (5A, tarefa 5; H1 e H5 do RT): da consulta ou da escuta
// inicial da UBS, o médico ou o enfermeiro escolhe a UPA (ou o hospital) da rede
// e escreve o motivo. O servidor (encaminhar_upa) tira o resumo da consulta,
// avisa a UPA e começa o prazo de 12 horas para a chegada.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ambulance } from 'lucide-react'
import * as React from 'react'

import { OpcaoLista } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { argsDoProblema, destinosDoEnvio, rotuloDoProblema, type ProblemaDoEnvio, type UnidadeRede } from '@/domain/encaminhamento'
import { useTerminologia } from '@/hooks/useTerminologia'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function EnviarUpa({ aberto, onFechar, episodioId, unidadeId, nome, motivoInicial = '', daEscuta = false, onEnviado }: {
  aberto: boolean; onFechar: () => void; episodioId: string; unidadeId: string; nome: string
  motivoInicial?: string
  /** envio feito da escuta, antes do atendimento (RT, 25/11/2026): pede o CID-10 ou a CIAP-2,
   *  porque a ficha da UBS fecha aqui como encaminhamento e vai ao SISAB */
  daEscuta?: boolean
  onEnviado: (aviso: string) => void
}) {
  const qc = useQueryClient()
  const [destino, setDestino] = React.useState('')
  const [motivo, setMotivo] = React.useState(motivoInicial)
  const [problema, setProblema] = React.useState<ProblemaDoEnvio | null>(null)
  // as unidades da rede (a mesma lista do destino da regulação); o servidor só
  // aceita UPA ou hospital, então a lista mostra só esses (migration
  // 20270221000001 pôs o tipo em cada unidade)
  const rede = useQuery({
    queryKey: ['regulacao-contexto', unidadeId],
    enabled: aberto && !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as { unidades_rede: UnidadeRede[] }
    },
  })
  const opcoes = destinosDoEnvio(rede.data?.unidades_rede ?? [], unidadeId)
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('encaminhar_upa', { p_episodio: episodioId, p_destino: destino, p_motivo: motivo.trim(), ...argsDoProblema(daEscuta ? problema : null) })
      if (error) throw error
    },
    onSuccess: () => {
      const u = opcoes.find((o) => o.id === destino)?.nome ?? 'UPA'
      void qc.invalidateQueries({ queryKey: ['encaminhamentos-upa'] })
      onEnviado(`${nome}: enviado à ${u}. A UPA foi avisada; acompanhe em Encaminhados.`)
    },
  })
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar à UPA: {nome}</DialogTitle>
          <DialogDescription>
            A UPA recebe o aviso com o resumo da consulta (queixa, último SOAP, sinais). Se a chegada não for registrada em 12 horas, você é avisado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-destino">UPA ou hospital da rede</Label>
          <CampoSelecao id="envio-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Escolha…</option>
            {opcoes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </CampoSelecao>
          {rede.error && <span className="text-rotulo text-critico">{msg(rede.error)}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-motivo">Motivo do envio</Label>
          <Textarea id="envio-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras. Fora da rede, use a folha de encaminhamento (aba Encaminhar).</span>
        </div>
        {daEscuta && <CampoProblemaDoEnvio valor={problema} onChange={setProblema} />}
        {enviar.error && <p role="alert" className="text-apoio text-critico">{msg(enviar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={!destino || motivo.trim().length < 10 || (daEscuta && !problema) || enviar.isPending} onClick={() => enviar.mutate()}>
            <Ambulance /> Enviar à UPA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * CID-10 ou CIAP-2 do envio feito da escuta: a mesma busca de terminologia do
 * campo "Problema/condição avaliada" da aba Conduta (useTerminologia), aqui
 * com um item só.
 */
function CampoProblemaDoEnvio({ valor, onChange }: { valor: ProblemaDoEnvio | null; onChange: (p: ProblemaDoEnvio | null) => void }) {
  const [termo, setTermo] = React.useState('')
  const [foco, setFoco] = React.useState(false)
  const ciap = useTerminologia('ciap2', foco ? termo : '', 6)
  const cid = useTerminologia('cid10', foco ? termo : '', 6)
  const opcoes: ProblemaDoEnvio[] = termo.trim().length < 2 ? [] : [
    ...(ciap.data ?? []).map((r) => ({ ciap: r.codigo.toUpperCase(), descricao: r.descricao })),
    ...(cid.data ?? []).map((r) => ({ cid: r.codigo.toUpperCase(), descricao: r.descricao })),
  ]
  const escolher = (p: ProblemaDoEnvio) => { onChange(p); setTermo('') }
  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor="envio-problema">Problema (CID-10 ou CIAP-2)</Label>
      {valor ? (
        <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-2 text-controle text-tinta">
          <span className="min-w-0 flex-1 truncate">{rotuloDoProblema(valor)}</span>
          <Button size="xs" variant="ghost" onClick={() => onChange(null)}>Trocar</Button>
        </div>
      ) : (
        <Input id="envio-problema" role="combobox" aria-expanded={foco && opcoes.length > 0} aria-controls="envio-problema-opcoes" aria-autocomplete="list"
          value={termo} autoComplete="off" spellCheck={false} placeholder="Digite a CIAP-2 ou a CID-10"
          onFocus={() => setFoco(true)} onBlur={() => window.setTimeout(() => setFoco(false), 150)}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && opcoes[0]) { e.preventDefault(); escolher(opcoes[0]) } }} />
      )}
      {!valor && foco && opcoes.length > 0 && (
        <div id="envio-problema-opcoes" role="listbox" className="absolute top-full left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
          {opcoes.map((p) => (
            <OpcaoLista key={'ciap' in p ? `a:${p.ciap}` : `c:${p.cid}`} onClick={() => escolher(p)} className="items-baseline">
              <span className="text-tinta"><strong className="tabular-nums">{'ciap' in p ? p.ciap : p.cid}</strong> · {p.descricao}</span>
              <span className="text-rotulo text-tinta-sussurro">{'ciap' in p ? 'CIAP-2' : 'CID-10'}</span>
            </OpcaoLista>
          ))}
        </div>
      )}
      <span className="text-rotulo text-tinta-sussurro">Obrigatório no envio pela escuta: a ficha da UBS fecha aqui como encaminhamento e vai ao SISAB com este problema.</span>
    </div>
  )
}
