// ─────────────────────────────────────────────────────────────────────────────
// Checagem de enfermagem (Fase 4.6).
//
// Itens ativos das prescrições dos pacientes do meu plantão. As regras de cada
// item (aprazar, checar, liberação da farmácia, validade e atraso) ficam em
// components/enfermagem/checagem/ItemChecagem, o mesmo da gaveta Cuidados.
// Revisão do perfil Enfermeiro (RT 24/11/2026): CK1, a ronda "Por horário"
// abre primeiro (Atrasadas · Agora · Próximas 2 h · Mais tarde), cruzando
// pacientes, e "Por paciente" fica como alternativa; o paciente de um item
// abre a gaveta Cuidados dele, sem trocar de página (CK0).
// ─────────────────────────────────────────────────────────────────────────────
import { ClipboardCheck } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { Abas, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { useAgora } from '@/hooks/useAgora'
import { useChecagem, type LinhaChecagem } from '@/components/enfermagem/checagem/dados'
import { ListaRonda } from '@/components/enfermagem/checagem/ListaRonda'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

import { AlergiaNaTela } from './AlergiaNaTela'
import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'

type Visao = 'horario' | 'paciente'

export default function Checagem() {
  const { papelAtivo } = useUnidade()
  const agora = useAgora()
  const [erro, setErro] = React.useState<string | null>(null)
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)
  const [busca, setBusca] = useSearchParams()
  const visao: Visao = busca.get('ver') === 'paciente' ? 'paciente' : 'horario'
  const trocar = (v: Visao) => setBusca((b) => { const n = new URLSearchParams(b); if (v === 'horario') n.delete('ver'); else n.set('ver', v); return n }, { replace: true })
  const { carregando, linhas, ctx, recarregar } = useChecagem()
  const souEnfermeiro = papelAtivo === 'enfermeiro'

  const abrir = (l: Pick<LinhaChecagem, 'paciente_id' | 'paciente_nome' | 'local'>) =>
    setCuidando({ pacienteId: l.paciente_id, nome: l.paciente_nome, local: l.local ?? 'Paciente' })
  const botaoPaciente = (l: LinhaChecagem) => (
    // padrao-ok: o nome do paciente é o link da gaveta dele, dentro do item
    <button type="button" onClick={() => abrir(l)} className="self-start text-apoio text-tinta-apoio hover:text-acao hover:underline">
      <span className="font-medium text-tinta">{l.paciente_nome}</span> · {l.local ?? '—'}
    </button>
  )

  const pacientes = new Map<string, LinhaChecagem[]>()
  for (const l of linhas) pacientes.set(l.paciente_id, [...(pacientes.get(l.paciente_id) ?? []), l])

  return (
    <>
      <TituloPagina icone={ClipboardCheck} titulo="Checagem"
        descricao="Itens prescritos dos pacientes do seu plantão. Não feito e recusado pedem motivo; corrigir é checar de novo." />
      <Abas rotulo="Ver a checagem" valor={visao} onChange={trocar} className="mb-4"
        abas={[['horario', 'Por horário'], ['paciente', 'Por paciente', pacientes.size || undefined]]} />
      <MensagemErro texto={erro} className="mb-3" />
      {carregando && <EsqueletoLinhas linhas={4} rotulo="Carregando a checagem…" />}
      {!carregando && linhas.length === 0 && (
        <Vazio icone={ClipboardCheck} titulo="Nenhum item para checar" texto="Pacientes dos setores da sua escala com prescrição ativa aparecem aqui." />
      )}
      {visao === 'horario' ? (
        <ListaRonda linhas={linhas} ctx={ctx} souEnfermeiro={souEnfermeiro} agora={agora} aoMudar={recarregar} aoErro={setErro} paciente={botaoPaciente} />
      ) : (
        <div className="flex flex-col gap-4">
          {[...pacientes.entries()].map(([id, itens]) => (
            <section key={id} aria-label={itens[0].paciente_nome} className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* padrao-ok: o nome abre a gaveta Cuidados do paciente */}
                <button type="button" onClick={() => abrir(itens[0])} className="text-corpo font-semibold text-tinta hover:text-acao hover:underline">
                  {itens[0].paciente_nome}
                </button>
                <span className="text-apoio text-tinta-sussurro">{itens[0].local ?? '—'}</span>
              </div>
              {/* alergia de cada paciente junto dos itens a administrar (R4) */}
              <AlergiaNaTela pacienteId={id} />
              <ListaRonda linhas={itens} ctx={ctx} souEnfermeiro={souEnfermeiro} agora={agora} aoMudar={recarregar} aoErro={setErro} />
            </section>
          ))}
        </div>
      )}
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </>
  )
}
