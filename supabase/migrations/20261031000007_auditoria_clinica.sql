-- Fase 2, tarefa 8 do BACKLOG.md — expandir a auditoria clínica.
--
-- Mapa (09/10/2026). Os eventos clínicos críticos que gravavam o registro
-- (só inserção, com autor e hora) mas NÃO deixavam linha na trilha
-- encadeada (log_auditoria) eram:
--   • prescrição: criar item, suspender, aprazar;
--   • checagem: administração feita, não feita ou recusada;
--   • SOAP, evolução estruturada, SAE, classificação de risco;
--   • alergia registrada ou inativada;
--   • escalas (Braden, Morse, NIPS, FLACC) e Fugulin;
--   • internação: abertura, leito, setor, status (alta, óbito,
--     transferência) e transferência entre setores.
-- Agora cada um deles grava uma linha na trilha por gatilho, na mesma
-- transação; o conteúdo clínico continua só na tabela do registro (a trilha
-- guarda quem, o quê, qual registro e quando, com lista fechada de campos).
-- Sinais vitais (observacao) ficam de fora de propósito: volume alto, e cada
-- aferição já é linha só de inserção com autor, hora e marca sem conexão.
--
-- A lista fechada de campos do payload ganha chaves estruturais, sem dado
-- de pessoa: situacao, gravidade, versao, horario, exige, cor, escala,
-- anterior, retifica.
--
-- Verificação: além da cadeia de hash (integridade_trilha, Fase 1), a nova
-- cobertura_auditoria_clinica conta, por tipo de evento e período, quantos
-- registros clínicos da unidade NÃO têm a linha correspondente na trilha
-- (desde a instalação desta migration).
-- Só aditiva: gatilhos e funções novos; payload_auditoria com a lista maior.
--
-- ROLLBACK: DROP dos gatilhos trg_auditar_clinico_*; DROP FUNCTION
--   private.auditar_clinico, public.cobertura_auditoria_clinica; reaplicar
--   private.payload_auditoria de 20260926000006; DROP TABLE private.marcos.

CREATE TABLE IF NOT EXISTS private.marcos (chave text PRIMARY KEY, em timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.marcos FROM PUBLIC, anon, authenticated;
INSERT INTO private.marcos (chave) VALUES ('auditoria_clinica') ON CONFLICT (chave) DO NOTHING;

-- ── lista fechada do payload, com chaves estruturais novas ─────────────────
CREATE OR REPLACE FUNCTION private.payload_auditoria(p_entidade text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_saida jsonb := '{}'::jsonb;
  k text; v jsonb;
  permitidas text[] := ARRAY['perfil_id','papel','setor_id','leito_id','unidade_id','quantidade','prefixo',
                             'tipo','status','destinatario','conversa','ordem','ativo','limite','motivo_codigo',
                             -- Fase 2, tarefa 8: estruturais, sem dado de pessoa
                             'situacao','gravidade','versao','horario','exige','cor','escala','anterior','retifica'];
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RETURN NULL; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(p_payload) LOOP
    IF jsonb_typeof(v) IN ('object', 'array') THEN
      IF jsonb_typeof(v) = 'object' THEN
        v_saida := v_saida || jsonb_build_object('campos_alterados', (SELECT jsonb_agg(x ORDER BY x) FROM jsonb_object_keys(v) x));
      END IF;
    ELSIF k = ANY (permitidas)
       OR (k = 'nome' AND p_entidade IN ('setores', 'leitos', 'banners', 'unidades')) THEN
      v_saida := v_saida || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  RETURN v_saida;
END; $$;

-- ── gatilho único: uma linha na trilha por evento clínico ──────────────────
CREATE OR REPLACE FUNCTION private.auditar_clinico() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'prescricao_itens' THEN
    SELECT unidade_id INTO v_unidade FROM public.prescricoes WHERE id = NEW.prescricao_id;
    IF TG_OP = 'INSERT' THEN
      PERFORM private.registrar_auditoria('prescricao_item_criado', 'prescricao_itens', NEW.id, v_unidade,
        jsonb_build_object('tipo', NEW.tipo, 'versao', NEW.versao, 'anterior', NEW.substitui_item_id));
    ELSE
      IF OLD.suspenso_em IS NULL AND NEW.suspenso_em IS NOT NULL THEN
        PERFORM private.registrar_auditoria('prescricao_item_suspenso', 'prescricao_itens', NEW.id, v_unidade, NULL);
      END IF;
      IF OLD.horarios IS DISTINCT FROM NEW.horarios THEN
        PERFORM private.registrar_auditoria('prescricao_item_aprazado', 'prescricao_itens', NEW.id, v_unidade,
          jsonb_build_object('quantidade', cardinality(coalesce(NEW.horarios, '{}'::text[]))));
      END IF;
    END IF;
  WHEN 'administracoes' THEN
    PERFORM private.registrar_auditoria('administracao_registrada', 'administracoes', NEW.id, NEW.unidade_id,
      jsonb_build_object('situacao', NEW.situacao, 'horario', NEW.horario_previsto));
  WHEN 'atendimento_registros' THEN
    PERFORM private.registrar_auditoria('atendimento_registrado', 'atendimento_registros', NEW.id, NEW.unidade_id, NULL);
  WHEN 'evolucoes_estruturadas' THEN
    PERFORM private.registrar_auditoria('evolucao_registrada', 'evolucoes_estruturadas', NEW.documento_id, NEW.unidade_id,
      jsonb_build_object('tipo', NEW.tipo_documento, 'versao', NEW.versao, 'papel', NEW.papel));
  WHEN 'classificacoes_risco' THEN
    PERFORM private.registrar_auditoria('classificacao_risco', 'classificacoes_risco', NEW.id, NEW.unidade_id,
      jsonb_build_object('cor', NEW.cor, 'tipo', CASE WHEN NEW.reclassificacao THEN 'reclassificacao' ELSE 'classificacao' END));
  WHEN 'sae_registros' THEN
    PERFORM private.registrar_auditoria('sae_registrada', 'sae_registros', NEW.id, NEW.unidade_id, jsonb_build_object('versao', NEW.versao));
  WHEN 'alergias_paciente' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM private.registrar_auditoria('alergia_registrada', 'alergias_paciente', NEW.id, NEW.unidade_id,
        jsonb_build_object('tipo', NEW.tipo, 'gravidade', NEW.gravidade));
    ELSIF OLD.inativada_em IS NULL AND NEW.inativada_em IS NOT NULL THEN
      PERFORM private.registrar_auditoria('alergia_inativada', 'alergias_paciente', NEW.id, NEW.unidade_id, NULL);
    END IF;
  WHEN 'avaliacoes_escala' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM private.registrar_auditoria('escala_registrada', 'avaliacoes_escala', NEW.id, NEW.unidade_id,
        jsonb_build_object('escala', NEW.escala, 'versao', NEW.versao));
    ELSIF OLD.cancelada_em IS NULL AND NEW.cancelada_em IS NOT NULL THEN
      PERFORM private.registrar_auditoria('escala_cancelada', 'avaliacoes_escala', NEW.id, NEW.unidade_id, jsonb_build_object('escala', NEW.escala));
    END IF;
  WHEN 'classificacoes_fugulin' THEN
    PERFORM private.registrar_auditoria('fugulin_registrado', 'classificacoes_fugulin', NEW.id, NEW.unidade_id,
      jsonb_build_object('versao', NEW.versao, 'retifica', NEW.retifica_id));
  WHEN 'transferencias_paciente' THEN
    PERFORM private.registrar_auditoria('transferencia_setor', 'transferencias_paciente', NEW.id, NEW.unidade_id,
      jsonb_build_object('setor_id', NEW.setor_destino_id));
  WHEN 'internacoes' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM private.registrar_auditoria('internacao_aberta', 'internacoes', NEW.id, NEW.unidade_id,
        jsonb_build_object('status', NEW.status, 'setor_id', NEW.setor_atual_id, 'leito_id', NEW.leito_atual_id));
    ELSE
      IF OLD.leito_atual_id IS DISTINCT FROM NEW.leito_atual_id THEN
        PERFORM private.registrar_auditoria('internacao_leito', 'internacoes', NEW.id, NEW.unidade_id, jsonb_build_object('leito_id', NEW.leito_atual_id));
      END IF;
      IF OLD.setor_atual_id IS DISTINCT FROM NEW.setor_atual_id THEN
        PERFORM private.registrar_auditoria('internacao_setor', 'internacoes', NEW.id, NEW.unidade_id, jsonb_build_object('setor_id', NEW.setor_atual_id));
      END IF;
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM private.registrar_auditoria('internacao_status', 'internacoes', NEW.id, NEW.unidade_id, jsonb_build_object('status', NEW.status));
      END IF;
    END IF;
  END CASE;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.auditar_clinico() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['administracoes', 'atendimento_registros', 'evolucoes_estruturadas', 'classificacoes_risco',
                           'sae_registros', 'classificacoes_fugulin', 'transferencias_paciente'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar_clinico_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_auditar_clinico_%1$s AFTER INSERT ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.auditar_clinico()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['prescricao_itens', 'alergias_paciente', 'avaliacoes_escala', 'internacoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar_clinico_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_auditar_clinico_%1$s AFTER INSERT OR UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.auditar_clinico()', t);
  END LOOP;
END $$;

-- ── verificação: registros clínicos sem a linha na trilha ──────────────────
CREATE OR REPLACE FUNCTION public.cobertura_auditoria_clinica(p_unidade uuid, p_dias int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_desde timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  v_desde := greatest((SELECT em FROM private.marcos WHERE chave = 'auditoria_clinica'),
                      now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 366)));
  RETURN jsonb_build_object('desde', v_desde, 'conferido_em', now(), 'eventos', (
    SELECT jsonb_agg(jsonb_build_object('evento', e.evento, 'registros', e.registros, 'sem_trilha', e.sem_trilha) ORDER BY e.ordem)
      FROM (
        SELECT 1 ordem, 'Prescrição (itens)' evento, count(*) registros,
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'prescricao_itens' AND a.entidade_id = x.id AND a.acao = 'prescricao_item_criado')) sem_trilha
          FROM public.prescricao_itens x JOIN public.prescricoes pr ON pr.id = x.prescricao_id
         WHERE pr.unidade_id = p_unidade AND x.created_at >= v_desde
        UNION ALL
        SELECT 2, 'Checagem (administrações)', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'administracoes' AND a.entidade_id = x.id AND a.acao = 'administracao_registrada'))
          FROM public.administracoes x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
        UNION ALL
        SELECT 3, 'Atendimento (SOAP)', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'atendimento_registros' AND a.entidade_id = x.id AND a.acao = 'atendimento_registrado'))
          FROM public.atendimento_registros x WHERE x.unidade_id = p_unidade AND x.criado_em >= v_desde
        UNION ALL
        SELECT 4, 'Evolução', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'evolucoes_estruturadas' AND a.entidade_id = x.documento_id AND a.acao = 'evolucao_registrada'))
          FROM public.evolucoes_estruturadas x WHERE x.unidade_id = p_unidade AND x.created_at >= v_desde
        UNION ALL
        SELECT 5, 'Classificação de risco', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'classificacoes_risco' AND a.entidade_id = x.id AND a.acao = 'classificacao_risco'))
          FROM public.classificacoes_risco x WHERE x.unidade_id = p_unidade AND x.criado_em >= v_desde
        UNION ALL
        SELECT 6, 'SAE', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'sae_registros' AND a.entidade_id = x.id AND a.acao = 'sae_registrada'))
          FROM public.sae_registros x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
        UNION ALL
        SELECT 7, 'Alergias', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'alergias_paciente' AND a.entidade_id = x.id AND a.acao = 'alergia_registrada'))
          FROM public.alergias_paciente x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
        UNION ALL
        SELECT 8, 'Escalas e Fugulin', (SELECT count(*) FROM public.avaliacoes_escala x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde)
                                     + (SELECT count(*) FROM public.classificacoes_fugulin x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde),
               (SELECT count(*) FROM public.avaliacoes_escala x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
                   AND NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'avaliacoes_escala' AND a.entidade_id = x.id AND a.acao = 'escala_registrada'))
             + (SELECT count(*) FROM public.classificacoes_fugulin x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
                   AND NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'classificacoes_fugulin' AND a.entidade_id = x.id AND a.acao = 'fugulin_registrado'))
        UNION ALL
        SELECT 9, 'Transferência de setor', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'transferencias_paciente' AND a.entidade_id = x.id AND a.acao = 'transferencia_setor'))
          FROM public.transferencias_paciente x WHERE x.unidade_id = p_unidade AND x.created_at >= v_desde
        UNION ALL
        SELECT 10, 'Internação (abertura)', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'internacoes' AND a.entidade_id = x.id AND a.acao = 'internacao_aberta'))
          FROM public.internacoes x WHERE x.unidade_id = p_unidade AND x.created_at >= v_desde
      ) e));
END $$;
REVOKE ALL ON FUNCTION public.cobertura_auditoria_clinica(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobertura_auditoria_clinica(uuid, int) TO authenticated;
