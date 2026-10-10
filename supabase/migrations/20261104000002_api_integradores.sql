-- Fase 3, tarefa 7: API para integradores, com as decisões do RT de
-- 10/10/2026 no BACKLOG. O contrato está em docs/api/openapi.yaml.
--
-- • Chave por integrador:
--   - só o super admin cria, escolhendo as unidades e os recursos;
--   - o banco guarda só o SHA-256 da chave e o prefixo para mostrar;
--   - validade padrão de 12 meses; revogação imediata;
--   - lista opcional de IP/faixa de origem;
--   - limite por minuto (padrão 60) ajustável por chave.
--   O gestor vê as chaves que acessam a unidade dele e pode revogar.
-- • Uma porta só, public.api_v1:
--   - quem chama é a Edge Function `api`, com a chave secreta da plataforma
--     (GRANT só para service_role);
--   - confere chave, validade, IP, escopo e limite;
--   - registra a consulta em api_acessos (só inserção);
--   - devolve {status, corpo, limite}, e a Edge Function monta a resposta
--     HTTP no formato do contrato.
-- • Dados do paciente, o mínimo (LGPD): nome, nome social, nascimento, sexo,
--   CNS e município; CPF só sem CNS.
--
-- Só aditiva (expand).

-- ── tabelas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_chaves (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 120),
  ambiente          text NOT NULL CHECK (ambiente IN ('live', 'test')),
  prefixo           text NOT NULL,
  hash              text NOT NULL UNIQUE,
  unidades          uuid[] NOT NULL CHECK (cardinality(unidades) >= 1),
  recursos          text[] NOT NULL CHECK (cardinality(recursos) >= 1
                      AND recursos <@ ARRAY['pacientes', 'atendimentos', 'leitos', 'producao']::text[]),
  ips               cidr[] NOT NULL DEFAULT '{}',
  limite_por_minuto integer NOT NULL DEFAULT 60 CHECK (limite_por_minuto BETWEEN 1 AND 6000),
  criada_por        uuid NOT NULL REFERENCES public.perfis(id),
  criada_em         timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL,
  revogada_em       timestamptz,
  revogada_por      uuid REFERENCES public.perfis(id),
  motivo_revogacao  text,
  ultimo_uso_em     timestamptz,
  CHECK ((revogada_em IS NULL) = (motivo_revogacao IS NULL)),
  CHECK (expira_em > criada_em)
);
CREATE INDEX IF NOT EXISTS api_chaves_unidades ON public.api_chaves USING gin (unidades);

CREATE TABLE IF NOT EXISTS public.api_acessos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave_id   uuid REFERENCES public.api_chaves(id),
  recurso    text NOT NULL,
  unidade_id uuid,
  status     integer NOT NULL,
  ip         inet,
  requisicao text,
  em         timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS api_acessos_chave_em ON public.api_acessos (chave_id, em DESC);
DROP TRIGGER IF EXISTS trg_api_acessos_so_insercao ON public.api_acessos;
CREATE TRIGGER trg_api_acessos_so_insercao BEFORE UPDATE OR DELETE ON public.api_acessos
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

ALTER TABLE public.api_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_chaves, public.api_acessos FROM anon, authenticated;
-- leitura só pelas RPCs abaixo (o hash nunca sai do banco)

-- ── apoio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.api_hash(p_chave text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to(coalesce(p_chave, ''), 'UTF8'), 'sha256'), 'hex')
$$;
REVOKE ALL ON FUNCTION private.api_hash(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.gestor_de_alguma(p_unidades uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(p_unidades) u WHERE private.tenho_papel(u, 'gestor'))
$$;
REVOKE ALL ON FUNCTION private.gestor_de_alguma(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.gestor_de_alguma(uuid[]) TO authenticated;

-- ── administração das chaves (telas) ────────────────────────────────────────
-- Cria a chave e devolve o texto UMA vez; depois só o prefixo aparece.
CREATE OR REPLACE FUNCTION public.api_criar_chave(p_nome text, p_ambiente text, p_unidades uuid[], p_recursos text[],
  p_ips text[] DEFAULT '{}', p_limite integer DEFAULT 60, p_validade_meses integer DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_chave text; v_id uuid; v_ips cidr[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma cria chave de integração.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_ambiente NOT IN ('live', 'test') THEN RAISE EXCEPTION 'Ambiente: live (produção) ou test (homologação).'; END IF;
  IF p_validade_meses IS NULL OR p_validade_meses NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Validade de 1 a 12 meses.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_unidades) u WHERE NOT EXISTS (SELECT 1 FROM public.unidades x WHERE x.id = u AND x.ativo)) THEN
    RAISE EXCEPTION 'Unidade inexistente ou inativa na lista.';
  END IF;
  BEGIN
    v_ips := coalesce(p_ips, '{}')::cidr[];
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'IP ou faixa inválida (ex.: 200.10.20.30 ou 200.10.20.0/24).';
  END;
  v_chave := 'cc_' || p_ambiente || '_' || encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.api_chaves (nome, ambiente, prefixo, hash, unidades, recursos, ips, limite_por_minuto, criada_por, expira_em)
  VALUES (btrim(p_nome), p_ambiente, left(v_chave, 16), private.api_hash(v_chave), p_unidades, p_recursos, v_ips,
          coalesce(p_limite, 60), private.meu_perfil_id(), now() + make_interval(months => p_validade_meses))
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('api_chave_criada', 'api_chaves', v_id, p_unidades[1],
    jsonb_build_object('nome', btrim(p_nome), 'unidades', p_unidades, 'recursos', p_recursos));
  RETURN jsonb_build_object('id', v_id, 'chave', v_chave, 'prefixo', left(v_chave, 16));
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'Confira o nome (3 a 120 letras), os recursos (pacientes, atendimentos, leitos, producao) e o limite (1 a 6000 por minuto).';
END $$;
REVOKE ALL ON FUNCTION public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_criar_chave(text, text, uuid[], text[], text[], integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_chaves_lista()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'ambiente', c.ambiente, 'prefixo', c.prefixo,
      'unidades', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome), '[]'::jsonb)
                     FROM public.unidades u WHERE u.id = ANY (c.unidades)),
      'recursos', to_jsonb(c.recursos), 'ips', (SELECT coalesce(jsonb_agg(host(i) || CASE WHEN masklen(i) < 32 THEN '/' || masklen(i) ELSE '' END), '[]'::jsonb) FROM unnest(c.ips) i),
      'limite_por_minuto', c.limite_por_minuto,
      'criada_por', pc.nome_completo, 'criada_em', c.criada_em, 'expira_em', c.expira_em,
      'vence_em_dias', greatest(0, ceil(extract(epoch FROM c.expira_em - now()) / 86400)::int),
      'vencida', c.expira_em <= now(),
      'revogada_em', c.revogada_em, 'revogada_por', pr.nome_completo, 'motivo_revogacao', c.motivo_revogacao,
      'ultimo_uso_em', c.ultimo_uso_em,
      'acessos_24h', (SELECT count(*) FROM public.api_acessos a WHERE a.chave_id = c.id AND a.em > now() - interval '24 hours'),
      'pode_editar', private.eh_super_admin())
      ORDER BY (c.revogada_em IS NULL) DESC, c.expira_em)
    FROM public.api_chaves c
    LEFT JOIN public.perfis pc ON pc.id = c.criada_por
    LEFT JOIN public.perfis pr ON pr.id = c.revogada_por
   WHERE private.eh_super_admin() OR private.gestor_de_alguma(c.unidades)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.api_chaves_lista() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_chaves_lista() TO authenticated;

CREATE OR REPLACE FUNCTION public.api_revogar_chave(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.api_chaves;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.api_chaves WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave não encontrada.'; END IF;
  IF NOT (private.eh_super_admin() OR private.gestor_de_alguma(c.unidades)) THEN
    RAISE EXCEPTION 'Revoga a administração da plataforma ou o gestor de uma unidade da chave.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.revogada_em IS NOT NULL THEN RAISE EXCEPTION 'Esta chave já foi revogada.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.api_chaves SET revogada_em = now(), revogada_por = private.meu_perfil_id(), motivo_revogacao = btrim(p_motivo) WHERE id = c.id;
  PERFORM private.registrar_auditoria('api_chave_revogada', 'api_chaves', c.id, c.unidades[1], jsonb_build_object('nome', c.nome));
END $$;
REVOKE ALL ON FUNCTION public.api_revogar_chave(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_revogar_chave(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_ajustar_chave(p_id uuid, p_limite integer, p_ips text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.api_chaves; v_ips cidr[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só a administração da plataforma ajusta a chave.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO c FROM public.api_chaves WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.revogada_em IS NOT NULL THEN RAISE EXCEPTION 'Chave não encontrada ou revogada.'; END IF;
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 6000 THEN RAISE EXCEPTION 'Limite de 1 a 6000 por minuto.'; END IF;
  BEGIN
    v_ips := coalesce(p_ips, '{}')::cidr[];
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'IP ou faixa inválida (ex.: 200.10.20.30 ou 200.10.20.0/24).';
  END;
  UPDATE public.api_chaves SET limite_por_minuto = p_limite, ips = v_ips WHERE id = c.id;
  PERFORM private.registrar_auditoria('api_chave_ajustada', 'api_chaves', c.id, c.unidades[1],
    jsonb_build_object('limite_por_minuto', p_limite, 'ips', p_ips));
END $$;
REVOKE ALL ON FUNCTION public.api_ajustar_chave(uuid, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_ajustar_chave(uuid, integer, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.api_acessos_da_chave(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.api_chaves;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.api_chaves WHERE id = p_id;
  IF NOT FOUND OR NOT (private.eh_super_admin() OR private.gestor_de_alguma(c.unidades)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('recurso', a.recurso, 'unidade', u.nome, 'status', a.status,
      'ip', host(a.ip), 'requisicao', a.requisicao, 'em', a.em) ORDER BY a.em DESC)
    FROM (SELECT * FROM public.api_acessos WHERE chave_id = p_id ORDER BY em DESC LIMIT 200) a
    LEFT JOIN public.unidades u ON u.id = a.unidade_id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.api_acessos_da_chave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_acessos_da_chave(uuid) TO authenticated;

-- ── dados no formato do contrato ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.api_paciente(pa public.pacientes)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', pa.id, 'unidade_id', pa.unidade_id, 'nome', pa.nome, 'nome_social', pa.nome_social,
    'nascimento', pa.data_nascimento, 'sexo', CASE WHEN pa.sexo IN ('M', 'F') THEN pa.sexo END,
    'cns', CASE WHEN private.cns_valido(pa.cns) THEN pa.cns END,
    'cpf', CASE WHEN NOT private.cns_valido(pa.cns) AND private.cpf_valido(pa.cpf) THEN pa.cpf END,
    'municipio_ibge', pa.municipio_ibge, 'municipio', pa.municipio, 'uf', pa.uf)
$$;
REVOKE ALL ON FUNCTION private.api_paciente(public.pacientes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.api_paciente_resumo(p_paciente uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('id', pa.id, 'nome', coalesce(pa.nome_social, pa.nome),
                            'cns', CASE WHEN private.cns_valido(pa.cns) THEN pa.cns END)
    FROM public.pacientes pa WHERE pa.id = p_paciente
$$;
REVOKE ALL ON FUNCTION private.api_paciente_resumo(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.api_atendimento(e public.episodios)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', e.id, 'unidade_id', e.unidade_id, 'paciente', private.api_paciente_resumo(e.paciente_id),
    'setor', (SELECT s.nome FROM public.setores s WHERE s.id = e.setor_id),
    'chegada_em', e.chegada_em,
    'situacao', CASE
      WHEN e.etapa = 'encerrado' THEN 'encerrado'
      WHEN e.etapa = 'observacao' THEN 'em_observacao'
      WHEN e.etapa = 'triagem' THEN 'aguardando_triagem'
      WHEN e.atendimento_iniciado_em IS NOT NULL THEN 'em_atendimento'
      ELSE 'aguardando_medico' END,
    'classificacao', CASE WHEN e.cor_atual IS NOT NULL THEN jsonb_build_object('cor', e.cor_atual, 'classificada_em', e.classificado_em) END,
    'atendimento_medico_em', e.atendimento_iniciado_em,
    'cid_principal', (SELECT d.cid FROM public.diagnosticos_episodio d
                       WHERE d.episodio_id = e.id AND d.tipo = 'primario' AND d.encerrado_em IS NULL
                       ORDER BY d.registrado_em DESC LIMIT 1),
    'desfecho', CASE
      WHEN e.desfecho IS NULL THEN NULL
      WHEN e.desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido') THEN 'alta'
      WHEN e.desfecho IN ('internacao', 'observacao') THEN 'internacao'
      WHEN e.desfecho IN ('transferencia', 'evasao', 'obito') THEN e.desfecho
      ELSE 'outro' END,
    'desfecho_em', e.desfecho_em)
$$;
REVOKE ALL ON FUNCTION private.api_atendimento(public.episodios) FROM PUBLIC, anon, authenticated;

-- cursor opaco: deslocamento em base64
CREATE OR REPLACE FUNCTION private.api_cursor(p text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR p = '' THEN RETURN 0; END IF;
  RETURN greatest(0, convert_from(decode(p, 'base64'), 'UTF8')::integer);
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'cursor inválido';
END $$;
CREATE OR REPLACE FUNCTION private.api_proximo(p_desloc integer, p_limite integer, p_veio integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_veio > p_limite THEN encode(convert_to((p_desloc + p_limite)::text, 'UTF8'), 'base64') END
$$;

-- ── porta única da API ──────────────────────────────────────────────────────
-- p_recurso: unidades | paciente_busca | paciente | atendimentos | atendimento
--            | leitos | aih | apac | fechamentos
CREATE OR REPLACE FUNCTION public.api_v1(p_chave text, p_ip text, p_requisicao text, p_recurso text, p_params jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.api_chaves;
  q jsonb := coalesce(p_params, '{}'::jsonb);
  v_ip inet; v_unidade uuid; v_rec text; v_usados integer; v_status integer := 200; v_corpo jsonb;
  v_lim integer := least(greatest(coalesce(nullif(q->>'limite', '')::integer, 50), 1), 100);
  v_desloc integer;
  v_desde timestamptz; v_ate timestamptz; v_id uuid;
  v_limite jsonb;
BEGIN
  BEGIN v_ip := nullif(p_ip, '')::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  SELECT * INTO c FROM public.api_chaves WHERE hash = private.api_hash(p_chave);
  IF NOT FOUND OR c.revogada_em IS NOT NULL OR c.expira_em <= now() THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 401, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 401, 'codigo', 'chave_invalida',
      'detalhe', CASE WHEN c.id IS NULL THEN 'A chave não existe.' WHEN c.revogada_em IS NOT NULL THEN 'A chave foi revogada.' ELSE 'A chave venceu.' END);
  END IF;
  -- limite por minuto (conta as consultas da chave nos últimos 60 segundos)
  SELECT count(*) INTO v_usados FROM public.api_acessos WHERE chave_id = c.id AND em > clock_timestamp() - interval '60 seconds';
  v_limite := jsonb_build_object('limite', c.limite_por_minuto, 'restante', greatest(c.limite_por_minuto - v_usados - 1, 0), 'reinicio', 60);
  IF v_usados >= c.limite_por_minuto THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 429, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 429, 'codigo', 'limite_excedido', 'detalhe', 'Limite de consultas por minuto excedido.',
                              'limite', v_limite || jsonb_build_object('restante', 0));
  END IF;
  IF cardinality(c.ips) > 0 AND (v_ip IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(c.ips) i WHERE v_ip <<= i)) THEN
    INSERT INTO public.api_acessos (chave_id, recurso, status, ip, requisicao) VALUES (c.id, p_recurso, 403, v_ip, p_requisicao);
    RETURN jsonb_build_object('status', 403, 'codigo', 'fora_do_escopo', 'detalhe', 'IP de origem não liberado nesta chave.', 'limite', v_limite);
  END IF;
  UPDATE public.api_chaves SET ultimo_uso_em = now() WHERE id = c.id;

  BEGIN
    v_desloc := private.api_cursor(q->>'cursor');
    v_rec := CASE p_recurso WHEN 'paciente_busca' THEN 'pacientes' WHEN 'paciente' THEN 'pacientes'
                            WHEN 'atendimento' THEN 'atendimentos' WHEN 'atendimentos' THEN 'atendimentos'
                            WHEN 'leitos' THEN 'leitos' WHEN 'aih' THEN 'producao' WHEN 'apac' THEN 'producao'
                            WHEN 'fechamentos' THEN 'producao' WHEN 'unidades' THEN NULL ELSE 'desconhecido' END;
    IF v_rec = 'desconhecido' THEN
      v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Recurso inexistente.');
    ELSIF p_recurso = 'unidades' THEN
      v_corpo := jsonb_build_object('dados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes,
                   'municipio', u.municipio, 'uf', u.uf, 'recursos', to_jsonb(c.recursos)) ORDER BY u.nome)
                   FROM public.unidades u WHERE u.id = ANY (c.unidades)), '[]'::jsonb));
    ELSE
      -- recursos por id: a unidade sai do próprio registro; os outros pedem unidade_id
      IF p_recurso IN ('paciente', 'atendimento') THEN
        v_id := (q->>'id')::uuid;
        v_unidade := CASE p_recurso WHEN 'paciente' THEN (SELECT unidade_id FROM public.pacientes WHERE id = v_id)
                                    ELSE (SELECT unidade_id FROM public.episodios WHERE id = v_id) END;
        IF v_unidade IS NULL OR NOT v_unidade = ANY (c.unidades) THEN
          v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Não encontrado.');
        END IF;
      ELSE
        v_unidade := (q->>'unidade_id')::uuid;
        IF v_unidade IS NULL THEN
          v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe unidade_id.');
        ELSIF NOT v_unidade = ANY (c.unidades) THEN
          v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera esta unidade.');
        END IF;
      END IF;
      IF v_status = 200 AND NOT v_rec = ANY (c.recursos) THEN
        v_status := 403; v_corpo := jsonb_build_object('codigo', 'fora_do_escopo', 'detalhe', 'A chave não libera o recurso ' || v_rec || '.');
      END IF;

      IF v_status = 200 THEN
        CASE p_recurso
        WHEN 'paciente' THEN
          v_corpo := (SELECT private.api_paciente(pa) FROM public.pacientes pa WHERE pa.id = v_id);
        WHEN 'paciente_busca' THEN
          IF (q ? 'cns') = (q ? 'cpf') THEN
            v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Informe cns ou cpf (um dos dois).');
          ELSE
            v_corpo := jsonb_build_object('dados', coalesce((SELECT jsonb_agg(private.api_paciente(pa)) FROM (
                         SELECT * FROM public.pacientes pa WHERE pa.unidade_id = v_unidade AND pa.ativo
                            AND ((q ? 'cns' AND pa.cns = q->>'cns') OR (q ? 'cpf' AND pa.cpf = q->>'cpf')) LIMIT 1) pa), '[]'::jsonb));
          END IF;
        WHEN 'atendimento' THEN
          v_corpo := (SELECT private.api_atendimento(e) FROM public.episodios e WHERE e.id = v_id);
        WHEN 'atendimentos' THEN
          v_desde := (q->>'desde')::timestamptz; v_ate := (q->>'ate')::timestamptz;
          IF v_desde IS NULL OR v_ate IS NULL OR v_ate <= v_desde OR v_ate - v_desde > interval '31 days' THEN
            v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Período obrigatório (desde < ate), de até 31 dias.');
          ELSE
            WITH f AS (
              SELECT e.*, private.api_atendimento(e) AS j FROM public.episodios e
               WHERE e.unidade_id = v_unidade AND e.chegada_em >= v_desde AND e.chegada_em < v_ate
                 AND (NOT q ? 'paciente_id' OR e.paciente_id = (q->>'paciente_id')::uuid)
               ORDER BY e.chegada_em, e.id),
            s AS (SELECT * FROM f WHERE NOT q ? 'situacao' OR f.j->>'situacao' = q->>'situacao'),
            p AS (SELECT * FROM s ORDER BY chegada_em, id OFFSET v_desloc LIMIT v_lim + 1)
            SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(j ORDER BY chegada_em, id) FROM (SELECT * FROM p ORDER BY chegada_em, id LIMIT v_lim) x), '[]'::jsonb),
                                      'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM p)))
              INTO v_corpo;
          END IF;
        WHEN 'leitos' THEN
          WITH f AS (
            SELECT l.id, jsonb_build_object('id', l.id, 'unidade_id', s.unidade_id, 'setor', s.nome, 'identificador', l.identificador,
                     'tipo', l.tipo, 'status', l.status, 'paciente_id', i.paciente_id, 'ocupado_desde', i.data_entrada_setor) AS j,
                   s.nome AS setor, l.identificador
              FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
              LEFT JOIN LATERAL (SELECT it.paciente_id, it.data_entrada_setor FROM public.internacoes it
                                  WHERE it.leito_atual_id = l.id AND it.data_alta IS NULL ORDER BY it.data_admissao DESC LIMIT 1) i ON true
             WHERE s.unidade_id = v_unidade AND l.ativo AND (NOT q ? 'status' OR l.status::text = q->>'status')),
          p AS (SELECT * FROM f ORDER BY setor, identificador, id OFFSET v_desloc LIMIT v_lim + 1)
          SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(j ORDER BY setor, identificador, id) FROM (SELECT * FROM p ORDER BY setor, identificador, id LIMIT v_lim) x), '[]'::jsonb),
                                    'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM p)))
            INTO v_corpo;
        WHEN 'aih' THEN
          WITH f AS (
            SELECT a.id, a.solicitada_em, jsonb_build_object('id', a.id, 'unidade_id', a.unidade_id, 'paciente', private.api_paciente_resumo(a.paciente_id),
                     'internacao_id', a.internacao_id, 'status', a.status, 'numero', a.numero, 'competencia', a.competencia,
                     'procedimento', nullif(regexp_replace(coalesce(private.json_seguro(d.conteudo)->'aih'->>'procCod', ''), '\D', '', 'g'), ''),
                     'cid_principal', nullif(split_part(btrim(coalesce(private.json_seguro(d.conteudo)->'aih'->>'cid', '')), ' ', 1), ''),
                     'solicitada_em', a.solicitada_em, 'decidida_em', a.decidida_em) AS j
              FROM public.aihs a LEFT JOIN public.documentos_clinicos d ON d.id = a.laudo_id
             WHERE a.unidade_id = v_unidade AND (NOT q ? 'status' OR a.status = q->>'status')
               AND (NOT q ? 'competencia' OR a.competencia = q->>'competencia')),
          p AS (SELECT * FROM f ORDER BY solicitada_em DESC, id OFFSET v_desloc LIMIT v_lim + 1)
          SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(j ORDER BY solicitada_em DESC, id) FROM (SELECT * FROM p ORDER BY solicitada_em DESC, id LIMIT v_lim) x), '[]'::jsonb),
                                    'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM p)))
            INTO v_corpo;
        WHEN 'apac' THEN
          WITH f AS (
            SELECT a.id, a.solicitada_em, jsonb_build_object('id', a.id, 'unidade_id', a.unidade_id, 'paciente', private.api_paciente_resumo(a.paciente_id),
                     'status', a.status, 'tipo', a.tipo, 'numero', a.numero, 'validade_inicio', a.validade_inicio, 'validade_fim', a.validade_fim,
                     'procedimento', a.procedimento, 'cid_principal', a.cid_principal,
                     'competencias_executadas', (SELECT coalesce(jsonb_agg(e.competencia ORDER BY e.competencia), '[]'::jsonb)
                                                   FROM public.apac_execucoes e WHERE e.apac_id = a.id AND e.cancelado_em IS NULL),
                     'solicitada_em', a.solicitada_em, 'decidida_em', a.decidida_em) AS j
              FROM public.apacs a WHERE a.unidade_id = v_unidade AND (NOT q ? 'status' OR a.status = q->>'status')),
          p AS (SELECT * FROM f ORDER BY solicitada_em DESC, id OFFSET v_desloc LIMIT v_lim + 1)
          SELECT jsonb_build_object('dados', coalesce((SELECT jsonb_agg(j ORDER BY solicitada_em DESC, id) FROM (SELECT * FROM p ORDER BY solicitada_em DESC, id LIMIT v_lim) x), '[]'::jsonb),
                                    'proximo_cursor', private.api_proximo(v_desloc, v_lim, (SELECT count(*)::int FROM p)))
            INTO v_corpo;
        WHEN 'fechamentos' THEN
          v_corpo := jsonb_build_object('dados', coalesce((SELECT jsonb_agg(x.j ORDER BY x.competencia DESC, x.fechado_em DESC) FROM (
              SELECT f.competencia, f.fechado_em, jsonb_build_object('instrumento', 'bpa', 'competencia', f.competencia, 'situacao', f.situacao,
                       'linhas', f.linhas, 'linhas_bpa_c', f.linhas_bpa_c, 'apacs', NULL, 'controle', f.controle,
                       'fechado_em', f.fechado_em, 'reaberto_em', f.reaberto_em) AS j
                FROM public.bpa_fechamentos f
               WHERE f.unidade_id = v_unidade AND (NOT q ? 'instrumento' OR q->>'instrumento' = 'bpa')
                 AND (NOT q ? 'competencia' OR f.competencia = q->>'competencia')
              UNION ALL
              SELECT f.competencia, f.fechado_em, jsonb_build_object('instrumento', 'apac', 'competencia', f.competencia, 'situacao', f.situacao,
                       'linhas', NULL, 'linhas_bpa_c', NULL, 'apacs', f.apacs, 'controle', f.controle,
                       'fechado_em', f.fechado_em, 'reaberto_em', f.reaberto_em)
                FROM public.apac_fechamentos f
               WHERE f.unidade_id = v_unidade AND (NOT q ? 'instrumento' OR q->>'instrumento' = 'apac')
                 AND (NOT q ? 'competencia' OR f.competencia = q->>'competencia')) x), '[]'::jsonb));
        END CASE;
        IF v_status = 200 AND v_corpo IS NULL THEN
          v_status := 404; v_corpo := jsonb_build_object('codigo', 'nao_encontrado', 'detalhe', 'Não encontrado.');
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR raise_exception THEN
    v_status := 400; v_corpo := jsonb_build_object('codigo', 'requisicao_invalida', 'detalhe', 'Parâmetro fora do formato: ' || SQLERRM);
  END;

  INSERT INTO public.api_acessos (chave_id, recurso, unidade_id, status, ip, requisicao)
  VALUES (c.id, p_recurso, v_unidade, v_status, v_ip, p_requisicao);
  IF v_status = 200 THEN
    RETURN jsonb_build_object('status', 200, 'corpo', v_corpo, 'limite', v_limite);
  END IF;
  RETURN jsonb_build_object('status', v_status, 'codigo', v_corpo->>'codigo', 'detalhe', v_corpo->>'detalhe', 'limite', v_limite);
END $$;
REVOKE ALL ON FUNCTION public.api_v1(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_v1(text, text, text, text, jsonb) TO service_role;
