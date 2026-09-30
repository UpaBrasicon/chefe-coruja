-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo, onda 8 — administrador (Rede, Plataformas, Pendências
-- técnicas, Servidores) e o painel da TV da Recepção (P/index.html 9383–9454,
-- 9979–10097; P/Painel de Chamada.dc.html).
--
-- O administrador não abre prontuário: vê unidade, cobertura, chamado técnico
-- e servidor. Nada aqui devolve identidade de paciente; contagens de paciente
-- passam por private.suprimir (1 a 4 viram nulo, ADR 0002).
--
-- No protótipo, unidades, chamados e serviços eram listas fixas no código. Aqui
-- só entra o que o banco sabe de verdade:
--  * CHAMADOS TÉCNICOS (tabela nova): o administrador abre, acompanha e fecha;
--    cada mudança de situação fica no andamento (só inserção).
--  * admin_unidades: por unidade, leitos e ocupação (suprimidos), quem está em
--    plantão, pessoas com sessão em uso (renovada nos últimos 30 minutos, em
--    auth.sessions), último uso, chamados abertos e a fila da RNDS.
--  * admin_servidores: tamanho do banco e conexões, sessões, fila da RNDS,
--    arquivos guardados por bucket, inscrições de push, registro de auditoria.
--    Uptime, backup, latência por unidade e taxa de entrega de push NÃO têm
--    fonte no banco (ficam no painel do Supabase) e a tela diz isso.
--
-- PAINEL DA TV: a propaganda em rodízio é conteúdo da unidade (painel_config e
-- painel_propagandas; artes no bucket público 'painel', pasta da unidade),
-- cadastrado pelo gestor. painel_chamadas passa a mandar também quem chamou
-- (nome do profissional) e a vez da chamada ("Chamando novamente"), além das
-- artes ativas — nenhum dado de paciente além de nome e sala.
--
-- Escrita só pelas RPCs, com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. chamados técnicos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chamados_tecnicos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  unidade_id      uuid REFERENCES public.unidades(id) ON DELETE CASCADE,  -- nulo: a rede toda
  titulo          text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 5 AND 140),
  descricao       text,
  categoria       text NOT NULL CHECK (categoria IN ('servidor', 'aplicativo', 'integracao', 'seguranca')),
  severidade      text NOT NULL CHECK (severidade IN ('alta', 'media', 'baixa')),
  responsavel     text,
  situacao        text NOT NULL DEFAULT 'aberto'
                  CHECK (situacao IN ('aberto', 'em_atendimento', 'aguardando_unidade', 'planejado', 'resolvido')),
  aberto_por      uuid NOT NULL REFERENCES public.perfis(id),
  aberto_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  resolvido_em    timestamptz,
  resolvido_por   uuid REFERENCES public.perfis(id)
);
CREATE INDEX IF NOT EXISTS chamados_tecnicos_org ON public.chamados_tecnicos (organizacao_id, situacao);
CREATE INDEX IF NOT EXISTS chamados_tecnicos_unidade ON public.chamados_tecnicos (unidade_id) WHERE situacao <> 'resolvido';
ALTER TABLE public.chamados_tecnicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chamados_tecnicos FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.chamados_tecnicos_andamento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id  uuid NOT NULL REFERENCES public.chamados_tecnicos(id) ON DELETE CASCADE,
  situacao    text NOT NULL,
  nota        text,
  autor_id    uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT clock_timestamp()  -- ordem dentro da mesma transação
);
ALTER TABLE public.chamados_tecnicos_andamento ALTER COLUMN em SET DEFAULT clock_timestamp();
CREATE INDEX IF NOT EXISTS chamados_tecnicos_andamento_chamado ON public.chamados_tecnicos_andamento (chamado_id, em);
DROP TRIGGER IF EXISTS trg_chamados_andamento_so_insercao ON public.chamados_tecnicos_andamento;
CREATE TRIGGER trg_chamados_andamento_so_insercao BEFORE UPDATE OR DELETE ON public.chamados_tecnicos_andamento
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.chamados_tecnicos_andamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chamados_tecnicos_andamento FROM PUBLIC, anon, authenticated;

-- administrador da organização (ou da plataforma) sobre um chamado
CREATE OR REPLACE FUNCTION private.admin_do_chamado(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR p_org IN (SELECT private.orgs_admin())
$$;

CREATE OR REPLACE FUNCTION public.chamados_tecnicos_lista(p_incluir_resolvidos boolean DEFAULT false)
RETURNS TABLE (id uuid, unidade_id uuid, unidade_nome text, titulo text, descricao text, categoria text,
               severidade text, responsavel text, situacao text, aberto_por text, aberto_em timestamptz,
               atualizado_em timestamptz, resolvido_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'Acesso negado: tela do administrador.';
  END IF;
  RETURN QUERY
  SELECT c.id, c.unidade_id, u.nome, c.titulo, c.descricao, c.categoria, c.severidade, c.responsavel,
         c.situacao, p.nome_completo, c.aberto_em, c.atualizado_em, c.resolvido_em
    FROM public.chamados_tecnicos c
    LEFT JOIN public.unidades u ON u.id = c.unidade_id
    LEFT JOIN public.perfis p ON p.id = c.aberto_por
   WHERE private.admin_do_chamado(c.organizacao_id)
     AND (coalesce(p_incluir_resolvidos, false) OR c.situacao <> 'resolvido')
   ORDER BY (c.situacao = 'resolvido'), CASE c.severidade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, c.aberto_em;
END $$;
REVOKE ALL ON FUNCTION public.chamados_tecnicos_lista(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamados_tecnicos_lista(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.abrir_chamado_tecnico(
  p_unidade uuid, p_titulo text, p_categoria text, p_severidade text,
  p_descricao text DEFAULT NULL, p_responsavel text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NOT NULL THEN
    SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
    IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  ELSE
    -- chamado da rede toda: a organização do administrador (uma só)
    SELECT min(o::text)::uuid INTO v_org FROM private.orgs_admin() o;
    IF (SELECT count(*) FROM private.orgs_admin()) > 1 THEN
      RAISE EXCEPTION 'Escolha a unidade do chamado.';
    END IF;
  END IF;
  IF v_org IS NULL OR NOT private.admin_do_chamado(v_org) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador.';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) < 5 THEN
    RAISE EXCEPTION 'Descreva o chamado em pelo menos 5 letras.';
  END IF;
  INSERT INTO public.chamados_tecnicos (organizacao_id, unidade_id, titulo, descricao, categoria, severidade, responsavel, aberto_por)
  VALUES (v_org, p_unidade, btrim(p_titulo), nullif(btrim(coalesce(p_descricao, '')), ''), p_categoria, p_severidade,
          nullif(btrim(coalesce(p_responsavel, '')), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  INSERT INTO public.chamados_tecnicos_andamento (chamado_id, situacao, nota, autor_id)
  VALUES (v_id, 'aberto', nullif(btrim(coalesce(p_descricao, '')), ''), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('abrir_chamado_tecnico', 'chamados_tecnicos', v_id, p_unidade,
    jsonb_build_object('categoria', p_categoria, 'severidade', p_severidade));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.abrir_chamado_tecnico(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_chamado_tecnico(uuid, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_chamado_tecnico(
  p_id uuid, p_situacao text, p_nota text DEFAULT NULL, p_responsavel text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.chamados_tecnicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.chamados_tecnicos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.admin_do_chamado(c.organizacao_id) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador.';
  END IF;
  IF p_situacao NOT IN ('aberto', 'em_atendimento', 'aguardando_unidade', 'planejado', 'resolvido') THEN
    RAISE EXCEPTION 'Situação inválida.';
  END IF;
  IF p_situacao = c.situacao AND nullif(btrim(coalesce(p_nota, '')), '') IS NULL
     AND coalesce(nullif(btrim(coalesce(p_responsavel, '')), ''), c.responsavel, '') = coalesce(c.responsavel, '') THEN
    RAISE EXCEPTION 'Nada mudou: troque a situação, o responsável ou escreva uma nota.';
  END IF;
  IF p_situacao = 'resolvido' AND length(btrim(coalesce(p_nota, ''))) < 5 THEN
    RAISE EXCEPTION 'Para resolver, diga o que foi feito (mínimo de 5 letras).';
  END IF;
  UPDATE public.chamados_tecnicos
     SET situacao = p_situacao,
         responsavel = coalesce(nullif(btrim(coalesce(p_responsavel, '')), ''), responsavel),
         atualizado_em = now(),
         resolvido_em = CASE WHEN p_situacao = 'resolvido' THEN now() END,
         resolvido_por = CASE WHEN p_situacao = 'resolvido' THEN private.meu_perfil_id() END
   WHERE id = p_id;
  INSERT INTO public.chamados_tecnicos_andamento (chamado_id, situacao, nota, autor_id)
  VALUES (p_id, p_situacao, nullif(btrim(coalesce(p_nota, '')), ''), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('atualizar_chamado_tecnico', 'chamados_tecnicos', p_id, c.unidade_id,
    jsonb_build_object('de', c.situacao, 'para', p_situacao));
END $$;
REVOKE ALL ON FUNCTION public.atualizar_chamado_tecnico(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_chamado_tecnico(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.andamento_chamado_tecnico(p_id uuid)
RETURNS TABLE (id uuid, situacao text, nota text, autor text, em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT EXISTS (SELECT 1 FROM public.chamados_tecnicos c WHERE c.id = p_id AND private.admin_do_chamado(c.organizacao_id)) THEN
    RAISE EXCEPTION 'Acesso negado: chamado técnico é do administrador.';
  END IF;
  RETURN QUERY
  SELECT a.id, a.situacao, a.nota, p.nome_completo, a.em
    FROM public.chamados_tecnicos_andamento a
    LEFT JOIN public.perfis p ON p.id = a.autor_id
   WHERE a.chamado_id = p_id
   ORDER BY a.em DESC;
END $$;
REVOKE ALL ON FUNCTION public.andamento_chamado_tecnico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.andamento_chamado_tecnico(uuid) TO authenticated;

-- ── 2. unidades da rede, para Rede e Plataformas ────────────────────────────
-- Sessão em uso: renovada nos últimos 30 minutos (o JWT dura 15 e o app
-- renova sozinho enquanto a aba está aberta). Conta PESSOAS com vínculo ativo
-- na unidade — quem tem vínculo em duas unidades conta nas duas.
CREATE OR REPLACE FUNCTION private.sessao_em_uso_desde()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT now() - interval '30 minutes' $$;

CREATE OR REPLACE FUNCTION public.admin_unidades()
RETURNS TABLE (unidade_id uuid, nome text, tipo text, municipio text, uf text,
               leitos bigint, leitos_ocupados bigint, taxa_ocupacao numeric, em_plantao bigint,
               sessoes_ativas bigint, ultimo_uso timestamptz,
               chamados_abertos bigint, chamados_alta bigint,
               rnds_pendentes bigint, rnds_erro bigint, rnds_mais_antigo timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'Acesso negado: tela do administrador.';
  END IF;
  RETURN QUERY
  WITH u AS (
    SELECT un.id, un.nome, un.tipo::text AS tipo, un.municipio, un.uf FROM public.unidades un
     WHERE un.ativo AND (private.eh_super_admin() OR un.id IN (SELECT private.unidades_admin()))
  ), s AS (
    SELECT v.unidade_id,
           count(DISTINCT se.user_id) FILTER (WHERE coalesce(se.refreshed_at AT TIME ZONE 'UTC', se.updated_at, se.created_at) > private.sessao_em_uso_desde()) AS ativas,
           max(coalesce(se.refreshed_at AT TIME ZONE 'UTC', se.updated_at, se.created_at)) AS ultimo
      FROM public.vinculos v
      JOIN auth.sessions se ON se.user_id = v.perfil_id AND (se.not_after IS NULL OR se.not_after > now())
     WHERE v.ativo AND v.unidade_id IN (SELECT id FROM u)
     GROUP BY v.unidade_id
  ), c AS (
    SELECT u.id, u.nome, u.tipo, u.municipio, u.uf,
      (SELECT count(*) FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id WHERE st.unidade_id = u.id AND st.ativo AND l.ativo) AS leitos,
      (SELECT count(*) FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id WHERE st.unidade_id = u.id AND st.ativo AND l.ativo AND l.status = 'ocupado') AS ocupados,
      (SELECT count(DISTINCT pp.perfil_id) FROM public.presenca_plantonista pp WHERE pp.unidade_id = u.id AND pp.checkin_em > now() - interval '36 hours'
          AND pp.checkin_em IS NOT NULL AND pp.checkout_em IS NULL) AS plantao,
      (SELECT count(*) FROM public.chamados_tecnicos ch WHERE ch.unidade_id = u.id AND ch.situacao <> 'resolvido') AS abertos,
      (SELECT count(*) FROM public.chamados_tecnicos ch WHERE ch.unidade_id = u.id AND ch.situacao <> 'resolvido' AND ch.severidade = 'alta') AS alta,
      (SELECT count(*) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status = 'pendente') AS pend,
      (SELECT count(*) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status = 'erro') AS erro,
      (SELECT min(o.created_at) FROM public.interop_outbox o WHERE o.unidade_id = u.id AND o.status IN ('pendente', 'erro')) AS antigo
    FROM u
  )
  SELECT c.id, c.nome, c.tipo, c.municipio, c.uf,
         private.suprimir(c.leitos), private.suprimir(c.ocupados),
         CASE WHEN private.suprimir(c.leitos) IS NOT NULL AND private.suprimir(c.ocupados) IS NOT NULL AND c.leitos > 0
              THEN round(100.0 * c.ocupados / c.leitos, 1) END,
         c.plantao,  -- profissionais: sem supressão
         coalesce(s.ativas, 0), s.ultimo,
         c.abertos, c.alta, c.pend, c.erro, c.antigo
    FROM c LEFT JOIN s ON s.unidade_id = c.id
   ORDER BY c.nome;
END $$;
REVOKE ALL ON FUNCTION public.admin_unidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unidades() TO authenticated;

-- ── 3. servidores: o que o banco mede de si mesmo ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_servidores()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_super boolean := private.eh_super_admin();
  v_unidades uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (v_super OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'Acesso negado: tela do administrador.';
  END IF;
  SELECT array_agg(un.id) INTO v_unidades FROM public.unidades un
   WHERE un.ativo AND (v_super OR un.id IN (SELECT private.unidades_admin()));
  v_unidades := coalesce(v_unidades, '{}');
  RETURN jsonb_build_object(
    'servidor', now(),
    'banco', jsonb_build_object(
      'tamanho_bytes', pg_database_size(current_database()),
      'conexoes', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()),
      'conexoes_max', current_setting('max_connections')::int),
    'sessoes', (SELECT count(DISTINCT se.user_id) FROM auth.sessions se
                  JOIN public.vinculos v ON v.perfil_id = se.user_id AND v.ativo AND v.unidade_id = ANY (v_unidades)
                 WHERE (se.not_after IS NULL OR se.not_after > now())
                   AND coalesce(se.refreshed_at AT TIME ZONE 'UTC', se.updated_at, se.created_at) > private.sessao_em_uso_desde()),
    'rnds', (SELECT jsonb_build_object(
               'pendentes', count(*) FILTER (WHERE o.status = 'pendente'),
               'erro', count(*) FILTER (WHERE o.status = 'erro'),
               'enviados_24h', count(*) FILTER (WHERE o.status = 'enviado' AND o.enviado_em > now() - interval '24 hours'),
               'mais_antigo', min(o.created_at) FILTER (WHERE o.status IN ('pendente', 'erro')))
               FROM public.interop_outbox o WHERE o.unidade_id = ANY (v_unidades)),
    -- arquivos: a pasta de cima é a unidade (atendimento, banners, painel);
    -- o super admin vê todos os buckets inteiros
    'armazenamento', coalesce((
      SELECT jsonb_agg(jsonb_build_object('bucket', b.bucket_id, 'arquivos', b.n, 'bytes', b.bytes) ORDER BY b.bytes DESC)
        FROM (SELECT ob.bucket_id, count(*) AS n, coalesce(sum((ob.metadata ->> 'size')::bigint), 0) AS bytes
                FROM storage.objects ob
               WHERE v_super OR (substring(ob.name FROM '^([0-9a-f-]{36})/') IS NOT NULL
                                 AND substring(ob.name FROM '^([0-9a-f-]{36})/')::uuid = ANY (v_unidades))
               GROUP BY ob.bucket_id) b), '[]'::jsonb),
    'push', (SELECT count(DISTINCT ps.id) FROM public.push_subscriptions ps
               JOIN public.vinculos v ON v.perfil_id = ps.perfil_id AND v.ativo AND v.unidade_id = ANY (v_unidades)),
    'auditoria', (SELECT jsonb_build_object('ultima_em', max(l.created_at),
                                            'registros_24h', count(*) FILTER (WHERE l.created_at > now() - interval '24 hours'))
                    FROM public.log_auditoria l WHERE v_super OR l.unidade_id = ANY (v_unidades)));
END $$;
REVOKE ALL ON FUNCTION public.admin_servidores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_servidores() TO authenticated;

-- ── 4. propaganda do painel da TV ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.painel_config (
  unidade_id      uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  rotulo          text NOT NULL DEFAULT 'Informe da unidade' CHECK (length(btrim(rotulo)) BETWEEN 2 AND 60),
  segundos        integer NOT NULL DEFAULT 12 CHECK (segundos BETWEEN 4 AND 60),
  atualizado_por  uuid REFERENCES public.perfis(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.painel_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.painel_config FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.painel_propagandas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  caminho     text NOT NULL UNIQUE,
  titulo      text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 2 AND 120),  -- texto alternativo da arte
  ordem       integer NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  criado_por  uuid NOT NULL REFERENCES public.perfis(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT painel_propagandas_pasta CHECK (starts_with(caminho, unidade_id::text || '/'))
);
CREATE INDEX IF NOT EXISTS painel_propagandas_unidade ON public.painel_propagandas (unidade_id, ordem);
ALTER TABLE public.painel_propagandas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.painel_propagandas FROM PUBLIC, anon, authenticated;

-- arte institucional, lida pela TV sem login: bucket público, pasta da unidade
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('painel', 'painel', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit,
                               allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION private.gestor_da_pasta(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin()
      OR (substring(p_nome FROM '^([0-9a-f-]{36})/') IS NOT NULL
          AND private.tenho_papel(substring(p_nome FROM '^([0-9a-f-]{36})/')::uuid, 'gestor'))
$$;

DROP POLICY IF EXISTS painel_storage_upload ON storage.objects;
CREATE POLICY painel_storage_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'painel' AND private.gestor_da_pasta(name));
-- o Storage só apaga o que a pessoa consegue ler: o gestor lê a própria pasta
DROP POLICY IF EXISTS painel_storage_select ON storage.objects;
CREATE POLICY painel_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'painel' AND private.gestor_da_pasta(name));
DROP POLICY IF EXISTS painel_storage_delete ON storage.objects;
CREATE POLICY painel_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'painel' AND private.gestor_da_pasta(name));

CREATE OR REPLACE FUNCTION private.pode_editar_painel(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor')
$$;

-- a propaganda como a unidade vê (Recepção e gestor): também as inativas
CREATE OR REPLACE FUNCTION public.painel_propaganda(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.membro_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN jsonb_build_object(
    'rotulo', coalesce((SELECT rotulo FROM public.painel_config WHERE unidade_id = p_unidade), 'Informe da unidade'),
    'segundos', coalesce((SELECT segundos FROM public.painel_config WHERE unidade_id = p_unidade), 12),
    'posso_editar', private.pode_editar_painel(p_unidade),
    'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'titulo', a.titulo,
                                                           'ativo', a.ativo, 'ordem', a.ordem) ORDER BY a.ordem, a.criado_em)
                         FROM public.painel_propagandas a WHERE a.unidade_id = p_unidade), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.painel_propaganda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_propaganda(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_painel_config(p_unidade uuid, p_rotulo text, p_segundos integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_editar_painel(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a propaganda do painel é do gestor.';
  END IF;
  IF length(btrim(coalesce(p_rotulo, ''))) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Rótulo da propaganda: de 2 a 60 letras.';
  END IF;
  IF p_segundos IS NULL OR p_segundos NOT BETWEEN 4 AND 60 THEN
    RAISE EXCEPTION 'Tempo de cada arte: de 4 a 60 segundos.';
  END IF;
  INSERT INTO public.painel_config (unidade_id, rotulo, segundos, atualizado_por, atualizado_em)
  VALUES (p_unidade, btrim(p_rotulo), p_segundos, private.meu_perfil_id(), now())
  ON CONFLICT (unidade_id) DO UPDATE SET rotulo = EXCLUDED.rotulo, segundos = EXCLUDED.segundos,
    atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
  PERFORM private.registrar_auditoria('salvar_painel_config', 'painel_config', p_unidade, p_unidade,
    jsonb_build_object('segundos', p_segundos));
END $$;
REVOKE ALL ON FUNCTION public.salvar_painel_config(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_painel_config(uuid, text, integer) TO authenticated;

-- a arte já subiu para o bucket (pasta da unidade); aqui ela entra no rodízio
CREATE OR REPLACE FUNCTION public.adicionar_propaganda(p_unidade uuid, p_caminho text, p_titulo text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_editar_painel(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a propaganda do painel é do gestor.';
  END IF;
  IF NOT starts_with(coalesce(p_caminho, ''), p_unidade::text || '/') THEN
    RAISE EXCEPTION 'A arte precisa estar na pasta da unidade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'painel' AND name = p_caminho) THEN
    RAISE EXCEPTION 'Arte não encontrada: envie a imagem de novo.';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) < 2 THEN
    RAISE EXCEPTION 'Descreva a arte (texto para quem não enxerga a tela).';
  END IF;
  IF (SELECT count(*) FROM public.painel_propagandas WHERE unidade_id = p_unidade) >= 12 THEN
    RAISE EXCEPTION 'Limite de 12 artes por unidade: remova uma antes.';
  END IF;
  INSERT INTO public.painel_propagandas (unidade_id, caminho, titulo, ordem, criado_por)
  VALUES (p_unidade, p_caminho, btrim(p_titulo),
          coalesce((SELECT max(ordem) + 1 FROM public.painel_propagandas WHERE unidade_id = p_unidade), 0),
          private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('adicionar_propaganda', 'painel_propagandas', v_id, p_unidade, NULL);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.adicionar_propaganda(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_propaganda(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_propaganda(p_id uuid, p_titulo text, p_ativo boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.painel_propagandas WHERE id = p_id;
  IF v_unidade IS NULL OR NOT private.pode_editar_painel(v_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a propaganda do painel é do gestor.';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) < 2 THEN
    RAISE EXCEPTION 'Descreva a arte (texto para quem não enxerga a tela).';
  END IF;
  UPDATE public.painel_propagandas SET titulo = btrim(p_titulo), ativo = coalesce(p_ativo, ativo) WHERE id = p_id;
  PERFORM private.registrar_auditoria('atualizar_propaganda', 'painel_propagandas', p_id, v_unidade,
    jsonb_build_object('ativo', p_ativo));
END $$;
REVOKE ALL ON FUNCTION public.atualizar_propaganda(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_propaganda(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.reordenar_propagandas(p_unidade uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_editar_painel(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a propaganda do painel é do gestor.';
  END IF;
  UPDATE public.painel_propagandas a SET ordem = x.i - 1
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, i)
   WHERE a.id = x.id AND a.unidade_id = p_unidade;
END $$;
REVOKE ALL ON FUNCTION public.reordenar_propagandas(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_propagandas(uuid, uuid[]) TO authenticated;

-- tira do rodízio e devolve o caminho: quem chamou apaga o arquivo do bucket
CREATE OR REPLACE FUNCTION public.remover_propaganda(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.painel_propagandas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.painel_propagandas WHERE id = p_id;
  IF NOT FOUND OR NOT private.pode_editar_painel(a.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: a propaganda do painel é do gestor.';
  END IF;
  DELETE FROM public.painel_propagandas WHERE id = p_id;
  PERFORM private.registrar_auditoria('remover_propaganda', 'painel_propagandas', p_id, a.unidade_id, NULL);
  RETURN a.caminho;
END $$;
REVOKE ALL ON FUNCTION public.remover_propaganda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_propaganda(uuid) TO authenticated;

-- ── 5. o que a TV lê ────────────────────────────────────────────────────────
-- Mesmo recorte de antes (8 horas, 8 chamadas, nome de exibição e sala) e
-- mais: quem chamou (nome do profissional), a vez da chamada daquela etapa
-- (2ª em diante = "Chamando novamente") e as artes ativas da unidade.
CREATE OR REPLACE FUNCTION public.painel_chamadas(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_setor uuid;
  v_unidade uuid;
BEGIN
  SELECT setor_id INTO v_setor FROM private.paineis
   WHERE token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  IF v_setor IS NULL THEN RAISE EXCEPTION 'PAINEL_INVALIDO'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = v_setor;
  RETURN jsonb_build_object(
    'porta', (SELECT s.nome FROM public.setores s WHERE s.id = v_setor),
    'unidade', (SELECT u.nome FROM public.unidades u WHERE u.id = v_unidade),
    'servidor', now(),
    'chamadas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', coalesce(nullif(p.nome_social, ''), p.nome),
                                          'sala', sa.nome, 'em', c.criado_em, 'vez', c.numero,
                                          'quem', pf.nome_completo) ORDER BY c.criado_em DESC, c.numero DESC)
      FROM (SELECT * FROM public.chamadas WHERE setor_id = v_setor AND criado_em > now() - interval '8 hours'
            ORDER BY criado_em DESC, numero DESC LIMIT 8) c
      JOIN public.episodios e ON e.id = c.episodio_id
      JOIN public.pacientes p ON p.id = e.paciente_id
      JOIN public.salas sa ON sa.id = c.sala_id
      LEFT JOIN public.perfis pf ON pf.id = c.chamado_por), '[]'::jsonb),
    'propaganda', jsonb_build_object(
      'rotulo', coalesce((SELECT rotulo FROM public.painel_config WHERE unidade_id = v_unidade), 'Informe da unidade'),
      'segundos', coalesce((SELECT segundos FROM public.painel_config WHERE unidade_id = v_unidade), 12),
      'itens', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'caminho', a.caminho, 'titulo', a.titulo)
                                          ORDER BY a.ordem, a.criado_em)
                           FROM public.painel_propagandas a WHERE a.unidade_id = v_unidade AND a.ativo), '[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.painel_chamadas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.painel_chamadas(text) TO anon, authenticated;
