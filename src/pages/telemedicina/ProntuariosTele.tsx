// Prontuários no perfil Telemedicina (PT1, RT 24/11/2026): só os pacientes das
// teleinterconsultas que você aceitou, abertos para leitura até 24 h depois do
// parecer (private.teleinterconsulta_vigente), cada um com o chamado de origem.
// Sem "pacientes do seu plantão", sem pedido de acesso e sem urgência: o RT
// decidiu que o teleconsultor não pede prontuário fora da teleinterconsulta.
// Lê a própria tabela teleinterconsultas, que a política deixa o consultor ver.
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { JANELA_LEITURA_MS } from '@/lib/telemedicinaPerfil'

import { hhmm, Nota, VazioLinha } from './comum'

export default function ProntuariosTele() {
  const { perfil } = useAuth()
  const q = useQuery({
    queryKey: ['tele-prontuarios', perfil?.id],
    enabled: !!perfil,
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - JANELA_LEITURA_MS).toISOString()
      const { data, error } = await supabase.from('teleinterconsultas')
        .select('id, paciente_id, status, pergunta, urgencia, aceita_em, respondida_em, pacientes(nome, data_nascimento), unidades(nome)')
        .eq('consultor_id', perfil!.id)
        .or(`status.eq.em_atendimento,and(status.eq.respondida,respondida_em.gt.${desde})`)
        .order('aceita_em', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
  const lista = q.data ?? []
  return (
    <div className="flex w-full max-w-4xl flex-col">
      <TituloPagina titulo="Prontuários" descricao="Os pacientes das teleinterconsultas que você aceitou, para leitura até 24 h depois do parecer" />
      {q.isLoading && <Spinner />}
      {q.error && <p role="alert" className="text-apoio text-critico">{(q.error as Error).message}</p>}
      {q.data && lista.length === 0 && <VazioLinha>Nenhum prontuário aberto para você agora. Ele abre quando você aceita um chamado.</VazioLinha>}
      {lista.length > 0 && (
        <ul className="overflow-hidden rounded-cartao border border-fio bg-superficie">
          {lista.map((t) => {
            const ate = t.respondida_em ? new Date(new Date(t.respondida_em).getTime() + JANELA_LEITURA_MS).toISOString() : null
            return (
              <li key={t.id} className="flex flex-col gap-2 border-b border-trilha px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                    <span className="text-corpo font-medium text-tinta">
                      {t.pacientes?.nome ?? 'Paciente'}
                      {t.pacientes?.data_nascimento && <span className="text-apoio font-normal text-tinta-sussurro"> · nasc. {fmtData(t.pacientes.data_nascimento)}</span>}
                    </span>
                    <span className="text-apoio text-tinta-sussurro">
                      {t.unidades?.nome ? `${t.unidades.nome} · ` : ''}
                      {t.status === 'em_atendimento' ? `Em atendimento desde ${hhmm(t.aceita_em)}` : `Leitura até ${ate ? fmtDataHora(ate) : ''}`}
                    </span>
                  </div>
                  {t.status === 'em_atendimento' && (
                    <Button size="sm" variant="outline" nativeButton={false} render={<Link to={`/teleinterconsulta?aba=atendimento&sala=${t.id}`} />}>Abrir a sala</Button>
                  )}
                  <Button size="sm" nativeButton={false} render={<Link to={`/prontuarios/${t.paciente_id}`} />}>Ler prontuário</Button>
                </div>
                <p className="line-clamp-2 text-apoio text-tinta-apoio"><span className="text-tinta-sussurro">Chamado: </span>{t.pergunta}</p>
              </li>
            )
          })}
        </ul>
      )}
      <Nota icone={<Lock />}>
        O prontuário abre só pela teleinterconsulta aceita. Fora dela não há pedido de acesso neste perfil. Cada abertura vai para a trilha de auditoria.
      </Nota>
    </div>
  )
}
