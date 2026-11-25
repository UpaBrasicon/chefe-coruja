import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building, ChevronDown, ChevronRight, Landmark, Network, Plus, Search, X } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Vazio } from '@/components/monitor/Pagina'
import { cartao } from '@/components/admin/ui'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { DesignarGestor } from '@/pages/admin/DesignarGestor'
import { JanelaUnidade, type NovaUnidadeInicial } from '@/pages/admin/JanelaUnidade'
import { PAPEL_LABEL, TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { avaliarUnidade, useUnidadesRede, type UnidadeCadastro } from '@/lib/dadosAdmin'
import {
  ESFERAS, montarArvore, normalizar, quemDesigna, RAMO_ROTULO, RAMO_SINGULAR, RAMOS, resumoRamos, tipoDoRamo, totalPessoas,
  type Esfera, type GalhoSecretaria, type OrganizacaoRede, type Ramo, type SecretariaRede, type UnidadeNaRede,
} from '@/lib/redeSecretaria'
import { pessoasDaUnidade, resumoEstado, type EstadoUnidade } from '@/lib/secretariaCompleta'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Papel, TipoUnidade } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Rede a partir da Secretaria (pedido do RT, 24/11/2026; desenho mestre-detalhe
// aprovado no Refero). A árvore Secretaria → ramo (Hospitais, UPAs, UBS,
// Clínicas, Ambulatórios, Centrais de regulação) → unidade ocupa a página,
// aberta; a ficha do que se escolhe abre numa gaveta à direita (tela cheia no
// celular), sem sair da página nem perder o lugar na árvore.
//
// Dois modos:
// • admin (Rede › Secretarias): cria e edita a secretaria, escolhe as unidades
//   dela, cria unidade já dentro dela, designa as pessoas da secretaria;
// • secretaria (perfil Gestor da secretaria, /secretaria): a mesma árvore só
//   com as secretarias da pessoa; a ficha leva à configuração e à escala da
//   unidade.
// Lista longa = busca com seleção em fichas (nada de parede de checkbox).
// Banco: migrations 20270421000020 e 20270421000023.
// ─────────────────────────────────────────────────────────────────────────────

// prefixo 'admin-unidades': quando a janela da unidade salva, a árvore relê junto
const CHAVE = ['admin-unidades', 'rede-arvore'] as const
const CHAVE_PESSOAS = ['admin-unidades', 'secretaria-pessoas'] as const

export type ModoRede = 'admin' | 'secretaria'
type Escolha = { tipo: 'secretaria'; id: string } | { tipo: 'unidade'; id: string } | { tipo: 'sem'; org: string }

const ESFERA_ROTULO = Object.fromEntries(ESFERAS.map((e) => [e.valor, e.rotulo])) as Record<Esfera, string>
const tipoRotulo = (t: string) => TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? t
const lugarDe = (x: { municipio: string | null; uf: string | null }) => [x.municipio, x.uf].filter(Boolean).join('/')
// selo e fichas em caixa normal (RT, 24/11/2026: "Médico 2", "Ativa")
const SELO = 'normal-case tracking-normal'

function useArvore(modo: ModoRede) {
  return useQuery({
    queryKey: [...CHAVE, modo],
    queryFn: async () => {
      if (modo === 'secretaria') {
        const { data, error } = await supabase.rpc('rede_arvore_da_secretaria')
        if (error) throw error
        return (data ?? []) as unknown as OrganizacaoRede[]
      }
      const { data, error } = await supabase.rpc('admin_rede_arvore')
      if (error) throw error
      return (data ?? []) as unknown as OrganizacaoRede[]
    },
  })
}

// Perfil Gestor da secretaria (SE1 e SE2, RT 24/11/2026): o estado de cada
// unidade agora, com as pessoas contadas uma vez (secretaria_estado_unidades,
// migration 20270421000080). Sem a função no banco, a árvore segue como antes.
const EstadosDaRede = React.createContext<Map<string, EstadoUnidade> | null>(null)

function useEstados(ligado: boolean) {
  return useQuery({
    queryKey: ['secretaria-estado-unidades'],
    enabled: ligado,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_estado_unidades')
      if (error) throw error
      return new Map(((data ?? []) as unknown as EstadoUnidade[]).map((e) => [e.id, e]))
    },
  })
}

export function RedeSecretaria({ modo = 'admin' }: { modo?: ModoRede } = {}) {
  const admin = modo === 'admin'
  const arvore = useArvore(modo)
  const estados = useEstados(!admin)
  const orgs = React.useMemo(() => arvore.data ?? [], [arvore.data])
  const [busca, setBusca] = React.useState('')
  const galhos = React.useMemo(() => montarArvore(orgs, busca).filter((g) => admin || g.secretaria), [orgs, busca, admin])
  const [aberta, setAberta] = React.useState<Escolha | null>(null)
  const [janela, setJanela] = React.useState<{ secretaria: SecretariaRede | null } | null>(null)
  const [novaUnidade, setNovaUnidade] = React.useState<NovaUnidadeInicial | null>(null)
  const [editarUnidade, setEditarUnidade] = React.useState<UnidadeCadastro | null>(null)

  const variasOrgs = orgs.length > 1

  return (
    <EstadosDaRede.Provider value={estados.data ?? null}>
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
          <Input
            aria-label="Buscar secretaria ou unidade"
            placeholder="Buscar secretaria ou unidade (nome, município ou CNES)"
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {admin && (
          <Button size="sm" disabled={orgs.length === 0} onClick={() => setJanela({ secretaria: null })}>
            <Plus className="size-4" aria-hidden />Nova secretaria
          </Button>
        )}
      </div>

      {arvore.error && <MensagemErro erro={arvore.error} acao="carregar a rede" />}
      {arvore.isLoading && <Spinner />}
      {arvore.data && orgs.length === 0 && (
        <Vazio icone={Network} titulo="Nenhuma organização visível" texto="O administrador vê a rede das organizações em que tem vínculo de administrador." />
      )}

      {orgs.length > 0 && (
        <nav aria-label="Árvore da rede" className={cartao}>
          {galhos.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Nada encontrado para essa busca.</p>}
          {galhos.map((g, i) => (
            <React.Fragment key={g.chave}>
              {variasOrgs && (i === 0 || galhos[i - 1].organizacao.id !== g.organizacao.id) && (
                <p className="border-b border-trilha bg-campo px-4 py-2 text-rotulo font-semibold text-tinta-sussurro">{g.organizacao.nome}</p>
              )}
              <Galho
                galho={g}
                escolha={aberta}
                admin={admin}
                onEscolher={setAberta}
                onNovaUnidade={setNovaUnidade}
                abertoSempre={!!busca.trim()}
              />
            </React.Fragment>
          ))}
        </nav>
      )}

      <Gaveta aberta={!!aberta} onAbertaChange={(v) => { if (!v) setAberta(null) }} rotulo="Ficha da rede" className="max-w-[600px]">
        {aberta && (
          <Ficha
            escolha={aberta}
            orgs={orgs}
            modo={modo}
            onEscolher={setAberta}
            onEditarSecretaria={(s) => setJanela({ secretaria: s })}
            onEditarUnidade={setEditarUnidade}
            onNovaUnidade={setNovaUnidade}
          />
        )}
      </Gaveta>

      {admin && (
        <>
          <JanelaSecretaria
            aberto={!!janela}
            secretaria={janela?.secretaria ?? null}
            orgs={orgs}
            onFechar={() => setJanela(null)}
            onCriada={(id) => setAberta({ tipo: 'secretaria', id })}
          />
          <JanelaUnidade
            aberto={!!novaUnidade || !!editarUnidade}
            unidade={editarUnidade}
            inicial={novaUnidade}
            onFechar={() => { setNovaUnidade(null); setEditarUnidade(null) }}
          />
        </>
      )}
    </div>
    </EstadosDaRede.Provider>
  )
}

// ── árvore ──────────────────────────────────────────────────────────────────

function Galho({ galho, escolha, admin, onEscolher, onNovaUnidade, abertoSempre }: {
  galho: GalhoSecretaria; escolha: Escolha | null; admin: boolean; onEscolher: (e: Escolha) => void
  onNovaUnidade: (i: NovaUnidadeInicial) => void; abertoSempre: boolean
}) {
  // abre tudo aberto: secretaria e grupos (RT, 24/11/2026)
  const [aberto, setAberto] = React.useState(true)
  const [fechados, setFechados] = React.useState<Set<Ramo>>(new Set())
  const estados = React.useContext(EstadosDaRede)
  const s = galho.secretaria
  const ativo = s ? escolha?.tipo === 'secretaria' && escolha.id === s.id : escolha?.tipo === 'sem' && escolha.org === galho.organizacao.id
  const mostra = aberto || abertoSempre
  const Seta = mostra ? ChevronDown : ChevronRight
  const podeCriar = admin && !!s?.ativo
  const nova = (ramo: Ramo | null) => onNovaUnidade({
    organizacao_id: galho.organizacao.id, tipo: tipoDoRamo(ramo), ramo,
    secretaria: s ? { id: s.id, nome: s.nome } : null,
  })
  const gestao = s?.gestao ?? []
  return (
    <div className="border-b border-trilha last:border-0">
      <div className={cn('flex items-center gap-1 pr-3 pl-1', ativo && 'bg-acao/10')}>
        <Button
          variant="ghost" size="icon" className="shrink-0"
          aria-label={mostra ? 'Recolher' : 'Abrir'} aria-expanded={mostra}
          onClick={() => setAberto((v) => !v)}
        >
          <Seta className="size-4" aria-hidden />
        </Button>
        <BotaoLinha
          variante="linha"
          aria-current={ativo ? 'true' : undefined}
          onClick={() => onEscolher(s ? { tipo: 'secretaria', id: s.id } : { tipo: 'sem', org: galho.organizacao.id })}
          className="min-w-0 flex-1 flex-col gap-0.5 border-0 px-1.5 py-2.5 hover:bg-transparent"
        >
          <span className={cn('flex w-full items-center gap-1.5 text-corpo font-medium', ativo ? 'text-acao' : 'text-tinta', s && !s.ativo && 'text-tinta-sussurro')}>
            {s ? <Landmark className="size-4 shrink-0" aria-hidden /> : <Building className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{s ? s.nome : 'Sem secretaria'}</span>
          </span>
          <span className="text-rotulo text-tinta-sussurro">
            {s ? `${ESFERA_ROTULO[s.esfera]}${s.ativo ? '' : ' · inativa'} · ` : ''}
            {galho.total} {galho.total === 1 ? 'unidade' : 'unidades'}
            {s && (gestao.length ? ` · gestão: ${gestao.map((p) => p.nome).join(', ')}` : ' · sem gestão designada')}
          </span>
        </BotaoLinha>
        {podeCriar && (
          <Button size="xs" variant="outline" onClick={() => nova(null)}>
            <Plus aria-hidden />Nova unidade
          </Button>
        )}
      </div>
      {mostra && galho.ramos.map((r) => {
        const fechado = fechados.has(r.ramo) && !abertoSempre
        const SetaRamo = fechado ? ChevronRight : ChevronDown
        return (
          <div key={r.ramo}>
            <div className="flex items-center gap-1 pr-3">
              <BotaoLinha
                variante="linha"
                aria-expanded={!fechado}
                onClick={() => setFechados((f) => { const n = new Set(f); if (n.has(r.ramo)) n.delete(r.ramo); else n.add(r.ramo); return n })}
                className="flex-1 items-center gap-1.5 border-0 py-1.5 pr-1 pl-9 text-apoio text-tinta-apoio hover:bg-campo"
              >
                <SetaRamo className="size-3.5 shrink-0" aria-hidden />
                <span className="flex-1">{RAMO_ROTULO[r.ramo]}</span>
                <span className="tabular-nums text-tinta-sussurro">{r.unidades.length}</span>
              </BotaoLinha>
              {podeCriar && (
                <Button size="icon-xs" variant="outline" aria-label={`Nova unidade em ${RAMO_ROTULO[r.ramo]}`} title={`Nova unidade em ${RAMO_ROTULO[r.ramo]}`} onClick={() => nova(r.ramo)}>
                  <Plus aria-hidden />
                </Button>
              )}
            </div>
            {!fechado && r.unidades.map((u) => {
              const sel = escolha?.tipo === 'unidade' && escolha.id === u.id
              const estado = estados?.get(u.id)
              // SE2: a pessoa uma vez (como nos Indicadores), quando a secretaria tem a conta
              const pessoas = pessoasDaUnidade(estado, totalPessoas(u))
              return (
                <BotaoLinha
                  key={u.id}
                  variante="linha"
                  aria-current={sel ? 'true' : undefined}
                  onClick={() => onEscolher({ tipo: 'unidade', id: u.id })}
                  className={cn(
                    'items-center gap-3 border-0 py-2 pr-3 pl-[60px] text-apoio hover:bg-campo',
                    sel ? 'bg-acao/10 font-medium text-acao' : u.ativo ? 'text-tinta' : 'text-tinta-sussurro',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">{u.nome}</span>
                      <span className="hidden shrink-0 text-rotulo text-tinta-sussurro sm:inline">{lugarDe(u)}</span>
                      <span className="shrink-0 text-rotulo text-tinta-sussurro tabular-nums">{pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                      {!u.ativo && <span className="shrink-0 text-rotulo">inativa</span>}
                    </span>
                    {/* SE1: o estado da unidade agora, em uma linha */}
                    {estado && u.ativo && (
                      <span className="text-rotulo font-normal text-tinta-sussurro">
                        {resumoEstado(estado).map((p, i) => (
                          <React.Fragment key={p.texto}>
                            {i > 0 && ' · '}
                            <span className={p.atencao ? 'text-atencao' : undefined}>{p.texto}</span>
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                  </span>
                  {!admin && <ChevronRight className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />}
                </BotaoLinha>
              )
            })}
          </div>
        )
      })}
      {mostra && galho.ramos.length === 0 && (
        <p className="pb-2.5 pl-12 text-rotulo text-tinta-sussurro">Nenhuma unidade ligada ainda.</p>
      )}
    </div>
  )
}

// ── fichas (na gaveta) ──────────────────────────────────────────────────────

type AcoesFicha = {
  modo: ModoRede
  onEscolher: (e: Escolha) => void
  onEditarSecretaria: (s: SecretariaRede) => void
  onEditarUnidade: (u: UnidadeCadastro) => void
  onNovaUnidade: (i: NovaUnidadeInicial) => void
}

function Ficha({ escolha, orgs, ...acoes }: { escolha: Escolha; orgs: OrganizacaoRede[] } & AcoesFicha) {
  if (escolha.tipo === 'unidade') {
    const org = orgs.find((o) => o.unidades.some((u) => u.id === escolha.id))
    const u = org?.unidades.find((x) => x.id === escolha.id)
    return org && u ? <FichaUnidade key={u.id} u={u} org={org} {...acoes} /> : <FichaSumiu />
  }
  if (escolha.tipo === 'secretaria') {
    const org = orgs.find((o) => o.secretarias.some((s) => s.id === escolha.id))
    const s = org?.secretarias.find((x) => x.id === escolha.id)
    return org && s ? <FichaSecretaria key={s.id} s={s} org={org} {...acoes} /> : <FichaSumiu />
  }
  const org = orgs.find((o) => o.id === escolha.org)
  if (!org) return <FichaSumiu />
  const ids = new Set(org.secretarias.map((s) => s.id))
  const soltas = org.unidades.filter((u) => !u.secretaria_id || !ids.has(u.secretaria_id))
  return (
    <>
      <GavetaCabeca sobre="Rede" titulo="Unidades sem secretaria" detalhe={org.nome} />
      <div className="px-[22px] py-4 text-apoio">
        <p className="text-tinta-sussurro">
          {soltas.length === 0 ? `Todas as unidades de ${org.nome} estão ligadas a uma secretaria.`
            : `${soltas.length} ${soltas.length === 1 ? 'unidade' : 'unidades'} de ${org.nome} ainda fora de uma secretaria. Abra a secretaria e escolha as unidades dela, ou abra a unidade e use "Na rede".`}
        </p>
        {org.secretarias.filter((s) => s.ativo).length === 0 && (
          <p className="mt-3 text-tinta-apoio">Esta organização ainda não tem secretaria. Comece por "Nova secretaria".</p>
        )}
      </div>
    </>
  )
}

function FichaSumiu() {
  return (
    <>
      <GavetaCabeca titulo="Ficha" />
      <p className="px-[22px] py-4 text-apoio text-tinta-sussurro">Este item saiu da rede. Feche e escolha outro na árvore.</p>
    </>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-trilha px-[22px] py-4 first:border-t-0">
      <h3 className="mb-2.5 text-apoio font-semibold text-tinta">{titulo}</h3>
      {children}
    </div>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1 text-apoio">
      <dt className="text-tinta-sussurro">{rotulo}</dt>
      <dd className="min-w-0 break-words text-tinta">{valor || <span className="text-tinta-sussurro">não informado</span>}</dd>
    </div>
  )
}

function FichaSecretaria({ s, org, modo, onEscolher, onEditarSecretaria, onNovaUnidade }: { s: SecretariaRede; org: OrganizacaoRede } & AcoesFicha) {
  const admin = modo === 'admin'
  const ligadas = org.unidades.filter((u) => u.secretaria_id === s.id)
  const ramos = RAMOS.map((r) => ({ ramo: r.valor, unidades: ligadas.filter((u) => u.ramo === r.valor) })).filter((g) => g.unidades.length > 0)
  const estados = React.useContext(EstadosDaRede)
  const pessoas = ligadas.reduce((n, u) => n + pessoasDaUnidade(estados?.get(u.id), totalPessoas(u)), 0)
  const tirar = useNaRede()
  return (
    <>
      <GavetaCabeca sobre="Secretaria" titulo={s.nome} detalhe={`Secretaria ${ESFERA_ROTULO[s.esfera].toLowerCase()} · ${org.nome}`} />
      <div className="flex flex-wrap items-center gap-2 px-[22px] pt-3.5">
        <Badge variant={s.ativo ? 'success' : 'secondary'} className={SELO}>{s.ativo ? 'Ativa' : 'Inativa'}</Badge>
        <span className="flex-1" />
        {admin && <Button size="sm" variant="outline" onClick={() => onEditarSecretaria(s)}>Editar</Button>}
        {admin && s.ativo && (
          <Button size="sm" onClick={() => onNovaUnidade({ organizacao_id: org.id, tipo: '', ramo: null, secretaria: { id: s.id, nome: s.nome } })}>
            <Plus aria-hidden />Nova unidade
          </Button>
        )}
      </div>
      <Bloco titulo="Dados">
        <dl>
          <Dado rotulo="CNPJ" valor={s.cnpj && s.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')} />
          <Dado rotulo="Município" valor={lugarDe(s)} />
          <Dado rotulo="Endereço" valor={s.endereco} />
        </dl>
      </Bloco>
      <Bloco titulo="Contatos">
        <dl>
          <Dado rotulo="Responsável" valor={s.responsavel} />
          <Dado rotulo="Telefone" valor={s.telefone} />
          <Dado rotulo="E-mail" valor={s.email} />
        </dl>
      </Bloco>
      <Bloco titulo={`Unidades da secretaria (${ligadas.length})`}>
        {ligadas.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">{admin ? 'Nenhuma unidade ainda. Escolha abaixo as que a secretaria compreende.' : 'Nenhuma unidade ligada ainda.'}</p>
        ) : (
          <>
            <p className="mb-2 text-apoio text-tinta-apoio">{resumoRamos(ramos)} · {pessoas} {pessoas === 1 ? 'pessoa com vínculo' : 'pessoas com vínculo'}</p>
            <ul className="flex flex-wrap gap-1.5">
              {ligadas.map((u) => (
                <li key={u.id} className="inline-flex items-center gap-0.5">
                  <Button size="xs" variant="outline" onClick={() => onEscolher({ tipo: 'unidade', id: u.id })}>{u.nome}</Button>
                  {admin && (
                    <Button
                      size="icon-xs" variant="ghost"
                      aria-label={`Tirar ${u.nome} da secretaria`} title="Tirar da secretaria"
                      disabled={tirar.isPending}
                      onClick={() => tirar.mutate({ unidade: u.id, secretaria: null, ramo: u.ramo_rede })}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {tirar.error && <MensagemErro erro={tirar.error} acao="tirar a unidade da secretaria" />}
      </Bloco>
      {admin && s.ativo && (
        <Bloco titulo="Escolher unidades">
          <EscolherUnidades secretaria={s} org={org} />
        </Bloco>
      )}
      <Bloco titulo="Pessoas da secretaria">
        {admin ? <PessoasSecretaria secretaria={s} /> : (
          (s.gestao ?? []).length === 0
            ? <p className="text-apoio text-tinta-sussurro">Ninguém designado ainda.</p>
            : (
              <ul className="flex flex-col gap-1 text-apoio">
                {(s.gestao ?? []).map((p) => (
                  <li key={p.nome} className="text-tinta">{p.nome}{p.pendente && <span className="text-tinta-sussurro"> · ainda não entrou</span>}</li>
                ))}
              </ul>
            )
        )}
      </Bloco>
    </>
  )
}

/**
 * O administrador escolhe as unidades que a secretaria compreende (RT,
 * 24/11/2026): busca com seleção múltipla em fichas, sem parede de checkbox.
 */
function EscolherUnidades({ secretaria, org }: { secretaria: SecretariaRede; org: OrganizacaoRede }) {
  const qc = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [escolhidas, setEscolhidas] = React.useState<string[]>([])
  const nomeSec = (id: string | null) => org.secretarias.find((x) => x.id === id)?.nome
  const t = normalizar(termo)
  const candidatas = org.unidades.filter((u) => u.secretaria_id !== secretaria.id)
  const achadas = t
    ? candidatas.filter((u) => !escolhidas.includes(u.id) && [u.nome, u.municipio, u.cnes].some((c) => c && normalizar(c).includes(t)))
    : []
  const lista = escolhidas.map((id) => candidatas.find((u) => u.id === id)).filter((u): u is UnidadeNaRede => !!u)
  const ligar = useMutation({
    mutationFn: async () => {
      // uma por vez: cada uma tem a própria auditoria; a primeira que falhar para
      for (const u of lista) {
        const { error } = await supabase.rpc('admin_unidade_na_rede', {
          p_unidade: u.id, p_secretaria: secretaria.id, p_ramo: u.ramo_rede ?? undefined,
        })
        if (error) throw new Error(`${u.nome}: ${error.message}`)
      }
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: CHAVE }) },
    onSuccess: () => { setEscolhidas([]); setTermo('') },
  })
  const movem = lista.filter((u) => u.secretaria_id).length
  return (
    <div className="flex flex-col gap-2.5">
      <Input
        aria-label="Buscar unidade para a secretaria"
        placeholder={candidatas.length ? `Buscar entre ${candidatas.length} ${candidatas.length === 1 ? 'unidade' : 'unidades'} da organização` : 'Todas as unidades já estão nesta secretaria'}
        disabled={candidatas.length === 0}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {t && achadas.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhuma unidade com esse nome fora desta secretaria.</p>}
      {achadas.length > 0 && (
        <div className="overflow-hidden rounded-controle border border-fio">
          {achadas.slice(0, 8).map((u) => {
            const atual = nomeSec(u.secretaria_id)
            return (
              <BotaoLinha key={u.id} variante="linha" className="items-center py-2" onClick={() => { setEscolhidas((e) => [...e, u.id]); setTermo('') }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-apoio text-tinta">{u.nome}</span>
                  <span className="block text-rotulo text-tinta-sussurro">{RAMO_SINGULAR[u.ramo]}{atual ? ` · hoje em ${atual}` : ' · sem secretaria'}</span>
                </span>
                <Plus className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
              </BotaoLinha>
            )
          })}
          {achadas.length > 8 && <p className="px-3.5 py-2 text-rotulo text-tinta-sussurro">Mais {achadas.length - 8}. Refine a busca.</p>}
        </div>
      )}
      {lista.length > 0 && (
        <>
          <ul aria-label="Unidades escolhidas" className="flex flex-wrap gap-1.5">
            {lista.map((u) => (
              <li key={u.id} className="inline-flex items-center gap-1 rounded-capsula border border-acao bg-acao/10 py-0.5 pr-0.5 pl-2.5 text-apoio text-acao">
                {u.nome}
                <Button size="icon-xs" variant="ghost" className="rounded-capsula" aria-label={`Tirar ${u.nome} da escolha`} onClick={() => setEscolhidas((e) => e.filter((x) => x !== u.id))}>
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          {movem > 0 && (
            <p className="text-rotulo text-tinta-sussurro">
              {movem === 1 ? '1 delas sai da secretaria em que está hoje.' : `${movem} delas saem da secretaria em que estão hoje.`}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={ligar.isPending} onClick={() => setEscolhidas([])}>Limpar</Button>
            <Button size="sm" disabled={ligar.isPending} onClick={() => ligar.mutate()}>
              Ligar {lista.length} {lista.length === 1 ? 'unidade' : 'unidades'}
            </Button>
          </div>
        </>
      )}
      {ligar.error && <MensagemErro erro={ligar.error} acao="ligar as unidades" />}
    </div>
  )
}

type PessoaSecretaria = { id: string; email: string; nome: string | null; ativo: boolean; pendente: boolean }

/** Quem o administrador designa para a secretaria (perfil Gestor da secretaria). */
function PessoasSecretaria({ secretaria }: { secretaria: SecretariaRede }) {
  const qc = useQueryClient()
  const [email, setEmail] = React.useState('')
  const lista = useQuery({
    queryKey: [...CHAVE_PESSOAS, secretaria.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_secretaria_pessoas', { p_secretaria: secretaria.id })
      if (error) throw error
      return (data ?? []) as unknown as PessoaSecretaria[]
    },
  })
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['admin-unidades'] }) }
  // e-mail da designação (avisar-secretaria, migration 20270421000024): sai em
  // segundo plano; a designação fica gravada mesmo se o e-mail falhar
  const [avisoEmail, setEmailAviso] = React.useState<'enviando' | 'enviado' | 'falhou' | null>(null)
  const avisar = (designacao: string) => {
    setEmailAviso('enviando')
    void supabase.functions.invoke('avisar-secretaria', { body: { designacao } })
      .then(({ error }) => setEmailAviso(error ? 'falhou' : 'enviado'))
      .catch(() => setEmailAviso('falhou'))
  }
  const designar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_designar_secretaria', { p_secretaria: secretaria.id, p_email: email.trim() })
      if (error) throw error
      return data as unknown as { id: string; pendente: boolean }
    },
    onSuccess: (r) => {
      setEmail('')
      recarregar()
      if (r?.id) avisar(r.id)
    },
  })
  const retirar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_retirar_secretaria', { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const ativas = (lista.data ?? []).filter((p) => p.ativo)
  const emailRuim = email.trim() !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  return (
    <div className="flex flex-col gap-3 text-apoio">
      <p className="text-tinta-apoio">
        Quem é designado aqui entra com o perfil Gestor da secretaria e cuida das unidades dela: dados, setores e leitos, escala, pessoas e indicadores. A pessoa recebe um e-mail de aviso.
      </p>
      {lista.isLoading && <Spinner />}
      {lista.error && <MensagemErro erro={lista.error} acao="carregar as pessoas da secretaria" />}
      {lista.data && ativas.length === 0 && <p className="text-tinta-sussurro">Ninguém designado ainda.</p>}
      {ativas.length > 0 && (
        <ul className="divide-y divide-trilha rounded-controle border border-fio">
          {ativas.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-tinta">{p.nome ?? p.email}</p>
                <p className="text-rotulo text-tinta-sussurro">
                  {p.nome ? `${p.email} · ` : ''}{p.pendente ? 'pendente: vale quando a pessoa entrar com este e-mail confirmado' : 'ativa'}
                </p>
              </div>
              <Button size="xs" variant="outline" disabled={retirar.isPending} onClick={() => retirar.mutate(p.id)}>Retirar</Button>
            </li>
          ))}
        </ul>
      )}
      {retirar.error && <MensagemErro erro={retirar.error} acao="retirar a pessoa" />}
      {secretaria.ativo && (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => { e.preventDefault(); if (!emailRuim && email.trim()) designar.mutate() }}
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <Label htmlFor="sec-pessoa-email" className="sr-only">E-mail de quem vai cuidar da secretaria</Label>
            <Input
              id="sec-pessoa-email" type="email" placeholder="E-mail de quem vai cuidar da secretaria"
              aria-invalid={emailRuim} value={email} onChange={(e) => setEmail(e.target.value)}
            />
            {emailRuim && <span className="text-rotulo text-critico">Confira o e-mail.</span>}
          </div>
          <Button type="submit" size="sm" disabled={!email.trim() || emailRuim || designar.isPending}>Designar</Button>
        </form>
      )}
      {designar.data?.pendente && (
        <p className="text-rotulo text-tinta-sussurro">Ainda não há conta confirmada com esse e-mail. A designação vale quando a pessoa entrar com ele.</p>
      )}
      {avisoEmail && (
        <p role="status" className={cn('text-rotulo', avisoEmail === 'falhou' ? 'text-atencao' : 'text-tinta-sussurro')}>
          {avisoEmail === 'enviando' && 'Enviando o e-mail de aviso…'}
          {avisoEmail === 'enviado' && 'A pessoa recebeu o e-mail de aviso.'}
          {avisoEmail === 'falhou' && 'E-mail não enviado. A designação está gravada; avise a pessoa por outro meio.'}
        </p>
      )}
      {designar.error && <MensagemErro erro={designar.error} acao="designar a pessoa" />}
    </div>
  )
}

function useNaRede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { unidade: string; secretaria: string | null; ramo: Ramo | null }) => {
      const { error } = await supabase.rpc('admin_unidade_na_rede', {
        p_unidade: v.unidade, p_secretaria: v.secretaria, p_ramo: v.ramo ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: CHAVE }) },
  })
}

function FichaUnidade({ u, org, modo, onEscolher, onEditarUnidade }: { u: UnidadeNaRede; org: OrganizacaoRede } & AcoesFicha) {
  const admin = modo === 'admin'
  const qc = useQueryClient()
  const sec = org.secretarias.find((s) => s.id === u.secretaria_id)
  const papeis = Object.entries(u.pessoas).sort((a, b) => b[1] - a[1])
  const estado = React.useContext(EstadosDaRede)?.get(u.id)
  const vinculos = totalPessoas(u)
  const pessoas = pessoasDaUnidade(estado, vinculos)
  const cadastro: UnidadeCadastro = {
    id: u.id, nome: u.nome, tipo: u.tipo as TipoUnidade, cnes: u.cnes, municipio: u.municipio, uf: u.uf,
    endereco: u.endereco, ativo: u.ativo, organizacao_id: org.id,
  }
  return (
    <>
      <GavetaCabeca
        sobre={RAMO_SINGULAR[u.ramo]}
        titulo={u.nome}
        detalhe={sec ? (
          <Button variant="link" className="h-auto p-0 text-apoio" onClick={() => onEscolher({ tipo: 'secretaria', id: sec.id })}>{sec.nome}</Button>
        ) : 'sem secretaria'}
      />
      <div className="flex flex-wrap items-center gap-2 px-[22px] pt-3.5">
        <Badge variant={u.ativo ? 'success' : 'secondary'} className={SELO}>{u.ativo ? 'Ativa' : 'Inativa'}</Badge>
        <span className="flex-1" />
        {admin ? (
          <Button size="sm" variant="outline" onClick={() => onEditarUnidade(cadastro)}>Editar cadastro</Button>
        ) : (
          <AcoesDaSecretaria unidade={u} />
        )}
      </div>
      <Bloco titulo="Dados">
        <dl>
          <Dado rotulo="Tipo" valor={tipoRotulo(u.tipo)} />
          <Dado rotulo="CNES" valor={u.cnes} />
          <Dado rotulo="Município" valor={lugarDe(u)} />
          <Dado rotulo="Endereço" valor={u.endereco} />
          {u.eh_central && <Dado rotulo="Regulação" valor="Central de regulação da organização" />}
          {u.eh_sede_rede && <Dado rotulo="Papéis de rede" valor="Unidade administrativa da Secretaria (módulo de rede)" />}
        </dl>
      </Bloco>
      {/* BT2 (revisão das telas novas, RT 25/11/2026): Gestão em seção própria, acima de Contatos,
          com os gestores atuais; a unidade pode ter mais de um e designar acrescenta */}
      <Bloco titulo={u.gestores.length > 1 ? `Gestão (${u.gestores.length})` : 'Gestão'}>
        {u.gestores.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Esta unidade ainda não tem gestor.</p>
        ) : (
          <ul aria-label="Gestores da unidade" className="flex flex-col gap-1">
            {u.gestores.map((g) => <li key={g} className="text-apoio text-tinta">{g}</li>)}
          </ul>
        )}
        {/* RT, 25/11/2026: o gestor da unidade é designado pela gestão da secretaria (o banco confere) */}
        {!admin && u.ativo && !u.eh_sede_rede && (
          <DesignarGestor unidadeId={u.id} unidadeNome={u.nome} gestoresAtuais={u.gestores}
            onDesignado={() => { void qc.invalidateQueries({ queryKey: CHAVE }) }} />
        )}
      </Bloco>
      <Bloco titulo="Contatos">
        <dl>
          <Dado rotulo="WhatsApp" valor={u.whatsapp} />
        </dl>
      </Bloco>
      <Bloco titulo={`Pessoas (${pessoas})`}>
        {papeis.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Nenhum vínculo ativo.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {papeis.map(([p, n]) => (
              <li key={p}><Badge variant="secondary" className={SELO}>{PAPEL_LABEL[p as Papel] ?? p} <span className="ml-1 tabular-nums">{n}</span></Badge></li>
            ))}
          </ul>
        )}
        {estado && vinculos !== pessoas && (
          <p className="mt-1.5 text-rotulo text-tinta-sussurro">Quem tem dois papéis conta nos dois; o total conta a pessoa uma vez.</p>
        )}
        <p className="mt-2.5 text-apoio text-tinta-apoio">{quemDesigna(u.gestores, (sec?.gestao ?? []).filter((p) => !p.pendente).map((p) => p.nome), sec?.nome ?? null)}</p>
        {admin && <p className="mt-1 text-rotulo text-tinta-sussurro">Os nomes, os vínculos e os convites ficam na aba Pessoas.</p>}
      </Bloco>
      {admin && <Situacao u={u} />}
      {admin && (
        <Bloco titulo="Na rede">
          <FormNaRede u={u} org={org} />
        </Bloco>
      )}
    </>
  )
}

/** Perfil Gestor da secretaria: da ficha para a configuração, a escala ou os convites da unidade. */
function AcoesDaSecretaria({ unidade }: { unidade: UnidadeNaRede }) {
  const { setUnidadeAtivaId, setPapelAtivo, unidades } = useUnidade()
  const navigate = useNavigate()
  // só as unidades ativas da secretaria entram na casca (minhas_secretarias)
  const naCasca = unidades.some((v) => v.unidade_id === unidade.id)
  const ir = (destino: string) => {
    setUnidadeAtivaId(unidade.id)
    setPapelAtivo('gestor_secretaria', unidade.id)
    navigate(destino)
  }
  if (!naCasca) return <span className="text-rotulo text-tinta-sussurro">Unidade inativa: sem configuração.</span>
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => ir('/unidade?aba=pessoas')}>Pessoas</Button>
      <Button size="sm" variant="outline" onClick={() => ir('/unidade?aba=convites')}>Convidar pessoas</Button>
      <Button size="sm" variant="outline" onClick={() => ir('/escala')}>Escala</Button>
      <Button size="sm" onClick={() => ir('/unidade?aba=setores')}>Configurar unidade</Button>
    </>
  )
}

function Situacao({ u }: { u: UnidadeNaRede }) {
  const rede = useUnidadesRede()
  const r = rede.data?.find((x) => x.unidade_id === u.id)
  const avaliacao = r ? avaliarUnidade(r, rede.dataUpdatedAt) : null
  return (
    <Bloco titulo="Situação">
      {!u.ativo ? (
        <p className="text-apoio text-tinta-sussurro">Unidade inativa.</p>
      ) : !r ? (
        <p className="text-apoio text-tinta-sussurro">{rede.isLoading ? 'Carregando.' : 'Sem números desta unidade.'}</p>
      ) : (
        <div className="flex flex-col gap-1 text-apoio">
          <p className={cn(avaliacao?.estado === 2 ? 'text-critico' : avaliacao?.estado === 1 ? 'text-atencao' : 'text-conforme')}>
            {avaliacao && avaliacao.motivos.length ? avaliacao.motivos.join(' · ') : 'Em dia'}
          </p>
          <p className="text-tinta-apoio">
            {r.em_plantao} em plantão · {r.leitos === null ? 'leitos < 5' : `${r.leitos_ocupados ?? '< 5'} de ${r.leitos} leitos`}
          </p>
        </div>
      )}
    </Bloco>
  )
}

function FormNaRede({ u, org }: { u: UnidadeNaRede; org: OrganizacaoRede }) {
  const [secretaria, setSecretaria] = React.useState(u.secretaria_id ?? '')
  const [ramo, setRamo] = React.useState<Ramo | ''>(u.ramo_rede ?? '')
  const salvar = useNaRede()
  const ativas = org.secretarias.filter((s) => s.ativo || s.id === u.secretaria_id)
  const mudou = secretaria !== (u.secretaria_id ?? '') || ramo !== (u.ramo_rede ?? '')
  const doTipo: Ramo = u.eh_central ? 'central_regulacao' : (u.tipo as Ramo)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-3">
        <Label htmlFor="nr-secretaria" className="text-tinta-sussurro">Secretaria</Label>
        <CampoSelecao id="nr-secretaria" value={secretaria} onChange={(e) => setSecretaria(e.target.value)}>
          <option value="">Sem secretaria</option>
          {ativas.map((s) => <option key={s.id} value={s.id} disabled={!s.ativo}>{s.nome}{s.ativo ? '' : ' (inativa)'}</option>)}
        </CampoSelecao>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-3">
        <Label htmlFor="nr-ramo" className="text-tinta-sussurro">Ramo</Label>
        <CampoSelecao id="nr-ramo" value={ramo} onChange={(e) => setRamo(e.target.value as Ramo | '')}>
          <option value="">Pelo tipo ({RAMO_SINGULAR[doTipo] ?? tipoRotulo(u.tipo)})</option>
          {RAMOS.map((r) => <option key={r.valor} value={r.valor}>{r.singular}</option>)}
        </CampoSelecao>
      </div>
      <p className="text-rotulo text-tinta-sussurro">O ramo só muda onde a unidade aparece na rede. O menu de quem trabalha nela continua saindo do tipo.</p>
      {salvar.error && <MensagemErro erro={salvar.error} acao="salvar a unidade na rede" />}
      <div className="flex justify-end">
        <Button size="sm" disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate({ unidade: u.id, secretaria: secretaria || null, ramo: ramo || null })}>
          {secretaria && u.secretaria_id && secretaria !== u.secretaria_id ? 'Mover' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

// ── janela da secretaria ────────────────────────────────────────────────────

function JanelaSecretaria({ aberto, secretaria, orgs, onFechar, onCriada }: {
  aberto: boolean; secretaria: SecretariaRede | null; orgs: OrganizacaoRede[]; onFechar: () => void; onCriada: (id: string) => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="sm:max-w-xl">
        {aberto && <FormSecretaria key={secretaria?.id ?? 'nova'} secretaria={secretaria} orgs={orgs} onFechar={onFechar} onCriada={onCriada} />}
      </DialogContent>
    </Dialog>
  )
}

function Linha({ id, rotulo, nota, children }: { id: string; rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-4">
      <Label htmlFor={id} className="sm:pt-2">{rotulo}</Label>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {nota && <span className="text-rotulo text-tinta-sussurro">{nota}</span>}
      </div>
    </div>
  )
}

function FormSecretaria({ secretaria: s, orgs, onFechar, onCriada }: {
  secretaria: SecretariaRede | null; orgs: OrganizacaoRede[]; onFechar: () => void; onCriada: (id: string) => void
}) {
  const qc = useQueryClient()
  const nova = !s
  const [orgId, setOrgId] = React.useState(orgs.length === 1 ? orgs[0].id : '')
  const [nome, setNome] = React.useState(s?.nome ?? '')
  const [esfera, setEsfera] = React.useState<Esfera>(s?.esfera ?? 'municipal')
  const [municipio, setMunicipio] = React.useState(s?.municipio ?? '')
  const [uf, setUf] = React.useState(s?.uf ?? '')
  const [cnpj, setCnpj] = React.useState(s?.cnpj ?? '')
  const [responsavel, setResponsavel] = React.useState(s?.responsavel ?? '')
  const [telefone, setTelefone] = React.useState(s?.telefone ?? '')
  const [email, setEmail] = React.useState(s?.email ?? '')
  const [endereco, setEndereco] = React.useState(s?.endereco ?? '')
  const [ativo, setAtivo] = React.useState(s?.ativo ?? true)

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_salvar_secretaria', {
        p_id: s?.id ?? null, p_organizacao: nova ? orgId : null, p_nome: nome.trim(), p_esfera: esfera,
        p_municipio: municipio.trim() || undefined, p_uf: uf.trim() || undefined, p_cnpj: cnpj.trim() || undefined,
        p_responsavel: responsavel.trim() || undefined, p_telefone: telefone.trim() || undefined,
        p_email: email.trim() || undefined, p_endereco: endereco.trim() || undefined, p_ativo: ativo,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: CHAVE })
      if (nova && id) onCriada(id)
      onFechar()
    },
  })

  const cnpjDigitos = cnpj.replace(/\D/g, '')
  const cnpjRuim = cnpjDigitos !== '' && cnpjDigitos.length !== 14
  const ufRuim = uf.trim() !== '' && !/^[A-Za-z]{2}$/.test(uf.trim())
  const emailRuim = email.trim() !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const pronto = (!nova || !!orgId) && nome.trim().length >= 3 && !cnpjRuim && !ufRuim && !emailRuim

  return (
    <>
      <DialogHeader>
        <DialogTitle>{nova ? 'Nova secretaria' : 'Editar secretaria'}</DialogTitle>
        <DialogDescription>
          A secretaria é o ponto de onde a rede se ramifica: hospitais, UPAs, UBS, clínicas, ambulatórios e centrais de regulação ligados a ela.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3.5 text-apoio">
        {nova && orgs.length > 1 && (
          <Linha id="sec-org" rotulo="Organização">
            <CampoSelecao id="sec-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Escolha a organização</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </CampoSelecao>
          </Linha>
        )}
        <Linha id="sec-nome" rotulo="Nome">
          <Input id="sec-nome" placeholder="ex.: Secretaria Municipal de Saúde" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Linha>
        <Linha id="sec-esfera" rotulo="Esfera">
          <CampoSelecao id="sec-esfera" value={esfera} onChange={(e) => setEsfera(e.target.value as Esfera)}>
            {ESFERAS.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
          </CampoSelecao>
        </Linha>
        <Linha id="sec-municipio" rotulo="Município">
          <Input id="sec-municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
        </Linha>
        <Linha id="sec-uf" rotulo="UF">
          <Input id="sec-uf" className="w-20 uppercase" maxLength={2} aria-invalid={ufRuim} value={uf} onChange={(e) => setUf(e.target.value)} />
          {ufRuim && <span className="text-rotulo text-critico">A UF tem 2 letras.</span>}
        </Linha>
        <Linha id="sec-cnpj" rotulo="CNPJ" nota="Opcional.">
          <Input id="sec-cnpj" inputMode="numeric" placeholder="14 dígitos" aria-invalid={cnpjRuim} value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          {cnpjRuim && <span className="text-rotulo text-critico">O CNPJ tem 14 dígitos.</span>}
        </Linha>
        <Linha id="sec-endereco" rotulo="Endereço">
          <Input id="sec-endereco" maxLength={300} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </Linha>
        <Linha id="sec-responsavel" rotulo="Responsável" nota="Contato institucional da secretaria.">
          <Input id="sec-responsavel" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </Linha>
        <Linha id="sec-telefone" rotulo="Telefone">
          <Input id="sec-telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </Linha>
        <Linha id="sec-email" rotulo="E-mail">
          <Input id="sec-email" type="email" aria-invalid={emailRuim} value={email} onChange={(e) => setEmail(e.target.value)} />
          {emailRuim && <span className="text-rotulo text-critico">Confira o e-mail.</span>}
        </Linha>
        {!nova && (
          <Linha id="sec-situacao" rotulo="Situação" nota={!ativo ? 'Só desativa sem unidade ativa ligada a ela.' : undefined}>
            <CampoSelecao id="sec-situacao" value={ativo ? 'ativa' : 'inativa'} onChange={(e) => setAtivo(e.target.value === 'ativa')}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </CampoSelecao>
          </Linha>
        )}
        {salvar.error && <MensagemErro erro={salvar.error} acao="salvar a secretaria" />}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onFechar}>Cancelar</Button>
        <Button disabled={!pronto || salvar.isPending} onClick={() => salvar.mutate()}>{nova ? 'Criar secretaria' : 'Salvar'}</Button>
      </DialogFooter>
    </>
  )
}
