// ─────────────────────────────────────────────────────────────────────────────
// Integrações › RNDS (Fase 5C, tarefa 5, etapa 5.4c; escolhas do RT de
// 29/10/2026, "todas a"). Referências do Refero: Lovable (domínio: estado no
// topo e números), Appwrite (envio do arquivo com aviso de segurança), Fibery
// (fila) e Enode (confirmação digitando o nome).
//
// • A faixa do topo mostra só o que pede ação (src/lib/rnds.ts, alertas).
// • O certificado A1 é cifrado neste navegador com a chave pública do serviço
//   no VPS (src/interop/rnds/cofre.ts); o banco recebe só o cifrado.
// • O gestor monta a credencial, envia o certificado, liga o envio, tira
//   bloqueios e cuida da fila. Passar para a produção, só o super admin.
// Banco: 20270206000001_rnds_cofre_banco.sql. Serviço: services/rnds-envio.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, RotateCw, Send, ShieldCheck, Upload } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { Aviso } from '@/components/ui/aviso'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { cifrarCertificado, type ChavePublica } from '@/interop/rnds/cofre'
import { data as dataCurta, dataHora, diaMesHora } from '@/lib/formato'
import {
  acaoDoItem, alertas, conferirArquivo, diasAte, FINANCIAMENTOS, formatarDocumento, motivoDoItem, ROTULO_CERTIFICADO,
  ROTULO_STATUS, ROTULO_TIPO, VARIANTE_CERTIFICADO, VARIANTE_STATUS, type AcaoAlerta, type ItemRnds, type PainelRnds, type StatusItem,
} from '@/lib/rnds'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const th = 'px-3 py-2 font-medium'
const td = 'px-3 py-2.5 align-top'

type Dialogo = 'certificado' | 'credencial' | 'ambiente' | null

export function RndsAba() {
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  const [dialogo, setDialogo] = React.useState<Dialogo>(null)
  const painel = useQuery({
    queryKey: ['rnds-painel', unidade],
    enabled: !!unidade,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rnds_painel', { p_unidade: unidade! })
      if (error) throw error
      return data as unknown as PainelRnds
    },
    // enquanto o serviço lê o certificado, a situação muda sozinha
    refetchInterval: (q) => (q.state.data?.credencial?.certificado.situacao === 'aguardando' ? 10_000 : 60_000),
  })
  const bloqueiosRef = React.useRef<HTMLDivElement>(null)

  if (!unidade) return <Vazio icone={Send} titulo="Escolha a unidade" texto="A RNDS é configurada por unidade." />
  // uma atualização que falha em segundo plano não apaga o que já está na tela
  if (!painel.data) return painel.error ? <MensagemErro texto={(painel.error as Error).message} /> : <Spinner />
  const p = painel.data

  function agir(a: AcaoAlerta) {
    if (a === 'certificado') setDialogo('certificado')
    else if (a === 'credencial') setDialogo('credencial')
    else if (a === 'bloqueios') bloqueiosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-apoio text-tinta-apoio">
        Os atendimentos da porta, os sumários de alta e as regulações saem para a RNDS do Ministério da Saúde, assinados com o certificado A1 da unidade.
      </p>
      <Faixa p={p} unidade={unidade} onAgir={agir} />
      {p.credencial && <Numeros p={p} />}
      <SecaoCredencial p={p} onDialogo={setDialogo} />
      {p.credencial && <SecaoEnvio p={p} unidade={unidade} />}
      {p.credencial && <div ref={bloqueiosRef}><SecaoBloqueios p={p} /></div>}
      <SecaoFila unidade={unidade} />
      {p.credencial && <EnviarCertificado aberto={dialogo === 'certificado'} credencialId={p.credencial.id} onFechar={() => setDialogo(null)} />}
      {/* montado só aberto: os campos nascem da credencial atual */}
      {dialogo === 'credencial' && <MontarCredencial p={p} unidade={unidade} onFechar={() => setDialogo(null)} />}
      {p.credencial && p.pode_producao && (
        <MudarAmbiente aberto={dialogo === 'ambiente'} credencial={p.credencial} onFechar={() => setDialogo(null)} />
      )}
    </div>
  )
}

function useRecarregar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['rnds-painel'] })
    void qc.invalidateQueries({ queryKey: ['rnds-itens'] })
  }
}

// ── faixa do topo: só o que pede ação ─────────────────────────────────────────
function Faixa({ p, unidade, onAgir }: { p: PainelRnds; unidade: string; onAgir: (a: AcaoAlerta) => void }) {
  const recarregar = useRecarregar()
  const retomar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rnds_retomar', { p_unidade: unidade })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const lista = alertas(p)
  if (lista.length === 0) return null
  const ROTULO: Record<AcaoAlerta, string> = { retomar: 'Retomar o envio', certificado: 'Enviar certificado', credencial: 'Montar credencial', bloqueios: 'Ver bloqueios' }
  return (
    <div className="flex flex-col gap-2">
      {lista.map((a) => (
        <Aviso key={a.titulo} tom={a.tom} titulo={a.titulo} anunciar={a.tom === 'critico'}
          acao={a.acao && (
            <Button size="xs" variant="outline" disabled={a.acao === 'retomar' && retomar.isPending}
              onClick={() => (a.acao === 'retomar' ? retomar.mutate() : onAgir(a.acao!))}>
              {ROTULO[a.acao]}
            </Button>
          )}>
          {a.texto}
        </Aviso>
      ))}
      {retomar.error && <MensagemErro texto={(retomar.error as Error).message} />}
    </div>
  )
}

// ── números ───────────────────────────────────────────────────────────────────
function Numeros({ p }: { p: PainelRnds }) {
  const c = p.credencial!.certificado
  const dias = c.valido_ate ? diasAte(c.valido_ate) : null
  const n = (s: StatusItem) => p.contagem[s] ?? 0
  const celulas: { rotulo: string; valor: string; tom?: 'atencao' | 'critico' }[] = [
    { rotulo: 'Certificado válido até', valor: c.valido_ate ? dataCurta(c.valido_ate) : '—', tom: dias == null ? undefined : dias <= 0 ? 'critico' : dias <= 30 ? 'atencao' : undefined },
    { rotulo: 'Na fila', valor: String(n('pendente')) },
    { rotulo: 'Retidos', valor: String(n('retido')), tom: n('retido') > 0 ? 'atencao' : undefined },
    { rotulo: 'Com erro', valor: String(n('erro')), tom: n('erro') > 0 ? 'critico' : undefined },
    { rotulo: 'Enviados', valor: String(n('enviado')) },
  ]
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-container border border-fio bg-campo sm:grid-cols-5">
      {celulas.map((x) => (
        <div key={x.rotulo} className="flex flex-col gap-1 border-fio px-4 py-3 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0">
          <span className="text-rotulo text-tinta-sussurro">{x.rotulo}</span>
          <span className={cn('tabular text-corpo font-semibold text-tinta', x.tom === 'atencao' && 'text-atencao', x.tom === 'critico' && 'text-critico')}>{x.valor}</span>
        </div>
      ))}
    </div>
  )
}

// ── credencial ────────────────────────────────────────────────────────────────
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-trilha py-2 last:border-0 sm:grid-cols-[minmax(0,180px)_1fr] sm:gap-3">
      <span className="text-tinta-sussurro">{rotulo}</span>
      <span className="min-w-0 text-tinta">{children}</span>
    </div>
  )
}

function SecaoCredencial({ p, onDialogo }: { p: PainelRnds; onDialogo: (d: Dialogo) => void }) {
  const k = p.credencial
  if (!k) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Credencial</CardTitle>
          <CardDescription>
            A credencial da RNDS é um certificado A1 e o identificador do solicitante que o DATASUS dá na aprovação. Uma credencial cobre a unidade principal e as filhas da mesma UF.
          </CardDescription>
        </CardHeader>
        <CardContent><Button size="sm" onClick={() => onDialogo('credencial')}>Montar credencial</Button></CardContent>
      </Card>
    )
  }
  const c = k.certificado
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-corpo">
            {k.nome}
            <Badge variant={k.ambiente === 'producao' ? 'default' : 'secondary'}>{k.ambiente === 'producao' ? 'Produção' : 'Homologação'}</Badge>
          </CardTitle>
          <CardDescription>Credencial da RNDS: o certificado e o identificador valem para todas as unidades abaixo.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onDialogo('credencial')}>Editar</Button>
          {p.pode_producao && (
            <Button size="sm" variant="outline" onClick={() => onDialogo('ambiente')}>
              {k.ambiente === 'producao' ? 'Voltar para a homologação' : 'Passar para a produção'}
            </Button>
          )}
          <Button size="sm" onClick={() => onDialogo('certificado')}><Upload className="size-4" aria-hidden />Enviar certificado</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col text-apoio">
        <Linha rotulo="Identificador do solicitante">{k.identificador_solicitante ?? <span className="text-atencao">não informado</span>}</Linha>
        <Linha rotulo="Unidades">
          {k.unidades.map((u) => (
            <span key={u.id} className="block">{u.nome}{u.cnes && <span className="tabular text-tinta-sussurro"> · CNES {u.cnes}</span>}{u.id === k.unidade_principal_id && <span className="text-tinta-sussurro"> · principal</span>}</span>
          ))}
        </Linha>
        <Linha rotulo="Certificado"><Badge variant={VARIANTE_CERTIFICADO[c.situacao]}>{ROTULO_CERTIFICADO[c.situacao]}</Badge></Linha>
        {c.titular && <Linha rotulo="Titular">{c.titular}</Linha>}
        {c.documento && <Linha rotulo="CNPJ ou CPF"><span className="tabular">{formatarDocumento(c.documento)}</span></Linha>}
        {c.valido_ate && <Linha rotulo="Válido até"><span className="tabular">{dataCurta(c.valido_ate)}</span></Linha>}
        {c.enviado_em && <Linha rotulo="Enviado em"><span className="tabular">{dataHora(c.enviado_em)}</span></Linha>}
        {c.erro && c.situacao !== 'valido' && <Linha rotulo="Leitura"><span className="text-critico">{c.erro}</span></Linha>}
      </CardContent>
    </Card>
  )
}

// ── envio ─────────────────────────────────────────────────────────────────────
function SecaoEnvio({ p, unidade }: { p: PainelRnds; unidade: string }) {
  const recarregar = useRecarregar()
  const [financiamento, setFinanciamento] = React.useState(p.config?.financiamento ?? '')
  const [ligado, setLigado] = React.useState(p.config?.envio_ligado ?? false)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rnds_salvar_config', { p_unidade: unidade, p_financiamento: financiamento || null, p_envio_ligado: ligado })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const mudou = financiamento !== (p.config?.financiamento ?? '') || ligado !== (p.config?.envio_ligado ?? false)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Envio desta unidade</CardTitle>
        <CardDescription>O financiamento vai em cada atendimento enviado. Com o envio desligado, os documentos esperam na fila.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex max-w-sm flex-col gap-1">
          <Label htmlFor="rnds-fin" className="text-rotulo">Financiamento (BRFinanciamento)</Label>
          <CampoSelecao id="rnds-fin" tamanho="compacto" value={financiamento} onChange={(e) => setFinanciamento(e.target.value)}>
            <option value="">Escolha</option>
            {FINANCIAMENTOS.map((f) => <option key={f.codigo} value={f.codigo}>{f.rotulo}</option>)}
          </CampoSelecao>
        </div>
        <CaixaMarcar marcado={ligado} onChange={() => setLigado((v) => !v)}>Envio ligado</CaixaMarcar>
        {p.config?.pausado_em && (
          <span className="text-critico">Pausado desde {diaMesHora(p.config.pausado_em)}: {p.config.pausa_motivo}</span>
        )}
        <Button size="sm" className="self-start" disabled={!mudou || salvar.isPending || (ligado && !financiamento)} onClick={() => salvar.mutate()}>Salvar</Button>
        {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

// ── bloqueios ─────────────────────────────────────────────────────────────────
function SecaoBloqueios({ p }: { p: PainelRnds }) {
  const recarregar = useRecarregar()
  const tirar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('rnds_desbloquear', { p_bloqueio: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Profissionais bloqueados</CardTitle>
        <CardDescription>
          A RNDS recusa o documento de quem não tem o CBO no CNES da unidade (ERR906 e ERR879). Acerte o cadastro no CNES e tire o bloqueio: os documentos retidos tentam de novo na hora.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col text-apoio">
        {p.bloqueios.length === 0 ? <span className="text-tinta-sussurro">Nenhum profissional bloqueado.</span> : p.bloqueios.map((b) => (
          <div key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-trilha py-2.5 last:border-0">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-tinta">{b.profissional ?? 'Profissional sem cadastro'} <span className="tabular text-tinta-sussurro">· {b.codigo} · desde {dataCurta(b.bloqueado_em)}</span></span>
              {b.mensagem && <span className="text-tinta-apoio">{b.mensagem}</span>}
            </div>
            <Button size="xs" variant="outline" disabled={tirar.isPending} onClick={() => tirar.mutate(b.id)}>Tirar o bloqueio</Button>
          </div>
        ))}
        {tirar.error && <MensagemErro texto={(tirar.error as Error).message} />}
      </CardContent>
    </Card>
  )
}

// ── fila ──────────────────────────────────────────────────────────────────────
const FILTROS: (StatusItem | 'todos')[] = ['todos', 'erro', 'retido', 'pendente', 'enviado']

function SecaoFila({ unidade }: { unidade: string }) {
  const recarregar = useRecarregar()
  const [filtro, setFiltro] = React.useState<StatusItem | 'todos'>('todos')
  const itens = useQuery({
    queryKey: ['rnds-itens', unidade, filtro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rnds_itens', { p_unidade: unidade, p_status: filtro === 'todos' ? null : filtro, p_limite: 50 })
      if (error) throw error
      return (data ?? []) as unknown as ItemRnds[]
    },
    refetchInterval: 60_000,
  })
  const reenviar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('rnds_reenviar', { p_item: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const lista = itens.data ?? []
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-corpo font-semibold text-tinta">Fila</h3>
        <span className="text-rotulo text-tinta-sussurro">os 50 mais recentes</span>
      </div>
      <Chips rotulo="Filtrar a fila">
        {FILTROS.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f === 'todos' ? 'Todos' : ROTULO_STATUS[f]}</Chip>)}
      </Chips>
      {itens.isLoading ? <Spinner /> : itens.error ? <MensagemErro texto={(itens.error as Error).message} /> : lista.length === 0 ? (
        <Vazio icone={Send} titulo="Nada aqui" texto="Nenhum documento nesta situação." />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[760px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className={th}>Documento</TableHead><TableHead className={th}>Situação</TableHead>
                <TableHead className={th}>Motivo</TableHead><TableHead className={th}>Quando</TableHead><TableHead className={th} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((i) => {
                const acao = acaoDoItem(i)
                return (
                  <TableRow key={i.id} className="border-b border-trilha last:border-0">
                    <TableCell className={cn(td, 'font-medium text-tinta')}>{ROTULO_TIPO[i.tipo]}</TableCell>
                    <TableCell className={td}><Badge variant={VARIANTE_STATUS[i.status]}>{ROTULO_STATUS[i.status]}</Badge></TableCell>
                    <TableCell className={cn(td, 'max-w-[380px] text-tinta-apoio')}>{motivoDoItem(i) ?? (i.status === 'enviado' ? <span className="tabular text-tinta-sussurro">id RNDS {i.id_rnds}</span> : '—')}</TableCell>
                    <TableCell className={cn(td, 'tabular whitespace-nowrap text-tinta-sussurro')}>
                      {i.enviado_em ? `enviado ${diaMesHora(i.enviado_em)}` : i.status !== 'enviado' && i.proxima_tentativa_em ? `tenta ${diaMesHora(i.proxima_tentativa_em)}` : `criado ${diaMesHora(i.criado_em)}`}
                    </TableCell>
                    <TableCell className={cn(td, 'text-right')}>
                      {acao && <Button size="xs" variant="outline" disabled={reenviar.isPending} onClick={() => reenviar.mutate(i.id)}><RotateCw className="size-3.5" aria-hidden />{acao.rotulo}</Button>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {reenviar.error && <MensagemErro texto={(reenviar.error as Error).message} />}
    </section>
  )
}

// ── enviar o certificado (cifrado aqui) ───────────────────────────────────────
function EnviarCertificado({ aberto, credencialId, onFechar }: { aberto: boolean; credencialId: string; onFechar: () => void }) {
  const recarregar = useRecarregar()
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [senha, setSenha] = React.useState('')
  const [arrastando, setArrastando] = React.useState(false)
  const entrada = React.useRef<HTMLInputElement>(null)
  const chave = useQuery({
    queryKey: ['rnds-chave-publica'],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rnds_chave_publica')
      if (error) throw error
      return (data ?? null) as unknown as ChavePublica | null
    },
  })
  const problema = arquivo ? conferirArquivo(arquivo) : null
  const enviar = useMutation({
    mutationFn: async () => {
      if (!chave.data) throw new Error('O serviço da RNDS ainda não publicou a chave. Tente de novo em alguns minutos.')
      const cifrado = await cifrarCertificado(chave.data, credencialId, { pfx: new Uint8Array(await arquivo!.arrayBuffer()), senha })
      const { error } = await supabase.rpc('rnds_enviar_certificado', { p_credencial: credencialId, p_cifrado: cifrado })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); fechar() },
  })
  function fechar() {
    setArquivo(null); setSenha(''); enviar.reset(); onFechar()
  }
  function escolher(f: File | undefined) {
    if (f) setArquivo(f)
  }
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar o certificado A1</DialogTitle>
          <DialogDescription>O arquivo .pfx (ou .p12) e a senha do certificado da credencial. O certificado novo substitui o anterior.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-apoio">
          {/* padrao-ok: área de soltar o arquivo (arrastar ou clicar); não há peça de base para upload */}
          <button type="button"
            className={cn('flex flex-col items-center gap-1.5 rounded-container border border-dashed border-fio bg-campo px-4 py-6 text-center text-tinta-apoio transition-colors hover:border-acao/50',
              arrastando && 'border-acao bg-alerta-marca')}
            onClick={() => entrada.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer.files[0]) }}>
            <Upload className="size-5 text-tinta-sussurro" aria-hidden />
            {arquivo ? <span className="font-medium text-tinta">{arquivo.name}</span> : <span>Arraste o arquivo aqui ou clique para escolher</span>}
          </button>
          <input ref={entrada} type="file" accept=".pfx,.p12,application/x-pkcs12" className="sr-only" aria-label="Arquivo do certificado"
            onChange={(e) => escolher(e.target.files?.[0])} />
          {problema && <span className="text-rotulo text-critico">{problema}</span>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rnds-senha">Senha do certificado</Label>
            <Input id="rnds-senha" type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <Aviso tom="informacao" icone={Lock} titulo="Cifrado neste navegador">
            O arquivo e a senha são cifrados aqui, antes de sair do computador. Só o serviço da RNDS, no servidor do Chefe Coruja, consegue abri-los: nem o banco nem a equipe veem o certificado.
          </Aviso>
          {chave.isSuccess && !chave.data && <MensagemErro texto="O serviço da RNDS ainda não publicou a chave. Tente de novo em alguns minutos." />}
          {enviar.error && <MensagemErro texto={(enviar.error as Error).message} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button disabled={!arquivo || !!problema || !senha || !chave.data || enviar.isPending} onClick={() => enviar.mutate()}>
            <ShieldCheck className="size-4" aria-hidden />Cifrar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── montar ou editar a credencial ─────────────────────────────────────────────
function MontarCredencial({ p, unidade, onFechar }: { p: PainelRnds; unidade: string; onFechar: () => void }) {
  const { vinculos, unidadeAtiva } = useUnidade()
  const recarregar = useRecarregar()
  const k = p.credencial
  const principal = k?.unidade_principal_id ?? unidade
  // as filhas possíveis: as unidades em que a pessoa é gestora (o banco confere a UF)
  const opcoes = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const v of vinculos) if (v.papel === 'gestor' && v.unidade_id !== principal) m.set(v.unidade_id, v.unidade.nome)
    for (const u of k?.unidades ?? []) if (u.id !== principal) m.set(u.id, u.nome)
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [vinculos, k, principal])
  const [nome, setNome] = React.useState(k?.nome ?? unidadeAtiva?.unidade.nome ?? '')
  const [identificador, setIdentificador] = React.useState(k?.identificador_solicitante ?? '')
  const [filhas, setFilhas] = React.useState<string[]>(() => (k?.unidades ?? []).map((u) => u.id).filter((id) => id !== principal))
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rnds_salvar_credencial', {
        p_credencial: k?.id ?? null, p_nome: nome.trim(), p_unidade_principal: principal,
        p_identificador: identificador.trim() || null, p_unidades: filhas,
      })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); onFechar() },
  })
  const identificadorRuim = identificador.trim() !== '' && !/^[0-9A-Za-z]+$/.test(identificador.trim())
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{k ? 'Editar a credencial' : 'Montar a credencial'}</DialogTitle>
          <DialogDescription>
            A credencial nasce na homologação da RNDS. As unidades filhas usam o mesmo certificado e precisam ser da mesma UF da principal.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-apoio">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rnds-nome">Nome</Label>
            <Input id="rnds-nome" placeholder="ex.: UPA Central e filhas" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rnds-id">Identificador do solicitante (dado pelo DATASUS na aprovação)</Label>
            <Input id="rnds-id" inputMode="text" aria-invalid={identificadorRuim} value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
            {identificadorRuim && <span className="text-rotulo text-critico">Só letras e números.</span>}
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-rotulo text-tinta-apoio">Unidades filhas</legend>
            {opcoes.length === 0 ? <span className="text-tinta-sussurro">Você não é gestor de outra unidade.</span>
              : opcoes.map((u) => (
                <CaixaMarcar key={u.id} marcado={filhas.includes(u.id)}
                  onChange={() => setFilhas((v) => (v.includes(u.id) ? v.filter((x) => x !== u.id) : [...v, u.id]))}>{u.nome}</CaixaMarcar>
              ))}
          </fieldset>
          {salvar.error && <MensagemErro texto={(salvar.error as Error).message} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={nome.trim().length < 3 || identificadorRuim || salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── ambiente (só o super admin): confirma digitando o nome ────────────────────
function MudarAmbiente({ aberto, credencial, onFechar }: { aberto: boolean; credencial: NonNullable<PainelRnds['credencial']>; onFechar: () => void }) {
  const recarregar = useRecarregar()
  const [digitado, setDigitado] = React.useState('')
  const paraProducao = credencial.ambiente === 'homologacao'
  const mudar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rnds_definir_ambiente', { p_credencial: credencial.id, p_ambiente: paraProducao ? 'producao' : 'homologacao' })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); fechar() },
  })
  function fechar() {
    setDigitado(''); mudar.reset(); onFechar()
  }
  const confere = !paraProducao || digitado.trim() === credencial.nome
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{paraProducao ? 'Passar para a produção' : 'Voltar para a homologação'}</DialogTitle>
          <DialogDescription>
            {paraProducao
              ? 'Os documentos das unidades desta credencial passam a ir para a RNDS de verdade, em nome dos profissionais. Faça isso só depois da homologação aprovada pelo DATASUS.'
              : 'Os documentos voltam a ir para a homologação da RNDS.'}
          </DialogDescription>
        </DialogHeader>
        {paraProducao && (
          <div className="flex flex-col gap-1.5 text-apoio">
            <Label htmlFor="rnds-conf">Digite <span className="font-semibold text-tinta">{credencial.nome}</span> para confirmar</Label>
            <Input id="rnds-conf" autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value)} />
          </div>
        )}
        {mudar.error && <MensagemErro texto={(mudar.error as Error).message} />}
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button variant={paraProducao ? 'destructive' : 'default'} disabled={!confere || mudar.isPending} onClick={() => mudar.mutate()}>
            {paraProducao ? 'Passar para a produção' : 'Voltar para a homologação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
