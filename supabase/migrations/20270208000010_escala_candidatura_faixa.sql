-- ════════════════════════════════════════════════════════════════════════════
-- Bug médio M8 do teste ponta a ponta da escala (docs/escala/TESTE-E2E-2026-10-29.md):
-- "Candidatar-se" da Escala geral do plantonista (faixa livre, sem vaga marcada)
-- gravava direto em candidaturas_escala. A RLS exige papel_na_unidade =
-- 'plantonista' (quem também é gestor falhava calado) e o caminho pulava as
-- conferências de candidatar_vaga: dia que já passou, conflito de horário,
-- faixa já ocupada.
--
-- Correção: RPC candidatar_faixa(setor, data, faixa), com as conferências de
-- candidatar_vaga (20270202000004) para a faixa sem vaga: vínculo ativo de
-- plantonista, dia que não passou, sem plantão meu sobreposto, faixa sem
-- plantonista escalado, sem candidatura repetida. A tela passa a usá-la.
-- Expand: a política de INSERT direto fica (a tela antiga ainda grava por ela);
-- o fechamento vem numa migration seguinte, depois do merge.
-- Sem DROP/RENAME. Idempotente.
-- Teste: supabase/tests/escala_candidatura_faixa.sql
--
-- Rollback: DROP FUNCTION IF EXISTS public.candidatar_faixa(uuid, date, text);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.candidatar_faixa(p_setor uuid, p_data date, p_turno text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_ini timestamptz;
  v_fim timestamptz;
  v_id uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL OR private.membro_da_unidade(v_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos vi
                  WHERE vi.perfil_id = v_perfil AND vi.unidade_id = v_unidade AND vi.ativo AND vi.papel = 'plantonista') THEN
    RAISE EXCEPTION 'A candidatura pela Escala geral é do plantonista. Para as outras categorias, candidate-se às vagas abertas.';
  END IF;
  IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;
  v_ini := private.inicio_do_turno(p_data, p_turno);
  v_fim := v_ini + make_interval(mins => private.duracao_padrao(p_turno));
  IF v_fim <= now() THEN RAISE EXCEPTION 'Este plantão já passou.'; END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.setor_id = p_setor AND e.ativo AND (e.papel IS NULL OR e.papel = 'plantonista')
                AND e.inicio < v_fim AND e.inicio + make_interval(mins => e.duracao_min) > v_ini) THEN
    RAISE EXCEPTION 'Esta faixa já tem plantonista escalado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.perfil_id = v_perfil AND e.ativo
                AND e.inicio < v_fim AND e.inicio + make_interval(mins => e.duracao_min) > v_ini) THEN
    RAISE EXCEPTION 'Você já tem plantão nesse horário.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidaturas_escala c
              WHERE c.setor_id = p_setor AND c.data = p_data AND c.turno = p_turno AND c.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Você já se candidatou a esta faixa.';
  END IF;
  INSERT INTO public.candidaturas_escala (unidade_id, setor_id, data, turno, perfil_id, status, criado_por)
  VALUES (v_unidade, p_setor, p_data, p_turno, v_perfil, 'pendente', v_perfil)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.candidatar_faixa(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidatar_faixa(uuid, date, text) TO authenticated;
