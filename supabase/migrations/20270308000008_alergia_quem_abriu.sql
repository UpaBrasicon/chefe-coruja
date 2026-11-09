-- ════════════════════════════════════════════════════════════════════════════
-- Decisão do RT em 08/11/2026: quem abriu a observação também registra alergia
-- enquanto ela está aberta, como no item 4 (20270307000005: parecer e
-- reavaliação). Achado na conferência do item 16: registrar_alergia voltava
-- "Acesso negado" para o médico da porta que abriu a observação, porque a
-- regra era só a escala do setor onde o paciente está (pode_atuar_no_paciente).
--
-- "Quem abriu" é a mesma regra de sempre, private.abriu_a_observacao(i)
-- (20270305000001): autor do desfecho "observação" do episódio da porta,
-- plantonista na unidade, de plantão agora na mesma unidade e com o paciente
-- de fato na observação. Autor = login.
--   • registrar_alergia aceita o autor;
--   • alergias_do_paciente aceita o autor (a tela de alergias lê antes de
--     registrar).
-- Inativar, "nega alergias" e "desconhece" não mudam.
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: tirar das duas funções o trecho marcado "quem abriu a observação"
-- (voltam ao texto de antes, citado em cada troca abaixo).
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

SELECT pg_temp.trocar_uma_vez('public.registrar_alergia(uuid, text, text, text, text, uuid)'::regprocedure,
  $old$  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;$old$,
  $new$  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE
     -- quem abriu a observação registra alergia enquanto ela está aberta (RT, 08/11/2026)
     AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;$new$);

SELECT pg_temp.trocar_uma_vez('public.alergias_do_paciente(uuid)'::regprocedure,
  $old$          OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)) THEN$old$,
  $new$          OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)
          -- quem abriu a observação lê as alergias enquanto ela está aberta (RT, 08/11/2026)
          OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND private.abriu_a_observacao(i))) THEN$new$);
