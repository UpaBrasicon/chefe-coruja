// Abas de documento do caderno (Admissão, Prescrição, Exames, AIH, Atestado):
// os mesmos documentos do formulário de internação, já com o paciente do leito
// (fixo). Admissão e AIH no desenho do protótipo, com a identificação do cadastro.
import { ListaExamesLeito } from '@/components/clinico/ExamesEAgravos'
import { AbaExamesLeito } from '@/components/internacao/exames/AbaExamesLeito'
import { FichaAdmissao } from '@/components/internacao/documentos/FichaAdmissao'
import { LaudoAih } from '@/components/internacao/documentos/LaudoAih'
import { SolicitarApac } from '@/components/apac/SolicitarApac'
import { PrescricaoTab } from '@/components/internacao/documentos/PrescricaoTab'
import type { ContextoPacienteFolha } from '@/components/prescricao/PainelPacienteFolha'
import { DIETAS } from '@/lib/rascunho'

import type { useDocumentosLeito } from './rascunhoLeito'

type Doc = ReturnType<typeof useDocumentosLeito>

export function AbaAdmissao({ doc, internacaoId, admissaoEm }: { doc: Doc; internacaoId: string; unidadeId?: string; admissaoEm?: string | null }) {
  return <FichaAdmissao pacienteId={doc.dadosPaciente.paciente_id} internacaoId={internacaoId} leito={doc.dadosPaciente.leito} fixo admissaoEm={admissaoEm} />
}

/**
 * Folha de prescrição do leito (modelo do RT, 24/11/2026, PM1 a PM5). Peso e
 * alergias foram para o cabeçalho da folha (PM2) e a dieta para a linha 01
 * (PM1). A dieta segue o rascunho do leito, como antes: só neste navegador,
 * por 12 horas (não há dieta gravada no banco); sai na folha impressa.
 */
export function AbaPrescricao({ doc, contexto }: { doc: Doc; contexto?: ContextoPacienteFolha }) {
  return (
    <PrescricaoTab dados={doc.dadosPaciente} pacienteId={doc.dadosPaciente.paciente_id} contexto={contexto}
      dieta={{
        valor: doc.dados.dieta, opcoes: DIETAS, mudar: (v) => doc.atualizar({ dieta: v }),
        dica: `Rascunho deste leito${doc.salvoEm ? `, salvo às ${doc.salvoEm}` : ''}: só neste navegador, por 12 horas.`,
      }} />
  )
}

/**
 * Modelo do RT (25/11/2026, EXM1): o médico tem as três vistas (solicitar,
 * anexar, planilha) e o "Imprimir pedido". Enfermagem e gestor continuam com a
 * lista de antes: com resultado, aguardando e cancelados (EX2); os agravos
 * ficaram no Resumo e na Alta (EX3).
 */
export function AbaExames({ internacaoId, pacienteId, medico }: { internacaoId: string; pacienteId: string; medico: boolean }) {
  if (medico) return <AbaExamesLeito internacaoId={internacaoId} pacienteId={pacienteId} />
  return (
    <div className="flex flex-col gap-4">
      <ListaExamesLeito pacienteId={pacienteId} medico={medico} />
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
