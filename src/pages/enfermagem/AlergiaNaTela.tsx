// ─────────────────────────────────────────────────────────────────────────────
// Alergia à vista nas telas da enfermagem (auditoria 03/10, R4).
//
// Na classificação de risco e na checagem de medicação a alergia precisa estar
// na tela, sem clique. Usa o MESMO selo de três estados do cabeçalho do
// paciente (tem / nega / não registrada; lista vazia não é "nega") e, abaixo,
// a gravidade e a reação de cada alergia ativa e os eventos adversos ativos.
// Só leitura: registrar continua no painel "Alergias e eventos adversos".
// ─────────────────────────────────────────────────────────────────────────────
import { cn } from '@/lib/utils'
import { SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { ativas, rotuloGrau, rotuloGravidade, useAlergias } from '@/components/paciente/useAlergias'

export function AlergiaNaTela({ pacienteId, className }: { pacienteId: string; className?: string }) {
  // mesma chave de consulta do selo: uma leitura só
  const q = useAlergias(pacienteId)
  const lista = ativas(q.data)
  const eventos = (q.data?.eventos ?? []).filter((e) => !e.inativado_em)

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeloAlergia pacienteId={pacienteId} />
        {eventos.length > 0 && (
          <span className="rounded-capsula bg-alerta-atencao px-2.5 py-[3px] text-rotulo font-semibold text-atencao"
            title="Eventos adversos ativos registrados para o paciente">
            {eventos.length === 1 ? 'Evento adverso' : `${eventos.length} eventos adversos`}
          </span>
        )}
      </div>
      {(lista.length > 0 || eventos.length > 0) && (
        <ul className="flex flex-col gap-0.5 text-rotulo text-tinta-apoio">
          {lista.map((a) => (
            <li key={a.id}>
              <span className="font-semibold text-critico">{a.substancia}</span>
              {' · '}{rotuloGravidade(a.gravidade).toLowerCase()}{a.reacao ? ` · ${a.reacao}` : ''}
            </li>
          ))}
          {eventos.map((e) => (
            <li key={e.id}>
              <span className="font-semibold text-atencao">{e.evento}</span>
              {' · evento adverso, '}{rotuloGrau(e.grau).toLowerCase()}{e.item_descricao ? ` · ${e.item_descricao}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
