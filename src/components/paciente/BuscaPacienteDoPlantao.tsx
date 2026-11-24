/* eslint-disable react-refresh/only-export-components */
// Paciente por busca (leito + nome), no lugar de select longo ou parede de
// fichas (regra do RT, 24/11/2026: lista longa vira busca). A lista vem da
// RLS de quem está logado: os pacientes dos setores do plantão em curso. A
// busca é local, sem consulta nova ao banco.
import { useQuery } from '@tanstack/react-query'
import { Search, UserRound, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { fmtData } from '@/lib/datas'
import { normalizar } from '@/lib/search'
import { setoresNaEscalaAgora } from '@/lib/rpcCasca'
import { supabase } from '@/lib/supabase'

export type PacienteBusca = {
  id: string
  nome: string
  nome_social?: string | null
  nascimento?: string | null
  setor?: string | null
  leito?: string | null
}

const STATUS_ATIVOS = ['admitido', 'em_observacao', 'internado']

/**
 * Pacientes dos setores da escala em curso, com o leito atual quando internado
 * ou em observação. SH3 (revisão do perfil Enfermeiro, RT 24/11/2026): a RLS
 * deixa ver os pacientes da unidade, não só os do plantão; o recorte é pelos
 * setores_na_escala_agora, para "do seu plantão" dizer a verdade. Vale para
 * todo perfil que usa esta busca; outro paciente, pelo pedido de acesso.
 */
export function usePacientesDoPlantao(unidadeId?: string) {
  return useQuery({
    queryKey: ['pacientes-do-plantao-busca', unidadeId],
    enabled: !!unidadeId,
    staleTime: 30_000,
    queryFn: async (): Promise<PacienteBusca[]> => {
      const { data: ids, error: e1 } = await setoresNaEscalaAgora()
      if (e1) throw e1
      const setores = (Array.isArray(ids) ? ids : []) as string[]
      if (setores.length === 0) return []
      const [p, l] = await Promise.all([
        supabase.from('pacientes')
          .select('id, nome, nome_social, data_nascimento, setores!pacientes_setor_id_fkey(nome)')
          .eq('unidade_id', unidadeId!).eq('ativo', true).in('setor_id', setores).order('nome').limit(300),
        supabase.from('internacoes')
          .select('paciente_id, leitos!internacoes_leito_atual_id_fkey(identificador)')
          .eq('unidade_id', unidadeId!).in('status', STATUS_ATIVOS),
      ])
      if (p.error) throw p.error
      // sem acesso ao leito, o paciente entra só com o setor
      const leitos = new Map<string, string>()
      for (const i of l.data ?? []) if (i.leitos?.identificador) leitos.set(i.paciente_id, i.leitos.identificador)
      return (p.data ?? []).map((x) => ({
        id: x.id, nome: x.nome, nome_social: x.nome_social, nascimento: x.data_nascimento,
        setor: (x.setores as { nome: string } | null)?.nome ?? null, leito: leitos.get(x.id) ?? null,
      }))
    },
  })
}

/** Os leitos de cada paciente (para listas que vêm de outra consulta, ex.: atendimentos abertos). */
export function useLeitosDosPacientes(unidadeId?: string) {
  return useQuery({
    queryKey: ['leitos-dos-pacientes', unidadeId],
    enabled: !!unidadeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('internacoes')
        .select('paciente_id, leitos!internacoes_leito_atual_id_fkey(identificador)')
        .eq('unidade_id', unidadeId!).in('status', STATUS_ATIVOS)
      if (error) throw error
      const m = new Map<string, string>()
      for (const i of data ?? []) if (i.leitos?.identificador) m.set(i.paciente_id, i.leitos.identificador)
      return m
    },
  })
}

export function descreverPaciente(p: PacienteBusca) {
  return [p.leito ? `Leito ${p.leito}` : '', p.setor ?? '', p.nascimento ? `nasc. ${fmtData(p.nascimento)}` : ''].filter(Boolean).join(' · ')
}

export function filtrarPacientes(lista: PacienteBusca[], termo: string, limite = 8) {
  const t = normalizar(termo.trim())
  if (!t) return []
  return lista.filter((p) =>
    normalizar(p.nome).includes(t)
    || (p.nome_social ? normalizar(p.nome_social).includes(t) : false)
    || (p.leito ? normalizar(p.leito).startsWith(t) || normalizar(`leito ${p.leito}`).startsWith(t) : false),
  ).slice(0, limite)
}

/**
 * Campo de busca do paciente. Escolhido, vira uma ficha com "Trocar". Sem
 * termo digitado não mostra a lista inteira: só quantos há.
 */
export function BuscaPaciente({ id, pacientes, carregando, escolhido, onEscolher, vazio, rotulo = 'Paciente' }: {
  id: string
  pacientes: PacienteBusca[]
  carregando?: boolean
  escolhido: string | null
  onEscolher: (id: string | null) => void
  /** texto quando não há paciente nenhum para escolher */
  vazio: React.ReactNode
  rotulo?: string
}) {
  const [termo, setTermo] = React.useState('')
  const sel = escolhido ? pacientes.find((p) => p.id === escolhido) : null
  const achados = filtrarPacientes(pacientes, termo)

  if (sel) {
    return (
      <div className="grid gap-1.5">
        <span className="text-apoio font-medium text-grafite">{rotulo}</span>
        <div className="flex flex-wrap items-center gap-2 rounded-controle border border-acao/40 bg-alerta-marca px-3 py-2">
          <UserRound className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-medium text-tinta">{sel.nome_social ? `${sel.nome_social} (${sel.nome})` : sel.nome}</span>
          <span className="text-apoio text-tinta-sussurro">{descreverPaciente(sel)}</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => { onEscolher(null); setTermo('') }}>
            <X aria-hidden /> Trocar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-apoio font-medium text-grafite">{rotulo}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
        <Input id={id} className="pl-9" placeholder="Leito ou nome do paciente" autoComplete="off" value={termo}
          disabled={!carregando && pacientes.length === 0}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && achados.length === 1) { e.preventDefault(); onEscolher(achados[0].id) } }} />
      </div>
      {termo.trim() && achados.length > 0 && (
        <div role="listbox" aria-label="Pacientes encontrados" className="overflow-hidden rounded-controle border border-fio bg-superficie">
          {achados.map((p) => (
            <OpcaoLista key={p.id} onClick={() => { onEscolher(p.id); setTermo('') }} className="flex-wrap items-baseline gap-x-2.5 hover:bg-campo">
              <span className="text-controle font-medium text-tinta">{p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome}</span>
              <span className="text-apoio text-tinta-sussurro">{descreverPaciente(p)}</span>
            </OpcaoLista>
          ))}
        </div>
      )}
      {termo.trim() && achados.length === 0 && pacientes.length > 0 && (
        <span className="text-apoio text-tinta-sussurro">Nenhum paciente com esse leito ou nome no seu plantão.</span>
      )}
      {!termo.trim() && (
        <span className="text-apoio text-tinta-sussurro">
          {carregando ? 'Carregando os pacientes…'
            : pacientes.length === 0 ? vazio
            : `${pacientes.length} ${pacientes.length === 1 ? 'paciente' : 'pacientes'} do seu plantão. Digite o leito ou o nome.`}
        </span>
      )}
    </div>
  )
}
