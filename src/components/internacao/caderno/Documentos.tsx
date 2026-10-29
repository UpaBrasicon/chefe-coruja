// Abas de documento do caderno (Admissão, Prescrição, Exames, AIH, Atestado):
// os mesmos documentos do formulário de internação, já com o paciente do leito
// (fixo). Admissão e AIH no desenho do protótipo, com a identificação do cadastro.
import * as React from 'react'

import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { Label } from '@/components/ui/label'
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
function PesoDieta({ doc }: { doc: Doc }) {
  const pacienteId = doc.dadosPaciente.paciente_id
  const peso = useFaltaParaPrescrever(pacienteId)
  const [erro, setErro] = React.useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2 rounded-container border border-fio bg-campo px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        {pacienteId && <CampoPeso id="leito-peso" pacienteId={pacienteId} aoErro={setErro} aoGravar={() => undefined} />}
        <div className="flex min-w-48 flex-col gap-1">
          <Label htmlFor="leito-dieta">Dieta</Label>
          <CampoSelecao id="leito-dieta" value={doc.dados.dieta} onChange={(e) => doc.atualizar({ dieta: e.target.value })}
            className="bg-superficie text-controle">
            {DIETAS.map((d) => <option key={d} value={d}>{d}</option>)}
          </CampoSelecao>
        </div>
      </div>
      <span className="text-apoio text-tinta-apoio">{textoDoPeso(peso.data) ?? 'Sem peso registrado neste atendimento.'}</span>
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      <span className="text-rotulo text-tinta-sussurro">
        Dieta: {doc.salvoEm ? `rascunho deste leito salvo às ${doc.salvoEm}` : 'rascunho deste leito'} · só neste navegador, por 12 horas.
      </span>
    </div>
  )
}

export function AbaAdmissao({ doc, internacaoId }: { doc: Doc; internacaoId: string; unidadeId?: string }) {
  return <FichaAdmissao pacienteId={doc.dadosPaciente.paciente_id} internacaoId={internacaoId} leito={doc.dadosPaciente.leito} fixo />
}

export function AbaPrescricao({ doc }: { doc: Doc }) {
  return (
    <div className="flex flex-col gap-3">
      <PesoDieta doc={doc} />
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
