-- ════════════════════════════════════════════════════════════════════════════
-- Rollback das migrations 20270421000022_secretaria_perfil.sql e
-- 20270421000023_secretaria_perfil_acesso.sql (perfil Secretaria).
--
-- Quando usar: se o perfil Secretaria tiver de sair. Antes, voltar o frontend
-- para a versão sem o perfil (o app chama minhas_secretarias ao abrir e, na
-- Rede, rede_arvore_da_secretaria e as RPCs das pessoas da secretaria; sem
-- elas, a casca segue só com os vínculos e a ficha da secretaria mostra erro
-- na parte "Pessoas da secretaria").
--
-- O que se perde: quem foi designado para cada secretaria
-- (public.secretaria_pessoas). Nada de unidade, setor, leito, escala ou
-- vínculo muda: o que a secretaria gravou fica gravado. A auditoria
-- (secretaria_pessoa_designada, _aceita, _retirada) fica no log_auditoria,
-- que é só de inserção.
--
-- O valor 'gestor_secretaria' do tipo public.papel fica (o Postgres não
-- remove valor de enum sem recriar o tipo, e isso seria ALTER TYPE
-- destrutivo). Sem a tabela e sem as funções, ele não dá acesso a nada; a
-- regra vinculos_sem_perfil_secretaria sai e nenhum vínculo o usa.
--
-- Se houver dado que importe, exporte antes:
--   COPY (SELECT * FROM public.secretaria_pessoas) TO STDOUT WITH CSV HEADER;
--
-- As funções estendidas voltam ao corpo da homologação de 24/11/2026
-- (pg_get_functiondef antes da migration 023); admin_rede_arvore volta ao da
-- migration 20270421000020.
--
-- Testado na homologação (kswurfyxxvfydpjfrivy) em transação desfeita.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── funções novas ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.minhas_secretarias();
DROP FUNCTION IF EXISTS public.admin_retirar_secretaria(uuid);
DROP FUNCTION IF EXISTS public.admin_designar_secretaria(uuid, text);
DROP FUNCTION IF EXISTS public.admin_secretaria_pessoas(uuid);
DROP FUNCTION IF EXISTS private.exigir_admin_da_secretaria(uuid);
DROP FUNCTION IF EXISTS public.rede_arvore_da_secretaria();

-- ── políticas novas ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS remuneracoes_secretaria_update ON public.remuneracoes_plantao;
DROP POLICY IF EXISTS remuneracoes_secretaria_insert ON public.remuneracoes_plantao;
DROP POLICY IF EXISTS remuneracoes_secretaria_select ON public.remuneracoes_plantao;
DROP POLICY IF EXISTS leitos_secretaria_delete ON public.leitos;
DROP POLICY IF EXISTS leitos_secretaria_update ON public.leitos;
DROP POLICY IF EXISTS leitos_secretaria_insert ON public.leitos;
DROP POLICY IF EXISTS setores_secretaria_delete ON public.setores;
DROP POLICY IF EXISTS setores_secretaria_update ON public.setores;
DROP POLICY IF EXISTS setores_secretaria_insert ON public.setores;
DROP POLICY IF EXISTS unidades_secretaria_update ON public.unidades;
DROP POLICY IF EXISTS unidades_secretaria_select ON public.unidades;
DROP POLICY IF EXISTS secretarias_pessoa_select ON public.secretarias;

-- ── árvore do administrador: volta ao corpo da migration 020 ───────────────
CREATE OR REPLACE FUNCTION public.admin_rede_arvore()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_super boolean := private.eh_super_admin();
BEGIN
  IF private.meu_perfil_id() IS NULL
     OR NOT (v_super OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'A rede é do administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id,
      'nome', o.nome,
      'secretarias', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'nome', s.nome, 'esfera', s.esfera, 'municipio', s.municipio, 'uf', s.uf,
          'cnpj', s.cnpj, 'responsavel', s.responsavel, 'telefone', s.telefone, 'email', s.email,
          'endereco', s.endereco, 'ativo', s.ativo, 'atualizado_em', s.atualizado_em
        ) ORDER BY s.ativo DESC, s.nome)
        FROM public.secretarias s WHERE s.organizacao_id = o.id), '[]'::jsonb),
      'unidades', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', u.id, 'nome', u.nome, 'tipo', u.tipo, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf,
          'endereco', u.endereco, 'whatsapp', u.whatsapp_numero, 'ativo', u.ativo,
          'secretaria_id', u.secretaria_id,
          'ramo_rede', u.ramo_rede,
          'ramo', coalesce(u.ramo_rede, CASE WHEN cr.unidade_id IS NOT NULL THEN 'central_regulacao' ELSE u.tipo::text END),
          'eh_central', cr.unidade_id IS NOT NULL,
          'eh_sede_rede', rm.secretaria_unidade_id IS NOT NULL,
          'pessoas', coalesce((
            SELECT jsonb_object_agg(x.papel, x.n) FROM (
              SELECT v.papel::text AS papel, count(*) AS n FROM public.vinculos v
               WHERE v.unidade_id = u.id AND v.ativo GROUP BY v.papel) x), '{}'::jsonb),
          'gestores', coalesce((
            SELECT jsonb_agg(p.nome_completo ORDER BY p.nome_completo)
              FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
             WHERE v.unidade_id = u.id AND v.ativo AND v.papel = 'gestor'), '[]'::jsonb)
        ) ORDER BY u.nome)
        FROM public.unidades u
        LEFT JOIN public.centrais_regulacao cr ON cr.unidade_id = u.id AND cr.organizacao_id = u.organizacao_id
        LEFT JOIN public.rede_modulo rm ON rm.secretaria_unidade_id = u.id
       WHERE u.organizacao_id = o.id), '[]'::jsonb)
    ) ORDER BY o.nome)
    FROM public.organizacoes o
   WHERE o.ativo AND (v_super OR o.id IN (SELECT private.orgs_admin()))
  ), '[]'::jsonb);
END $$;
DROP FUNCTION IF EXISTS private.rede_arvore_json(uuid[], uuid[]);

-- ── funções estendidas: corpo anterior (homologação, 24/11/2026) ───────────
-- bloquear_leito(uuid,text,text)
CREATE OR REPLACE FUNCTION public.bloquear_leito(p_leito uuid, p_motivo text, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só o gestor ou o enfermeiro da unidade bloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_motivo IS NULL OR p_motivo NOT IN ('manutencao', 'isolamento', 'falta_equipe', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_motivo = 'outro' AND length(coalesce(v_obs, '')) < 5 THEN
    RAISE EXCEPTION 'Descreva o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'bloqueado' WHERE id = p_leito;   -- a trava recusa ocupado
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'bloqueio', (r.leito).status, 'bloqueado', v_perfil,
          p_motivo || coalesce(': ' || v_obs, ''));
END; $function$;

-- definir_cnes_unidade(uuid,text)
CREATE OR REPLACE FUNCTION public.definir_cnes_unidade(p_unidade uuid, p_cnes text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v text := private.so_digitos(p_cnes); v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'O CNES da unidade é preenchido pelo gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v IS NULL OR length(v) <> 7 THEN RAISE EXCEPTION 'CNES com 7 dígitos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.unidades WHERE cnes = v AND id <> p_unidade) THEN
    RAISE EXCEPTION 'Este CNES já está em outra unidade.';
  END IF;
  SELECT cnes INTO v_antes FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  UPDATE public.unidades SET cnes = v, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('cnes_unidade_definido', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', v));
  RETURN v;
END $function$;

-- definir_endereco_unidade(uuid,text)
CREATE OR REPLACE FUNCTION public.definir_endereco_unidade(p_unidade uuid, p_endereco text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Só o gestor da unidade define o endereço' USING ERRCODE = '42501';
  END IF;
  IF p_endereco IS NOT NULL AND length(btrim(p_endereco)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Endereço da unidade: de 5 a 300 caracteres';
  END IF;
  UPDATE public.unidades SET endereco = nullif(btrim(p_endereco), '') WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('definir_endereco_unidade', 'unidades', p_unidade, p_unidade, NULL);
END $function$;

-- definir_pulseira_unidade(uuid,boolean)
CREATE OR REPLACE FUNCTION public.definir_pulseira_unidade(p_unidade uuid, p_usa boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_antes boolean; v_tipo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Quem liga a pulseira da unidade é o gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_usa IS NULL THEN RAISE EXCEPTION 'Diga se a unidade usa pulseira.'; END IF;
  SELECT usa_pulseira, tipo INTO v_antes, v_tipo FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  IF p_usa AND v_tipo = 'ubs' THEN RAISE EXCEPTION 'A UBS não usa pulseira de identificação.'; END IF;
  UPDATE public.unidades SET usa_pulseira = p_usa, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('pulseira_unidade_definida', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', p_usa));
  RETURN p_usa;
END $function$;

-- desbloquear_leito(uuid,text)
CREATE OR REPLACE FUNCTION public.desbloquear_leito(p_leito uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só o gestor ou o enfermeiro da unidade desbloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'bloqueado' THEN
    RAISE EXCEPTION 'Leito % não está bloqueado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'desbloqueio', 'bloqueado', 'livre', v_perfil,
          coalesce(nullif(btrim(coalesce(p_observacao, '')), ''), 'Desbloqueio'));
END; $function$;

-- escala_mes_gestor(uuid,integer,integer)
CREATE OR REPLACE FUNCTION public.escala_mes_gestor(p_unidade uuid, p_ano integer, p_mes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_pub public.escala_publicacoes;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: escala do gestor da unidade.';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  SELECT * INTO v_pub FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini ORDER BY versao DESC LIMIT 1;
  RETURN jsonb_build_object(
    'setores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'tipo', s.tipo) ORDER BY s.ordem, s.nome)
                           FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo), '[]'::jsonb),
    -- categorias que a unidade escala (filtro da tela)
    'categorias', coalesce((SELECT jsonb_agg(c.papel ORDER BY c.papel)
                              FROM (SELECT DISTINCT v.papel FROM public.vinculos v
                                     WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')) c), '[]'::jsonb),
    'faixas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'data', f.data, 'setor_id', f.setor_id, 'turno', f.turno, 'escalados', f.escalados,
                                 'previsto', f.previsto, 'vaga_id', f.vaga_id, 'vaga_obs', f.vaga_obs,
                                 'vagas', f.vagas, 'abertas', f.abertas,
                                 'situacao', CASE WHEN jsonb_array_length(f.abertas) > 0 THEN 'vaga'
                                                  WHEN jsonb_array_length(f.escalados) > 0 THEN 'coberto'
                                                  ELSE 'sem_plantao' END)
                               ORDER BY f.data, f.setor_id, f.turno)
                          FROM private.escala_faixas(p_unidade, v_ini, v_fim) f), '[]'::jsonb),
    'publicacao', CASE WHEN v_pub.id IS NULL THEN NULL ELSE jsonb_build_object(
       'versao', v_pub.versao, 'publicada_em', v_pub.publicada_em, 'plantoes', v_pub.plantoes, 'vagas', v_pub.vagas,
       'publicada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = v_pub.publicada_por),
       'alteracoes_depois', (SELECT count(*) FROM public.historico_escala h
                              WHERE h.unidade_id = p_unidade AND h.created_at > v_pub.publicada_em
                                AND h.acao IN ('criar', 'alterar', 'remover')
                                AND coalesce(h.dados -> 'depois' ->> 'data', h.dados -> 'antes' ->> 'data')::date BETWEEN v_ini AND v_fim)) END);
END
$function$;

-- marcar_vaga_escala(uuid,date,text,text,papel)
CREATE OR REPLACE FUNCTION public.marcar_vaga_escala(p_setor uuid, p_data date, p_turno text, p_observacao text DEFAULT NULL::text, p_papel papel DEFAULT NULL::papel)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_setor_nome text;
  v_id uuid;
  v_perfil uuid;
  v_cat text := replace(coalesce(p_papel::text, 'plantonista'), '_', ' ');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, nome INTO v_unidade, v_setor_nome FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade marca vaga na escala.'; END IF;
  IF private.turno_valido(v_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;
  IF p_data < private.data_atual() THEN RAISE EXCEPTION 'Não se marca vaga em dia que já passou.'; END IF;
  IF p_papel IN ('admin', 'gestor') THEN RAISE EXCEPTION 'Gestor e administrador não são categoria de plantão.'; END IF;
  -- já tem alguém da categoria na faixa (sem categoria: alguém de qualquer uma)
  IF EXISTS (SELECT 1 FROM private.escala_faixas(v_unidade, p_data, p_data) f, jsonb_array_elements(f.escalados) es
              WHERE f.setor_id = p_setor AND f.turno = p_turno
                AND (p_papel IS NULL OR es ->> 'papel' = p_papel::text)) THEN
    RAISE EXCEPTION 'Esta faixa já tem % escalado.', CASE WHEN p_papel IS NULL THEN 'alguém' ELSE v_cat END;
  END IF;
  SELECT id INTO v_id FROM public.escala_vagas
   WHERE setor_id = p_setor AND data = p_data AND turno = p_turno AND fechada_em IS NULL
     AND plantao_origem_id IS NULL AND papel IS NOT DISTINCT FROM p_papel;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- já marcada: não duplica
  INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por, papel)
  VALUES (v_unidade, p_setor, p_data, p_turno, nullif(btrim(p_observacao), ''), private.meu_perfil_id(), p_papel)
  RETURNING id INTO v_id;
  -- avisa quem tem o papel da vaga (a candidatura continua pela escala)
  FOR v_perfil IN SELECT DISTINCT v.perfil_id FROM public.vinculos v
                   WHERE v.unidade_id = v_unidade AND v.papel = coalesce(p_papel, 'plantonista') AND v.ativo LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, v_unidade, p_data, 'vaga_' || v_id,
            'Vaga aberta em ' || v_setor_nome || ' em ' || to_char(p_data, 'DD/MM') || ' ('
              || private.nome_do_turno(p_turno) || '). Candidate-se pela escala.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v_unidade, private.meu_perfil_id(), 'marcar_vaga',
          v_setor_nome || ' · ' || to_char(p_data, 'DD/MM') || ' · ' || private.turno_no_texto(p_turno) || CASE WHEN p_papel IS NULL THEN '' ELSE ' · ' || v_cat END,
          jsonb_build_object('vaga_id', v_id, 'setor_id', p_setor, 'data', p_data, 'turno', p_turno, 'papel', p_papel));
  RETURN v_id;
END
$function$;

-- private.membro_da_unidade(uuid)
CREATE OR REPLACE FUNCTION private.membro_da_unidade(p_unidade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(
       private.eh_super_admin()
    OR p_unidade IN (SELECT private.unidades_do_usuario())
    OR EXISTS (SELECT 1 FROM public.unidades u
               WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false);
$function$;

-- private.pode_gerir_convites(uuid)
CREATE OR REPLACE FUNCTION private.pode_gerir_convites(p_unidade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.eh_super_admin()
      OR EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = auth.uid() AND v.unidade_id = p_unidade
                    AND v.ativo AND v.papel = 'gestor')
      OR EXISTS (SELECT 1 FROM public.unidades u
                  WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id));
$function$;

-- profissionais_da_unidade(uuid)
CREATE OR REPLACE FUNCTION public.profissionais_da_unidade(p_unidade uuid)
 RETURNS TABLE(perfil_id uuid, nome_completo text, crm text, papel papel)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade monta a escala.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.crm, v.papel
    FROM public.vinculos v
    JOIN public.perfis p ON p.id = v.perfil_id AND p.ativo
   WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')
   ORDER BY v.papel, p.nome_completo;
END;
$function$;

-- publicar_escala(uuid,integer,integer,text)
CREATE OR REPLACE FUNCTION public.publicar_escala(p_unidade uuid, p_ano integer, p_mes integer, p_observacao text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_versao int;
  v_plantoes int;
  v_vagas int;
  v_perfil uuid;
  v_rotulo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade publica a escala.'; END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  IF v_fim < private.data_atual() THEN RAISE EXCEPTION 'Este mês já terminou: a escala dele não se publica mais.'; END IF;
  SELECT count(*) INTO v_plantoes FROM public.escala_plantao
   WHERE unidade_id = p_unidade AND ativo AND data BETWEEN v_ini AND v_fim;
  IF v_plantoes = 0 THEN RAISE EXCEPTION 'Não há plantão neste mês para publicar.'; END IF;
  SELECT coalesce(sum(jsonb_array_length(f.abertas)), 0) INTO v_vagas FROM private.escala_faixas(p_unidade, v_ini, v_fim) f;
  SELECT coalesce(max(versao), 0) + 1 INTO v_versao FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini;
  INSERT INTO public.escala_publicacoes (unidade_id, competencia, versao, plantoes, vagas, observacao, publicada_por)
  VALUES (p_unidade, v_ini, v_versao, v_plantoes, v_vagas, nullif(btrim(p_observacao), ''), private.meu_perfil_id());
  v_rotulo := to_char(v_ini, 'MM/YYYY');
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (p_unidade, private.meu_perfil_id(), 'publicar',
          'Escala de ' || v_rotulo || ' publicada (versão ' || v_versao || ', ' || v_plantoes || ' plantões, ' || v_vagas || ' vagas abertas)',
          jsonb_build_object('competencia', v_ini, 'versao', v_versao, 'plantoes', v_plantoes, 'vagas', v_vagas));
  FOR v_perfil IN SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                   WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_ini AND v_fim LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, p_unidade, v_ini, 'escala_publicada_' || to_char(v_ini, 'YYYY_MM') || '_v' || v_versao,
            'A escala de ' || v_rotulo || ' foi publicada' || CASE WHEN v_versao > 1 THEN ' (versão ' || v_versao || ')' ELSE '' END
              || '. Confira seus plantões na agenda.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  PERFORM private.registrar_auditoria('publicar_escala', 'escala_publicacoes', NULL, p_unidade,
    jsonb_build_object('quantidade', v_plantoes, 'status', 'versao ' || v_versao));
  RETURN v_versao;
END
$function$;

-- retirar_vaga_escala(uuid)
CREATE OR REPLACE FUNCTION public.retirar_vaga_escala(p_vaga uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.escala_vagas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.escala_vagas WHERE id = p_vaga FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v.unidade_id) THEN RAISE EXCEPTION 'Só o gestor da unidade retira vaga da escala.'; END IF;
  IF v.fechada_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v.id;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v.unidade_id, private.meu_perfil_id(), 'retirar_vaga',
          (SELECT nome FROM public.setores WHERE id = v.setor_id) || ' · ' || to_char(v.data, 'DD/MM') || ' · ' || v.turno,
          jsonb_build_object('vaga_id', v.id, 'setor_id', v.setor_id, 'data', v.data, 'turno', v.turno));
END $function$;

-- salvar_alvo_triagem(uuid,integer)
CREATE OR REPLACE FUNCTION public.salvar_alvo_triagem(p_unidade uuid, p_minutos integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o alvo da triagem é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_minutos IS NULL OR p_minutos NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Alvo da chegada à triagem entre 1 e 240 minutos.';
  END IF;
  INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
  VALUES (p_unidade, 'alvo_triagem_min', p_minutos::text, 'Tempo-alvo da chegada à triagem (classificação), em minutos')
  ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
  WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  PERFORM private.registrar_auditoria('salvar_alvo_triagem', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvo_triagem_min', p_minutos));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_alvos_grade(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.salvar_alvos_grade(p_unidade uuid, p_alvos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  k text;
  v int;
  v_desc jsonb := '{"exame": "Alvo da grade de ações: do pedido de exame ao resultado, em minutos",
                    "medicacao": "Alvo da grade de ações: da prescrição à checagem da medicação, em minutos",
                    "permanencia": "Alvo da grade de ações: tempo total no PS depois do médico, em minutos"}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os alvos são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_alvos IS NULL OR jsonb_typeof(p_alvos) <> 'object' THEN
    RAISE EXCEPTION 'Informe os alvos da grade.';
  END IF;
  FOREACH k IN ARRAY ARRAY['exame', 'medicacao', 'permanencia'] LOOP
    IF NOT (p_alvos ? k) OR jsonb_typeof(p_alvos -> k) = 'null' THEN
      DELETE FROM public.configuracoes_unidade WHERE unidade_id = p_unidade AND chave = 'alvo_' || k || '_min';
      CONTINUE;
    END IF;
    IF jsonb_typeof(p_alvos -> k) <> 'number' THEN RAISE EXCEPTION 'Alvo de % deve ser um número de minutos.', k; END IF;
    v := (p_alvos ->> k)::numeric::int;
    IF v NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Alvo de % entre 1 e 1440 minutos.', k; END IF;
    INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
    VALUES (p_unidade, 'alvo_' || k || '_min', v::text, v_desc ->> k)
    ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
    WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_alvos_grade', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvos', private.limites_unidade(p_unidade) -> 'alvos_grade'));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_alvos_medico(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.salvar_alvos_medico(p_unidade uuid, p_alvos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_proto jsonb;
  c text;
  v int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os alvos são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT coalesce((SELECT p.tempos FROM public.unidades u JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
                    WHERE u.id = p_unidade), '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}'::jsonb)
    INTO v_proto;
  FOREACH c IN ARRAY ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] LOOP
    IF p_alvos IS NULL OR NOT (p_alvos ? c) OR jsonb_typeof(p_alvos -> c) <> 'number' THEN
      RAISE EXCEPTION 'Informe o alvo da cor %.', c;
    END IF;
    v := (p_alvos ->> c)::numeric::int;
    IF v NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Alvo da cor % entre 0 e 1440 minutos.', c; END IF;
    IF v = coalesce((v_proto ->> c)::int, -1) THEN
      DELETE FROM public.configuracoes_unidade WHERE unidade_id = p_unidade AND chave = 'alvo_medico_' || c;
    ELSE
      INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
      VALUES (p_unidade, 'alvo_medico_' || c, v::text, 'Tempo-alvo da classificação ao médico, cor ' || c || ', em minutos')
      ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
      WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
    END IF;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_alvos_medico', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvos', private.tempos_alvo_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_limites_unidade(uuid,boolean,integer,integer,integer,integer)
CREATE OR REPLACE FUNCTION public.salvar_limites_unidade(p_unidade uuid, p_descanso_ativo boolean, p_descanso_horas integer, p_sobrecarga_horas integer, p_ocupacao_pct integer, p_checkin_tolerancia_min integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  k text;
  v text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os limites são do gestor da unidade.';
  END IF;
  IF p_descanso_ativo IS NULL THEN RAISE EXCEPTION 'Diga se a unidade exige descanso mínimo.'; END IF;
  IF p_descanso_horas IS NULL OR p_descanso_horas NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Descanso mínimo entre 1 e 24 horas.';
  END IF;
  IF p_sobrecarga_horas IS NULL OR p_sobrecarga_horas NOT BETWEEN 12 AND 168 THEN
    RAISE EXCEPTION 'Limite de sobrecarga entre 12 e 168 horas em 7 dias.';
  END IF;
  IF p_ocupacao_pct IS NULL OR p_ocupacao_pct NOT BETWEEN 50 AND 100 THEN
    RAISE EXCEPTION 'Limite de ocupação entre 50%% e 100%%.';
  END IF;
  IF p_checkin_tolerancia_min IS NULL OR p_checkin_tolerancia_min NOT BETWEEN 0 AND 120 THEN
    RAISE EXCEPTION 'Tolerância do check-in entre 0 e 120 minutos.';
  END IF;

  FOR k, v IN SELECT * FROM (VALUES
      ('descanso_minimo_ativo', p_descanso_ativo::text),
      ('descanso_minimo_horas', p_descanso_horas::text),
      ('sobrecarga_horas_7d', p_sobrecarga_horas::text),
      ('ocupacao_limite_pct', p_ocupacao_pct::text),
      ('checkin_tolerancia_min', p_checkin_tolerancia_min::text)) x(chave, valor) LOOP
    INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
    VALUES (p_unidade, k, v, CASE k
      WHEN 'descanso_minimo_ativo' THEN 'A unidade exige descanso mínimo entre jornadas (true/false)'
      WHEN 'descanso_minimo_horas' THEN 'Descanso mínimo entre jornadas, em horas'
      WHEN 'sobrecarga_horas_7d' THEN 'Limite de horas escaladas em 7 dias (sobrecarga)'
      WHEN 'ocupacao_limite_pct' THEN 'Limite de atenção da ocupação de leitos, em %'
      ELSE 'Tolerância do check-in depois do início do plantão, em minutos' END)
    ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = now()
    WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  END LOOP;

  PERFORM private.registrar_auditoria('salvar_limites_unidade', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('valores', private.limites_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- ── apoio, regras e tabela ─────────────────────────────────────────────────
-- (depois das funções acima, que deixaram de chamar secretaria_gere_unidade)
DROP FUNCTION IF EXISTS private.secretaria_gere_unidade(uuid);
DROP FUNCTION IF EXISTS private.unidades_da_minha_secretaria();
DROP POLICY IF EXISTS secretaria_pessoas_select ON public.secretaria_pessoas;
DROP FUNCTION IF EXISTS private.admin_da_secretaria(uuid);
DROP FUNCTION IF EXISTS private.minhas_secretarias_ids();
ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_sem_perfil_secretaria;
ALTER TABLE public.vinculos DROP CONSTRAINT IF EXISTS vinculos_sem_perfil_secretaria;
DROP TABLE IF EXISTS public.secretaria_pessoas;

COMMIT;
