-- Decisão do RT de 25/11/2026 sobre o teste de fluxo B (achado B-09): na
-- planilha de exames, só o médico e o NIR lançam valores. O enfermeiro sai
-- (entrava pela regra geral de quem registra resultado). O médico lança com o
-- paciente num setor do seu plantão; o NIR, com escala ativa na unidade.
-- O NIR também passa a ler a planilha (resultados_da_internacao já devolve só
-- o que quem chama pode ver; confere-se abaixo o acesso do NIR de plantão).
-- Só funções; idempotente.

CREATE OR REPLACE FUNCTION private.pode_lancar_planilha(e public.exames_pedidos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT (coalesce(private.tenho_papel(e.unidade_id, 'plantonista'), false) AND coalesce(private.paciente_em_cuidado_no_plantao(e.paciente_id), false))
      OR (coalesce(private.sou_nir(e.unidade_id), false) AND coalesce(private.na_escala_agora(e.unidade_id), false))
$$;
REVOKE ALL ON FUNCTION private.pode_lancar_planilha(public.exames_pedidos) FROM PUBLIC, anon;

-- a tela pergunta antes de mostrar "Lançar resultado"
CREATE OR REPLACE FUNCTION public.posso_lancar_planilha(p_internacao uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((
    SELECT (coalesce(private.tenho_papel(i.unidade_id, 'plantonista'), false) AND coalesce(private.paciente_em_cuidado_no_plantao(i.paciente_id), false))
        OR (coalesce(private.sou_nir(i.unidade_id), false) AND coalesce(private.na_escala_agora(i.unidade_id), false))
      FROM public.internacoes i WHERE i.id = p_internacao), false)
$$;
REVOKE ALL ON FUNCTION public.posso_lancar_planilha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posso_lancar_planilha(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

SELECT pg_temp.trocar('public.registrar_resultado_estruturado(uuid, timestamptz, jsonb, text)'::regprocedure,
  E'  IF e.id IS NULL OR NOT private.pode_registrar_exame(e) THEN\n'
  || E'    RAISE EXCEPTION ''Acesso negado: paciente fora do seu plantão.'' USING ERRCODE = ''insufficient_privilege'';',
  E'  -- B-09 (RT, 25/11/2026): só o médico com o paciente no plantão e o NIR de plantão\n'
  || E'  IF e.id IS NULL OR NOT private.pode_lancar_planilha(e) THEN\n'
  || E'    RAISE EXCEPTION ''Lançam valores na planilha o médico com o paciente no plantão e o NIR de plantão na unidade.'' USING ERRCODE = ''insufficient_privilege'';');

-- o NIR de plantão lê os exames da unidade (planilha, detalhe e laudo): sem isso
-- ele lançaria sem ver o que já existe
SELECT pg_temp.trocar('private.pode_ver_exame(public.exames_pedidos)'::regprocedure,
  E'private.sou_enfermagem(e.unidade_id)))',
  E'private.sou_enfermagem(e.unidade_id)))\n'
  || E'      -- B-09 (RT, 25/11/2026): o NIR de plantão na unidade lê os exames para lançar na planilha\n'
  || E'      OR (private.sou_nir(e.unidade_id) AND private.na_escala_agora(e.unidade_id))');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- A troca inversa em private.pode_ver_exame (tirar a linha do NIR) e em
-- public.registrar_resultado_estruturado (voltar a
-- private.pode_registrar_exame e à mensagem antiga). Depois:
--   DROP FUNCTION IF EXISTS public.posso_lancar_planilha(uuid);
--   DROP FUNCTION IF EXISTS private.pode_lancar_planilha(public.exames_pedidos);
