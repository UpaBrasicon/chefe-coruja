-- ════════════════════════════════════════════════════════════════════════════
-- Perfil Gestor da secretaria, o que ficou de fora (pedido do RT, 24/11/2026).
-- Continua 20270421000022 e 20270421000023.
--
-- Expand (só adiciona ou estende, idempotente, sem DROP nem RENAME):
-- 1. Indicadores: public.secretaria_indicadores(ano, mês[, secretaria]) põe
--    as unidades da secretaria lado a lado: leitos por situação e ocupação,
--    pessoas por papel, escala do mês (plantões, faixas cobertas, vagas) e
--    atendimentos e internações do mês. Só agregado: contagem de paciente de
--    1 a 4 volta vazia (private.suprimir, ADR 0002), como no painel_organizacao.
--    Lê quem é da secretaria (as unidades dela) e o administrador dela.
-- 2. E-mail da designação: secretaria_pessoas ganha aviso_tentado_em e
--    avisado_em; secretaria_aviso_reservar e secretaria_aviso_concluir dão à
--    Edge Function avisar-secretaria o e-mail e o resto do aviso (só para o
--    administrador da secretaria, segundo fator, um envio por minuto).
-- 3. Papéis de quem já está na unidade, sem convite novo:
--    pessoas_da_unidade (a lista) e definir_papeis_na_unidade (troca, põe e
--    tira papel num passo só), para o gestor da unidade, o gestor da
--    secretaria e o administrador. Segundo fator e auditoria. Regras: ninguém
--    muda o próprio papel; administrador só pelo administrador da plataforma;
--    pôr ou tirar gestor (ou mexer em quem é gestor) só pela secretaria ou
--    pelo administrador; papéis de rede como no convite; papel que atende
--    paciente pede o registro profissional do cadastro.
-- 4. Rotina do leito e escala com nome nas unidades da secretaria (corpo
--    anterior tirado da homologação com pg_get_functiondef, no rollback):
--    concluir_higienizacao, reservar_leito (a secretaria reserva por motivo,
--    sem paciente), cancelar_reserva, liberar_leito_sem_paciente,
--    situacao_leitos (a secretaria não vê o nome do paciente da reserva) e
--    adicionar_plantao_escala; escala_plantao ganha leitura e exclusão para a
--    secretaria (o botão Remover da escala do mês).
--
-- Teste: supabase/tests/secretaria_completa.sql
-- Rollback: docs/rede/ROLLBACK-20270421000024.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. indicadores da secretaria ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.secretaria_indicadores(p_ano integer, p_mes integer, p_secretaria uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini date;
  v_fim date;
  v_de timestamptz;
  v_ate timestamptz;
  v_admin boolean := p_secretaria IS NOT NULL AND private.admin_da_secretaria(p_secretaria);
  v_unidades uuid[];
BEGIN
  IF private.meu_perfil_id() IS NULL
     OR NOT (v_admin OR EXISTS (SELECT 1 FROM private.unidades_da_minha_secretaria()))
     -- quem é da secretaria pede só a própria
     OR (p_secretaria IS NOT NULL AND NOT v_admin AND p_secretaria NOT IN (SELECT private.minhas_secretarias_ids())) THEN
    RAISE EXCEPTION 'Os indicadores são de quem cuida da secretaria.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_mes IS NULL OR p_ano IS NULL OR p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Mês inválido.';
  END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  -- o mês no horário de Brasília
  v_de := v_ini::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ate := (v_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT array_agg(u.id ORDER BY u.nome) INTO v_unidades
    FROM public.unidades u
   WHERE u.ativo
     AND (p_secretaria IS NULL OR u.secretaria_id = p_secretaria)
     AND (u.id IN (SELECT private.unidades_da_minha_secretaria())
          OR (v_admin AND EXISTS (SELECT 1 FROM public.secretarias s
                                   WHERE s.id = p_secretaria AND s.organizacao_id = u.organizacao_id)));

  RETURN jsonb_build_object(
    'competencia', v_ini,
    'unidades', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id, 'nome', u.nome, 'tipo', u.tipo,
        'secretaria', (SELECT s.nome FROM public.secretarias s WHERE s.id = u.secretaria_id),
        'leitos', jsonb_build_object(
          'total', lt.total,
          'ocupados', private.suprimir(lt.ocupados),
          'livres', lt.livres,
          'higienizacao', lt.higienizacao,
          'reservados', lt.reservados,
          'bloqueados', lt.bloqueados,
          -- a taxa só sai quando os dois termos passam pela supressão
          'taxa', CASE WHEN lt.total > 0 AND private.suprimir(lt.ocupados) IS NOT NULL AND private.suprimir(lt.total) IS NOT NULL
                       THEN round(100.0 * lt.ocupados / lt.total, 1) END),
        -- profissionais, não pacientes: sem supressão
        'pessoas', pe.por_papel,
        'pessoas_total', pe.total,
        'escala', jsonb_build_object(
          'plantoes', es.plantoes,
          'faixas', fx.faixas,
          'cobertas', fx.cobertas,
          'com_vaga', fx.com_vaga,
          'vagas', fx.vagas),
        'atendimentos', private.suprimir(mv.atendimentos),
        'internacoes', private.suprimir(mv.internacoes)
      ) ORDER BY u.nome)
      FROM public.unidades u
      CROSS JOIN LATERAL (
        SELECT count(*) AS total,
               count(*) FILTER (WHERE l.status = 'ocupado') AS ocupados,
               count(*) FILTER (WHERE l.status = 'livre') AS livres,
               count(*) FILTER (WHERE l.status = 'higienizacao') AS higienizacao,
               count(*) FILTER (WHERE l.status = 'reservado') AS reservados,
               count(*) FILTER (WHERE l.status = 'bloqueado') AS bloqueados
          FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
         WHERE s.unidade_id = u.id AND s.ativo AND l.ativo) lt
      CROSS JOIN LATERAL (
        SELECT coalesce(jsonb_object_agg(x.papel, x.n), '{}'::jsonb) AS por_papel,
               (SELECT count(DISTINCT v.perfil_id) FROM public.vinculos v WHERE v.unidade_id = u.id AND v.ativo) AS total
          FROM (SELECT v.papel::text AS papel, count(*) AS n FROM public.vinculos v
                 WHERE v.unidade_id = u.id AND v.ativo GROUP BY v.papel) x) pe
      CROSS JOIN LATERAL (
        SELECT count(*) AS plantoes FROM public.escala_plantao e
         WHERE e.unidade_id = u.id AND e.ativo AND e.data BETWEEN v_ini AND v_fim) es
      CROSS JOIN LATERAL (
        SELECT count(*) AS faixas,
               count(*) FILTER (WHERE jsonb_array_length(f.escalados) > 0 AND jsonb_array_length(f.abertas) = 0) AS cobertas,
               count(*) FILTER (WHERE jsonb_array_length(f.abertas) > 0) AS com_vaga,
               coalesce(sum(jsonb_array_length(f.abertas)), 0) AS vagas
          FROM private.escala_faixas(u.id, v_ini, v_fim) f) fx
      CROSS JOIN LATERAL (
        SELECT (SELECT count(*) FROM public.episodios ep
                 WHERE ep.unidade_id = u.id AND ep.chegada_em >= v_de AND ep.chegada_em < v_ate) AS atendimentos,
               (SELECT count(*) FROM public.internacoes i
                 WHERE i.unidade_id = u.id AND i.data_admissao >= v_de AND i.data_admissao < v_ate) AS internacoes) mv
     WHERE u.id = ANY (coalesce(v_unidades, '{}'::uuid[]))), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.secretaria_indicadores(integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_indicadores(integer, integer, uuid) TO authenticated;

-- ── 2. e-mail da designação ───────────────────────────────────────────────
ALTER TABLE public.secretaria_pessoas ADD COLUMN IF NOT EXISTS aviso_tentado_em timestamptz;
ALTER TABLE public.secretaria_pessoas ADD COLUMN IF NOT EXISTS avisado_em timestamptz;

-- A Edge Function chama com o token de quem designou: confere o administrador,
-- marca a tentativa (um envio por minuto) e devolve só o que vai no e-mail.
CREATE OR REPLACE FUNCTION public.secretaria_aviso_reservar(p_designacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.secretaria_pessoas;
  s public.secretarias;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.secretaria_pessoas WHERE id = p_designacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Designação não encontrada.' USING ERRCODE = 'no_data_found'; END IF;
  s := private.exigir_admin_da_secretaria(r.secretaria_id);
  IF NOT r.ativo OR NOT s.ativo THEN
    RAISE EXCEPTION 'A designação não está ativa.' USING ERRCODE = 'check_violation';
  END IF;
  IF r.aviso_tentado_em > now() - interval '1 minute' THEN
    RAISE EXCEPTION 'O aviso desta designação acabou de sair. Espere um minuto.' USING ERRCODE = 'lock_not_available';
  END IF;
  UPDATE public.secretaria_pessoas SET aviso_tentado_em = now() WHERE id = r.id;
  RETURN jsonb_build_object(
    'email', r.email,
    'nome', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = r.perfil_id),
    'pendente', r.perfil_id IS NULL,
    'secretaria', s.nome,
    'organizacao', (SELECT o.nome FROM public.organizacoes o WHERE o.id = s.organizacao_id),
    'designado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = private.meu_perfil_id()),
    'unidades', coalesce((SELECT jsonb_agg(u.nome ORDER BY u.nome) FROM public.unidades u
                           WHERE u.secretaria_id = s.id AND u.organizacao_id = s.organizacao_id AND u.ativo), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.secretaria_aviso_reservar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_aviso_reservar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretaria_aviso_concluir(p_designacao uuid, p_enviado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.secretaria_pessoas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.secretaria_pessoas WHERE id = p_designacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Designação não encontrada.' USING ERRCODE = 'no_data_found'; END IF;
  PERFORM private.exigir_admin_da_secretaria(r.secretaria_id);
  IF p_enviado IS TRUE THEN
    UPDATE public.secretaria_pessoas SET avisado_em = now() WHERE id = r.id;
  ELSE
    -- falhou: libera a próxima tentativa na hora
    UPDATE public.secretaria_pessoas SET aviso_tentado_em = NULL WHERE id = r.id;
  END IF;
  PERFORM private.registrar_auditoria('secretaria_pessoa_avisada', 'secretaria_pessoas', r.id, NULL,
    jsonb_build_object('status', CASE WHEN p_enviado IS TRUE THEN 'enviado' ELSE 'falhou' END));
END $$;
REVOKE ALL ON FUNCTION public.secretaria_aviso_concluir(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretaria_aviso_concluir(uuid, boolean) TO authenticated;

-- ── 3. papéis de quem já está na unidade ──────────────────────────────────
-- quem muda: o gestor (ou o papel admin) da unidade, o gestor da secretaria
-- da unidade e o administrador da organização
CREATE OR REPLACE FUNCTION private.pode_mudar_papeis(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
       private.sou_gestor_da_unidade(p_unidade)
    OR private.secretaria_gere_unidade(p_unidade)
    OR EXISTS (SELECT 1 FROM public.unidades u
                WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false)
$$;
REVOKE ALL ON FUNCTION private.pode_mudar_papeis(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pessoas_da_unidade(p_unidade uuid)
RETURNS TABLE(perfil_id uuid, nome text, email text, conselho text, registro text,
              papeis text[], papeis_retirados text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL OR NOT private.pode_mudar_papeis(p_unidade) THEN
    RAISE EXCEPTION 'A lista de pessoas é do gestor da unidade, do gestor da secretaria e do administrador.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email,
         coalesce(p.conselho, CASE WHEN p.crm IS NOT NULL THEN 'CRM' END),
         coalesce(p.registro_numero, p.crm) || coalesce('/' || coalesce(p.registro_uf, p.uf_crm), ''),
         coalesce(array_agg(v.papel::text ORDER BY v.papel::text) FILTER (WHERE v.ativo), '{}'),
         coalesce(array_agg(v.papel::text ORDER BY v.papel::text) FILTER (WHERE NOT v.ativo), '{}')
    FROM public.vinculos v
    JOIN public.perfis p ON p.id = v.perfil_id
   WHERE v.unidade_id = p_unidade
   GROUP BY p.id, p.nome_completo, p.email, p.conselho, p.crm, p.registro_numero, p.registro_uf, p.uf_crm
   ORDER BY bool_or(v.ativo) DESC, p.nome_completo;
END $$;
REVOKE ALL ON FUNCTION public.pessoas_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pessoas_da_unidade(uuid) TO authenticated;

-- Os papéis ativos da pessoa na unidade passam a ser p_papeis: o que falta
-- entra (ou volta), o que sobra sai. Lista vazia tira a pessoa da unidade.
CREATE OR REPLACE FUNCTION public.definir_papeis_na_unidade(p_unidade uuid, p_perfil uuid, p_papeis public.papel[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_super boolean := private.eh_super_admin();
  v_org uuid;
  v_admin boolean;
  v_secretaria boolean;
  v_sede boolean;
  v_novos text[];
  v_atuais text[];
  v_add text[];
  v_rem text[];
  v_conselho text;
  v_tem_registro boolean;
  v_futuros int := 0;
  per public.perfis;
  p text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  IF NOT private.pode_mudar_papeis(p_unidade) THEN
    RAISE EXCEPTION 'Quem muda o papel é o gestor da unidade, o gestor da secretaria ou o administrador.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_admin := v_super OR coalesce(private.eh_admin_da_organizacao(v_org), false);
  v_secretaria := private.secretaria_gere_unidade(p_unidade);
  IF p_perfil IS NULL OR p_perfil = v_eu THEN
    RAISE EXCEPTION 'Não é possível mudar o próprio papel.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Esta pessoa ainda não está na unidade: ela entra pelo convite.';
  END IF;
  SELECT * INTO per FROM public.perfis WHERE id = p_perfil;
  IF NOT FOUND OR NOT per.ativo THEN RAISE EXCEPTION 'Esta conta está desativada.'; END IF;

  v_novos := ARRAY(SELECT DISTINCT x::text FROM unnest(coalesce(p_papeis, '{}'::public.papel[])) x WHERE x IS NOT NULL ORDER BY 1);
  v_atuais := ARRAY(SELECT v.papel::text FROM public.vinculos v
                     WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo ORDER BY 1);
  v_add := ARRAY(SELECT unnest(v_novos) EXCEPT SELECT unnest(v_atuais));
  v_rem := ARRAY(SELECT unnest(v_atuais) EXCEPT SELECT unnest(v_novos));
  IF cardinality(v_add) = 0 AND cardinality(v_rem) = 0 THEN
    RETURN jsonb_build_object('mudou', false, 'papeis', to_jsonb(v_atuais), 'plantoes_futuros', 0);
  END IF;

  -- quem é gestor ou administrador da unidade só é mexido de cima
  IF NOT (v_admin OR v_secretaria) AND v_atuais && ARRAY['gestor', 'admin'] THEN
    RAISE EXCEPTION 'Os papéis de outro gestor são mudados pelo gestor da secretaria ou pelo administrador.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_sede := EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade);
  FOREACH p IN ARRAY v_add || v_rem LOOP
    IF p = 'gestor_secretaria' THEN
      RAISE EXCEPTION 'O perfil Gestor da secretaria é designado pelo administrador na Rede.';
    END IF;
    IF p = 'admin' AND NOT v_super THEN
      RAISE EXCEPTION 'O papel de administrador é dado pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p = 'gestor' AND NOT (v_admin OR v_secretaria) THEN
      RAISE EXCEPTION 'Quem põe ou tira o gestor da unidade é o gestor da secretaria ou o administrador.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF private.eh_papel_rede(p) AND NOT v_super THEN
      RAISE EXCEPTION 'Pessoas de rede são cadastradas pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  v_conselho := coalesce(per.conselho, CASE WHEN per.crm IS NOT NULL THEN 'CRM' END);
  v_tem_registro := (per.registro_numero IS NOT NULL AND per.registro_uf IS NOT NULL)
                    OR (v_conselho = 'CRM' AND per.crm IS NOT NULL);
  FOREACH p IN ARRAY v_add LOOP
    IF private.eh_papel_rede(p) AND NOT v_sede THEN
      RAISE EXCEPTION 'Papel de rede só na unidade Secretaria da organização.';
    ELSIF NOT private.eh_papel_rede(p) AND v_sede THEN
      RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
    END IF;
    -- quem atende paciente precisa do registro profissional (a mesma regra do primeiro acesso)
    IF p IN ('plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico') THEN
      IF NOT v_tem_registro OR v_conselho IS NULL THEN
        RAISE EXCEPTION 'Esta pessoa não tem registro profissional no cadastro: o papel de % entra pelo convite, onde ela informa o registro.',
          replace(p, '_', ' ');
      END IF;
      IF (p IN ('plantonista', 'telemedicina') AND v_conselho <> 'CRM')
         OR (p IN ('enfermeiro', 'tecnico_enfermagem') AND v_conselho <> 'COREN')
         OR (p = 'farmaceutico' AND v_conselho <> 'CRF') THEN
        RAISE EXCEPTION 'O registro da pessoa (%) não é o do papel de %.', v_conselho, replace(p, '_', ' ');
      END IF;
    END IF;
  END LOOP;

  IF cardinality(v_rem) > 0 THEN
    UPDATE public.vinculos SET ativo = false
     WHERE perfil_id = p_perfil AND unidade_id = p_unidade AND ativo AND papel::text = ANY (v_rem);
    -- plantões que já estão na escala com o papel que saiu ficam lá: a tela avisa
    SELECT count(*) INTO v_futuros FROM public.escala_plantao e
     WHERE e.perfil_id = p_perfil AND e.unidade_id = p_unidade AND e.ativo
       AND e.data >= private.data_atual() AND e.papel::text = ANY (v_rem);
  END IF;
  IF cardinality(v_add) > 0 THEN
    INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
    SELECT p_perfil, p_unidade, x::public.papel, true, v_eu FROM unnest(v_add) x
    ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;
  END IF;

  PERFORM private.registrar_auditoria('vinculo_papeis_definidos', 'vinculos', NULL, p_unidade,
    jsonb_build_object('perfil_id', p_perfil,
                       'anterior', array_to_string(v_atuais, ','),
                       'papel', array_to_string(v_novos, ',')));
  RETURN jsonb_build_object('mudou', true, 'papeis', to_jsonb(v_novos), 'plantoes_futuros', v_futuros);
END $$;
REVOKE ALL ON FUNCTION public.definir_papeis_na_unidade(uuid, uuid, public.papel[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_papeis_na_unidade(uuid, uuid, public.papel[]) TO authenticated;

-- ── 4. rotina do leito e escala com nome ──────────────────────────────────
-- Corpo igual ao da homologação em 24/11/2026; só a checagem ganha
-- "OR private.secretaria_gere_unidade(...)". Os GRANTs ficam (CREATE OR
-- REPLACE não mexe neles).

-- concluir_higienizacao(uuid)
CREATE OR REPLACE FUNCTION public.concluir_higienizacao(p_leito uuid)
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
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'tecnico_enfermagem')
          OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só a enfermagem, o gestor ou a secretaria da unidade concluem a higienização.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'higienizacao' THEN
    RAISE EXCEPTION 'Leito % não está em higienização.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'higienizacao_concluida', 'higienizacao', 'livre', v_perfil, 'Higienização concluída');
  PERFORM private.avisar_leito_liberado(p_leito);
END; $function$;

-- reservar_leito(uuid,integer,uuid,text)
CREATE OR REPLACE FUNCTION public.reservar_leito(p_leito uuid, p_horas integer, p_paciente uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
  v_da_unidade boolean;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  v_da_unidade := coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
                  OR private.tenho_papel(r.unidade_id, 'enfermeiro')
                  OR private.tenho_papel(r.unidade_id, 'plantonista');
  IF NOT (v_da_unidade OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só médico, enfermeiro, gestor ou a secretaria da unidade reservam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- a secretaria não lida com paciente: reserva por motivo
  IF p_paciente IS NOT NULL AND NOT v_da_unidade THEN
    RAISE EXCEPTION 'A secretaria reserva leito por motivo, sem paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_horas IS NULL OR p_horas NOT IN (1, 2, 4, 8) THEN
    RAISE EXCEPTION 'Escolha a validade da reserva: 1, 2, 4 ou 8 horas.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NULL AND length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Escolha o paciente ou descreva o motivo da reserva.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = r.unidade_id) THEN
    RAISE EXCEPTION 'Paciente não pertence a esta unidade.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM private.expirar_reservas();   -- reserva vencida não segura leito nem paciente
  IF p_paciente IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservas_leito WHERE paciente_id = p_paciente AND situacao = 'ativa') THEN
    RAISE EXCEPTION 'Este paciente já tem um leito reservado: cancele a reserva anterior antes.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reservas_leito (leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
  VALUES (p_leito, r.unidade_id, p_paciente, v_motivo, v_perfil, now() + make_interval(hours => p_horas))
  RETURNING id INTO v_id;
  PERFORM set_config('cc.reserva_nova', p_leito::text, true);
  UPDATE public.leitos SET status = 'reservado' WHERE id = p_leito;   -- a trava recusa leito que não está livre
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'reserva', 'livre', 'reservado', v_perfil,
          CASE WHEN p_paciente IS NOT NULL THEN 'Reserva para paciente' ELSE 'Reserva: ' || v_motivo END
          || ' (' || p_horas || ' h)');
  RETURN v_id;
END; $function$;

-- cancelar_reserva(uuid,text)
CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_leito uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  res public.reservas_leito;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  SELECT * INTO res FROM public.reservas_leito WHERE leito_id = p_leito AND situacao = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito % não tem reserva ativa.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (res.reservado_por = v_perfil
          OR coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só quem reservou, o enfermeiro, o gestor ou a secretaria cancelam a reserva.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo do cancelamento.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reservas_leito
     SET situacao = 'cancelada', encerrada_em = now(), encerrada_por = v_perfil, motivo_encerramento = btrim(p_motivo)
   WHERE id = res.id;
  PERFORM set_config('cc.reserva_encerrada', p_leito::text, true);
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito AND status = 'reservado';
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'cancelamento_reserva', 'reservado', 'livre', v_perfil, 'Cancelada: ' || btrim(p_motivo));
END; $function$;

-- liberar_leito_sem_paciente(uuid,text)
CREATE OR REPLACE FUNCTION public.liberar_leito_sem_paciente(p_leito uuid, p_motivo text)
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
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só o gestor ou a secretaria da unidade liberam leito sem paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'ocupado' THEN
    RAISE EXCEPTION 'Leito % não está ocupado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes i
              WHERE i.leito_atual_id = p_leito AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'Leito % tem paciente: libere pela alta ou pela transferência.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.leitos WHERE id = p_leito AND obito_aguardando_id IS NOT NULL) THEN
    -- lacuna 5 (O5)
    RAISE EXCEPTION 'Leito % aguarda a liberação do corpo: registre a liberação no óbito.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'higienizacao' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'liberacao', 'ocupado', 'higienizacao', v_perfil, 'Sem paciente: ' || btrim(p_motivo));
END; $function$;

-- situacao_leitos(uuid): a secretaria (sem papel na unidade) ganha as ações e
-- não vê o nome do paciente da reserva
CREATE OR REPLACE FUNCTION public.situacao_leitos(p_unidade uuid)
 RETURNS TABLE(leito_id uuid, identificador text, setor_id uuid, setor_nome text, status status_leito, desde timestamp with time zone, motivo text, pode_higienizar boolean, pode_bloquear boolean, reserva_paciente text, reserva_motivo text, reserva_expira_em timestamp with time zone, pode_reservar boolean, pode_cancelar_reserva boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_gestor boolean;
  v_enf boolean;
  v_tec boolean;
  v_med boolean;
  v_sec boolean;
  v_so_sec boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.membro_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_gestor := coalesce(private.sou_gestor_da_unidade(p_unidade), false);
  v_enf := private.tenho_papel(p_unidade, 'enfermeiro');
  v_tec := private.tenho_papel(p_unidade, 'tecnico_enfermagem');
  v_med := private.tenho_papel(p_unidade, 'plantonista');
  v_sec := private.secretaria_gere_unidade(p_unidade);
  -- só da secretaria: sem papel na unidade e sem ser administrador
  v_so_sec := v_sec AND coalesce(private.papel_na_unidade(p_unidade), '') = '' AND NOT private.eh_super_admin()
              AND NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id));
  RETURN QUERY
  SELECT l.id, l.identificador, s.id, s.nome, l.status,
         ev.created_at,
         CASE WHEN l.status = 'bloqueado' THEN
           (SELECT e.motivo FROM public.eventos_leito e
             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1)
              -- lacuna 5 (O5): o leito segue ocupado com o corpo
              WHEN l.obito_aguardando_id IS NOT NULL THEN 'aguardando_corpo' END,
         v_gestor OR v_enf OR v_tec OR v_sec,
         v_gestor OR v_enf OR v_sec,
         CASE WHEN v_so_sec THEN NULL ELSE p.nome END, rv.motivo, rv.expira_em,
         v_gestor OR v_enf OR v_med OR v_sec,
         rv.id IS NOT NULL AND (v_gestor OR v_enf OR v_sec OR rv.reservado_por = v_perfil)
    FROM public.leitos l
    JOIN public.setores s ON s.id = l.setor_id
    LEFT JOIN LATERAL (SELECT e.created_at FROM public.eventos_leito e
                        WHERE e.leito_id = l.id ORDER BY e.created_at DESC LIMIT 1) ev ON true
    LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
    LEFT JOIN public.pacientes p ON p.id = rv.paciente_id
   WHERE s.unidade_id = p_unidade AND l.ativo
   ORDER BY s.nome, l.identificador;
END; $function$;

-- adicionar_plantao_escala(uuid,uuid,uuid,date,text,text,boolean,papel)
CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(p_unidade uuid, p_setor uuid, p_perfil uuid, p_data date, p_turno text, p_rotulo text DEFAULT NULL::text, p_quinzenal boolean DEFAULT false, p_papel papel DEFAULT NULL::papel)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_existente uuid;
  v_id uuid;
  v_inicio timestamptz;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor' OR private.secretaria_gere_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo nesta unidade.';
  END IF;
  -- a categoria escolhida tem de ser um papel da pessoa (o gatilho confere de novo)
  IF p_papel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo AND v.papel = p_papel) THEN
    RAISE EXCEPTION 'Este profissional não tem o papel de % nesta unidade.', replace(p_papel::text, '_', ' ');
  END IF;

  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este profissional já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por, papel)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid(), p_papel)
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este profissional.';
  END IF;

  -- B3: plantão que já começou fica como acerto retroativo no histórico
  SELECT e.inicio INTO v_inicio FROM public.escala_plantao e WHERE e.id = v_id;
  IF v_inicio <= now() THEN
    PERFORM private.registrar_historico(p_unidade, v_id, 'retroativo',
      'Acerto retroativo: plantão escalado depois de começar',
      jsonb_build_object('data', p_data, 'turno', p_turno, 'perfil_id', p_perfil, 'papel', p_papel));
  END IF;

  RETURN v_id;
END;
$function$;

-- escala_plantao: a secretaria lê e remove plantão das unidades dela (o
-- botão Remover da escala do mês; o DELETE com WHERE precisa da leitura)
DROP POLICY IF EXISTS escala_plantao_secretaria_select ON public.escala_plantao;
CREATE POLICY escala_plantao_secretaria_select ON public.escala_plantao FOR SELECT TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id));
DROP POLICY IF EXISTS escala_plantao_secretaria_delete ON public.escala_plantao;
CREATE POLICY escala_plantao_secretaria_delete ON public.escala_plantao FOR DELETE TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id));
