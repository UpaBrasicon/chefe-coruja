export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      aceites_termo: {
        Row: {
          aceito_em: string
          id: string
          origem: string
          perfil_id: string
          referencia: string | null
          versao: string
        }
        Insert: {
          aceito_em?: string
          id?: string
          origem: string
          perfil_id: string
          referencia?: string | null
          versao: string
        }
        Update: {
          aceito_em?: string
          id?: string
          origem?: string
          perfil_id?: string
          referencia?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "aceites_termo_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
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
      acuidade_afericoes: {
        Row: {
          aferido_em: string
          banda: number
          calculado_em: string
          escala: string
          id: string
          paciente_id: string
          parcial: boolean
          total: number
          unidade_id: string
        }
        Insert: {
          aferido_em: string
          banda: number
          calculado_em?: string
          escala: string
          id?: string
          paciente_id: string
          parcial: boolean
          total: number
          unidade_id: string
        }
        Update: {
          aferido_em?: string
          banda?: number
          calculado_em?: string
          escala?: string
          id?: string
          paciente_id?: string
          parcial?: boolean
          total?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acuidade_afericoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acuidade_afericoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      adesoes_contrato: {
        Row: {
          contrato_id: string
          criado_em: string
          id: string
          papel: Database["public"]["Enums"]["papel"]
          perfil_id: string
        }
        Insert: {
          contrato_id: string
          criado_em?: string
          id?: string
          papel: Database["public"]["Enums"]["papel"]
          perfil_id: string
        }
        Update: {
          contrato_id?: string
          criado_em?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel"]
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adesoes_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_rede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesoes_contrato_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      administracoes: {
        Row: {
          horario_previsto: string | null
          id: string
          item_id: string
          motivo: string | null
          paciente_id: string
          registrado_em: string
          registrado_por: string
          situacao: string
          unidade_id: string
        }
        Insert: {
          horario_previsto?: string | null
          id?: string
          item_id: string
          motivo?: string | null
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          situacao: string
          unidade_id: string
        }
        Update: {
          horario_previsto?: string | null
          id?: string
          item_id?: string
          motivo?: string | null
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "administracoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "prescricao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracoes_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      admissao_detalhes_esquemas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          id: string
          itens: string[]
          nome: string
          unidade_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          itens: string[]
          nome: string
          unidade_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          itens?: string[]
          nome?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissao_detalhes_esquemas_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_detalhes_esquemas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      admissao_detalhes_obrigatorio: {
        Row: {
          definido_em: string
          definido_por: string | null
          setor_id: string
          unidade_id: string
        }
        Insert: {
          definido_em?: string
          definido_por?: string | null
          setor_id: string
          unidade_id: string
        }
        Update: {
          definido_em?: string
          definido_por?: string | null
          setor_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissao_detalhes_obrigatorio_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_detalhes_obrigatorio_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: true
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_detalhes_obrigatorio_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      admissao_fichas: {
        Row: {
          autor_id: string
          criado_em: string
          dados: Json
          detalhes: Json
          documento_id: string
          documento_raiz_id: string
          internacao_id: string
          paciente_id: string
          setor_id: string | null
          unidade_id: string
        }
        Insert: {
          autor_id: string
          criado_em?: string
          dados: Json
          detalhes?: Json
          documento_id: string
          documento_raiz_id: string
          internacao_id: string
          paciente_id: string
          setor_id?: string | null
          unidade_id: string
        }
        Update: {
          autor_id?: string
          criado_em?: string
          dados?: Json
          detalhes?: Json
          documento_id?: string
          documento_raiz_id?: string
          internacao_id?: string
          paciente_id?: string
          setor_id?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admissao_fichas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_fichas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_fichas_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_fichas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_fichas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissao_fichas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      agravos_notificacao: {
        Row: {
          agravo: string
          cid: string | null
          episodio_id: string | null
          ficha: Json
          id: string
          internacao_id: string | null
          lnnc_item: string | null
          motivo_descarte: string | null
          motivo_reabertura: string | null
          numero_sinan: string | null
          origem: string
          paciente_id: string
          reaberto_em: string | null
          reaberto_por: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          situacao: string
          suspeito_em: string
          suspeito_por: string
          unidade_id: string
        }
        Insert: {
          agravo: string
          cid?: string | null
          episodio_id?: string | null
          ficha?: Json
          id?: string
          internacao_id?: string | null
          lnnc_item?: string | null
          motivo_descarte?: string | null
          motivo_reabertura?: string | null
          numero_sinan?: string | null
          origem?: string
          paciente_id: string
          reaberto_em?: string | null
          reaberto_por?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          situacao?: string
          suspeito_em?: string
          suspeito_por: string
          unidade_id: string
        }
        Update: {
          agravo?: string
          cid?: string | null
          episodio_id?: string | null
          ficha?: Json
          id?: string
          internacao_id?: string | null
          lnnc_item?: string | null
          motivo_descarte?: string | null
          motivo_reabertura?: string | null
          numero_sinan?: string | null
          origem?: string
          paciente_id?: string
          reaberto_em?: string | null
          reaberto_por?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          situacao?: string
          suspeito_em?: string
          suspeito_por?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agravos_notificacao_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_lnnc_item_fkey"
            columns: ["lnnc_item"]
            isOneToOne: false
            referencedRelation: "lnnc_agravos"
            referencedColumns: ["item"]
          },
          {
            foreignKeyName: "agravos_notificacao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_suspeito_por_fkey"
            columns: ["suspeito_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agravos_notificacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      alergias_negacoes: {
        Row: {
          encerrada_em: string | null
          encerrada_por: string | null
          id: string
          motivo_encerramento: string | null
          paciente_id: string
          registrado_em: string
          registrado_por: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          motivo_encerramento?: string | null
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          tipo?: string
          unidade_id: string
        }
        Update: {
          encerrada_em?: string | null
          encerrada_por?: string | null
          id?: string
          motivo_encerramento?: string | null
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alergias_negacoes_encerrada_por_fkey"
            columns: ["encerrada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_negacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_negacoes_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_negacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      alergias_paciente: {
        Row: {
          gravidade: string
          id: string
          inativada_em: string | null
          inativada_por: string | null
          medicamento_id: string | null
          motivo_inativacao: string | null
          paciente_id: string
          reacao: string | null
          registrado_em: string
          registrado_por: string
          substancia: string
          substancia_norm: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          gravidade?: string
          id?: string
          inativada_em?: string | null
          inativada_por?: string | null
          medicamento_id?: string | null
          motivo_inativacao?: string | null
          paciente_id: string
          reacao?: string | null
          registrado_em?: string
          registrado_por: string
          substancia: string
          substancia_norm: string
          tipo?: string
          unidade_id: string
        }
        Update: {
          gravidade?: string
          id?: string
          inativada_em?: string | null
          inativada_por?: string | null
          medicamento_id?: string | null
          motivo_inativacao?: string | null
          paciente_id?: string
          reacao?: string | null
          registrado_em?: string
          registrado_por?: string
          substancia?: string
          substancia_norm?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alergias_paciente_inativada_por_fkey"
            columns: ["inativada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_paciente_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_paciente_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alergias_paciente_unidade_id_fkey"
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
      anexos_prontuario: {
        Row: {
          autor_id: string
          caminho: string
          cancelado_em: string | null
          cancelado_por: string | null
          criado_em: string
          episodio_id: string | null
          id: string
          motivo_cancelamento: string | null
          nome: string
          organizacao_id: string
          paciente_id: string
          tamanho: number
          tipo_mime: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          caminho: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          episodio_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nome: string
          organizacao_id: string
          paciente_id: string
          tamanho: number
          tipo_mime: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          caminho?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          episodio_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nome?: string
          organizacao_id?: string
          paciente_id?: string
          tamanho?: number
          tipo_mime?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_prontuario_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_prontuario_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_prontuario_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_prontuario_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_prontuario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_prontuario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos_farmacia: {
        Row: {
          caminho: string
          enviado_em: string
          enviado_por: string
          id: string
          nome: string
          tamanho: number
          tipo: string
          tipo_mime: string | null
          unidade_id: string
        }
        Insert: {
          caminho: string
          enviado_em?: string
          enviado_por: string
          id?: string
          nome: string
          tamanho: number
          tipo: string
          tipo_mime?: string | null
          unidade_id: string
        }
        Update: {
          caminho?: string
          enviado_em?: string
          enviado_por?: string
          id?: string
          nome?: string
          tamanho?: number
          tipo?: string
          tipo_mime?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_farmacia_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivos_farmacia_unidade_id_fkey"
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
      atendimento_rascunhos: {
        Row: {
          atualizado_em: string
          autor_id: string
          conteudo: Json
          episodio_id: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          autor_id: string
          conteudo: Json
          episodio_id: string
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          autor_id?: string
          conteudo?: Json
          episodio_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_rascunhos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_rascunhos_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_rascunhos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_reavaliacoes: {
        Row: {
          autor_id: string
          criado_em: string
          episodio_id: string
          id: string
          paciente_id: string
          pendencia: string | null
          reavaliar_em: string | null
          texto: string | null
          tipo: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          criado_em?: string
          episodio_id: string
          id?: string
          paciente_id: string
          pendencia?: string | null
          reavaliar_em?: string | null
          texto?: string | null
          tipo: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          criado_em?: string
          episodio_id?: string
          id?: string
          paciente_id?: string
          pendencia?: string | null
          reavaliar_em?: string | null
          texto?: string | null
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_reavaliacoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_reavaliacoes_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_reavaliacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_reavaliacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_registros: {
        Row: {
          autor_id: string
          avaliacao: string | null
          cid: string | null
          criado_em: string
          episodio_id: string
          id: string
          objetivo: string | null
          paciente_id: string
          plano: string | null
          subjetivo: string | null
          unidade_id: string
        }
        Insert: {
          autor_id: string
          avaliacao?: string | null
          cid?: string | null
          criado_em?: string
          episodio_id: string
          id?: string
          objetivo?: string | null
          paciente_id: string
          plano?: string | null
          subjetivo?: string | null
          unidade_id: string
        }
        Update: {
          autor_id?: string
          avaliacao?: string | null
          cid?: string | null
          criado_em?: string
          episodio_id?: string
          id?: string
          objetivo?: string | null
          paciente_id?: string
          plano?: string | null
          subjetivo?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_registros_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_registros_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_registros_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_registros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_escala: {
        Row: {
          cancelada_em: string | null
          cancelada_por: string | null
          episodio_id: string | null
          escala: string
          id: string
          internacao_id: string | null
          interpretacao: string
          motivo_cancelamento: string | null
          paciente_id: string
          registrado_em: string
          registrado_por: string
          respostas: Json
          total: number
          unidade_id: string
          versao: string
        }
        Insert: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          episodio_id?: string | null
          escala: string
          id?: string
          internacao_id?: string | null
          interpretacao: string
          motivo_cancelamento?: string | null
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          respostas: Json
          total: number
          unidade_id: string
          versao: string
        }
        Update: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          episodio_id?: string | null
          escala?: string
          id?: string
          internacao_id?: string | null
          interpretacao?: string
          motivo_cancelamento?: string | null
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          respostas?: Json
          total?: number
          unidade_id?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_escala_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escala_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escala_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escala_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escala_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      balanco_hidrico: {
        Row: {
          aferido_em: string
          cancelado_em: string | null
          cancelado_por: string | null
          descricao: string
          episodio_id: string | null
          id: string
          internacao_id: string | null
          motivo_cancelamento: string | null
          paciente_id: string
          registrado_em: string
          registrado_por: string
          tipo: string
          unidade_id: string
          volume_ml: number
        }
        Insert: {
          aferido_em: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          descricao: string
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          tipo: string
          unidade_id: string
          volume_ml: number
        }
        Update: {
          aferido_em?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          descricao?: string
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          tipo?: string
          unidade_id?: string
          volume_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "balanco_hidrico_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_hidrico_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_hidrico_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_hidrico_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_hidrico_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balanco_hidrico_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
          vaga_id: string | null
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
          vaga_id?: string | null
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
          vaga_id?: string | null
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
          {
            foreignKeyName: "candidaturas_escala_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "escala_vagas"
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
      cerbero_incidentes: {
        Row: {
          chave_dedup: string | null
          detectado_em: string
          diagnostico: string | null
          evidencia: Json
          id: string
          patrulha: string
          resolvido_em: string | null
          severidade: string
          status: string
          tenant_id: string | null
          titulo: string
        }
        Insert: {
          chave_dedup?: string | null
          detectado_em?: string
          diagnostico?: string | null
          evidencia?: Json
          id?: string
          patrulha: string
          resolvido_em?: string | null
          severidade: string
          status?: string
          tenant_id?: string | null
          titulo: string
        }
        Update: {
          chave_dedup?: string | null
          detectado_em?: string
          diagnostico?: string | null
          evidencia?: Json
          id?: string
          patrulha?: string
          resolvido_em?: string | null
          severidade?: string
          status?: string
          tenant_id?: string | null
          titulo?: string
        }
        Relationships: []
      }
      cerbero_quarentena: {
        Row: {
          autor_id: string
          conteudo_hash: string
          criado_em: string
          id: string
          incidente_id: string | null
          liberado: boolean
          motivo: string
          origem: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          autor_id: string
          conteudo_hash: string
          criado_em?: string
          id?: string
          incidente_id?: string | null
          liberado?: boolean
          motivo: string
          origem: string
          tenant_id: string
          tipo: string
        }
        Update: {
          autor_id?: string
          conteudo_hash?: string
          criado_em?: string
          id?: string
          incidente_id?: string | null
          liberado?: boolean
          motivo?: string
          origem?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cerbero_quarentena_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cerbero_quarentena_incidente_id_fkey"
            columns: ["incidente_id"]
            isOneToOne: false
            referencedRelation: "cerbero_incidentes"
            referencedColumns: ["id"]
          },
        ]
      }
      cerbero_url_cache: {
        Row: {
          detalhe: Json
          fonte: string
          url_hash: string
          veredicto: string
          verificado_em: string
        }
        Insert: {
          detalhe?: Json
          fonte: string
          url_hash: string
          veredicto: string
          verificado_em?: string
        }
        Update: {
          detalhe?: Json
          fonte?: string
          url_hash?: string
          veredicto?: string
          verificado_em?: string
        }
        Relationships: []
      }
      chamadas: {
        Row: {
          chamado_por: string
          criado_em: string
          episodio_id: string
          etapa: string
          id: string
          numero: number
          sala_id: string
          setor_id: string
          unidade_id: string
        }
        Insert: {
          chamado_por: string
          criado_em?: string
          episodio_id: string
          etapa: string
          id?: string
          numero: number
          sala_id: string
          setor_id: string
          unidade_id: string
        }
        Update: {
          chamado_por?: string
          criado_em?: string
          episodio_id?: string
          etapa?: string
          id?: string
          numero?: number
          sala_id?: string
          setor_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamadas_chamado_por_fkey"
            columns: ["chamado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_tecnicos: {
        Row: {
          aberto_em: string
          aberto_por: string
          atualizado_em: string
          categoria: string
          descricao: string | null
          id: string
          organizacao_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          responsavel: string | null
          severidade: string
          situacao: string
          titulo: string
          unidade_id: string | null
        }
        Insert: {
          aberto_em?: string
          aberto_por: string
          atualizado_em?: string
          categoria: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel?: string | null
          severidade: string
          situacao?: string
          titulo: string
          unidade_id?: string | null
        }
        Update: {
          aberto_em?: string
          aberto_por?: string
          atualizado_em?: string
          categoria?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          responsavel?: string | null
          severidade?: string
          situacao?: string
          titulo?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_tecnicos_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnicos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnicos_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnicos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_tecnicos_andamento: {
        Row: {
          autor_id: string
          chamado_id: string
          em: string
          id: string
          nota: string | null
          situacao: string
        }
        Insert: {
          autor_id: string
          chamado_id: string
          em?: string
          id?: string
          nota?: string | null
          situacao: string
        }
        Update: {
          autor_id?: string
          chamado_id?: string
          em?: string
          id?: string
          nota?: string | null
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamados_tecnicos_andamento_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tecnicos_andamento_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          autor_id: string
          conversa_id: string
          corpo: string
          criado_em: string
          editado_em: string | null
          excluida: boolean
          id: string
        }
        Insert: {
          autor_id: string
          conversa_id: string
          corpo: string
          criado_em?: string
          editado_em?: string | null
          excluida?: boolean
          id?: string
        }
        Update: {
          autor_id?: string
          conversa_id?: string
          corpo?: string
          criado_em?: string
          editado_em?: string | null
          excluida?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
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
      chronos_alertas_escala: {
        Row: {
          criado_em: string
          detalhe: Json
          id: string
          janela: string
          limite_outlier: number
          mediana_unidade: number
          medico_id: string
          metrica: string
          status: string
          unidade_id: string
          valor: number
        }
        Insert: {
          criado_em?: string
          detalhe?: Json
          id?: string
          janela: string
          limite_outlier: number
          mediana_unidade: number
          medico_id: string
          metrica: string
          status?: string
          unidade_id: string
          valor: number
        }
        Update: {
          criado_em?: string
          detalhe?: Json
          id?: string
          janela?: string
          limite_outlier?: number
          mediana_unidade?: number
          medico_id?: string
          metrica?: string
          status?: string
          unidade_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "chronos_alertas_escala_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronos_alertas_escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cid_infeccao_regras: {
        Row: {
          ate: string
          de: string
          grupo: string
        }
        Insert: {
          ate: string
          de: string
          grupo: string
        }
        Update: {
          ate?: string
          de?: string
          grupo?: string
        }
        Relationships: []
      }
      classe_alergenica: {
        Row: {
          atc: string
          fonte: string
          id: string
          nome: string
          sinonimos: string[]
        }
        Insert: {
          atc: string
          fonte?: string
          id?: string
          nome: string
          sinonimos?: string[]
        }
        Update: {
          atc?: string
          fonte?: string
          id?: string
          nome?: string
          sinonimos?: string[]
        }
        Relationships: []
      }
      classe_alergenica_membro: {
        Row: {
          classe_id: string
          principio: string
        }
        Insert: {
          classe_id: string
          principio: string
        }
        Update: {
          classe_id?: string
          principio?: string
        }
        Relationships: [
          {
            foreignKeyName: "classe_alergenica_membro_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classe_alergenica"
            referencedColumns: ["id"]
          },
        ]
      }
      classificacao_fluxograma_unidade: {
        Row: {
          definido_em: string
          definido_por: string
          discriminadores: Json | null
          estado: string
          fluxograma_id: string
          fonte: string | null
          id: string
          unidade_id: string
          vigente_ate: string | null
        }
        Insert: {
          definido_em?: string
          definido_por: string
          discriminadores?: Json | null
          estado: string
          fluxograma_id: string
          fonte?: string | null
          id?: string
          unidade_id: string
          vigente_ate?: string | null
        }
        Update: {
          definido_em?: string
          definido_por?: string
          discriminadores?: Json | null
          estado?: string
          fluxograma_id?: string
          fonte?: string | null
          id?: string
          unidade_id?: string
          vigente_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classificacao_fluxograma_unidade_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_fluxograma_unidade_fluxograma_id_fkey"
            columns: ["fluxograma_id"]
            isOneToOne: false
            referencedRelation: "protocolo_fluxogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacao_fluxograma_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      classificacoes_risco: {
        Row: {
          autor_id: string
          autor_papel: string
          avaliacao: Json
          cor: string
          criado_em: string
          discriminador: string | null
          discriminador_cor: string | null
          discriminador_livre: boolean
          dor: Json | null
          episodio_id: string
          fluxograma_id: string | null
          fluxograma_nome: string | null
          gestacao: Json | null
          grupo_trocado: boolean
          id: string
          justificativa: string | null
          motivo: string | null
          oxigenio: Json | null
          paciente_id: string
          publico: string
          publico_pela_idade: string | null
          queixa: string | null
          reclassificacao: boolean
          unidade_id: string
        }
        Insert: {
          autor_id: string
          autor_papel: string
          avaliacao?: Json
          cor: string
          criado_em?: string
          discriminador?: string | null
          discriminador_cor?: string | null
          discriminador_livre?: boolean
          dor?: Json | null
          episodio_id: string
          fluxograma_id?: string | null
          fluxograma_nome?: string | null
          gestacao?: Json | null
          grupo_trocado?: boolean
          id?: string
          justificativa?: string | null
          motivo?: string | null
          oxigenio?: Json | null
          paciente_id: string
          publico: string
          publico_pela_idade?: string | null
          queixa?: string | null
          reclassificacao?: boolean
          unidade_id: string
        }
        Update: {
          autor_id?: string
          autor_papel?: string
          avaliacao?: Json
          cor?: string
          criado_em?: string
          discriminador?: string | null
          discriminador_cor?: string | null
          discriminador_livre?: boolean
          dor?: Json | null
          episodio_id?: string
          fluxograma_id?: string | null
          fluxograma_nome?: string | null
          gestacao?: Json | null
          grupo_trocado?: boolean
          id?: string
          justificativa?: string | null
          motivo?: string | null
          oxigenio?: Json | null
          paciente_id?: string
          publico?: string
          publico_pela_idade?: string | null
          queixa?: string | null
          reclassificacao?: boolean
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classificacoes_risco_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacoes_risco_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacoes_risco_fluxograma_id_fkey"
            columns: ["fluxograma_id"]
            isOneToOne: false
            referencedRelation: "protocolo_fluxogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacoes_risco_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classificacoes_risco_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_search_feedback: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          request_id: string
          user_id: string
          util: boolean
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          request_id: string
          user_id: string
          util: boolean
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clinical_search_feedback_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "clinical_search_logs"
            referencedColumns: ["request_id"]
          },
        ]
      }
      clinical_search_logs: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          mode: string
          query_redacted: string
          request_id: string
          status: number | null
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          mode: string
          query_redacted: string
          request_id: string
          status?: number | null
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          mode?: string
          query_redacted?: string
          request_id?: string
          status?: number | null
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_search_logs_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      conceito: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          loinc_codigo: string | null
          nome: string
          ordem_exibicao: number
          ref_max: number | null
          ref_min: number | null
          tipo: string
          unidade_id: string | null
          unidade_padrao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          loinc_codigo?: string | null
          nome: string
          ordem_exibicao?: number
          ref_max?: number | null
          ref_min?: number | null
          tipo?: string
          unidade_id?: string | null
          unidade_padrao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          loinc_codigo?: string | null
          nome?: string
          ordem_exibicao?: number
          ref_max?: number | null
          ref_min?: number | null
          tipo?: string
          unidade_id?: string | null
          unidade_padrao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conceito_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      conceito_opcao: {
        Row: {
          conceito_id: string
          id: string
          ordem: number
          rotulo: string
          valor: string | null
        }
        Insert: {
          conceito_id: string
          id?: string
          ordem?: number
          rotulo: string
          valor?: string | null
        }
        Update: {
          conceito_id?: string
          id?: string
          ordem?: number
          rotulo?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conceito_opcao_conceito_id_fkey"
            columns: ["conceito_id"]
            isOneToOne: false
            referencedRelation: "conceito"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_plataforma: {
        Row: {
          atualizado_em: string
          chave: string
          valor: boolean
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: boolean
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: boolean
        }
        Relationships: []
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
      contratos_rede: {
        Row: {
          ativo: boolean
          codigo: string
          criado_em: string
          dominio_email: string | null
          id: string
          organizacao_id: string
          papel_padrao: Database["public"]["Enums"]["papel"]
          vigente_ate: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          criado_em?: string
          dominio_email?: string | null
          id?: string
          organizacao_id: string
          papel_padrao?: Database["public"]["Enums"]["papel"]
          vigente_ate?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          criado_em?: string
          dominio_email?: string | null
          id?: string
          organizacao_id?: string
          papel_padrao?: Database["public"]["Enums"]["papel"]
          vigente_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_rede_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversa_participantes: {
        Row: {
          conversa_id: string
          entrou_em: string
          perfil_id: string
          ultima_leitura_em: string | null
        }
        Insert: {
          conversa_id: string
          entrou_em?: string
          perfil_id: string
          ultima_leitura_em?: string | null
        }
        Update: {
          conversa_id?: string
          entrou_em?: string
          perfil_id?: string
          ultima_leitura_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversa_participantes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversa_participantes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          criado_em: string
          id: string
          tipo: string
          unidade_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          tipo?: string
          unidade_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          tipo?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          codigo: string
          criado_em: string
          criado_por: string
          expira_em: string
          id: string
          novo_pedido_em: string | null
          papel: Database["public"]["Enums"]["papel"]
          para_quem: string | null
          primeiro_plantao_fim: string | null
          primeiro_plantao_inicio: string | null
          revogado_em: string | null
          revogado_por: string | null
          setor_id: string | null
          unidade_id: string
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          codigo: string
          criado_em?: string
          criado_por: string
          expira_em?: string
          id?: string
          novo_pedido_em?: string | null
          papel: Database["public"]["Enums"]["papel"]
          para_quem?: string | null
          primeiro_plantao_fim?: string | null
          primeiro_plantao_inicio?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          setor_id?: string | null
          unidade_id: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          criado_por?: string
          expira_em?: string
          id?: string
          novo_pedido_em?: string | null
          papel?: Database["public"]["Enums"]["papel"]
          para_quem?: string | null
          primeiro_plantao_fim?: string | null
          primeiro_plantao_inicio?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          setor_id?: string | null
          unidade_id?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
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
      curativos_enfermagem: {
        Row: {
          aspecto: string
          episodio_id: string | null
          id: string
          internacao_id: string | null
          local: string
          observacao: string
          paciente_id: string
          proxima_troca: string | null
          registrado_em: string
          registrado_por: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          aspecto?: string
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          local: string
          observacao?: string
          paciente_id: string
          proxima_troca?: string | null
          registrado_em?: string
          registrado_por: string
          tipo: string
          unidade_id: string
        }
        Update: {
          aspecto?: string
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          local?: string
          observacao?: string
          paciente_id?: string
          proxima_troca?: string | null
          registrado_em?: string
          registrado_por?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curativos_enfermagem_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curativos_enfermagem_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curativos_enfermagem_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curativos_enfermagem_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curativos_enfermagem_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      destinacoes_prontuario: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          destinacao: string
          executado_em: string | null
          id: string
          identificacao_hash: string
          motivo: string
          motivo_decisao: string | null
          paciente_id: string
          prontuario_numero: string | null
          solicitado_em: string
          solicitado_por: string
          status: string
          ultimo_registro_em: string
          unidade_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          destinacao: string
          executado_em?: string | null
          id?: string
          identificacao_hash: string
          motivo: string
          motivo_decisao?: string | null
          paciente_id: string
          prontuario_numero?: string | null
          solicitado_em?: string
          solicitado_por: string
          status?: string
          ultimo_registro_em: string
          unidade_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          destinacao?: string
          executado_em?: string | null
          id?: string
          identificacao_hash?: string
          motivo?: string
          motivo_decisao?: string | null
          paciente_id?: string
          prontuario_numero?: string | null
          solicitado_em?: string
          solicitado_por?: string
          status?: string
          ultimo_registro_em?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinacoes_prontuario_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinacoes_prontuario_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinacoes_prontuario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos_episodio: {
        Row: {
          cid: string
          descricao: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          encerramento: string | null
          episodio_id: string | null
          id: string
          internacao_id: string | null
          motivo_encerramento: string | null
          paciente_id: string
          registrado_em: string
          registrado_por: string
          status: string
          substitui_id: string | null
          tempo_doenca: number | null
          tempo_unidade: string | null
          tipo: string
          unidade_id: string
        }
        Insert: {
          cid: string
          descricao?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerramento?: string | null
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          motivo_encerramento?: string | null
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          status: string
          substitui_id?: string | null
          tempo_doenca?: number | null
          tempo_unidade?: string | null
          tipo: string
          unidade_id: string
        }
        Update: {
          cid?: string
          descricao?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerramento?: string | null
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
          motivo_encerramento?: string | null
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          status?: string
          substitui_id?: string | null
          tempo_doenca?: number | null
          tempo_unidade?: string | null
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_episodio_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_substitui_id_fkey"
            columns: ["substitui_id"]
            isOneToOne: false
            referencedRelation: "diagnosticos_episodio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_episodio_unidade_id_fkey"
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
          motivo_alteracao: string | null
          observacoes: string | null
          origem_id: string | null
          principio_ativo: string
          publicado_em: string | null
          publicado_por: string | null
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          risco_flebite: boolean | null
          status: string
          tempo_infusao_min: number | null
          unidade_id: string | null
          updated_at: string
          velocidade_max: string | null
          versao: number
          via: string
          vigente_ate: string | null
          vigente_desde: string | null
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
          motivo_alteracao?: string | null
          observacoes?: string | null
          origem_id?: string | null
          principio_ativo: string
          publicado_em?: string | null
          publicado_por?: string | null
          reconstituicao_concentracao?: string | null
          reconstituicao_diluente?: string | null
          reconstituicao_volume_ml?: number | null
          revisor_crf?: string | null
          risco_flebite?: boolean | null
          status?: string
          tempo_infusao_min?: number | null
          unidade_id?: string | null
          updated_at?: string
          velocidade_max?: string | null
          versao?: number
          via: string
          vigente_ate?: string | null
          vigente_desde?: string | null
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
          motivo_alteracao?: string | null
          observacoes?: string | null
          origem_id?: string | null
          principio_ativo?: string
          publicado_em?: string | null
          publicado_por?: string | null
          reconstituicao_concentracao?: string | null
          reconstituicao_diluente?: string | null
          reconstituicao_volume_ml?: number | null
          revisor_crf?: string | null
          risco_flebite?: boolean | null
          status?: string
          tempo_infusao_min?: number | null
          unidade_id?: string | null
          updated_at?: string
          velocidade_max?: string | null
          versao?: number
          via?: string
          vigente_ate?: string | null
          vigente_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diluicao_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diluicao_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "diluicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diluicao_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diluicao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      diluicao_encerramentos: {
        Row: {
          diluicao_id: string
          encerrado_em: string
          encerrado_por: string
          motivo: string
          unidade_id: string
        }
        Insert: {
          diluicao_id: string
          encerrado_em?: string
          encerrado_por: string
          motivo: string
          unidade_id: string
        }
        Update: {
          diluicao_id?: string
          encerrado_em?: string
          encerrado_por?: string
          motivo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diluicao_encerramentos_diluicao_id_fkey"
            columns: ["diluicao_id"]
            isOneToOne: true
            referencedRelation: "diluicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diluicao_encerramentos_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diluicao_encerramentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade_telemedicina: {
        Row: {
          atualizado_em: string
          estado: string
          perfil_id: string
        }
        Insert: {
          atualizado_em?: string
          estado: string
          perfil_id: string
        }
        Update: {
          atualizado_em?: string
          estado?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_telemedicina_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos_confiaveis: {
        Row: {
          criado_em: string
          expira_em: string
          id: string
          rotulo: string | null
          token_hash: string
          ultimo_uso: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          expira_em: string
          id?: string
          rotulo?: string | null
          token_hash: string
          ultimo_uso?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          expira_em?: string
          id?: string
          rotulo?: string | null
          token_hash?: string
          ultimo_uso?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dispositivos_enfermagem: {
        Row: {
          calibre: string
          episodio_id: string | null
          id: string
          inserido_em: string
          internacao_id: string | null
          local: string
          motivo_retirada: string | null
          observacao: string
          paciente_id: string
          registrado_em: string
          registrado_por: string
          retirado_em: string | null
          retirado_por: string | null
          tipo: string
          troca_prevista: string | null
          unidade_id: string
        }
        Insert: {
          calibre?: string
          episodio_id?: string | null
          id?: string
          inserido_em: string
          internacao_id?: string | null
          local?: string
          motivo_retirada?: string | null
          observacao?: string
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          retirado_em?: string | null
          retirado_por?: string | null
          tipo: string
          troca_prevista?: string | null
          unidade_id: string
        }
        Update: {
          calibre?: string
          episodio_id?: string | null
          id?: string
          inserido_em?: string
          internacao_id?: string | null
          local?: string
          motivo_retirada?: string | null
          observacao?: string
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          retirado_em?: string | null
          retirado_por?: string | null
          tipo?: string
          troca_prevista?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_enfermagem_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_enfermagem_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_enfermagem_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_enfermagem_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_enfermagem_retirado_por_fkey"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_enfermagem_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_clinicos: {
        Row: {
          aparelho_id: string | null
          assinado_em: string | null
          assinatura_id: string | null
          autor_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          carimbo_tempo: string | null
          conteudo: string
          conteudo_hash: string
          copia_de: string | null
          created_at: string
          documento_raiz_id: string
          emitido_em: string | null
          episodio_id: string | null
          estado: string
          id: string
          internacao_id: string | null
          motivo_cancelamento: string | null
          motivo_retificacao: string | null
          numero: string | null
          organizacao_id: string
          paciente_id: string
          retificacao_de: string | null
          sem_conexao: boolean
          tipo_documento: string
          unidade_id: string
          updated_at: string
          versao: number
        }
        Insert: {
          aparelho_id?: string | null
          assinado_em?: string | null
          assinatura_id?: string | null
          autor_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          carimbo_tempo?: string | null
          conteudo: string
          conteudo_hash: string
          copia_de?: string | null
          created_at?: string
          documento_raiz_id: string
          emitido_em?: string | null
          episodio_id?: string | null
          estado?: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          motivo_retificacao?: string | null
          numero?: string | null
          organizacao_id: string
          paciente_id: string
          retificacao_de?: string | null
          sem_conexao?: boolean
          tipo_documento: string
          unidade_id: string
          updated_at?: string
          versao?: number
        }
        Update: {
          aparelho_id?: string | null
          assinado_em?: string | null
          assinatura_id?: string | null
          autor_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          carimbo_tempo?: string | null
          conteudo?: string
          conteudo_hash?: string
          copia_de?: string | null
          created_at?: string
          documento_raiz_id?: string
          emitido_em?: string | null
          episodio_id?: string | null
          estado?: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          motivo_retificacao?: string | null
          numero?: string | null
          organizacao_id?: string
          paciente_id?: string
          retificacao_de?: string | null
          sem_conexao?: boolean
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
            foreignKeyName: "documentos_clinicos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_copia_de_fkey"
            columns: ["copia_de"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_clinicos_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
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
      encaminhamentos_internos: {
        Row: {
          atendido_em: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          encaminhado_em: string
          encaminhado_por: string
          episodio_id: string | null
          especialidade: string
          estado: string
          id: string
          internacao_id: string | null
          justificativa: string
          medico_destino_id: string | null
          motivo_cancelamento: string | null
          motivo_recusa: string | null
          paciente_id: string
          respondido_em: string | null
          respondido_por: string | null
          servico: string | null
          unidade_id: string
        }
        Insert: {
          atendido_em?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          encaminhado_em?: string
          encaminhado_por: string
          episodio_id?: string | null
          especialidade: string
          estado?: string
          id?: string
          internacao_id?: string | null
          justificativa: string
          medico_destino_id?: string | null
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          paciente_id: string
          respondido_em?: string | null
          respondido_por?: string | null
          servico?: string | null
          unidade_id: string
        }
        Update: {
          atendido_em?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          encaminhado_em?: string
          encaminhado_por?: string
          episodio_id?: string | null
          especialidade?: string
          estado?: string
          id?: string
          internacao_id?: string | null
          justificativa?: string
          medico_destino_id?: string | null
          motivo_cancelamento?: string | null
          motivo_recusa?: string | null
          paciente_id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          servico?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encaminhamentos_internos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_encaminhado_por_fkey"
            columns: ["encaminhado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_medico_destino_id_fkey"
            columns: ["medico_destino_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_internos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      episodios: {
        Row: {
          aberto_por: string
          atendimento_iniciado_em: string | null
          atendimento_medico_id: string | null
          chegada_em: string
          classificado_em: string | null
          cor_atual: string | null
          created_at: string
          desfecho: string | null
          desfecho_detalhes: Json | null
          desfecho_em: string | null
          desfecho_motivo: string | null
          desfecho_por: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          etapa: string
          id: string
          paciente_id: string
          prioridades_legais: string[]
          publico: string | null
          queixa: string
          reavaliar_em: string | null
          setor_id: string
          suspeita_infeccao_em: string | null
          suspeita_infeccao_por: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          aberto_por: string
          atendimento_iniciado_em?: string | null
          atendimento_medico_id?: string | null
          chegada_em?: string
          classificado_em?: string | null
          cor_atual?: string | null
          created_at?: string
          desfecho?: string | null
          desfecho_detalhes?: Json | null
          desfecho_em?: string | null
          desfecho_motivo?: string | null
          desfecho_por?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa?: string
          id?: string
          paciente_id: string
          prioridades_legais?: string[]
          publico?: string | null
          queixa: string
          reavaliar_em?: string | null
          setor_id: string
          suspeita_infeccao_em?: string | null
          suspeita_infeccao_por?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          aberto_por?: string
          atendimento_iniciado_em?: string | null
          atendimento_medico_id?: string | null
          chegada_em?: string
          classificado_em?: string | null
          cor_atual?: string | null
          created_at?: string
          desfecho?: string | null
          desfecho_detalhes?: Json | null
          desfecho_em?: string | null
          desfecho_motivo?: string | null
          desfecho_por?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa?: string
          id?: string
          paciente_id?: string
          prioridades_legais?: string[]
          publico?: string | null
          queixa?: string
          reavaliar_em?: string | null
          setor_id?: string
          suspeita_infeccao_em?: string | null
          suspeita_infeccao_por?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodios_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_atendimento_medico_id_fkey"
            columns: ["atendimento_medico_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_desfecho_por_fkey"
            columns: ["desfecho_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_suspeita_infeccao_por_fkey"
            columns: ["suspeita_infeccao_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      erros_cliente: {
        Row: {
          assinatura: string
          criado_em: string
          detalhe: string | null
          id: string
          ip: unknown
          mensagem: string | null
          navegador: string | null
          origem: string | null
          papel: string | null
          perfil_id: string | null
          tipo: string
          unidade_id: string | null
          versao_app: string | null
        }
        Insert: {
          assinatura: string
          criado_em?: string
          detalhe?: string | null
          id?: string
          ip?: unknown
          mensagem?: string | null
          navegador?: string | null
          origem?: string | null
          papel?: string | null
          perfil_id?: string | null
          tipo: string
          unidade_id?: string | null
          versao_app?: string | null
        }
        Update: {
          assinatura?: string
          criado_em?: string
          detalhe?: string | null
          id?: string
          ip?: unknown
          mensagem?: string | null
          navegador?: string | null
          origem?: string | null
          papel?: string | null
          perfil_id?: string | null
          tipo?: string
          unidade_id?: string | null
          versao_app?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erros_cliente_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erros_cliente_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      erros_cliente_resolvidos: {
        Row: {
          assinatura: string
          resolvido_em: string
          resolvido_por: string | null
        }
        Insert: {
          assinatura: string
          resolvido_em?: string
          resolvido_por?: string | null
        }
        Update: {
          assinatura?: string
          resolvido_em?: string
          resolvido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erros_cliente_resolvidos_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
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
          duracao_min: number
          fracionado: boolean
          id: string
          inicio: string
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
          duracao_min: number
          fracionado?: boolean
          id?: string
          inicio: string
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
          duracao_min?: number
          fracionado?: boolean
          id?: string
          inicio?: string
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
      escala_publicacoes: {
        Row: {
          competencia: string
          id: string
          observacao: string | null
          plantoes: number
          publicada_em: string
          publicada_por: string
          unidade_id: string
          vagas: number
          versao: number
        }
        Insert: {
          competencia: string
          id?: string
          observacao?: string | null
          plantoes: number
          publicada_em?: string
          publicada_por: string
          unidade_id: string
          vagas: number
          versao: number
        }
        Update: {
          competencia?: string
          id?: string
          observacao?: string | null
          plantoes?: number
          publicada_em?: string
          publicada_por?: string
          unidade_id?: string
          vagas?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "escala_publicacoes_publicada_por_fkey"
            columns: ["publicada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_publicacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_vagas: {
        Row: {
          aberta_em: string
          aberta_por: string
          data: string
          duracao_min: number | null
          fechada_em: string | null
          fechada_por: string | null
          id: string
          inicio: string | null
          observacao: string | null
          parte: number | null
          partes: number | null
          plantao_origem_id: string | null
          setor_id: string
          turno: string
          unidade_id: string
        }
        Insert: {
          aberta_em?: string
          aberta_por: string
          data: string
          duracao_min?: number | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          inicio?: string | null
          observacao?: string | null
          parte?: number | null
          partes?: number | null
          plantao_origem_id?: string | null
          setor_id: string
          turno: string
          unidade_id: string
        }
        Update: {
          aberta_em?: string
          aberta_por?: string
          data?: string
          duracao_min?: number | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          inicio?: string | null
          observacao?: string | null
          parte?: number | null
          partes?: number | null
          plantao_origem_id?: string | null
          setor_id?: string
          turno?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_vagas_aberta_por_fkey"
            columns: ["aberta_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_vagas_fechada_por_fkey"
            columns: ["fechada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_vagas_plantao_origem_id_fkey"
            columns: ["plantao_origem_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_vagas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_vagas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades_parecer: {
        Row: {
          nome: string
          ordem: number
        }
        Insert: {
          nome: string
          ordem: number
        }
        Update: {
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      especialidades_perfil: {
        Row: {
          declarada_em: string
          especialidade: string
          perfil_id: string
        }
        Insert: {
          declarada_em?: string
          especialidade: string
          perfil_id: string
        }
        Update: {
          declarada_em?: string
          especialidade?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialidades_perfil_especialidade_fkey"
            columns: ["especialidade"]
            isOneToOne: false
            referencedRelation: "especialidades_parecer"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "especialidades_perfil_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_medicamento: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          limite_critico: number | null
          limite_falta: number | null
          medicamento_id: string
          quantidade: number
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por: string
          limite_critico?: number | null
          limite_falta?: number | null
          medicamento_id: string
          quantidade: number
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          limite_critico?: number | null
          limite_falta?: number | null
          medicamento_id?: string
          quantidade?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_medicamento_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_medicamento_unidade_id_fkey"
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
      eventos_adversos: {
        Row: {
          evento: string
          grau: number
          grau_em: string
          id: string
          inativado_em: string | null
          inativado_por: string | null
          item_descricao: string | null
          motivo_inativacao: string | null
          observacao: string | null
          paciente_id: string
          prescricao_item_id: string | null
          registrado_em: string
          registrado_por: string
          unidade_id: string
        }
        Insert: {
          evento: string
          grau: number
          grau_em?: string
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          item_descricao?: string | null
          motivo_inativacao?: string | null
          observacao?: string | null
          paciente_id: string
          prescricao_item_id?: string | null
          registrado_em?: string
          registrado_por: string
          unidade_id: string
        }
        Update: {
          evento?: string
          grau?: number
          grau_em?: string
          id?: string
          inativado_em?: string | null
          inativado_por?: string | null
          item_descricao?: string | null
          motivo_inativacao?: string | null
          observacao?: string | null
          paciente_id?: string
          prescricao_item_id?: string | null
          registrado_em?: string
          registrado_por?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_adversos_inativado_por_fkey"
            columns: ["inativado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_prescricao_item_id_fkey"
            columns: ["prescricao_item_id"]
            isOneToOne: false
            referencedRelation: "prescricao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_adversos_graus: {
        Row: {
          evento_id: string
          grau: number
          id: string
          paciente_id: string
          registrado_em: string
          registrado_por: string
          unidade_id: string
        }
        Insert: {
          evento_id: string
          grau: number
          id?: string
          paciente_id: string
          registrado_em?: string
          registrado_por: string
          unidade_id: string
        }
        Update: {
          evento_id?: string
          grau?: number
          id?: string
          paciente_id?: string
          registrado_em?: string
          registrado_por?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_adversos_graus_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_adversos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_graus_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_graus_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_adversos_graus_unidade_id_fkey"
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
      evolucoes_estruturadas: {
        Row: {
          autor_id: string
          complemento_de: string | null
          created_at: string
          dados: Json
          dia: string
          documento_id: string
          documento_raiz_id: string
          internacao_id: string
          paciente_id: string
          papel: string
          tipo_documento: string
          unidade_id: string
          versao: number
        }
        Insert: {
          autor_id: string
          complemento_de?: string | null
          created_at?: string
          dados?: Json
          dia: string
          documento_id: string
          documento_raiz_id: string
          internacao_id: string
          paciente_id: string
          papel: string
          tipo_documento: string
          unidade_id: string
          versao: number
        }
        Update: {
          autor_id?: string
          complemento_de?: string | null
          created_at?: string
          dados?: Json
          dia?: string
          documento_id?: string
          documento_raiz_id?: string
          internacao_id?: string
          paciente_id?: string
          papel?: string
          tipo_documento?: string
          unidade_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_estruturadas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_estruturadas_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_estruturadas_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_estruturadas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_estruturadas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_pedidos: {
        Row: {
          documento_id: string | null
          episodio_id: string | null
          exame: string
          id: string
          internacao_id: string | null
          motivo_cancelamento: string | null
          paciente_id: string
          pedido_em: string
          pedido_por: string
          resolvido_em: string | null
          resolvido_por: string | null
          resultado: string | null
          situacao: string
          unidade_id: string
        }
        Insert: {
          documento_id?: string | null
          episodio_id?: string | null
          exame: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          paciente_id: string
          pedido_em?: string
          pedido_por: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          resultado?: string | null
          situacao?: string
          unidade_id: string
        }
        Update: {
          documento_id?: string | null
          episodio_id?: string | null
          exame?: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          paciente_id?: string
          pedido_em?: string
          pedido_por?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          resultado?: string | null
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exames_pedidos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_pedido_por_fkey"
            columns: ["pedido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_pedidos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas_medicamento: {
        Row: {
          atualizada_em: string | null
          atualizada_por: string | null
          id: string
          medicamento_id: string
          observacao: string | null
          sinalizada_em: string
          sinalizada_por: string
          situacao: string
          unidade_id: string
        }
        Insert: {
          atualizada_em?: string | null
          atualizada_por?: string | null
          id?: string
          medicamento_id: string
          observacao?: string | null
          sinalizada_em?: string
          sinalizada_por: string
          situacao?: string
          unidade_id: string
        }
        Update: {
          atualizada_em?: string | null
          atualizada_por?: string | null
          id?: string
          medicamento_id?: string
          observacao?: string | null
          sinalizada_em?: string
          sinalizada_por?: string
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faltas_medicamento_atualizada_por_fkey"
            columns: ["atualizada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_medicamento_sinalizada_por_fkey"
            columns: ["sinalizada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_medicamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      farmacia_limites_padrao: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          limite_critico: number | null
          limite_falta: number | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por: string
          limite_critico?: number | null
          limite_falta?: number | null
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          limite_critico?: number | null
          limite_falta?: number | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmacia_limites_padrao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmacia_limites_padrao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramenta_unidade: {
        Row: {
          definida_por: string
          ferramenta_id: string
          id: string
          motivo: string
          nota_local: string | null
          oculta: boolean
          unidade_id: string
          vigente_ate: string | null
          vigente_desde: string
        }
        Insert: {
          definida_por: string
          ferramenta_id: string
          id?: string
          motivo: string
          nota_local?: string | null
          oculta?: boolean
          unidade_id: string
          vigente_ate?: string | null
          vigente_desde?: string
        }
        Update: {
          definida_por?: string
          ferramenta_id?: string
          id?: string
          motivo?: string
          nota_local?: string | null
          oculta?: boolean
          unidade_id?: string
          vigente_ate?: string | null
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferramenta_unidade_definida_por_fkey"
            columns: ["definida_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferramenta_unidade_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "ferramentas_clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferramenta_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramenta_uso: {
        Row: {
          chave: string
          created_at: string
          favorita: boolean
          favoritada_em: string | null
          perfil_id: string
          ultimo_uso_em: string | null
          updated_at: string
          usos: number
        }
        Insert: {
          chave: string
          created_at?: string
          favorita?: boolean
          favoritada_em?: string | null
          perfil_id: string
          ultimo_uso_em?: string | null
          updated_at?: string
          usos?: number
        }
        Update: {
          chave?: string
          created_at?: string
          favorita?: boolean
          favoritada_em?: string | null
          perfil_id?: string
          ultimo_uso_em?: string | null
          updated_at?: string
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "ferramenta_uso_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramenta_versoes: {
        Row: {
          decidida_em: string | null
          decidida_por: string | null
          decisao_nota: string | null
          decisao_registro: string | null
          ferramenta_id: string
          fontes: Json
          id: string
          publico: string
          registrada_em: string
          status: string
          versao: string
        }
        Insert: {
          decidida_em?: string | null
          decidida_por?: string | null
          decisao_nota?: string | null
          decisao_registro?: string | null
          ferramenta_id: string
          fontes: Json
          id?: string
          publico: string
          registrada_em?: string
          status?: string
          versao: string
        }
        Update: {
          decidida_em?: string | null
          decidida_por?: string | null
          decisao_nota?: string | null
          decisao_registro?: string | null
          ferramenta_id?: string
          fontes?: Json
          id?: string
          publico?: string
          registrada_em?: string
          status?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferramenta_versoes_decidida_por_fkey"
            columns: ["decidida_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferramenta_versoes_ferramenta_id_fkey"
            columns: ["ferramenta_id"]
            isOneToOne: false
            referencedRelation: "ferramentas_clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      ferramentas_clinicas: {
        Row: {
          criado_em: string
          id: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          id: string
          titulo: string
        }
        Update: {
          criado_em?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      gaviao_decisoes: {
        Row: {
          autor_id: string
          chave: string
          criado_em: string
          decisao: string
          desfeita_em: string | null
          id: string
          motivo: string | null
          severidade: string
          silenciado_ate: string | null
          tipo: string
          titulo: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          chave: string
          criado_em?: string
          decisao: string
          desfeita_em?: string | null
          id?: string
          motivo?: string | null
          severidade: string
          silenciado_ate?: string | null
          tipo: string
          titulo: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          chave?: string
          criado_em?: string
          decisao?: string
          desfeita_em?: string | null
          id?: string
          motivo?: string | null
          severidade?: string
          silenciado_ate?: string | null
          tipo?: string
          titulo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaviao_decisoes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gaviao_decisoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      gaviao_relatorios_semanais: {
        Row: {
          detalhes: Json
          gerado_em: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          resumo: Json
        }
        Insert: {
          detalhes?: Json
          gerado_em?: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
          resumo?: Json
        }
        Update: {
          detalhes?: Json
          gerado_em?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          resumo?: Json
        }
        Relationships: []
      }
      hermes_almanaque: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: string
          palavras: string
          pergunta: string
          resposta: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          palavras?: string
          pergunta: string
          resposta: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          palavras?: string
          pergunta?: string
          resposta?: string
        }
        Relationships: []
      }
      hermes_audit_log: {
        Row: {
          created_at: string
          direction: string
          id: string
          phone: string
          tool_args: Json | null
          tool_name: string | null
          tool_result_summary: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          phone: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result_summary?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          phone?: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result_summary?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hermes_identidades: {
        Row: {
          canal: string
          criado_em: string
          identificador: string
          perfil_id: string
        }
        Insert: {
          canal: string
          criado_em?: string
          identificador: string
          perfil_id: string
        }
        Update: {
          canal?: string
          criado_em?: string
          identificador?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_identidades_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_resumo_unidade: {
        Row: {
          atualizado_em: string
          dados: Json
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          dados: Json
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          dados?: Json
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_resumo_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      hermes_sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hermes_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
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
      ia_gateway_log: {
        Row: {
          bloqueado: boolean
          criado_em: string
          erro: string | null
          hash_entrada: string
          id: string
          latencia_ms: number | null
          modelo: string | null
          origem: string
          perfil_id: string | null
          provedor: string | null
          residuos: number
          substituicoes: Json
          tipos_bloqueio: Json | null
        }
        Insert: {
          bloqueado: boolean
          criado_em?: string
          erro?: string | null
          hash_entrada: string
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          origem: string
          perfil_id?: string | null
          provedor?: string | null
          residuos?: number
          substituicoes?: Json
          tipos_bloqueio?: Json | null
        }
        Update: {
          bloqueado?: boolean
          criado_em?: string
          erro?: string | null
          hash_entrada?: string
          id?: string
          latencia_ms?: number | null
          modelo?: string | null
          origem?: string
          perfil_id?: string | null
          provedor?: string | null
          residuos?: number
          substituicoes?: Json
          tipos_bloqueio?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_gateway_log_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      impressoes_prontuario: {
        Row: {
          anexos: string[]
          autorizador: string
          cancelada_em: string | null
          cancelada_por: string | null
          documentos: string[]
          estado: string
          id: string
          impresso_em: string
          impresso_por: string
          itens: Json
          motivo_cancelamento: string | null
          observacao: string | null
          organizacao_id: string
          paciente_id: string
          protocolo: string
          recebedor_documento: string
          recebedor_nome: string
          unidade_id: string
        }
        Insert: {
          anexos?: string[]
          autorizador: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          documentos?: string[]
          estado?: string
          id?: string
          impresso_em?: string
          impresso_por: string
          itens: Json
          motivo_cancelamento?: string | null
          observacao?: string | null
          organizacao_id: string
          paciente_id: string
          protocolo: string
          recebedor_documento: string
          recebedor_nome: string
          unidade_id: string
        }
        Update: {
          anexos?: string[]
          autorizador?: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          documentos?: string[]
          estado?: string
          id?: string
          impresso_em?: string
          impresso_por?: string
          itens?: Json
          motivo_cancelamento?: string | null
          observacao?: string | null
          organizacao_id?: string
          paciente_id?: string
          protocolo?: string
          recebedor_documento?: string
          recebedor_nome?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impressoes_prontuario_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressoes_prontuario_impresso_por_fkey"
            columns: ["impresso_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressoes_prontuario_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressoes_prontuario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impressoes_prontuario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      internacoes: {
        Row: {
          alta_detalhes: Json | null
          alta_justificativa_retroativa: string | null
          alta_observacoes: string | null
          alta_por: string | null
          alta_registrada_em: string | null
          cid_alta: string | null
          cid_principal: string | null
          created_at: string
          data_admissao: string
          data_alta: string | null
          data_entrada_setor: string | null
          episodio_id: string | null
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
          alta_detalhes?: Json | null
          alta_justificativa_retroativa?: string | null
          alta_observacoes?: string | null
          alta_por?: string | null
          alta_registrada_em?: string | null
          cid_alta?: string | null
          cid_principal?: string | null
          created_at?: string
          data_admissao?: string
          data_alta?: string | null
          data_entrada_setor?: string | null
          episodio_id?: string | null
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
          alta_detalhes?: Json | null
          alta_justificativa_retroativa?: string | null
          alta_observacoes?: string | null
          alta_por?: string | null
          alta_registrada_em?: string | null
          cid_alta?: string | null
          cid_principal?: string | null
          created_at?: string
          data_admissao?: string
          data_alta?: string | null
          data_entrada_setor?: string | null
          episodio_id?: string | null
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
            foreignKeyName: "internacoes_alta_por_fkey"
            columns: ["alta_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internacoes_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
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
      interop_outbox: {
        Row: {
          created_at: string
          enviado_em: string | null
          id: string
          id_rnds: string | null
          payload: Json
          referencia_id: string
          status: string
          tentativas: number
          tipo_documento: string
          ultimo_erro: string | null
          unidade_id: string
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          id?: string
          id_rnds?: string | null
          payload: Json
          referencia_id: string
          status?: string
          tentativas?: number
          tipo_documento: string
          ultimo_erro?: string | null
          unidade_id: string
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          id?: string
          id_rnds?: string | null
          payload?: Json
          referencia_id?: string
          status?: string
          tentativas?: number
          tipo_documento?: string
          ultimo_erro?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interop_outbox_unidade_id_fkey"
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
      liberacao_pos_plantao: {
        Row: {
          concedido_em: string
          concedido_por: string
          expira_em: string
          id: string
          motivo: string
          perfil_id: string
          unidade_id: string
        }
        Insert: {
          concedido_em?: string
          concedido_por: string
          expira_em: string
          id?: string
          motivo: string
          perfil_id: string
          unidade_id: string
        }
        Update: {
          concedido_em?: string
          concedido_por?: string
          expira_em?: string
          id?: string
          motivo?: string
          perfil_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liberacao_pos_plantao_concedido_por_fkey"
            columns: ["concedido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacao_pos_plantao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacao_pos_plantao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      lnnc_agravos: {
        Row: {
          agravo: string
          condicao: string | null
          conferido_em: string | null
          conferido_por: string | null
          destino: string | null
          fonte: string
          imediata: boolean
          item: string
          numero: number
          ordem: number
        }
        Insert: {
          agravo: string
          condicao?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          destino?: string | null
          fonte: string
          imediata: boolean
          item: string
          numero: number
          ordem: number
        }
        Update: {
          agravo?: string
          condicao?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          destino?: string | null
          fonte?: string
          imediata?: boolean
          item?: string
          numero?: number
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "lnnc_agravos_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      lnnc_cids: {
        Row: {
          conferido_em: string | null
          conferido_por: string | null
          fonte: string
          item: string
          regra: string
        }
        Insert: {
          conferido_em?: string | null
          conferido_por?: string | null
          fonte: string
          item: string
          regra: string
        }
        Update: {
          conferido_em?: string | null
          conferido_por?: string | null
          fonte?: string
          item?: string
          regra?: string
        }
        Relationships: [
          {
            foreignKeyName: "lnnc_cids_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lnnc_cids_item_fkey"
            columns: ["item"]
            isOneToOne: false
            referencedRelation: "lnnc_agravos"
            referencedColumns: ["item"]
          },
        ]
      }
      log_acesso_prontuario: {
        Row: {
          acessado_por: string
          created_at: string
          documento_id: string | null
          documento_tipo: string | null
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
          documento_tipo?: string | null
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
          documento_tipo?: string | null
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
          hash: string | null
          hash_anterior: string | null
          id: string
          payload: Json | null
          seq: number
          unidade_id: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          created_at?: string
          entidade: string
          entidade_id?: string | null
          hash?: string | null
          hash_anterior?: string | null
          id?: string
          payload?: Json | null
          seq?: never
          unidade_id?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          hash?: string | null
          hash_anterior?: string | null
          id?: string
          payload?: Json | null
          seq?: never
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
          anvisa_vinculo_pendente: boolean
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
          vasoativo: boolean | null
        }
        Insert: {
          alta_vigilancia?: boolean
          anvisa_empresa?: string | null
          anvisa_produto?: string | null
          anvisa_registro?: string | null
          anvisa_situacao?: string | null
          anvisa_vinculo_pendente?: boolean
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
          vasoativo?: boolean | null
        }
        Update: {
          alta_vigilancia?: boolean
          anvisa_empresa?: string | null
          anvisa_produto?: string | null
          anvisa_registro?: string | null
          anvisa_situacao?: string | null
          anvisa_vinculo_pendente?: boolean
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
          vasoativo?: boolean | null
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
      medidas_pedidas: {
        Row: {
          autor_id: string
          criado_em: string
          id: string
          painel: string | null
          retirada_em: string | null
          retirada_por: string | null
          situacao: string
          texto: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          criado_em?: string
          id?: string
          painel?: string | null
          retirada_em?: string | null
          retirada_por?: string | null
          situacao?: string
          texto: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          criado_em?: string
          id?: string
          painel?: string | null
          retirada_em?: string | null
          retirada_por?: string | null
          situacao?: string
          texto?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medidas_pedidas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medidas_pedidas_retirada_por_fkey"
            columns: ["retirada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medidas_pedidas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
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
      observacao: {
        Row: {
          aferido_em: string
          aparelho_id: string | null
          conceito_id: string
          created_at: string
          episodio_id: string | null
          flag: string
          id: string
          internacao_id: string | null
          observacao_pai_id: string | null
          origem: string
          paciente_id: string
          ref_max: number | null
          ref_min: number | null
          registrado_por: string | null
          sem_conexao: boolean
          unidade: string | null
          unidade_id: string
          valor_conceito_id: string | null
          valor_num: number | null
          valor_texto: string | null
        }
        Insert: {
          aferido_em?: string
          aparelho_id?: string | null
          conceito_id: string
          created_at?: string
          episodio_id?: string | null
          flag?: string
          id?: string
          internacao_id?: string | null
          observacao_pai_id?: string | null
          origem?: string
          paciente_id: string
          ref_max?: number | null
          ref_min?: number | null
          registrado_por?: string | null
          sem_conexao?: boolean
          unidade?: string | null
          unidade_id: string
          valor_conceito_id?: string | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Update: {
          aferido_em?: string
          aparelho_id?: string | null
          conceito_id?: string
          created_at?: string
          episodio_id?: string | null
          flag?: string
          id?: string
          internacao_id?: string | null
          observacao_pai_id?: string | null
          origem?: string
          paciente_id?: string
          ref_max?: number | null
          ref_min?: number | null
          registrado_por?: string | null
          sem_conexao?: boolean
          unidade?: string | null
          unidade_id?: string
          valor_conceito_id?: string | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observacao_conceito_id_fkey"
            columns: ["conceito_id"]
            isOneToOne: false
            referencedRelation: "conceito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_observacao_pai_id_fkey"
            columns: ["observacao_pai_id"]
            isOneToOne: false
            referencedRelation: "observacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_valor_conceito_id_fkey"
            columns: ["valor_conceito_id"]
            isOneToOne: false
            referencedRelation: "conceito_opcao"
            referencedColumns: ["id"]
          },
        ]
      }
      observacao_eventos: {
        Row: {
          autor_id: string
          id: string
          internacao_id: string
          paciente_id: string
          pendencia_id: string | null
          reavaliar_em: string | null
          registrado_em: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          autor_id: string
          id?: string
          internacao_id: string
          paciente_id: string
          pendencia_id?: string | null
          reavaliar_em?: string | null
          registrado_em?: string
          tipo: string
          unidade_id: string
        }
        Update: {
          autor_id?: string
          id?: string
          internacao_id?: string
          paciente_id?: string
          pendencia_id?: string | null
          reavaliar_em?: string | null
          registrado_em?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacao_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_eventos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_eventos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_eventos_pendencia_id_fkey"
            columns: ["pendencia_id"]
            isOneToOne: false
            referencedRelation: "pendencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_eventos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      observacao_protocolo_etapas: {
        Row: {
          etapa: number
          id: string
          paciente_id: string
          protocolo_id: string
          registrado_em: string
          registrado_por: string
          texto: string
          unidade_id: string
        }
        Insert: {
          etapa: number
          id?: string
          paciente_id: string
          protocolo_id: string
          registrado_em?: string
          registrado_por: string
          texto: string
          unidade_id: string
        }
        Update: {
          etapa?: number
          id?: string
          paciente_id?: string
          protocolo_id?: string
          registrado_em?: string
          registrado_por?: string
          texto?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacao_protocolo_etapas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolo_etapas_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "observacao_protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolo_etapas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolo_etapas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      observacao_protocolos: {
        Row: {
          encerrado_em: string | null
          encerrado_por: string | null
          etapa_atual: number
          etapas: Json
          fonte: string
          id: string
          iniciado_em: string
          iniciado_por: string
          internacao_id: string
          motivo_encerramento: string | null
          nome: string
          paciente_id: string
          sigla: string
          unidade_id: string
          versao: string
        }
        Insert: {
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa_atual?: number
          etapas: Json
          fonte: string
          id?: string
          iniciado_em?: string
          iniciado_por: string
          internacao_id: string
          motivo_encerramento?: string | null
          nome: string
          paciente_id: string
          sigla: string
          unidade_id: string
          versao: string
        }
        Update: {
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa_atual?: number
          etapas?: Json
          fonte?: string
          id?: string
          iniciado_em?: string
          iniciado_por?: string
          internacao_id?: string
          motivo_encerramento?: string | null
          nome?: string
          paciente_id?: string
          sigla?: string
          unidade_id?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacao_protocolos_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolos_iniciado_por_fkey"
            columns: ["iniciado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_protocolos_sigla_fkey"
            columns: ["sigla"]
            isOneToOne: false
            referencedRelation: "protocolos_observacao"
            referencedColumns: ["sigla"]
          },
          {
            foreignKeyName: "observacao_protocolos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
          categoria: string | null
          cns: string | null
          convenio: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          municipio: string | null
          nome: string
          nome_mae: string | null
          nome_social: string | null
          prontuario: string | null
          raca_cor: string | null
          responsavel_documento: string | null
          responsavel_nome: string | null
          responsavel_parentesco: string | null
          responsavel_telefone: string | null
          setor_id: string | null
          sexo: string | null
          telefone: string | null
          uf: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cns?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          municipio?: string | null
          nome: string
          nome_mae?: string | null
          nome_social?: string | null
          prontuario?: string | null
          raca_cor?: string | null
          responsavel_documento?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          setor_id?: string | null
          sexo?: string | null
          telefone?: string | null
          uf?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cns?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          municipio?: string | null
          nome?: string
          nome_mae?: string | null
          nome_social?: string | null
          prontuario?: string | null
          raca_cor?: string | null
          responsavel_documento?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          setor_id?: string | null
          sexo?: string | null
          telefone?: string | null
          uf?: string | null
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
      pacotes_alta: {
        Row: {
          codigo_hash: string
          criado_em: string
          criado_por: string
          expira_em: string
          id: string
          internacao_id: string
          orientacoes: Json
          paciente_id: string
          retorno: string | null
          retorno_detalhes: Json | null
          revogado_em: string | null
          revogado_por: string | null
          sinais_retorno: Json
          situacao: string
          tentativas: number
          token: string
          unidade_id: string
        }
        Insert: {
          codigo_hash: string
          criado_em?: string
          criado_por: string
          expira_em?: string
          id?: string
          internacao_id: string
          orientacoes?: Json
          paciente_id: string
          retorno?: string | null
          retorno_detalhes?: Json | null
          revogado_em?: string | null
          revogado_por?: string | null
          sinais_retorno?: Json
          situacao?: string
          tentativas?: number
          token: string
          unidade_id: string
        }
        Update: {
          codigo_hash?: string
          criado_em?: string
          criado_por?: string
          expira_em?: string
          id?: string
          internacao_id?: string
          orientacoes?: Json
          paciente_id?: string
          retorno?: string | null
          retorno_detalhes?: Json | null
          revogado_em?: string | null
          revogado_por?: string | null
          sinais_retorno?: Json
          situacao?: string
          tentativas?: number
          token?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_alta_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_alta_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_alta_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_alta_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacotes_alta_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_alta_acessos: {
        Row: {
          aceito: boolean
          em: string
          id: number
          pacote_id: string
        }
        Insert: {
          aceito: boolean
          em?: string
          id?: never
          pacote_id: string
        }
        Update: {
          aceito?: boolean
          em?: string
          id?: never
          pacote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacotes_alta_acessos_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes_alta"
            referencedColumns: ["id"]
          },
        ]
      }
      painel_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          rotulo: string
          segundos: number
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          rotulo?: string
          segundos?: number
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          rotulo?: string
          segundos?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "painel_config_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "painel_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      painel_propagandas: {
        Row: {
          ativo: boolean
          caminho: string
          criado_em: string
          criado_por: string
          id: string
          ordem: number
          titulo: string
          unidade_id: string
        }
        Insert: {
          ativo?: boolean
          caminho: string
          criado_em?: string
          criado_por: string
          id?: string
          ordem?: number
          titulo: string
          unidade_id: string
        }
        Update: {
          ativo?: boolean
          caminho?: string
          criado_em?: string
          criado_por?: string
          id?: string
          ordem?: number
          titulo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "painel_propagandas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "painel_propagandas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      panorama_preferencias: {
        Row: {
          atualizado_em: string
          fora: string[]
          perfil_id: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          fora?: string[]
          perfil_id: string
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          fora?: string[]
          perfil_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panorama_preferencias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panorama_preferencias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pareceres_medicos: {
        Row: {
          analise_iniciada_em: string | null
          analista_id: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          documento_cancelamento_id: string | null
          documento_resposta_id: string | null
          documento_solicitacao_id: string | null
          episodio_id: string | null
          especialidade: string
          id: string
          internacao_id: string | null
          motivo_cancelamento: string | null
          organizacao_id: string
          paciente_id: string
          pergunta: string
          prestador: string | null
          prioridade: string
          rascunho: string | null
          rascunho_salvo_em: string | null
          respondido_em: string | null
          resposta: string | null
          solicitado_em: string
          solicitante_id: string
          status: string
          unidade_id: string
        }
        Insert: {
          analise_iniciada_em?: string | null
          analista_id?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          documento_cancelamento_id?: string | null
          documento_resposta_id?: string | null
          documento_solicitacao_id?: string | null
          episodio_id?: string | null
          especialidade: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          organizacao_id: string
          paciente_id: string
          pergunta: string
          prestador?: string | null
          prioridade?: string
          rascunho?: string | null
          rascunho_salvo_em?: string | null
          respondido_em?: string | null
          resposta?: string | null
          solicitado_em?: string
          solicitante_id: string
          status?: string
          unidade_id: string
        }
        Update: {
          analise_iniciada_em?: string | null
          analista_id?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          documento_cancelamento_id?: string | null
          documento_resposta_id?: string | null
          documento_solicitacao_id?: string | null
          episodio_id?: string | null
          especialidade?: string
          id?: string
          internacao_id?: string | null
          motivo_cancelamento?: string | null
          organizacao_id?: string
          paciente_id?: string
          pergunta?: string
          prestador?: string | null
          prioridade?: string
          rascunho?: string | null
          rascunho_salvo_em?: string | null
          respondido_em?: string | null
          resposta?: string | null
          solicitado_em?: string
          solicitante_id?: string
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pareceres_medicos_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_documento_cancelamento_id_fkey"
            columns: ["documento_cancelamento_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_documento_resposta_id_fkey"
            columns: ["documento_resposta_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_documento_solicitacao_id_fkey"
            columns: ["documento_solicitacao_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_especialidade_fkey"
            columns: ["especialidade"]
            isOneToOne: false
            referencedRelation: "especialidades_parecer"
            referencedColumns: ["nome"]
          },
          {
            foreignKeyName: "pareceres_medicos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pareceres_medicos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      passagens_enfermagem: {
        Row: {
          data: string | null
          entregue_em: string
          entregue_por: string
          id: string
          leitos: Json
          pendencias: Json
          plantao_id: string | null
          recebida_em: string | null
          recebida_por: string | null
          setor_id: string
          texto: string
          turno: string | null
          unidade_id: string
        }
        Insert: {
          data?: string | null
          entregue_em?: string
          entregue_por: string
          id?: string
          leitos?: Json
          pendencias?: Json
          plantao_id?: string | null
          recebida_em?: string | null
          recebida_por?: string | null
          setor_id: string
          texto?: string
          turno?: string | null
          unidade_id: string
        }
        Update: {
          data?: string | null
          entregue_em?: string
          entregue_por?: string
          id?: string
          leitos?: Json
          pendencias?: Json
          plantao_id?: string | null
          recebida_em?: string | null
          recebida_por?: string | null
          setor_id?: string
          texto?: string
          turno?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passagens_enfermagem_entregue_por_fkey"
            columns: ["entregue_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_enfermagem_plantao_id_fkey"
            columns: ["plantao_id"]
            isOneToOne: false
            referencedRelation: "escala_plantao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_enfermagem_recebida_por_fkey"
            columns: ["recebida_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_enfermagem_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_enfermagem_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      passagens_plantao: {
        Row: {
          de_perfil: string
          enviada_em: string
          id: string
          internacao_id: string
          motivo_recusa: string | null
          paciente_id: string
          para_perfil: string
          respondida_em: string | null
          resumo: string
          setor_id: string
          situacao: string
          unidade_id: string
        }
        Insert: {
          de_perfil: string
          enviada_em?: string
          id?: string
          internacao_id: string
          motivo_recusa?: string | null
          paciente_id: string
          para_perfil: string
          respondida_em?: string | null
          resumo: string
          setor_id: string
          situacao?: string
          unidade_id: string
        }
        Update: {
          de_perfil?: string
          enviada_em?: string
          id?: string
          internacao_id?: string
          motivo_recusa?: string | null
          paciente_id?: string
          para_perfil?: string
          respondida_em?: string | null
          resumo?: string
          setor_id?: string
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passagens_plantao_de_perfil_fkey"
            columns: ["de_perfil"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_plantao_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_plantao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_plantao_para_perfil_fkey"
            columns: ["para_perfil"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_plantao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagens_plantao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_acesso_prontuario: {
        Row: {
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          id: string
          motivo: string
          motivo_decisao: string | null
          organizacao_id: string
          paciente_id: string
          papel: string
          solicitante_id: string
          status: string
          unidade_id: string
          valido_ate: string | null
        }
        Insert: {
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: string
          motivo: string
          motivo_decisao?: string | null
          organizacao_id: string
          paciente_id: string
          papel: string
          solicitante_id: string
          status?: string
          unidade_id: string
          valido_ate?: string | null
        }
        Update: {
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: string
          motivo?: string
          motivo_decisao?: string | null
          organizacao_id?: string
          paciente_id?: string
          papel?: string
          solicitante_id?: string
          status?: string
          unidade_id?: string
          valido_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_acesso_prontuario_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_acesso_prontuario_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_acesso_prontuario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_acesso_prontuario_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_acesso_prontuario_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias: {
        Row: {
          autor_id: string | null
          chave: string | null
          criada_em: string
          descricao: string
          id: string
          impeditiva: boolean
          internacao_id: string
          motivo_resolucao: string | null
          origem: string
          paciente_id: string
          prazo: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          situacao: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          autor_id?: string | null
          chave?: string | null
          criada_em?: string
          descricao: string
          id?: string
          impeditiva?: boolean
          internacao_id: string
          motivo_resolucao?: string | null
          origem?: string
          paciente_id: string
          prazo?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          situacao?: string
          tipo: string
          unidade_id: string
        }
        Update: {
          autor_id?: string | null
          chave?: string | null
          criada_em?: string
          descricao?: string
          id?: string
          impeditiva?: boolean
          internacao_id?: string
          motivo_resolucao?: string | null
          origem?: string
          paciente_id?: string
          prazo?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          situacao?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_resolvida_por_fkey"
            columns: ["resolvida_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_unidade_id_fkey"
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
          conselho: string | null
          cpf: string | null
          created_at: string
          crm: string | null
          dados_pessoais: Json
          data_nascimento: string | null
          email: string | null
          foto_url: string | null
          id: string
          nome_completo: string
          registro_numero: string | null
          registro_uf: string | null
          telefone: string | null
          tipo_sanguineo: string | null
          uf_crm: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          dados_pessoais?: Json
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id: string
          nome_completo: string
          registro_numero?: string | null
          registro_uf?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          dados_pessoais?: Json
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome_completo?: string
          registro_numero?: string | null
          registro_uf?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          uf_crm?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preferencias_aviso: {
        Row: {
          atualizado_em: string
          canal: string
          chave: string
          ligado: boolean
          perfil_id: string
        }
        Insert: {
          atualizado_em?: string
          canal?: string
          chave: string
          ligado: boolean
          perfil_id?: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          chave?: string
          ligado?: boolean
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_aviso_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_prescricao: {
        Row: {
          classe_alergenica: string | null
          created_at: string
          dose: string | null
          id: string
          medicamento_id: string
          perfil_id: string
          posologia: string
          quantidade: string | null
          receita_padrao: string | null
          updated_at: string
          via: string | null
        }
        Insert: {
          classe_alergenica?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          medicamento_id: string
          perfil_id?: string
          posologia: string
          quantidade?: string | null
          receita_padrao?: string | null
          updated_at?: string
          via?: string | null
        }
        Update: {
          classe_alergenica?: string | null
          created_at?: string
          dose?: string | null
          id?: string
          medicamento_id?: string
          perfil_id?: string
          posologia?: string
          quantidade?: string | null
          receita_padrao?: string | null
          updated_at?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_prescricao_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferencias_prescricao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricao_itens: {
        Row: {
          autor_id: string | null
          created_at: string
          descricao: string
          diluicao_divergente: boolean
          diluicao_id: string | null
          diluicao_texto: string | null
          diluicao_versao: number | null
          dose: string | null
          duracao: string | null
          horarios: string[] | null
          id: string
          justificativa_divergencia: string | null
          medicamento_id: string | null
          motivo_suspensao: string | null
          observacao: string | null
          ordem: number
          peso_kg: number | null
          posologia: string | null
          prescricao_id: string
          se_necessario: boolean
          suspenso_em: string | null
          suspenso_por: string | null
          tipo: string
          via: string | null
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          descricao: string
          diluicao_divergente?: boolean
          diluicao_id?: string | null
          diluicao_texto?: string | null
          diluicao_versao?: number | null
          dose?: string | null
          duracao?: string | null
          horarios?: string[] | null
          id?: string
          justificativa_divergencia?: string | null
          medicamento_id?: string | null
          motivo_suspensao?: string | null
          observacao?: string | null
          ordem?: number
          peso_kg?: number | null
          posologia?: string | null
          prescricao_id: string
          se_necessario?: boolean
          suspenso_em?: string | null
          suspenso_por?: string | null
          tipo?: string
          via?: string | null
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          descricao?: string
          diluicao_divergente?: boolean
          diluicao_id?: string | null
          diluicao_texto?: string | null
          diluicao_versao?: number | null
          dose?: string | null
          duracao?: string | null
          horarios?: string[] | null
          id?: string
          justificativa_divergencia?: string | null
          medicamento_id?: string | null
          motivo_suspensao?: string | null
          observacao?: string | null
          ordem?: number
          peso_kg?: number | null
          posologia?: string | null
          prescricao_id?: string
          se_necessario?: boolean
          suspenso_em?: string | null
          suspenso_por?: string | null
          tipo?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescricao_itens_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricao_itens_diluicao_id_fkey"
            columns: ["diluicao_id"]
            isOneToOne: false
            referencedRelation: "diluicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricao_itens_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricao_itens_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricao_itens_suspenso_por_fkey"
            columns: ["suspenso_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricoes: {
        Row: {
          assinada_em: string | null
          created_at: string
          criada_por: string | null
          episodio_id: string | null
          id: string
          internacao_id: string | null
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
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
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
          episodio_id?: string | null
          id?: string
          internacao_id?: string | null
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
            foreignKeyName: "prescricoes_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
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
          checkin_distancia_m: number | null
          checkin_em: string | null
          checkin_justificativa: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_automatico: boolean
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
          checkin_distancia_m?: number | null
          checkin_em?: string | null
          checkin_justificativa?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_automatico?: boolean
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
          checkin_distancia_m?: number | null
          checkin_em?: string | null
          checkin_justificativa?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_automatico?: boolean
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
      protocolo_fluxogramas: {
        Row: {
          discriminadores: Json
          id: string
          inclui: string | null
          nome: string
          ordem: number
          protocolo_id: string
          publico: string
        }
        Insert: {
          discriminadores: Json
          id?: string
          inclui?: string | null
          nome: string
          ordem: number
          protocolo_id: string
          publico: string
        }
        Update: {
          discriminadores?: Json
          id?: string
          inclui?: string | null
          nome?: string
          ordem?: number
          protocolo_id?: string
          publico?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_fluxogramas_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos_classificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos_classificacao: {
        Row: {
          codigo: string
          fonte: string
          id: string
          tempos: Json
        }
        Insert: {
          codigo: string
          fonte: string
          id?: string
          tempos?: Json
        }
        Update: {
          codigo?: string
          fonte?: string
          id?: string
          tempos?: Json
        }
        Relationships: []
      }
      protocolos_observacao: {
        Row: {
          ativo: boolean
          etapas: Json
          fonte: string
          nome: string
          publico: string
          sigla: string
          url: string | null
          versao: string
        }
        Insert: {
          ativo?: boolean
          etapas: Json
          fonte: string
          nome: string
          publico: string
          sigla: string
          url?: string | null
          versao: string
        }
        Update: {
          ativo?: boolean
          etapas?: Json
          fonte?: string
          nome?: string
          publico?: string
          sigla?: string
          url?: string | null
          versao?: string
        }
        Relationships: []
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
      receita_protocolos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          fonte: string | null
          id: string
          indicacao: string | null
          itens: Json
          nome: string
          unidade_id: string
          versao: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          fonte?: string | null
          id?: string
          indicacao?: string | null
          itens: Json
          nome: string
          unidade_id: string
          versao?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          fonte?: string | null
          id?: string
          indicacao?: string | null
          itens?: Json
          nome?: string
          unidade_id?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receita_protocolos_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_protocolos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      receita_protocolos_versoes: {
        Row: {
          ativo: boolean
          fonte: string | null
          gravado_em: string
          gravado_por: string | null
          id: string
          indicacao: string | null
          itens: Json
          nome: string
          protocolo_id: string
          unidade_id: string
          versao: string | null
        }
        Insert: {
          ativo: boolean
          fonte?: string | null
          gravado_em?: string
          gravado_por?: string | null
          id?: string
          indicacao?: string | null
          itens: Json
          nome: string
          protocolo_id: string
          unidade_id: string
          versao?: string | null
        }
        Update: {
          ativo?: boolean
          fonte?: string | null
          gravado_em?: string
          gravado_por?: string | null
          id?: string
          indicacao?: string | null
          itens?: Json
          nome?: string
          protocolo_id?: string
          unidade_id?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receita_protocolos_versoes_gravado_por_fkey"
            columns: ["gravado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_protocolos_versoes_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "receita_protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receita_protocolos_versoes_unidade_id_fkey"
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
      reservas_leito: {
        Row: {
          encerrada_em: string | null
          encerrada_por: string | null
          expira_em: string
          id: string
          internacao_id: string | null
          leito_id: string
          motivo: string | null
          motivo_encerramento: string | null
          paciente_id: string | null
          reservado_em: string
          reservado_por: string
          situacao: string
          unidade_id: string
        }
        Insert: {
          encerrada_em?: string | null
          encerrada_por?: string | null
          expira_em: string
          id?: string
          internacao_id?: string | null
          leito_id: string
          motivo?: string | null
          motivo_encerramento?: string | null
          paciente_id?: string | null
          reservado_em?: string
          reservado_por: string
          situacao?: string
          unidade_id: string
        }
        Update: {
          encerrada_em?: string | null
          encerrada_por?: string | null
          expira_em?: string
          id?: string
          internacao_id?: string | null
          leito_id?: string
          motivo?: string | null
          motivo_encerramento?: string | null
          paciente_id?: string | null
          reservado_em?: string
          reservado_por?: string
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_leito_encerrada_por_fkey"
            columns: ["encerrada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_leito_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_leito_leito_id_fkey"
            columns: ["leito_id"]
            isOneToOne: false
            referencedRelation: "leitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_leito_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_leito_reservado_por_fkey"
            columns: ["reservado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_leito_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis_tecnicos: {
        Row: {
          ativo: boolean
          conselho: string
          encerrado_em: string | null
          id: string
          nomeado_em: string
          nomeado_por: string | null
          perfil_id: string
          registro: string
          tipo: string
          uf: string
        }
        Insert: {
          ativo?: boolean
          conselho: string
          encerrado_em?: string | null
          id?: string
          nomeado_em?: string
          nomeado_por?: string | null
          perfil_id: string
          registro: string
          tipo: string
          uf: string
        }
        Update: {
          ativo?: boolean
          conselho?: string
          encerrado_em?: string | null
          id?: string
          nomeado_em?: string
          nomeado_por?: string | null
          perfil_id?: string
          registro?: string
          tipo?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_tecnicos_nomeado_por_fkey"
            columns: ["nomeado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsaveis_tecnicos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      resumos_clinicos: {
        Row: {
          antibioticos: Json
          autor_id: string
          criado_em: string
          id: string
          internacao_id: string
          paciente_id: string
          previsao_alta: string | null
          resumo: string
          unidade_id: string
        }
        Insert: {
          antibioticos?: Json
          autor_id: string
          criado_em?: string
          id?: string
          internacao_id: string
          paciente_id: string
          previsao_alta?: string | null
          resumo: string
          unidade_id: string
        }
        Update: {
          antibioticos?: Json
          autor_id?: string
          criado_em?: string
          id?: string
          internacao_id?: string
          paciente_id?: string
          previsao_alta?: string | null
          resumo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumos_clinicos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumos_clinicos_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumos_clinicos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      revisoes_cadastro: {
        Row: {
          anterior: string | null
          aprovacao: string
          campo: string
          em: string
          fonte: string
          id: number
          lote: string
          novo: string | null
          referencia: string | null
          registro_id: string
          tabela: string
        }
        Insert: {
          anterior?: string | null
          aprovacao: string
          campo: string
          em?: string
          fonte: string
          id?: never
          lote: string
          novo?: string | null
          referencia?: string | null
          registro_id: string
          tabela: string
        }
        Update: {
          anterior?: string | null
          aprovacao?: string
          campo?: string
          em?: string
          fonte?: string
          id?: never
          lote?: string
          novo?: string | null
          referencia?: string | null
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      sae_registros: {
        Row: {
          avaliacao: string
          diagnosticos: Json
          episodio_id: string | null
          evolucao: string
          id: string
          implementacao: Json
          internacao_id: string | null
          paciente_id: string
          planejamento: Json
          registrado_em: string
          registrado_por: string
          unidade_id: string
          versao: number
        }
        Insert: {
          avaliacao?: string
          diagnosticos?: Json
          episodio_id?: string | null
          evolucao?: string
          id?: string
          implementacao?: Json
          internacao_id?: string | null
          paciente_id: string
          planejamento?: Json
          registrado_em?: string
          registrado_por: string
          unidade_id: string
          versao: number
        }
        Update: {
          avaliacao?: string
          diagnosticos?: Json
          episodio_id?: string | null
          evolucao?: string
          id?: string
          implementacao?: Json
          internacao_id?: string | null
          paciente_id?: string
          planejamento?: Json
          registrado_em?: string
          registrado_por?: string
          unidade_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "sae_registros_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sae_registros_internacao_id_fkey"
            columns: ["internacao_id"]
            isOneToOne: false
            referencedRelation: "internacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sae_registros_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sae_registros_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sae_registros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          ordem: number
          setor_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          ordem?: number
          setor_id: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          ordem?: number
          setor_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "salas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
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
          publico: string
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
          publico?: string
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
          publico?: string
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
      sincronizacao_revisao: {
        Row: {
          aparelho_id: string | null
          autor_id: string
          dados: Json
          decidido_em: string | null
          decidido_por: string | null
          decisao: string | null
          hora_fato: string
          id: string
          motivo: string | null
          paciente_id: string
          recebido_em: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          aparelho_id?: string | null
          autor_id: string
          dados: Json
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: string | null
          hora_fato: string
          id: string
          motivo?: string | null
          paciente_id: string
          recebido_em?: string
          tipo: string
          unidade_id: string
        }
        Update: {
          aparelho_id?: string | null
          autor_id?: string
          dados?: Json
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: string | null
          hora_fato?: string
          id?: string
          motivo?: string | null
          paciente_id?: string
          recebido_em?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sincronizacao_revisao_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sincronizacao_revisao_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sincronizacao_revisao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sincronizacao_revisao_unidade_id_fkey"
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
      teleinterconsultas: {
        Row: {
          aceita_em: string | null
          cancelada_em: string | null
          consentimento: string
          consultor_id: string | null
          criada_em: string
          documento_resposta_id: string | null
          documento_solicitacao_id: string | null
          episodio_id: string | null
          id: string
          organizacao_id: string
          paciente_id: string
          pergunta: string
          respondida_em: string | null
          resposta: string | null
          solicitante_id: string
          status: string
          unidade_id: string
          urgencia: string
        }
        Insert: {
          aceita_em?: string | null
          cancelada_em?: string | null
          consentimento: string
          consultor_id?: string | null
          criada_em?: string
          documento_resposta_id?: string | null
          documento_solicitacao_id?: string | null
          episodio_id?: string | null
          id?: string
          organizacao_id: string
          paciente_id: string
          pergunta: string
          respondida_em?: string | null
          resposta?: string | null
          solicitante_id: string
          status?: string
          unidade_id: string
          urgencia?: string
        }
        Update: {
          aceita_em?: string | null
          cancelada_em?: string | null
          consentimento?: string
          consultor_id?: string | null
          criada_em?: string
          documento_resposta_id?: string | null
          documento_solicitacao_id?: string | null
          episodio_id?: string | null
          id?: string
          organizacao_id?: string
          paciente_id?: string
          pergunta?: string
          respondida_em?: string | null
          resposta?: string | null
          solicitante_id?: string
          status?: string
          unidade_id?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "teleinterconsultas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_documento_resposta_id_fkey"
            columns: ["documento_resposta_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_documento_solicitacao_id_fkey"
            columns: ["documento_solicitacao_id"]
            isOneToOne: false
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_episodio_id_fkey"
            columns: ["episodio_id"]
            isOneToOne: false
            referencedRelation: "episodios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teleinterconsultas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_cancelamentos: {
        Row: {
          cancelado_em: string
          cancelado_por: string
          documento_id: string
          motivo: string
          paciente_id: string
          unidade_id: string
        }
        Insert: {
          cancelado_em?: string
          cancelado_por: string
          documento_id: string
          motivo: string
          paciente_id: string
          unidade_id: string
        }
        Update: {
          cancelado_em?: string
          cancelado_por?: string
          documento_id?: string
          motivo?: string
          paciente_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_cancelamentos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_cancelamentos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: true
            referencedRelation: "documentos_clinicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_cancelamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_cancelamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_modelos: {
        Row: {
          ativo: boolean
          ativo_alterado_em: string | null
          ativo_alterado_por: string | null
          criado_em: string
          criado_por: string
          declaracao: string | null
          id: string
          procedimento: string
          raiz_id: string
          texto: string
          titulo: string
          unidade_id: string
          versao: number
          vigente: boolean
        }
        Insert: {
          ativo?: boolean
          ativo_alterado_em?: string | null
          ativo_alterado_por?: string | null
          criado_em?: string
          criado_por: string
          declaracao?: string | null
          id?: string
          procedimento: string
          raiz_id: string
          texto: string
          titulo: string
          unidade_id: string
          versao?: number
          vigente?: boolean
        }
        Update: {
          ativo?: boolean
          ativo_alterado_em?: string | null
          ativo_alterado_por?: string | null
          criado_em?: string
          criado_por?: string
          declaracao?: string | null
          id?: string
          procedimento?: string
          raiz_id?: string
          texto?: string
          titulo?: string
          unidade_id?: string
          versao?: number
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "termos_modelos_ativo_alterado_por_fkey"
            columns: ["ativo_alterado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_modelos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_modelos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
          protocolo_classificacao_id: string | null
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
          protocolo_classificacao_id?: string | null
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
          protocolo_classificacao_id?: string | null
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
          {
            foreignKeyName: "unidades_protocolo_classificacao_id_fkey"
            columns: ["protocolo_classificacao_id"]
            isOneToOne: false
            referencedRelation: "protocolos_classificacao"
            referencedColumns: ["id"]
          },
        ]
      }
      validacoes_prescricao: {
        Row: {
          em: string
          farmaceutico_id: string
          id: string
          item_id: string
          motivo: string | null
          situacao: string
          unidade_id: string
        }
        Insert: {
          em?: string
          farmaceutico_id: string
          id?: string
          item_id: string
          motivo?: string | null
          situacao: string
          unidade_id: string
        }
        Update: {
          em?: string
          farmaceutico_id?: string
          id?: string
          item_id?: string
          motivo?: string | null
          situacao?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_prescricao_farmaceutico_id_fkey"
            columns: ["farmaceutico_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacoes_prescricao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "prescricao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacoes_prescricao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      abrir_chamado_tecnico: {
        Args: {
          p_categoria: string
          p_descricao?: string
          p_responsavel?: string
          p_severidade: string
          p_titulo: string
          p_unidade: string
        }
        Returns: string
      }
      abrir_conversa_direta: {
        Args: { p_destinatario_id: string }
        Returns: string
      }
      abrir_conversa_suporte: { Args: never; Returns: string }
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
      abrir_notificacao: {
        Args: {
          p_cid?: string
          p_episodio?: string
          p_internacao?: string
          p_item?: string
          p_paciente: string
        }
        Returns: string
      }
      abrir_pacote_alta: {
        Args: { p_codigo: string; p_token: string }
        Returns: Json
      }
      abrir_prontuario: {
        Args: { p_internacao?: string; p_paciente: string }
        Returns: undefined
      }
      aceitar_convite: {
        Args: {
          p_codigo: string
          p_conselho?: string
          p_cpf?: string
          p_data_nascimento?: string
          p_nome_completo?: string
          p_registro_numero?: string
          p_registro_uf?: string
          p_termo_versao: string
        }
        Returns: undefined
      }
      aceitar_encaminhamento: {
        Args: { p_encaminhamento: string }
        Returns: undefined
      }
      aceitar_teleinterconsulta: { Args: { p_id: string }; Returns: undefined }
      acessos_prontuario_da_unidade: {
        Args: {
          p_ate?: string
          p_desde?: string
          p_paciente?: string
          p_perfil?: string
          p_unidade: string
        }
        Returns: {
          criado_em: string
          documento_tipo: string
          id: string
          ip: string
          paciente_id: string
          paciente_nome: string
          papel: string
          profissional_id: string
          profissional_nome: string
          tipo_acesso: string
          via_pedido: boolean
        }[]
      }
      acuidade: { Args: { p_paciente: string }; Returns: Json }
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
      adicionar_propaganda: {
        Args: { p_caminho: string; p_titulo: string; p_unidade: string }
        Returns: string
      }
      admin_servidores: { Args: never; Returns: Json }
      admin_unidades: {
        Args: never
        Returns: {
          chamados_abertos: number
          chamados_alta: number
          em_plantao: number
          leitos: number
          leitos_ocupados: number
          municipio: string
          nome: string
          ocupacao_limite_pct: number
          rnds_erro: number
          rnds_mais_antigo: string
          rnds_pendentes: number
          sessoes_ativas: number
          taxa_ocupacao: number
          tipo: string
          uf: string
          ultimo_uso: string
          unidade_id: string
        }[]
      }
      admissao_detalhes_config: { Args: { p_unidade: string }; Returns: Json }
      admissao_ficha: { Args: { p_internacao: string }; Returns: Json }
      aguardar_reavaliacao: {
        Args: { p_episodio: string; p_reavaliar_em: string }
        Returns: undefined
      }
      ajustar_diluicao_unidade: {
        Args: { p_diluicao: string; p_unidade: string }
        Returns: string
      }
      alergia_trava_medicamento: {
        Args: { p_medicamento: string; p_paciente: string }
        Returns: string
      }
      alergias_do_paciente: { Args: { p_paciente: string }; Returns: Json }
      alertas_sepse: {
        Args: { p_unidade: string }
        Returns: {
          nivel: string
          paciente_id: string
          total: number
        }[]
      }
      andamento_chamado_tecnico: {
        Args: { p_id: string }
        Returns: {
          autor: string
          em: string
          id: string
          nota: string
          situacao: string
        }[]
      }
      aprazar: {
        Args: { p_horarios: string[]; p_item: string }
        Returns: undefined
      }
      aprovar_candidatura: { Args: { p_candidatura: string }; Returns: string }
      aprovar_troca: { Args: { p_troca: string }; Returns: undefined }
      atendimento_aberto_do_paciente: {
        Args: { p_paciente: string }
        Returns: {
          chegada_em: string
          em_atendimento: boolean
          episodio_id: string
          etapa: string
          na_minha_porta: boolean
          setor: string
        }[]
      }
      atendimentos_do_paciente: {
        Args: { p_paciente: string }
        Returns: {
          chegada_em: string
          cor_atual: string
          desfecho: string
          encerrado_em: string
          etapa: string
          id: string
          prestador: string
          setor: string
        }[]
      }
      atendimentos_sem_desfecho: {
        Args: { p_exceto?: string; p_paciente: string }
        Returns: {
          atendimento_iniciado_em: string
          chegada_em: string
          classificado_em: string
          cor_atual: string
          episodio_id: string
          etapa: string
          medico_nome: string
          queixa: string
          setor_nome: string
          ultimo_registro: string
          ultimo_registro_em: string
        }[]
      }
      ativar_modelo_termo: {
        Args: { p_ativo: boolean; p_modelo: string }
        Returns: undefined
      }
      atualizar_chamado_tecnico: {
        Args: {
          p_id: string
          p_nota?: string
          p_responsavel?: string
          p_situacao: string
        }
        Returns: undefined
      }
      atualizar_estoque: {
        Args: {
          p_limite_critico?: number
          p_limite_falta?: number
          p_medicamento: string
          p_quantidade: number
          p_unidade: string
        }
        Returns: undefined
      }
      atualizar_propaganda: {
        Args: { p_ativo: boolean; p_id: string; p_titulo: string }
        Returns: undefined
      }
      auditoria_checkin: {
        Args: { p_data?: string; p_unidade: string }
        Returns: {
          dentro: boolean
          diferenca_min: number
          distancia_m: number
          divergente: boolean
          fim_previsto: string
          justificativa: string
          nome: string
          papel: string
          perfil_id: string
          plantao_id: string
          presenca_id: string
          previsto: string
          realizado: string
          setor: string
          situacao: string
          turno: string
        }[]
      }
      avaliacoes_do_paciente: { Args: { p_paciente: string }; Returns: Json }
      avancar_falta: {
        Args: { p_falta: string; p_situacao: string }
        Returns: undefined
      }
      bloquear_leito: {
        Args: { p_leito: string; p_motivo: string; p_observacao?: string }
        Returns: undefined
      }
      buscar_paciente_para_pedido: {
        Args: {
          p_documento?: string
          p_nascimento?: string
          p_nome?: string
          p_unidade: string
        }
        Returns: {
          data_nascimento: string
          nome: string
          paciente_id: string
          prontuario: string
          tem_acesso: boolean
          ultimo_encerramento: string
        }[]
      }
      buscar_pacientes: {
        Args: { p_termo: string; p_unidade: string }
        Returns: {
          cns_final: string
          cpf_final: string
          data_nascimento: string
          episodio_etapa: string
          id: string
          nome: string
          nome_mae: string
          nome_social: string
          prontuario: string
        }[]
      }
      cancelar_alta: {
        Args: { p_internacao: string; p_justificativa: string }
        Returns: undefined
      }
      cancelar_analise_parecer: { Args: { p_id: string }; Returns: undefined }
      cancelar_anexo_prontuario: {
        Args: { p_anexo: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_avaliacao: {
        Args: { p_avaliacao: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_balanco: {
        Args: { p_lancamento: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_documento: {
        Args: { p_documento: string; p_motivo: string }
        Returns: Json
      }
      cancelar_encaminhamento: {
        Args: { p_encaminhamento: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_impressao_prontuario: {
        Args: { p_impressao: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_parecer: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_pedido_acesso: { Args: { p_pedido: string }; Returns: undefined }
      cancelar_reserva: {
        Args: { p_leito: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_teleinterconsulta: { Args: { p_id: string }; Returns: undefined }
      cancelar_termo_consentimento: {
        Args: { p_documento: string; p_motivo: string }
        Returns: undefined
      }
      candidatar_vaga: { Args: { p_vaga: string }; Returns: string }
      censo_recente: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          data: string
          giro_leito: number
          internados: number
          leitos_total: number
          permanencia_media_h: number
          setor_id: string
          setor_nome: string
          taxa_ocupacao: number
        }[]
      }
      chamados_tecnicos_da_unidade: {
        Args: { p_incluir_resolvidos?: boolean; p_unidade: string }
        Returns: {
          aberto_em: string
          aberto_por: string
          atualizado_em: string
          categoria: string
          descricao: string
          id: string
          meu: boolean
          resolvido_em: string
          responsavel: string
          severidade: string
          situacao: string
          titulo: string
          unidade_id: string
          unidade_nome: string
        }[]
      }
      chamados_tecnicos_lista: {
        Args: { p_incluir_resolvidos?: boolean }
        Returns: {
          aberto_em: string
          aberto_por: string
          atualizado_em: string
          categoria: string
          descricao: string
          id: string
          resolvido_em: string
          responsavel: string
          severidade: string
          situacao: string
          titulo: string
          unidade_id: string
          unidade_nome: string
        }[]
      }
      chamar_paciente: {
        Args: { p_episodio: string; p_sala: string }
        Returns: Json
      }
      chave_rascunho: { Args: never; Returns: string }
      checar: {
        Args: {
          p_horario?: string
          p_item: string
          p_motivo?: string
          p_situacao: string
        }
        Returns: string
      }
      classificacoes_do_episodio: {
        Args: { p_episodio: string }
        Returns: {
          autor_nome: string
          autor_papel: string
          avaliacao: Json
          cor: string
          criado_em: string
          discriminador: string
          discriminador_cor: string
          discriminador_livre: boolean
          dor: Json
          fluxograma_nome: string
          gestacao: Json
          grupo_trocado: boolean
          id: string
          justificativa: string
          motivo: string
          oxigenio: Json
          publico: string
          publico_pela_idade: string
          queixa: string
          reclassificacao: boolean
          sinais: Json
        }[]
      }
      classificacoes_do_leito: {
        Args: { p_internacao: string }
        Returns: {
          autor_nome: string
          autor_papel: string
          avaliacao: Json
          cor: string
          criado_em: string
          discriminador: string
          discriminador_cor: string
          discriminador_livre: boolean
          dor: Json
          fluxograma_nome: string
          gestacao: Json
          grupo_trocado: boolean
          id: string
          justificativa: string
          motivo: string
          oxigenio: Json
          publico: string
          publico_pela_idade: string
          queixa: string
          reclassificacao: boolean
          sinais: Json
        }[]
      }
      classificar_risco: {
        Args: {
          p_avaliacao?: Json
          p_cor: string
          p_discriminador?: string
          p_discriminador_livre?: boolean
          p_dor?: Json
          p_episodio: string
          p_fluxograma?: string
          p_gestacao?: Json
          p_grupo_trocado?: boolean
          p_justificativa?: string
          p_motivo?: string
          p_oxigenio?: Json
          p_publico?: string
          p_queixa?: string
          p_sinais: Json
        }
        Returns: string
      }
      codigos_recuperacao_status: {
        Args: never
        Returns: {
          gerados_em: string
          restantes: number
        }[]
      }
      colegas_para_passagem: {
        Args: { p_internacao: string }
        Returns: {
          inicio: string
          nome: string
          perfil_id: string
        }[]
      }
      comentar_chamado_tecnico: {
        Args: { p_id: string; p_nota: string }
        Returns: undefined
      }
      concluir_encaminhamento: {
        Args: { p_encaminhamento: string }
        Returns: undefined
      }
      concluir_higienizacao: { Args: { p_leito: string }; Returns: undefined }
      concluir_parecer: {
        Args: { p_id: string; p_resposta: string }
        Returns: string
      }
      concluir_pendencia: {
        Args: { p_motivo?: string; p_pendencia: string }
        Returns: undefined
      }
      conferir_aih: {
        Args: {
          p_cid_causa?: string
          p_cid_principal: string
          p_cid_secundario?: string
          p_paciente: string
          p_procedimento?: string
        }
        Returns: Json
      }
      conferir_contrato: {
        Args: { p_codigo: string; p_email: string }
        Returns: {
          organizacao: string
          papel: Database["public"]["Enums"]["papel"]
          situacao: string
          unidades: number
          vigente_ate: string
        }[]
      }
      conferir_convite: {
        Args: { p_codigo: string }
        Returns: {
          convidou: string
          convidou_papel: Database["public"]["Enums"]["papel"]
          expira_em: string
          papel: Database["public"]["Enums"]["papel"]
          primeiro_plantao_fim: string
          primeiro_plantao_inicio: string
          setor: string
          situacao: string
          unidade: string
        }[]
      }
      confirmar_vinculo_hermes: {
        Args: { p_canal: string; p_codigo: string; p_identificador: string }
        Returns: string
      }
      contatos_chat: {
        Args: never
        Returns: {
          em_plantao: boolean
          foto: string
          nome: string
          papel: string
          perfil_id: string
          setor_nome: string
        }[]
      }
      contexto_evolucao: { Args: { p_internacao: string }; Returns: Json }
      contexto_sem_conexao: { Args: never; Returns: Json }
      convites_da_unidade: {
        Args: { p_unidade: string }
        Returns: {
          codigo: string
          criado_em: string
          criado_por_nome: string
          expira_em: string
          id: string
          novo_pedido_em: string
          papel: Database["public"]["Enums"]["papel"]
          para_quem: string
          primeiro_plantao_fim: string
          primeiro_plantao_inicio: string
          revogado_em: string
          setor_id: string
          setor_nome: string
          situacao: string
          usado_em: string
          usado_por_nome: string
        }[]
      }
      copiar_documento: { Args: { p_documento: string }; Returns: Json }
      corrigir_evolucao: {
        Args: {
          p_conteudo: string
          p_documento: string
          p_estruturado?: Json
          p_justificativa: string
        }
        Returns: string
      }
      cuidados_enfermagem: {
        Args: { p_episodio?: string; p_internacao?: string; p_paciente: string }
        Returns: Json
      }
      dar_alta: {
        Args: {
          p_cid: string
          p_detalhes?: Json
          p_internacao: string
          p_justificativa?: string
          p_observacoes?: string
          p_quando?: string
          p_tipo: string
        }
        Returns: undefined
      }
      data_atual: { Args: never; Returns: string }
      decidir_apontamento_gaviao: {
        Args: {
          p_chave: string
          p_decisao: string
          p_motivo?: string
          p_unidade: string
        }
        Returns: string
      }
      decidir_destinacao_prontuario: {
        Args: { p_aprovar: boolean; p_id: string; p_motivo?: string }
        Returns: undefined
      }
      decidir_pedido_acesso: {
        Args: { p_aprovar: boolean; p_motivo?: string; p_pedido: string }
        Returns: {
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          id: string
          motivo: string
          motivo_decisao: string | null
          organizacao_id: string
          paciente_id: string
          papel: string
          solicitante_id: string
          status: string
          unidade_id: string
          valido_ate: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos_acesso_prontuario"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decidir_revisao_sincronizacao: {
        Args: { p_aceitar: boolean; p_id: string; p_motivo: string }
        Returns: undefined
      }
      decidir_versao_ferramenta: {
        Args: {
          p_aprovar: boolean
          p_ferramenta: string
          p_nota?: string
          p_versao: string
        }
        Returns: undefined
      }
      definir_admissao_detalhes_obrigatorio: {
        Args: { p_obrigatorio: boolean; p_setor: string }
        Returns: undefined
      }
      definir_ferramenta_unidade: {
        Args: {
          p_ferramenta: string
          p_motivo: string
          p_nota: string
          p_oculta: boolean
          p_unidade: string
        }
        Returns: string
      }
      definir_limites_padrao_farmacia: {
        Args: {
          p_limite_critico: number
          p_limite_falta: number
          p_unidade: string
        }
        Returns: undefined
      }
      definir_minha_disponibilidade_tele: {
        Args: { p_estado: string }
        Returns: undefined
      }
      definir_minhas_especialidades: {
        Args: { p_especialidades: string[] }
        Returns: undefined
      }
      definir_panorama: {
        Args: { p_fora: string[]; p_unidade: string }
        Returns: undefined
      }
      desbloquear_leito: {
        Args: { p_leito: string; p_observacao?: string }
        Returns: undefined
      }
      descartar_rascunho: { Args: { p_rascunho: string }; Returns: undefined }
      desfazer_decisao_gaviao: { Args: { p_id: string }; Returns: undefined }
      desfazer_pendencia: { Args: { p_pendencia: string }; Returns: undefined }
      diagnosticos_do_leito: {
        Args: { p_internacao: string }
        Returns: {
          autor_nome: string
          cid: string
          descricao: string
          encerrado_em: string
          encerrado_por_nome: string
          encerramento: string
          id: string
          motivo_encerramento: string
          origem: string
          registrado_em: string
          status: string
          substitui_id: string
          tempo_doenca: number
          tempo_unidade: string
          tipo: string
        }[]
      }
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
          motivo_alteracao: string | null
          observacoes: string | null
          origem_id: string | null
          principio_ativo: string
          publicado_em: string | null
          publicado_por: string | null
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          risco_flebite: boolean | null
          status: string
          tempo_infusao_min: number | null
          unidade_id: string | null
          updated_at: string
          velocidade_max: string | null
          versao: number
          via: string
          vigente_ate: string | null
          vigente_desde: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "diluicao"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      diluicao_vigente: {
        Args: {
          p_em?: string
          p_medicamento: string
          p_unidade?: string
          p_via: string
        }
        Returns: {
          fonte: string
          id: string
          revisor_crf: string
          texto: string
          unidade_id: string
          versao: number
          vigente_ate: string
          vigente_desde: string
        }[]
      }
      diluicao_voltar_ao_modelo: {
        Args: { p_diluicao: string; p_motivo: string }
        Returns: undefined
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
          motivo_alteracao: string | null
          observacoes: string | null
          origem_id: string | null
          principio_ativo: string
          publicado_em: string | null
          publicado_por: string | null
          reconstituicao_concentracao: string | null
          reconstituicao_diluente: string | null
          reconstituicao_volume_ml: number | null
          revisor_crf: string | null
          risco_flebite: boolean | null
          status: string
          tempo_infusao_min: number | null
          unidade_id: string | null
          updated_at: string
          velocidade_max: string | null
          versao: number
          via: string
          vigente_ate: string | null
          vigente_desde: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "diluicao"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      disponibilidade: {
        Args: { p_unidade: string }
        Returns: {
          apresentacao: string
          atualizado_em: string
          limite_critico: number
          limite_falta: number
          medicamento_id: string
          principio_ativo: string
          quantidade: number
          situacao: string
        }[]
      }
      documentos_do_paciente: {
        Args: {
          p_com_conteudo?: boolean
          p_episodio?: string
          p_paciente: string
          p_tudo?: boolean
        }
        Returns: Json
      }
      editar_mensagem: {
        Args: { p_corpo: string; p_mensagem_id: string }
        Returns: undefined
      }
      eh_super_admin: { Args: never; Returns: boolean }
      emitir_documento: {
        Args: {
          p_conteudo: string
          p_episodio?: string
          p_motivo?: string
          p_paciente: string
          p_retifica?: string
          p_tipo: string
        }
        Returns: Json
      }
      emitir_rascunho: { Args: { p_rascunho: string }; Returns: Json }
      emitir_termo_consentimento: {
        Args: {
          p_dados: Json
          p_episodio?: string
          p_internacao?: string
          p_motivo?: string
          p_paciente: string
          p_retifica?: string
        }
        Returns: Json
      }
      encaminhamentos_do_paciente: {
        Args: { p_paciente: string }
        Returns: Json
      }
      encaminhamentos_recebidos: { Args: never; Returns: Json }
      encaminhar_interno: {
        Args: {
          p_episodio?: string
          p_especialidade: string
          p_internacao?: string
          p_justificativa: string
          p_medico?: string
          p_paciente: string
          p_servico?: string
        }
        Returns: string
      }
      encerrar_responsavel_tecnico: {
        Args: { p_id: string }
        Returns: undefined
      }
      enfermagem_leitos: {
        Args: { p_unidade: string }
        Returns: {
          aprazamentos_atrasados: number
          cid_principal: string
          data_admissao: string
          data_nascimento: string
          episodio_id: string
          internacao_id: string
          leito: string
          nome: string
          paciente_id: string
          queixa: string
          setor_id: string
          setor_nome: string
          sexo: string
          status: string
        }[]
      }
      enfermagem_pacientes_do_setor: {
        Args: { p_setor: string }
        Returns: {
          local: string
          nome: string
          paciente_id: string
        }[]
      }
      enfermagem_pendencias: {
        Args: { p_unidade: string }
        Returns: {
          descricao: string
          horario: string
          item_id: string
          local: string
          nome: string
          paciente_id: string
          previsto_em: string
          setor_id: string
        }[]
      }
      entregar_passagem_enfermagem: {
        Args: { p_leitos: Json; p_setor: string; p_texto?: string }
        Returns: string
      }
      enviar_mensagem: {
        Args: { p_conversa_id: string; p_corpo: string }
        Returns: string
      }
      enviar_passagem: {
        Args: { p_internacao: string; p_para: string; p_resumo: string }
        Returns: string
      }
      equipe_segundo_fator: {
        Args: { p_unidade: string }
        Returns: {
          codigos_restantes: number
          email: string
          nome: string
          papeis: string[]
          perfil_id: string
          super_admin: boolean
          tem_autenticador: boolean
          zerado_em: string
        }[]
      }
      erros_cliente_agrupados: {
        Args: { p_desde?: string; p_incluir_resolvidos?: boolean }
        Returns: {
          assinatura: string
          mensagem: string
          ocorrencias: number
          origem: string
          perfis_afetados: number
          primeira_em: string
          resolvido: boolean
          tipo: string
          ultima_em: string
        }[]
      }
      escala_mes_gestor: {
        Args: { p_ano: number; p_mes: number; p_unidade: string }
        Returns: Json
      }
      estado_alergia: { Args: { p_paciente: string }; Returns: string }
      evoluir_grau_evento: {
        Args: { p_evento: string; p_grau: number }
        Returns: undefined
      }
      excluir_mensagem: { Args: { p_mensagem_id: string }; Returns: undefined }
      faltas_rascunho: { Args: { p_rascunho: string }; Returns: Json }
      farmacia_do_gestor: { Args: { p_unidade: string }; Returns: Json }
      farmacia_estoque: {
        Args: { p_unidade: string }
        Returns: {
          alta_vigilancia: boolean
          apresentacao: string
          atualizado_em: string
          atualizado_por: string
          falta_id: string
          falta_situacao: string
          limite_critico: number
          limite_falta: number
          limite_proprio: boolean
          medicamento_id: string
          principio_ativo: string
          quantidade: number
          situacao: string
        }[]
      }
      ferramentas_da_unidade: {
        Args: { p_unidade: string }
        Returns: {
          definida_em: string
          definida_por: string
          ferramenta_id: string
          nota_local: string
          oculta: boolean
          pendentes: number
          titulo: string
          versao_aprovada: string
        }[]
      }
      fila_aprovacao_ferramentas: {
        Args: never
        Returns: {
          ferramenta_id: string
          fontes: Json
          publico: string
          registrada_em: string
          titulo: string
          versao: string
          vigente_versao: string
        }[]
      }
      fila_checagem: {
        Args: never
        Returns: {
          descricao: string
          diluicao_texto: string
          dose: string
          horarios: string[]
          item_id: string
          local: string
          paciente_id: string
          paciente_nome: string
          por_horario: Json
          posologia: string
          prescrito_em: string
          se_necessario: boolean
          tipo: string
          ultima_em: string
          ultima_horario: string
          ultima_por: string
          ultima_situacao: string
          vasoativo: boolean
          via: string
        }[]
      }
      fila_da_porta: {
        Args: { p_setor: string }
        Returns: {
          atendimento_iniciado_em: string
          chamadas: number
          chegada_em: string
          classificado_em: string
          cor_atual: string
          data_nascimento: string
          episodio_id: string
          etapa: string
          medico: string
          nome: string
          nome_social: string
          prioridades_legais: string[]
          queixa: string
          ultima_chamada_em: string
          ultima_sala: string
          ultimo_chamador: string
        }[]
      }
      fila_validacao: {
        Args: { p_unidade: string }
        Returns: {
          alta_vigilancia: boolean
          descricao: string
          diluicao_divergente: boolean
          diluicao_texto: string
          diluicao_versao: number
          dose: string
          incompatibilidades: string[]
          item_id: string
          justificativa_divergencia: string
          local: string
          paciente_nome: string
          peso_kg: number
          posologia: string
          prescrito_em: string
          prescrito_por: string
          se_necessario: boolean
          ultima_situacao: string
          ultimo_motivo: string
          via: string
        }[]
      }
      finalizar_observacao: {
        Args: {
          p_cid?: string
          p_desfecho: string
          p_detalhes?: Json
          p_internacao: string
          p_relato?: string
        }
        Returns: undefined
      }
      folha_documento: {
        Args: { p_documento: string; p_tipo_impressao?: string }
        Returns: Json
      }
      folha_notificaveis: {
        Args: {
          p_ate?: string
          p_cids?: string[]
          p_de?: string
          p_unidade: string
        }
        Returns: Json
      }
      folha_relatorio: {
        Args: {
          p_episodio?: string
          p_ids?: string[]
          p_internacao?: string
          p_paciente?: string
          p_tipo: string
        }
        Returns: Json
      }
      fracionar_plantao: {
        Args: { p_partes?: number; p_plantao: string }
        Returns: number
      }
      gaviao_apontamentos: {
        Args: { p_unidade: string }
        Returns: {
          chave: string
          decidido_em: string
          decidido_por: string
          decisao: string
          decisao_id: string
          evidencia: string
          icone: string
          motivo: string
          recomendacao: string
          severidade: string
          silenciado_ate: string
          tipo: string
          titulo: string
        }[]
      }
      gaviao_painel_admin: { Args: never; Returns: Json }
      gaviao_registro: {
        Args: { p_unidade: string }
        Returns: {
          autor_nome: string
          criado_em: string
          decisao: string
          desfeita_em: string
          id: string
          meu: boolean
          motivo: string
          silenciado_ate: string
          tipo: string
          titulo: string
        }[]
      }
      gerar_censo_diario: {
        Args: { p_data: string; p_unidade: string }
        Returns: number
      }
      gerar_censo_todas_unidades: { Args: { p_data?: string }; Returns: number }
      gerar_codigo_vinculo_hermes: {
        Args: { p_canal?: string }
        Returns: string
      }
      gerar_codigos_recuperacao: { Args: never; Returns: string[] }
      gerar_convite: {
        Args: {
          p_papel: Database["public"]["Enums"]["papel"]
          p_para_quem?: string
          p_primeiro_plantao_fim?: string
          p_primeiro_plantao_inicio?: string
          p_setor?: string
          p_unidade: string
          p_validade_dias?: number
        }
        Returns: {
          codigo: string
          expira_em: string
          id: string
        }[]
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
      gerar_link_painel: { Args: { p_setor: string }; Returns: string }
      gerar_notificacoes_turno: {
        Args: { p_unidade: string }
        Returns: {
          created_at: string
          id: string
          mensagem: string
          tipo: string
        }[]
      }
      gerar_pacote_alta: {
        Args: {
          p_internacao: string
          p_orientacoes?: Json
          p_retorno?: string
          p_retorno_detalhes?: Json
          p_sinais_retorno?: Json
        }
        Returns: Json
      }
      guarda_prontuarios: { Args: { p_unidade: string }; Returns: Json }
      herdar_segundo_fator: {
        Args: { p_sessao_anterior: string }
        Returns: boolean
      }
      hermes_acessos_anomalos: {
        Args: { p_aberturas?: number; p_horas?: number; p_impressoes?: number }
        Returns: {
          aberturas: number
          impressoes: number
          pacientes_distintos: number
          perfil_id: string
          unidade_id: string
        }[]
      }
      hermes_alertas_escala: {
        Args: { p_perfil: string; p_status?: string[]; p_unidade?: string }
        Returns: {
          criado_em: string
          id: string
          mediana_unidade: number
          medico_id: string
          metrica: string
          status: string
          unidade_id: string
          valor: number
        }[]
      }
      hermes_almanaque_buscar: {
        Args: { p_limite?: number; p_texto: string }
        Returns: {
          pergunta: string
          relevancia: number
          resposta: string
        }[]
      }
      hermes_audit_registrar: {
        Args: {
          p_direction: string
          p_perfil: string
          p_phone: string
          p_resumo?: string
          p_tool_args?: Json
          p_tool_name?: string
        }
        Returns: undefined
      }
      hermes_buracos_escala: {
        Args: { p_horas?: number }
        Returns: {
          horas_sem_ninguem: number
          primeira_hora_brasilia: string
          setor: string
          unidade_id: string
        }[]
      }
      hermes_cadeia_auditoria: { Args: never; Returns: number }
      hermes_checkin_pendente: {
        Args: never
        Returns: {
          escala_id: string
          inicio_brasilia: string
          perfil_id: string
          setor: string
          unidade_id: string
        }[]
      }
      hermes_crm_duplicado: {
        Args: never
        Returns: {
          crm: string
          perfis: string[]
          uf_crm: string
        }[]
      }
      hermes_identidade_por_canal: {
        Args: { p_canal: string; p_identificador: string }
        Returns: {
          email: string
          is_super_admin: boolean
          nome_completo: string
          perfil_id: string
          vinculos: Json
        }[]
      }
      hermes_identidade_por_telefone: {
        Args: { p_e164: string }
        Returns: {
          email: string
          is_super_admin: boolean
          nome_completo: string
          perfil_id: string
          vinculos: Json
        }[]
      }
      hermes_incidentes_abertos: {
        Args: { p_patrulha?: string; p_perfil: string; p_severidade?: string }
        Returns: {
          detectado_em: string
          id: string
          patrulha: string
          severidade: string
          status: string
          titulo: string
        }[]
      }
      hermes_integridade_resumo: { Args: { p_perfil: string }; Returns: Json }
      hermes_liberar_quarentena: {
        Args: { p_id: string; p_perfil: string }
        Returns: boolean
      }
      hermes_maestro_totais: { Args: never; Returns: Json }
      hermes_minhas_notificacoes: {
        Args: { p_dias?: number; p_perfil: string; p_unidade: string }
        Returns: {
          data: string
          mensagem: string
          tipo: string
        }[]
      }
      hermes_perfis_sem_vinculo: {
        Args: never
        Returns: {
          perfil_id: string
        }[]
      }
      hermes_plantao_do_dia: {
        Args: { p_dia: string; p_unidade: string }
        Returns: {
          duracao_horas: number
          inicio_brasilia: string
          profissionais: number
          setor: string
        }[]
      }
      hermes_plantoes_do_perfil: {
        Args: { p_dias?: number; p_perfil: string }
        Returns: {
          duracao_horas: number
          em_curso: boolean
          fim_brasilia: string
          inicio_brasilia: string
          setor: string
          unidade: string
        }[]
      }
      hermes_plantoes_sobrepostos: {
        Args: { p_horas?: number }
        Returns: {
          inicio_a: string
          inicio_b: string
          perfil_id: string
          unidade_a: string
          unidade_b: string
        }[]
      }
      hermes_porta_resumo: {
        Args: { p_horas?: number; p_unidade: string }
        Returns: Json
      }
      hermes_quarentena_pendente: {
        Args: { p_perfil: string }
        Returns: {
          criado_em: string
          id: string
          motivo: string
          origem: string
          tipo: string
        }[]
      }
      hermes_quarentenar_conteudo: {
        Args: {
          p_autor: string
          p_conteudo_hash: string
          p_evidencia?: Json
          p_motivo: string
          p_origem: string
          p_severidade?: string
          p_tenant: string
          p_tipo: string
          p_titulo?: string
        }
        Returns: string
      }
      hermes_relatorio_semanal_ultimo: {
        Args: { p_perfil: string }
        Returns: Json
      }
      hermes_revisoes_paradas: {
        Args: never
        Returns: {
          mais_antiga_brasilia: string
          pendentes: number
          unidade_id: string
        }[]
      }
      hermes_sessao_carregar: {
        Args: { p_perfil: string; p_phone: string }
        Returns: Json
      }
      hermes_sessao_salvar: {
        Args: { p_messages: Json; p_perfil: string; p_phone: string }
        Returns: undefined
      }
      hermes_setores_ocupados_sem_plantao: {
        Args: never
        Returns: {
          leitos_ocupados: number
          setor_id: string
          unidade_id: string
        }[]
      }
      hermes_unidade_censo: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          data: string
          internados: number
          leitos_livres: number
          leitos_ocupados: number
          leitos_total: number
          taxa_ocupacao: number
          turno: string
        }[]
      }
      hermes_unidade_indicadores: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          prescricoes_assinadas: number
          prescricoes_rascunho: number
          receitas_retidas: number
          total_pacientes: number
        }[]
      }
      hermes_unidade_internacoes_por_status: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          status: string
          total: number
        }[]
      }
      hermes_unidade_nomes: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          nome_completo: string
        }[]
      }
      hermes_unidade_profissionais: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          papel: string
          total: number
        }[]
      }
      hermes_unidade_resumo: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: Json
      }
      hermes_unidade_setores: {
        Args: { p_perfil: string; p_unidade: string }
        Returns: {
          nome: string
        }[]
      }
      historico_evolucoes: { Args: { p_internacao: string }; Returns: Json }
      hook_segundo_fator_tentativa: { Args: { event: Json }; Returns: Json }
      horario_servidor: { Args: never; Returns: string }
      impeditivos_alta: { Args: { p_internacao: string }; Returns: Json }
      impressoes_do_prontuario: { Args: { p_paciente: string }; Returns: Json }
      inativar_alergia: {
        Args: { p_alergia: string; p_motivo: string }
        Returns: undefined
      }
      inativar_registros_alergia: {
        Args: { p_alergias: string[]; p_eventos: string[]; p_motivo: string }
        Returns: number
      }
      iniciar_analise_parecer: { Args: { p_id: string }; Returns: undefined }
      iniciar_atendimento: { Args: { p_episodio: string }; Returns: undefined }
      integridade_trilha: { Args: { p_unidade: string }; Returns: Json }
      lancar_balanco: {
        Args: {
          p_aferido_em?: string
          p_descricao: string
          p_episodio?: string
          p_internacao?: string
          p_paciente: string
          p_tipo: string
          p_volume_ml: number
        }
        Returns: string
      }
      leitos_para_ocupar: {
        Args: { p_paciente?: string; p_setor: string }
        Returns: {
          id: string
          identificador: string
          reservado: boolean
        }[]
      }
      liberar_leito_sem_paciente: {
        Args: { p_leito: string; p_motivo: string }
        Returns: undefined
      }
      liberar_pos_plantao: {
        Args: {
          p_minutos: number
          p_motivo: string
          p_perfil: string
          p_unidade: string
        }
        Returns: string
      }
      limites_unidade: { Args: { p_unidade: string }; Returns: Json }
      limites_voltar_ao_padrao: {
        Args: { p_medicamento: string; p_unidade: string }
        Returns: undefined
      }
      listar_conversas: {
        Args: never
        Returns: {
          conversa_id: string
          interlocutor_foto: string
          interlocutor_id: string
          interlocutor_nome: string
          interlocutor_papel: string
          nao_lidas: number
          tipo: string
          ultima_data: string
          ultima_mensagem: string
          unidade_id: string
          unidade_nome: string
        }[]
      }
      mapa_leitos_gestor: { Args: { p_unidade: string }; Returns: Json }
      marcar_agravo: {
        Args: { p_agravo: string; p_cid?: string; p_paciente: string }
        Returns: string
      }
      marcar_avisos_lidos: {
        Args: { p_ids?: string[]; p_unidade: string }
        Returns: string[]
      }
      marcar_favorito_ferramenta: {
        Args: { p_chave: string; p_favorita: boolean }
        Returns: undefined
      }
      marcar_lida: { Args: { p_conversa_id: string }; Returns: undefined }
      marcar_notificacao_lida: { Args: { p_id: string }; Returns: undefined }
      marcar_suspeita_infeccao: {
        Args: { p_ativa: boolean; p_paciente: string }
        Returns: undefined
      }
      marcar_vaga_escala: {
        Args: {
          p_data: string
          p_observacao?: string
          p_setor: string
          p_turno: string
        }
        Returns: string
      }
      medicos_para_encaminhar: { Args: { p_paciente: string }; Returns: Json }
      medidas_pedidas_da_unidade: {
        Args: { p_unidade: string }
        Returns: {
          autor_nome: string
          criado_em: string
          id: string
          minha: boolean
          painel: string
          texto: string
        }[]
      }
      meu_papel_tecnico: { Args: never; Returns: Json }
      meu_plantao_agora: {
        Args: never
        Returns: {
          escala_id: string
          fim: string
          inicio: string
          setor_id: string
          setor_nome: string
          turno: string
          unidade_id: string
        }[]
      }
      meu_proximo_plantao: {
        Args: never
        Returns: {
          agora: string
          escala_id: string
          fim: string
          inicio: string
          rotulo: string
          setor_id: string
          setor_nome: string
          turno: string
          unidade_id: string
          unidade_nome: string
        }[]
      }
      meus_laudos_aih_do_plantao: {
        Args: never
        Returns: {
          cid: string
          emitido_em: string
          id: string
          numero: string
          paciente: string
          paciente_id: string
          procedimento: string
          setor: string
        }[]
      }
      meus_pedidos_acesso: {
        Args: { p_unidade: string }
        Returns: {
          criado_em: string
          decidido_em: string
          id: string
          motivo: string
          motivo_decisao: string
          paciente_id: string
          paciente_nome: string
          status: string
          valido_ate: string
          vigente: boolean
        }[]
      }
      minha_situacao_tele: { Args: { p_unidade: string }; Returns: Json }
      minhas_altas_recentes: {
        Args: { p_unidade: string }
        Returns: {
          alta_registrada_em: string
          cid_alta: string
          data_alta: string
          internacao_id: string
          leito: string
          paciente_id: string
          paciente_nome: string
          pacote_id: string
          setor_nome: string
          status: string
        }[]
      }
      minhas_ferramentas: {
        Args: never
        Returns: {
          chave: string
          favorita: boolean
          favoritada_em: string
          ultimo_uso_em: string
          usos: number
        }[]
      }
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
      nomear_responsavel_tecnico: {
        Args: {
          p_perfil: string
          p_registro: string
          p_tipo: string
          p_uf: string
        }
        Returns: string
      }
      notificacao_compulsoria_dos_cids: {
        Args: { p_cids: string[] }
        Returns: {
          agravo: string
          cid: string
          condicao: string
          destino: string
          imediata: boolean
          item: number
        }[]
      }
      notificacao_compulsoria_periodo: {
        Args: {
          p_ate?: string
          p_cids?: string[]
          p_de?: string
          p_unidade: string
        }
        Returns: {
          agravo: string
          agravo_id: string
          atendimento_em: string
          chave: string
          cid: string
          cid_descricao: string
          condicao: string
          conferido: boolean
          destino: string
          episodio_id: string
          imediata: boolean
          internacao_id: string
          item: string
          item_numero: number
          local: string
          motivo_reabertura: string
          no_acesso: boolean
          numero_sinan: string
          origem: string
          paciente_id: string
          paciente_nome: string
          pendencias: string[]
          reaberto_em: string
          registrado_em: string
          registrado_por: string
          situacao: string
        }[]
      }
      notificacao_ficha: { Args: { p_agravo: string }; Returns: Json }
      observacao_atender: { Args: { p_internacao: string }; Returns: undefined }
      observacao_avancar_protocolo: {
        Args: { p_protocolo: string }
        Returns: undefined
      }
      observacao_encerrar_protocolo: {
        Args: { p_motivo: string; p_protocolo: string }
        Returns: undefined
      }
      observacao_iniciar_protocolo: {
        Args: { p_internacao: string; p_sigla: string }
        Returns: string
      }
      observacao_reavaliado: {
        Args: { p_internacao: string }
        Returns: undefined
      }
      observacao_reavaliar: {
        Args: { p_internacao: string; p_quando: string }
        Returns: string
      }
      ocupacao_setores: {
        Args: { p_unidade: string }
        Returns: {
          internados: number
          limite: number
          setor_id: string
          setor_nome: string
        }[]
      }
      padrao_diluicao_unidade: { Args: { p_unidade: string }; Returns: Json }
      painel_atendimento_ps: { Args: { p_episodio: string }; Returns: Json }
      painel_chamadas: { Args: { p_token: string }; Returns: Json }
      painel_gestor: { Args: { p_unidade: string }; Returns: Json }
      painel_observacao: {
        Args: { p_unidade: string }
        Returns: {
          box: string
          cor: string
          data_nascimento: string
          desfecho: string
          encaminhado: boolean
          entrada: string
          episodio_id: string
          estado: string
          finalizado_em: string
          internacao_id: string
          nome: string
          paciente_id: string
          passagem: Json
          prazo: string
          primeiro_atendimento_em: string
          primeiro_atendimento_por: string
          protocolo: Json
          queixa: string
          reavaliar_em: string
          setor_id: string
          setor_nome: string
          sexo: string
        }[]
      }
      painel_organizacao: {
        Args: { p_dias?: number }
        Returns: {
          chegadas_periodo: number
          encerrados_periodo: number
          evasoes_periodo: number
          internados_agora: number
          leitos: number
          leitos_ocupados: number
          obitos_periodo: number
          porta_agora: number
          profissionais_em_expediente: number
          taxa_ocupacao: number
          taxa_ocupacao_media_censo: number
          unidade_id: string
          unidade_nome: string
        }[]
      }
      painel_propaganda: { Args: { p_unidade: string }; Returns: Json }
      panorama_gestor: { Args: { p_unidade: string }; Returns: Json }
      papel_na_unidade: { Args: { unidade: string }; Returns: string }
      parecer_dados_paciente: { Args: { p_id: string }; Returns: Json }
      pareceres_do_paciente: {
        Args: { p_paciente: string }
        Returns: {
          analise_iniciada_em: string
          analista_nome: string
          cancelado_em: string
          cancelado_nome: string
          documento_resposta_numero: string
          documento_solicitacao_numero: string
          episodio_id: string
          especialidade: string
          id: string
          internacao_id: string
          meu_pedido: boolean
          motivo_cancelamento: string
          pergunta: string
          prestador: string
          prioridade: string
          respondido_em: string
          resposta: string
          solicitado_em: string
          solicitante_nome: string
          status: string
        }[]
      }
      pareceres_fila: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          analise_iniciada_em: string
          analista_nome: string
          documento_resposta_numero: string
          documento_solicitacao_numero: string
          especialidade: string
          id: string
          local: string
          minha: boolean
          paciente_id: string
          paciente_nascimento: string
          paciente_nome: string
          pergunta: string
          posso_analisar: boolean
          prestador: string
          prioridade: string
          rascunho: string
          rascunho_salvo_em: string
          respondido_em: string
          resposta: string
          solicitado_em: string
          solicitante_nome: string
          status: string
        }[]
      }
      passagens_enfermagem_do_plantao: {
        Args: { p_unidade: string }
        Returns: {
          data: string
          entregue_em: string
          entregue_por: string
          entregue_por_nome: string
          id: string
          leitos: Json
          pendencias: Json
          recebida_em: string
          recebida_por: string
          recebida_por_nome: string
          setor_id: string
          setor_nome: string
          texto: string
          turno: string
        }[]
      }
      passar_plantao: {
        Args: { p_destino: string; p_escala: string; p_justificativa?: string }
        Returns: string
      }
      pedidos_acesso_da_unidade: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          criado_em: string
          decidido_em: string
          decidido_por_nome: string
          id: string
          motivo: string
          motivo_decisao: string
          paciente_id: string
          paciente_nascimento: string
          paciente_nome: string
          papel: string
          solicitante_id: string
          solicitante_nome: string
          status: string
          valido_ate: string
        }[]
      }
      pedir_acesso_prontuario: {
        Args: { p_motivo: string; p_paciente: string }
        Returns: string
      }
      pedir_exames_atendimento: {
        Args: { p_episodio: string; p_exames: string[] }
        Returns: number
      }
      pedir_medida: {
        Args: { p_painel?: string; p_texto: string; p_unidade: string }
        Returns: string
      }
      pedir_novo_convite: {
        Args: { p_codigo: string }
        Returns: {
          convidou: string
          pedido_em: string
        }[]
      }
      pendencias_para_encaminhar: {
        Args: { p_episodio?: string; p_internacao?: string; p_paciente: string }
        Returns: string[]
      }
      pendencias_pep: { Args: { p_unidade: string }; Returns: Json }
      perguntar_gestao: {
        Args: { p_pergunta: string; p_unidade: string }
        Returns: Json
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
      portao_requisicao: { Args: never; Returns: undefined }
      prescrever: {
        Args: { p_item: Json; p_paciente: string }
        Returns: string
      }
      prescricao_vigente: {
        Args: { p_em?: string; p_paciente: string }
        Returns: {
          autor: string
          criado_em: string
          descricao: string
          diluicao_divergente: boolean
          diluicao_texto: string
          diluicao_versao: number
          dose: string
          id: string
          justificativa_divergencia: string
          medicamento_id: string
          observacao: string
          peso_kg: number
          posologia: string
          se_necessario: boolean
          suspenso_em: string
          tipo: string
          validacao: string
          validacao_motivo: string
          vasoativo: boolean
          via: string
        }[]
      }
      presencas_do_dia_gestor: {
        Args: { p_unidade: string }
        Returns: {
          checkin_dentro: boolean
          checkin_distancia_m: number
          checkin_em: string
          checkin_justificativa: string
          checkout_automatico: boolean
          checkout_dentro: boolean
          checkout_em: string
          em_escala: boolean
          liberado_pos_ate: string
          nome: string
          observacao: string
          papel: string
          perfil_id: string
        }[]
      }
      procedimentos_do_cid: {
        Args: { p_cid: string; p_limite?: number; p_termo?: string }
        Returns: {
          codigo: string
          como_principal: boolean
          compativel: boolean
          competencia: string
          idade_max: number
          idade_min: number
          nome: string
          sexo: string
        }[]
      }
      protocolo_classificacao_da_unidade: {
        Args: { p_unidade: string }
        Returns: Json
      }
      publicar_diluicao: {
        Args: {
          p_data_revisao?: string
          p_diluicao: string
          p_revisor_crf: string
        }
        Returns: undefined
      }
      publicar_diluicao_versao: { Args: { p_id: string }; Returns: undefined }
      publicar_escala: {
        Args: {
          p_ano: number
          p_mes: number
          p_observacao?: string
          p_unidade: string
        }
        Returns: number
      }
      reabrir_avisos: { Args: { p_ids: string[] }; Returns: number }
      reabrir_notificacao: {
        Args: { p_agravo: string; p_motivo: string }
        Returns: undefined
      }
      receber_passagem_enfermagem: {
        Args: { p_passagem: string }
        Returns: undefined
      }
      receita_protocolos_da_unidade: {
        Args: { p_unidade: string }
        Returns: Json
      }
      recusar_encaminhamento: {
        Args: { p_encaminhamento: string; p_motivo: string }
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
      registrar_admissao: {
        Args: { p_conteudo: string; p_ficha: Json; p_internacao: string }
        Returns: string
      }
      registrar_afericao_crescimento: {
        Args: {
          p_data: string
          p_episodio?: string
          p_estatura?: number
          p_internacao?: string
          p_paciente: string
          p_pc?: number
          p_peso?: number
        }
        Returns: number
      }
      registrar_alergia: {
        Args: {
          p_gravidade?: string
          p_medicamento?: string
          p_paciente: string
          p_reacao?: string
          p_substancia: string
          p_tipo?: string
        }
        Returns: string
      }
      registrar_anexo_prontuario: {
        Args: {
          p_caminho: string
          p_nome: string
          p_paciente: string
          p_tamanho: number
          p_tipo_mime: string
        }
        Returns: string
      }
      registrar_arquivo_farmacia: {
        Args: {
          p_caminho: string
          p_nome: string
          p_tamanho: number
          p_tipo: string
          p_tipo_mime?: string
          p_unidade: string
        }
        Returns: string
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
      registrar_avaliacao: {
        Args: {
          p_episodio?: string
          p_escala: string
          p_internacao?: string
          p_paciente: string
          p_respostas: Json
        }
        Returns: string
      }
      registrar_checkin: {
        Args: {
          p_justificativa?: string
          p_lat?: number
          p_lng?: number
          p_observacao?: string
          p_unidade: string
        }
        Returns: string
      }
      registrar_checkout: {
        Args: { p_lat?: number; p_lng?: number; p_registro: string }
        Returns: undefined
      }
      registrar_curativo: {
        Args: {
          p_aspecto: string
          p_episodio?: string
          p_internacao?: string
          p_local: string
          p_observacao?: string
          p_paciente: string
          p_proxima_troca?: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_desconhece_alergia: {
        Args: { p_paciente: string }
        Returns: string
      }
      registrar_desfecho: {
        Args: {
          p_desfecho: string
          p_detalhes?: Json
          p_episodio: string
          p_relato?: string
        }
        Returns: undefined
      }
      registrar_diagnostico: {
        Args: {
          p_cid: string
          p_episodio?: string
          p_internacao: string
          p_status: string
          p_tempo?: number
          p_tempo_unidade?: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_dispositivo: {
        Args: {
          p_calibre: string
          p_episodio?: string
          p_inserido_em: string
          p_internacao?: string
          p_local: string
          p_observacao?: string
          p_paciente: string
          p_tipo: string
          p_troca_prevista?: string
        }
        Returns: string
      }
      registrar_erro_cliente: {
        Args: {
          p_assinatura?: string
          p_detalhe?: string
          p_mensagem: string
          p_navegador?: string
          p_origem: string
          p_tipo: string
          p_versao_app?: string
        }
        Returns: string
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
      registrar_evento_adverso: {
        Args: {
          p_evento: string
          p_grau: number
          p_item?: string
          p_observacao?: string
          p_paciente: string
        }
        Returns: string
      }
      registrar_evolucao: {
        Args: {
          p_conteudo: string
          p_estruturado?: Json
          p_internacao: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_feedback_busca: {
        Args: { p_comentario?: string; p_request_id: string; p_util: boolean }
        Returns: string
      }
      registrar_ficha: {
        Args: {
          p_dados?: Json
          p_outra_pessoa?: boolean
          p_paciente?: string
          p_prioridades?: string[]
          p_queixa: string
          p_setor: string
        }
        Returns: Json
      }
      registrar_impressao: {
        Args: {
          p_documento?: string
          p_documento_tipo: string
          p_internacao?: string
          p_paciente: string
        }
        Returns: {
          emitido_em: string
          protocolo: string
        }[]
      }
      registrar_impressao_prontuario: {
        Args: {
          p_anexos: string[]
          p_autorizador: string
          p_documentos: string[]
          p_observacao: string
          p_paciente: string
          p_recebedor_documento: string
          p_recebedor_nome: string
        }
        Returns: Json
      }
      registrar_nega_alergia: { Args: { p_paciente: string }; Returns: string }
      registrar_notificacao: {
        Args: { p_agravo: string; p_ficha: Json; p_numero_sinan?: string }
        Returns: undefined
      }
      registrar_pendencia: {
        Args: {
          p_descricao: string
          p_impeditiva?: boolean
          p_internacao: string
          p_prazo?: string
          p_tipo: string
        }
        Returns: string
      }
      registrar_prescricao_itens: {
        Args: { p_itens?: Json; p_observacoes?: string; p_paciente: string }
        Returns: string
      }
      registrar_prescricao_observacao: {
        Args: { p_observacoes?: string; p_paciente: string }
        Returns: string
      }
      registrar_reavaliacao: {
        Args: { p_episodio: string; p_texto: string }
        Returns: string
      }
      registrar_resumo_clinico: {
        Args: {
          p_antibioticos?: Json
          p_internacao: string
          p_previsao_alta?: string
          p_resumo: string
        }
        Returns: string
      }
      registrar_sae: {
        Args: {
          p_avaliacao: string
          p_diagnosticos: Json
          p_episodio?: string
          p_evolucao: string
          p_implementacao: Json
          p_internacao?: string
          p_paciente: string
          p_planejamento: Json
        }
        Returns: string
      }
      registrar_soap: {
        Args: {
          p_avaliacao: string
          p_cid?: string
          p_episodio: string
          p_objetivo: string
          p_plano: string
          p_subjetivo: string
        }
        Returns: string
      }
      registrar_uso_ferramenta: { Args: { p_chave: string }; Returns: number }
      remover_fracionamento: { Args: { p_plantao: string }; Returns: undefined }
      remover_propaganda: { Args: { p_id: string }; Returns: string }
      reordenar_propagandas: {
        Args: { p_ids: string[]; p_unidade: string }
        Returns: undefined
      }
      reservar_leito: {
        Args: {
          p_horas: number
          p_leito: string
          p_motivo?: string
          p_paciente?: string
        }
        Returns: string
      }
      resolver_agravo: {
        Args: {
          p_agravo: string
          p_motivo_descarte?: string
          p_notificado: boolean
          p_numero_sinan?: string
        }
        Returns: undefined
      }
      resolver_erro_cliente: {
        Args: { p_assinatura: string; p_resolver: boolean }
        Returns: undefined
      }
      resolver_exame: {
        Args: {
          p_exame: string
          p_motivo_cancelamento?: string
          p_resultado?: string
        }
        Returns: undefined
      }
      responder_passagem: {
        Args: { p_aceitar: boolean; p_motivo?: string; p_passagem: string }
        Returns: undefined
      }
      responder_teleinterconsulta: {
        Args: { p_id: string; p_resposta: string }
        Returns: string
      }
      resumo_busca_ia: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          consultas: number
          dia: string
          nao_uteis: number
          perguntas_ia: number
          uteis: number
        }[]
      }
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
      resumo_clinico: { Args: { p_internacao: string }; Returns: Json }
      retirar_da_fila: {
        Args: { p_episodio: string; p_justificativa: string; p_motivo: string }
        Returns: undefined
      }
      retirar_diagnostico: {
        Args: { p_diagnostico: string; p_motivo?: string }
        Returns: undefined
      }
      retirar_dispositivo: {
        Args: { p_dispositivo: string; p_motivo?: string }
        Returns: undefined
      }
      retirar_medida: {
        Args: { p_id: string; p_retirar?: boolean }
        Returns: undefined
      }
      retirar_passagem: { Args: { p_passagem: string }; Returns: undefined }
      retirar_vaga_escala: { Args: { p_vaga: string }; Returns: undefined }
      revisao_clinica_panorama: {
        Args: { p_unidade: string }
        Returns: {
          decidida_em: string
          decidida_por: string
          decisao_nota: string
          decisao_registro: string
          ferramenta_id: string
          fontes: Json
          nota_local: string
          oculta: boolean
          pendentes: number
          publico: string
          status_ultima: string
          titulo: string
          versao_ultima: string
          versao_vigente: string
        }[]
      }
      revisar_fluxograma: {
        Args: {
          p_acao: string
          p_discriminadores?: Json
          p_fluxograma: string
          p_fonte?: string
          p_unidade: string
        }
        Returns: string
      }
      revisoes_sem_conexao: {
        Args: { p_unidade: string }
        Returns: {
          autor_nome: string
          dados: Json
          decidido_em: string
          decidido_por_nome: string
          decisao: string
          hora_fato: string
          id: string
          motivo: string
          paciente_nome: string
          recebido_em: string
          tipo: string
        }[]
      }
      revogar_convite: { Args: { p_convite: string }; Returns: undefined }
      revogar_pacote_alta: { Args: { p_pacote: string }; Returns: undefined }
      rotulo_grau_evento: { Args: { p_grau: number }; Returns: string }
      salvar_admissao_esquema: {
        Args: {
          p_ativo?: boolean
          p_esquema?: string
          p_itens: string[]
          p_nome: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_cadastro_paciente: {
        Args: {
          p_dados?: Json
          p_outra_pessoa?: boolean
          p_paciente?: string
          p_setor?: string
        }
        Returns: Json
      }
      salvar_diluicao: {
        Args: { p_dados: Json; p_id: string }
        Returns: string
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
      salvar_ficha_notificacao: {
        Args: { p_agravo: string; p_ficha: Json }
        Returns: string[]
      }
      salvar_limites_unidade: {
        Args: {
          p_checkin_tolerancia_min: number
          p_descanso_ativo: boolean
          p_descanso_horas: number
          p_ocupacao_pct: number
          p_sobrecarga_horas: number
          p_unidade: string
        }
        Returns: Json
      }
      salvar_modelo_termo: {
        Args: {
          p_declaracao?: string
          p_modelo?: string
          p_procedimento: string
          p_texto: string
          p_titulo: string
          p_unidade: string
        }
        Returns: string
      }
      salvar_painel_config: {
        Args: { p_rotulo: string; p_segundos: number; p_unidade: string }
        Returns: undefined
      }
      salvar_preferencias_aviso: {
        Args: { p_canal?: string; p_preferencias: Json }
        Returns: undefined
      }
      salvar_push_subscription: {
        Args: { p_subscription: string }
        Returns: undefined
      }
      salvar_rascunho: {
        Args: {
          p_conteudo: string
          p_paciente: string
          p_rascunho?: string
          p_tipo: string
        }
        Returns: string
      }
      salvar_rascunho_atendimento: {
        Args: { p_conteudo: Json; p_episodio: string }
        Returns: string
      }
      salvar_rascunho_parecer: {
        Args: { p_id: string; p_texto: string }
        Returns: undefined
      }
      salvar_receita_protocolo: {
        Args: {
          p_ativo?: boolean
          p_fonte?: string
          p_indicacao: string
          p_itens: Json
          p_nome: string
          p_protocolo?: string
          p_unidade: string
          p_versao?: string
        }
        Returns: string
      }
      segundo_fator_status: {
        Args: never
        Returns: {
          exigido: boolean
          valido: boolean
          verificado_em: string
        }[]
      }
      segundo_fator_tentativas: {
        Args: never
        Returns: {
          bloqueado_ate: string
          restantes: number
        }[]
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
      sinalizar_falta: {
        Args: {
          p_medicamento: string
          p_observacao?: string
          p_unidade: string
        }
        Returns: string
      }
      sincronizar_registros: { Args: { p_itens: Json }; Returns: Json }
      situacao_checkin: { Args: { p_unidade: string }; Returns: Json }
      situacao_ferramenta: {
        Args: { p_ferramenta: string; p_unidade?: string; p_versao: string }
        Returns: Json
      }
      situacao_leitos: {
        Args: { p_unidade: string }
        Returns: {
          desde: string
          identificador: string
          leito_id: string
          motivo: string
          pode_bloquear: boolean
          pode_cancelar_reserva: boolean
          pode_higienizar: boolean
          pode_reservar: boolean
          reserva_expira_em: string
          reserva_motivo: string
          reserva_paciente: string
          setor_id: string
          setor_nome: string
          status: Database["public"]["Enums"]["status_leito"]
        }[]
      }
      situacao_pacote_alta: { Args: { p_token: string }; Returns: Json }
      solicitar_codigo_2fa: { Args: { p_user: string }; Returns: string }
      solicitar_destinacao_prontuario: {
        Args: { p_destinacao: string; p_motivo: string; p_paciente: string }
        Returns: string
      }
      solicitar_parecer: {
        Args: {
          p_episodio?: string
          p_especialidade: string
          p_internacao?: string
          p_paciente: string
          p_pergunta: string
          p_prestador?: string
          p_prioridade?: string
        }
        Returns: string
      }
      solicitar_teleinterconsulta: {
        Args: {
          p_consentimento: string
          p_episodio?: string
          p_paciente: string
          p_pergunta: string
          p_urgencia?: string
        }
        Returns: string
      }
      solicitar_troca: {
        Args: { p_mensagem?: string; p_plantao_a: string; p_plantao_b: string }
        Returns: string
      }
      suspender_item: {
        Args: { p_item: string; p_motivo: string }
        Returns: undefined
      }
      tele_cobertura: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          agora: boolean
          fim: string
          inicio: string
          medico: string
          minha: boolean
          setor: string
          situacao: string
        }[]
      }
      tele_credenciais: { Args: never; Returns: Json }
      tele_extrato: {
        Args: { p_ate: string; p_de: string }
        Returns: {
          checkin_em: string
          checkout_em: string
          data: string
          escala_id: string
          fim: string
          horas: number
          inicio: string
          pareceres: number
          setor: string
          situacao: string
          turno: string
          unidade: string
          valor: number
        }[]
      }
      tele_historico: { Args: { p_dias?: number }; Returns: Json }
      tele_minha_escala: {
        Args: { p_ate: string; p_de: string }
        Returns: {
          agora: boolean
          checkin_em: string
          checkout_em: string
          data: string
          escala_id: string
          fim: string
          inicio: string
          setor: string
          turno: string
          unidade: string
        }[]
      }
      tele_outras_em_atendimento: {
        Args: { p_unidade: string }
        Returns: {
          aceita_em: string
          consultor: string
          id: string
          setor: string
          urgencia: string
        }[]
      }
      tele_pendencias: { Args: never; Returns: Json }
      teleinterconsultas_da_unidade: {
        Args: { p_dias?: number; p_unidade: string }
        Returns: {
          aceita_em: string
          consentimento: string
          consultor_nome: string
          criada_em: string
          documento_resposta_numero: string
          documento_solicitacao_numero: string
          id: string
          minha: boolean
          paciente_id: string
          paciente_nascimento: string
          paciente_nome: string
          pergunta: string
          respondida_em: string
          resposta: string
          setor_nome: string
          solicitante_nome: string
          status: string
          urgencia: string
        }[]
      }
      telemedicina_na_unidade: {
        Args: { p_unidade: string }
        Returns: {
          ate: string
          crm: string
          nome: string
          setor: string
          situacao: string
        }[]
      }
      tem_acesso_atendimento: { Args: { unidade: string }; Returns: boolean }
      tendencia_acuidade: {
        Args: { p_limite?: number; p_paciente: string }
        Returns: {
          aferido_em: string
          banda: number
          escala: string
          parcial: boolean
          total: number
        }[]
      }
      terminologia_buscar: {
        Args: { p_limite?: number; p_tabela: string; p_termo: string }
        Returns: {
          codigo: string
          descricao: string
          extra: Json
          rank: number
          tabela: string
        }[]
      }
      termos_consentimento_do_paciente: {
        Args: { p_episodio?: string; p_internacao?: string; p_paciente: string }
        Returns: Json
      }
      transferir_internado: {
        Args: {
          p_destino: string
          p_motivo?: string
          p_paciente: string
          p_tipo_evento?: string
        }
        Returns: string
      }
      transferir_paciente: {
        Args: { p_destino: string; p_motivo?: string; p_paciente: string }
        Returns: string
      }
      triagem_recente_do_paciente: {
        Args: { p_paciente: string }
        Returns: Json
      }
      trilha_da_unidade: {
        Args: { p_ate?: string; p_desde?: string; p_unidade: string }
        Returns: {
          acao: string
          ator_nome: string
          criado_em: string
          entidade: string
          entidade_id: string
          payload: Json
          seq: number
        }[]
      }
      turno_atual: { Args: never; Returns: string }
      ultimas_chamadas_porta: {
        Args: { p_limite?: number; p_setor: string }
        Returns: {
          criado_em: string
          etapa: string
          id: string
          nome: string
          numero: number
          quem: string
          sala: string
        }[]
      }
      usar_codigo_recuperacao: { Args: { p_codigo: string }; Returns: Json }
      vagas_abertas: {
        Args: never
        Returns: {
          data: string
          especialidade: string
          fim: string
          id: string
          inicio: string
          latitude: number
          longitude: number
          minha_candidatura: string
          observacao: string
          parte: number
          partes: number
          setor_id: string
          setor_nome: string
          turno: string
          unidade_id: string
          unidade_nome: string
        }[]
      }
      validar_item: {
        Args: { p_confere: boolean; p_item: string; p_motivo?: string }
        Returns: undefined
      }
      ver_pacote_alta_equipe: { Args: { p_pacote: string }; Returns: Json }
      verificacoes_sistema: { Args: never; Returns: Json }
      verificar_codigo_2fa: {
        Args: { p_codigo: string; p_confiar?: boolean; p_rotulo?: string }
        Returns: string
      }
      verificar_dispositivo_2fa: { Args: { p_token: string }; Returns: boolean }
      zerar_segundo_fator: {
        Args: { p_motivo: string; p_usuario: string }
        Returns: undefined
      }
    }
    Enums: {
      papel:
        | "admin"
        | "gestor"
        | "plantonista"
        | "enfermeiro"
        | "tecnico_enfermagem"
        | "recepcao"
        | "farmaceutico"
        | "telemedicina"
      status_leito:
        | "livre"
        | "ocupado"
        | "bloqueado"
        | "higienizacao"
        | "reservado"
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
  terminologia: {
    Tables: {
      cbo: {
        Row: {
          busca: unknown
          codigo: string
          titulo: string
        }
        Insert: {
          busca?: unknown
          codigo: string
          titulo: string
        }
        Update: {
          busca?: unknown
          codigo?: string
          titulo?: string
        }
        Relationships: []
      }
      cid10: {
        Row: {
          busca: unknown
          capitulo: string | null
          codigo: string
          descricao: string
          grupo: string | null
        }
        Insert: {
          busca?: unknown
          capitulo?: string | null
          codigo: string
          descricao: string
          grupo?: string | null
        }
        Update: {
          busca?: unknown
          capitulo?: string | null
          codigo?: string
          descricao?: string
          grupo?: string | null
        }
        Relationships: []
      }
      loinc: {
        Row: {
          busca: unknown
          classe: string | null
          codigo: string
          componente: string | null
          componente_pt: string | null
          nome_curto: string | null
          nome_curto_pt: string | null
          nome_longo: string | null
          propriedade: string | null
          unidade_exemplo: string | null
        }
        Insert: {
          busca?: unknown
          classe?: string | null
          codigo: string
          componente?: string | null
          componente_pt?: string | null
          nome_curto?: string | null
          nome_curto_pt?: string | null
          nome_longo?: string | null
          propriedade?: string | null
          unidade_exemplo?: string | null
        }
        Update: {
          busca?: unknown
          classe?: string | null
          codigo?: string
          componente?: string | null
          componente_pt?: string | null
          nome_curto?: string | null
          nome_curto_pt?: string | null
          nome_longo?: string | null
          propriedade?: string | null
          unidade_exemplo?: string | null
        }
        Relationships: []
      }
      medicamento_cmed: {
        Row: {
          apresentacao: string | null
          busca: unknown
          classe_terapeutica: string | null
          competencia: string | null
          id: string
          laboratorio: string | null
          pf_sem_impostos: number | null
          principio_ativo: string
          produto: string
          registro_anvisa: string | null
          tarja: string | null
        }
        Insert: {
          apresentacao?: string | null
          busca?: unknown
          classe_terapeutica?: string | null
          competencia?: string | null
          id: string
          laboratorio?: string | null
          pf_sem_impostos?: number | null
          principio_ativo: string
          produto: string
          registro_anvisa?: string | null
          tarja?: string | null
        }
        Update: {
          apresentacao?: string | null
          busca?: unknown
          classe_terapeutica?: string | null
          competencia?: string | null
          id?: string
          laboratorio?: string | null
          pf_sem_impostos?: number | null
          principio_ativo?: string
          produto?: string
          registro_anvisa?: string | null
          tarja?: string | null
        }
        Relationships: []
      }
      sigtap_procedimento: {
        Row: {
          busca: unknown
          codigo: string
          competencia: string | null
          complexidade: string | null
          idade_max: number | null
          idade_min: number | null
          nome: string
          sexo: string | null
          valor_sa: number | null
          valor_sh: number | null
          valor_sp: number | null
        }
        Insert: {
          busca?: unknown
          codigo: string
          competencia?: string | null
          complexidade?: string | null
          idade_max?: number | null
          idade_min?: number | null
          nome: string
          sexo?: string | null
          valor_sa?: number | null
          valor_sh?: number | null
          valor_sp?: number | null
        }
        Update: {
          busca?: unknown
          codigo?: string
          competencia?: string | null
          complexidade?: string | null
          idade_max?: number | null
          idade_min?: number | null
          nome?: string
          sexo?: string | null
          valor_sa?: number | null
          valor_sh?: number | null
          valor_sp?: number | null
        }
        Relationships: []
      }
      sigtap_procedimento_cid: {
        Row: {
          cid: string
          competencia: string
          principal: boolean
          procedimento: string
        }
        Insert: {
          cid: string
          competencia: string
          principal: boolean
          procedimento: string
        }
        Update: {
          cid?: string
          competencia?: string
          principal?: boolean
          procedimento?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar: {
        Args: { p_limite?: number; p_tabela: string; p_termo: string }
        Returns: {
          codigo: string
          descricao: string
          extra: Json
          rank: number
          tabela: string
        }[]
      }
      unaccent_text: { Args: { p: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
      papel: [
        "admin",
        "gestor",
        "plantonista",
        "enfermeiro",
        "tecnico_enfermagem",
        "recepcao",
        "farmaceutico",
        "telemedicina",
      ],
      status_leito: [
        "livre",
        "ocupado",
        "bloqueado",
        "higienizacao",
        "reservado",
      ],
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
  terminologia: {
    Enums: {},
  },
} as const

// Aliases escritos à mão. NÃO editar database.ts: rode `npm run gen:tipos`,
// que regenera os tipos do banco e anexa este bloco de novo.
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
export type MeuPlantaoAgora = Database['public']['Functions']['meu_plantao_agora']['Returns'][number]
