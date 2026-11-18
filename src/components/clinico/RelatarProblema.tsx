// LG12, decisão V1 = A (RT, 18/11/2026): "Relatar problema" no topo de cada
// ferramenta (ao lado do título, direção A escolhida pelo RT no mesmo dia), nos avisos automáticos e na página Sobre o módulo clínico. O
// relato vai para a fila de tecnovigilância da Chefe Coruja (RT médico); o
// gestor da unidade vê os da unidade. Autor = quem está no login (o servidor
// grava). O texto não pode ter dado do paciente (CPF, CNS, telefone).
import { Flag } from 'lucide-react'
import * as React from 'react'

import { Campo, Pilulas, Texto } from '@/components/documentos/ui'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import {
  DESFECHO, faltasDoRelato, prazoDoRelato, TIPO_RELATO, type Desfecho, type TipoRelato,
} from '@/lib/tecnovigilancia'

const TIPOS = Object.keys(TIPO_RELATO) as TipoRelato[]
const DESFECHOS = Object.keys(DESFECHO) as Desfecho[]

export function RelatarProblema({ ferramentaId, versao, rotulo = 'Relatar problema', className }: {
  ferramentaId: string
  versao?: string
  rotulo?: string
  className?: string
}) {
  const [aberta, setAberta] = React.useState(false)
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={className} onClick={() => setAberta(true)}>
        <Flag className="size-3.5" aria-hidden /> {rotulo}
      </Button>
      {aberta && <GavetaRelato ferramentaId={ferramentaId} versao={versao} onFechar={() => setAberta(false)} />}
    </>
  )
}

function GavetaRelato({ ferramentaId, versao, onFechar }: { ferramentaId: string; versao?: string; onFechar: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const [tipo, setTipo] = React.useState<TipoRelato | ''>('')
  const [desfecho, setDesfecho] = React.useState<Desfecho | ''>('')
  const [descricao, setDescricao] = React.useState('')
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [feito, setFeito] = React.useState<{ numero: number; prazo: string } | null>(null)
  const faltas = faltasDoRelato({ tipo, desfecho, descricao })

  async function enviar() {
    if (!tipo || faltas.length) return
    setEnviando(true)
    setErro(null)
    const { data, error } = await supabase.rpc('relatar_tecnovigilancia', {
      p_ferramenta: ferramentaId,
      p_versao: versao ?? '',
      p_unidade: unidadeAtiva?.unidade_id ?? (null as unknown as string),
      p_tipo: tipo,
      p_desfecho: tipo === 'paciente' ? desfecho : (null as unknown as string),
      p_descricao: descricao.trim(),
    })
    setEnviando(false)
    if (error) return setErro(error.message)
    const r = data as unknown as { id: string; numero: number; grave: boolean }
    // relato grave: e-mail ao RT (a falha não perde o relato, que já está na fila)
    if (r.grave) void supabase.functions.invoke('avisar-tecnovigilancia', { body: { relato: r.id } }).catch(() => undefined)
    setFeito({ numero: r.numero, prazo: prazoDoRelato(tipo, desfecho) })
  }

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo="Relatar problema no módulo clínico">
      <GavetaCabeca sobre="Tecnovigilância" titulo="Relatar problema"
        detalhe={`Vai para o responsável técnico da Chefe Coruja. Ferramenta ${ferramentaId}${versao ? `, versão ${versao}` : ''}.`} />
      {feito ? (
        <div role="status" className="flex flex-col gap-2 px-[22px] py-5 text-corpo text-tinta">
          <p>Relato nº {feito.numero} recebido. O prazo para a investigação é de {feito.prazo}.</p>
          <p className="text-apoio text-tinta-apoio">Você acompanha o andamento e a conclusão na página Sobre o módulo clínico, em "Meus relatos".</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-[22px] py-5">
          <Campo rotulo="Tipo do problema" largura="cheio">
            <Pilulas opcoes={TIPOS} valor={tipo} onChange={(v) => { setTipo(v); if (v !== 'paciente') setDesfecho('') }}
              rotulos={TIPO_RELATO} rotuloAria="Tipo do problema" />
          </Campo>
          {tipo === 'paciente' && (
            <Campo rotulo="Desfecho no paciente" largura="cheio">
              <Pilulas opcoes={DESFECHOS} valor={desfecho} onChange={setDesfecho} rotulos={DESFECHO} rotuloAria="Desfecho no paciente" />
            </Campo>
          )}
          <Texto id="tv-descricao" rotulo="O que aconteceu" valor={descricao} onChange={setDescricao} longo linhas={5}
            dica="O que a tela mostrou, o que era esperado e com quais dados"
            ajuda="Não escreva nome, CPF, CNS nem telefone do paciente." />
        </div>
      )}
      <GavetaPe className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_160px] text-apoio text-critico">
          {erro ?? (!feito && descricao && faltas.length ? `Falta: ${faltas.join(', ')}.` : '')}
        </span>
        <Button variant="outline" onClick={onFechar}>{feito ? 'Fechar' : 'Cancelar'}</Button>
        {!feito && <Button disabled={enviando || faltas.length > 0} onClick={() => void enviar()}>Enviar relato</Button>}
      </GavetaPe>
    </Gaveta>
  )
}
