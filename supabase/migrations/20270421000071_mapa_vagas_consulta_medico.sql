-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 2: mapa de vagas como consulta
-- para o médico e o NIR.
--
-- regulacao_mapa_vagas recusava quem não era gestor, regulador da central ou
-- administrador geral. Agora o médico (papel plantonista) e o NIR da unidade
-- também leem, só para consulta:
--   • o mapa já não leva dado de paciente (contagem de leitos por tipo e os
--     serviços informados pelas unidades);
--   • 'editavel' continua só para o gestor da unidade; as funções de escrita
--     (regulacao_salvar_servico e as outras) não mudam;
--   • a resposta ganha 'so_consulta' (true para o médico e o NIR), que a tela
--     usa para dizer que é só consulta.
-- A unidade da Secretaria (módulo de rede) continua como estava.
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: docs/banco/ROLLBACK-20270421000070-079.sql (trocas de volta).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  $old$DECLARE v_org uuid; v_central uuid; v_rede boolean := false;$old$,
  $new$DECLARE v_org uuid; v_central uuid; v_rede boolean := false; v_consulta boolean := false;$new$);

SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  $old$          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;$old$,
  $new$          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    -- médico e NIR da unidade: só consulta, sem dado de paciente (RT, 24/11/2026)
    IF private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'nir') IS TRUE THEN
      v_consulta := true;
    ELSE
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;$new$);

SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  $old$    'agora', now());$old$,
  $new$    'agora', now(),
    'so_consulta', v_consulta);$new$);
