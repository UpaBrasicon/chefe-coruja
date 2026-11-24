// Abas de documento do caderno (Admissão, Prescrição, Exames, AIH, Atestado):
// os mesmos documentos do formulário de internação, já com o paciente do leito
// (fixo). Admissão e AIH no desenho do protótipo, com a identificação do cadastro.
import * as React from 'react'

import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { Button } from '@/components/ui/button'
import { GavetaAlergias, SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { negaVigente, useAlergias } from '@/components/paciente/useAlergias'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { PedidoExamesLeito } from '@/components/internacao/documentos/PedidoExamesLeito'
import { FichaAdmissao } from '@/components/internacao/documentos/FichaAdmissao'
import { LaudoAih } from '@/components/internacao/documentos/LaudoAih'
import { SolicitarApac } from '@/components/apac/SolicitarApac'
import { PrescricaoTab } from '@/components/internacao/documentos/PrescricaoTab'
import { CampoPeso } from '@/components/prescricao/PrescricaoEstruturada'
import { textoDoPeso, useFaltaParaPrescrever } from '@/components/prescricao/pesoAtendimento'
import { DIETAS } from '@/lib/rascunho'

import { Secao } from './caixas'
import type { useDocumentosLeito } from './rascunhoLeito'

type Doc = ReturnType<typeof useDocumentosLeito>

/**
 * Peso e dieta: o que as folhas pedem e o cadastro não tem. Ponto 11: o peso
 * agora é gravado (o mesmo que a prescrição exige); antes era rascunho do
 * navegador, e o médico escrevia aqui e a prescrição dizia "falta peso".
 */
function PesoDieta({ doc, nome }: { doc: Doc; nome: string }) {
  const pacienteId = doc.dadosPaciente.paciente_id
  const peso = useFaltaParaPrescrever(pacienteId)
  const alergias = useAlergias(pacienteId)
  const [erro, setErro] = React.useState<string | null>(null)
  const [pesando, setPesando] = React.useState(false)
  const [gaveta, setGaveta] = React.useState(false)
  // PR2 (RT, 24/11/2026): alergias, peso (com a origem e a hora) e dieta numa linha, sempre à vista ao rolar
  const semRegistro = alergias.isSuccess && alergias.data?.estado !== 'tem' && alergias.data?.estado !== 'nega' && !negaVigente(alergias.data)
  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-container border border-fio bg-superficie px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {pacienteId && (
          <span className="flex items-center gap-2">
            <SeloAlergia pacienteId={pacienteId} onClick={() => setGaveta(true)} />
            {semRegistro && <Button size="xs" variant="outline" onClick={() => setGaveta(true)}>Registrar</Button>}
          </span>
        )}
        <span className="flex items-center gap-2 text-apoio text-tinta-apoio">
          {textoDoPeso(peso.data) ?? 'Sem peso deste atendimento.'}
          <Button size="xs" variant="outline" aria-expanded={pesando} onClick={() => setPesando(!pesando)}>{pesando ? 'Fechar' : 'Registrar peso'}</Button>
        </span>
        <label className="ml-auto flex items-center gap-2 text-apoio text-tinta-apoio">
          Dieta
          <CampoSelecao id="leito-dieta" tamanho="compacto" value={doc.dados.dieta} onChange={(e) => doc.atualizar({ dieta: e.target.value })}
            className="bg-superficie" title={`Rascunho deste leito${doc.salvoEm ? `, salvo às ${doc.salvoEm}` : ''}: só neste navegador, por 12 horas.`}>
            {DIETAS.map((d) => <option key={d} value={d}>{d}</option>)}
          </CampoSelecao>
        </label>
      </div>
      {pesando && pacienteId && <CampoPeso id="leito-peso" pacienteId={pacienteId} aoErro={setErro} aoGravar={() => setPesando(false)} />}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      {pacienteId && <GavetaAlergias pacienteId={pacienteId} nome={nome} aberta={gaveta} onAbertaChange={setGaveta} />}
    </div>
  )
}

export function AbaAdmissao({ doc, internacaoId }: { doc: Doc; internacaoId: string; unidadeId?: string }) {
  return <FichaAdmissao pacienteId={doc.dadosPaciente.paciente_id} internacaoId={internacaoId} leito={doc.dadosPaciente.leito} fixo />
}

export function AbaPrescricao({ doc }: { doc: Doc }) {
  return (
    <div className="flex flex-col gap-3">
      <PesoDieta doc={doc} nome={doc.dadosPaciente.nome} />
      <PrescricaoTab dados={doc.dadosPaciente} pacienteId={doc.dadosPaciente.paciente_id} />
    </div>
  )
}

export function AbaExames({ internacaoId, pacienteId, medico }: { internacaoId: string; pacienteId: string; medico: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {/* ponto 12: um pedido por grupo (laboratório, imagem, ECG), ligado à internação */}
      {medico && <PedidoExamesLeito internacaoId={internacaoId} />}
      <div id="caderno-agravos">
        <Secao titulo="Exames pedidos e agravos de notificação">
          <ExamesEAgravos pacienteId={pacienteId} medico={medico} />
        </Secao>
      </div>
    </div>
  )
}

export function AbaAih({ doc, internacaoId }: { doc: Doc; internacaoId?: string }) {
  return <LaudoAih pacienteId={doc.dadosPaciente.paciente_id} internacaoId={internacaoId} leito={doc.dadosPaciente.leito} fixo />
}

/** Fase 3, tarefa 5: APAC em aba própria, ao lado da AIH (pedido do RT); o regulador autoriza em /apac. */
export function AbaApac({ doc, internacaoId }: { doc: Doc; internacaoId?: string }) {
  if (!doc.dadosPaciente.paciente_id) return null
  return <SolicitarApac pacienteId={doc.dadosPaciente.paciente_id} internacaoId={internacaoId} />
}

/** Atestado: os emitidos para o paciente e o emissor da porta, já com ele. */
