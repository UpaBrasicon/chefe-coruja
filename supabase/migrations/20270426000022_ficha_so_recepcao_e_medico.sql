-- Decisão do RT de 25/11/2026 sobre o teste de fluxo B (achado B-08): só a
-- recepção abre ficha e, na emergência, também o médico. Técnico de
-- enfermagem, enfermeiro, farmacêutico, NIR e os demais papéis não abrem,
-- mesmo escalados na porta. Antes, registrar_ficha conferia só a escala.
-- A regra de plantão na porta não muda. Só função; idempotente.

CREATE OR REPLACE FUNCTION pg_temp.trocar(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text;
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(p_novo IN def) > 0 THEN RETURN; END IF;  -- já trocado (idempotente)
  IF position(p_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, p_antigo; END IF;
  EXECUTE replace(def, p_antigo, p_novo);
END $$;

SELECT pg_temp.trocar('public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean)'::regprocedure,
  E'    RAISE EXCEPTION ''Acesso negado: você não está de plantão nesta porta.'';\n  END IF;',
  E'    RAISE EXCEPTION ''Acesso negado: você não está de plantão nesta porta.'';\n  END IF;\n'
  || E'  -- B-08 (RT, 25/11/2026): a ficha é da recepção; na emergência, também do médico\n'
  || E'  IF NOT (coalesce(private.tenho_papel(v_unidade, ''recepcao''), false) OR coalesce(private.tenho_papel(v_unidade, ''plantonista''), false)) THEN\n'
  || E'    RAISE EXCEPTION ''A ficha é aberta pela recepção ou, na emergência, pelo médico.'' USING ERRCODE = ''insufficient_privilege'';\n'
  || E'  END IF;');

-- ── Rollback ────────────────────────────────────────────────────────────────
-- A troca inversa: tirar de public.registrar_ficha o bloco "B-08" (as quatro
-- linhas depois da recusa de plantão).
