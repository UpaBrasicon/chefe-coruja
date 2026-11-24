// ─────────────────────────────────────────────────────────────────────────────
// Painel "Cuidados" da enfermagem (porte do protótipo: enfP — PS da
// enfermagem e internação da enfermagem). O formato de entrada é fixo: o PS
// da enfermagem e a internação da enfermagem importam daqui.
//
// Revisão do perfil Enfermeiro (RT 24/11/2026): CU1, abre em "Agora", com o
// que vence (a checagem do paciente acontece aqui, CK0); CU2, as abas
// principais Agora · Sinais vitais · Evolução · SAE e o resto em "Mais"
// (Dispositivos, Balanço hídrico, Curativos, Escalas, Procedimentos
// realizados). Quem pode o quê vem do servidor (cuidados_enfermagem).
//
// TE2 (perfil Técnico, RT 24/11/2026, pelas atribuições do COFEN: Res.
// 736/2024, arts. 4º, 6º a 8º; Decreto 94.406/1987, arts. 8º, 10, 13 e 14): no
// técnico as abas principais são Agora (checagem do prescrito, sem aprazar) ·
// Sinais vitais · Anotação de enfermagem; em "Mais", balanço hídrico,
// curativos e dispositivos (o que ele executou) e, só para leitura, a SAE e as
// escalas de avaliação. A tela segue o perfil em uso: no Técnico, a SAE não
// abre para edição mesmo que a conta também tenha o papel de enfermeiro.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from 'react'

import { ehPediatrico } from '@/domain/idade'
import { usePacienteCurva } from '@/components/avaliacao/useAvaliacao'
import { QuadroProcedimentos } from '@/components/paciente/ProcedimentosRealizados'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'

import { AbaAgora } from './AbaAgora'
import { AbaSae } from './AbaSae'
import { AbaBalanco, AbaCurativos, AbaDispositivos } from './AbasLeito'
import { AbaAnotacao, AbaEscalas, AbaSinaisVitais } from './AbasRegistro'
import { hojeSP, msg, useCuidados } from './dadosCuidados'
import { Nota } from './pecas'
import { Abas } from '@/components/monitor/Pagina'

export type PainelCuidadosProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

type Aba = 'agora' | 'sv' | 'anot' | 'sae' | 'disp' | 'bh' | 'cur' | 'esc' | 'proc'

export function PainelCuidados({ pacienteId, episodioId, internacaoId }: PainelCuidadosProps) {
  const ctx = React.useMemo(() => ({ pacienteId, episodioId, internacaoId }), [pacienteId, episodioId, internacaoId])
  const { papelAtivo, unidadeAtiva } = useUnidade()
  const tecnico = papelAtivo === 'tecnico_enfermagem'
  const q = useCuidados(ctx)
  const pac = usePacienteCurva(pacienteId)
  const [aba, setAba] = React.useState<Aba>('agora')

  if (q.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (q.error || !q.data) return <p role="alert" className="text-apoio text-critico">{q.error ? msg(q.error) : 'Sem dados.'}</p>
  // TE2: a SAE segue o perfil em uso, não os papéis da conta
  const dados = tecnico ? { ...q.data, pode_sae: false } : q.data
  const nasc = pac.data?.data_nascimento ?? null
  const ped = nasc ? ehPediatrico(nasc, hojeSP()) : null
  const publico = ped === null ? null : ped ? 'pediatrico' : 'adulto'
  const emUso = dados.dispositivos.filter((d) => !d.retirado_em).length
  const unidadeId = unidadeAtiva?.unidade_id
  // Fase 3, tarefa 3: no Pronto Socorro, o que a enfermagem faz vai para o BPA (internação vai na AIH)
  const comProcedimentos = !!unidadeId && !(internacaoId ?? dados.internacao_id)

  const principais: { id: Aba; rotulo: string }[] = tecnico
    ? [{ id: 'agora', rotulo: 'Agora' }, { id: 'sv', rotulo: 'Sinais vitais' }, { id: 'anot', rotulo: 'Anotação de enfermagem' }]
    : [{ id: 'agora', rotulo: 'Agora' }, { id: 'sv', rotulo: 'Sinais vitais' }, { id: 'anot', rotulo: dados.pode_sae ? 'Evolução' : 'Anotação de enfermagem' }, { id: 'sae', rotulo: 'SAE' }]
  const mais: { id: Aba; rotulo: string; contagem?: number }[] = [
    ...(tecnico ? [] : [{ id: 'disp' as const, rotulo: 'Dispositivos', contagem: emUso || undefined }]),
    { id: 'bh', rotulo: 'Balanço hídrico' },
    { id: 'cur', rotulo: 'Curativos' },
    ...(tecnico ? [{ id: 'disp' as const, rotulo: 'Dispositivos', contagem: emUso || undefined }, { id: 'sae' as const, rotulo: 'SAE (leitura)' }] : []),
    { id: 'esc', rotulo: tecnico ? 'Escalas (leitura)' : 'Escalas' },
    ...(comProcedimentos ? [{ id: 'proc' as const, rotulo: 'Procedimentos realizados' }] : []),
  ]
  const naMais = mais.some((m) => m.id === aba)
  const atual = [...principais, ...mais].find((a) => a.id === aba)

  return (
    <div className="flex flex-col gap-3">
      <Abas rotulo="Cuidados de enfermagem" className="mb-0" valor={naMais ? 'mais' : aba}
        onChange={(k) => setAba(k === 'mais' ? (naMais ? aba : mais[0].id) : k as Aba)}
        abas={[...principais.map((a) => [a.id, a.rotulo] as const), ['mais', 'Mais'] as const]} />
      {naMais && (
        <Abas rotulo="Mais cuidados" className="mb-0" valor={aba} onChange={setAba}
          abas={mais.map((a) => [a.id, a.rotulo, a.contagem] as const)} />
      )}
      {!dados.atendimento_aberto && (
        <Nota>Sem atendimento ou internação em aberto para este paciente: os cuidados ficam só para leitura.</Nota>
      )}

      <div role="tabpanel" aria-label={atual?.rotulo}>
        {aba === 'agora' && <AbaAgora ctx={ctx} dados={dados} publico={publico} onIr={setAba} />}
        {aba === 'sae' && <AbaSae ctx={ctx} dados={dados} />}
        {aba === 'sv' && <AbaSinaisVitais ctx={ctx} dados={dados} publico={publico} />}
        {aba === 'anot' && <AbaAnotacao ctx={ctx} dados={dados} />}
        {aba === 'disp' && <AbaDispositivos ctx={ctx} dados={dados} />}
        {aba === 'bh' && <AbaBalanco ctx={ctx} dados={dados} />}
        {aba === 'cur' && <AbaCurativos ctx={ctx} dados={dados} />}
        {aba === 'esc' && <AbaEscalas ctx={ctx} dados={dados} publico={publico} somenteLeitura={tecnico} />}
        {aba === 'proc' && comProcedimentos && (
          <QuadroProcedimentos pacienteId={pacienteId} unidadeId={unidadeId!} episodioId={episodioId ?? dados.episodio_id} />
        )}
      </div>
    </div>
  )
}
