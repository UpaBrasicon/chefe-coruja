// VA1 (revisão do perfil Farmacêutico, RT 24/11/2026): idade e alergias do
// paciente ao lado dos itens a validar. Só mostra o que o servidor devolve
// (contexto_paciente_farmacia): nada de dose calculada nem conversão de adulto
// para criança. Alergia ativa em destaque; "não registrada" e "não soube" em
// atenção, porque lista vazia não é "nega".
import { AlertTriangle, ShieldCheck, ShieldQuestion } from 'lucide-react'

import { cn } from '@/lib/utils'
import { resumoAlergias, textoIdade } from '@/lib/contextoPacienteFarmacia'
import { useContextoPacienteFarmacia } from '@/hooks/useContextoPacienteFarmacia'

export function ContextoPacienteFarmacia({ pacienteId, unidade }: { pacienteId: string | null; unidade: string }) {
  const q = useContextoPacienteFarmacia(pacienteId, unidade)
  if (!pacienteId || q.error) {
    // sem leitura não se afirma nada: nem idade, nem "nega"
    return (
      <div className="flex flex-col gap-1">
        <span className="text-rotulo text-tinta-sussurro">Idade e alergias</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-atencao">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />Não foi possível ler: confira no prontuário antes de liberar
        </span>
      </div>
    )
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-rotulo text-tinta-sussurro">Idade e alergias</span>
        <span className="text-tinta-sussurro">lendo…</span>
      </div>
    )
  }
  const idade = textoIdade(q.data)
  const alergia = resumoAlergias(q.data.alergias)
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-rotulo text-tinta-sussurro">Idade</span>
        <span className={cn('tabular-nums', q.data.idade ? 'text-tinta' : 'font-medium text-atencao')}>{idade.principal}</span>
        {idade.faixa && (
          <span className={cn('text-rotulo font-medium', q.data.publico === 'pediatrico' ? 'text-acao' : 'text-atencao')}>{idade.faixa}</span>
        )}
      </div>
      <div className="flex flex-col gap-1" aria-live="polite">
        <span className="text-rotulo text-tinta-sussurro">Alergias</span>
        {alergia.tom === 'critico' ? (
          <div role="alert" className="flex flex-col gap-1 rounded-cartao border border-critico bg-critico/10 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-critico">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />{alergia.titulo}
            </span>
            {alergia.itens.length === 0 ? (
              <span className="text-tinta-apoio">Substância não informada: confira no prontuário.</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {alergia.itens.map((a) => (
                  <li key={a.substancia} className="flex flex-col">
                    <span className="font-semibold text-tinta">{a.substancia}</span>
                    {a.detalhe && <span className={cn('text-rotulo', a.grave ? 'font-medium text-critico' : 'text-tinta-apoio')}>{a.detalhe}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : alergia.tom === 'neutro' ? (
          <span className="inline-flex items-center gap-1.5 text-tinta"><ShieldCheck className="size-3.5 shrink-0" aria-hidden />{alergia.titulo}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-cartao border border-atencao bg-atencao/10 px-2 py-1 font-medium text-atencao">
            <ShieldQuestion className="size-3.5 shrink-0" aria-hidden />{alergia.titulo}
          </span>
        )}
      </div>
    </>
  )
}
