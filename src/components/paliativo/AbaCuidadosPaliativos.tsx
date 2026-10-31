// ─────────────────────────────────────────────────────────────────────────────
// Aba Cuidados paliativos do leito (ponto 15 do plantonista, RT 31/10/2026):
// a pergunta surpresa (só no adulto; é a única ferramenta paliativa com a fonte
// confirmada) e o termo de cuidados paliativos (modelo da unidade, a mesma peça
// do termo de consentimento). PPS, PPI e PaP esperam a fonte completa; PPI e
// PaP, quando entrarem, só para câncer avançado no adulto. Nada aqui sugere
// conduta nem limite de tratamento: a decisão é do médico com o paciente ou o
// responsável.
// ─────────────────────────────────────────────────────────────────────────────
import { HeartHandshake } from 'lucide-react'
import * as React from 'react'

import {
  AVISO_PERGUNTA_SURPRESA, fichaPerguntaSurpresa, LEITURA_PERGUNTA_SURPRESA, OPCOES_PERGUNTA_SURPRESA, PERGUNTA_SURPRESA,
  perguntaSurpresaSeAplica,
} from '@/clinico/paliativo/perguntaSurpresa'
import { textoFontes } from '@/clinico/ficha'
import { idadeEm } from '@/domain/idade'
import { supabase } from '@/lib/supabase'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { hojeSP, msg, quando, useAvaliacoes, usePacienteCurva, useRecarregarAvaliacao } from '@/components/avaliacao/useAvaliacao'
import { AbaTermoConsentimento } from '@/components/termo/AbaTermoConsentimento'

export function AbaCuidadosPaliativos({ pacienteId, episodioId, internacaoId, podeRegistrar }: {
  pacienteId: string
  episodioId?: string | null
  internacaoId?: string | null
  /** quem escreve no leito (o médico com a internação aberta) */
  podeRegistrar: boolean
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <PerguntaSurpresa pacienteId={pacienteId} episodioId={episodioId} internacaoId={internacaoId} podeRegistrar={podeRegistrar} />
      <AbaTermoConsentimento pacienteId={pacienteId} episodioId={episodioId} internacaoId={internacaoId} categoria="cuidados_paliativos" />
    </div>
  )
}

function PerguntaSurpresa({ pacienteId, episodioId, internacaoId, podeRegistrar }: {
  pacienteId: string; episodioId?: string | null; internacaoId?: string | null; podeRegistrar: boolean
}) {
  const paciente = usePacienteCurva(pacienteId)
  const q = useAvaliacoes(pacienteId)
  const recarregar = useRecarregarAvaliacao(pacienteId)
  const [resposta, setResposta] = React.useState<0 | 1 | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  const nascimento = paciente.data?.data_nascimento ?? null
  const idade = nascimento ? idadeEm(nascimento, hojeSP())?.anos ?? null : null
  const seAplica = perguntaSurpresaSeAplica(idade)
  const registros = (q.data ?? []).filter((a) => (a.escala as string) === 'pergunta_surpresa')

  async function salvar() {
    if (resposta === null) return
    setOcupado(true)
    setErro(null)
    const { error } = await supabase.rpc('registrar_avaliacao', {
      p_paciente: pacienteId, p_escala: 'pergunta_surpresa', p_respostas: { surpreso: resposta },
      p_episodio: episodioId ?? undefined, p_internacao: internacaoId ?? undefined,
    })
    setOcupado(false)
    if (error) return setErro(msg(error))
    setResposta(null)
    recarregar()
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-container border border-fio bg-superficie p-4 text-controle">
      <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
        <HeartHandshake className="size-[15px] text-acao" aria-hidden /> Pergunta surpresa
        <span className="text-apoio font-normal text-tinta-sussurro">adulto</span>
      </h3>
      {paciente.isLoading ? <Spinner /> : !seAplica ? (
        <p className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
          {idade == null
            ? 'Sem data de nascimento no cadastro: a pergunta surpresa é do adulto e não se aplica sem a idade.'
            : 'A pergunta surpresa é validada no adulto (14 anos ou mais). Na criança não se usa: nada se converte do adulto.'}
        </p>
      ) : (
        <>
          <p className="text-corpo text-tinta">{PERGUNTA_SURPRESA}</p>
          {podeRegistrar && (
            <>
              <div role="radiogroup" aria-label="Resposta da pergunta surpresa" className="flex flex-wrap gap-1.5">
                {OPCOES_PERGUNTA_SURPRESA.map((o) => (
                  <Chip key={o.valor} variante="opcao" ativo={resposta === o.valor} onClick={() => setResposta(resposta === o.valor ? null : o.valor)}>{o.rotulo}</Chip>
                ))}
              </div>
              {resposta !== null && <p className="text-apoio font-medium text-tinta">Leitura: {LEITURA_PERGUNTA_SURPRESA[resposta]}</p>}
            </>
          )}
          <p className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">{AVISO_PERGUNTA_SURPRESA}</p>
          <p className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">{textoFontes(fichaPerguntaSurpresa)}</p>
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
          {podeRegistrar && (
            <div className="flex justify-end">
              <Button size="sm" disabled={resposta === null || ocupado} onClick={() => void salvar()}>Registrar</Button>
            </div>
          )}
        </>
      )}
      {registros.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-trilha pt-2.5">
          {registros.map((a) => (
            <li key={a.id} className={a.cancelada_em ? 'text-apoio text-tinta-sussurro line-through' : 'text-apoio text-tinta'}>
              {a.interpretacao} <span className="text-tinta-sussurro">· {quando(a.registrado_em)} · {a.autor ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
