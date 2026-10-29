// Aba "Atestado e receita" (protótipo): atestado de afastamento ou de
// comparecimento (CID só a pedido do paciente) e a receita de alta. A receita
// padrão usa as PREFERÊNCIAS DE PRESCRIÇÃO do médico (tela Preferências de
// prescrição): aplicar um conjunto e "salvar como padrão". Emitir grava o
// documento no episódio com número próprio (mesma folha das telas avulsas).
// Dose e posologia são escritas pelo médico: nada é sugerido.
// Receita padrão e favoritos têm dose de adulto: só para adulto PELA IDADE.
// Criança e paciente sem data de nascimento (decisão do RT, 02/10/2026) não
// os recebem — mesma regra do Receituário médico (TEXTO_PEDIATRICO).
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type FaixaEtaria } from '@/domain/idade'
// o atestado e a receita são peças comuns com o leito (pontos 14 e 16)
import { CartaoAtestado, ReceitaAlta } from '@/components/documentos/AtestadoReceita'
import { useEmissaoAtestadoReceita } from '@/components/documentos/emissaoAtestadoReceita'

import { hora, type EstadoDocs } from './comum'

type Documento = { id: string; numero: string | null; tipo_documento: string; created_at: string; emitido_em: string | null; estado: string; sem_conexao: boolean; versao: number }

const NOME_DOC: Record<string, string> = {
  atestado: 'Atestado', receita: 'Receita', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames',
  boletim_emergencia: 'Boletim de emergência', laudo_aih: 'Laudo de AIH', sumario_alta: 'Sumário de alta', termo_consentimento: 'Termo de consentimento',
}
export function AbaAtestadoReceita({ episodioId, pacienteId, nome, nascimento, faixa, cid, estado, setEstado }: {
  episodioId: string; pacienteId: string; nome: string; nascimento: string | null
  /** faixa pela IDADE (JanelaAtendimento), nunca pela porta */
  faixa: FaixaEtaria
  /** CID-10 do atendimento (SOAP registrado ou em rascunho), para o atestado a pedido. */
  cid: string
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void
}) {
  const docs = useQuery({
    queryKey: ['documentos-episodio', episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_clinicos')
        .select('id, numero, tipo_documento, created_at, emitido_em, estado, sem_conexao, versao').eq('episodio_id', episodioId).order('created_at')
      if (error) throw error
      return (data ?? []) as Documento[]
    },
  })
  // emissão comum com o leito (pontos 14 e 16): mesma folha, mesmo caminho
  const { erro, emitirAtestado, emitirReceita } = useEmissaoAtestadoReceita({
    pacienteId, nome, nascimento, ondePreencherCid: 'preencha o CID-10 na aba Atendimento', estado, setEstado, aoEmitir: () => void docs.refetch(),
  })

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{erro}</p>}

      <CartaoAtestado estado={estado} setEstado={setEstado} cid={cid} onEmitir={() => void emitirAtestado(cid)} />

      <ReceitaAlta faixa={faixa} estado={estado} setEstado={setEstado} onEmitir={() => void emitirReceita()} />

      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
          <FileText className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-semibold text-tinta">Documentos do episódio</span>
          <span className="text-apoio text-tinta-sussurro">Cada emissão é gravada no episódio com número próprio. Sem conexão, sai a folha provisória.</span>
        </div>
        {(docs.data ?? []).length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Nenhum documento emitido neste episódio.</p>}
        {(docs.data ?? []).map((d) => (
          <div key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-trilha px-4 py-2 text-apoio last:border-0">
            <span className="text-tinta">
              {NOME_DOC[d.tipo_documento] ?? d.tipo_documento.replace(/_/g, ' ')}
              {d.versao > 1 && ` (versão ${d.versao})`}
              {d.estado === 'retificado' && <span className="text-tinta-sussurro"> · retificado</span>}
              {d.estado === 'rascunho' && <span className="text-atencao"> · rascunho</span>}
              {d.sem_conexao && <Badge variant="outline" className="ml-2">sem conexão</Badge>}
            </span>
            <span className="text-rotulo tabular-nums text-tinta-sussurro">nº {d.numero ?? '—'} · {hora(d.emitido_em ?? d.created_at)}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-trilha px-4 py-3">
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/encaminhamento?paciente=${pacienteId}`} />}>Encaminhamento (folha)</Button>
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/receituario-medico?paciente=${pacienteId}`} />}>Receituário completo</Button>
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/atestado-medico?paciente=${pacienteId}`} />}>Atestado completo</Button>
        </div>
      </section>
    </div>
  )
}

