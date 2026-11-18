-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U12 (diagnóstico docs/ubs/PERCURSO-UBS-DIAGNOSTICO.md, U12 =
-- A do RT em 17/11/2026), parte 1: resultado de exame feito fora da UBS, sem
-- pedido no app. Achados A5 e A11: o exame que chega em papel não entrava, e a
-- HbA1c só contava pela integração com o laboratório.
--
-- 1. private.ubs_exames_externos(): os exames com campo estruturado — HbA1c
--    (%), sífilis (VDRL, com o título), HIV, hepatite B (HBsAg) e hepatite C
--    (anti-HCV), cada um no código da população geral e no da gestante.
-- 2. public.registrar_exame_externo(paciente, código, data, valor, laboratório):
--    médico ou enfermeiro da UBS registra o resultado trazido em papel. Grava o
--    pedido já com resultado (origem manual, "exame feito fora da UBS"), na data
--    do exame, com o item estruturado. Assim conta no hiperdia (HbA1c) e nos
--    testes do pré-natal (C3) pela data do exame.
-- 3. Correção achada no levantamento: private.pre_natal_grupo_teste não tinha os
--    códigos SIGTAP atuais de HIV, hepatite B e hepatite C de laboratório (geral
--    e gestante) nem os testes rápidos de hepatite B e C da população geral. O
--    pedido do enfermeiro (HIV e HBsAg em gestante) não contava no pré-natal.
--
-- Idempotente. Teste: supabase/tests/ubs_u12_exame_externo.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION public.registrar_exame_externo(uuid, text, date, text, text), private.ubs_exames_externos();
--   recriar private.pre_natal_grupo_teste(text) de 20270222000001_pre_natal.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. exames com campo estruturado ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ubs_exames_externos()
RETURNS TABLE (codigo text, nome text, tipo text) LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT * FROM (VALUES
    ('0202010503', 'Hemoglobina glicada (HbA1c)', 'percentual'),
    ('0202031110', 'Sífilis (VDRL)', 'vdrl'),
    ('0202031179', 'Sífilis (VDRL) em gestante', 'vdrl'),
    ('0202031500', 'HIV', 'reagente'),
    ('0202031519', 'HIV em gestante', 'reagente'),
    ('0202031446', 'Hepatite B (HBsAg)', 'reagente'),
    ('0202031454', 'Hepatite B (HBsAg) em gestante', 'reagente'),
    ('0202031470', 'Hepatite C (anti-HCV)', 'reagente'),
    ('0202031489', 'Hepatite C (anti-HCV) em gestante', 'reagente')
  ) AS t(codigo, nome, tipo)
$$;
REVOKE ALL ON FUNCTION private.ubs_exames_externos() FROM PUBLIC, anon, authenticated;

-- ── 2. registro do exame feito fora ─────────────────────────────────────────
-- p_valor: HbA1c em % ("7,2"); HIV e hepatites "reagente" ou "nao_reagente";
-- VDRL "nao_reagente" ou o título ("1:8").
CREATE OR REPLACE FUNCTION public.registrar_exame_externo(p_paciente uuid, p_procedimento text, p_data date,
  p_valor text, p_laboratorio text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes; x record; v_eu uuid := private.meu_perfil_id();
  v_valor text := lower(btrim(coalesce(p_valor, ''))); v_num numeric; v_texto text; v_item jsonb;
  v_lab text := nullif(btrim(coalesce(p_laboratorio, '')), '');
  v_quando timestamptz; v_exame uuid; v_res uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = pa.unidade_id AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'O exame feito fora é registrado na UBS do paciente.';
  END IF;
  IF NOT (private.tenho_papel(pa.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: o exame feito fora é registrado pelo médico ou pelo enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO x FROM private.ubs_exames_externos() e WHERE e.codigo = regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g');
  IF NOT FOUND THEN RAISE EXCEPTION 'Exame fora da lista de exames feitos fora (HbA1c, sífilis, HIV e hepatites B e C).'; END IF;
  IF p_data IS NULL OR p_data > private.data_atual() OR private.data_atual() - p_data > 730 THEN
    RAISE EXCEPTION 'A data do exame tem de ser de hoje para trás, até 2 anos.';
  END IF;
  IF length(coalesce(v_lab, '')) > 160 THEN RAISE EXCEPTION 'Nome do laboratório longo demais.'; END IF;

  IF x.tipo = 'percentual' THEN
    BEGIN v_num := replace(v_valor, ',', '.')::numeric; EXCEPTION WHEN OTHERS THEN v_num := NULL; END;
    IF v_num IS NULL OR v_num < 3 OR v_num > 20 THEN RAISE EXCEPTION 'HbA1c: informe o valor em %% (de 3 a 20).'; END IF;
    v_texto := 'HbA1c ' || replace(v_num::text, '.', ',') || '%';
    v_item := jsonb_build_object('analito', 'Hemoglobina glicada', 'loinc', '4548-4', 'valor', v_num::text, 'unidade', '%');
  ELSIF x.tipo = 'vdrl' THEN
    IF v_valor = 'nao_reagente' THEN v_texto := 'Não reagente';
    ELSIF v_valor ~ '^1:(1|2|4|8|16|32|64|128|256|512|1024)$' THEN v_texto := 'Reagente ' || v_valor;
    ELSE RAISE EXCEPTION 'VDRL: informe "não reagente" ou o título (1:1 a 1:1024).';
    END IF;
    v_item := jsonb_build_object('analito', 'VDRL', 'valor', v_texto);
  ELSE
    IF v_valor NOT IN ('reagente', 'nao_reagente') THEN RAISE EXCEPTION 'Informe reagente ou não reagente.'; END IF;
    v_texto := CASE v_valor WHEN 'reagente' THEN 'Reagente' ELSE 'Não reagente' END;
    v_item := jsonb_build_object('analito', x.nome, 'valor', v_texto);
  END IF;

  -- meio-dia em Brasília: a data não muda de dia
  v_quando := (p_data::timestamp + time '12:00') AT TIME ZONE 'America/Sao_Paulo';
  INSERT INTO public.exames_pedidos (unidade_id, paciente_id, exame, procedimento, pedido_por, pedido_em, observacao)
  VALUES (pa.unidade_id, pa.id, x.nome, x.codigo, v_eu, v_quando,
          'Exame feito fora da UBS' || CASE WHEN v_lab IS NOT NULL THEN ' (' || v_lab || ')' ELSE '' END)
  RETURNING id INTO v_exame;
  v_res := private.gravar_resultado_exame(v_exame, 'manual', 'Exame feito fora da UBS: ' || v_texto, NULL, NULL,
                                          jsonb_build_array(v_item), false, v_lab, NULL, v_eu);
  -- o resultado vale na data do exame (hiperdia e pré-natal contam pela data)
  UPDATE public.exame_resultados SET liberado_em = v_quando WHERE id = v_res;
  PERFORM private.registrar_auditoria('exame_externo', 'exames_pedidos', v_exame, pa.unidade_id,
    jsonb_build_object('exame', x.codigo, 'data', p_data));
  RETURN v_exame;
END $$;
REVOKE ALL ON FUNCTION public.registrar_exame_externo(uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_exame_externo(uuid, text, date, text, text) TO authenticated;

-- ── 3. códigos atuais nos testes do pré-natal ───────────────────────────────
CREATE OR REPLACE FUNCTION private.pre_natal_grupo_teste(p_codigo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g')
    WHEN '0214010040' THEN 'hiv' WHEN '0214010279' THEN 'hiv' WHEN '0214010058' THEN 'hiv'
    WHEN '0213010780' THEN 'hiv' WHEN '0213010500' THEN 'hiv' WHEN '0202030300' THEN 'hiv'
    WHEN '0202031500' THEN 'hiv' WHEN '0202031519' THEN 'hiv'
    WHEN '0214010074' THEN 'sifilis' WHEN '0214010082' THEN 'sifilis' WHEN '0214010252' THEN 'sifilis'
    WHEN '0202031098' THEN 'sifilis' WHEN '0202031110' THEN 'sifilis' WHEN '0202031179' THEN 'sifilis'
    WHEN '0214010104' THEN 'hepatite_b' WHEN '0214010236' THEN 'hepatite_b' WHEN '0202030784' THEN 'hepatite_b'
    WHEN '0202030970' THEN 'hepatite_b' WHEN '0213010208' THEN 'hepatite_b'
    WHEN '0202031446' THEN 'hepatite_b' WHEN '0202031454' THEN 'hepatite_b' WHEN '0214010228' THEN 'hepatite_b'
    WHEN '0214010090' THEN 'hepatite_c' WHEN '0214010309' THEN 'hepatite_c' WHEN '0202030059' THEN 'hepatite_c'
    WHEN '0202030679' THEN 'hepatite_c'
    WHEN '0202031470' THEN 'hepatite_c' WHEN '0202031489' THEN 'hepatite_c' WHEN '0214010295' THEN 'hepatite_c'
  END
$$;
