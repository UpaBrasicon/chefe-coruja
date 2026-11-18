import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { JanelaFerramenta, type FerramentaNaJanela } from '@/components/clinico/JanelaFerramenta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { categoriaCid } from '@/clinico/cidFerramentas'
import { AVISO_SEPSE_ATENDIMENTO, sepseAdulto } from '@/clinico/escores/sepseAdulto'
import { RelatarProblema } from '@/components/clinico/RelatarProblema'
import { ROTA_DA_FICHA } from '@/clinico/indice'
import type { FaixaEtaria } from '@/domain/idade'
import { supabase } from '@/lib/supabase'

// F7 das ferramentas pelo CID (pedido do RT de 17/11/2026; AV1–AV8 = A e as
// condições da sessão de obrigatórios legais). O servidor decide pela mesma
// regra do alerta de sepse da internação (private.sepse_adulto_regra): 14 anos
// ou mais, gatilho de infecção (CID da lista ou suspeita marcada) e NEWS2 de 5
// ou mais, com os vitais das últimas 6 h do episódio. A tela só manda os CIDs
// do rascunho e dos problemas, e mostra o texto da ficha sepse-adulto.
// Exceção à regra "nada sugere conduta" liberada pelo RT só para este aviso:
// sem cor, sem a palavra "diagnóstico", sem exame marcado ou pedido sozinho.

type Aviso = {
  nivel: 'news2_rastreio' | 'news2_alto'
  total: number
  parcial: boolean
  faltando: string[] | null
  gatilho: { motivo: string; cid?: string; descricao: string }
  dispensado: boolean
}

export function AvisoSepseAtendimento({ episodioId, pacienteId, nascimento, faixa, cids }: {
  episodioId: string
  pacienteId: string
  nascimento: string | null
  faixa: FaixaEtaria
  /** CIDs do atendimento (rascunho do SOAP, último registrado, problemas da Conduta) */
  cids: (string | null | undefined)[]
}) {
  const qc = useQueryClient()
  const codigos = [...new Set(cids.map((c) => (c ? c.trim().toUpperCase().split(/\s|—/)[0] : '')).filter((c) => categoriaCid(c)))].sort()
  const adulto = faixa === 'adulto'
  const chave = ['aviso-sepse', episodioId, codigos.join(',')]
  const aviso = useQuery({
    queryKey: chave,
    enabled: adulto,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('aviso_sepse_atendimento', { p_episodio: episodioId, p_cids: codigos })
      if (error) throw error
      return (data ?? null) as Aviso | null
    },
  })
  const registrar = useMutation({
    mutationFn: async ({ evento, motivo }: { evento: 'exibido' | 'dispensado'; motivo?: string }) => {
      const { error } = await supabase.rpc('registrar_aviso_sepse', {
        p_episodio: episodioId, p_evento: evento, p_cids: codigos, p_motivo: motivo || undefined,
      })
      if (error) throw error
    },
    onSuccess: (_d, v) => { if (v.evento === 'dispensado') void qc.invalidateQueries({ queryKey: ['aviso-sepse', episodioId] }) },
  })
  const [dispensando, setDispensando] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [janela, setJanela] = React.useState<FerramentaNaJanela | null>(null)

  // "exibido" uma vez por nível nesta tela; o servidor também só grava uma vez por episódio e nível
  const exibidos = React.useRef(new Set<string>())
  const a = aviso.data
  const mostrar = adulto && a && !a.dispensado
  React.useEffect(() => {
    if (!mostrar || exibidos.current.has(a.nivel)) return
    exibidos.current.add(a.nivel)
    registrar.mutate({ evento: 'exibido' })
  }, [mostrar, a?.nivel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mostrar) return null
  const rotaSepse = ROTA_DA_FICHA['sepse-adulto']
  return (
    <div role="note" aria-label="Aviso: pode ser sepse" className="flex flex-col gap-2 rounded-cartao border border-fio-forte border-l-4 border-l-tinta bg-superficie px-3 py-3 text-apoio text-tinta">
      <p className="text-controle font-semibold [text-wrap:pretty]">{AVISO_SEPSE_ATENDIMENTO}</p>
      <p className="text-apoio text-tinta-apoio">
        NEWS2 {a.total}{a.parcial ? ` (parcial: falta ${(a.faltando ?? []).join(', ').toLowerCase() || 'parte dos sinais'})` : ''} · {a.gatilho.descricao} · vitais das últimas 6 h deste atendimento.
      </p>
      {dispensando ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Motivo para dispensar o aviso (opcional)" placeholder="Motivo (opcional)" value={motivo} maxLength={300}
            onChange={(e) => setMotivo(e.target.value)} className="h-8 max-w-sm flex-1" />
          <Button type="button" size="xs" variant="outline" disabled={registrar.isPending}
            onClick={() => registrar.mutate({ evento: 'dispensado', motivo: motivo.trim() })}>Confirmar</Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setDispensando(false)}>Voltar</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {rotaSepse && (
            <Button type="button" size="sm" onClick={() => setJanela({ rota: rotaSepse, rotulo: 'Sepse no adulto' })}>
              Abrir sepse (adulto)
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="border-fio-forte text-tinta" onClick={() => setDispensando(true)}>Dispensar</Button>
          <RelatarProblema ferramentaId={sepseAdulto.ficha.id} versao={sepseAdulto.ficha.versao} />
        </div>
      )}
      {registrar.isError && <p role="alert" className="text-rotulo text-critico">Não foi possível registrar. Tente de novo.</p>}
      <JanelaFerramenta key={janela?.rota ?? ''} ferramenta={janela} pacienteId={pacienteId} nascimento={nascimento} faixa={faixa}
        aoFechar={() => setJanela(null)} />
    </div>
  )
}
