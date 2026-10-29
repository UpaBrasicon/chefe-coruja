-- Aba Escala para todos os papéis, entrega E4 (decisões do RT em 27 e 28/10/2026:
-- respostas 4 e 5; opção A). Os papéis da E3 pedem troca, passagem e falta, e se
-- candidatam a vaga, sempre dentro da própria categoria.
--
-- Troca, passagem e falta já funcionam pelas RPCs e tabelas de hoje
-- (solicitar_troca, passar_plantao, solicitacoes_escala), com a trava de categoria
-- da E1. Esta migration acrescenta:
--   * colegas_da_categoria: para quem passar o plantão (só nome e categoria, da
--     unidade, nas categorias de quem chama);
--   * candidatar_vaga: aceita quem tem o papel da vaga (vaga sem categoria segue
--     só do plantonista, como antes);
--   * aprovar_candidatura: o plantão criado leva a categoria da vaga, e "já
--     preenchido" passa a ser por alguém da mesma categoria.
--
-- Rollback: DROP FUNCTION IF EXISTS public.colegas_da_categoria(uuid);
--   e reaplicar candidatar_vaga (20261012000001_limites_unidade_chamados_fracionar.sql)
--   e aprovar_candidatura (20261022000005_fix_revisao_segundo_fator_documentos.sql).

-- ── Colegas da minha categoria (destino da passagem) ───────────────────────
CREATE OR REPLACE FUNCTION public.colegas_da_categoria(p_unidade uuid)
RETURNS TABLE (perfil_id uuid, nome_completo text, papel public.papel)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_eu uuid := private.meu_perfil_id();
BEGIN
  IF v_eu IS NULL OR NOT EXISTS (SELECT 1 FROM public.vinculos v
                                  WHERE v.perfil_id = v_eu AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com esta unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, c.papel
    FROM public.vinculos c
    JOIN public.perfis p ON p.id = c.perfil_id AND p.ativo
   WHERE c.unidade_id = p_unidade AND c.ativo AND c.perfil_id <> v_eu
     AND c.papel IN (SELECT m.papel FROM public.vinculos m
                      WHERE m.perfil_id = v_eu AND m.unidade_id = p_unidade AND m.ativo
                        AND m.papel NOT IN ('admin', 'gestor'))
   ORDER BY c.papel, p.nome_completo;
END;
$function$;
REVOKE ALL ON FUNCTION public.colegas_da_categoria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.colegas_da_categoria(uuid) TO authenticated;

-- ── Candidatura: quem tem o papel da vaga ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.candidatar_vaga(p_vaga uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.escala_vagas%ROWTYPE;
  v_perfil uuid := private.meu_perfil_id();
  v_ini timestamptz;
  v_fim timestamptz;
  v_id uuid;
BEGIN
  SELECT * INTO v FROM public.escala_vagas WHERE id = p_vaga;
  IF v.id IS NULL OR private.membro_da_unidade(v.unidade_id) IS NOT TRUE THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
  -- E4: a vaga é da categoria dela; sem categoria (antiga), do plantonista
  IF NOT EXISTS (SELECT 1 FROM public.vinculos vi
                  WHERE vi.perfil_id = v_perfil AND vi.unidade_id = v.unidade_id AND vi.ativo
                    AND vi.papel = coalesce(v.papel, 'plantonista')) THEN
    RAISE EXCEPTION 'Esta vaga é de %: só quem tem esse papel na unidade se candidata.',
      replace(coalesce(v.papel, 'plantonista')::text, '_', ' ');
  END IF;
  IF v.fechada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta vaga já foi preenchida ou retirada.'; END IF;
  v_ini := coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno));
  v_fim := v_ini + make_interval(mins => coalesce(v.duracao_min, private.duracao_padrao(v.turno)));
  IF v_fim <= now() THEN RAISE EXCEPTION 'Esta vaga já passou.'; END IF;
  IF v.plantao_origem_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.id = v.plantao_origem_id AND e.perfil_id = v_perfil) THEN
    RAISE EXCEPTION 'Esta parte é do seu próprio plantão.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.escala_plantao e
              WHERE e.perfil_id = v_perfil AND e.ativo
                AND e.inicio < v_fim AND e.inicio + make_interval(mins => e.duracao_min) > v_ini) THEN
    RAISE EXCEPTION 'Você já tem plantão nesse horário.';
  END IF;
  SELECT c.id INTO v_id FROM public.candidaturas_escala c WHERE c.vaga_id = v.id AND c.perfil_id = v_perfil;
  IF v_id IS NOT NULL THEN RAISE EXCEPTION 'Você já se candidatou a esta vaga.'; END IF;
  INSERT INTO public.candidaturas_escala (unidade_id, setor_id, data, turno, perfil_id, status, criado_por, vaga_id)
  VALUES (v.unidade_id, v.setor_id, v.data, v.turno, v_perfil, 'pendente', v_perfil, v.id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- ── Aprovar candidatura: o plantão leva a categoria da vaga ────────────────
CREATE OR REPLACE FUNCTION public.aprovar_candidatura(p_candidatura uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_candidatura public.candidaturas_escala%ROWTYPE;
  v_vaga public.escala_vagas%ROWTYPE;
  v_orig public.escala_plantao%ROWTYPE;
  v_plantao uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- revisão 02/10/2026: leitura/escrita sem 2º fator
  SELECT * INTO v_candidatura
  FROM public.candidaturas_escala
  WHERE id = p_candidatura
  FOR UPDATE;

  IF v_candidatura.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF (private.eh_super_admin() OR private.papel_na_unidade(v_candidatura.unidade_id) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor da unidade aprova candidaturas.';
  END IF;
  IF v_candidatura.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Ninguém aprova a própria candidatura.';
  END IF;
  IF v_candidatura.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta candidatura já foi decidida.';
  END IF;

  IF v_candidatura.vaga_id IS NOT NULL THEN
    SELECT * INTO v_vaga FROM public.escala_vagas WHERE id = v_candidatura.vaga_id FOR UPDATE;
    IF v_vaga.fechada_em IS NOT NULL THEN
      RAISE EXCEPTION 'Esta vaga já foi preenchida ou retirada.';
    END IF;
  END IF;

  IF v_vaga.plantao_origem_id IS NOT NULL THEN
    -- parte de plantão fracionado (a categoria vem do plantão de origem, pelo gatilho da E1)
    SELECT * INTO v_orig FROM public.escala_plantao WHERE id = v_vaga.plantao_origem_id;
    IF v_orig.id IS NULL OR NOT v_orig.ativo THEN
      RAISE EXCEPTION 'O plantão desta parte não está mais na escala.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.escala_plantao e
                WHERE e.perfil_id = v_candidatura.perfil_id AND e.ativo
                  AND e.inicio < v_vaga.inicio + make_interval(mins => v_vaga.duracao_min)
                  AND e.inicio + make_interval(mins => e.duracao_min) > v_vaga.inicio) THEN
      RAISE EXCEPTION 'O candidato já tem plantão nesse horário.';
    END IF;
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min, rotulo,
                                       quinzenal, fracionado, plantao_origem_id, ativo, criado_por)
    VALUES (v_orig.unidade_id, v_orig.setor_id, v_candidatura.perfil_id, v_orig.data, v_orig.turno,
            v_vaga.inicio, v_vaga.duracao_min, 'Parte ' || v_vaga.parte || '/' || v_vaga.partes,
            false, true, v_orig.id, true, auth.uid())
    RETURNING id INTO v_plantao;
  ELSE
    -- E4: já preenchido quer dizer alguém da mesma categoria na faixa (vaga sem
    -- categoria: qualquer um, como antes)
    SELECT e.id INTO v_plantao
    FROM public.escala_plantao e
    WHERE e.setor_id = v_candidatura.setor_id
      AND e.data = v_candidatura.data
      AND e.turno = v_candidatura.turno
      AND e.ativo
      AND (v_vaga.papel IS NULL OR e.papel = v_vaga.papel)
    LIMIT 1;

    IF v_plantao IS NOT NULL THEN
      RAISE EXCEPTION 'Este plantão já foi preenchido por outro profissional da mesma categoria.';
    END IF;

    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por, papel)
    VALUES (v_candidatura.unidade_id, v_candidatura.setor_id, v_candidatura.perfil_id,
            v_candidatura.data, v_candidatura.turno, true, auth.uid(), v_vaga.papel)
    RETURNING id INTO v_plantao;
  END IF;

  UPDATE public.candidaturas_escala
  SET status = 'aprovado', decidido_por = auth.uid()
  WHERE id = p_candidatura;

  IF v_vaga.id IS NOT NULL THEN
    UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v_vaga.id;
    UPDATE public.candidaturas_escala SET status = 'recusado', decidido_por = auth.uid()
     WHERE vaga_id = v_vaga.id AND status = 'pendente' AND id <> p_candidatura;
  END IF;

  RETURN v_plantao;
END;
$function$;
