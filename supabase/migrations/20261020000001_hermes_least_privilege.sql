-- ════════════════════════════════════════════════════════════════════════════
-- Hermes — camada de menor privilégio (red-team V1).
--
-- Hoje o Hermes/VPS usa a chave service_role (bypassa TODA a RLS) e a
-- autorização por unidade/papel é reimplementada em TypeScript. Bug no filtro
-- = vazamento cross-tenant sem rede de proteção do banco.
--
-- Esta migration cria a BASE para tirar o service_role do Hermes, de forma
-- ADITIVA (não muda nada até o cutover no VPS):
--   • role hermes_user  — caminho de request (skill-api, identidade, sessão,
--     tools do agente). ZERO privilégio de tabela; só EXECUTE nas RPCs abaixo,
--     cada uma recebendo p_perfil (o chamador resolvido no servidor) e checando
--     o escopo DENTRO do SQL. Mesmo bug/injeção não alcança outro tenant.
--   • role hermes_job   — crons (cerbero/argos/gaviao/vigias/sentinela/iris).
--     Leitura ampla legítima (auditam a plataforma), sem input não-confiável:
--     grants mínimos SELECT/INSERT + EXECUTE nas RPCs de verificação, no lugar
--     do service_role.
--
-- Cutover (no VPS, feito e testado por você — ver
-- docs/seguranca/cutover-hermes-v1.md): reescrever .from()→.rpc() no Hermes,
-- emitir JWT com claim role=hermes_user/hermes_job, e remover a service_role
-- do runtime. Enquanto o cutover não acontece, nada muda.
--
-- Reaplicável. SECURITY DEFINER + search_path=''. Escopo por p_perfil (NÃO
-- auth.uid(): o Hermes age em nome do profissional resolvido pelo wa_id).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Roles (NOLOGIN, como anon/authenticated; acessadas via authenticator) ────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_user') THEN
    CREATE ROLE hermes_user NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hermes_job') THEN
    CREATE ROLE hermes_job NOLOGIN NOINHERIT;
  END IF;
END $$;

-- PostgREST troca de papel (SET ROLE) a partir do authenticator.
GRANT hermes_user TO authenticator;
GRANT hermes_job  TO authenticator;
GRANT USAGE ON SCHEMA public TO hermes_user, hermes_job;
-- hermes_user NÃO recebe grant de tabela nenhum (só EXECUTE nas RPCs abaixo).

-- ── Helpers de escopo por p_perfil (NÃO auth.uid) ────────────────────────────
CREATE OR REPLACE FUNCTION private.hermes_eh_super(p_perfil uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins s WHERE s.perfil_id = p_perfil);
$$;

CREATE OR REPLACE FUNCTION private.hermes_pode_unidade(p_perfil uuid, p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.hermes_eh_super(p_perfil)
      OR EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo);
$$;

CREATE OR REPLACE FUNCTION private.hermes_gere_unidade(p_perfil uuid, p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.hermes_eh_super(p_perfil)
      OR EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo
                   AND v.papel IN ('gestor','admin'));
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- IDENTIDADE (substitui identidade.ts:154/170/202 — inclui o scan da tabela
-- perfis inteira, o maior read cross-tenant do caminho de request)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_identidade_por_telefone(p_e164 text)
RETURNS TABLE (perfil_id uuid, nome_completo text, email text, is_super_admin boolean, vinculos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH achado AS (
    SELECT p.id, p.nome_completo, p.email
    FROM public.perfis p
    WHERE p.ativo AND p.telefone IS NOT NULL
      AND regexp_replace(p.telefone, '\D', '', 'g') = regexp_replace(p_e164, '\D', '', 'g')
    ORDER BY p.id
    LIMIT 2
  )
  SELECT a.id, a.nome_completo, a.email,
         private.hermes_eh_super(a.id),
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'unidade_id', v.unidade_id, 'papel', v.papel,
                    'unidade_nome', u.nome, 'organizacao_id', u.organizacao_id))
                   FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
                   WHERE v.perfil_id = a.id AND v.ativo), '[]'::jsonb)
  FROM achado a
  WHERE (SELECT count(*) FROM achado) = 1;  -- telefone ambíguo → nada (resolve no SQL)
$$;

CREATE OR REPLACE FUNCTION public.hermes_identidade_por_canal(p_canal text, p_identificador text)
RETURNS TABLE (perfil_id uuid, nome_completo text, email text, is_super_admin boolean, vinculos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.nome_completo, p.email,
         private.hermes_eh_super(p.id),
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'unidade_id', v.unidade_id, 'papel', v.papel,
                    'unidade_nome', u.nome, 'organizacao_id', u.organizacao_id))
                   FROM public.vinculos v JOIN public.unidades u ON u.id = v.unidade_id
                   WHERE v.perfil_id = p.id AND v.ativo), '[]'::jsonb)
  FROM public.hermes_identidades hi
  JOIN public.perfis p ON p.id = hi.perfil_id AND p.ativo
  WHERE hi.canal = p_canal AND hi.identificador = p_identificador;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PAINÉIS DE UNIDADE (exigem vínculo do chamador na unidade, ou super)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_unidade_setores(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (nome text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT s.nome FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo ORDER BY s.nome;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_censo(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (data date, turno text, internados int, leitos_total int, leitos_ocupados int, leitos_livres int, taxa_ocupacao numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.data, c.turno, c.internados, c.leitos_total, c.leitos_ocupados, c.leitos_livres, c.taxa_ocupacao
    FROM public.censo_ocupacao c WHERE c.unidade_id = p_unidade
    ORDER BY c.data DESC, c.turno DESC LIMIT 1;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_indicadores(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (total_pacientes bigint, prescricoes_assinadas bigint, prescricoes_rascunho bigint, receitas_retidas bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT (SELECT count(*) FROM public.pacientes pa WHERE pa.unidade_id = p_unidade AND pa.ativo),
           (SELECT count(*) FROM public.prescricoes pr WHERE pr.unidade_id = p_unidade AND pr.status = 'assinada'),
           (SELECT count(*) FROM public.prescricoes pr WHERE pr.unidade_id = p_unidade AND pr.status = 'rascunho'),
           (SELECT count(DISTINCT rr.id) FROM public.receitas_retidas rr
             JOIN public.prescricoes pr ON pr.id = rr.prescricao_id WHERE pr.unidade_id = p_unidade);
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_profissionais(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (papel text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT v.papel::text, count(*) FROM public.vinculos v
    WHERE v.unidade_id = p_unidade AND v.ativo GROUP BY v.papel ORDER BY v.papel;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_resumo(p_perfil uuid, p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  SELECT r.dados INTO v FROM public.hermes_resumo_unidade r WHERE r.unidade_id = p_unidade;
  RETURN COALESCE(v, 'null'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_internacoes_por_status(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (status text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT i.status::text, count(*) FROM public.internacoes i
    WHERE i.unidade_id = p_unidade GROUP BY i.status ORDER BY i.status;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_unidade_nomes(p_perfil uuid, p_unidade uuid)
RETURNS TABLE (nome_completo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.nome_completo FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
    WHERE v.unidade_id = p_unidade AND v.ativo;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- OPERACIONAL (escopado ao próprio perfil)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_minhas_notificacoes(p_perfil uuid, p_unidade uuid, p_dias int DEFAULT 7)
RETURNS TABLE (tipo text, mensagem text, data date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_pode_unidade(p_perfil, p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: sem vínculo com a unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT n.tipo, n.mensagem, n.data FROM public.notificacoes_plantonista n
    WHERE n.perfil_id = p_perfil AND n.unidade_id = p_unidade
      AND n.data >= (now() - make_interval(days => p_dias))::date
    ORDER BY n.data DESC;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEGURANÇA / GLOBAL (gestor/admin da unidade, ou super_admin)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_alertas_escala(p_perfil uuid, p_unidade uuid DEFAULT NULL, p_status text[] DEFAULT ARRAY['novo','visto','em_acompanhamento'])
RETURNS TABLE (id uuid, unidade_id uuid, medico_id uuid, metrica text, valor numeric, mediana_unidade numeric, status text, criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_super boolean := private.hermes_eh_super(p_perfil);
BEGIN
  IF NOT v_super AND (p_unidade IS NULL OR NOT private.hermes_gere_unidade(p_perfil, p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: alertas são do gestor da unidade.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.unidade_id, a.medico_id, a.metrica, a.valor, a.mediana_unidade, a.status, a.criado_em
    FROM public.chronos_alertas_escala a
    WHERE a.status = ANY(p_status) AND (v_super OR a.unidade_id = p_unidade)
    ORDER BY a.criado_em DESC;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_relatorio_semanal_ultimo(p_perfil uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT private.hermes_eh_super(p_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: relatório da plataforma é do super admin.' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(r) INTO v FROM public.gaviao_relatorios_semanais r ORDER BY r.periodo_inicio DESC LIMIT 1;
  RETURN COALESCE(v, 'null'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.hermes_incidentes_abertos(p_perfil uuid, p_patrulha text DEFAULT NULL, p_severidade text DEFAULT NULL)
RETURNS TABLE (id uuid, patrulha text, severidade text, titulo text, status text, detectado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_eh_super(p_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: incidentes são do super admin.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT i.id, i.patrulha, i.severidade, i.titulo, i.status, i.detectado_em
    FROM public.cerbero_incidentes i
    WHERE i.status IN ('aberto','em_analise')
      AND (p_patrulha IS NULL OR i.patrulha = p_patrulha)
      AND (p_severidade IS NULL OR i.severidade = p_severidade)
    ORDER BY i.detectado_em DESC LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_quarentena_pendente(p_perfil uuid)
RETURNS TABLE (id uuid, tipo text, origem text, motivo text, criado_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_eh_super(p_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: quarentena é do super admin.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT q.id, q.tipo, q.origem, q.motivo, q.criado_em FROM public.cerbero_quarentena q
    WHERE q.liberado = false ORDER BY q.criado_em DESC LIMIT 50;
END $$;

CREATE OR REPLACE FUNCTION public.hermes_integridade_resumo(p_perfil uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.hermes_eh_super(p_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: integridade é do super admin.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'incidentes_abertos', (SELECT count(*) FROM public.cerbero_incidentes WHERE status IN ('aberto','em_analise')),
    'quarentena_pendente', (SELECT count(*) FROM public.cerbero_quarentena WHERE liberado = false));
END $$;

CREATE OR REPLACE FUNCTION public.hermes_liberar_quarentena(p_perfil uuid, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  IF NOT private.hermes_eh_super(p_perfil) THEN
    RAISE EXCEPTION 'Acesso negado: liberar quarentena é do super admin.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.cerbero_quarentena SET liberado = true WHERE id = p_id AND liberado = false;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SESSÕES (escopadas ao próprio user_id)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_sessao_carregar(p_perfil uuid, p_phone text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.messages FROM public.hermes_sessions s
  WHERE s.user_id = p_perfil AND s.phone = p_phone ORDER BY s.updated_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.hermes_sessao_salvar(p_perfil uuid, p_phone text, p_messages jsonb)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.hermes_sessions (user_id, phone, messages, updated_at)
  VALUES (p_perfil, p_phone, p_messages, now())
  ON CONFLICT (user_id, phone) DO UPDATE SET messages = EXCLUDED.messages, updated_at = now();
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUDITORIA / QUARENTENA DE CONTEÚDO (writes do pipeline, sem grant de tabela)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hermes_audit_registrar(
  p_perfil uuid, p_phone text, p_direction text,
  p_tool_name text DEFAULT NULL, p_tool_args jsonb DEFAULT NULL, p_resumo text DEFAULT NULL)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.hermes_audit_log (user_id, phone, direction, tool_name, tool_args, tool_result_summary)
  VALUES (p_perfil, p_phone, p_direction, p_tool_name, p_tool_args, left(coalesce(p_resumo,''), 500));
$$;

CREATE OR REPLACE FUNCTION public.hermes_quarentenar_conteudo(
  p_tenant uuid, p_tipo text, p_origem text, p_autor uuid,
  p_conteudo_hash text, p_motivo text, p_severidade text DEFAULT 'media',
  p_titulo text DEFAULT 'Conteúdo suspeito', p_evidencia jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inc uuid;
BEGIN
  INSERT INTO public.cerbero_incidentes (tenant_id, patrulha, severidade, titulo, evidencia, status)
  VALUES (p_tenant, 'conteudo', p_severidade, p_titulo, p_evidencia, 'aberto')
  RETURNING id INTO v_inc;
  INSERT INTO public.cerbero_quarentena (tenant_id, tipo, origem, autor_id, conteudo_hash, motivo, incidente_id)
  VALUES (p_tenant, p_tipo, p_origem, p_autor, p_conteudo_hash, p_motivo, v_inc);
  RETURN v_inc;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS — hermes_user: só EXECUTE nas RPCs de request (zero tabela)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.hermes_identidade_por_telefone(text)',
    'public.hermes_identidade_por_canal(text,text)',
    'public.hermes_unidade_setores(uuid,uuid)',
    'public.hermes_unidade_censo(uuid,uuid)',
    'public.hermes_unidade_indicadores(uuid,uuid)',
    'public.hermes_unidade_profissionais(uuid,uuid)',
    'public.hermes_unidade_resumo(uuid,uuid)',
    'public.hermes_unidade_internacoes_por_status(uuid,uuid)',
    'public.hermes_unidade_nomes(uuid,uuid)',
    'public.hermes_minhas_notificacoes(uuid,uuid,integer)',
    'public.hermes_alertas_escala(uuid,uuid,text[])',
    'public.hermes_relatorio_semanal_ultimo(uuid)',
    'public.hermes_incidentes_abertos(uuid,text,text)',
    'public.hermes_quarentena_pendente(uuid)',
    'public.hermes_integridade_resumo(uuid)',
    'public.hermes_liberar_quarentena(uuid,uuid)',
    'public.hermes_sessao_carregar(uuid,text)',
    'public.hermes_sessao_salvar(uuid,text,jsonb)',
    'public.hermes_audit_registrar(uuid,text,text,text,jsonb,text)',
    'public.hermes_quarentenar_conteudo(uuid,text,text,uuid,text,text,text,text,jsonb)',
    -- já existentes, escopadas por perfil/unidade: passam a ser chamáveis por hermes_user
    'public.hermes_plantoes_do_perfil(uuid,integer)',
    'public.hermes_plantao_do_dia(uuid,date)',
    'public.hermes_almanaque_buscar(text,integer)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hermes_user', f);
  END LOOP;
END $$;

-- ── hermes_job: grants mínimos (crons; leitura ampla, sem input não-confiável)
-- Leitura (SELECT) só nas tabelas que os jobs leem; perfis só id+nome.
GRANT SELECT ON public.unidades, public.censo_ocupacao, public.observacao, public.prescricoes,
  public.escala_plantao, public.solicitacoes_escala, public.trocas_plantao, public.vinculos,
  public.hermes_audit_log, public.cerbero_incidentes, public.chronos_alertas_escala,
  public.cerbero_quarentena TO hermes_job;
GRANT SELECT (id, nome_completo) ON public.perfis TO hermes_job;
GRANT INSERT ON public.cerbero_incidentes, public.chronos_alertas_escala,
  public.notificacoes_plantonista, public.gaviao_relatorios_semanais,
  public.ia_gateway_log, public.hermes_audit_log TO hermes_job;
GRANT UPDATE (liberado) ON public.cerbero_quarentena TO hermes_job;  -- liberarQuarentena (se via job)
GRANT INSERT ON public.cerbero_quarentena, public.cerbero_url_cache TO hermes_job;  -- content firewall
-- EXECUTE nas RPCs de verificação dos jobs:
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.hermes_plantoes_sobrepostos(integer)','public.hermes_perfis_sem_vinculo()',
    'public.hermes_crm_duplicado()','public.hermes_setores_ocupados_sem_plantao()',
    'public.hermes_porta_resumo(uuid,integer)','public.hermes_checkin_pendente()',
    'public.hermes_buracos_escala(integer)','public.hermes_revisoes_paradas()',
    'public.hermes_acessos_anomalos(integer,integer,integer)','public.hermes_cadeia_auditoria()'
  ]
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hermes_job', f);
  END LOOP;
END $$;
