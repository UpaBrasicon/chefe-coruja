-- ════════════════════════════════════════════════════════════════════════════
-- VD3 do lote "Virada de data" (BACKLOG.md, decisão do RT em 01/11/2026, P0
-- clínico): escores pediátricos com current_date.
--
-- O banco roda em UTC: das 21h às 24h de Brasília, current_date já é amanhã.
-- A idade em meses que escolhe NEWS2 ou PEWS (calcular_acuidade, acuidade),
-- a faixa de idade do Phoenix/PELOD-2 (observacao_dispara_pelod2, alertas_sepse)
-- e o filtro de pediatria da rotina do PELOD-2 viravam 3 horas antes: na
-- véspera dos 14 anos a criança passava a NEWS2 às 21h, e na véspera do
-- aniversário de mês a faixa do Phoenix/PELOD-2 mudava antes da hora.
--
-- Correção: current_date → private.data_atual() (dia de Brasília), que o resto
-- do banco já usa. Os corpos são os das migrations de origem (abaixo),
-- conferidos por md5 com a produção, só com essa troca. pelod2_rotina roda às
-- 10h UTC e não errava; entra pela regra única.
-- Expand: mesma assinatura, sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/vd3_escores_pediatricos_data.sql
--
-- Rollback: reaplicar
--   private.calcular_acuidade de 20260928000002_fase3_vitais_crus_acuidade.sql,
--   public.acuidade e private.observacao_dispara_pelod2 de 20260928000008_fase3_pelod2_calculo.sql,
--   public.alertas_sepse de 20261119000001_desfecho_encerra_cuidado.sql,
--   private.pelod2_rotina de 20260928000007_fase3_phoenix_pelod2.sql.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.calcular_acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nasc date;
  v_meses int;
  v_grupo int;
  v jsonb := '{}'::jsonb;   -- nome → {n, c, r}
  r record;
  itens jsonb := '[]'::jsonb;
  faltando text[] := '{}';
  azul text[] := '{}';
  total int := 0;
  maior int := 0;
  pt int;
  v_ultima timestamptz;
  v_escala text;
  v_banda int;
BEGIN
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_nasc IS NULL THEN
    RETURN jsonb_build_object('escala', NULL, 'motivo', 'Sem data de nascimento: não dá para escolher entre NEWS2 e PEWS.');
  END IF;
  v_meses := (extract(year FROM age(private.data_atual(), v_nasc)) * 12 + extract(month FROM age(private.data_atual(), v_nasc)))::int;

  FOR r IN SELECT * FROM private.ultimos_vitais(p_paciente) LOOP
    v := v || jsonb_build_object(r.nome, jsonb_build_object('n', r.valor_num, 'c', r.codigo, 'r', r.rotulo));
    v_ultima := greatest(v_ultima, r.aferido_em);
  END LOOP;

  IF v_meses < 14 * 12 THEN
    -- ── PEWS ──
    v_escala := 'PEWS';
    v_grupo := CASE WHEN v_meses < 12 THEN 0 WHEN v_meses < 60 THEN 1 WHEN v_meses < 144 THEN 2 ELSE 3 END;
    -- numéricos por matriz de idade
    FOR r IN SELECT * FROM (VALUES ('Frequência respiratória', 'frequencia-respiratoria', 'fr', ' irpm'),
                                    ('Frequência cardíaca', 'frequencia-cardiaca', 'fc', ' bpm'),
                                    ('Pressão sistólica', 'pressao-arterial-sistolica', 'pas', ' mmHg')) x(rotulo, nome, param, un) LOOP
      IF v -> r.nome ->> 'n' IS NULL THEN faltando := faltando || r.rotulo; CONTINUE; END IF;
      pt := private.pews_faixa((v -> r.nome ->> 'n')::numeric, private.pews_limites(r.param, v_grupo));
      IF pt = -1 THEN
        azul := azul || r.rotulo;
        itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', (v -> r.nome ->> 'n') || r.un, 'pontos', 0, 'azul', true);
      ELSE
        total := total + pt;
        itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', (v -> r.nome ->> 'n') || r.un, 'pontos', pt);
      END IF;
    END LOOP;
    -- esforço respiratório 0/1/2/4
    IF v -> 'esforco-respiratorio' ->> 'c' IS NULL THEN faltando := faltando || 'Esforço respiratório'::text;
    ELSE
      pt := (ARRAY[0, 1, 2, 4])[(v -> 'esforco-respiratorio' ->> 'c')::int + 1];
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Esforço respiratório', 'valor', v -> 'esforco-respiratorio' ->> 'r', 'pontos', pt);
    END IF;
    -- oxigênio 0/2/4
    IF v -> 'oxigenio-suplementar' ->> 'c' IS NULL THEN faltando := faltando || 'Oxigênio'::text;
    ELSE
      pt := CASE v -> 'oxigenio-suplementar' ->> 'c' WHEN 'ar' THEN 0 WHEN '<4' THEN 2 ELSE 4 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Oxigênio', 'valor', v -> 'oxigenio-suplementar' ->> 'r', 'pontos', pt);
    END IF;
    -- saturação 0/1/2
    IF v -> 'saturacao-o2' ->> 'n' IS NULL THEN faltando := faltando || 'Saturação de O₂'::text;
    ELSE
      pt := CASE WHEN (v -> 'saturacao-o2' ->> 'n')::numeric >= 95 THEN 0 WHEN (v -> 'saturacao-o2' ->> 'n')::numeric >= 91 THEN 1 ELSE 2 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Saturação de O₂', 'valor', (v -> 'saturacao-o2' ->> 'n') || '%', 'pontos', pt);
    END IF;
    -- enchimento capilar central 0/4
    IF v -> 'enchimento-capilar' ->> 'c' IS NULL THEN faltando := faltando || 'Enchimento capilar central'::text;
    ELSE
      pt := CASE WHEN v -> 'enchimento-capilar' ->> 'c' = '>=3' THEN 4 ELSE 0 END;
      total := total + pt;
      itens := itens || jsonb_build_object('rotulo', 'Enchimento capilar central', 'valor', v -> 'enchimento-capilar' ->> 'r', 'pontos', pt);
    END IF;
    v_banda := CASE WHEN cardinality(azul) > 0 OR total >= 7 THEN 2 WHEN total >= 1 THEN 1 ELSE 0 END;
    RETURN jsonb_build_object(
      'escala', v_escala, 'total', total, 'banda', v_banda, 'itens', itens, 'faltando', to_jsonb(faltando),
      'azul', to_jsonb(azul), 'parcial', cardinality(faltando) > 0, 'aferido_em', v_ultima,
      'grupo', (ARRAY['0 a 11 meses', '1 a 4 anos', '5 a 11 anos', '12 a 13 anos'])[v_grupo + 1],
      'fonte', 'PEWS: matriz da HQSC Nova Zelândia (2023), derivada do Bedside PEWS (Parshuram 2009). Limiar de alerta 7 (Parshuram 2011). Ação por faixa: protocolo da unidade.');
  END IF;

  -- ── NEWS2 (escala 1) ──
  v_escala := 'NEWS2';
  FOR r IN SELECT * FROM (VALUES
      ('Frequência respiratória', 'frequencia-respiratoria', ' irpm', 1),
      ('Saturação de O₂', 'saturacao-o2', '%', 2),
      ('Temperatura', 'temperatura', ' °C', 3),
      ('Pressão sistólica', 'pressao-arterial-sistolica', ' mmHg', 4),
      ('Frequência cardíaca', 'frequencia-cardiaca', ' bpm', 5)) x(rotulo, nome, un, k) LOOP
    IF v -> r.nome ->> 'n' IS NULL THEN faltando := faltando || r.rotulo; CONTINUE; END IF;
    DECLARE x numeric := (v -> r.nome ->> 'n')::numeric;
    BEGIN
      pt := CASE r.k
        WHEN 1 THEN CASE WHEN x <= 8 THEN 3 WHEN x <= 11 THEN 1 WHEN x <= 20 THEN 0 WHEN x <= 24 THEN 2 ELSE 3 END
        WHEN 2 THEN CASE WHEN x <= 91 THEN 3 WHEN x <= 93 THEN 2 WHEN x <= 95 THEN 1 ELSE 0 END
        WHEN 3 THEN CASE WHEN x <= 35 THEN 3 WHEN x <= 36 THEN 1 WHEN x <= 38 THEN 0 WHEN x <= 39 THEN 1 ELSE 2 END
        WHEN 4 THEN CASE WHEN x <= 90 THEN 3 WHEN x <= 100 THEN 2 WHEN x <= 110 THEN 1 WHEN x <= 219 THEN 0 ELSE 3 END
        WHEN 5 THEN CASE WHEN x <= 40 THEN 3 WHEN x <= 50 THEN 1 WHEN x <= 90 THEN 0 WHEN x <= 110 THEN 1 WHEN x <= 130 THEN 2 ELSE 3 END
      END;
    END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', r.rotulo, 'valor', replace(v -> r.nome ->> 'n', '.', ',') || r.un, 'pontos', pt);
  END LOOP;
  IF v -> 'oxigenio-suplementar' ->> 'c' IS NULL THEN faltando := faltando || 'Suplementação de O₂'::text;
  ELSE
    pt := CASE WHEN v -> 'oxigenio-suplementar' ->> 'c' = 'ar' THEN 0 ELSE 2 END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', 'Suplementação de O₂', 'valor', v -> 'oxigenio-suplementar' ->> 'r', 'pontos', pt);
  END IF;
  IF v -> 'nivel-consciencia' ->> 'c' IS NULL THEN faltando := faltando || 'Nível de consciência'::text;
  ELSE
    pt := CASE WHEN v -> 'nivel-consciencia' ->> 'c' = 'A' THEN 0 ELSE 3 END;
    total := total + pt; maior := greatest(maior, pt);
    itens := itens || jsonb_build_object('rotulo', 'Nível de consciência', 'valor', v -> 'nivel-consciencia' ->> 'r', 'pontos', pt);
  END IF;
  v_banda := CASE WHEN total >= 7 THEN 2 WHEN total >= 5 OR maior = 3 THEN 1 ELSE 0 END;
  RETURN jsonb_build_object(
    'escala', v_escala, 'total', total, 'banda', v_banda, 'itens', itens, 'faltando', to_jsonb(faltando),
    'azul', '[]'::jsonb, 'parcial', cardinality(faltando) > 0, 'aferido_em', v_ultima,
    'fonte', 'NEWS2: Royal College of Physicians, 2017 (escala 1). Referência geral, conferir contra o protocolo institucional.');
END $$;

CREATE OR REPLACE FUNCTION public.acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_nasc date; v_meses int; r jsonb; g jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  r := private.calcular_acuidade(p_paciente);
  IF r ->> 'escala' = 'PEWS' THEN
    v_meses := (extract(year FROM age(private.data_atual(), v_nasc)) * 12 + extract(month FROM age(private.data_atual(), v_nasc)))::int;
    g := private.gatilho_infeccao(p_paciente);
    IF g IS NOT NULL THEN r := r || jsonb_build_object('phoenix', private.calcular_phoenix(p_paciente, v_meses, g)); END IF;
    r := r || jsonb_build_object('pelod2', private.calcular_pelod2(p_paciente, v_meses)
      || jsonb_build_object('indicado', (r ->> 'banda')::int = 2 OR EXISTS (
           SELECT 1 FROM public.pendencias pe WHERE pe.paciente_id = p_paciente AND pe.chave LIKE 'pelod2:%'
             AND pe.criada_em > now() - interval '24 hours')));
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION private.observacao_dispara_pelod2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_nasc date; v_meses int; p jsonb;
BEGIN
  SELECT data_nascimento INTO v_nasc FROM public.pacientes WHERE id = NEW.paciente_id;
  IF v_nasc IS NULL OR v_nasc <= private.data_atual() - interval '14 years' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.conceito c WHERE c.id = NEW.conceito_id AND c.categoria = 'sinal_vital') THEN
    PERFORM private.pelod2_do_dia(NEW.paciente_id);
  END IF;
  IF EXISTS (SELECT 1 FROM public.pendencias WHERE paciente_id = NEW.paciente_id AND chave LIKE 'pelod2:%' AND situacao = 'aberta') THEN
    v_meses := (extract(year FROM age(private.data_atual(), v_nasc)) * 12 + extract(month FROM age(private.data_atual(), v_nasc)))::int;
    p := private.calcular_pelod2(NEW.paciente_id, v_meses);
    IF (p ->> 'completo')::boolean THEN
      UPDATE public.pendencias
         SET situacao = 'concluida', resolvida_em = now(), resolvida_por = NULL,
             motivo_resolucao = 'PELOD-2 do dia completo: ' || (p ->> 'total') || ' pontos'
       WHERE paciente_id = NEW.paciente_id AND chave LIKE 'pelod2:%' AND situacao = 'aberta';
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.alertas_sepse(p_unidade uuid)
 RETURNS TABLE(paciente_id uuid, nivel text, total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; ph jsonb; g jsonb; v_meses int;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  FOR r IN
    SELECT DISTINCT p.id, p.data_nascimento FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > private.data_atual() - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    g := private.gatilho_infeccao(r.id);
    CONTINUE WHEN g IS NULL;
    v_meses := (extract(year FROM age(private.data_atual(), r.data_nascimento)) * 12 + extract(month FROM age(private.data_atual(), r.data_nascimento)))::int;
    ph := private.calcular_phoenix(r.id, v_meses, g);
    paciente_id := r.id;
    total := (ph ->> 'total')::int;
    nivel := CASE WHEN (ph ->> 'choque')::boolean THEN 'choque' WHEN (ph ->> 'sepse')::boolean THEN 'sepse' ELSE 'rastreio' END;
    RETURN NEXT;
  END LOOP;
END $function$
;

CREATE OR REPLACE FUNCTION private.pelod2_rotina()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN
    SELECT DISTINCT i.paciente_id FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > private.data_atual() - interval '14 years'
  LOOP
    IF private.pelod2_do_dia(r.paciente_id) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
