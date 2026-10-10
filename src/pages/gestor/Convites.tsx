import * as React from 'react'
import { Check, Copy, MailPlus, Ticket, TicketX } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { useSetores } from '@/hooks/useDadosUnidade'
import { useConvites, useGerarConvite, useRevogarConvite, type ConviteDaUnidade, type SituacaoConvite } from '@/hooks/useConvites'
import { PAPEL_DESCRIPTION, PAPEL_LABEL } from '@/lib/constants'
import { formatarDiaHora, formatarPlantao } from '@/lib/primeiroAcesso'
import { cn } from '@/lib/utils'
import type { Papel } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Chip, Chips, TituloSecao, Vazio } from '@/components/monitor/Pagina'

// Convites da unidade (protótipo primeiro-acesso.html, lado do gestor): o
// código CC-XXXXX é gerado no servidor, vale 7 dias por padrão e abre UM
// acesso, na unidade e no papel escolhidos. Gestão e administração não entram
// por convite — entram pelo contrato da rede.

const PAPEIS_CONVITE: Papel[] = ['plantonista', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico', 'recepcao', 'telemedicina', 'regulador', 'faturamento']
const VALIDADES: Record<string, string> = { '2': '2 dias', '7': '7 dias', '14': '14 dias', '30': '30 dias' }

const SITUACAO: Record<SituacaoConvite, { rotulo: string; variante: 'info' | 'success' | 'warning' | 'secondary' }> = {
  valido: { rotulo: 'Aguardando', variante: 'info' },
  usado: { rotulo: 'Usado', variante: 'success' },
  expirado: { rotulo: 'Expirado', variante: 'warning' },
  revogado: { rotulo: 'Revogado', variante: 'secondary' },
}

type Filtro = 'abertos' | 'todos'

function useCopiar() {
  const [copiado, setCopiado] = React.useState<string | null>(null)
  const copiar = React.useCallback(async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(codigo)
      setTimeout(() => setCopiado((c) => (c === codigo ? null : c)), 2000)
    } catch {
      window.prompt('Copie o código:', codigo)
    }
  }, [])
  return { copiado, copiar }
}

function LinhaConvite({ c, onCopiar, copiado, onRevogar, onRenovar }: {
  c: ConviteDaUnidade
  onCopiar: () => void
  copiado: boolean
  onRevogar: () => void
  onRenovar: () => void
}) {
  const sit = SITUACAO[c.situacao as SituacaoConvite] ?? SITUACAO.revogado
  const plantao = formatarPlantao(c.primeiro_plantao_inicio, c.primeiro_plantao_fim)
  let validade: string
  if (c.situacao === 'usado') validade = `Usado${c.usado_por_nome ? ` por ${c.usado_por_nome}` : ''} em ${formatarDiaHora(c.usado_em)}`
  else if (c.situacao === 'revogado') validade = `Revogado em ${formatarDiaHora(c.revogado_em)}`
  else if (c.situacao === 'expirado') validade = `Venceu em ${formatarDiaHora(c.expira_em)}`
  else validade = `Vale até ${formatarDiaHora(c.expira_em)}`

  return (
    <li className="grid grid-cols-1 gap-3 rounded-container border border-fio bg-superficie px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('tabular text-corpo font-semibold tracking-[0.12em] text-tinta', c.situacao !== 'valido' && 'text-tinta-sussurro line-through decoration-fio-forte')}>
            {c.codigo}
          </span>
          <Badge variant={sit.variante}>{sit.rotulo}</Badge>
          {c.situacao === 'expirado' && c.novo_pedido_em && (
            <Badge variant="default">Pediu novo {formatarDiaHora(c.novo_pedido_em)}</Badge>
          )}
        </div>
        <p className="mt-1 text-apoio text-tinta-apoio">
          <span className="font-medium text-tinta">{PAPEL_LABEL[c.papel]}</span>
          {c.setor_nome && <> · {c.setor_nome}</>}
          {c.para_quem && <> · para {c.para_quem}</>}
          {plantao && <> · primeiro plantão {plantao}</>}
        </p>
        <p className="mt-0.5 text-rotulo text-tinta-sussurro">
          {validade}
          {c.criado_por_nome && <> · gerado por {c.criado_por_nome}</>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {c.situacao === 'valido' && (
          <>
            <Button variant="outline" size="sm" onClick={onCopiar} aria-live="polite">
              {copiado ? <Check /> : <Copy />}
              {copiado ? 'Copiado' : 'Copiar código'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onRevogar}>
              <TicketX />
              Revogar
            </Button>
          </>
        )}
        {c.situacao === 'expirado' && (
          <Button variant="outline" size="sm" onClick={onRenovar}>
            <MailPlus />
            Gerar outro
          </Button>
        )}
      </div>
    </li>
  )
}

type Rascunho = {
  papel: Papel | null
  setorId: string
  paraQuem: string
  inicio: string
  fim: string
  validade: string
}

const RASCUNHO_VAZIO: Rascunho = { papel: null, setorId: '', paraQuem: '', inicio: '', fim: '', validade: '7' }

export default function Convites() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade.id
  const convites = useConvites(unidadeId)
  const setores = useSetores(unidadeId)
  const gerar = useGerarConvite(unidadeId)
  const revogar = useRevogarConvite(unidadeId)
  const { copiado, copiar } = useCopiar()

  const [filtro, setFiltro] = React.useState<Filtro>('abertos')
  const [dialogo, setDialogo] = React.useState(false)
  const [rascunho, setRascunho] = React.useState<Rascunho>(RASCUNHO_VAZIO)
  const [gerado, setGerado] = React.useState<{ codigo: string; expira_em: string } | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aRevogar, setARevogar] = React.useState<ConviteDaUnidade | null>(null)

  const lista = convites.data ?? []
  const abertos = lista.filter((c) => c.situacao === 'valido' || (c.situacao === 'expirado' && c.novo_pedido_em))
  const visiveis = filtro === 'abertos' ? abertos : lista
  const setoresAtivos = (setores.data ?? []).filter((s) => s.ativo)

  function abrir(base?: Partial<Rascunho>) {
    setRascunho({ ...RASCUNHO_VAZIO, ...base })
    setGerado(null)
    setErro(null)
    gerar.reset()
    setDialogo(true)
  }

  function inicioIso(v: string) {
    return v ? new Date(v).toISOString() : null
  }

  async function onGerar(e: React.FormEvent) {
    e.preventDefault()
    if (!rascunho.papel) {
      setErro('Escolha o papel.')
      return
    }
    setErro(null)
    let fim: string | null = null
    if (rascunho.inicio && rascunho.fim) {
      // fim é só a hora; se for menor que o início, o plantão vira a noite
      const ini = new Date(rascunho.inicio)
      const [h, m] = rascunho.fim.split(':').map(Number)
      const f = new Date(ini)
      f.setHours(h, m, 0, 0)
      if (f <= ini) f.setDate(f.getDate() + 1)
      fim = f.toISOString()
    }
    try {
      const r = await gerar.mutateAsync({
        papel: rascunho.papel,
        setorId: rascunho.setorId || null,
        paraQuem: rascunho.paraQuem,
        primeiroInicio: inicioIso(rascunho.inicio),
        primeiroFim: fim,
        validadeDias: Number(rascunho.validade),
      })
      setGerado({ codigo: r.codigo, expira_em: r.expira_em })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para gerar o convite.')
    }
  }

  async function onRevogar() {
    if (!aRevogar) return
    try {
      await revogar.mutateAsync(aRevogar.id)
      setARevogar(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para revogar.')
      setARevogar(null)
    }
  }

  const itensPapel = Object.fromEntries(PAPEIS_CONVITE.map((p) => [p, PAPEL_LABEL[p]]))
  const itensSetor = { qualquer: 'Qualquer setor', ...Object.fromEntries(setoresAtivos.map((s) => [s.id, s.nome])) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <TituloSecao className="mb-1">Convites</TituloSecao>
          <p className="text-apoio text-tinta-sussurro">
            O primeiro acesso de plantonista, enfermagem, farmácia, recepção e telemedicina nasce de um convite desta unidade.
            Cada código abre um acesso só, no papel escolhido. Gestão entra pelo contrato da rede.
          </p>
        </div>
        <Button onClick={() => abrir()} disabled={!unidadeId}>
          <Ticket />
          Gerar convite
        </Button>
      </div>

      {erro && !dialogo && <p role="alert" className="text-apoio text-critico">{erro}</p>}

      <Chips rotulo="Filtrar convites">
        <Chip ativo={filtro === 'abertos'} onClick={() => setFiltro('abertos')} contagem={abertos.length}>Em aberto</Chip>
        <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} contagem={lista.length}>Todos</Chip>
      </Chips>

      {convites.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : convites.error ? (
        <p className="text-apoio text-critico">Falha ao carregar os convites: {convites.error.message}</p>
      ) : visiveis.length === 0 ? (
        <Vazio
          icone={Ticket}
          titulo={filtro === 'abertos' ? 'Nenhum convite em aberto' : 'Nenhum convite gerado'}
          texto="Gere um convite e passe o código para a pessoa. Ela ativa o acesso em Primeiro acesso, na tela de entrada."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((c) => (
            <LinhaConvite
              key={c.id}
              c={c}
              copiado={copiado === c.codigo}
              onCopiar={() => void copiar(c.codigo)}
              onRevogar={() => setARevogar(c)}
              onRenovar={() => abrir({ papel: c.papel, setorId: c.setor_id ?? '', paraQuem: c.para_quem ?? '' })}
            />
          ))}
        </ul>
      )}

      {/* ── gerar ── */}
      <Dialog open={dialogo} onOpenChange={(o) => { setDialogo(o); if (!o) setErro(null) }}>
        <DialogContent className="max-w-md">
          {gerado ? (
            <>
              <DialogHeader>
                <DialogTitle>Convite gerado</DialogTitle>
                <DialogDescription>
                  Passe o código para a pessoa. Ele vale até {formatarDiaHora(gerado.expira_em)} e abre um acesso só.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 rounded-container border border-[#B7DED8] bg-[#ECF7F5] px-4 py-5">
                <span className="tabular text-[28px] font-semibold tracking-[0.16em] text-acao-pressionada">{gerado.codigo}</span>
                <Button variant="outline" onClick={() => void copiar(gerado.codigo)}>
                  {copiado === gerado.codigo ? <Check /> : <Copy />}
                  {copiado === gerado.codigo ? 'Copiado' : 'Copiar código'}
                </Button>
              </div>
              <p className="text-apoio text-tinta-sussurro">
                A pessoa entra em <b className="font-medium text-tinta">Primeiro acesso</b>, digita o código, confere a unidade e cria a senha.
              </p>
              <DialogFooter>
                <Button onClick={() => setDialogo(false)}>Pronto</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={onGerar} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Gerar convite</DialogTitle>
                <DialogDescription>Para {unidadeAtiva?.unidade.nome}. O código é gerado no servidor.</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-1.5">
                <Label>Papel</Label>
                <Select items={itensPapel} value={rascunho.papel} onValueChange={(v) => setRascunho((r) => ({ ...r, papel: (v as Papel) ?? null }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Escolha o papel" /></SelectTrigger>
                  <SelectContent>
                    {PAPEIS_CONVITE.map((p) => (
                      <SelectItem key={p} value={p}>
                        <div className="flex flex-col gap-0.5">
                          <span>{PAPEL_LABEL[p]}</span>
                          <span className="text-rotulo text-tinta-sussurro">{PAPEL_DESCRIPTION[p]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Setor <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
                <Select items={itensSetor} value={rascunho.setorId || 'qualquer'} onValueChange={(v) => setRascunho((r) => ({ ...r, setorId: !v || v === 'qualquer' ? '' : (v as string) }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer setor</SelectItem>
                    {setoresAtivos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cv-para">Para quem <span className="font-normal text-tinta-sussurro">(opcional, só para a sua lista)</span></Label>
                <Input id="cv-para" maxLength={120} placeholder="Ex.: Dra. Helena Barros" value={rascunho.paraQuem}
                  onChange={(e) => setRascunho((r) => ({ ...r, paraQuem: e.target.value }))} />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cv-ini">Primeiro plantão <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
                  <Input id="cv-ini" type="datetime-local" value={rascunho.inicio}
                    onChange={(e) => setRascunho((r) => ({ ...r, inicio: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cv-fim">Até</Label>
                  <Input id="cv-fim" type="time" value={rascunho.fim} disabled={!rascunho.inicio}
                    onChange={(e) => setRascunho((r) => ({ ...r, fim: e.target.value }))} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Validade</Label>
                <Select items={VALIDADES} value={rascunho.validade} onValueChange={(v) => setRascunho((r) => ({ ...r, validade: (v as string) ?? '7' }))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VALIDADES).map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogo(false)}>Cancelar</Button>
                <Button type="submit" disabled={gerar.isPending}>{gerar.isPending ? <Spinner /> : 'Gerar convite'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── revogar ── */}
      <Dialog open={!!aRevogar} onOpenChange={(o) => { if (!o) setARevogar(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar {aRevogar?.codigo}?</DialogTitle>
            <DialogDescription>
              O código deixa de valer na hora. Quem tentar usá-lo vê "convite cancelado pela unidade".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARevogar(null)}>Manter</Button>
            <Button variant="destructive" onClick={() => void onRevogar()} disabled={revogar.isPending}>
              <TicketX />
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
