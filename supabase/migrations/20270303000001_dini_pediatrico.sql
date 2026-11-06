-- ════════════════════════════════════════════════════════════════════════════
-- Classificação de pacientes pediátricos de Dini (achado guardado de
-- 09/10/2026; diagnóstico em docs/clinico/DINI-PEDIATRICO-DIAGNOSTICO.md).
-- Decisão do RT (06/11/2026): A em D1 a D7; resumo das situações aprovado.
--   • D1: versão aperfeiçoada de 2014: 11 indicadores de 1 a 4, soma de 11 a
--     44, cinco categorias (11–17, 18–23, 24–30, 31–36, 37–44);
--   • D2: na tela só o resumo nosso de cada situação (src/clinico/enfermagem/
--     dini.ts), sem o texto do Quadro 1 (CC BY-NC 3.0);
--   • D4: enfermeiro de plantão, uma vez por dia (Brasília), na internação,
--     com histórico; corrigir no mesmo dia é retificar com motivo;
--   • D5: menos de 14 anos pela data de nascimento no dia
--     (private.pediatrico_em, a mesma conta do Fugulin). 14 anos ou mais é
--     Fugulin; sem data de nascimento não se classifica pelo Dini;
--   • D7: tabela própria, espelho de classificacoes_fugulin: só inserção,
--     RLS de leitura pela unidade, nada de INSERT/UPDATE/DELETE direto,
--     2FA, auditoria pelo gatilho da Fase 2 (tarefa 8);
--   • o servidor refaz a soma e a categoria.
-- Só aditiva e idempotente (CREATE ... IF NOT EXISTS, CREATE OR REPLACE,
-- DROP ... IF EXISTS só de gatilho e política deste próprio arquivo).
--
-- Funções existentes redefinidas (corpo copiado da última migration que as
-- define, conferido com a homologação em 06/11/2026 por md5 do corpo):
--   • private.auditar_clinico: de 20261031000007_auditoria_clinica.sql, mais
--     o ramo 'classificacoes_dini';
--   • public.cobertura_auditoria_clinica: de 20261031000007_auditoria_clinica.sql,
--     mais a linha 11 'Classificação pediátrica (Dini)' (as 10 linhas de antes
--     ficam iguais).
-- Teste: supabase/tests/depois_dini_pediatrico.sql
--
-- ROLLBACK (nesta ordem):
--   1. reaplicar private.auditar_clinico e public.cobertura_auditoria_clinica
--      de 20261031000007_auditoria_clinica.sql;
--   2. DROP FUNCTION IF EXISTS public.registrar_dini(uuid, jsonb, text),
--      public.dini_da_internacao(uuid), public.dini_de_hoje(uuid[]);
--   3. DROP TABLE IF EXISTS public.classificacoes_dini (leva o gatilho, a
--      política e o índice);
--   4. DROP FUNCTION IF EXISTS private.dini_so_insercao(), private.dini_definicao().
--   A versão da ficha (20270303000002) fica registrada; é só histórico.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.dini_definicao()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '{"versao":"2026-11-06.1","indicadores":["participacao_acompanhante","rede_apoio","atividade","oxigenacao","mobilidade","alimentacao","eliminacoes","higiene","intervalo_controles","terapeutica","integridade_pele"],"faixas":[[11,"Cuidados mínimos (11 a 17)"],[18,"Cuidados intermediários (18 a 23)"],[24,"Alta dependência (24 a 30)"],[31,"Cuidados semi-intensivos (31 a 36)"],[37,"Cuidados intensivos (37 a 44)"]]}'::jsonb
$$;
REVOKE ALL ON FUNCTION private.dini_definicao() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.classificacoes_dini (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id  uuid NOT NULL REFERENCES public.internacoes(id),
  dia            date NOT NULL,
  versao         text NOT NULL,
  respostas      jsonb NOT NULL,
  total          int NOT NULL CHECK (total BETWEEN 11 AND 44),
  categoria      text NOT NULL,
  retifica_id    uuid REFERENCES public.classificacoes_dini(id),
  motivo         text,
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classificacoes_dini_internacao ON public.classificacoes_dini (internacao_id, dia DESC, registrado_em DESC);
CREATE INDEX IF NOT EXISTS classificacoes_dini_retifica ON public.classificacoes_dini (retifica_id) WHERE retifica_id IS NOT NULL;
ALTER TABLE public.classificacoes_dini ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.classificacoes_dini FROM authenticated, anon;
DROP POLICY IF EXISTS classificacoes_dini_select ON public.classificacoes_dini;
CREATE POLICY classificacoes_dini_select ON public.classificacoes_dini FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
CREATE OR REPLACE FUNCTION private.dini_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Classificação Dini é só de inserção: para corrigir, retifique.'; END $$;
REVOKE ALL ON FUNCTION private.dini_so_insercao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS classificacoes_dini_so_insercao ON public.classificacoes_dini;
CREATE TRIGGER classificacoes_dini_so_insercao BEFORE UPDATE OR DELETE ON public.classificacoes_dini
  FOR EACH ROW EXECUTE FUNCTION private.dini_so_insercao();

-- Espelho de public.registrar_fugulin (corpo de 20270209000001_corte_14_anos.sql):
-- mesmas travas (2FA, enfermeiro, paciente em cuidado no plantão, internação
-- ativa), com o corte de idade invertido (D5).
CREATE OR REPLACE FUNCTION public.registrar_dini(p_internacao uuid, p_respostas jsonb, p_motivo text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := private.dini_definicao();
  i public.internacoes; pa public.pacientes;
  k text; v_total int := 0; v_cat text; f jsonb; v_dia date := private.data_atual();
  v_ant uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.data_alta IS NOT NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'A internação não está ativa.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_em_cuidado_no_plantao(i.paciente_id) THEN
    RAISE EXCEPTION 'O Dini é do enfermeiro de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = i.paciente_id;
  -- D5: menos de 14 anos no dia da classificação
  IF pa.data_nascimento IS NULL THEN
    RAISE EXCEPTION 'Sem data de nascimento no cadastro: o Dini é instrumento da criança (menos de 14 anos). Registre a data de nascimento.';
  END IF;
  IF NOT private.pediatrico_em(pa.data_nascimento, v_dia) THEN
    RAISE EXCEPTION 'Dini é instrumento da criança (menos de 14 anos): com 14 anos ou mais, use o Fugulin.';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda os 11 indicadores.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'indicadores' ? k) THEN RAISE EXCEPTION 'Indicador que não é do Dini: %.', k; END IF;
  END LOOP;
  FOR k IN SELECT jsonb_array_elements_text(d -> 'indicadores') LOOP
    IF NOT (p_respostas ? k) OR jsonb_typeof(p_respostas -> k) <> 'number' OR (p_respostas ->> k)::numeric NOT IN (1, 2, 3, 4) THEN
      RAISE EXCEPTION 'Responda os 11 indicadores com situação de 1 a 4 (falta ou inválida: %).', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_cat := f ->> 1; END IF;
  END LOOP;
  -- uma vigente por dia: a segunda do dia é retificação
  SELECT c.id INTO v_ant FROM public.classificacoes_dini c
   WHERE c.internacao_id = i.id AND c.dia = v_dia
     AND NOT EXISTS (SELECT 1 FROM public.classificacoes_dini r WHERE r.retifica_id = c.id)
   ORDER BY c.registrado_em DESC LIMIT 1;
  IF v_ant IS NOT NULL AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'O Dini de hoje já foi feito: para corrigir, diga o motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.classificacoes_dini (unidade_id, paciente_id, internacao_id, dia, versao, respostas, total, categoria,
                                          retifica_id, motivo, registrado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, v_dia, d ->> 'versao', p_respostas, v_total, v_cat,
          v_ant, CASE WHEN v_ant IS NOT NULL THEN btrim(p_motivo) END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_dini(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_dini(uuid, jsonb, text) TO authenticated;

-- histórico da internação (as retificadas aparecem marcadas); espelho de
-- public.fugulin_da_internacao (20261031000006_fugulin.sql)
CREATE OR REPLACE FUNCTION public.dini_da_internacao(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL OR NOT (private.pode_atuar_no_paciente(i.paciente_id) OR private.gestor_da_unidade(i.unidade_id)
                          OR private.acesso_encerrado_vigente(i.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
           'id', c.id, 'dia', c.dia, 'total', c.total, 'categoria', c.categoria, 'respostas', c.respostas, 'versao', c.versao,
           'por', p.nome_completo, 'em', c.registrado_em, 'motivo', c.motivo, 'retifica_id', c.retifica_id,
           'retificada', EXISTS (SELECT 1 FROM public.classificacoes_dini r WHERE r.retifica_id = c.id))
           ORDER BY c.dia DESC, c.registrado_em DESC,
                    EXISTS (SELECT 1 FROM public.classificacoes_dini r WHERE r.retifica_id = c.id))
      FROM public.classificacoes_dini c LEFT JOIN public.perfis p ON p.id = c.registrado_por
     WHERE c.internacao_id = i.id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.dini_da_internacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dini_da_internacao(uuid) TO authenticated;

-- para a lista da enfermagem: o Dini de hoje de cada internação (ou nulo = pendente);
-- espelho de public.fugulin_de_hoje (20261031000006_fugulin.sql)
CREATE OR REPLACE FUNCTION public.dini_de_hoje(p_internacoes uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(i.id, (
           SELECT jsonb_build_object('total', c.total, 'categoria', c.categoria)
             FROM public.classificacoes_dini c
            WHERE c.internacao_id = i.id AND c.dia = private.data_atual()
              AND NOT EXISTS (SELECT 1 FROM public.classificacoes_dini r WHERE r.retifica_id = c.id)
            ORDER BY c.registrado_em DESC LIMIT 1)), '{}'::jsonb)
    FROM public.internacoes i
   WHERE i.id = ANY (p_internacoes) AND private.segundo_fator_ok() AND private.membro_da_unidade(i.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.dini_de_hoje(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dini_de_hoje(uuid[]) TO authenticated;

-- ── auditoria clínica (Fase 2, tarefa 8): o Dini deixa linha na trilha ─────
-- Corpo de 20261031000007_auditoria_clinica.sql, igual ao da homologação,
-- com o ramo 'classificacoes_dini' logo depois do Fugulin.
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
  WHEN 'classificacoes_dini' THEN
    PERFORM private.registrar_auditoria('dini_registrado', 'classificacoes_dini', NEW.id, NEW.unidade_id,
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

-- só a tabela nova; os gatilhos das outras ficam como estão
DROP TRIGGER IF EXISTS trg_auditar_clinico_classificacoes_dini ON public.classificacoes_dini;
CREATE TRIGGER trg_auditar_clinico_classificacoes_dini AFTER INSERT ON public.classificacoes_dini
  FOR EACH ROW EXECUTE FUNCTION private.auditar_clinico();

-- Corpo de 20261031000007_auditoria_clinica.sql, igual ao da homologação, com
-- a linha 11 (Dini) no fim. As linhas 1 a 10 não mudam (rótulos e contas).
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
        UNION ALL
        SELECT 11, 'Classificação pediátrica (Dini)', count(*),
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.log_auditoria a WHERE a.entidade = 'classificacoes_dini' AND a.entidade_id = x.id AND a.acao = 'dini_registrado'))
          FROM public.classificacoes_dini x WHERE x.unidade_id = p_unidade AND x.registrado_em >= v_desde
      ) e));
END $$;
REVOKE ALL ON FUNCTION public.cobertura_auditoria_clinica(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobertura_auditoria_clinica(uuid, int) TO authenticated;
