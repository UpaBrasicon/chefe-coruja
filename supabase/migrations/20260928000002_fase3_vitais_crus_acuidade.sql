-- Fase 3.3 — sinais vitais crus e acuidade calculada num lugar só.
--
-- 1) Sinal vital não recebe mais marca de alterado/crítico: as faixas do
--    conceito eram de adulto (FC 60-100…) e marcavam criança como alterada.
--    A análise é da enfermagem e do médico; o que o sistema calcula é o
--    escore de acuidade, com fonte declarada.
-- 2) public.acuidade(paciente): NEWS2 no adulto (14 anos completos ou mais),
--    PEWS na pediatria (antes dos 14 anos).
--    * NEWS2: Royal College of Physicians, 2017 (escala 1). Referência geral,
--      conferir contra o protocolo institucional.
--    * PEWS: Health Quality & Safety Commission New Zealand, "National
--      paediatric early warning system — user guide", mar/2023, Tabela 1
--      (matriz por idade), derivado do Bedside PEWS (Parshuram, Crit Care
--      2009;13:R135). Zona azul = gatilho de parâmetro único. Limiar de alerta
--      7: Parshuram, Crit Care 2011;15:R184. Decisão da unidade em 26/09/2026.
--    Faixa nenhuma aqui é inventada nem convertida de adulto para criança.
--    Vital faltando não trava o cálculo: o escore sai parcial e diz o que faltou.

-- ── vitais crus ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.validar_observacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tipo      text;
  v_unidade   uuid;
  v_categoria text;
  v_opcoes    bigint;
  v_ref_min   numeric;
  v_ref_max   numeric;
BEGIN
  IF (NEW.valor_num IS NOT NULL)::int
   + (NEW.valor_texto IS NOT NULL)::int
   + (NEW.valor_conceito_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'observacao: preencher exatamente um de valor_num/valor_texto/valor_conceito_id';
  END IF;

  SELECT c.tipo, c.unidade_id, c.ref_min, c.ref_max, c.categoria
    INTO v_tipo, v_unidade, v_ref_min, v_ref_max, v_categoria
  FROM public.conceito c WHERE c.id = NEW.conceito_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % não existe', NEW.conceito_id;
  END IF;

  IF v_tipo IN ('numerico','escore') AND NEW.valor_num IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_num', NEW.conceito_id;
  END IF;
  IF v_tipo = 'texto' AND NEW.valor_texto IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_texto', NEW.conceito_id;
  END IF;
  IF v_tipo = 'categorico' AND NEW.valor_conceito_id IS NULL THEN
    RAISE EXCEPTION 'observacao: conceito % exige valor_conceito_id', NEW.conceito_id;
  END IF;

  IF NEW.valor_conceito_id IS NOT NULL THEN
    SELECT count(*) INTO v_opcoes
    FROM public.conceito_opcao o
    WHERE o.id = NEW.valor_conceito_id AND o.conceito_id = NEW.conceito_id;
    IF v_opcoes = 0 THEN
      RAISE EXCEPTION 'observacao: opção % não pertence ao conceito %', NEW.valor_conceito_id, NEW.conceito_id;
    END IF;
  END IF;

  IF v_unidade IS NOT NULL AND NEW.unidade_id IS DISTINCT FROM v_unidade THEN
    RAISE EXCEPTION 'observacao: conceito pertence a outra unidade';
  END IF;

  -- sinal vital: cru. Sem faixa, sem marca.
  IF v_categoria = 'sinal_vital' THEN
    NEW.ref_min := NULL;
    NEW.ref_max := NULL;
    NEW.flag := 'N';
    RETURN NEW;
  END IF;

  IF NEW.ref_min IS NULL THEN NEW.ref_min := v_ref_min; END IF;
  IF NEW.ref_max IS NULL THEN NEW.ref_max := v_ref_max; END IF;

  IF NEW.valor_num IS NULL OR (NEW.ref_min IS NULL AND NEW.ref_max IS NULL) THEN
    NEW.flag := 'N';
  ELSIF NEW.ref_max IS NOT NULL AND NEW.valor_num > NEW.ref_max * 1.5 THEN
    NEW.flag := 'CRIT';
  ELSIF NEW.ref_min IS NOT NULL AND NEW.valor_num > 0 AND NEW.valor_num < NEW.ref_min * 0.5 THEN
    NEW.flag := 'CRIT';
  ELSIF NEW.ref_max IS NOT NULL AND NEW.valor_num > NEW.ref_max THEN
    NEW.flag := 'H';
  ELSIF NEW.ref_min IS NOT NULL AND NEW.valor_num < NEW.ref_min THEN
    NEW.flag := 'L';
  ELSE
    NEW.flag := 'N';
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.conceito SET ref_min = NULL, ref_max = NULL WHERE categoria = 'sinal_vital';
UPDATE public.observacao o SET ref_min = NULL, ref_max = NULL, flag = 'N'
  FROM public.conceito c
 WHERE c.id = o.conceito_id AND c.categoria = 'sinal_vital' AND (o.flag <> 'N' OR o.ref_min IS NOT NULL OR o.ref_max IS NOT NULL);

-- ── conceitos que o PEWS precisa ────────────────────────────────────────────
-- conceito global tem unidade_id NULL: o UNIQUE não pega, então NOT EXISTS
INSERT INTO public.conceito (unidade_id, nome, tipo, categoria, ordem_exibicao)
SELECT NULL, x.nome, 'categorico', 'sinal_vital', x.ordem
FROM (VALUES ('oxigenio-suplementar', 12), ('esforco-respiratorio', 13), ('enchimento-capilar', 14)) x(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.conceito c WHERE c.unidade_id IS NULL AND c.nome = x.nome);
INSERT INTO public.conceito_opcao (conceito_id, rotulo, valor, ordem)
SELECT c.id, x.rotulo, x.valor, x.ordem
FROM public.conceito c
JOIN (VALUES
  ('oxigenio-suplementar', 'Ar ambiente', 'ar', 1),
  ('oxigenio-suplementar', 'Abaixo de 4 L/min (ou abaixo de 35% em alto fluxo)', '<4', 2),
  ('oxigenio-suplementar', '4 L/min ou mais (ou 35% ou mais em alto fluxo)', '>=4', 3),
  ('esforco-respiratorio', 'Nenhum', '0', 1),
  ('esforco-respiratorio', 'Leve', '1', 2),
  ('esforco-respiratorio', 'Moderado', '2', 3),
  ('esforco-respiratorio', 'Grave', '3', 4),
  ('enchimento-capilar', 'Menos de 3 segundos', '<3', 1),
  ('enchimento-capilar', '3 segundos ou mais', '>=3', 2)
) AS x(nome, rotulo, valor, ordem) ON x.nome = c.nome AND c.unidade_id IS NULL
ON CONFLICT (conceito_id, rotulo) DO NOTHING;

-- ── PEWS: faixa por limite superior inclusivo; -1 = zona azul ───────────────
CREATE OR REPLACE FUNCTION private.pews_faixa(p_valor numeric, p_limites int[])
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce((
    SELECT (ARRAY[-1, 4, 2, 1, 0, 1, 2, 4])[i]
    FROM generate_subscripts(p_limites, 1) i
    WHERE floor(p_valor) <= p_limites[i]
    ORDER BY i LIMIT 1), 4)
$$;

-- Matriz HQSC NZ 2023, Tabela 1. Grupo: 0 = 0 a 11 meses, 1 = 1 a 4 anos,
-- 2 = 5 a 11 anos, 3 = 12 anos ou mais (até antes dos 14, nesta unidade).
CREATE OR REPLACE FUNCTION private.pews_limites(p_param text, p_grupo int)
RETURNS int[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_param || ':' || p_grupo
    WHEN 'fr:0' THEN ARRAY[9,19,24,29,49,54,69,100000]
    WHEN 'fr:1' THEN ARRAY[4,14,17,19,39,44,54,100000]
    WHEN 'fr:2' THEN ARRAY[4,11,14,19,29,34,44,100000]
    WHEN 'fr:3' THEN ARRAY[4,9,11,14,24,29,34,100000]
    WHEN 'fc:0' THEN ARRAY[59,79,89,109,159,169,179,100000]
    WHEN 'fc:1' THEN ARRAY[59,69,79,89,139,149,159,100000]
    WHEN 'fc:2' THEN ARRAY[49,59,69,79,129,139,154,100000]
    WHEN 'fc:3' THEN ARRAY[39,49,59,64,109,119,134,100000]
    WHEN 'pas:0' THEN ARRAY[49,54,64,74,99,119,149,100000]
    WHEN 'pas:1' THEN ARRAY[54,64,74,89,109,124,159,100000]
    WHEN 'pas:2' THEN ARRAY[54,69,79,89,119,139,169,100000]
    WHEN 'pas:3' THEN ARRAY[64,69,84,99,134,149,189,100000]
  END
$$;

-- Últimas aferições (até 24h) do paciente, por conceito: número ou código da opção.
CREATE OR REPLACE FUNCTION private.ultimos_vitais(p_paciente uuid)
RETURNS TABLE (nome text, valor_num numeric, codigo text, rotulo text, aferido_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (c.nome) c.nome, o.valor_num, op.valor, op.rotulo, o.aferido_em
  FROM public.observacao o
  JOIN public.conceito c ON c.id = o.conceito_id AND c.categoria = 'sinal_vital'
  LEFT JOIN public.conceito_opcao op ON op.id = o.valor_conceito_id
  WHERE o.paciente_id = p_paciente AND o.aferido_em > now() - interval '24 hours'
  ORDER BY c.nome, o.aferido_em DESC
$$;

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
  v_meses := (extract(year FROM age(current_date, v_nasc)) * 12 + extract(month FROM age(current_date, v_nasc)))::int;

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

-- Porta pública: quem cuida do paciente (ou o gestor) lê a acuidade.
CREATE OR REPLACE FUNCTION public.acuidade(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN private.calcular_acuidade(p_paciente);
END $$;
REVOKE ALL ON FUNCTION public.acuidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acuidade(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.calcular_acuidade(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ultimos_vitais(uuid) FROM PUBLIC, anon, authenticated;
