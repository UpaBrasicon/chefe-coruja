import { ArrowLeft, ClipboardPlus, Stethoscope } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { Abas, TituloPagina } from '@/components/monitor/Pagina'
import { PacientesRegulacao } from '@/components/regulacao/PacientesRegulacao'
import { Button } from '@/components/ui/button'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { useUnidade } from '@/contexts/UnidadeContext'

import { FilaPS } from './porta/FilaPS'
import { JanelaAtendimento } from './porta/JanelaAtendimento'
import type { EpFila } from './porta/comum'

// Atendimento médico no Pronto-Socorro (Fase 2.4, porte do protótipo): a fila
// médica (cor → 80+ → prioridade legal → espera), "Em atendimento" à parte,
// "Saídas do plantão" e a janela do atendimento em abas. Nada aqui sugere
// cor ou conduta (ADR 0007). As peças moram em ./porta/.
// R2 (RT, 24/11/2026): a Regulação do médico mora aqui, na aba "Em regulação":
// os pacientes da unidade com pedido aberto, abrindo nos meus ("Meus" e
// "Toda a unidade"); o clique abre a aba do paciente.

// BT1 (revisão das telas novas, RT 25/11/2026): "Nova ficha" na linha do título,
// longe de "Chamar o próximo". Abre a mesma Nova ficha da recepção aqui dentro
// (?ficha=nova), com "Voltar à fila médica" no topo e o item Atendimento do
// menu ainda marcado. Regra do B-08: fora da UBS e para quem tem papel médico.
const Recepcao = React.lazy(() => import('@/pages/recepcao/Recepcao'))

type AbaAtendimento = 'porta' | 'regulacao'

export default function AtendimentoPorta() {
  const { unidadeAtiva, papelAtivo, ehPlantonista } = useUnidade()
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
  const podeNovaFicha = !ubs && ehPlantonista
  const novaFicha = podeNovaFicha && busca.get('ficha') === 'nova'
  // sem replace: o voltar do navegador também leva de volta à fila
  const abrirNovaFicha = (abrir: boolean) => setBusca((b) => {
    const n = new URLSearchParams(b)
    if (abrir) { n.set('ficha', 'nova'); n.delete('aba') } else n.delete('ficha')
    return n
  })
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

  if (novaFicha) {
    return (
      <>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 self-start" onClick={() => abrirNovaFicha(false)}>
          <ArrowLeft /> Voltar à fila médica
        </Button>
        <React.Suspense fallback={<EsqueletoLinhas linhas={4} rotulo="Carregando a Nova ficha…" />}>
          <Recepcao embutida />
        </React.Suspense>
      </>
    )
  }

  return (
    <>
      {enfermagem
        ? <TituloPagina icone={Stethoscope} titulo="Consultório de enfermagem" descricao="Fichas da UBS para a enfermagem, por ordem de chegada, com a prioridade legal na frente." />
        : ubs
        ? <TituloPagina icone={Stethoscope} titulo="Consultório" descricao="Pacientes da UBS por ordem de chegada, com a prioridade legal na frente · chamar e atender." />
        : aba === 'regulacao'
        ? <TituloPagina icone={Stethoscope} titulo="Em regulação" descricao="Pacientes com pedido de regulação aberto, primeiro os seus (pedidos que você fez e setores do seu plantão), com a unidade toda ao lado: situação, prazo e o que o médico regulador pergunta. Clique para abrir a regulação do paciente." />
        : <TituloPagina icone={Stethoscope} titulo="Pronto-Socorro" descricao="Pacientes triados por prioridade · chamar e atender. A cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor."
            acoes={podeNovaFicha && (
              <Button size="sm" variant="outline" onClick={() => abrirNovaFicha(true)}><ClipboardPlus /> Nova ficha</Button>
            )} />}
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
