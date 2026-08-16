const fs = require('fs')
const p = 'src/types/database.ts'
let b = fs.readFileSync(p)
if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3)
let s = b.toString('utf8')
const alias = `
// ── Aliases (tipos utilitários de negócio) ─────────────────────────────────
export type Perfis = Database['public']['Tables']['perfis']
export type Perfil = Perfis['Row']
export type Banners = Database['public']['Tables']['banners']
export type EscalaPlantao = Database['public']['Tables']['escala_plantao']['Row']
export type EscalaPlantaoInsert = Database['public']['Tables']['escala_plantao']['Insert']
export type EscalaFixa = Database['public']['Tables']['escala_fixa']['Row']
export type EscalaFixaInsert = Database['public']['Tables']['escala_fixa']['Insert']
export type SolicitacaoEscala = Database['public']['Tables']['solicitacoes_escala']['Row']
export type SolicitacaoEscalaInsert = Database['public']['Tables']['solicitacoes_escala']['Insert']
export type CandidaturaEscala = Database['public']['Tables']['candidaturas_escala']['Row']
export type CandidaturaEscalaInsert = Database['public']['Tables']['candidaturas_escala']['Insert']
export type TransferenciaPaciente = Database['public']['Tables']['transferencias_paciente']['Row']
export type Papel = Database['public']['Enums']['papel']
export type StatusLeito = Database['public']['Enums']['status_leito']
export type TipoLeito = Database['public']['Enums']['tipo_leito']
export type TipoSetor = Database['public']['Enums']['tipo_setor']
export type TipoUnidade = Database['public']['Enums']['tipo_unidade']
export type PlantonistaDaUnidade = Database['public']['Functions']['plantonistas_da_unidade']['Returns'][number]
export type SetorInternacao = Database['public']['Functions']['setores_internacao']['Returns'][number]
`
s = s.trimEnd() + '\n' + alias
fs.writeFileSync(p, s, 'utf8')
console.log('aliases adicionados')
