/**
 * Tipos gerados a partir do schema do Supabase.
 * Fase 1 — gestão hospitalar (organizações, unidades, vinculos, setores, leitos).
 *
 * Para regenerar depois de aplicar as migrations:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TipoUnidade = 'hospital' | 'upa' | 'clinica'
export type Papel = 'admin' | 'gestor' | 'plantonista'
export type TipoSetor =
  | 'emergencia'
  | 'observacao'
  | 'internacao'
  | 'isolamento'
  | 'uti'
  | 'outro'
export type TipoLeito = 'clinico' | 'isolamento' | 'estabilizacao' | 'observacao'
export type StatusLeito = 'livre' | 'ocupado' | 'bloqueado' | 'higienizacao'

export interface Database {
  public: {
    Tables: {
      organizacoes: {
        Row: {
          id: string
          nome: string
          cnpj: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cnpj?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cnpj?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          id: string
          organizacao_id: string
          nome: string
          tipo: TipoUnidade
          cnes: string | null
          municipio: string | null
          uf: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organizacao_id: string
          nome: string
          tipo: TipoUnidade
          cnes?: string | null
          municipio?: string | null
          uf?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organizacao_id?: string
          nome?: string
          tipo?: TipoUnidade
          cnes?: string | null
          municipio?: string | null
          uf?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'unidades_organizacao_id_fkey'
            columns: ['organizacao_id']
            isOneToOne: false
            referencedRelation: 'organizacoes'
            referencedColumns: ['id']
          },
        ]
      }
      perfis: {
        Row: {
          id: string
          nome_completo: string
          cpf: string | null
          crm: string | null
          uf_crm: string | null
          telefone: string | null
          email: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nome_completo: string
          cpf?: string | null
          crm?: string | null
          uf_crm?: string | null
          telefone?: string | null
          email?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome_completo?: string
          cpf?: string | null
          crm?: string | null
          uf_crm?: string | null
          telefone?: string | null
          email?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vinculos: {
        Row: {
          id: string
          perfil_id: string
          unidade_id: string
          papel: Papel
          ativo: boolean
          criado_por: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          perfil_id: string
          unidade_id: string
          papel: Papel
          ativo?: boolean
          criado_por?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          perfil_id?: string
          unidade_id?: string
          papel?: Papel
          ativo?: boolean
          criado_por?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vinculos_perfil_id_fkey'
            columns: ['perfil_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vinculos_unidade_id_fkey'
            columns: ['unidade_id']
            isOneToOne: false
            referencedRelation: 'unidades'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vinculos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
      setores: {
        Row: {
          id: string
          unidade_id: string
          nome: string
          tipo: TipoSetor
          ordem: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unidade_id: string
          nome: string
          tipo: TipoSetor
          ordem?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unidade_id?: string
          nome?: string
          tipo?: TipoSetor
          ordem?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'setores_unidade_id_fkey'
            columns: ['unidade_id']
            isOneToOne: false
            referencedRelation: 'unidades'
            referencedColumns: ['id']
          },
        ]
      }
      leitos: {
        Row: {
          id: string
          setor_id: string
          identificador: string
          tipo: TipoLeito
          status: StatusLeito
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          setor_id: string
          identificador: string
          tipo: TipoLeito
          status?: StatusLeito
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          setor_id?: string
          identificador?: string
          tipo?: TipoLeito
          status?: StatusLeito
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leitos_setor_id_fkey'
            columns: ['setor_id']
            isOneToOne: false
            referencedRelation: 'setores'
            referencedColumns: ['id']
          },
        ]
      }
      log_auditoria: {
        Row: {
          id: string
          ator_id: string | null
          acao: string
          entidade: string
          entidade_id: string | null
          unidade_id: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          ator_id?: string | null
          acao: string
          entidade: string
          entidade_id?: string | null
          unidade_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          ator_id?: string | null
          acao?: string
          entidade?: string
          entidade_id?: string | null
          unidade_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'log_auditoria_ator_id_fkey'
            columns: ['ator_id']
            isOneToOne: false
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'log_auditoria_unidade_id_fkey'
            columns: ['unidade_id']
            isOneToOne: false
            referencedRelation: 'unidades'
            referencedColumns: ['id']
          },
        ]
      }
      super_admins: {
        Row: {
          perfil_id: string
          created_at: string
        }
        Insert: {
          perfil_id: string
          created_at?: string
        }
        Update: {
          perfil_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'super_admins_perfil_id_fkey'
            columns: ['perfil_id']
            isOneToOne: true
            referencedRelation: 'perfis'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      vw_censo_unidade: {
        Row: {
          unidade_id: string
          unidade_nome: string
          unidade_tipo: TipoUnidade
          total_setores: number | null
          total_leitos: number | null
          leitos_livres: number | null
          leitos_ocupados: number | null
          leitos_bloqueados: number | null
          leitos_higienizacao: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'vw_censo_unidade_unidade_id_fkey'
            columns: ['unidade_id']
            isOneToOne: false
            referencedRelation: 'unidades'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      papel_na_unidade: {
        Args: { unidade: string }
        Returns: string | null
      }
      unidades_do_usuario: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      eh_admin_da_organizacao: {
        Args: { org: string }
        Returns: boolean
      }
      eh_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      registrar_auditoria: {
        Args: {
          p_acao: string
          p_entidade: string
          p_entidade_id?: string | null
          p_unidade_id?: string | null
          p_payload?: Json | null
        }
        Returns: string
      }
    }
    Enums: {
      papel: Papel
      status_leito: StatusLeito
      tipo_leito: TipoLeito
      tipo_setor: TipoSetor
      tipo_unidade: TipoUnidade
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Perfis = Database['public']['Tables']['perfis']
export type Perfil = Perfis['Row']
