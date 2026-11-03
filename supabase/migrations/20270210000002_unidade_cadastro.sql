-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 1 (BACKLOG.md; decisões do RT em 02/11/2026, D2 e D4 = A):
-- cadastro de unidade por RPC e fim da escrita direta da identificação.
--
-- 1. admin_criar_unidade: super admin ou admin da organização, com segundo
--    fator. Nome repetido na mesma organização é recusado. Auditoria
--    'unidade_criada'.
-- 2. admin_editar_unidade: nome, tipo, ativo, município e UF. O tipo só muda
--    sem atendimento aberto e sem leito ocupado. Sem mudança, não grava nada.
--    Auditoria 'unidade_editada'.
-- 3. O authenticated deixa de inserir e de alterar direto a identificação
--    (antes o gestor mudava pela API o tipo, o nome, o ativo e até a
--    organização da própria unidade). Fica o UPDATE só das colunas que a tela
--    de Configuração grava. O CNES segue em definir_cnes_unidade.
--
-- Idempotente. Teste: supabase/tests/5a_tipo_ubs.sql
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.admin_criar_unidade(uuid, text, public.tipo_unidade, text, text, text);
--   DROP FUNCTION IF EXISTS public.admin_editar_unidade(uuid, text, public.tipo_unidade, boolean, text, text);
--   GRANT INSERT, UPDATE ON public.unidades TO authenticated;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_criar_unidade(
  p_organizacao uuid, p_nome text, p_tipo public.tipo_unidade,
  p_cnes text DEFAULT NULL, p_municipio text DEFAULT NULL, p_uf text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nome text := nullif(btrim(p_nome), '');
  v_cnes text := private.so_digitos(p_cnes);
  v_uf text := upper(nullif(btrim(p_uf), ''));
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_organizacao IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = p_organizacao) THEN
    RAISE EXCEPTION 'Organização não encontrada.';
  END IF;
  IF NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(p_organizacao)) THEN
    RAISE EXCEPTION 'Quem cadastra unidade é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o nome da unidade.'; END IF;
  IF p_tipo IS NULL THEN RAISE EXCEPTION 'Informe o tipo da unidade.'; END IF;
  IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF com 2 letras.'; END IF;
  IF v_cnes IS NOT NULL THEN
    IF length(v_cnes) <> 7 THEN RAISE EXCEPTION 'CNES com 7 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM public.unidades WHERE cnes = v_cnes) THEN
      RAISE EXCEPTION 'Este CNES já está em outra unidade.';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.unidades
              WHERE organizacao_id = p_organizacao AND lower(btrim(nome)) = lower(v_nome)) THEN
    RAISE EXCEPTION 'Já existe uma unidade com este nome na organização.';
  END IF;

  INSERT INTO public.unidades (organizacao_id, nome, tipo, cnes, municipio, uf)
  VALUES (p_organizacao, v_nome, p_tipo, v_cnes, nullif(btrim(p_municipio), ''), v_uf)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('unidade_criada', 'unidades', v_id, v_id,
    jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativo', true));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_criar_unidade(uuid, text, public.tipo_unidade, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_criar_unidade(uuid, text, public.tipo_unidade, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_editar_unidade(
  p_unidade uuid, p_nome text, p_tipo public.tipo_unidade, p_ativo boolean,
  p_municipio text DEFAULT NULL, p_uf text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades;
  v_nome text := nullif(btrim(p_nome), '');
  v_municipio text := nullif(btrim(p_municipio), '');
  v_uf text := upper(nullif(btrim(p_uf), ''));
  v_campos jsonb := '{}'::jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND OR NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(u.organizacao_id)) THEN
    RAISE EXCEPTION 'Quem altera a unidade é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o nome da unidade.'; END IF;
  IF p_tipo IS NULL OR p_ativo IS NULL THEN RAISE EXCEPTION 'Informe o tipo e a situação da unidade.'; END IF;
  IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'UF com 2 letras.'; END IF;

  IF v_nome IS DISTINCT FROM u.nome THEN
    IF EXISTS (SELECT 1 FROM public.unidades
                WHERE organizacao_id = u.organizacao_id AND id <> u.id AND lower(btrim(nome)) = lower(v_nome)) THEN
      RAISE EXCEPTION 'Já existe uma unidade com este nome na organização.';
    END IF;
    v_campos := v_campos || jsonb_build_object('nome', true);
  END IF;
  IF p_tipo IS DISTINCT FROM u.tipo THEN
    -- o menu e as telas mudam com o tipo: não troca com paciente dentro
    IF EXISTS (SELECT 1 FROM public.episodios e WHERE e.unidade_id = u.id AND e.encerrado_em IS NULL)
       OR EXISTS (SELECT 1 FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
                   WHERE s.unidade_id = u.id AND l.status = 'ocupado') THEN
      RAISE EXCEPTION 'O tipo só muda sem atendimento aberto e sem leito ocupado.';
    END IF;
    v_campos := v_campos || jsonb_build_object('tipo', true);
  END IF;
  IF p_ativo IS DISTINCT FROM u.ativo THEN v_campos := v_campos || jsonb_build_object('ativo', true); END IF;
  IF v_municipio IS DISTINCT FROM u.municipio THEN v_campos := v_campos || jsonb_build_object('municipio', true); END IF;
  IF v_uf IS DISTINCT FROM u.uf THEN v_campos := v_campos || jsonb_build_object('uf', true); END IF;

  IF v_campos = '{}'::jsonb THEN RETURN; END IF;
  UPDATE public.unidades
     SET nome = v_nome, tipo = p_tipo, ativo = p_ativo, municipio = v_municipio, uf = v_uf, updated_at = now()
   WHERE id = u.id;
  PERFORM private.registrar_auditoria('unidade_editada', 'unidades', u.id, u.id,
    jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'anterior', u.tipo, 'ativo', p_ativo, 'campos', v_campos));
END $$;
REVOKE ALL ON FUNCTION public.admin_editar_unidade(uuid, text, public.tipo_unidade, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_editar_unidade(uuid, text, public.tipo_unidade, boolean, text, text) TO authenticated;

-- D4: sem escrita direta da identificação; a Configuração grava só estas colunas
REVOKE INSERT, UPDATE ON public.unidades FROM authenticated;
GRANT UPDATE (canal_comunicacao, whatsapp_numero, latitude, longitude, raio_metros, updated_at)
  ON public.unidades TO authenticated;
