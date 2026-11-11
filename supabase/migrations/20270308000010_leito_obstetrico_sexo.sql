-- ════════════════════════════════════════════════════════════════════════════
-- Achado da conferência das telas de 08/11/2026: a lista de leitos do aceite
-- oferecia a Obstetrícia para paciente do sexo masculino. Decisão do RT em
-- 08/11/2026: A, a regulação não oferece leito de setor incompatível com o
-- sexo do paciente.
--
-- O setor já diz que é obstétrico pelo tipo de leito da regulação
-- (setores.regulacao_tipo_leito = 'obstetrico'). Sem coluna nova: leito de
-- setor obstétrico é só para paciente do sexo feminino. Paciente sem sexo
-- registrado não é barrado.
--   • private.leito_serve_ao_paciente(p_leito, p_paciente): a regra, num só lugar;
--   • regulacao_leitos_destino não lista o leito incompatível;
--   • regulacao_destino_aceitar e private.regulacao_internar_chegada recusam
--     com "Leito obstétrico é só para paciente do sexo feminino.".
-- Na produção nenhum setor tem tipo de leito marcado (08/11/2026): a regra
-- vale quando a Obstetrícia for marcada como "obstétrico".
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: tirar os trechos marcados "leito por sexo" das três funções e
-- DROP FUNCTION private.leito_serve_ao_paciente(uuid, uuid);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.leito_serve_ao_paciente(p_leito uuid, p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.leitos l
      JOIN public.setores st ON st.id = l.setor_id
      JOIN public.pacientes pa ON pa.id = p_paciente
     WHERE l.id = p_leito AND st.regulacao_tipo_leito = 'obstetrico' AND pa.sexo = 'M')
$$;
REVOKE ALL ON FUNCTION private.leito_serve_ao_paciente(uuid, uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION private.leito_serve_ao_paciente(uuid, uuid) IS
  'Leito por sexo (RT, 08/11/2026): leito de setor obstétrico só para paciente do sexo feminino; sem sexo registrado, não barra.';

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

SELECT pg_temp.trocar_uma_vez('public.regulacao_leitos_destino(uuid)'::regprocedure,
  $old$       AND st.tipo IN ('internacao', 'uti', 'isolamento')$old$,
  $new$       AND st.tipo IN ('internacao', 'uti', 'isolamento')
       AND private.leito_serve_ao_paciente(l.id, s.paciente_id) /* leito por sexo */$new$);

SELECT pg_temp.trocar_uma_vez('public.regulacao_destino_aceitar(uuid, uuid, text)'::regprocedure,
  $old$    IF v_ident IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;$old$,
  $new$    IF v_ident IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;
    -- leito por sexo
    IF NOT private.leito_serve_ao_paciente(p_leito, s.paciente_id) THEN
      RAISE EXCEPTION 'Leito obstétrico é só para paciente do sexo feminino.';
    END IF;$new$);

SELECT pg_temp.trocar_uma_vez('private.regulacao_internar_chegada(public.regulacao_solicitacoes, uuid, uuid)'::regprocedure,
  $old$  IF v_setor IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;$old$,
  $new$  IF v_setor IS NULL THEN RAISE EXCEPTION 'Escolha um leito de internação, UTI ou isolamento desta unidade.'; END IF;
  -- leito por sexo
  IF NOT private.leito_serve_ao_paciente(p_leito, s.paciente_id) THEN
    RAISE EXCEPTION 'Leito obstétrico é só para paciente do sexo feminino.';
  END IF;$new$);
