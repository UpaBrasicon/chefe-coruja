import { Stethoscope } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { Abas, TituloPagina } from '@/components/monitor/Pagina'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { useUnidade } from '@/contexts/UnidadeContext'

import { FilaPS } from './porta/FilaPS'
import { JanelaAtendimento } from './porta/JanelaAtendimento'
import type { EpFila } from './porta/comum'

// Atendimento médico no Pronto-Socorro (Fase 2.4, porte do protótipo): a fila
// médica (cor → 80+ → prioridade legal → espera), "Em atendimento" à parte,
// "Saídas do plantão" e a janela do atendimento em abas. Nada aqui sugere
// cor ou conduta (ADR 0007). As peças moram em ./porta/.
// R2 (RT, 24/11/2026): a Regulação do médico mora aqui, na aba "Em regulação":
// os pacientes da unidade com pedido aberto; o clique abre a aba do paciente.

type AbaAtendimento = 'porta' | 'regulacao'

export default function AtendimentoPorta() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const ubs = unidadeAtiva?.unidade.tipo === 'ubs'
  // U6, PR 2: o consultório de enfermagem da UBS usa a mesma fila, com as fichas da enfermagem
  const enfermagem = ubs && papelAtivo === 'enfermeiro'
  const comRegulacao = !ubs && papelAtivo === 'plantonista'
  const [busca, setBusca] = useSearchParams()
  const aba: AbaAtendimento = comRegulacao && busca.get('aba') === 'regulacao' ? 'regulacao' : 'porta'
  const irPara = (k: AbaAtendimento) => setBusca((b) => {
    const n = new URLSearchParams(b)
    if (k === 'regulacao') n.set('aba', 'regulacao'); else n.delete('aba')
    return n
  }, { replace: true })
  const [atual, setAtual] = React.useState<EpFila | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  if (atual) {
    return (
      <JanelaAtendimento
        key={atual.id}
        ep={atual}
        onFechar={(texto) => { setAviso(texto ?? null); setAtual(null) }}
      />
    )
  }

  return (
    <>
      {enfermagem
        ? <TituloPagina icone={Stethoscope} titulo="Consultório de enfermagem" descricao="Fichas da UBS para a enfermagem, por ordem de chegada, com a prioridade legal na frente." />
        : ubs
        ? <TituloPagina icone={Stethoscope} titulo="Consultório" descricao="Pacientes da UBS por ordem de chegada, com a prioridade legal na frente · chamar e atender." />
        : aba === 'regulacao'
        ? <TituloPagina icone={Stethoscope} titulo="Em regulação" descricao="Pacientes da unidade com pedido de regulação aberto: situação, prazo e o que o médico regulador pergunta. Clique para abrir a regulação do paciente." />
        : <TituloPagina icone={Stethoscope} titulo="Pronto-Socorro" descricao="Pacientes triados por prioridade · chamar e atender. A cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor." />}
      {comRegulacao && (
        <Abas rotulo="Atendimento" valor={aba} onChange={irPara}
          abas={[['porta', 'Pronto-Socorro'], ['regulacao', 'Em regulação']] as const} />
      )}
      {aba === 'regulacao' && unidadeAtiva
        ? <PacientesRegulacao unidadeId={unidadeAtiva.unidade_id} modo="medico" />
        : <FilaPS aviso={aviso} onAbrir={(e) => { setAviso(null); setAtual(e) }} />}
    </>
  )
}
