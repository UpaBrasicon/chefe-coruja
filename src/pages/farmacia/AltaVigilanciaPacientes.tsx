// AV1 (revisão do perfil Enfermeiro, RT 24/11/2026): no perfil Enfermeiro a
// tela de Alta vigilância abre em "Nos seus pacientes agora": os itens de alta
// vigilância prescritos aos pacientes da escala, com o horário e a liberação
// da farmácia. A leitura é a mesma da Checagem (fila_checagem e
// liberacao_farmacia); o paciente abre a gaveta Cuidados, onde se checa.
import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { useChecagem } from '@/components/enfermagem/checagem/dados'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { useAgora } from '@/hooks/useAgora'
import { estadoLiberacao } from '@/lib/duplaChecagem'
import { grupoDoItem, GRUPOS_RONDA } from '@/lib/rondaChecagem'
import { hora } from '@/lib/formato'

import { GavetaCuidados, type PacienteEmCuidado } from '@/pages/enfermagem/GavetaCuidados'

export function AltaVigilanciaNosPacientes() {
  const agora = useAgora()
  const { carregando, linhas, ctx } = useChecagem()
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)
  const itens = linhas
    .filter((l) => { const lib = ctx.liberacao?.get(l.item_id); return !!lib && lib.alta_vigilancia !== false })
    .map((l) => ({ l, ...grupoDoItem(l, agora) }))
    .filter((x) => x.grupo !== 'feitos')
    .sort((a, b) => GRUPOS_RONDA.findIndex((g) => g.id === a.grupo) - GRUPOS_RONDA.findIndex((g) => g.id === b.grupo) || (a.instante ?? Infinity) - (b.instante ?? Infinity))

  if (carregando) return <EsqueletoLinhas linhas={3} rotulo="Carregando os itens de alta vigilância…" />
  if (itens.length === 0) {
    return <Vazio icone={ShieldAlert} titulo="Nenhum item de alta vigilância nos seus pacientes" texto="Quando um paciente da sua escala tiver alta vigilância prescrita, o item aparece aqui com a liberação da farmácia." />
  }
  return (
    <>
      <ul aria-label="Alta vigilância nos seus pacientes" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {itens.map(({ l, grupo, instante }) => {
          const lib = estadoLiberacao(ctx.liberacao?.get(l.item_id))
          const quando = grupo === 'sem_horario' ? (l.se_necessario ? 'se necessário' : 'sem horário')
            : instante ? `${GRUPOS_RONDA.find((g) => g.id === grupo)!.rotulo.toLowerCase()} · ${hora(new Date(instante).toISOString())}` : 'agora'
          return (
            <li key={l.item_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                <span className="text-apoio font-medium text-tinta">{l.descricao} <span className="font-normal text-tinta-apoio">{[l.dose, l.via, l.posologia].filter(Boolean).join(' · ')}</span></span>
                {/* padrao-ok: o nome do paciente abre a gaveta Cuidados dele */}
                <button type="button" className="self-start text-apoio text-tinta-sussurro hover:text-acao hover:underline"
                  onClick={() => setCuidando({ pacienteId: l.paciente_id, nome: l.paciente_nome, local: l.local ?? 'Paciente' })}>
                  {l.paciente_nome} · {l.local ?? '—'}
                </button>
              </div>
              <span className={grupo === 'atrasadas' ? 'text-apoio font-semibold text-critico' : 'text-apoio text-tinta-apoio'}>{quando}</span>
              {lib === 'liberado' ? <Estado tom="verde">liberado</Estado>
                : lib === 'devolvido' ? <Estado tom="vermelho">devolvido pela farmácia</Estado>
                  : <Estado tom="ambar">aguardando farmácia</Estado>}
            </li>
          )
        })}
      </ul>
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </>
  )
}
