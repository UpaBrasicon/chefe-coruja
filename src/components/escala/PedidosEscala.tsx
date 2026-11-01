// ─────────────────────────────────────────────────────────────────────────────
// Pedidos e vagas na aba Escala dos outros papéis (entrega E4, opção A do RT em
// 28/10/2026): no dia escolhido, "Seu plantão" com Trocar, Passar e Justificar
// falta, cada um numa janela (a passagem em janela, pedido do RT); a vaga da
// categoria com "Candidatar-me"; e "Seus pedidos" com o estado de cada um.
// Troca e passagem só dentro da categoria (trava no banco desde a E1); o
// colega aceita (Pedidos para você, A4) e a coordenação aprova, na aba Pedidos do gestor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, FileText, Info, Send } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { type PlantaoEquipe, type Troca, type VagaAberta, usePedidosDaEquipe } from '@/hooks/usePedidosDaEquipe'
import { BUCKET_JUSTIFICATIVA, caminhoNovoAnexo } from '@/lib/anexoJustificativa'
import { dataPorExtenso, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { Estado, type TomEstado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const TOM: Record<string, TomEstado> = { pendente: 'ambar', aprovado: 'verde', recusado: 'vermelho', cancelado: 'cinza', cancelada: 'cinza', erro: 'vermelho' }
const ROTULO_ESTADO: Record<string, string> = { pendente: 'aguardando', aprovado: 'aprovado', recusado: 'recusado', cancelado: 'cancelado', cancelada: 'cancelada', erro: 'não aplicado' }

type Janela = { tipo: 'trocar' | 'passar' | 'falta'; plantao: PlantaoEquipe }

/**
 * Trocar, Passar e Justificar falta de um plantão meu, cada um numa janela. No
 * plantão que já passou, só a falta, com a explicação e o atalho para o próximo
 * (ajuste da E4, opção A do RT em 28/10/2026: as ações à vista).
 */
export function AcoesDoPlantao({ unidadeId, plantao: p, equipe, faixa, nomeSetor, pendente, irParaProximo }: {
  unidadeId: string; plantao: PlantaoEquipe; equipe: PlantaoEquipe[]
  faixa: (p: PlantaoEquipe) => string; nomeSetor: (id: string) => string
  pendente: boolean; irParaProximo?: { rotulo: string; ir: () => void }
}) {
  const [janela, setJanela] = React.useState<Janela | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  // a hora em que a tela abriu: plantão que já terminou só aceita justificar falta
  const [agora] = React.useState(() => Date.now())
  const abrir = (tipo: Janela['tipo']) => { setAviso(null); setJanela({ tipo, plantao: p }) }
  const passou = new Date(p.inicio).getTime() + p.duracao_min * 60_000 <= agora
  // B12 (RT, 31/10/2026): o plantão em curso se passa, mas não se troca
  const comecou = new Date(p.inicio).getTime() <= agora
  return (
    <div className="flex flex-col gap-2">
      {pendente ? (
        <span className="text-rotulo text-atencao">Há um pedido deste plantão em andamento (o colega ou a coordenação ainda vão responder).</span>
      ) : passou ? (
        <>
          <span className="flex items-start gap-1.5 text-rotulo text-pretty text-tinta-sussurro">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Este plantão já passou: só dá para justificar falta. Trocar e passar valem para os próximos.
          </span>
          <Button size="sm" variant="outline" className="w-fit" onClick={() => abrir('falta')}><FileText /> Justificar falta</Button>
          {irParaProximo && (
            <Button variant="link" className="h-auto min-h-0 w-fit p-0 text-rotulo" onClick={irParaProximo.ir}>{irParaProximo.rotulo} →</Button>
          )}
        </>
      ) : comecou ? (
        <>
          <span className="flex items-start gap-1.5 text-rotulo text-pretty text-tinta-sussurro">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Plantão em curso: dá para passar, mas não para trocar.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => abrir('passar')}><Send /> Passar</Button>
            <Button size="sm" variant="outline" onClick={() => abrir('falta')}><FileText /> Justificar falta</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => abrir('trocar')}><ArrowLeftRight /> Trocar</Button>
          <Button size="sm" variant="outline" onClick={() => abrir('passar')}><Send /> Passar</Button>
          <Button size="sm" variant="outline" onClick={() => abrir('falta')}><FileText /> Justificar falta</Button>
        </div>
      )}
      {aviso && <p role="status" className="text-rotulo text-conforme">{aviso}</p>}
      {/* a chave remonta a janela a cada pedido, com o formulário limpo */}
      <JanelaPedido key={janela ? `${janela.tipo}-${janela.plantao.id}` : 'fechada'} unidadeId={unidadeId} janela={janela} equipe={equipe} faixa={faixa} nomeSetor={nomeSetor}
        onFechar={() => setJanela(null)} onFeito={(t) => { setJanela(null); setAviso(t) }} />
    </div>
  )
}

export function SeuPlantao({ unidadeId, meusDoDia, equipe, faixa, horario, nomeSetor, pendentes, irParaProximo }: {
  unidadeId: string; meusDoDia: PlantaoEquipe[]; equipe: PlantaoEquipe[]
  faixa: (p: PlantaoEquipe) => string; horario: (p: PlantaoEquipe) => string; nomeSetor: (id: string) => string
  pendentes: Set<string>; irParaProximo?: { rotulo: string; ir: () => void }
}) {
  if (meusDoDia.length === 0) return null
  return (
    <div className="flex flex-col gap-2 border-b border-trilha bg-alerta-marca/40 px-4 py-3">
      <span className="text-rotulo font-semibold text-tinta-sussurro">Seu plantão</span>
      {meusDoDia.map((p) => (
        <div key={p.id} className="flex flex-col gap-2">
          <span className="text-corpo font-medium text-tinta">
            {faixa(p)} · {nomeSetor(p.setor_id)} <span className="text-apoio font-normal text-tinta-sussurro tabular-nums">{horario(p)}</span>
          </span>
          <AcoesDoPlantao unidadeId={unidadeId} plantao={p} equipe={equipe} faixa={faixa} nomeSetor={nomeSetor}
            pendente={pendentes.has(p.id)} irParaProximo={irParaProximo} />
        </div>
      ))}
    </div>
  )
}

function JanelaPedido({ unidadeId, janela, equipe, faixa, nomeSetor, onFechar, onFeito }: {
  unidadeId: string; janela: Janela | null; equipe: PlantaoEquipe[]
  faixa: (p: PlantaoEquipe) => string; nomeSetor: (id: string) => string
  onFechar: () => void; onFeito: (aviso: string) => void
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [outro, setOutro] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [texto, setTexto] = React.useState('')
  const [tipoFalta, setTipoFalta] = React.useState<'atestado_medico' | 'licenca_maternidade'>('atestado_medico')
  const [anexo, setAnexo] = React.useState<File | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const p = janela?.plantao
  const [agora] = React.useState(() => Date.now())

  const colegas = useQuery({
    queryKey: ['colegas-da-categoria', unidadeId],
    enabled: janela?.tipo === 'passar',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('colegas_da_categoria', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  // troca: plantões futuros dos colegas da mesma categoria do meu plantão
  const plantoesDosColegas = equipe.filter((e) => e.perfil_id !== perfil?.id && new Date(e.inicio).getTime() > agora
    && (!p?.papel || e.papel === p.papel))
  const destinos = (colegas.data ?? []).filter((c) => !p?.papel || c.papel === p.papel)
  const escolhido = plantoesDosColegas.find((e) => e.id === outro)

  async function enviar() {
    if (!p || !perfil) return
    setErro(null); setSalvando(true)
    try {
      if (janela!.tipo === 'trocar') {
        const { error } = await supabase.rpc('solicitar_troca', { p_plantao_a: p.id, p_plantao_b: outro, p_mensagem: texto.trim() || undefined })
        if (error) throw error
        onFeito('Troca pedida. O colega precisa aceitar; depois a coordenação decide. Você recebe os avisos.')
      } else if (janela!.tipo === 'passar') {
        const { data, error } = await supabase.rpc('passar_plantao', { p_escala: p.id, p_destino: destino, p_justificativa: texto.trim() || undefined })
        if (error) throw error
        onFeito(data === p.id ? 'Plantão passado.' : 'Passagem pedida. O colega precisa aceitar; depois a coordenação decide. Você recebe os avisos.')
      } else {
        // o bucket é privado: grava o caminho; o gestor abre com URL assinada (A5)
        let anexoUrl: string | null = null
        if (anexo) {
          const caminho = caminhoNovoAnexo(unidadeId, anexo.name, crypto.randomUUID())
          const { error: upErr } = await supabase.storage.from(BUCKET_JUSTIFICATIVA).upload(caminho, anexo, { cacheControl: '3600', upsert: false })
          if (upErr) throw new Error('Falha ao enviar o anexo: ' + upErr.message)
          anexoUrl = caminho
        }
        const { error } = await supabase.from('solicitacoes_escala').insert({
          unidade_id: unidadeId, escala_plantao_id: p.id, perfil_id: perfil.id, tipo: 'justificar_falta',
          tipo_falta: tipoFalta, justificativa: texto.trim() || null, anexo_url: anexoUrl, criado_por: perfil.id,
        })
        if (error) throw error
        onFeito('Justificativa enviada à coordenação.')
      }
      void qc.invalidateQueries({ queryKey: ['solicitacoes-escala'] })
      void qc.invalidateQueries({ queryKey: ['trocas-equipe'] })
      void qc.invalidateQueries({ queryKey: ['escala-equipe'] })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o pedido.')
    } finally {
      setSalvando(false)
    }
  }

  const titulo = janela?.tipo === 'trocar' ? 'Trocar plantão' : janela?.tipo === 'passar' ? 'Passar plantão' : 'Justificar falta'
  const pode = janela?.tipo === 'trocar' ? !!outro : janela?.tipo === 'passar' ? !!destino : true
  const rotuloPlantao = (e: PlantaoEquipe) => `${dataPorExtenso(`${e.data}T12:00:00Z`)} · ${faixa(e)} · ${nomeSetor(e.setor_id)}`

  return (
    <Dialog open={!!janela} onOpenChange={(v) => { if (!v) onFechar() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{p ? `Seu plantão: ${rotuloPlantao(p)}, ${hora(p.inicio)}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {janela?.tipo === 'trocar' && (
            <div className="flex flex-col gap-1.5">
              <Label>Plantão do colega (só da sua categoria)</Label>
              <Select value={outro || null} onValueChange={(v) => setOutro(v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder={plantoesDosColegas.length ? 'Selecione' : 'Nenhum plantão de colega neste mês'} /></SelectTrigger>
                <SelectContent>
                  {plantoesDosColegas.map((e) => <SelectItem key={e.id} value={e.id}>{rotuloPlantao(e)} — {e.nome_completo ?? 'Colega'}</SelectItem>)}
                </SelectContent>
              </Select>
              {escolhido && (
                <p className="rounded-controle bg-campo px-3 py-2 text-apoio text-tinta">
                  Se o colega aceitar e a coordenação aprovar, você fica com o plantão de {ddmm(escolhido.data)} e {escolhido.nome_completo ?? 'o colega'} com o de {ddmm(p!.data)}.
                </p>
              )}
            </div>
          )}
          {janela?.tipo === 'passar' && (
            <div className="flex flex-col gap-1.5">
              <Label>Passar para (só da sua categoria)</Label>
              <Select value={destino || null} onValueChange={(v) => setDestino(v ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o colega" /></SelectTrigger>
                <SelectContent>
                  {destinos.map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
              {colegas.isLoading && <Spinner />}
            </div>
          )}
          {janela?.tipo === 'falta' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Motivo</Label>
                <Select value={tipoFalta} onValueChange={(v) => setTipoFalta((v ?? 'atestado_medico') as typeof tipoFalta)}>
                  <SelectTrigger className="w-full"><SelectValue>{tipoFalta === 'atestado_medico' ? 'Atestado médico' : 'Licença maternidade'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atestado_medico">Atestado médico</SelectItem>
                    <SelectItem value="licenca_maternidade">Licença maternidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="falta-anexo">Anexo (opcional)</Label>
                <Input id="falta-anexo" type="file" accept="image/*,application/pdf" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pedido-texto">{janela?.tipo === 'falta' ? 'Justificativa' : 'Mensagem'} (opcional)</Label>
            <Textarea id="pedido-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} />
          </div>
          <p className="text-rotulo text-tinta-sussurro">{janela?.tipo === 'falta' ? 'O pedido vai para a coordenação da unidade, que aprova ou recusa. Você recebe o aviso.' : 'O colega recebe o aviso e aceita ou recusa; aceito, a coordenação aprova ou recusa. Até lá o plantão continua com você.'}</p>
          <MensagemErro texto={erro} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => void enviar()} disabled={!pode || salvando}>
            {salvando ? <Spinner /> : null} {janela?.tipo === 'trocar' ? 'Pedir troca' : janela?.tipo === 'passar' ? 'Pedir passagem' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VagasDoDia({ vagas, titulo = 'Vaga da sua categoria', comData = false }: { vagas: VagaAberta[]; titulo?: string; comData?: boolean }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState<string | null>(null)
  if (vagas.length === 0) return null
  async function candidatar(v: VagaAberta) {
    setErro(null); setEnviando(v.id)
    const { error } = await supabase.rpc('candidatar_vaga', { p_vaga: v.id })
    setEnviando(null)
    if (error) return setErro(error.message)
    void qc.invalidateQueries({ queryKey: ['vagas-equipe'] })
  }
  return (
    <div className="flex flex-col gap-2 border-b border-trilha px-4 py-2.5">
      <span className="text-rotulo font-semibold text-tinta-sussurro">{titulo}</span>
      {vagas.map((v) => (
        <span key={v.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-apoio">
          <span className="flex flex-col">
            <span className="text-tinta">{comData ? `${dataPorExtenso(`${v.data}T12:00:00Z`)} · ` : ''}{v.setor_nome}</span>
            <span className="text-rotulo text-tinta-sussurro tabular-nums">{hora(v.inicio)}–{hora(v.fim)}{v.parte ? ` · parte ${v.parte} de ${v.partes}` : ''}</span>
          </span>
          {v.minha_candidatura ? (
            <Estado tom={TOM[v.minha_candidatura] ?? 'cinza'}>{v.minha_candidatura === 'pendente' ? 'candidatura enviada' : ROTULO_ESTADO[v.minha_candidatura] ?? v.minha_candidatura}</Estado>
          ) : (
            <Button size="sm" variant="outline" disabled={enviando === v.id} onClick={() => void candidatar(v)}>
              {enviando === v.id ? <Spinner /> : null} Candidatar-me
            </Button>
          )}
        </span>
      ))}
      <MensagemErro texto={erro} />
    </div>
  )
}

export function SeusPedidos({ minhas, trocas, plantoes }: {
  minhas: ReturnType<typeof usePedidosDaEquipe>['minhas']; trocas: Troca[]; plantoes: PlantaoEquipe[]
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const dataDe = (id: string) => plantoes.find((x) => x.id === id)?.data
  // A4: passagem e troca esperam o colega e depois a coordenação; quem pediu cancela enquanto pendente
  const itens = [
    ...minhas.map((s) => ({
      id: s.id, troca: false, status: s.status, quando: s.created_at,
      espera: s.tipo === 'passar_plantao' && !s.aceito_em ? 'aguardando o colega' : 'aguardando a coordenação',
      texto: s.tipo === 'passar_plantao'
        ? `Passagem${s.escala_plantao ? ` de ${ddmm(s.escala_plantao.data)}` : ''}${s.destino ? ` para ${s.destino.nome_completo}` : ''}`
        : s.tipo === 'justificar_falta' ? `Falta${s.escala_plantao ? ` de ${ddmm(s.escala_plantao.data)}` : ''}` : `Saída do fixo`,
    })),
    // só as trocas que eu pedi; as que pedem o meu aceite ficam em Pedidos para você
    ...trocas.filter((t) => t.perfil_a_id === perfil?.id).map((t) => {
      const d = dataDe(t.plantao_a_id)
      return {
        id: t.id, troca: true, status: t.status, quando: t.created_at,
        espera: t.aceito_em ? 'aguardando a coordenação' : 'aguardando o colega',
        texto: `Troca${d ? ` do plantão de ${ddmm(d)}` : ''}`,
      }
    }),
  ].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 5)

  async function cancelar(i: (typeof itens)[number]) {
    setCancelando(i.id); setErro(null)
    const { error } = i.troca
      ? await supabase.rpc('cancelar_troca', { p_troca: i.id })
      : await supabase.rpc('cancelar_pedido_escala', { p_solicitacao: i.id })
    setCancelando(null)
    if (error) return setErro(error.message)
    void qc.invalidateQueries({ queryKey: ['solicitacoes-escala'] })
    void qc.invalidateQueries({ queryKey: ['trocas-equipe'] })
  }

  if (itens.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 px-4 py-2.5">
      <span className="text-rotulo font-semibold text-tinta-sussurro">Seus pedidos</span>
      {itens.map((i) => (
        <span key={i.id} className="flex flex-wrap items-baseline gap-x-2 text-apoio">
          <Estado tom={TOM[i.status] ?? 'cinza'}>{i.status === 'pendente' ? i.espera : ROTULO_ESTADO[i.status] ?? i.status}</Estado>
          <span className="text-tinta">{i.texto}</span>
          {i.status === 'pendente' && (
            <Button variant="link" size="xs" className="h-auto min-h-0 p-0 text-rotulo" disabled={cancelando === i.id} onClick={() => void cancelar(i)}>
              Cancelar
            </Button>
          )}
        </span>
      ))}
      <MensagemErro texto={erro} />
    </div>
  )
}
