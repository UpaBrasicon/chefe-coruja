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
      agravos_notificacao: {
        Row: {
          agravo: string
          cid: string | null
          episodio_id: string | null
          id: string
          internacao_id: string | null
          motivo_descarte: string | null
          numero_sinan: string | null
          paciente_id: string
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
          id?: string
          internacao_id?: string | null
          motivo_descarte?: string | null
          numero_sinan?: string | null
          paciente_id: string
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
          id?: string
          internacao_id?: string | null
          motivo_descarte?: string | null
          numero_sinan?: string | null
          paciente_id?: string
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
            foreignKeyName: "agravos_notificacao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
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
      alergias_paciente: {
        Row: {
          id: string
          inativada_em: string | null
          inativada_por: string | null
          motivo_inativacao: string | null
          paciente_id: string
          reacao: string | null
          registrado_em: string
          registrado_por: string
          substancia: string
          substancia_norm: string
          unidade_id: string
        }
        Insert: {
          id?: string
          inativada_em?: string | null
          inativada_por?: string | null
          motivo_inativacao?: string | null
          paciente_id: string
          reacao?: string | null
          registrado_em?: string
          registrado_por: string
          substancia: string
          substancia_norm: string
          unidade_id: string
        }
        Update: {
          id?: string
          inativada_em?: string | null
          inativada_por?: string | null
          motivo_inativacao?: string | null
          paciente_id?: string
          reacao?: string | null
          registrado_em?: string
          registrado_por?: string
          substancia?: string
          substancia_norm?: string
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
      classificacoes_risco: {
        Row: {
          autor_id: string
          autor_papel: string
          avaliacao: Json
          cor: string
          criado_em: string
          discriminador: string | null
          discriminador_cor: string | null
          episodio_id: string
          fluxograma_id: string | null
          fluxograma_nome: string | null
          id: string
          justificativa: string | null
          motivo: string | null
          paciente_id: string
          publico: string
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
          episodio_id: string
          fluxograma_id?: string | null
          fluxograma_nome?: string | null
          id?: string
          justificativa?: string | null
          motivo?: string | null
          paciente_id: string
          publico: string
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
          episodio_id?: string
          fluxograma_id?: string | null
          fluxograma_nome?: string | null
          id?: string
          justificativa?: string | null
          motivo?: string | null
          paciente_id?: string
          publico?: string
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
      documentos_clinicos: {
        Row: {
          aparelho_id: string | null
          assinado_em: string | null
          assinatura_id: string | null
          autor_id: string
          carimbo_tempo: string | null
          conteudo: string
          conteudo_hash: string
          created_at: string
          documento_raiz_id: string
          emitido_em: string | null
          episodio_id: string | null
          estado: string
          id: string
          internacao_id: string | null
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
          carimbo_tempo?: string | null
          conteudo: string
          conteudo_hash: string
          created_at?: string
          documento_raiz_id: string
          emitido_em?: string | null
          episodio_id?: string | null
          estado?: string
          id?: string
          internacao_id?: string | null
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
          carimbo_tempo?: string | null
          conteudo?: string
          conteudo_hash?: string
          created_at?: string
          documento_raiz_id?: string
          emitido_em?: string | null
          episodio_id?: string | null
          estado?: string
          id?: string
          internacao_id?: string | null
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
          cns: string | null
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
          cns?: string | null
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
          cns?: string | null
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
          revogado_em: string | null
          revogado_por: string | null
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
          revogado_em?: string | null
          revogado_por?: string | null
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
          revogado_em?: string | null
          revogado_por?: string | null
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
      abrir_pacote_alta: {
        Args: { p_codigo: string; p_token: string }
        Returns: Json
      }
      abrir_prontuario: {
        Args: { p_internacao?: string; p_paciente: string }
        Returns: undefined
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
      alertas_sepse: {
        Args: { p_unidade: string }
        Returns: {
          nivel: string
          paciente_id: string
          total: number
        }[]
      }
      aprazar: {
        Args: { p_horarios: string[]; p_item: string }
        Returns: undefined
      }
      aprovar_candidatura: { Args: { p_candidatura: string }; Returns: string }
      aprovar_troca: { Args: { p_troca: string }; Returns: undefined }
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
      chamar_paciente: {
        Args: { p_episodio: string; p_sala: string }
        Returns: Json
      }
      checar: {
        Args: {
          p_horario?: string
          p_item: string
          p_motivo?: string
          p_situacao: string
        }
        Returns: string
      }
      classificar_risco: {
        Args: {
          p_avaliacao?: Json
          p_cor: string
          p_discriminador?: string
          p_episodio: string
          p_fluxograma?: string
          p_justificativa?: string
          p_motivo?: string
          p_publico?: string
          p_sinais: Json
        }
        Returns: string
      }
      colegas_para_passagem: {
        Args: { p_internacao: string }
        Returns: {
          inicio: string
          nome: string
          perfil_id: string
        }[]
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
      contexto_sem_conexao: { Args: never; Returns: Json }
      corrigir_evolucao: {
        Args: {
          p_conteudo: string
          p_documento: string
          p_justificativa: string
        }
        Returns: string
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
      decidir_revisao_sincronizacao: {
        Args: { p_aceitar: boolean; p_id: string; p_motivo: string }
        Returns: undefined
      }
      descartar_rascunho: { Args: { p_rascunho: string }; Returns: undefined }
      desfazer_pendencia: { Args: { p_pendencia: string }; Returns: undefined }
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
      enviar_mensagem: {
        Args: { p_conversa_id: string; p_corpo: string }
        Returns: string
      }
      enviar_passagem: {
        Args: { p_internacao: string; p_para: string; p_resumo: string }
        Returns: string
      }
      excluir_mensagem: { Args: { p_mensagem_id: string }; Returns: undefined }
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
      folha_documento: {
        Args: { p_documento: string; p_tipo_impressao?: string }
        Returns: Json
      }
      fracionar_plantao: {
        Args: { p_partes?: number; p_plantao: string }
        Returns: number
      }
      gaviao_painel_admin: { Args: never; Returns: Json }
      gerar_censo_diario: {
        Args: { p_data: string; p_unidade: string }
        Returns: number
      }
      gerar_censo_todas_unidades: { Args: { p_data?: string }; Returns: number }
      gerar_codigo_vinculo_hermes: {
        Args: { p_canal?: string }
        Returns: string
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
        Args: { p_internacao: string; p_orientacoes?: Json; p_retorno?: string }
        Returns: Json
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
      hermes_almanaque_buscar: {
        Args: { p_limite?: number; p_texto: string }
        Returns: {
          pergunta: string
          relevancia: number
          resposta: string
        }[]
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
      hermes_revisoes_paradas: {
        Args: never
        Returns: {
          mais_antiga_brasilia: string
          pendentes: number
          unidade_id: string
        }[]
      }
      hermes_setores_ocupados_sem_plantao: {
        Args: never
        Returns: {
          leitos_ocupados: number
          setor_id: string
          unidade_id: string
        }[]
      }
      horario_servidor: { Args: never; Returns: string }
      impeditivos_alta: { Args: { p_internacao: string }; Returns: Json }
      inativar_alergia: {
        Args: { p_alergia: string; p_motivo: string }
        Returns: undefined
      }
      iniciar_atendimento: { Args: { p_episodio: string }; Returns: undefined }
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
      marcar_agravo: {
        Args: { p_agravo: string; p_cid?: string; p_paciente: string }
        Returns: string
      }
      marcar_lida: { Args: { p_conversa_id: string }; Returns: undefined }
      marcar_notificacao_lida: { Args: { p_id: string }; Returns: undefined }
      marcar_suspeita_infeccao: {
        Args: { p_ativa: boolean; p_paciente: string }
        Returns: undefined
      }
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
      painel_chamadas: { Args: { p_token: string }; Returns: Json }
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
      publicar_diluicao: {
        Args: {
          p_data_revisao?: string
          p_diluicao: string
          p_revisor_crf: string
        }
        Returns: undefined
      }
      publicar_diluicao_versao: { Args: { p_id: string }; Returns: undefined }
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
      registrar_alergia: {
        Args: { p_paciente: string; p_reacao?: string; p_substancia: string }
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
      registrar_desfecho: {
        Args: {
          p_desfecho: string
          p_detalhes?: Json
          p_episodio: string
          p_relato?: string
        }
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
      registrar_evolucao: {
        Args: { p_conteudo: string; p_internacao: string; p_tipo: string }
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
      remover_fracionamento: { Args: { p_plantao: string }; Returns: undefined }
      resolver_agravo: {
        Args: {
          p_agravo: string
          p_motivo_descarte?: string
          p_notificado: boolean
          p_numero_sinan?: string
        }
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
      retirar_da_fila: {
        Args: { p_episodio: string; p_justificativa: string; p_motivo: string }
        Returns: undefined
      }
      retirar_passagem: { Args: { p_passagem: string }; Returns: undefined }
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
      revogar_pacote_alta: { Args: { p_pacote: string }; Returns: undefined }
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
      segundo_fator_status: {
        Args: never
        Returns: {
          exigido: boolean
          valido: boolean
          verificado_em: string
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
      sincronizar_registros: { Args: { p_itens: Json }; Returns: Json }
      situacao_pacote_alta: { Args: { p_token: string }; Returns: Json }
      solicitar_troca: {
        Args: { p_mensagem?: string; p_plantao_a: string; p_plantao_b: string }
        Returns: string
      }
      suspender_item: {
        Args: { p_item: string; p_motivo: string }
        Returns: undefined
      }
      tem_acesso_atendimento: { Args: { unidade: string }; Returns: boolean }
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
      turno_atual: { Args: never; Returns: string }
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
