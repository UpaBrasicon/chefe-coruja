// SAE nas cinco etapas (protótipo: enfP.sae). Texto livre na avaliação e na
// evolução; diagnósticos, resultados e intervenções como lista de código e
// título DIGITADOS da licença NANDA-I/NOC/NIC da unidade — o sistema não
// sugere. Registrar grava uma versão nova (a anterior fica); só o enfermeiro
// edita, o técnico lê.
import { Check, X } from 'lucide-react'
import * as React from 'react'

import { ETAPAS_SAE, fichaSae, itemSaeValido, type EtapaSae, type ItemSae } from '@/clinico/enfermagem/sae'
import { textoFontes } from '@/clinico/ficha'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { quando, useExecutar, useRecarregarCuidados, type Contexto, type Cuidados } from './dadosCuidados'
import { Aviso, Campo, Cartao, Nota } from './pecas'

type Rascunho = { avaliacao: string; evolucao: string; diagnosticos: ItemSae[]; planejamento: ItemSae[]; implementacao: ItemSae[] }
type Lista = 'diagnosticos' | 'planejamento' | 'implementacao'
const VAZIO_ITEM = { codigo: '', titulo: '', detalhe: '' }

const doVigente = (c: Cuidados): Rascunho => ({
  avaliacao: c.sae?.avaliacao ?? '',
  evolucao: c.sae?.evolucao ?? '',
  diagnosticos: c.sae?.diagnosticos ?? [],
  planejamento: c.sae?.planejamento ?? [],
  implementacao: c.sae?.implementacao ?? [],
})

export function AbaSae({ ctx, dados }: { ctx: Contexto; dados: Cuidados }) {
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarCuidados(ctx))
  // o rascunho recomeça quando chega uma versão nova do servidor
  const [base, setBase] = React.useState(dados.sae?.id ?? '')
  const [r, setR] = React.useState<Rascunho>(() => doVigente(dados))
  const [novo, setNovo] = React.useState<Record<Lista, typeof VAZIO_ITEM>>({
    diagnosticos: VAZIO_ITEM, planejamento: VAZIO_ITEM, implementacao: VAZIO_ITEM,
  })
  if ((dados.sae?.id ?? '') !== base) { setBase(dados.sae?.id ?? ''); setR(doVigente(dados)) }

  const pode = dados.pode_sae
  const mudou = JSON.stringify(r) !== JSON.stringify(doVigente(dados))

  function incluir(id: Lista) {
    const item = itemSaeValido(novo[id])
    if (!item) return
    setR((x) => ({ ...x, [id]: [...x[id], item] }))
    setNovo((n) => ({ ...n, [id]: VAZIO_ITEM }))
  }

  async function registrar() {
    await executar(() => supabase.rpc('registrar_sae', {
      p_paciente: ctx.pacienteId, p_avaliacao: r.avaliacao, p_diagnosticos: r.diagnosticos, p_planejamento: r.planejamento,
      p_implementacao: r.implementacao, p_evolucao: r.evolucao,
      p_episodio: dados.episodio_id ?? undefined, p_internacao: dados.internacao_id ?? undefined,
    }), 'SAE registrada. A versão anterior continua no histórico.')
  }

  return (
    <div className="flex flex-col gap-3">
      <Nota>
        Processo de enfermagem em cinco etapas (COFEN 736/2024). Códigos e títulos vêm da licença NANDA-I, NOC e NIC da unidade; o sistema não sugere diagnósticos.
        {!pode && ' Só o enfermeiro de plantão edita.'}
      </Nota>
      {ETAPAS_SAE.map((e) => (
        <Cartao key={e.id} titulo={<span className="flex flex-col gap-0.5">{e.titulo}<span className="text-rotulo font-normal text-tinta-sussurro">{e.sub}</span></span>}>
          {!e.lista && (
            <Textarea aria-label={e.titulo} rows={3} disabled={!pode} value={r[e.id as 'avaliacao' | 'evolucao']}
              onChange={(ev) => { const v = ev.target.value; setR((x) => ({ ...x, [e.id]: v })) }} />
          )}
          {e.lista && (
            <ListaSae id={e.id as Lista} itens={r[e.id as Lista]} pode={pode} rotuloDetalhe={e.rotuloDetalhe ?? 'Detalhe'}
              novo={novo[e.id as Lista]} setNovo={(v) => setNovo((n) => ({ ...n, [e.id]: v }))}
              tirar={(i) => setR((x) => ({ ...x, [e.id]: x[e.id as Lista].filter((_, j) => j !== i) }))}
              incluir={() => incluir(e.id as Lista)} />
          )}
        </Cartao>
      ))}
      <Aviso erro={erro} aviso={aviso} />
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <span className="text-apoio text-tinta-sussurro">
          {dados.sae ? `Versão ${dados.sae.versao} · registrada por ${dados.sae.autor ?? '—'} em ${quando(dados.sae.registrado_em)}` : 'Ainda não registrada'}
        </span>
        {pode && (
          <Button disabled={ocupado || !mudou} onClick={() => void registrar()}><Check /> Registrar SAE</Button>
        )}
      </div>
      <span className="text-rotulo text-pretty text-tinta-sussurro">{textoFontes(fichaSae)}</span>
    </div>
  )
}

function ListaSae({ id, itens, pode, rotuloDetalhe, novo, setNovo, tirar, incluir }: {
  id: EtapaSae; itens: ItemSae[]; pode: boolean; rotuloDetalhe: string
  novo: typeof VAZIO_ITEM; setNovo: (v: typeof VAZIO_ITEM) => void; tirar: (i: number) => void; incluir: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {itens.map((x, i) => (
        <div key={`${x.codigo}-${x.titulo}-${i}`} className="flex items-start gap-2.5 rounded-controle border border-fio bg-campo px-3 py-2">
          <span className="flex-none text-apoio font-semibold text-acao tabular-nums">{x.codigo || '—'}</span>
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
            <span className="text-controle text-tinta">{x.titulo}</span>
            {x.detalhe && <span className="text-apoio text-pretty text-tinta-sussurro">{x.detalhe}</span>}
          </div>
          {pode && (
            <button type="button" aria-label={`Remover ${x.titulo}`} onClick={() => tirar(i)} className="flex text-tinta-sussurro hover:text-critico">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {itens.length === 0 && !pode && <Nota>Nenhum item registrado.</Nota>}
      {pode && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Código" id={`sae-${id}-codigo`} className="flex-[0_1_120px]">
            <Input id={`sae-${id}-codigo`} maxLength={20} value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          </Campo>
          <Campo rotulo="Título (da licença)" id={`sae-${id}-titulo`} className="flex-[1_1_220px]">
            <Input id={`sae-${id}-titulo`} value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          </Campo>
          <Campo rotulo={rotuloDetalhe} id={`sae-${id}-detalhe`} className="flex-[1_1_100%]">
            <Input id={`sae-${id}-detalhe`} value={novo.detalhe} onChange={(e) => setNovo({ ...novo, detalhe: e.target.value })} />
          </Campo>
          <Button variant="outline" size="sm" disabled={!itemSaeValido(novo)} onClick={incluir}>Adicionar</Button>
        </div>
      )}
    </div>
  )
}
