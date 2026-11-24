import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building, ChevronDown, ChevronRight, Landmark, Network, Plus, Search } from 'lucide-react'
import * as React from 'react'

import { Vazio } from '@/components/monitor/Pagina'
import { cartao } from '@/components/admin/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { JanelaUnidade } from '@/pages/admin/JanelaUnidade'
import { PAPEL_LABEL, TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { avaliarUnidade, useUnidadesRede, type UnidadeCadastro } from '@/lib/dadosAdmin'
import {
  ESFERAS, montarArvore, normalizar, RAMO_ROTULO, RAMO_SINGULAR, RAMOS, resumoRamos, totalPessoas,
  type Esfera, type GalhoSecretaria, type OrganizacaoRede, type Ramo, type SecretariaRede, type UnidadeNaRede,
} from '@/lib/redeSecretaria'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Papel, TipoUnidade } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Rede a partir da Secretaria (pedido do RT, 24/11/2026; desenho mestre-detalhe
// aprovado no Refero). À esquerda a árvore Secretaria → ramo (Hospitais, UPAs,
// UBS, Clínicas, Ambulatórios, Centrais de regulação) → unidade; à direita a
// ficha do que estiver escolhido. O administrador cria e edita a secretaria,
// liga a unidade a ela e move a unidade entre secretarias da mesma
// organização. Lista longa = busca (nada de parede de checkbox).
// Banco: migration 20270421000020 (admin_rede_arvore, admin_salvar_secretaria,
// admin_unidade_na_rede).
// ─────────────────────────────────────────────────────────────────────────────

// prefixo 'admin-unidades': quando a janela da unidade salva, a árvore relê junto
const CHAVE = ['admin-unidades', 'rede-arvore'] as const

type Escolha = { tipo: 'secretaria'; id: string } | { tipo: 'unidade'; id: string } | { tipo: 'sem'; org: string }

const ESFERA_ROTULO = Object.fromEntries(ESFERAS.map((e) => [e.valor, e.rotulo])) as Record<Esfera, string>
const tipoRotulo = (t: string) => TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? t
const lugarDe = (x: { municipio: string | null; uf: string | null }) => [x.municipio, x.uf].filter(Boolean).join('/')

function useArvore() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_rede_arvore')
      if (error) throw error
      return (data ?? []) as unknown as OrganizacaoRede[]
    },
  })
}

export function RedeSecretaria() {
  const arvore = useArvore()
  const orgs = React.useMemo(() => arvore.data ?? [], [arvore.data])
  const [busca, setBusca] = React.useState('')
  const galhos = React.useMemo(() => montarArvore(orgs, busca), [orgs, busca])
  const [escolha, setEscolha] = React.useState<Escolha | null>(null)
  const [janela, setJanela] = React.useState<{ secretaria: SecretariaRede | null; org?: string } | null>(null)

  // sem escolha, abre a primeira secretaria (ou o galho sem secretaria)
  const atual: Escolha | null = escolha ?? (galhos[0]
    ? galhos[0].secretaria ? { tipo: 'secretaria', id: galhos[0].secretaria.id } : { tipo: 'sem', org: galhos[0].organizacao.id }
    : null)

  const variasOrgs = orgs.length > 1

  return (
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
        <Button size="sm" disabled={orgs.length === 0} onClick={() => setJanela({ secretaria: null })}>
          <Plus className="size-4" aria-hidden />Nova secretaria
        </Button>
      </div>

      {arvore.error && <MensagemErro erro={arvore.error} acao="carregar a rede" />}
      {arvore.isLoading && <Spinner />}
      {arvore.data && orgs.length === 0 && (
        <Vazio icone={Network} titulo="Nenhuma organização visível" texto="O administrador vê a rede das organizações em que tem vínculo de administrador." />
      )}

      {orgs.length > 0 && (
        <div className="grid gap-3.5 lg:grid-cols-[minmax(260px,340px)_1fr] lg:items-start">
          <nav aria-label="Árvore da rede" className={cn(cartao, 'lg:sticky lg:top-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto')}>
            {galhos.length === 0 && <p className="px-4 py-6 text-center text-apoio text-tinta-sussurro">Nada encontrado para essa busca.</p>}
            {galhos.map((g, i) => (
              <React.Fragment key={g.chave}>
                {variasOrgs && (i === 0 || galhos[i - 1].organizacao.id !== g.organizacao.id) && (
                  <p className="border-b border-trilha bg-campo px-4 py-2 text-rotulo font-semibold text-tinta-sussurro">{g.organizacao.nome}</p>
                )}
                <Galho galho={g} escolha={atual} onEscolher={setEscolha} abertoSempre={!!busca.trim()} />
              </React.Fragment>
            ))}
          </nav>

          <section aria-label="Ficha" className="min-w-0">
            <Ficha
              escolha={atual}
              orgs={orgs}
              onEscolher={setEscolha}
              onEditarSecretaria={(s) => setJanela({ secretaria: s })}
            />
          </section>
        </div>
      )}

      <JanelaSecretaria
        aberto={!!janela}
        secretaria={janela?.secretaria ?? null}
        orgs={orgs}
        onFechar={() => setJanela(null)}
        onCriada={(id) => setEscolha({ tipo: 'secretaria', id })}
      />
    </div>
  )
}

// ── árvore ──────────────────────────────────────────────────────────────────

function Galho({ galho, escolha, onEscolher, abertoSempre }: {
  galho: GalhoSecretaria; escolha: Escolha | null; onEscolher: (e: Escolha) => void; abertoSempre: boolean
}) {
  const [aberto, setAberto] = React.useState(true)
  const [fechados, setFechados] = React.useState<Set<Ramo>>(new Set())
  const s = galho.secretaria
  const ativo = s ? escolha?.tipo === 'secretaria' && escolha.id === s.id : escolha?.tipo === 'sem' && escolha.org === galho.organizacao.id
  const mostra = aberto || abertoSempre
  const Seta = mostra ? ChevronDown : ChevronRight
  return (
    <div className="border-b border-trilha last:border-0">
      <div className={cn('flex items-center gap-1 pr-3', ativo && 'bg-acao/10')}>
        <Button
          variant="ghost" size="icon" className="size-8 shrink-0"
          aria-label={mostra ? 'Recolher' : 'Abrir'} aria-expanded={mostra}
          onClick={() => setAberto((v) => !v)}
        >
          <Seta className="size-4" aria-hidden />
        </Button>
        <button
          type="button"
          aria-current={ativo ? 'true' : undefined}
          onClick={() => onEscolher(s ? { tipo: 'secretaria', id: s.id } : { tipo: 'sem', org: galho.organizacao.id })}
          className="flex min-w-0 flex-1 flex-col items-start py-2.5 text-left"
        >
          <span className={cn('flex w-full items-center gap-1.5 text-corpo font-medium', ativo ? 'text-acao' : 'text-tinta', s && !s.ativo && 'text-tinta-sussurro')}>
            {s ? <Landmark className="size-4 shrink-0" aria-hidden /> : <Building className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{s ? s.nome : 'Sem secretaria'}</span>
          </span>
          <span className="text-rotulo text-tinta-sussurro">
            {s ? `${ESFERA_ROTULO[s.esfera]}${s.ativo ? '' : ' · inativa'} · ` : ''}
            {galho.total} {galho.total === 1 ? 'unidade' : 'unidades'}
          </span>
        </button>
      </div>
      {mostra && galho.ramos.map((r) => {
        const fechado = fechados.has(r.ramo) && !abertoSempre
        const SetaRamo = fechado ? ChevronRight : ChevronDown
        return (
          <div key={r.ramo}>
            <button
              type="button"
              aria-expanded={!fechado}
              onClick={() => setFechados((f) => { const n = new Set(f); if (n.has(r.ramo)) n.delete(r.ramo); else n.add(r.ramo); return n })}
              className="flex w-full items-center gap-1.5 py-1.5 pr-3 pl-8 text-left text-apoio text-tinta-apoio hover:bg-campo"
            >
              <SetaRamo className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{RAMO_ROTULO[r.ramo]}</span>
              <span className="tabular-nums text-tinta-sussurro">{r.unidades.length}</span>
            </button>
            {!fechado && r.unidades.map((u) => {
              const sel = escolha?.tipo === 'unidade' && escolha.id === u.id
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-current={sel ? 'true' : undefined}
                  onClick={() => onEscolher({ tipo: 'unidade', id: u.id })}
                  className={cn(
                    'flex w-full items-center gap-2 py-1.5 pr-3 pl-[52px] text-left text-apoio hover:bg-campo',
                    sel ? 'bg-acao/10 font-medium text-acao' : u.ativo ? 'text-tinta' : 'text-tinta-sussurro',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{u.nome}</span>
                  {!u.ativo && <span className="text-rotulo">inativa</span>}
                </button>
              )
            })}
          </div>
        )
      })}
      {mostra && galho.ramos.length === 0 && (
        <p className="pb-2.5 pl-10 text-rotulo text-tinta-sussurro">Nenhuma unidade ligada ainda.</p>
      )}
    </div>
  )
}

// ── fichas ──────────────────────────────────────────────────────────────────

function Ficha({ escolha, orgs, onEscolher, onEditarSecretaria }: {
  escolha: Escolha | null; orgs: OrganizacaoRede[]; onEscolher: (e: Escolha) => void; onEditarSecretaria: (s: SecretariaRede) => void
}) {
  if (!escolha) return null
  if (escolha.tipo === 'unidade') {
    const org = orgs.find((o) => o.unidades.some((u) => u.id === escolha.id))
    const u = org?.unidades.find((x) => x.id === escolha.id)
    return org && u ? <FichaUnidade key={u.id} u={u} org={org} onEscolher={onEscolher} /> : null
  }
  if (escolha.tipo === 'secretaria') {
    const org = orgs.find((o) => o.secretarias.some((s) => s.id === escolha.id))
    const s = org?.secretarias.find((x) => x.id === escolha.id)
    return org && s ? <FichaSecretaria key={s.id} s={s} org={org} onEscolher={onEscolher} onEditar={() => onEditarSecretaria(s)} /> : null
  }
  const org = orgs.find((o) => o.id === escolha.org)
  if (!org) return null
  const ids = new Set(org.secretarias.map((s) => s.id))
  const soltas = org.unidades.filter((u) => !u.secretaria_id || !ids.has(u.secretaria_id))
  return (
    <div className={cn(cartao, 'p-5')}>
      <h2 className="text-secao font-semibold text-tinta">Unidades sem secretaria</h2>
      <p className="mt-1 text-apoio text-tinta-sussurro">
        {soltas.length === 0 ? 'Todas as unidades de ' + org.nome + ' estão ligadas a uma secretaria.'
          : `${soltas.length} ${soltas.length === 1 ? 'unidade' : 'unidades'} de ${org.nome} ainda fora de uma secretaria. Abra a unidade e escolha a secretaria em "Na rede", ou ligue pela ficha da secretaria.`}
      </p>
      {org.secretarias.filter((s) => s.ativo).length === 0 && (
        <p className="mt-3 text-apoio text-tinta-apoio">Esta organização ainda não tem secretaria. Comece por "Nova secretaria".</p>
      )}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-trilha px-5 py-4">
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

function FichaSecretaria({ s, org, onEscolher, onEditar }: {
  s: SecretariaRede; org: OrganizacaoRede; onEscolher: (e: Escolha) => void; onEditar: () => void
}) {
  const ligadas = org.unidades.filter((u) => u.secretaria_id === s.id)
  const ramos = RAMOS.map((r) => ({ ramo: r.valor, unidades: ligadas.filter((u) => u.ramo === r.valor) })).filter((g) => g.unidades.length > 0)
  const pessoas = ligadas.reduce((n, u) => n + totalPessoas(u), 0)
  return (
    <div className={cartao}>
      <div className="flex flex-wrap items-start gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-secao font-semibold text-tinta">{s.nome}</h2>
          <p className="mt-0.5 text-apoio text-tinta-sussurro">Secretaria {ESFERA_ROTULO[s.esfera].toLowerCase()} · {org.nome}</p>
        </div>
        <Badge variant={s.ativo ? 'success' : 'secondary'}>{s.ativo ? 'Ativa' : 'Inativa'}</Badge>
        <Button size="sm" variant="outline" onClick={onEditar}>Editar</Button>
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
      <Bloco titulo={`Unidades ligadas (${ligadas.length})`}>
        {ligadas.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Nenhuma unidade ligada ainda. Busque abaixo para ligar a primeira.</p>
        ) : (
          <>
            <p className="mb-2 text-apoio text-tinta-apoio">{resumoRamos(ramos)} · {pessoas} {pessoas === 1 ? 'pessoa com vínculo' : 'pessoas com vínculo'}</p>
            <ul className="flex flex-wrap gap-1.5">
              {ligadas.map((u) => (
                <li key={u.id}>
                  <Button size="xs" variant="outline" onClick={() => onEscolher({ tipo: 'unidade', id: u.id })}>{u.nome}</Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloco>
      {s.ativo && (
        <Bloco titulo="Ligar unidade">
          <LigarUnidade secretaria={s} org={org} />
        </Bloco>
      )}
    </div>
  )
}

/** Busca entre as unidades da organização que não estão nesta secretaria. */
function LigarUnidade({ secretaria, org }: { secretaria: SecretariaRede; org: OrganizacaoRede }) {
  const [termo, setTermo] = React.useState('')
  const ligar = useNaRede()
  const nomeSec = (id: string | null) => org.secretarias.find((x) => x.id === id)?.nome
  const t = normalizar(termo)
  const candidatas = org.unidades.filter((u) => u.secretaria_id !== secretaria.id)
  const achadas = t ? candidatas.filter((u) => [u.nome, u.municipio, u.cnes].some((c) => c && normalizar(c).includes(t))) : []
  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label="Buscar unidade para ligar"
        placeholder={candidatas.length ? `Buscar entre ${candidatas.length} ${candidatas.length === 1 ? 'unidade' : 'unidades'} da organização` : 'Todas as unidades já estão nesta secretaria'}
        disabled={candidatas.length === 0}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {t && achadas.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhuma unidade com esse nome fora desta secretaria.</p>}
      {achadas.length > 0 && (
        <ul className="divide-y divide-trilha rounded-controle border border-fio">
          {achadas.slice(0, 8).map((u) => {
            const atual = nomeSec(u.secretaria_id)
            return (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-apoio text-tinta">{u.nome}</p>
                  <p className="text-rotulo text-tinta-sussurro">{RAMO_SINGULAR[u.ramo]}{atual ? ` · hoje em ${atual}` : ' · sem secretaria'}</p>
                </div>
                <Button
                  size="xs"
                  disabled={ligar.isPending}
                  onClick={() => ligar.mutate({ unidade: u.id, secretaria: secretaria.id, ramo: u.ramo_rede }, { onSuccess: () => setTermo('') })}
                >
                  {atual ? 'Mover para cá' : 'Ligar'}
                </Button>
              </li>
            )
          })}
          {achadas.length > 8 && <li className="px-3 py-2 text-rotulo text-tinta-sussurro">Mais {achadas.length - 8}. Refine a busca.</li>}
        </ul>
      )}
      {ligar.error && <MensagemErro erro={ligar.error} acao="ligar a unidade" />}
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

function FichaUnidade({ u, org, onEscolher }: { u: UnidadeNaRede; org: OrganizacaoRede; onEscolher: (e: Escolha) => void }) {
  const rede = useUnidadesRede()
  const r = rede.data?.find((x) => x.unidade_id === u.id)
  const avaliacao = r ? avaliarUnidade(r, rede.dataUpdatedAt) : null
  const [editar, setEditar] = React.useState(false)
  const sec = org.secretarias.find((s) => s.id === u.secretaria_id)
  const papeis = Object.entries(u.pessoas).sort((a, b) => b[1] - a[1])
  const cadastro: UnidadeCadastro = {
    id: u.id, nome: u.nome, tipo: u.tipo as TipoUnidade, cnes: u.cnes, municipio: u.municipio, uf: u.uf,
    endereco: u.endereco, ativo: u.ativo, organizacao_id: org.id,
  }
  return (
    <div className={cartao}>
      <div className="flex flex-wrap items-start gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-secao font-semibold text-tinta">{u.nome}</h2>
          <p className="mt-0.5 text-apoio text-tinta-sussurro">
            {RAMO_SINGULAR[u.ramo]} · {sec ? (
              <Button variant="link" className="h-auto p-0 text-apoio" onClick={() => onEscolher({ tipo: 'secretaria', id: sec.id })}>{sec.nome}</Button>
            ) : 'sem secretaria'}
          </p>
        </div>
        <Badge variant={u.ativo ? 'success' : 'secondary'}>{u.ativo ? 'Ativa' : 'Inativa'}</Badge>
        <Button size="sm" variant="outline" onClick={() => setEditar(true)}>Editar cadastro</Button>
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
      <Bloco titulo="Contatos">
        <dl>
          <Dado rotulo="Gestão" valor={u.gestores.length ? u.gestores.join(', ') : null} />
          <Dado rotulo="WhatsApp" valor={u.whatsapp} />
        </dl>
      </Bloco>
      <Bloco titulo={`Pessoas (${totalPessoas(u)})`}>
        {papeis.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Nenhum vínculo ativo.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {papeis.map(([p, n]) => (
              <li key={p}><Badge variant="secondary">{PAPEL_LABEL[p as Papel] ?? p} <span className="ml-1 tabular-nums">{n}</span></Badge></li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-rotulo text-tinta-sussurro">Os nomes e convites ficam na aba Pessoas.</p>
      </Bloco>
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
      <Bloco titulo="Na rede">
        <FormNaRede u={u} org={org} />
      </Bloco>
      <JanelaUnidade aberto={editar} unidade={editar ? cadastro : null} onFechar={() => setEditar(false)} />
    </div>
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
