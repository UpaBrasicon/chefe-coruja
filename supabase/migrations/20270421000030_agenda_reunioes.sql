-- ════════════════════════════════════════════════════════════════════════════
-- Agenda do administrador (pedido do RT, 24/11/2026): no perfil Administrador a
-- aba "Escala" vira "Agenda", para organizar o dia a dia e marcar reuniões.
-- Decisão do RT (v1): o link da reunião é COLADO (Meet, Zoom, Teams ou outra
-- plataforma); não há integração com Google nem Microsoft. Os convidados são
-- avisados no app (notificacoes_plantonista, a mesma lista de /notificacoes).
-- E-mail fica para depois: não há função de e-mail genérica no projeto.
--
-- • public.reunioes: uma linha por reunião, da organização do administrador.
-- • public.reuniao_convidados: quem foi convidado (pessoas da organização).
--   Leitura (RLS): quem marcou e os convidados. Escrita: só pelas funções.
-- • salvar_reuniao (nova ou editada), cancelar_reuniao: só o administrador da
--   organização (ou o super admin), e na editada só quem marcou. O link só
--   aceita https://. Avisa os convidados novos, os mantidos (se mudou o
--   horário, o título ou o link) e os retirados; o cancelamento avisa todos.
-- • minhas_reunioes: a agenda de quem marcou ou foi convidado, por período.
-- • pessoas_para_reuniao: busca de convidados na organização (nome, papéis e
--   unidades; sem e-mail nem documento).
--
-- Expand: duas tabelas e funções novas; nada existente muda. Idempotente.
-- Volta: docs/agenda/ROLLBACK-20270421000030.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── link da reunião: só https, com endereço de verdade ─────────────────────
CREATE OR REPLACE FUNCTION private.link_reuniao_ok(p_link text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_link IS NOT NULL
     AND length(p_link) <= 500
     AND p_link ~* '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]<>"]*)?$'
$$;
REVOKE ALL ON FUNCTION private.link_reuniao_ok(text) FROM PUBLIC, anon;
-- função pura, usada também no CHECK da tabela
GRANT EXECUTE ON FUNCTION private.link_reuniao_ok(text) TO authenticated, service_role;

-- a plataforma pelo endereço (a tela reconhece do mesmo jeito: src/domain/reuniao.ts)
CREATE OR REPLACE FUNCTION private.plataforma_reuniao(p_link text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_link IS NULL THEN NULL
    WHEN p_link ~* '^https://meet\.google\.com([/?#:]|$)' THEN 'Google Meet'
    WHEN p_link ~* '^https://([a-z0-9-]+\.)*zoom\.(us|com)([/?#:]|$)' THEN 'Zoom'
    WHEN p_link ~* '^https://(teams\.microsoft\.com|teams\.live\.com)([/?#:]|$)' THEN 'Microsoft Teams'
    ELSE 'Outra plataforma'
  END
$$;
REVOKE ALL ON FUNCTION private.plataforma_reuniao(text) FROM PUBLIC, anon, authenticated;

-- ── tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reunioes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  criado_por     uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  titulo         text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 120),
  inicio         timestamptz NOT NULL,
  fim            timestamptz NOT NULL,
  link           text CHECK (link IS NULL OR private.link_reuniao_ok(link)),
  pauta          text CHECK (pauta IS NULL OR length(pauta) <= 2000),
  cancelada_em   timestamptz,
  criada_em      timestamptz NOT NULL DEFAULT now(),
  alterada_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reunioes_horario CHECK (fim > inicio AND fim - inicio <= interval '12 hours')
);
COMMENT ON TABLE public.reunioes IS
  'Agenda do administrador (pedido do RT, 24/11/2026): reuniões da organização com o link colado (só https). Leem quem marcou e os convidados; escrita só por salvar_reuniao e cancelar_reuniao.';
CREATE INDEX IF NOT EXISTS reunioes_criado_por_inicio ON public.reunioes (criado_por, inicio);
CREATE INDEX IF NOT EXISTS reunioes_organizacao_inicio ON public.reunioes (organizacao_id, inicio);

CREATE TABLE IF NOT EXISTS public.reuniao_convidados (
  reuniao_id   uuid NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  perfil_id    uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  convidado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reuniao_id, perfil_id)
);
COMMENT ON TABLE public.reuniao_convidados IS
  'Convidados de cada reunião da agenda do administrador (pessoas da organização). Leem quem marcou e os convidados da mesma reunião.';
CREATE INDEX IF NOT EXISTS reuniao_convidados_perfil ON public.reuniao_convidados (perfil_id);

-- quem marcou ou foi convidado (definer: a política de uma tabela não lê a outra pela RLS)
CREATE OR REPLACE FUNCTION private.reuniao_visivel(p_reuniao uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.reunioes r
                  WHERE r.id = p_reuniao AND r.criado_por = private.meu_perfil_id())
      OR EXISTS (SELECT 1 FROM public.reuniao_convidados c
                  WHERE c.reuniao_id = p_reuniao AND c.perfil_id = private.meu_perfil_id())
$$;
REVOKE ALL ON FUNCTION private.reuniao_visivel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.reuniao_visivel(uuid) TO authenticated;

ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniao_convidados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reunioes, public.reuniao_convidados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reunioes, public.reuniao_convidados TO authenticated;

DROP POLICY IF EXISTS reunioes_ler ON public.reunioes;
CREATE POLICY reunioes_ler ON public.reunioes
  FOR SELECT TO authenticated
  USING (criado_por = private.meu_perfil_id() OR private.reuniao_visivel(id));

DROP POLICY IF EXISTS reuniao_convidados_ler ON public.reuniao_convidados;
CREATE POLICY reuniao_convidados_ler ON public.reuniao_convidados
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.reuniao_visivel(reuniao_id));

-- ── quem organiza e quem pode ser convidado ────────────────────────────────
CREATE OR REPLACE FUNCTION private.pode_organizar_reuniao(p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_org IS NOT NULL
     AND (p_org IN (SELECT private.orgs_admin()) OR coalesce(private.eh_super_admin(), false))
$$;
REVOKE ALL ON FUNCTION private.pode_organizar_reuniao(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.pessoa_na_organizacao(p_perfil uuid, p_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v
                   JOIN public.unidades u ON u.id = v.unidade_id
                  WHERE v.perfil_id = p_perfil AND v.ativo AND u.ativo AND u.organizacao_id = p_org)
$$;
REVOKE ALL ON FUNCTION private.pessoa_na_organizacao(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── aviso no app (a mesma lista de /notificacoes) ──────────────────────────
-- Um aviso por unidade da pessoa na organização: o aviso aparece na unidade em
-- que ela estiver. O tipo leva o instante, para o segundo aviso do dia não se
-- perder no ON CONFLICT de private.avisar.
CREATE OR REPLACE FUNCTION private.reuniao_avisar(p_reuniao uuid, p_perfis uuid[], p_acao text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reunioes%ROWTYPE;
  v_quem text;
  v_quando text;
  v_onde text;
  v_msg text;
  v_tipo text;
  x record;
BEGIN
  IF p_perfis IS NULL OR cardinality(p_perfis) = 0 THEN RETURN; END IF;
  SELECT * INTO r FROM public.reunioes WHERE id = p_reuniao;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT coalesce(nullif(btrim(p.nome_completo), ''), 'a administração') INTO v_quem
    FROM public.perfis p WHERE p.id = r.criado_por;
  v_quando := to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ', das '
           || to_char(r.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' às '
           || to_char(r.fim AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' (horário de Brasília)';
  v_onde := CASE WHEN r.link IS NULL THEN '' ELSE '. ' || private.plataforma_reuniao(r.link) || ': ' || r.link END;
  v_msg := CASE p_acao
    WHEN 'convite'   THEN 'Convite para reunião: ' || r.titulo || ', ' || v_quando || v_onde || '. Marcada por ' || coalesce(v_quem, 'a administração') || '.'
    WHEN 'alterada'  THEN 'Reunião alterada: ' || r.titulo || ', agora ' || v_quando || v_onde || '.'
    WHEN 'cancelada' THEN 'Reunião cancelada: ' || r.titulo || ', que seria em ' || v_quando || '.'
    WHEN 'retirado'  THEN 'Você não está mais na lista da reunião ' || r.titulo || ', de ' || v_quando || '.'
  END;
  IF v_msg IS NULL THEN RETURN; END IF;
  v_tipo := 'reuniao_' || p_acao || '_' || r.id::text || '_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;
  FOR x IN
    SELECT DISTINCT v.perfil_id, v.unidade_id
      FROM public.vinculos v
      JOIN public.unidades u ON u.id = v.unidade_id
     WHERE v.perfil_id = ANY (p_perfis) AND v.ativo AND u.ativo AND u.organizacao_id = r.organizacao_id
  LOOP
    PERFORM private.avisar(x.perfil_id, x.unidade_id, NULL, v_tipo, v_msg);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.reuniao_avisar(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

-- ── salvar (nova ou editada) ────────────────────────────────────────────────
-- p_unidade: a unidade em que o administrador está; dela sai a organização.
-- p_data + p_inicio/p_fim: dia e horas de Brasília.
CREATE OR REPLACE FUNCTION public.salvar_reuniao(
  p_id uuid, p_unidade uuid, p_titulo text, p_data date, p_inicio time, p_fim time,
  p_link text, p_pauta text, p_convidados uuid[])
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_org uuid;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_pauta text := nullif(btrim(coalesce(p_pauta, '')), '');
  v_ini timestamptz;
  v_fim timestamptz;
  v_conv uuid[];
  v_antes uuid[] := '{}';
  v_mudou boolean := false;
  r public.reunioes%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: a agenda de reuniões é do administrador.' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade AND u.ativo;
  ELSE
    SELECT * INTO r FROM public.reunioes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR r.criado_por <> v_eu THEN RAISE EXCEPTION 'Reunião não encontrada.'; END IF;
    IF r.cancelada_em IS NOT NULL THEN RAISE EXCEPTION 'A reunião foi cancelada. Marque outra.'; END IF;
    v_org := r.organizacao_id;
  END IF;
  IF NOT private.pode_organizar_reuniao(v_org) THEN
    RAISE EXCEPTION 'Acesso negado: a agenda de reuniões é do administrador.' USING ERRCODE = '42501';
  END IF;

  IF length(v_titulo) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Dê um título à reunião (de 3 a 120 letras).';
  END IF;
  IF p_data IS NULL OR p_inicio IS NULL OR p_fim IS NULL THEN
    RAISE EXCEPTION 'Informe o dia, o início e o fim da reunião.';
  END IF;
  v_ini := (p_data + p_inicio) AT TIME ZONE 'America/Sao_Paulo';
  v_fim := (p_data + p_fim) AT TIME ZONE 'America/Sao_Paulo';
  IF v_fim <= v_ini THEN RAISE EXCEPTION 'O fim tem de ser depois do início.'; END IF;
  IF v_fim - v_ini > interval '12 hours' THEN RAISE EXCEPTION 'A reunião pode durar até 12 horas.'; END IF;
  IF p_id IS NULL AND v_fim <= now() THEN RAISE EXCEPTION 'Esse horário já passou.'; END IF;
  IF v_link IS NOT NULL AND NOT private.link_reuniao_ok(v_link) THEN
    RAISE EXCEPTION 'Cole o endereço completo da reunião, começando com https://.';
  END IF;
  IF v_pauta IS NOT NULL AND length(v_pauta) > 2000 THEN
    RAISE EXCEPTION 'A pauta pode ter até 2.000 letras.';
  END IF;

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_conv
    FROM unnest(coalesce(p_convidados, '{}'::uuid[])) x
   WHERE x IS NOT NULL AND x <> v_eu;
  IF cardinality(v_conv) > 50 THEN RAISE EXCEPTION 'Convide até 50 pessoas por reunião.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_conv) x WHERE NOT private.pessoa_na_organizacao(x, v_org)) THEN
    RAISE EXCEPTION 'Só pessoas da organização podem ser convidadas.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.reunioes (organizacao_id, criado_por, titulo, inicio, fim, link, pauta)
    VALUES (v_org, v_eu, v_titulo, v_ini, v_fim, v_link, v_pauta)
    RETURNING id INTO v_id;
  ELSE
    v_id := p_id;
    v_mudou := r.titulo IS DISTINCT FROM v_titulo OR r.inicio IS DISTINCT FROM v_ini
            OR r.fim IS DISTINCT FROM v_fim OR r.link IS DISTINCT FROM v_link;
    SELECT coalesce(array_agg(c.perfil_id), '{}') INTO v_antes FROM public.reuniao_convidados c WHERE c.reuniao_id = v_id;
    UPDATE public.reunioes
       SET titulo = v_titulo, inicio = v_ini, fim = v_fim, link = v_link, pauta = v_pauta, alterada_em = now()
     WHERE id = v_id;
    DELETE FROM public.reuniao_convidados c WHERE c.reuniao_id = v_id AND NOT (c.perfil_id = ANY (v_conv));
  END IF;
  INSERT INTO public.reuniao_convidados (reuniao_id, perfil_id)
  SELECT v_id, x FROM unnest(v_conv) x
  ON CONFLICT (reuniao_id, perfil_id) DO NOTHING;

  -- avisos: novos recebem o convite; os mantidos, a mudança; os retirados, a saída
  PERFORM private.reuniao_avisar(v_id, ARRAY(SELECT x FROM unnest(v_conv) x WHERE NOT (x = ANY (v_antes))), 'convite');
  IF v_mudou THEN
    PERFORM private.reuniao_avisar(v_id, ARRAY(SELECT x FROM unnest(v_conv) x WHERE x = ANY (v_antes)), 'alterada');
  END IF;
  PERFORM private.reuniao_avisar(v_id, ARRAY(SELECT x FROM unnest(v_antes) x WHERE NOT (x = ANY (v_conv))), 'retirado');

  PERFORM private.registrar_auditoria(CASE WHEN p_id IS NULL THEN 'reuniao_criada' ELSE 'reuniao_alterada' END,
    'reunioes', v_id, NULL, jsonb_build_object('quantidade', cardinality(v_conv)));
  RETURN v_id;
END $$;

-- ── cancelar ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_reuniao(p_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reunioes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.reunioes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR private.meu_perfil_id() IS NULL OR r.criado_por <> private.meu_perfil_id() THEN
    RAISE EXCEPTION 'Reunião não encontrada.';
  END IF;
  IF NOT private.pode_organizar_reuniao(r.organizacao_id) THEN
    RAISE EXCEPTION 'Acesso negado: a agenda de reuniões é do administrador.' USING ERRCODE = '42501';
  END IF;
  IF r.cancelada_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.reunioes SET cancelada_em = now(), alterada_em = now() WHERE id = p_id;
  PERFORM private.reuniao_avisar(p_id,
    ARRAY(SELECT c.perfil_id FROM public.reuniao_convidados c WHERE c.reuniao_id = p_id), 'cancelada');
  PERFORM private.registrar_auditoria('reuniao_cancelada', 'reunioes', p_id, NULL, jsonb_build_object('situacao', 'cancelada'));
END $$;

-- ── a agenda: o que marquei e para o que fui convidado ─────────────────────
CREATE OR REPLACE FUNCTION public.minhas_reunioes(p_de date, p_ate date)
RETURNS TABLE (id uuid, titulo text, inicio timestamptz, fim timestamptz, link text, plataforma text, pauta text,
               cancelada boolean, sou_criador boolean, criador_nome text, convidados jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  IF p_de IS NULL OR p_ate IS NULL OR p_ate < p_de OR p_ate - p_de > 62 THEN
    RAISE EXCEPTION 'Período inválido (até 62 dias).';
  END IF;
  RETURN QUERY
  SELECT r.id, r.titulo, r.inicio, r.fim, r.link, private.plataforma_reuniao(r.link), r.pauta,
         r.cancelada_em IS NOT NULL, r.criado_por = v_eu, p.nome_completo,
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.perfil_id, 'nome', pc.nome_completo) ORDER BY pc.nome_completo)
                     FROM public.reuniao_convidados c JOIN public.perfis pc ON pc.id = c.perfil_id
                    WHERE c.reuniao_id = r.id), '[]'::jsonb)
    FROM public.reunioes r
    JOIN public.perfis p ON p.id = r.criado_por
   WHERE (r.criado_por = v_eu
          OR EXISTS (SELECT 1 FROM public.reuniao_convidados c WHERE c.reuniao_id = r.id AND c.perfil_id = v_eu))
     AND r.inicio >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND r.inicio < ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
   ORDER BY r.inicio, r.titulo;
END $$;

-- ── busca de convidados na organização ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pessoas_para_reuniao(p_unidade uuid, p_busca text)
RETURNS TABLE (perfil_id uuid, nome text, papeis text[], unidades text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org uuid;
  v_busca text := btrim(coalesce(p_busca, ''));
BEGIN
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade AND u.ativo;
  IF private.meu_perfil_id() IS NULL OR NOT private.pode_organizar_reuniao(v_org) THEN
    RAISE EXCEPTION 'Acesso negado: a agenda de reuniões é do administrador.' USING ERRCODE = '42501';
  END IF;
  IF length(v_busca) < 2 THEN RETURN; END IF;
  v_busca := replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
  SELECT p.id, p.nome_completo,
         array_agg(DISTINCT v.papel::text ORDER BY v.papel::text),
         array_agg(DISTINCT u.nome ORDER BY u.nome)
    FROM public.perfis p
    JOIN public.vinculos v ON v.perfil_id = p.id AND v.ativo
    JOIN public.unidades u ON u.id = v.unidade_id AND u.ativo AND u.organizacao_id = v_org
   WHERE p.id <> private.meu_perfil_id()
     AND p.nome_completo ILIKE '%' || v_busca || '%'
   GROUP BY p.id, p.nome_completo
   ORDER BY p.nome_completo
   LIMIT 15;
END $$;

REVOKE ALL ON FUNCTION public.salvar_reuniao(uuid, uuid, text, date, time, time, text, text, uuid[]),
  public.cancelar_reuniao(uuid), public.minhas_reunioes(date, date), public.pessoas_para_reuniao(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_reuniao(uuid, uuid, text, date, time, time, text, text, uuid[]),
  public.cancelar_reuniao(uuid), public.minhas_reunioes(date, date), public.pessoas_para_reuniao(uuid, text)
  TO authenticated;
