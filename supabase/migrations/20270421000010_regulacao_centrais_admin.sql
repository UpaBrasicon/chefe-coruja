-- ════════════════════════════════════════════════════════════════════════════
-- Regulamentação das centrais pelo administrador (pedido do RT de 24/11/2026).
--
-- "Para o administrador vale apenas regulamentar as centrais de regulação":
-- quem toma conta de quais unidades, o que cada unidade regulada tem (leitos,
-- exames, especialidades) e o prazo de cada tipo de pedido. Solicitação, fila,
-- recebidos e mapa de vagas não são do administrador.
--
-- O que já existia e continua igual:
-- • public.centrais_regulacao (uma por organização): a central que recebe os
--   pedidos da rede hoje (regulacao_solicitar). Aqui ela é chamada de
--   "principal". Se a organização ainda não tem central, a primeira que o
--   administrador cadastra passa a ser a principal.
-- • public.regulacao_prazos (prazo da fila por prioridade, ajustado pela
--   central) e public.regulacao_prazos_historico, que passa a guardar também
--   o antes e o depois dos prazos por tipo (chave 'por_tipo').
-- • setores.regulacao_tipo_leito e public.regulacao_servicos (oferta do dia,
--   do gestor da unidade, no mapa de vagas).
--
-- Novo (expand, só adiciona):
-- • public.regulacao_centrais_cadastro: as centrais da organização (uma
--   unidade cada), com a principal copiada de centrais_regulacao; um gatilho
--   em centrais_regulacao mantém a principal no cadastro.
-- • public.regulacao_central_unidades: que central regula cada unidade
--   (uma central por unidade regulada).
-- • public.regulacao_unidade_capacidades: o que a unidade tem — tipo de leito
--   (com quantidade), exame e especialidade. O que não está na lista a
--   unidade não tem.
-- • public.regulacao_prazos_tipo: prazo da central por tipo de pedido
--   (consulta/encaminhamento, exame, leito/internação, transferência).
-- • Funções: regulacao_regulamentacao (leitura), regulacao_cadastrar_central,
--   regulacao_retirar_central, regulacao_definir_unidades_central,
--   regulacao_salvar_capacidades, regulacao_definir_prazos_tipo.
--
-- Quem escreve e lê: o super admin e o administrador da organização
-- (private.eh_admin_da_organizacao), com segundo fator. As tabelas têm RLS e
-- nenhum acesso direto; tudo passa pelas funções.
--
-- Ainda não muda o encaminhamento dos pedidos (continua indo à principal) nem
-- o painel de SLA (que segue com o prazo por prioridade).
--
-- Idempotente. Teste: supabase/tests/regulacao_centrais_admin.sql.
-- Volta: docs/regulacao/ROLLBACK-20270421000010.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── centrais da organização ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_centrais_cadastro (
  unidade_id      uuid PRIMARY KEY REFERENCES public.unidades(id),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id),
  ativa           boolean NOT NULL DEFAULT true,
  criada_por      uuid NOT NULL REFERENCES public.perfis(id),
  criada_em       timestamptz NOT NULL DEFAULT now(),
  alterada_por    uuid REFERENCES public.perfis(id),
  alterada_em     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_regulacao_centrais_cadastro_org ON public.regulacao_centrais_cadastro (organizacao_id) WHERE ativa;
ALTER TABLE public.regulacao_centrais_cadastro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_centrais_cadastro FROM anon, authenticated;

-- a central de hoje entra no cadastro
INSERT INTO public.regulacao_centrais_cadastro (unidade_id, organizacao_id, criada_por, criada_em)
SELECT c.unidade_id, c.organizacao_id, c.definida_por, c.definida_em FROM public.centrais_regulacao c
ON CONFLICT (unidade_id) DO NOTHING;

-- a central que o super admin aponta por regulacao_definir_central também
-- entra (ou volta) no cadastro
CREATE OR REPLACE FUNCTION private.regulacao_central_no_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.regulacao_centrais_cadastro (unidade_id, organizacao_id, criada_por)
  VALUES (NEW.unidade_id, NEW.organizacao_id, NEW.definida_por)
  ON CONFLICT (unidade_id) DO UPDATE SET ativa = true, alterada_por = NEW.definida_por, alterada_em = now()
   WHERE NOT public.regulacao_centrais_cadastro.ativa;
  -- central não é regulada por outra central
  DELETE FROM public.regulacao_central_unidades WHERE unidade_id = NEW.unidade_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_central_no_cadastro() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_regulacao_central_no_cadastro ON public.centrais_regulacao;
CREATE TRIGGER trg_regulacao_central_no_cadastro AFTER INSERT OR UPDATE OF unidade_id ON public.centrais_regulacao
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_central_no_cadastro();

-- ── unidades reguladas por cada central ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_central_unidades (
  unidade_id   uuid PRIMARY KEY REFERENCES public.unidades(id),
  central_id   uuid NOT NULL REFERENCES public.regulacao_centrais_cadastro(unidade_id),
  definida_por uuid NOT NULL REFERENCES public.perfis(id),
  definida_em  timestamptz NOT NULL DEFAULT now(),
  CHECK (unidade_id <> central_id)
);
CREATE INDEX IF NOT EXISTS idx_regulacao_central_unidades_central ON public.regulacao_central_unidades (central_id);
ALTER TABLE public.regulacao_central_unidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_central_unidades FROM anon, authenticated;

-- ── o que cada unidade tem ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_unidade_capacidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  categoria       text NOT NULL CHECK (categoria IN ('leito', 'exame', 'especialidade')),
  codigo          text NOT NULL CHECK (codigo ~ '^[a-z0-9_]{2,60}$'),
  nome            text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 80),
  quantidade      integer CHECK (quantidade BETWEEN 0 AND 9999),
  observacao      text CHECK (length(observacao) <= 200),
  atualizado_por  uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CHECK (categoria = 'leito' OR quantidade IS NULL),
  UNIQUE (unidade_id, categoria, codigo)
);
ALTER TABLE public.regulacao_unidade_capacidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_unidade_capacidades FROM anon, authenticated;

-- ── prazo por tipo de pedido ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_prazos_tipo (
  central_id      uuid NOT NULL REFERENCES public.regulacao_centrais_cadastro(unidade_id),
  tipo            text NOT NULL CHECK (tipo IN ('consulta', 'exame', 'leito', 'transferencia')),
  prazo_min       integer NOT NULL CHECK (prazo_min BETWEEN 1 AND 525600),
  atualizado_por  uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (central_id, tipo)
);
ALTER TABLE public.regulacao_prazos_tipo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_prazos_tipo FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
-- Recusa quem não é super admin nem administrador da organização.
CREATE OR REPLACE FUNCTION private.regulacao_exigir_admin_org(p_org uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_org IS NULL OR NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(p_org)) THEN
    RAISE EXCEPTION 'Quem regulamenta as centrais é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_exigir_admin_org(uuid) FROM PUBLIC, anon, authenticated;

-- Central ativa da organização (cadastrada ou a principal).
CREATE OR REPLACE FUNCTION private.regulacao_eh_central(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.regulacao_centrais_cadastro c WHERE c.unidade_id = p_unidade AND c.ativa)
      OR EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_unidade)
$$;
REVOKE ALL ON FUNCTION private.regulacao_eh_central(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_prazos_tipo_json(p_central uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(p.tipo, p.prazo_min), '{}'::jsonb)
    FROM public.regulacao_prazos_tipo p WHERE p.central_id = p_central
$$;
REVOKE ALL ON FUNCTION private.regulacao_prazos_tipo_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── leitura ─────────────────────────────────────────────────────────────────
-- Cada organização que a pessoa administra (o super admin vê todas), com as
-- centrais, as unidades reguladas, o que cada unidade tem e os prazos.
CREATE OR REPLACE FUNCTION public.regulacao_regulamentacao()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_super boolean := private.eh_super_admin();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.meu_perfil_id() IS NULL
     OR NOT (v_super OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'Quem regulamenta as centrais é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'organizacao_id', o.id, 'organizacao', o.nome,
      'principal', (SELECT cr.unidade_id FROM public.centrais_regulacao cr WHERE cr.organizacao_id = o.id),
      'centrais', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', u.id, 'nome', u.nome, 'tipo', u.tipo,
                 'principal', EXISTS (SELECT 1 FROM public.centrais_regulacao cr WHERE cr.unidade_id = u.id),
                 'unidades', coalesce((SELECT jsonb_agg(cu.unidade_id ORDER BY ur.nome)
                                         FROM public.regulacao_central_unidades cu
                                         JOIN public.unidades ur ON ur.id = cu.unidade_id
                                        WHERE cu.central_id = u.id), '[]'::jsonb),
                 'prazos', private.regulacao_prazos_tipo_json(u.id),
                 'prazos_atualizado_em', (SELECT max(p.atualizado_em) FROM public.regulacao_prazos_tipo p WHERE p.central_id = u.id))
               ORDER BY u.nome)
          FROM public.unidades u
         WHERE u.organizacao_id = o.id
           AND (EXISTS (SELECT 1 FROM public.regulacao_centrais_cadastro c WHERE c.unidade_id = u.id AND c.ativa)
                OR EXISTS (SELECT 1 FROM public.centrais_regulacao cr WHERE cr.unidade_id = u.id))), '[]'::jsonb),
      'unidades', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', u.id, 'nome', u.nome, 'tipo', u.tipo,
                 'central_id', (SELECT cu.central_id FROM public.regulacao_central_unidades cu WHERE cu.unidade_id = u.id),
                 'eh_central', private.regulacao_eh_central(u.id),
                 'capacidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                    'categoria', k.categoria, 'codigo', k.codigo, 'nome', k.nome,
                                    'quantidade', k.quantidade, 'observacao', k.observacao) ORDER BY k.categoria, k.nome)
                                  FROM public.regulacao_unidade_capacidades k WHERE k.unidade_id = u.id), '[]'::jsonb),
                 'capacidades_atualizado_em', (SELECT max(k.atualizado_em) FROM public.regulacao_unidade_capacidades k WHERE k.unidade_id = u.id))
               ORDER BY u.nome)
          FROM public.unidades u WHERE u.organizacao_id = o.id AND u.ativo), '[]'::jsonb))
      ORDER BY o.nome)
    FROM public.organizacoes o
   WHERE o.ativo AND (v_super OR o.id IN (SELECT private.orgs_admin()))), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_regulamentacao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_regulamentacao() TO authenticated;

-- ── centrais ────────────────────────────────────────────────────────────────
-- Cadastra (ou reativa) a unidade como central. Sem central na organização,
-- ela passa a receber os pedidos da rede.
CREATE OR REPLACE FUNCTION public.regulacao_cadastrar_central(p_unidade uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.unidades; v_regulada text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade inexistente ou inativa.'; END IF;
  PERFORM private.regulacao_exigir_admin_org(u.organizacao_id);
  SELECT c.nome INTO v_regulada FROM public.regulacao_central_unidades cu JOIN public.unidades c ON c.id = cu.central_id
   WHERE cu.unidade_id = p_unidade;
  IF v_regulada IS NOT NULL THEN
    RAISE EXCEPTION 'Esta unidade é regulada pela central %. Tire-a de lá antes de fazer dela uma central.', v_regulada;
  END IF;
  INSERT INTO public.regulacao_centrais_cadastro (unidade_id, organizacao_id, criada_por)
  VALUES (u.id, u.organizacao_id, private.meu_perfil_id())
  ON CONFLICT (unidade_id) DO UPDATE SET ativa = true, alterada_por = private.meu_perfil_id(), alterada_em = now();
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao WHERE organizacao_id = u.organizacao_id) THEN
    INSERT INTO public.centrais_regulacao (organizacao_id, unidade_id, definida_por)
    VALUES (u.organizacao_id, u.id, private.meu_perfil_id());
    PERFORM private.registrar_auditoria('regulacao_central_definida', 'centrais_regulacao', u.id, u.id,
      jsonb_build_object('organizacao_id', u.organizacao_id));
  END IF;
  PERFORM private.registrar_auditoria('regulacao_central_cadastrada', 'regulacao_centrais_cadastro', u.id, u.id,
    jsonb_build_object('ativo', true));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_cadastrar_central(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_cadastrar_central(uuid) TO authenticated;

-- Deixa de ser central; as unidades dela ficam sem central. A principal não sai.
CREATE OR REPLACE FUNCTION public.regulacao_retirar_central(p_central uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.regulacao_centrais_cadastro; v_soltas integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.regulacao_centrais_cadastro WHERE unidade_id = p_central AND ativa;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta unidade não é uma central cadastrada.'; END IF;
  PERFORM private.regulacao_exigir_admin_org(c.organizacao_id);
  IF EXISTS (SELECT 1 FROM public.centrais_regulacao cr WHERE cr.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta central recebe os pedidos da rede hoje e não pode sair.';
  END IF;
  DELETE FROM public.regulacao_central_unidades WHERE central_id = p_central;
  GET DIAGNOSTICS v_soltas = ROW_COUNT;
  UPDATE public.regulacao_centrais_cadastro SET ativa = false, alterada_por = private.meu_perfil_id(), alterada_em = now()
   WHERE unidade_id = p_central;
  PERFORM private.registrar_auditoria('regulacao_central_retirada', 'regulacao_centrais_cadastro', p_central, p_central,
    jsonb_build_object('ativo', false, 'quantidade', v_soltas));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_retirar_central(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_retirar_central(uuid) TO authenticated;

-- ── unidades reguladas ──────────────────────────────────────────────────────
-- Troca a lista inteira. Unidade que estava em outra central passa para esta.
CREATE OR REPLACE FUNCTION public.regulacao_definir_unidades_central(p_central uuid, p_unidades uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.regulacao_centrais_cadastro;
  v_lista uuid[] := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_unidades) x WHERE x IS NOT NULL), '{}');
  v_ruim text; v_saiu integer; v_movidas integer; v_entrou integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.regulacao_centrais_cadastro WHERE unidade_id = p_central AND ativa;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta unidade não é uma central cadastrada.'; END IF;
  PERFORM private.regulacao_exigir_admin_org(c.organizacao_id);
  IF cardinality(v_lista) > 500 THEN RAISE EXCEPTION 'No máximo 500 unidades por central.'; END IF;
  IF p_central = ANY (v_lista) THEN RAISE EXCEPTION 'A central não regula a si mesma.'; END IF;
  SELECT string_agg(coalesce(u.nome, x::text), ', ') INTO v_ruim
    FROM unnest(v_lista) x LEFT JOIN public.unidades u ON u.id = x
   WHERE u.id IS NULL OR NOT u.ativo OR u.organizacao_id <> c.organizacao_id;
  IF v_ruim IS NOT NULL THEN RAISE EXCEPTION 'Fora da rede desta central ou inativa: %.', v_ruim; END IF;
  SELECT string_agg(u.nome, ', ') INTO v_ruim FROM unnest(v_lista) x JOIN public.unidades u ON u.id = x
   WHERE private.regulacao_eh_central(x);
  IF v_ruim IS NOT NULL THEN RAISE EXCEPTION 'Central não é regulada por outra central: %.', v_ruim; END IF;

  DELETE FROM public.regulacao_central_unidades WHERE central_id = p_central AND NOT (unidade_id = ANY (v_lista));
  GET DIAGNOSTICS v_saiu = ROW_COUNT;
  SELECT count(*) INTO v_movidas FROM public.regulacao_central_unidades
   WHERE unidade_id = ANY (v_lista) AND central_id <> p_central;
  SELECT count(*) INTO v_entrou FROM unnest(v_lista) x
   WHERE NOT EXISTS (SELECT 1 FROM public.regulacao_central_unidades cu WHERE cu.unidade_id = x AND cu.central_id = p_central);
  INSERT INTO public.regulacao_central_unidades (unidade_id, central_id, definida_por)
  SELECT x, p_central, private.meu_perfil_id() FROM unnest(v_lista) x
  ON CONFLICT (unidade_id) DO UPDATE SET central_id = excluded.central_id, definida_por = excluded.definida_por, definida_em = now()
   WHERE public.regulacao_central_unidades.central_id <> excluded.central_id;
  IF v_saiu + v_entrou > 0 THEN
    PERFORM private.registrar_auditoria('regulacao_central_unidades', 'regulacao_central_unidades', p_central, p_central,
      jsonb_build_object('quantidade', cardinality(v_lista)));
  END IF;
  RETURN jsonb_build_object('incluidas', v_entrou, 'retiradas', v_saiu, 'movidas', v_movidas, 'total', cardinality(v_lista));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_unidades_central(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_unidades_central(uuid, uuid[]) TO authenticated;

-- ── capacidades da unidade ──────────────────────────────────────────────────
-- p_itens: [{categoria, codigo, nome, quantidade?, observacao?}]. Troca a lista
-- inteira; o que não está na lista a unidade não tem.
CREATE OR REPLACE FUNCTION public.regulacao_salvar_capacidades(p_unidade uuid, p_itens jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u public.unidades;
  i jsonb; v_cat text; v_cod text; v_nome text; v_qtd numeric; v_obs text;
  v_norm jsonb := '[]'::jsonb;
  v_chaves text[] := '{}';
  v_total integer := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade inexistente ou inativa.'; END IF;
  PERFORM private.regulacao_exigir_admin_org(u.organizacao_id);
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN RAISE EXCEPTION 'Lista de capacidades inválida.'; END IF;
  IF jsonb_array_length(p_itens) > 300 THEN RAISE EXCEPTION 'No máximo 300 itens por unidade.'; END IF;

  -- confere cada item e monta a lista limpa
  FOR i IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    IF jsonb_typeof(i) <> 'object' THEN RAISE EXCEPTION 'Lista de capacidades inválida.'; END IF;
    v_cat := i->>'categoria';
    v_cod := lower(btrim(coalesce(i->>'codigo', '')));
    v_nome := btrim(coalesce(i->>'nome', ''));
    v_obs := nullif(btrim(coalesce(i->>'observacao', '')), '');
    IF v_cat IS NULL OR v_cat NOT IN ('leito', 'exame', 'especialidade') THEN
      RAISE EXCEPTION 'Categoria fora da lista: leito, exame ou especialidade.';
    END IF;
    IF v_cod !~ '^[a-z0-9_]{2,60}$' THEN RAISE EXCEPTION 'Código inválido: %.', v_cod; END IF;
    IF length(v_nome) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Nome de 2 a 80 letras: %.', v_cod; END IF;
    IF v_obs IS NOT NULL AND length(v_obs) > 200 THEN RAISE EXCEPTION 'Observação de até 200 letras: %.', v_nome; END IF;
    IF v_cat = 'leito' AND v_cod NOT IN ('clinico', 'cirurgico', 'pediatrico', 'obstetrico', 'psiquiatrico',
         'uti_adulto', 'uti_pediatrica', 'uti_neonatal', 'uci_adulto', 'uci_pediatrica', 'uci_neonatal',
         'uti_queimados', 'unidade_coronariana', 'outro') THEN
      RAISE EXCEPTION 'Tipo de leito fora da lista da regulação: %.', v_cod;
    END IF;
    v_qtd := NULL;
    IF v_cat = 'leito' AND jsonb_typeof(i->'quantidade') = 'number' THEN
      v_qtd := (i->>'quantidade')::numeric;
      IF v_qtd <> floor(v_qtd) OR v_qtd NOT BETWEEN 0 AND 9999 THEN
        RAISE EXCEPTION 'Quantidade de leitos de 0 a 9999: %.', v_nome;
      END IF;
    ELSIF i ? 'quantidade' AND jsonb_typeof(i->'quantidade') NOT IN ('null', 'number') THEN
      RAISE EXCEPTION 'Quantidade em número: %.', v_nome;
    END IF;
    IF (v_cat || ':' || v_cod) = ANY (v_chaves) THEN
      RAISE EXCEPTION 'Item repetido: %.', v_nome;
    END IF;
    v_chaves := v_chaves || (v_cat || ':' || v_cod);
    v_norm := v_norm || jsonb_build_array(jsonb_build_object('categoria', v_cat, 'codigo', v_cod, 'nome', v_nome,
      'quantidade', v_qtd::integer, 'observacao', v_obs));
  END LOOP;

  DELETE FROM public.regulacao_unidade_capacidades k
   WHERE k.unidade_id = p_unidade AND NOT ((k.categoria || ':' || k.codigo) = ANY (v_chaves));
  INSERT INTO public.regulacao_unidade_capacidades (unidade_id, categoria, codigo, nome, quantidade, observacao, atualizado_por)
  SELECT p_unidade, c.categoria, c.codigo, c.nome, c.quantidade, c.observacao, private.meu_perfil_id()
    FROM jsonb_to_recordset(v_norm) AS c(categoria text, codigo text, nome text, quantidade integer, observacao text)
  ON CONFLICT (unidade_id, categoria, codigo) DO UPDATE SET
    nome = excluded.nome, quantidade = excluded.quantidade, observacao = excluded.observacao,
    atualizado_por = excluded.atualizado_por, atualizado_em = now()
   WHERE (public.regulacao_unidade_capacidades.nome, public.regulacao_unidade_capacidades.quantidade,
          public.regulacao_unidade_capacidades.observacao)
         IS DISTINCT FROM (excluded.nome, excluded.quantidade, excluded.observacao);
  v_total := jsonb_array_length(v_norm);
  PERFORM private.registrar_auditoria('regulacao_capacidades_salvas', 'regulacao_unidade_capacidades', p_unidade, p_unidade,
    jsonb_build_object('quantidade', v_total));
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_salvar_capacidades(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_salvar_capacidades(uuid, jsonb) TO authenticated;

-- ── prazos por tipo ─────────────────────────────────────────────────────────
-- p_prazos: {consulta, exame, leito, transferencia} em minutos; nulo = sem prazo.
CREATE OR REPLACE FUNCTION public.regulacao_definir_prazos_tipo(p_central uuid, p_prazos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.regulacao_centrais_cadastro;
  d jsonb := coalesce(p_prazos, '{}'::jsonb);
  k text; v numeric; v_antes jsonb; v_depois jsonb; v_hist uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO c FROM public.regulacao_centrais_cadastro WHERE unidade_id = p_central AND ativa;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta unidade não é uma central cadastrada.'; END IF;
  PERFORM private.regulacao_exigir_admin_org(c.organizacao_id);
  IF jsonb_typeof(d) <> 'object' THEN RAISE EXCEPTION 'Prazos inválidos.'; END IF;
  FOR k IN SELECT jsonb_object_keys(d) LOOP
    IF k NOT IN ('consulta', 'exame', 'leito', 'transferencia') THEN RAISE EXCEPTION 'Tipo de pedido fora da lista: %.', k; END IF;
    IF jsonb_typeof(d->k) NOT IN ('null', 'number') THEN RAISE EXCEPTION 'Prazo em minutos: %.', k; END IF;
    v := (d->>k)::numeric;
    IF v IS NOT NULL AND (v <> floor(v) OR v NOT BETWEEN 1 AND 525600) THEN
      RAISE EXCEPTION 'Prazo de 1 minuto a 365 dias: %.', k;
    END IF;
  END LOOP;
  v_antes := private.regulacao_prazos_tipo_json(p_central);
  FOR k IN SELECT unnest(ARRAY['consulta', 'exame', 'leito', 'transferencia']) LOOP
    CONTINUE WHEN NOT d ? k;
    IF d->>k IS NULL THEN
      DELETE FROM public.regulacao_prazos_tipo WHERE central_id = p_central AND tipo = k;
    ELSE
      INSERT INTO public.regulacao_prazos_tipo (central_id, tipo, prazo_min, atualizado_por)
      VALUES (p_central, k, (d->>k)::integer, private.meu_perfil_id())
      ON CONFLICT (central_id, tipo) DO UPDATE SET prazo_min = excluded.prazo_min,
        atualizado_por = excluded.atualizado_por, atualizado_em = now()
       WHERE public.regulacao_prazos_tipo.prazo_min <> excluded.prazo_min;
    END IF;
  END LOOP;
  v_depois := private.regulacao_prazos_tipo_json(p_central);
  IF v_depois IS DISTINCT FROM v_antes THEN
    INSERT INTO public.regulacao_prazos_historico (central_id, antes, depois, por)
    VALUES (p_central, jsonb_build_object('por_tipo', v_antes), jsonb_build_object('por_tipo', v_depois), private.meu_perfil_id())
    RETURNING id INTO v_hist;
    PERFORM private.registrar_auditoria('regulacao_prazos_tipo_ajustados', 'regulacao_prazos_historico', v_hist, p_central, NULL);
  END IF;
  RETURN v_depois;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_prazos_tipo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_prazos_tipo(uuid, jsonb) TO authenticated;
