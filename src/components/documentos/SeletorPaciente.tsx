// Escolher o paciente do documento. A identificação vem SEMPRE do cadastro:
// aqui se busca, se cadastra ou se completa o cadastro — o documento não tem
// campo de nome, nascimento ou CNS para digitar à mão. Abrir o paciente é
// consulta registrada no servidor (abrir_prontuario).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PencilLine, Plus, Search, TriangleAlert, UserRound, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirProntuario } from '@/lib/prontuario'
import { formatarCns, formatarCpf } from '@/lib/documentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CamposCadastro } from '@/pages/recepcao/CamposCadastro'
import { CADASTRO_VAZIO, errosCadastro, normalizarCadastro, type Cadastro, type CampoCadastro } from '@/pages/recepcao/cadastroForm'
import { useEscalaSetores } from '@/pages/plantao/shared/useEscalaSetores'
import { carregarEnvelope, useRascunho } from '@/pages/plantao/shared/rascunho'
import { usePacienteDaUrl } from '@/pages/plantao/shared/usePacienteDaUrl'
import type { PacProto } from './identificacao'

/**
 * O paciente escolhido na ferramenta (guardado no aparelho, 12 h, como os
 * rascunhos). `?paciente=` na URL escolhe direto.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePacienteDoDocumento(ferramenta: string, unidadeId?: string, perfilId?: string) {
  const r = useRascunho<{ paciente_id: string | null }>(`${ferramenta}:paciente`, unidadeId, perfilId, CARREGAR)
  const vazio = React.useMemo(() => ({ nome: '', nascimento: '', dataAtual: '', idade: '', peso: '', alergias: '', dieta: '', leito: '', diagnostico: '', paciente_id: r.dados.paciente_id }), [r.dados.paciente_id])
  usePacienteDaUrl(vazio, (p) => { if (p.paciente_id) r.atualizar({ paciente_id: p.paciente_id }) })
  const escolher = React.useCallback((id: string | null) => {
    if (id) void abrirProntuario(id).catch(() => undefined)
    r.atualizar({ paciente_id: id })
  }, [r])
  return [r.dados.paciente_id, escolher] as const
}
// rascunho cifrado (item 13): mesmo envelope e prazo dos outros rascunhos
const CARREGAR = (chave: string) => ({
  paciente_id: carregarEnvelope<{ paciente_id?: string | null }>(chave)?.dados?.paciente_id ?? null,
})

type Achado = { id: string; nome: string; nome_social: string | null; cpf: string | null; cns: string | null; data_nascimento: string | null; prontuario: string | null }

export function SeletorPaciente({ pacienteId, onEscolher, pac, unidadeId, perfilId, fixo = false }: {
  pacienteId: string | null | undefined
  onEscolher: (id: string | null) => void
  pac: PacProto | null
  unidadeId?: string
  perfilId?: string
  /** dentro do leito: o paciente não troca */
  fixo?: boolean
}) {
  const qc = useQueryClient()
  const [busca, setBusca] = React.useState('')
  const [termo, setTermo] = React.useState('')
  const [cadastro, setCadastro] = React.useState<'fechado' | 'novo' | 'editar'>('fechado')
  const [form, setForm] = React.useState<Cadastro>(CADASTRO_VAZIO)
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const [duplicata, setDuplicata] = React.useState<{ tipo: 'documento' | 'provavel'; id: string; texto: string } | null>(null)
  const { data: setores } = useEscalaSetores(unidadeId, perfilId)

  const achados = useQuery({
    queryKey: ['documento-busca-paciente', termo],
    enabled: termo.length >= 3,
    queryFn: async () => {
      const digitos = termo.replace(/\D/g, '')
      const q = digitos.length >= 5 ? `cpf.ilike.%${digitos}%,cns.ilike.%${digitos}%,prontuario.ilike.%${termo}%` : `nome.ilike.%${termo}%,nome_social.ilike.%${termo}%`
      const { data, error } = await supabase.from('pacientes').select('id, nome, nome_social, cpf, cns, data_nascimento, prontuario').or(q).limit(12)
      if (error) throw error
      return (data ?? []) as Achado[]
    },
  })

  function abrirCadastro(tipo: 'novo' | 'editar') {
    setErro(null)
    setDuplicata(null)
    if (tipo === 'editar') {
      void (async () => {
        const { data } = await supabase.from('pacientes').select('*').eq('id', pacienteId!).maybeSingle()
        const f = { ...CADASTRO_VAZIO }
        for (const k of Object.keys(CADASTRO_VAZIO) as CampoCadastro[]) f[k] = ((data as Record<string, string | null> | null)?.[k] ?? '') as string
        setForm(f)
        setCadastro('editar')
      })()
      return
    }
    const d = busca.replace(/\D/g, '')
    setForm({ ...CADASTRO_VAZIO, nome: /\d/.test(busca) ? '' : busca.trim(), cpf: d.length === 11 ? d : '' })
    setCadastro('novo')
  }

  async function salvar({ outraPessoa = false, usarId }: { outraPessoa?: boolean; usarId?: string } = {}) {
    setErro(null)
    if (usarId) {
      onEscolher(usarId)
      setCadastro('fechado')
      setDuplicata(null)
      return
    }
    if (form.nome.trim().length < 3) return setErro('Nome é obrigatório.')
    const primeiro = Object.values(errosCadastro(form))[0]
    if (primeiro) return setErro(primeiro)
    const novo = cadastro === 'novo'
    const setor = setores?.[0]?.id
    if (novo && (!unidadeId || !setor)) return setErro('Nenhum setor da sua escala agora para cadastrar o paciente.')
    setSalvando(true)
    const { data, error } = await supabase.rpc('salvar_cadastro_paciente', {
      p_paciente: novo ? undefined : pacienteId!,
      p_dados: normalizarCadastro(form),
      p_setor: novo ? setor : undefined,
      p_outra_pessoa: outraPessoa,
    })
    setSalvando(false)
    if (error) {
      const m = error.message.match(/^CADASTRO_DUPLICATA_(DOCUMENTO|PROVAVEL):([0-9a-f-]{36}) (.*)$/)
      if (m) setDuplicata({ tipo: m[1] === 'DOCUMENTO' ? 'documento' : 'provavel', id: m[2], texto: m[3] })
      else setErro(error.message)
      return
    }
    const r = data as { paciente_id: string }
    void qc.invalidateQueries({ queryKey: ['paciente-cadastro', r.paciente_id] })
    onEscolher(r.paciente_id)
    setCadastro('fechado')
    setBusca('')
    setTermo('')
  }

  const formCadastro = cadastro !== 'fechado' && (
    <section aria-label="Cadastro do paciente" className="flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
      <h3 className="text-corpo font-semibold text-tinta">{cadastro === 'editar' ? 'Completar cadastro' : 'Novo paciente'}</h3>
      {duplicata && (
        <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-container border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5">
          <TriangleAlert className="size-[15px] text-atencao" aria-hidden />
          <span className="min-w-0 flex-[1_1_240px] text-apoio text-atencao">{duplicata.texto}</span>
          <Button variant="outline" onClick={() => void salvar({ usarId: duplicata.id })}>Usar o cadastro existente</Button>
          {duplicata.tipo === 'provavel' && <Button variant="outline" onClick={() => void salvar({ outraPessoa: true })}>É outra pessoa</Button>}
        </div>
      )}
      <CamposCadastro prefixo="doc" valores={form} onChange={(k, v) => { setErro(null); setForm((f) => ({ ...f, [k]: v })) }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {erro ? <span role="alert" className="flex items-center gap-1.5 text-apoio text-critico"><TriangleAlert className="size-3.5" />{erro}</span> : <span />}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setCadastro('fechado')}>Cancelar</Button>
          <Button disabled={salvando} onClick={() => void salvar()}>{salvando ? <Spinner className="size-4" /> : <Check />} Salvar e usar neste documento</Button>
        </div>
      </div>
    </section>
  )

  if (pacienteId) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
          <div className="flex min-w-60 flex-1 flex-col gap-[5px]">
            <span className="text-apoio font-medium text-grafite">Paciente</span>
            <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-[9px]">
              <UserRound className="size-[15px] text-tinta-sussurro" aria-hidden />
              <span className="min-w-0 truncate text-corpo text-tinta">
                {pac ? [pac.nome, pac.idade, pac.prontuario ? `Pront. ${pac.prontuario}` : '', pac.cns ? `CNS ${formatarCns(pac.cns)}` : ''].filter(Boolean).join(' · ') : 'Carregando o cadastro…'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => abrirCadastro('editar')}><PencilLine /> Completar ou corrigir cadastro</Button>
            {!fixo && <Button variant="ghost" size="sm" onClick={() => onEscolher(null)}><X /> Trocar paciente</Button>}
          </div>
        </div>
        {formCadastro}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
        <label htmlFor="doc-busca" className="text-apoio font-medium text-grafite">Paciente</label>
        <div className="flex gap-2">
          <Input id="doc-busca" placeholder="Nome, CPF, CNS ou prontuário…" value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setTermo(busca.trim()) }} />
          <Button onClick={() => setTermo(busca.trim())}><Search /> Buscar</Button>
        </div>
        {achados.isFetching && <Spinner />}
        {(achados.data ?? []).map((p) => (
          <button key={p.id} type="button" onClick={() => { onEscolher(p.id); setBusca(''); setTermo('') }}
            className="flex w-full flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-controle border border-fio px-3 py-2 text-left hover:border-marca hover:bg-alerta-marca">
            <span className="text-controle font-medium text-tinta">{p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome}</span>
            <span className="text-apoio text-tinta-sussurro">
              {[p.data_nascimento ? p.data_nascimento.split('-').reverse().join('/') : '', p.prontuario ? `Pront. ${p.prontuario}` : '',
                p.cpf ? `CPF ${formatarCpf(p.cpf)}` : '', p.cns ? `CNS ${formatarCns(p.cns)}` : ''].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
        {termo.length >= 3 && achados.isSuccess && !achados.data.length && <p className="text-apoio text-tinta-sussurro">Nenhum paciente encontrado.</p>}
        {cadastro === 'fechado' && (
          <button type="button" className="self-start text-apoio font-medium text-acao hover:underline" onClick={() => abrirCadastro('novo')}>
            <Plus className="mr-1 inline size-3.5" />Novo paciente
          </button>
        )}
        <p className="text-apoio text-tinta-sussurro">Escolha ou cadastre o paciente: a identificação do documento sai do cadastro.</p>
      </div>
      {formCadastro}
    </div>
  )
}
