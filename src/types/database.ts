export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acessos_plantonista: {
        Row: {
          ativo: boolean
          created_at: string
          criado_em: string
          id: string
          perfil_id: string
          tipo_acesso: string
          unidade_id: string
          valida_ate: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_em?: string
          id?: string
          perfil_id: string
          tipo_acesso?: string
          unidade_id: string
          valida_ate?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_em?: string
          id?: string
          perfil_id?: string
          tipo_acesso?: string
          unidade_id?: string
          valida_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acessos_plantonista_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessos_plantonista_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          algoritmo: string
          certificado_cpf: string | null
          certificado_serial: string | null
          created_at: string
          hash_conteudo: string
          id: string
          id_assinatura_icp: string | null
          medico_id: string
          prescricao_id: string
          status: string
          validado_em: string | null
        }
        Insert: {
          algoritmo?: string
          certificado_cpf?: string | null
          certificado_serial?: string | null
          created_at?: string
          hash_conteudo: string
          id?: string
          id_assinatura_icp?: string | null
          medico_id: string
          prescricao_id: string
          status?: string
          validado_em?: string | null
        }
        Update: {
          algoritmo?: string
          certificado_cpf?: string | null
          certificado_serial?: string | null
          created_at?: string
          hash_conteudo?: string
          id?: string
          id_assinatura_icp?: string | null
          medico_id?: string
          prescricao_id?: string
          status?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string
          link_url: string | null
          ordem: number
          titulo: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url: string
          link_url?: string | null
          ordem?: number
          titulo?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string
          link_url?: string | null
          ordem?: number
          titulo?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_unidade: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          unidade_id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          unidade_id: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          unidade_id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cuidados_plantonistas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          paciente_id: string
          perfil_id: string
          unidade_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          paciente_id: string
          perfil_id: string
          unidade_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          paciente_id?: string
          perfil_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuidados_plantonistas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuidados_plantonistas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuidados_plantonistas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_plantoes: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          data: string
          id: string
          perfil_id: string
          setor_id: string
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data: string
          id?: string
          perfil_id: string
          setor_id: string
          turno: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: string
          perfil_id?: string
          setor_id?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_plantoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      leitos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          identificador: string
          setor_id: string
          status: Database["public"]["Enums"]["status_leito"]
          tipo: Database["public"]["Enums"]["tipo_leito"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          identificador: string
          setor_id: string
          status?: Database["public"]["Enums"]["status_leito"]
          tipo?: Database["public"]["Enums"]["tipo_leito"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          identificador?: string
          setor_id?: string
          status?: Database["public"]["Enums"]["status_leito"]
          tipo?: Database["public"]["Enums"]["tipo_leito"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leitos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      links_publicos_receita: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          prescricao_id: string
          tipo: string
          token: string
          valida_ate: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          prescricao_id: string
          tipo: string
          token: string
          valida_ate?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          prescricao_id?: string
          tipo?: string
          token?: string
          valida_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_publicos_receita_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_publicos_receita_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      log_auditoria: {
        Row: {
          acao: string
          ator_id: string | null
          created_at: string
          entidade: string
          entidade_id: string | null
          id: string
          payload: Json | null
          unidade_id: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          created_at?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          payload?: Json | null
          unidade_id?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          payload?: Json | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_auditoria_ator_id_fkey"
            columns: ["ator_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auditoria_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          apresentacao: string | null
          ativo: boolean
          codigo_anvisa: string | null
          codigo_barras: string | null
          concentracao: string | null
          controlado: boolean
          created_at: string
          forma_farmaceutica: string | null
          id: string
          nome: string
          principio_ativo: string
          tipo_receituario: string
          unidade: string | null
          updated_at: string
          via: string | null
        }
        Insert: {
          apresentacao?: string | null
          ativo?: boolean
          codigo_anvisa?: string | null
          codigo_barras?: string | null
          concentracao?: string | null
          controlado?: boolean
          created_at?: string
          forma_farmaceutica?: string | null
          id?: string
          nome: string
          principio_ativo: string
          tipo_receituario?: string
          unidade?: string | null
          updated_at?: string
          via?: string | null
        }
        Update: {
          apresentacao?: string | null
          ativo?: boolean
          codigo_anvisa?: string | null
          codigo_barras?: string | null
          concentracao?: string | null
          controlado?: boolean
          created_at?: string
          forma_farmaceutica?: string | null
          id?: string
          nome?: string
          principio_ativo?: string
          tipo_receituario?: string
          unidade?: string | null
          updated_at?: string
          via?: string | null
        }
        Relationships: []
      }
      notificacoes_whatsapp: {
        Row: {
          created_at: string
          destinatario_nome: string | null
          id: string
          id_provedor: string | null
          payload: Json | null
          prescricao_id: string | null
          status: string
          telefone: string
          template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatario_nome?: string | null
          id?: string
          id_provedor?: string | null
          payload?: Json | null
          prescricao_id?: string | null
          status?: string
          telefone: string
          template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatario_nome?: string | null
          id?: string
          id_provedor?: string | null
          payload?: Json | null
          prescricao_id?: string | null
          status?: string
          telefone?: string
          template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_whatsapp_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          prontuario: string | null
          setor_id: string | null
          sexo: string | null
          telefone: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          prontuario?: string | null
          setor_id?: string | null
          sexo?: string | null
          telefone?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          prontuario?: string | null
          setor_id?: string | null
          sexo?: string | null
          telefone?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          crm: string | null
          email: string | null
          id: string
          nome_completo: string
          telefone: string | null
          uf_crm: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          crm?: string | null
          email?: string | null
          id: string
          nome_completo: string
          telefone?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          crm?: string | null
          email?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prescricao_itens: {
        Row: {
          created_at: string
          descricao: string
          dose: string | null
          duracao: string | null
          id: string
          medicamento_id: string | null
          observacao: string | null
          ordem: number
          posologia: string | null
          prescricao_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          dose?: string | null
          duracao?: string | null
          id?: string
          medicamento_id?: string | null
          observacao?: string | null
          ordem?: number
          posologia?: string | null
          prescricao_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          dose?: string | null
          duracao?: string | null
          id?: string
          medicamento_id?: string | null
          observacao?: string | null
          ordem?: number
          posologia?: string | null
          prescricao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescricao_itens_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricao_itens_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricoes: {
        Row: {
          assinada_em: string | null
          created_at: string
          criada_por: string | null
          id: string
          medico_id: string
          observacoes: string | null
          paciente_id: string
          status: string
          unidade_id: string
          updated_at: string
          valida_ate: string | null
        }
        Insert: {
          assinada_em?: string | null
          created_at?: string
          criada_por?: string | null
          id?: string
          medico_id: string
          observacoes?: string | null
          paciente_id: string
          status?: string
          unidade_id: string
          updated_at?: string
          valida_ate?: string | null
        }
        Update: {
          assinada_em?: string | null
          created_at?: string
          criada_por?: string | null
          id?: string
          medico_id?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
          valida_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescricoes_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_retidas: {
        Row: {
          codigo_retencao: string
          created_at: string
          data_retencao: string
          farmaceutico_nome: string | null
          farmacia_cnpj: string | null
          farmacia_nome: string | null
          id: string
          prescricao_id: string
        }
        Insert: {
          codigo_retencao: string
          created_at?: string
          data_retencao?: string
          farmaceutico_nome?: string | null
          farmacia_cnpj?: string | null
          farmacia_nome?: string | null
          id?: string
          prescricao_id: string
        }
        Update: {
          codigo_retencao?: string
          created_at?: string
          data_retencao?: string
          farmaceutico_nome?: string | null
          farmacia_cnpj?: string | null
          farmacia_nome?: string | null
          id?: string
          prescricao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receitas_retidas_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["tipo_setor"]
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["tipo_setor"]
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["tipo_setor"]
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          perfil_id: string
        }
        Insert: {
          created_at?: string
          perfil_id: string
        }
        Update: {
          created_at?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admins_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          cnes: string | null
          created_at: string
          id: string
          municipio: string | null
          nome: string
          organizacao_id: string
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnes?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome: string
          organizacao_id: string
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnes?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome?: string
          organizacao_id?: string
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      vinculos: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          id: string
          papel: Database["public"]["Enums"]["papel"]
          perfil_id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          papel: Database["public"]["Enums"]["papel"]
          perfil_id: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          papel?: Database["public"]["Enums"]["papel"]
          perfil_id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_censo_unidade: {
        Row: {
          leitos_bloqueados: number | null
          leitos_higienizacao: number | null
          leitos_livres: number | null
          leitos_ocupados: number | null
          total_leitos: number | null
          total_setores: number | null
          unidade_id: string | null
          unidade_nome: string | null
          unidade_tipo: Database["public"]["Enums"]["tipo_unidade"] | null
        }
        Relationships: []
      }
      vw_indicadores_unidade: {
        Row: {
          prescricoes_assinadas: number | null
          prescricoes_rascunho: number | null
          receitas_retidas: number | null
          total_pacientes: number | null
          unidade_id: string | null
          unidade_nome: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      eh_super_admin: { Args: never; Returns: boolean }
      horario_servidor: { Args: never; Returns: string }
      na_escala_agora: { Args: { unidade: string }; Returns: boolean }
      papel_na_unidade: { Args: { unidade: string }; Returns: string }
      registrar_auditoria: {
        Args: {
          p_acao: string
          p_entidade: string
          p_entidade_id?: string
          p_payload?: Json
          p_unidade_id?: string
        }
        Returns: string
      }
      tem_acesso_atendimento: { Args: { unidade: string }; Returns: boolean }
      turno_atual: { Args: never; Returns: string }
    }
    Enums: {
      papel: "admin" | "gestor" | "plantonista"
      status_leito: "livre" | "ocupado" | "bloqueado" | "higienizacao"
      tipo_leito: "clinico" | "isolamento" | "estabilizacao" | "observacao"
      tipo_setor:
        | "emergencia"
        | "observacao"
        | "internacao"
        | "isolamento"
        | "uti"
        | "outro"
      tipo_unidade: "hospital" | "upa" | "clinica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      papel: ["admin", "gestor", "plantonista"],
      status_leito: ["livre", "ocupado", "bloqueado", "higienizacao"],
      tipo_leito: ["clinico", "isolamento", "estabilizacao", "observacao"],
      tipo_setor: [
        "emergencia",
        "observacao",
        "internacao",
        "isolamento",
        "uti",
        "outro",
      ],
      tipo_unidade: ["hospital", "upa", "clinica"],
    },
  },
} as const

export type Perfis = Database['public']['Tables']['perfis']

export type Perfil = Perfis['Row']

export type Banners = Database['public']['Tables']['banners']

export type Papel = Database['public']['Enums']['papel']

export type StatusLeito = Database['public']['Enums']['status_leito']

export type TipoLeito = Database['public']['Enums']['tipo_leito']

export type TipoSetor = Database['public']['Enums']['tipo_setor']

export type TipoUnidade = Database['public']['Enums']['tipo_unidade']

