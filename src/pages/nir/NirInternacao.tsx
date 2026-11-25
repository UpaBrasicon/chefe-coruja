// ─────────────────────────────────────────────────────────────────────────────
// Internação do NIR (perfil NIR, pedido do RT de 24/11/2026): "equipe
// responsável por olhar as regulações de todos os pacientes (observação,
// encaminhamento, exames ou internação)". O menu do NIR fica com esta tela e
// a Escala.
//
// Reconstruída pelo modelo do RT de 25/11/2026 (NIR1 a NIR5):
// • Abas no topo: Painel NIR, Pendências com médicos (N) e Mapa de leitos;
//   "Avisos" (não lidos) abre a lista, uma linha por pedido, no lugar do
//   cartão de avisos; "Novo pedido" escolhe o paciente e abre o formulário
//   que já existe.
// • Painel NIR: lista por leito com filtros e o dossiê ao lado (PainelNir).
// • O NIR avisa o médico (pendência com aviso) e também atualiza a evolução do
//   pedido de regulação (decisão do RT de 25/11/2026), com autor = login; não
//   escreve a evolução médica do prontuário.
// • Fora do plantão (decisão do RT de 25/11/2026, B-07): o servidor recusa as
//   ações do NIR no pedido; a tela avisa antes, com a frase do servidor, e
//   desliga os botões (regulacao_por_que_nao_ajo, migration 20270426000020).
// RPCs regulacao_pacientes (20270421000040) e as da 20270425000030.
// ─────────────────────────────────────────────────────────────────────────────
import { Plus } from 'lucide-react'
import * as React from 'react'

import { AbasLinha } from '@/components/nir/AbasLinha'
import { AvisosNirBotao } from '@/components/nir/AvisosNirBotao'
import { MapaLeitosNir } from '@/components/nir/MapaLeitosNir'
import { PainelNir } from '@/components/nir/PainelNir'
import { PendenciasMedicos } from '@/components/nir/PendenciasMedicos'
import { useMapaLeitos, usePacientesNir, usePendenciasNir, useRecarregarNir } from '@/components/nir/dadosNir'
import { AvisoPlantao } from '@/components/regulacao/AvisoPlantao'
import { ContextoPlantaoOrigem, useMotivoPlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { useUnidade } from '@/contexts/UnidadeContext'
import { pedidosAbertos } from '@/lib/nirPainel'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'

type AbaNir = 'painel' | 'pendencias' | 'mapa'

export default function NirInternacao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const pacientes = usePacientesNir(unidadeId)
  const pendencias = usePendenciasNir(unidadeId)
  const mapa = useMapaLeitos(unidadeId)
  const recarregar = useRecarregarNir(unidadeId)
  // B-07: nulo = pode agir; senão, a frase do servidor (o gestor nunca é barrado)
  const foraDoPlantao = useMotivoPlantaoOrigem(unidadeId)
  const [aba, setAba] = React.useState<AbaNir>('painel')
  const [selecionado, setSelecionado] = React.useState<string | null>(null)
  const [abrirNovo, setAbrirNovo] = React.useState<{ pacienteId: string; vez: number } | null>(null)
  const [escolherNovo, setEscolherNovo] = React.useState(false)
  // "agora" das contas de horas: a hora da última leitura da lista (relê a cada minuto)
  const agora = pacientes.dataUpdatedAt

  const lista = pacientes.data ?? []
  const pend = pendencias.data ?? []
  const abertasMedico = pend.filter((x) => x.dono === 'medico' && x.status !== 'resolvida').length
  const abrirPaciente = (id: string) => { setSelecionado(id); setAba('painel') }
  // o aviso abre o paciente do pedido no painel
  const abrirPedido = (numero: number) => {
    const alvo = lista.find((l) => l.pedidos.some((p) => p.numero === numero))
    if (alvo) abrirPaciente(alvo.paciente.id)
  }

  return (
    // largura cheia (desfaz o respiro da coluna) e, no computador, a altura da janela
    <div className="-mx-4! -mt-5 flex flex-col text-apoio md:-mx-7! md:-mt-7 in-[.cc-den]:-mt-[15px]! lg:-mx-[max(28px,5%)]! lg:-mb-[72px] lg:h-[calc(100dvh-var(--cc-topo))] [&_[data-slot=badge]]:tracking-normal [&_[data-slot=badge]]:normal-case">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 border-b border-fio bg-superficie px-4">
        <span className="py-2.5 font-semibold text-tinta">NIR · Internação e Regulação</span>
        <AbasLinha rotulo="Internação do NIR" valor={aba} onChange={setAba} abas={[
          { valor: 'painel', rotulo: 'Painel NIR' },
          { valor: 'pendencias', rotulo: 'Pendências com médicos', contagem: abertasMedico, alerta: true },
          { valor: 'mapa', rotulo: 'Mapa de leitos' },
        ]} />
        <span className="ml-auto flex gap-2 py-1.5">
          {unidadeId && <AvisosNirBotao unidadeId={unidadeId} abrirPedido={abrirPedido} />}
          <Button size="sm" onClick={() => setEscolherNovo(true)} disabled={lista.length === 0 || !!foraDoPlantao} title={foraDoPlantao ?? undefined}><Plus /> Novo pedido</Button>
        </span>
      </div>
      {!unidadeId ? null : pacientes.isLoading ? <div className="p-4"><EsqueletoLinhas linhas={6} rotulo="Carregando os pacientes…" /></div>
        : pacientes.error ? <div className="p-4"><MensagemErro texto={(pacientes.error as Error).message} /></div> : (
          <ContextoPlantaoOrigem.Provider value={foraDoPlantao}>
            {foraDoPlantao && <div className="shrink-0 px-4 pt-2"><AvisoPlantao texto={foraDoPlantao} /></div>}
            {pendencias.error && <div className="px-4 pt-2"><MensagemErro texto={`Pendências: ${(pendencias.error as Error).message}`} /></div>}
            {aba === 'painel' && (
              <PainelNir unidadeId={unidadeId} lista={lista} pend={pend} mapa={mapa.data} agora={agora} selecionado={selecionado}
                selecionar={setSelecionado} abrirNovo={abrirNovo} />
            )}
            {aba !== 'painel' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {aba === 'pendencias' && (
                  <PendenciasMedicos unidadeId={unidadeId} pend={pend} lista={lista} agora={agora} abrirPaciente={abrirPaciente} aoMudar={() => recarregar()} />
                )}
                {aba === 'mapa' && (
                  mapa.isLoading ? <EsqueletoLinhas linhas={6} rotulo="Carregando os leitos…" />
                    : mapa.error ? <MensagemErro texto={(mapa.error as Error).message} />
                      : mapa.data && <MapaLeitosNir mapa={mapa.data} lista={lista} pend={pend} agora={agora} abrirPaciente={abrirPaciente} />
                )}
              </div>
            )}
          </ContextoPlantaoOrigem.Provider>
        )}
      <EscolherPaciente aberto={escolherNovo} lista={lista} aoFechar={() => setEscolherNovo(false)}
        aoEscolher={(id) => {
          setEscolherNovo(false)
          abrirPaciente(id)
          setAbrirNovo((x) => ({ pacienteId: id, vez: (x?.vez ?? 0) + 1 }))
        }} />
    </div>
  )
}

/** "Novo pedido" do topo: escolhe o internado; o formulário abre no dossiê dele. */
function EscolherPaciente({ aberto, lista, aoFechar, aoEscolher }: {
  aberto: boolean; lista: PacienteRegulacao[]; aoFechar: () => void; aoEscolher: (pacienteId: string) => void
}) {
  const [id, setId] = React.useState('')
  const ordenada = [...lista].sort((a, b) => Number(pedidosAbertos(a).length > 0) - Number(pedidosAbertos(b).length > 0)
    || (a.leito ?? '').localeCompare(b.leito ?? '', 'pt-BR'))
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar() }}>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (id) aoEscolher(id) }}>
          <DialogHeader>
            <DialogTitle>Novo pedido de regulação</DialogTitle>
            <DialogDescription>Escolha o paciente internado; o formulário abre no dossiê dele, já com o quadro do prontuário.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nir-novo-paciente">Paciente</Label>
            <CampoSelecao id="nir-novo-paciente" value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Escolha…</option>
              {ordenada.map((l) => (
                <option key={l.paciente.id} value={l.paciente.id}>
                  {l.leito ?? 'Sem leito'} · {l.paciente.nome}{l.setor ? ` · ${l.setor.nome}` : ''}{pedidosAbertos(l).length > 0 ? ' · já em regulação' : ''}
                </option>
              ))}
            </CampoSelecao>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
            <Button type="submit" disabled={!id}>Abrir o formulário</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
