-- ════════════════════════════════════════════════════════════════════════════
-- Achado B P2-2 do teste da rede (B01, passos B01.13.parecer e
-- B01.13.reavaliar_ps): o médico da porta que abriu a observação a encerrava
-- (#482), mas não pedia parecer nem marcava reavaliação. Decisão do RT em
-- 07/11/2026: A (docs/teste-rede/README.md, "Decisões do RT e fila").
--
-- Enquanto a observação estiver aberta, quem a abriu também pede parecer e
-- marca reavaliação. "Quem abriu" é a mesma regra do encerramento,
-- private.abriu_a_observacao(i) (20270305000001): autor do desfecho
-- "observação" do episódio da porta, plantonista na unidade, de plantão agora
-- na mesma unidade e com o paciente de fato na observação. O médico escalado
-- na observação continua podendo tudo. O autor continua sem registrar o
-- atendimento da observação, evoluir ou prescrever pela escala da
-- observação (essas regras não mudam). Autor = login nos dois registros.
--
-- A tela do parecer lista os pareceres do paciente: public.pareceres_do_paciente
-- passa a aceitar o autor nas mesmas condições (só enquanto a observação está
-- aberta; quem pediu continua lendo o próprio pedido até 24 h depois, regra
-- de antes).
--
-- Troca de texto reaplicável em public.observacao_reavaliar,
-- public.solicitar_parecer e public.pareceres_do_paciente; se o trecho não
-- for achado, para.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   DO $$
--   DECLARE d text;
--   BEGIN
--     d := replace(pg_get_functiondef('public.observacao_reavaliar(uuid, timestamptz)'::regprocedure), E'\r', '');
--     EXECUTE replace(d, E'  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;\n  -- Q1 (quem abriu a observação): o autor marca a reavaliação enquanto ela está aberta\n  IF NOT FOUND OR NOT private.abriu_a_observacao(i) THEN\n    i := private.observacao_para_mim(p_internacao, true);\n  END IF;',
--                        '  i := private.observacao_para_mim(p_internacao, true);');
--     d := replace(pg_get_functiondef('public.solicitar_parecer(uuid, text, text, text, text, uuid, uuid)'::regprocedure), E'\r', '');
--     EXECUTE replace(d, E'     OR (private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE\n         -- Q1 (quem abriu a observação): o autor pede parecer enquanto ela está aberta\n         AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i))) THEN',
--                        '     OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN');
--     d := replace(pg_get_functiondef('public.pareceres_do_paciente(uuid)'::regprocedure), E'\r', '');
--     EXECUTE replace(d, E'    -- Q1 (quem abriu a observação): o autor lê os pareceres enquanto ela está aberta\n    OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i))\n', '');
--   END $$;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  -- sem \r: o corpo gravado e este arquivo podem ter fim de linha do Windows
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

SELECT pg_temp.trocar_uma_vez('public.observacao_reavaliar(uuid, timestamptz)'::regprocedure,
  $old$  i := private.observacao_para_mim(p_internacao, true);$old$,
  $new$  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  -- Q1 (quem abriu a observação): o autor marca a reavaliação enquanto ela está aberta
  IF NOT FOUND OR NOT private.abriu_a_observacao(i) THEN
    i := private.observacao_para_mim(p_internacao, true);
  END IF;$new$);

-- a tela do parecer lista os pareceres do paciente antes do pedido: o autor
-- lê a lista enquanto a observação está aberta (como quem atua no paciente)
SELECT pg_temp.trocar_uma_vez('public.pareceres_do_paciente(uuid)'::regprocedure,
  $old$       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    OR private.papel_na_unidade(v_unidade) = 'gestor'$old$,
  $new$       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    -- Q1 (quem abriu a observação): o autor lê os pareceres enquanto ela está aberta
    OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i))
    OR private.papel_na_unidade(v_unidade) = 'gestor'$new$);

SELECT pg_temp.trocar_uma_vez('public.solicitar_parecer(uuid, text, text, text, text, uuid, uuid)'::regprocedure,
  $old$     OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN$old$,
  $new$     OR (private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE
         -- Q1 (quem abriu a observação): o autor pede parecer enquanto ela está aberta
         AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i))) THEN$new$);
