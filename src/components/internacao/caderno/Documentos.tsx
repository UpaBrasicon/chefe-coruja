// Abas de documento do caderno (Admissão, Prescrição, Exames, AIH, Atestado):
// as mesmas abas do formulário de internação, já com o paciente do leito.
import { ExternalLink, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useDocumentos } from '@/hooks/useDocumentos'
import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { EvolucaoTab } from '@/pages/plantao/internacao/EvolucaoTab'
import { ExamesTab } from '@/pages/plantao/internacao/ExamesTab'
import { InternacaoTab } from '@/pages/plantao/internacao/InternacaoTab'
import { PrescricaoTab } from '@/pages/plantao/internacao/PrescricaoTab'
import { DIETAS } from '@/pages/plantao/shared/rascunho'
import type { Evolucao } from '@/pages/plantao/internacao/rascunho'

import { Secao } from './caixas'
import { diaHora } from './comum'
import type { useDocumentosLeito } from './rascunhoLeito'

type Doc = ReturnType<typeof useDocumentosLeito>

/** Peso e dieta: o que as folhas pedem e o cadastro não tem. */
function PesoDieta({ doc }: { doc: Doc }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-fio bg-campo px-4 py-3">
      <div className="flex w-28 flex-col gap-1">
        <Label htmlFor="leito-peso">Peso (kg)</Label>
        <Input id="leito-peso" inputMode="decimal" value={doc.dados.peso} onChange={(e) => doc.atualizar({ peso: e.target.value })} />
      </div>
      <div className="flex min-w-48 flex-col gap-1">
        <Label htmlFor="leito-dieta">Dieta</Label>
        <select id="leito-dieta" value={doc.dados.dieta} onChange={(e) => doc.atualizar({ dieta: e.target.value })}
          className="h-9 rounded-md border border-fio bg-superficie px-2 text-controle text-tinta">
          {DIETAS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <span className="text-apoio text-tinta-sussurro">
        {doc.salvoEm ? `Rascunho deste leito salvo às ${doc.salvoEm}` : 'Rascunho deste leito'} · só neste navegador, por 12 horas.
      </span>
    </div>
  )
}

export function AbaAdmissao({ doc, internacaoId, unidadeId }: { doc: Doc; internacaoId: string; unidadeId?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <PesoDieta doc={doc} />
      <EvolucaoTab
        dados={doc.dadosPaciente}
        evolucao={doc.dados.evolucao}
        onChange={(p: Partial<Evolucao>) => doc.atualizar({ evolucao: { ...doc.dados.evolucao, ...p } })}
        pacienteId={doc.dadosPaciente.paciente_id}
        unidadeId={unidadeId}
        internacaoId={internacaoId}
        apenasAdmissao
      />
    </div>
  )
}

export function AbaPrescricao({ doc }: { doc: Doc }) {
  return <PrescricaoTab dados={doc.dadosPaciente} pacienteId={doc.dadosPaciente.paciente_id} />
}

export function AbaExames({ doc, pacienteId, medico }: { doc: Doc; pacienteId: string; medico: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <ExamesTab dados={doc.dadosPaciente} exames={doc.dados.exames} onChange={(p) => doc.atualizar({ exames: { ...doc.dados.exames, ...p } })} />
      <div id="caderno-agravos">
        <Secao titulo="Exames pedidos e agravos de notificação">
          <ExamesEAgravos pacienteId={pacienteId} medico={medico} />
        </Secao>
      </div>
    </div>
  )
}

export function AbaAih({ doc }: { doc: Doc }) {
  return (
    <div className="flex flex-col gap-3">
      <PesoDieta doc={doc} />
      <InternacaoTab
        dados={doc.dadosPaciente}
        aih={doc.dados.aih}
        evolucao={doc.dados.evolucao}
        exames={doc.dados.exames}
        onChange={(p) => doc.atualizar({ aih: { ...doc.dados.aih, ...p } })}
      />
    </div>
  )
}

/** Atestado: os emitidos para o paciente e o emissor da porta, já com ele. */
export function AbaAtestado({ pacienteId, podeEmitir }: { pacienteId: string; podeEmitir: boolean }) {
  const docs = useDocumentos(pacienteId)
  const atestados = (docs.data ?? []).filter((d) => d.tipo_documento === 'atestado' && d.estado !== 'rascunho')
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-fio bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-corpo font-semibold text-tinta">
          <FileText className="size-[15px] text-acao" aria-hidden /> Atestados
        </span>
        {podeEmitir && (
          <Button size="sm" className="ml-auto" render={<Link to={`/plantao/atendimento-porta/atestado-medico?paciente=${pacienteId}`} />}>
            <ExternalLink /> Emitir atestado
          </Button>
        )}
      </div>
      {docs.isLoading ? <Spinner /> : atestados.length === 0 ? (
        <p className="text-apoio text-tinta-sussurro">Nenhum atestado emitido para este paciente.</p>
      ) : (
        atestados.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 border-t border-trilha pt-2 text-apoio">
            <span className="text-tinta">Atestado · versão {d.versao}</span>
            <span className="text-tinta-sussurro">{diaHora(d.created_at)} · {d.estado}</span>
          </div>
        ))
      )}
      <p className="text-apoio text-tinta-sussurro">O emissor abre com este paciente; a folha sai do servidor e fica no prontuário.</p>
    </div>
  )
}
