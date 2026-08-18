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
      alta_paciente: {
        Row: {
          created_at: string
          criado_por: string | null
          criterios: Json
          id: string
          justificativa: string | null
          liberou_leito: boolean
          paciente_id: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          criterios?: Json
          id?: string
          justificativa?: string | null
          liberou_leito?: boolean
          paciente_id: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          criterios?: Json
          id?: string
          justificativa?: string | null
          liberou_leito?: boolean
          paciente_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alta_paciente_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alta_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alta_paciente_unidade_id_fkey"
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
      candidaturas_escala: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          decidido_por: string | null
          id: string
          perfil_id: string
          setor_id: string
          status: string
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data: string
          decidido_por?: string | null
          id?: string
          perfil_id: string
          setor_id: string
          status?: string
          turno: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          decidido_por?: string | null
          id?: string
          perfil_id?: string
          setor_id?: string
          status?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidaturas_escala_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escala_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escala_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escala_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidaturas_escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_ocupacao: {
        Row: {
          criado_em: string
          data: string
          giro_leito: number | null
          internados: number
          leitos_bloqueados: number
          leitos_higienizacao: number
          leitos_livres: number
          leitos_ocupados: number
          leitos_total: number
          organizacao_id: string
          permanencia_media_h: number | null
          setor_id: string
          snapshot: Json | null
          taxa_ocupacao: number | null
          turno: string
          unidade_id: string
        }
        Insert: {
          criado_em?: string
          data: string
          giro_leito?: number | null
          internados?: number
          leitos_bloqueados?: number
          leitos_higienizacao?: number
          leitos_livres?: number
          leitos_ocupados?: number
          leitos_total?: number
          organizacao_id: string
          permanencia_media_h?: number | null
          setor_id: string
          snapshot?: Json | null
          taxa_ocupacao?: number | null
          turno?: string
          unidade_id: string
        }
        Update: {
          criado_em?: string
          data?: string
          giro_leito?: number | null
          internados?: number
          leitos_bloqueados?: number
          leitos_higienizacao?: number
          leitos_livres?: number
          leitos_ocupados?: number
          leitos_total?: number
          organizacao_id?: string
          permanencia_media_h?: number | null
          setor_id?: string
          snapshot?: Json | null
          taxa_ocupacao?: number | null
          turno?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "censo_ocupacao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_ocupacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_admissao: {
        Row: {
          atualizado_por: string | null
          created_at: string
          dieta: boolean
          id: string
          leito: boolean
          paciente_id: string
          prescricao: boolean
          responsavel: boolean
          unidade_id: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string
          dieta?: boolean
          id?: string
          leito?: boolean
          paciente_id: string
          prescricao?: boolean
          responsavel?: boolean
          unidade_id: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string
          dieta?: boolean
          id?: string
          leito?: boolean
          paciente_id?: string
          prescricao?: boolean
          responsavel?: boolean
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_admissao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_admissao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: true
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_admissao_unidade_id_fkey"
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
      diluicao: {
        Row: {
          acesso: string | null
          ajuste_renal: boolean | null
          ajuste_renal_regra: string | null
          alta_vigilancia: boolean | null
          apresentacao: string
          bolus_permitido: boolean | null
          concentracao_maxima: string | null
          created_at: string
          data_revisao: string | null
          diluicao_solucao: string[] | null
          diluicao_volume_min_ml: number | null
          estabilidade_refrig_h: number | null
          estabilidade_ta_h: number | null
          fonte: string
          fotossensivel: boolean | null
          id: string
          incompatibilidades: string[] | null
          medicamento_id: string | null
          observacoes: string | null
          principio_ativo: string
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          status: string
          tempo_infusao_min: number | null
          updated_at: string
          velocidade_max: string | null
          via: string
        }
        Insert: {
          acesso?: string | null
          ajuste_renal?: boolean | null
          ajuste_renal_regra?: string | null
          alta_vigilancia?: boolean | null
          apresentacao: string
          bolus_permitido?: boolean | null
          concentracao_maxima?: string | null
          created_at?: string
          data_revisao?: string | null
          diluicao_solucao?: string[] | null
          diluicao_volume_min_ml?: number | null
          estabilidade_refrig_h?: number | null
          estabilidade_ta_h?: number | null
          fonte: string
          fotossensivel?: boolean | null
          id?: string
          incompatibilidades?: string[] | null
          medicamento_id?: string | null
          observacoes?: string | null
          principio_ativo: string
          reconstituicao_concentracao?: string | null
          reconstituicao_diluente?: string | null
          reconstituicao_volume_ml?: number | null
          revisor_crf?: string | null
          status?: string
          tempo_infusao_min?: number | null
          updated_at?: string
          velocidade_max?: string | null
          via: string
        }
        Update: {
          acesso?: string | null
          ajuste_renal?: boolean | null
          ajuste_renal_regra?: string | null
          alta_vigilancia?: boolean | null
          apresentacao?: string
          bolus_permitido?: boolean | null
          concentracao_maxima?: string | null
          created_at?: string
          data_revisao?: string | null
          diluicao_solucao?: string[] | null
          diluicao_volume_min_ml?: number | null
          estabilidade_refrig_h?: number | null
          estabilidade_ta_h?: number | null
          fonte?: string
          fotossensivel?: boolean | null
          id?: string
          incompatibilidades?: string[] | null
          medicamento_id?: string | null
          observacoes?: string | null
          principio_ativo?: string
          reconstituicao_concentracao?: string | null
          reconstituicao_diluente?: string | null
          reconstituicao_volume_ml?: number | null
          revisor_crf?: string | null
          status?: string
          tempo_infusao_min?: number | null
          updated_at?: string
          velocidade_max?: string | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "diluicao_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_clinicos: {
        Row: {
          assinado_em: string | null
          assinatura_id: string | null
          autor_id: string
          carimbo_tempo: string | null
          conteudo: string
          conteudo_hash: string
          created_at: string
          documento_raiz_id: string
          estado: string
          id: string
          internacao_id: string | null
          motivo_retificacao: string | null
          organizacao_id: string
          paciente_id: string
          retificacao_de: string | null
          tipo_documento: string
          unidade_id: string
          updated_at: string
          versao: number
        }
        Insert: {
          assinado_em?: string | null
          assinatura_id?: string | null
          autor_id: string
          carimbo_tempo?: string | null
          conteudo: string
          conteudo_hash: string
          created_at?: string
          documento_raiz_id: string
          estado?: string
          id?: string
          internacao_id?: string | null
          motivo_retificacao?: string | null
          organizacao_id: string
          paciente_id: string
          retificacao_de?: string | null
          tipo_documento: string
          unidade_id: string
          updated_at?: string
          versao?: number
        }
        Update: {
          assinado_em?: string | null
          assinatura_id?: string | null
          autor_id?: string
          carimbo_tempo?: string | null
          conteudo?: string
          conteudo_hash?: string
          created_at?: string
          documento_raiz_id?: string
          estado?: string
          id?: string
          internacao_id?: string | null
          motivo_retificacao?: string | null
          organizacao_id?: string
          paciente_id?: string
          retificacao_de?: string | null
          tipo_documento?: string
          unidade_id?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_clinicos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_retificacao_de_fkey"
            columns: ["retificacao_de"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_fixa: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          dia_semana: number
          id: string
          perfil_id: string
          quinzenal: boolean
          setor_id: string
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          dia_semana: number
          id?: string
          perfil_id: string
          quinzenal?: boolean
          setor_id: string
          turno: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          dia_semana?: number
          id?: string
          perfil_id?: string
          quinzenal?: boolean
          setor_id?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_fixa_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_fixa_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_fixa_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_fixa_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_plantao: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          data: string
          fracionado: boolean
          id: string
          observacao: string | null
          perfil_id: string
          plantao_origem_id: string | null
          quinzenal: boolean
          rotulo: string | null
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
          fracionado?: boolean
          id?: string
          observacao?: string | null
          perfil_id: string
          plantao_origem_id?: string | null
          quinzenal?: boolean
          rotulo?: string | null
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
          fracionado?: boolean
          id?: string
          observacao?: string | null
          perfil_id?: string
          plantao_origem_id?: string | null
          quinzenal?: boolean
          rotulo?: string | null
          setor_id?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_plantao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantao_plantao_origem_id_fkey"
            columns: ["plantao_origem_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_plantao_unidade_id_fkey"
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
      eventos_adt: {
        Row: {
          autor_id: string
          created_at: string
          estado_antes: Json | null
          estado_depois: Json | null
          hash_conteudo: string
          hash_previo: string | null
          id: string
          internacao_id: string
          leito_destino_id: string | null
          leito_origem_id: string | null
          motivo: string | null
          organizacao_id: string
          paciente_id: string
          payload: Json | null
          seq: number
          setor_destino_id: string | null
          setor_origem_id: string | null
          tipo_evento: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          estado_antes?: Json | null
          estado_depois?: Json | null
          hash_conteudo: string
          hash_previo?: string | null
          id?: string
          internacao_id: string
          leito_destino_id?: string | null
          leito_origem_id?: string | null
          motivo?: string | null
          organizacao_id: string
          paciente_id: string
          payload?: Json | null
          seq: number
          setor_destino_id?: string | null
          setor_origem_id?: string | null
          tipo_evento: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          estado_antes?: Json | null
          estado_depois?: Json | null
          hash_conteudo?: string
          hash_previo?: string | null
          id?: string
          internacao_id?: string
          leito_destino_id?: string | null
          leito_origem_id?: string | null
          motivo?: string | null
          organizacao_id?: string
          paciente_id?: string
          payload?: Json | null
          seq?: number
          setor_destino_id?: string | null
          setor_origem_id?: string | null
          tipo_evento?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_adt_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adt_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adt_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_leito: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          internacao_id: string | null
          leito_id: string
          motivo: string | null
          status_antes: Database["public"]["Enums"]["status_leito"] | null
          status_depois: Database["public"]["Enums"]["status_leito"] | null
          tipo_evento: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          internacao_id?: string | null
          leito_id: string
          motivo?: string | null
          status_antes?: Database["public"]["Enums"]["status_leito"] | null
          status_depois?: Database["public"]["Enums"]["status_leito"] | null
          tipo_evento: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          internacao_id?: string | null
          leito_id?: string
          motivo?: string | null
          status_antes?: Database["public"]["Enums"]["status_leito"] | null
          status_depois?: Database["public"]["Enums"]["status_leito"] | null
          tipo_evento?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_leito_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_leito_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_leito_leito_id_fkey"
            columns: ["leito_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_leito_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_escala: {
        Row: {
          acao: string
          created_at: string
          dados: Json | null
          detalhe: string | null
          id: string
          perfil_id: string | null
          plantao_id: string | null
          unidade_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          dados?: Json | null
          detalhe?: string | null
          id?: string
          perfil_id?: string | null
          plantao_id?: string | null
          unidade_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          dados?: Json | null
          detalhe?: string | null
          id?: string
          perfil_id?: string | null
          plantao_id?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_escala_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      internacoes: {
        Row: {
          cid_principal: string | null
          created_at: string
          data_admissao: string
          data_alta: string | null
          data_entrada_setor: string | null
          id: string
          leito_atual_id: string | null
          motivo_alta: string | null
          organizacao_id: string
          origem_admissao: string
          paciente_id: string
          setor_atual_id: string | null
          status: string
          tipo_internacao: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          cid_principal?: string | null
          created_at?: string
          data_admissao?: string
          data_alta?: string | null
          data_entrada_setor?: string | null
          id?: string
          leito_atual_id?: string | null
          motivo_alta?: string | null
          organizacao_id: string
          origem_admissao?: string
          paciente_id: string
          setor_atual_id?: string | null
          status?: string
          tipo_internacao?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          cid_principal?: string | null
          created_at?: string
          data_admissao?: string
          data_alta?: string | null
          data_entrada_setor?: string | null
          id?: string
          leito_atual_id?: string | null
          motivo_alta?: string | null
          organizacao_id?: string
          origem_admissao?: string
          paciente_id?: string
          setor_atual_id?: string | null
          status?: string
          tipo_internacao?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internacoes_leito_atual_id_fkey"
            columns: ["leito_atual_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_setor_atual_id_fkey"
            columns: ["setor_atual_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_unidade_id_fkey"
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
      log_acesso_prontuario: {
        Row: {
          acessado_por: string
          created_at: string
          documento_id: string | null
          id: string
          internacao_id: string | null
          ip: unknown
          organizacao_id: string
          paciente_id: string
          papel: string | null
          tipo_acesso: string
          unidade_id: string
          user_agent: string | null
        }
        Insert: {
          acessado_por: string
          created_at?: string
          documento_id?: string | null
          id?: string
          internacao_id?: string | null
          ip?: unknown
          organizacao_id: string
          paciente_id: string
          papel?: string | null
          tipo_acesso?: string
          unidade_id: string
          user_agent?: string | null
        }
        Update: {
          acessado_por?: string
          created_at?: string
          documento_id?: string | null
          id?: string
          internacao_id?: string | null
          ip?: unknown
          organizacao_id?: string
          paciente_id?: string
          papel?: string | null
          tipo_acesso?: string
          unidade_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_acesso_prontuario_acessado_por_fkey"
            columns: ["acessado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_acesso_prontuario_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_acesso_prontuario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_acesso_prontuario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      medicamento: {
        Row: {
          alta_vigilancia: boolean
          anvisa_empresa: string | null
          anvisa_produto: string | null
          anvisa_registro: string | null
          anvisa_situacao: string | null
          apresentacao: string | null
          ativo: boolean
          concentracao: string | null
          created_at: string
          fonte: string
          id: string
          obm_ampp: string | null
          obm_id: string | null
          principio_ativo: string
          principio_ativo_norm: string
          rxcui: string | null
          setor_uso: string | null
          updated_at: string
        }
        Insert: {
          alta_vigilancia?: boolean
          anvisa_empresa?: string | null
          anvisa_produto?: string | null
          anvisa_registro?: string | null
          anvisa_situacao?: string | null
          apresentacao?: string | null
          ativo?: boolean
          concentracao?: string | null
          created_at?: string
          fonte?: string
          id?: string
          obm_ampp?: string | null
          obm_id?: string | null
          principio_ativo: string
          principio_ativo_norm: string
          rxcui?: string | null
          setor_uso?: string | null
          updated_at?: string
        }
        Update: {
          alta_vigilancia?: boolean
          anvisa_empresa?: string | null
          anvisa_produto?: string | null
          anvisa_registro?: string | null
          anvisa_situacao?: string | null
          apresentacao?: string | null
          ativo?: boolean
          concentracao?: string | null
          created_at?: string
          fonte?: string
          id?: string
          obm_ampp?: string | null
          obm_id?: string | null
          principio_ativo?: string
          principio_ativo_norm?: string
          rxcui?: string | null
          setor_uso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medicamento_bula: {
        Row: {
          created_at: string
          fonte: string
          generic_name: string | null
          id: string
          medicamento_id: string | null
          principio_ativo: string
          rxcui: string | null
          set_id: string | null
          texto_referencia_en: string | null
        }
        Insert: {
          created_at?: string
          fonte?: string
          generic_name?: string | null
          id?: string
          medicamento_id?: string | null
          principio_ativo: string
          rxcui?: string | null
          set_id?: string | null
          texto_referencia_en?: string | null
        }
        Update: {
          created_at?: string
          fonte?: string
          generic_name?: string | null
          id?: string
          medicamento_id?: string | null
          principio_ativo?: string
          rxcui?: string | null
          set_id?: string | null
          texto_referencia_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicamento_bula_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: true
            referencedRelation: "medicamento"
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
          diluicao: string | null
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
          diluicao?: string | null
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
          diluicao?: string | null
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
      mensagens_chat: {
        Row: {
          conteudo: string
          created_at: string
          criado_por: string | null
          destinatario_id: string | null
          id: string
          lida_em: string | null
          remetente_id: string
          unidade_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          criado_por?: string | null
          destinatario_id?: string | null
          id?: string
          lida_em?: string | null
          remetente_id: string
          unidade_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          destinatario_id?: string | null
          id?: string
          lida_em?: string | null
          remetente_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_chat_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_chat_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_chat_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_chat_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_plantonista: {
        Row: {
          created_at: string
          data: string
          id: string
          lida_em: string | null
          mensagem: string
          perfil_id: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          lida_em?: string | null
          mensagem: string
          perfil_id: string
          tipo: string
          unidade_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          lida_em?: string | null
          mensagem?: string
          perfil_id?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_plantonista_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_plantonista_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
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
          dados_pessoais: Json
          email: string | null
          foto_url: string | null
          id: string
          nome_completo: string
          telefone: string | null
          tipo_sanguineo: string | null
          uf_crm: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          crm?: string | null
          dados_pessoais?: Json
          email?: string | null
          foto_url?: string | null
          id: string
          nome_completo: string
          telefone?: string | null
          tipo_sanguineo?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          crm?: string | null
          dados_pessoais?: Json
          email?: string | null
          foto_url?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
          tipo_sanguineo?: string | null
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
      presenca_plantonista: {
        Row: {
          checkin_dentro: boolean | null
          checkin_em: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_dentro: boolean | null
          checkout_em: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          created_at: string
          criado_por: string | null
          data: string
          escala_plantao_id: string | null
          id: string
          observacao: string | null
          perfil_id: string
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          checkin_dentro?: boolean | null
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_dentro?: boolean | null
          checkout_em?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          criado_por?: string | null
          data: string
          escala_plantao_id?: string | null
          id?: string
          observacao?: string | null
          perfil_id: string
          turno: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          checkin_dentro?: boolean | null
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_dentro?: boolean | null
          checkout_em?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          criado_por?: string | null
          data?: string
          escala_plantao_id?: string | null
          id?: string
          observacao?: string | null
          perfil_id?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenca_plantonista_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_plantonista_escala_plantao_id_fkey"
            columns: ["escala_plantao_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_plantonista_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_plantonista_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          criado_em: string
          endpoint: string
          id: string
          perfil_id: string
          subscription: Json
        }
        Insert: {
          criado_em?: string
          endpoint: string
          id?: string
          perfil_id: string
          subscription: Json
        }
        Update: {
          criado_em?: string
          endpoint?: string
          id?: string
          perfil_id?: string
          subscription?: Json
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
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
      remuneracoes_plantao: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          id: string
          setor_id: string | null
          turno: string | null
          unidade_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          setor_id?: string | null
          turno?: string | null
          unidade_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          setor_id?: string | null
          turno?: string | null
          unidade_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "remuneracoes_plantao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remuneracoes_plantao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remuneracoes_plantao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          especialidade: string | null
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
          especialidade?: string | null
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
          especialidade?: string | null
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
      solicitacoes_escala: {
        Row: {
          anexo_url: string | null
          created_at: string
          criado_por: string | null
          decidido_por: string | null
          destino_perfil_id: string | null
          escala_plantao_id: string
          id: string
          justificativa: string | null
          perfil_id: string
          status: string
          tipo: string
          tipo_falta: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          criado_por?: string | null
          decidido_por?: string | null
          destino_perfil_id?: string | null
          escala_plantao_id: string
          id?: string
          justificativa?: string | null
          perfil_id: string
          status?: string
          tipo: string
          tipo_falta?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          criado_por?: string | null
          decidido_por?: string | null
          destino_perfil_id?: string | null
          escala_plantao_id?: string
          id?: string
          justificativa?: string | null
          perfil_id?: string
          status?: string
          tipo?: string
          tipo_falta?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_escala_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_escala_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_escala_destino_perfil_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_escala_escala_plantao_id_fkey"
            columns: ["escala_plantao_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_escala_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      sugestoes_prescricao: {
        Row: {
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          descricao: string
          gestor_id: string
          id: string
          internacao_id: string | null
          organizacao_id: string
          paciente_id: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao: string
          gestor_id: string
          id?: string
          internacao_id?: string | null
          organizacao_id: string
          paciente_id: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string
          gestor_id?: string
          id?: string
          internacao_id?: string | null
          organizacao_id?: string
          paciente_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_prescricao_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_prescricao_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_prescricao_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_prescricao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_prescricao_unidade_id_fkey"
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
      transferencias_paciente: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          paciente_id: string
          setor_destino_id: string
          setor_origem_id: string | null
          transferido_por: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          paciente_id: string
          setor_destino_id: string
          setor_origem_id?: string | null
          transferido_por: string
          unidade_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          paciente_id?: string
          setor_destino_id?: string
          setor_origem_id?: string | null
          transferido_por?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_paciente_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_paciente_setor_origem_id_fkey"
            columns: ["setor_origem_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_paciente_transferido_por_fkey"
            columns: ["transferido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_paciente_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      trocas_plantao: {
        Row: {
          created_at: string
          criado_por: string | null
          decidido_por: string | null
          erro: string | null
          id: string
          mensagem: string | null
          perfil_a_id: string
          perfil_b_id: string
          plantao_a_id: string
          plantao_b_id: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          decidido_por?: string | null
          erro?: string | null
          id?: string
          mensagem?: string | null
          perfil_a_id: string
          perfil_b_id: string
          plantao_a_id: string
          plantao_b_id: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          decidido_por?: string | null
          erro?: string | null
          id?: string
          mensagem?: string | null
          perfil_a_id?: string
          perfil_b_id?: string
          plantao_a_id?: string
          plantao_b_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trocas_plantao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_perfil_a_id_fkey"
            columns: ["perfil_a_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_perfil_b_id_fkey"
            columns: ["perfil_b_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_plantao_a_id_fkey"
            columns: ["plantao_a_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_plantao_b_id_fkey"
            columns: ["plantao_b_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_plantao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          canal_comunicacao: string
          cnes: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          municipio: string | null
          nome: string
          organizacao_id: string
          raio_metros: number
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          uf: string | null
          updated_at: string
          whatsapp_numero: string | null
        }
        Insert: {
          ativo?: boolean
          canal_comunicacao?: string
          cnes?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome: string
          organizacao_id: string
          raio_metros?: number
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          uf?: string | null
          updated_at?: string
          whatsapp_numero?: string | null
        }
        Update: {
          ativo?: boolean
          canal_comunicacao?: string
          cnes?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome?: string
          organizacao_id?: string
          raio_metros?: number
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          uf?: string | null
          updated_at?: string
          whatsapp_numero?: string | null
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
      abrir_internacao: {
        Args: {
          p_leito?: string
          p_origem_admissao?: string
          p_paciente: string
          p_setor?: string
          p_tipo_internacao?: string
          p_unidade: string
        }
        Returns: string
      }
      adicionar_plantao_escala: {
        Args: {
          p_data: string
          p_perfil: string
          p_quinzenal?: boolean
          p_rotulo?: string
          p_setor: string
          p_turno: string
          p_unidade: string
        }
        Returns: string
      }
      aprovar_candidatura: { Args: { p_candidatura: string }; Returns: string }
      aprovar_troca: { Args: { p_troca: string }; Returns: undefined }
      data_atual: { Args: never; Returns: string }
      diluicao_publicada: {
        Args: { p_medicamento: string }
        Returns: {
          acesso: string | null
          ajuste_renal: boolean | null
          ajuste_renal_regra: string | null
          alta_vigilancia: boolean | null
          apresentacao: string
          bolus_permitido: boolean | null
          concentracao_maxima: string | null
          created_at: string
          data_revisao: string | null
          diluicao_solucao: string[] | null
          diluicao_volume_min_ml: number | null
          estabilidade_refrig_h: number | null
          estabilidade_ta_h: number | null
          fonte: string
          fotossensivel: boolean | null
          id: string
          incompatibilidades: string[] | null
          medicamento_id: string | null
          observacoes: string | null
          principio_ativo: string
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          status: string
          tempo_infusao_min: number | null
          updated_at: string
          velocidade_max: string | null
          via: string
        }[]
        SetofOptions: {
          from: "*"
          to: "diluicao"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      diluicoes_rascunho: {
        Args: never
        Returns: {
          acesso: string | null
          ajuste_renal: boolean | null
          ajuste_renal_regra: string | null
          alta_vigilancia: boolean | null
          apresentacao: string
          bolus_permitido: boolean | null
          concentracao_maxima: string | null
          created_at: string
          data_revisao: string | null
          diluicao_solucao: string[] | null
          diluicao_volume_min_ml: number | null
          estabilidade_refrig_h: number | null
          estabilidade_ta_h: number | null
          fonte: string
          fotossensivel: boolean | null
          id: string
          incompatibilidades: string[] | null
          medicamento_id: string | null
          observacoes: string | null
          principio_ativo: string
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          status: string
          tempo_infusao_min: number | null
          updated_at: string
          velocidade_max: string | null
          via: string
        }[]
        SetofOptions: {
          from: "*"
          to: "diluicao"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      eh_super_admin: { Args: never; Returns: boolean }
      fracionar_plantao: {
        Args: { p_partes?: number; p_plantao: string }
        Returns: number
      }
      gerar_escala_mensal: {
        Args: { p_ano: number; p_mes: number; p_unidade: string }
        Returns: number
      }
      gerar_extrato_plantonista: {
        Args: { p_fim: string; p_inicio: string; p_unidade: string }
        Returns: {
          data: string
          nome_completo: string
          perfil_id: string
          plantao_id: string
          setor_id: string
          setor_nome: string
          turno: string
          valor: number
        }[]
      }
      gerar_notificacoes_turno: {
        Args: { p_unidade: string }
        Returns: {
          created_at: string
          id: string
          mensagem: string
          tipo: string
        }[]
      }
      horario_servidor: { Args: never; Returns: string }
      marcar_notificacao_lida: { Args: { p_id: string }; Returns: undefined }
      minhas_notificacoes: {
        Args: { p_unidade: string }
        Returns: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
        }[]
      }
      na_escala_agora: { Args: { unidade: string }; Returns: boolean }
      ocupacao_setores: {
        Args: { p_unidade: string }
        Returns: {
          internados: number
          limite: number
          setor_id: string
          setor_nome: string
        }[]
      }
      papel_na_unidade: { Args: { unidade: string }; Returns: string }
      passar_plantao: {
        Args: { p_destino: string; p_escala: string; p_justificativa?: string }
        Returns: string
      }
      plantonistas_da_unidade: {
        Args: { p_unidade: string }
        Returns: {
          crm: string
          email: string
          nome_completo: string
          perfil_id: string
          uf_crm: string
        }[]
      }
      publicar_diluicao: {
        Args: {
          p_data_revisao?: string
          p_diluicao: string
          p_revisor_crf: string
        }
        Returns: undefined
      }
      recusar_troca: {
        Args: { p_motivo?: string; p_troca: string }
        Returns: undefined
      }
      registrar_acesso_prontuario: {
        Args: {
          p_documento?: string
          p_internacao?: string
          p_paciente: string
          p_tipo_acesso?: string
          p_unidade: string
        }
        Returns: undefined
      }
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
      registrar_checkin: {
        Args: {
          p_lat: number
          p_lng: number
          p_observacao?: string
          p_unidade: string
        }
        Returns: string
      }
      registrar_checkout: {
        Args: { p_lat: number; p_lng: number; p_registro: string }
        Returns: undefined
      }
      registrar_evento_adt: {
        Args: {
          p_internacao: string
          p_leito_destino?: string
          p_motivo?: string
          p_payload?: Json
          p_setor_destino?: string
          p_tipo_evento: string
        }
        Returns: undefined
      }
      registrar_prescricao_itens: {
        Args: { p_itens?: Json; p_observacoes?: string; p_paciente: string }
        Returns: string
      }
      registrar_prescricao_observacao: {
        Args: { p_observacoes?: string; p_paciente: string }
        Returns: string
      }
      remover_fracionamento: { Args: { p_plantao: string }; Returns: undefined }
      resumo_carga_plantonistas: {
        Args: { p_fim: string; p_inicio: string; p_unidade: string }
        Returns: {
          dias: number
          diurnos: number
          horas: number
          nome: string
          noturnos: number
          perfil_id: string
        }[]
      }
      salvar_documento: {
        Args: {
          p_conteudo: string
          p_internacao?: string
          p_motivo_retificacao?: string
          p_paciente: string
          p_tipo: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_push_subscription: {
        Args: { p_subscription: string }
        Returns: undefined
      }
      setores_internacao: {
        Args: { p_unidade: string }
        Returns: {
          id: string
          nome: string
          ordem: number
          tipo: string
        }[]
      }
      setores_na_escala_agora: { Args: never; Returns: string[] }
      setores_observacao: {
        Args: { p_unidade: string }
        Returns: {
          id: string
          nome: string
          ordem: number
          tipo: string
        }[]
      }
      solicitar_troca: {
        Args: { p_mensagem?: string; p_plantao_a: string; p_plantao_b: string }
        Returns: string
      }
      tem_acesso_atendimento: { Args: { unidade: string }; Returns: boolean }
      transferir_paciente: {
        Args: { p_destino: string; p_motivo?: string; p_paciente: string }
        Returns: string
      }
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
export type NotificacaoPlantonista = Database['public']['Tables']['notificacoes_plantonista']['Row']
export type ChecklistAdmissao = Database['public']['Tables']['checklist_admissao']['Row']
export type AltaPaciente = Database['public']['Tables']['alta_paciente']['Row']
export type Papel = Database['public']['Enums']['papel']
export type StatusLeito = Database['public']['Enums']['status_leito']
export type TipoLeito = Database['public']['Enums']['tipo_leito']
export type TipoSetor = Database['public']['Enums']['tipo_setor']
export type TipoUnidade = Database['public']['Enums']['tipo_unidade']
export type PlantonistaDaUnidade = Database['public']['Functions']['plantonistas_da_unidade']['Returns'][number]
export type SetorInternacao = Database['public']['Functions']['setores_internacao']['Returns'][number]
export type SetorObservacao = Database['public']['Functions']['setores_observacao']['Returns'][number]
export type ResumoCargaPlantonista = Database['public']['Functions']['resumo_carga_plantonistas']['Returns'][number]
export type OcupacaoSetor = Database['public']['Functions']['ocupacao_setores']['Returns'][number]
export type MinhaNotificacao = Database['public']['Functions']['minhas_notificacoes']['Returns'][number]
