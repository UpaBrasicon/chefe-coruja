// Receita na consulta de enfermagem da UBS (U6, PR 3b; R1–R5 = A do RT,
// docs/ubs/U6-PRESCRICAO-ENFERMEIRO.md). O enfermeiro escolhe itens dos
// protocolos de enfermagem do município publicados pelo gestor e emite como
// estão (R2): sem texto livre, sem atestado (R4). O banco confere cada item e
// recusa controle especial (R3, Portaria 344/1998; migration 20270415000013).
// A receita leva o protocolo usado e o ano de publicação (Resolução Cofen
// 801/2026, art. 3º, I). Criança e paciente sem data de nascimento ficam com o
// médico: o protocolo não separa dose por idade (regra clínica do projeto).
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { textoProtocoloEnfermagem, type ProtocoloEnfermagem } from '@/domain/receitaEnfermagem'
import { type FaixaEtaria } from '@/domain/idade'
import { DOCS_INICIAL, type EstadoDocs } from '@/lib/documentosAlta'
import { supabase } from '@/lib/supabase'
import { useEmissaoAtestadoReceita } from './emissaoAtestadoReceita'

export function ReceitaEnfermagem({ pacienteId, nome, nascimento, faixa }: {
  pacienteId: string; nome: string; nascimento: string | null; faixa: FaixaEtaria
}) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [estado, setEstado] = React.useState<EstadoDocs>(DOCS_INICIAL)
  const [usados, setUsados] = React.useState<string[]>([])
  const protocolos = useQuery({
    queryKey: ['receita-protocolos', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('receita_protocolos_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return ((data ?? []) as unknown as ProtocoloEnfermagem[]).filter((p) => p.ativo && p.enfermagem)
    },
  })
  const { erro, emitirReceita } = useEmissaoAtestadoReceita({
    pacienteId, nome, nascimento, ondePreencherCid: 'preencha o CID-10 na aba Atendimento', estado, setEstado,
  })
  const lista = protocolos.data ?? []
  const escolhido = (pid: string, i: number) => estado.receita.some((x) => x.id === `${pid}:${i}`)
  const alternar = (p: ProtocoloEnfermagem, i: number) => {
    const id = `${p.id}:${i}`
    const it = p.itens[i]
    setEstado((s) => ({
      ...s,
      receita: s.receita.some((x) => x.id === id) ? s.receita.filter((x) => x.id !== id)
        : [...s.receita, { id, medicamento_id: null, medicamento: it.medicamento, posologia: it.posologia, quantidade: it.quantidade ?? '' }],
    }))
    setUsados((u) => (u.includes(p.id) ? u : [...u, p.id]))
  }
  const protocolosDaReceita = lista.filter((p) => usados.includes(p.id) && estado.receita.some((x) => x.id.startsWith(`${p.id}:`)))

  if (faixa !== 'adulto') {
    return (
      <p className="rounded-cartao border border-fio bg-superficie px-4 py-3 text-apoio text-tinta-apoio">
        {faixa === 'pediatrico' ? 'Criança' : 'Paciente sem data de nascimento'}: a receita é do médico. Os protocolos de enfermagem do app não separam a dose por idade.
      </p>
    )
  }
  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Receita pelo protocolo de enfermagem</span>
        <span className="text-apoio text-tinta-sussurro">Itens do protocolo do município, como estão. Controlado é só do médico.</span>
      </div>
      {protocolos.error && <p className="text-apoio text-critico">{(protocolos.error as Error).message}</p>}
      {protocolos.isSuccess && lista.length === 0 && (
        <p className="text-apoio text-tinta-sussurro">A unidade não tem protocolo de enfermagem publicado. O gestor marca o protocolo em Protocolos, com o documento de origem.</p>
      )}
      {lista.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-tinta">{p.nome}<span className="font-normal text-tinta-sussurro"> · {textoProtocoloEnfermagem(p)}</span></span>
          <div role="group" aria-label={`Itens do protocolo ${p.nome}`} className="flex flex-wrap gap-1.5">
            {p.itens.map((it, i) => (
              <Chip key={i} ativo={escolhido(p.id, i)} onClick={() => alternar(p, i)}
                titulo={`${it.medicamento} — ${it.posologia}${it.quantidade ? ` — ${it.quantidade}` : ''}`}>
                {it.medicamento}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      {estado.receita.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-trilha pt-2">
          {estado.receita.map((x) => (
            <li key={x.id} className="text-apoio text-tinta">{x.medicamento}<span className="text-tinta-apoio"> · {x.posologia}{x.quantidade ? ` · ${x.quantidade}` : ''}</span></li>
          ))}
        </ul>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      {estado.rxEmitidaEm && <p role="status" className="text-apoio text-conforme">Receita emitida e gravada no episódio.</p>}
      <div>
        <Button size="sm" disabled={estado.receita.length === 0}
          onClick={() => void emitirReceita(protocolosDaReceita.map(textoProtocoloEnfermagem).join('; ')
            + ' (Lei 7.498/1986, art. 11, II, c; Resolução Cofen 801/2026).')}>
          Emitir receita
        </Button>
      </div>
    </section>
  )
}
