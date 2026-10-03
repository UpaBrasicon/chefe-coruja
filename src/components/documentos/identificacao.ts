// Identificação dos documentos: SEMPRE do cadastro (paciente), do login
// (profissional) e da configuração da unidade (CNES). Ninguém digita nome,
// CNS ou CNES no documento. Os nomes dos campos são os do protótipo
// (pac, cab, UNIDADE, usuario()), porque as folhas A4 são montadas a partir
// dos construtores do protótipo e leem o retrato gravado no documento.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { RACAS_COR } from '@/lib/cadastro'
import { useAuth } from '@/contexts/AuthContext'
import { ehPediatrico } from '@/domain/idade'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { hojeSP, idadeLegivel } from '@/pages/recepcao/cadastroForm'

/** Paciente como o protótipo chama (portaPacientes()). Datas em ISO. */
export type PacProto = {
  id: string
  nome: string
  prontuario: string
  cns: string
  cpf: string
  nascimento: string
  idade: string
  sexo: string
  raca: string
  etnia: string
  mae: string
  telefone: string
  responsavel: string
  telResp: string
  respVinculo: string
  endereco: string
  bairro: string
  municipio: string
  uf: string
  ibge: string
  cep: string
}
/** Cabeçalho do paciente (cabecalho() do protótipo). */
export type CabProto = {
  nome: string
  idade: string
  prontuario: string
  leito: string
  alergias: string
  temAlergia: boolean
  semAlergia: boolean
  desconheceAlergia: boolean
  artigo: 'a paciente' | 'o paciente'
}
/** Unidade do plantão (UNIDADE do protótipo). */
export type UnidadeProto = { nome: string; cnes: string; municipio: string; uf: string; ibge: string; endereco: string; telefone: string }
/** Profissional do login (usuario() do protótipo). */
export type UsuarioProto = { nome: string; registro: string; cpf: string; cns: string; rqe: string; especialidade: string; telefone: string }

/** O retrato que vai dentro de todo documento emitido. */
export type Retrato = { pac: PacProto | null; cab: CabProto; unidade: UnidadeProto; usuario: UsuarioProto }

type LinhaPaciente = {
  id: string; nome: string; nome_social: string | null; prontuario: string | null; cns: string | null; cpf: string | null
  data_nascimento: string | null; sexo: string | null; raca_cor: string | null; nome_mae: string | null; telefone: string | null
  responsavel_nome: string | null; responsavel_telefone: string | null; responsavel_parentesco: string | null
  endereco: string | null; municipio: string | null; uf: string | null; unidade_id: string; setor_id: string | null
}

const t = (s: string | null | undefined) => (s ?? '').trim()

function paraPac(p: LinhaPaciente): PacProto {
  const nasc = t(p.data_nascimento).slice(0, 10)
  return {
    id: p.id,
    nome: p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome,
    prontuario: t(p.prontuario),
    cns: t(p.cns),
    cpf: t(p.cpf),
    nascimento: nasc,
    idade: nasc ? idadeLegivel(nasc, hojeSP()) : '',
    sexo: p.sexo === 'F' ? 'Feminino' : p.sexo === 'M' ? 'Masculino' : '',
    raca: RACAS_COR.find((r) => r.valor === p.raca_cor)?.rotulo ?? '',
    etnia: '',
    mae: t(p.nome_mae),
    telefone: t(p.telefone),
    responsavel: t(p.responsavel_nome),
    telResp: t(p.responsavel_telefone),
    respVinculo: t(p.responsavel_parentesco),
    endereco: t(p.endereco),
    bairro: '',
    municipio: t(p.municipio),
    uf: t(p.uf),
    ibge: '',
    cep: '',
  }
}

/** "CRM-SP 154892" a partir do perfil. */
function registroDe(p: Record<string, unknown> | null) {
  if (!p) return ''
  const conselho = t(p.conselho as string) || 'CRM'
  const num = t(p.crm as string) || t(p.registro_numero as string)
  const uf = t(p.uf_crm as string) || t(p.registro_uf as string)
  return num ? `${conselho}${uf ? `-${uf}` : ''} ${num}` : ''
}

/** O que falta no cadastro para o laudo de AIH (aihCadastroFalta do protótipo). */
export function cadastroFaltaAih(pac: PacProto | null): string[] {
  if (!pac) return ['paciente sem cadastro']
  const campos: [keyof PacProto, string][] = [
    ['prontuario', 'prontuário'], ['cns', 'CNS'], ['nascimento', 'data de nascimento'], ['sexo', 'sexo'], ['raca', 'raça/cor'],
    ['mae', 'nome da mãe'], ['endereco', 'endereço'], ['municipio', 'município'], ['uf', 'UF'],
  ]
  return campos.filter(([k]) => !t(pac[k])).map(([, r]) => r)
}

export function cpfValido(cpf: string) {
  const s = cpf.replace(/\D/g, '')
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(s[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(s[9]) && dv(10) === Number(s[10])
}

export function cnsValido(cns: string) {
  const s = cns.replace(/\D/g, '')
  if (!/^[1-2789]\d{14}$/.test(s)) return false
  let soma = 0
  for (let i = 0; i < 15; i++) soma += Number(s[i]) * (15 - i)
  return soma % 11 === 0
}

/**
 * Cadastro, alergias, unidade e profissional do documento. `leito` é o texto
 * do leito/setor quando o documento sai de dentro da internação.
 */
export function useIdentificacao(pacienteId: string | null | undefined, leito = '') {
  const { perfil } = useAuth()
  const paciente = useQuery({
    queryKey: ['paciente-cadastro', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('*').eq('id', pacienteId!).maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as LinhaPaciente | null
    },
  })
  const linha = paciente.data ?? null
  const unidade = useQuery({
    queryKey: ['unidade-documento', linha?.unidade_id],
    enabled: !!linha?.unidade_id,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('nome, cnes, municipio, uf').eq('id', linha!.unidade_id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const alergias = useAlergias(pacienteId)

  const pac = linha ? paraPac(linha) : null
  const alg = alergias.data
  const temAlergia = alg?.estado === 'tem'
  const cab: CabProto = {
    nome: pac?.nome ?? '',
    idade: pac?.idade ?? '',
    prontuario: pac?.prontuario ?? '',
    leito,
    alergias: temAlergia ? ativas(alg).map((a) => a.substancia).join(', ') : '',
    temAlergia,
    semAlergia: alg?.estado === 'nega',
    desconheceAlergia: alg?.estado === 'desconhece',
    artigo: linha?.sexo === 'F' ? 'a paciente' : 'o paciente',
  }
  const u = unidade.data
  const unidadeProto: UnidadeProto = {
    nome: u?.nome ?? '', cnes: t(u?.cnes), municipio: t(u?.municipio), uf: t(u?.uf), ibge: '', endereco: '', telefone: '',
  }
  const dp = (perfil?.dados_pessoais ?? {}) as Record<string, unknown>
  const especialidades = Array.isArray(dp.especialidades) ? (dp.especialidades as unknown[]).map(String) : []
  const usuario: UsuarioProto = {
    nome: perfil?.nome_completo ?? '',
    registro: registroDe(perfil as unknown as Record<string, unknown> | null),
    cpf: t(perfil?.cpf),
    cns: t(dp.cns as string),
    rqe: t(dp.rqe as string),
    especialidade: especialidades[0] ?? '',
    telefone: t(perfil?.telefone),
  }
  const retrato: Retrato = { pac, cab, unidade: unidadeProto, usuario }
  // true/false pela idade; null = sem data de nascimento (ou ainda carregando).
  // null NÃO é adulto (decisão do RT, 02/10/2026): quem usa compara com
  // `=== false` para liberar conteúdo de adulto (NEWS2/qSOFA, favoritos).
  const pediatrico = pac?.nascimento ? ehPediatrico(pac.nascimento, hojeSP()) : null

  /**
   * Os campos antigos do documento (bloco `paciente` das telas de antes), para
   * quem já lê documentos emitidos continuar lendo os novos.
   */
  const pacienteAntigo = (extra: { peso?: string; diagnostico?: string; dieta?: string } = {}) => ({
    nome: cab.nome,
    nascimento: pac?.nascimento ? pac.nascimento.split('-').reverse().join('/') : '',
    dataAtual: hojeSP(),
    idade: cab.idade,
    peso: extra.peso ?? '',
    alergias: temAlergia ? cab.alergias : cab.semAlergia ? 'NEGA' : cab.desconheceAlergia ? 'NÃO INFORMADA' : alg ? 'NÃO REGISTRADA' : '',
    dieta: extra.dieta ?? '',
    leito,
    diagnostico: extra.diagnostico ?? '',
    setor_id: linha?.setor_id ?? null,
    paciente_id: pacienteId ?? null,
  })

  return {
    carregando: paciente.isLoading,
    erro: paciente.error as Error | null,
    pac,
    cab,
    unidade: unidadeProto,
    usuario,
    retrato,
    pediatrico,
    alergiasCarregadas: !!alg,
    pacienteAntigo,
  }
}
