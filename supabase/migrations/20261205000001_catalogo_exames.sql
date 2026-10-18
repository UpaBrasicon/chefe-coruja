-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5C, tarefa 1 (laboratório/LIS), etapa 1.1: catálogo de exames
-- (decisões do RT de 18/10/2026, "0a 1a 2a 3a 4a 5a 6a").
--
-- 1a. A base é o grupo 02.02 do SIGTAP (diagnóstico em laboratório clínico),
--     já carregado. O LOINC fica num campo que a implantação preenche quando o
--     LIS pedir; o sistema não deduz LOINC.
-- 2a. O gestor escolhe os exames que a unidade oferece, com um nome curto para
--     a tela. Sem lista configurada, a busca usa o grupo 02.02 inteiro.
-- 3a. Os botões de exames comuns do atendimento vêm da lista da unidade (o
--     gestor marca quais). Sem lista, ficam os botões de antes.
-- 4a. Kits ficam para depois.
-- 5a. O pedido em texto livre continua, sem código: não vai ao laboratório
--     integrado. O pedido impresso continua texto; a linha que tiver o mesmo
--     nome de um exame do catálogo ganha o código.
-- 6a. Pedido com urgência (rotina ou urgente) e observação opcional.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.exames_unidade (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  procedimento  text NOT NULL CHECK (procedimento ~ '^0202[0-9]{6}$'),
  nome_curto    text NOT NULL CHECK (length(btrim(nome_curto)) BETWEEN 2 AND 80),
  loinc         text CHECK (loinc ~ '^[0-9]{1,7}-[0-9]$'),
  botao         boolean NOT NULL DEFAULT false,
  ordem         int NOT NULL DEFAULT 0,
  definido_por  uuid NOT NULL REFERENCES public.perfis(id),
  definido_em   timestamptz NOT NULL DEFAULT now(),
  vigente_ate   timestamptz,
  retirado_por  uuid REFERENCES public.perfis(id),
  motivo_retirada text
);
CREATE UNIQUE INDEX exames_unidade_vigente ON public.exames_unidade (unidade_id, procedimento) WHERE vigente_ate IS NULL;
ALTER TABLE public.exames_unidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exames_unidade FROM anon, authenticated;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.exames_unidade FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

ALTER TABLE public.exames_pedidos
  ADD COLUMN IF NOT EXISTS procedimento text,
  ADD COLUMN IF NOT EXISTS loinc        text,
  ADD COLUMN IF NOT EXISTS urgencia     text NOT NULL DEFAULT 'rotina',
  ADD COLUMN IF NOT EXISTS observacao   text;
ALTER TABLE public.exames_pedidos
  ADD CONSTRAINT exames_pedidos_urgencia CHECK (urgencia IN ('rotina', 'urgente')),
  ADD CONSTRAINT exames_pedidos_procedimento CHECK (procedimento IS NULL OR procedimento ~ '^0202[0-9]{6}$');

-- nome do exame no catálogo da unidade, senão no SIGTAP
CREATE OR REPLACE FUNCTION private.exame_do_catalogo(p_unidade uuid, p_procedimento text)
RETURNS TABLE (procedimento text, nome text, loinc text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT sp.codigo, coalesce(eu.nome_curto, sp.nome), eu.loinc
    FROM terminologia.sigtap_procedimento sp
    LEFT JOIN public.exames_unidade eu ON eu.unidade_id = p_unidade AND eu.procedimento = sp.codigo AND eu.vigente_ate IS NULL
   WHERE sp.codigo = p_procedimento AND sp.codigo LIKE '0202%'
$$;
REVOKE ALL ON FUNCTION private.exame_do_catalogo(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.unidade_tem_catalogo_exames(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.exames_unidade WHERE unidade_id = p_unidade AND vigente_ate IS NULL)
$$;
REVOKE ALL ON FUNCTION private.unidade_tem_catalogo_exames(uuid) FROM PUBLIC, anon, authenticated;

-- 2a/3a. lista da unidade (tela do gestor e botões do atendimento)
CREATE OR REPLACE FUNCTION public.exames_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = p_unidade AND v.perfil_id = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora dos seus vínculos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'exames', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', eu.id, 'procedimento', eu.procedimento, 'nome_curto', eu.nome_curto, 'nome_sigtap', sp.nome,
                 'loinc', eu.loinc, 'botao', eu.botao, 'ordem', eu.ordem,
                 'definido_por', (SELECT nome_completo FROM public.perfis WHERE id = eu.definido_por), 'definido_em', eu.definido_em)
               ORDER BY eu.botao DESC, eu.ordem, eu.nome_curto)
               FROM public.exames_unidade eu LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = eu.procedimento
              WHERE eu.unidade_id = p_unidade AND eu.vigente_ate IS NULL), '[]'::jsonb),
    'pode_definir', private.eh_super_admin() OR private.gestor_da_unidade(p_unidade));
END $$;
REVOKE ALL ON FUNCTION public.exames_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exames_da_unidade(uuid) TO authenticated;

-- busca: na lista da unidade, quando há; senão no grupo 02.02 do SIGTAP.
-- p_todos: sempre no grupo 02.02 (tela do gestor, para montar a lista)
CREATE OR REPLACE FUNCTION public.buscar_exames(p_unidade uuid, p_termo text, p_todos boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_t text := terminologia.unaccent_text(lower(btrim(coalesce(p_termo, '')))); v_dig text := regexp_replace(coalesce(p_termo, ''), '\D', '', 'g');
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = p_unidade AND v.perfil_id = private.meu_perfil_id())) THEN
    RAISE EXCEPTION 'Acesso negado: unidade fora dos seus vínculos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_t) < 2 THEN RETURN '[]'::jsonb; END IF;
  IF NOT coalesce(p_todos, false) AND private.unidade_tem_catalogo_exames(p_unidade) THEN
    RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('procedimento', x.procedimento, 'nome', x.nome_curto, 'nome_sigtap', x.nome_sigtap) ORDER BY x.nome_curto)
      FROM (SELECT eu.procedimento, eu.nome_curto, sp.nome AS nome_sigtap
              FROM public.exames_unidade eu LEFT JOIN terminologia.sigtap_procedimento sp ON sp.codigo = eu.procedimento
             WHERE eu.unidade_id = p_unidade AND eu.vigente_ate IS NULL
               AND (terminologia.unaccent_text(lower(eu.nome_curto)) LIKE '%' || v_t || '%'
                    OR terminologia.unaccent_text(lower(coalesce(sp.nome, ''))) LIKE '%' || v_t || '%'
                    OR (length(v_dig) >= 4 AND eu.procedimento LIKE v_dig || '%'))
             LIMIT 30) x), '[]'::jsonb);
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('procedimento', x.codigo, 'nome', x.nome, 'nome_sigtap', x.nome) ORDER BY x.nome)
    FROM (SELECT sp.codigo, sp.nome FROM terminologia.sigtap_procedimento sp
           WHERE sp.codigo LIKE '0202%'
             AND (terminologia.unaccent_text(lower(sp.nome)) LIKE '%' || v_t || '%' OR (length(v_dig) >= 4 AND sp.codigo LIKE v_dig || '%'))
           ORDER BY sp.nome LIMIT 30) x), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.buscar_exames(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_exames(uuid, text, boolean) TO authenticated;

-- 1a/2a/3a. o gestor põe ou muda um exame na lista da unidade
CREATE OR REPLACE FUNCTION public.definir_exame_unidade(p_unidade uuid, p_procedimento text, p_nome_curto text,
                                                       p_loinc text DEFAULT NULL, p_botao boolean DEFAULT false, p_ordem int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id(); v_proc text := regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g');
        v_nome text := btrim(coalesce(p_nome_curto, '')); v_loinc text := nullif(btrim(coalesce(p_loinc, '')), ''); v_antigo public.exames_unidade;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: a lista de exames é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc AND codigo LIKE '0202%') THEN
    RAISE EXCEPTION 'Procedimento % não está no grupo 02.02 (laboratório clínico) do SIGTAP carregado.', coalesce(nullif(v_proc, ''), '?');
  END IF;
  IF length(v_nome) < 2 OR length(v_nome) > 80 THEN RAISE EXCEPTION 'Nome curto entre 2 e 80 letras.'; END IF;
  IF v_loinc IS NOT NULL AND v_loinc !~ '^[0-9]{1,7}-[0-9]$' THEN RAISE EXCEPTION 'LOINC no formato 12345-6.'; END IF;
  SELECT * INTO v_antigo FROM public.exames_unidade WHERE unidade_id = p_unidade AND procedimento = v_proc AND vigente_ate IS NULL FOR UPDATE;
  IF v_antigo.id IS NOT NULL THEN
    UPDATE public.exames_unidade SET vigente_ate = now(), retirado_por = v_eu, motivo_retirada = 'alterado' WHERE id = v_antigo.id;
  END IF;
  INSERT INTO public.exames_unidade (unidade_id, procedimento, nome_curto, loinc, botao, ordem, definido_por)
  VALUES (p_unidade, v_proc, v_nome, v_loinc, coalesce(p_botao, false), coalesce(p_ordem, 0), v_eu);
  PERFORM private.registrar_auditoria(CASE WHEN v_antigo.id IS NULL THEN 'exame_unidade_incluido' ELSE 'exame_unidade_alterado' END,
    'exames_unidade', p_unidade, p_unidade,
    jsonb_build_object('procedimento', v_proc, 'nome_curto', v_nome, 'loinc', v_loinc, 'botao', coalesce(p_botao, false),
                       'antes', CASE WHEN v_antigo.id IS NOT NULL THEN jsonb_build_object('nome_curto', v_antigo.nome_curto, 'loinc', v_antigo.loinc, 'botao', v_antigo.botao) END));
  RETURN public.exames_da_unidade(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.definir_exame_unidade(uuid, text, text, text, boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_exame_unidade(uuid, text, text, text, boolean, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_exame_unidade(p_unidade uuid, p_procedimento text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_eu uuid := private.meu_perfil_id(); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), ''); v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.eh_super_admin() OR private.gestor_da_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: a lista de exames é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(coalesce(v_motivo, '')) < 10 THEN RAISE EXCEPTION 'Diga por que o exame sai da lista (mínimo de 10 letras).'; END IF;
  UPDATE public.exames_unidade SET vigente_ate = now(), retirado_por = v_eu, motivo_retirada = v_motivo
   WHERE unidade_id = p_unidade AND procedimento = p_procedimento AND vigente_ate IS NULL RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Este exame não está na lista da unidade.'; END IF;
  PERFORM private.registrar_auditoria('exame_unidade_retirado', 'exames_unidade', p_unidade, p_unidade,
    jsonb_build_object('procedimento', p_procedimento, 'motivo', v_motivo));
  RETURN public.exames_da_unidade(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.retirar_exame_unidade(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_exame_unidade(uuid, text, text) TO authenticated;

-- 1a/5a/6a. pedido no atendimento pelo catálogo, com urgência e observação.
-- p_itens: [{"procedimento": "0202020380"} ou {"nome": "texto livre"}]
CREATE OR REPLACE FUNCTION public.pedir_exames(p_episodio uuid, p_itens jsonb, p_urgencia text DEFAULT 'rotina', p_observacao text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; it jsonb; v_proc text; v_nome text; v_loinc text; n int := 0;
        v_obs text := nullif(btrim(coalesce(p_observacao, '')), ''); v_catalogo boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  e := private.atendimento_aberto_na_porta(p_episodio);
  IF coalesce(p_urgencia, '') NOT IN ('rotina', 'urgente') THEN RAISE EXCEPTION 'Urgência: rotina ou urgente.'; END IF;
  IF length(coalesce(v_obs, '')) > 300 THEN RAISE EXCEPTION 'Observação longa demais (até 300 letras).'; END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN RAISE EXCEPTION 'Escolha ao menos um exame.'; END IF;
  v_catalogo := private.unidade_tem_catalogo_exames(e.unidade_id);
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_proc := nullif(regexp_replace(coalesce(it ->> 'procedimento', ''), '\D', '', 'g'), '');
    IF v_proc IS NOT NULL THEN
      SELECT c.procedimento, c.nome, c.loinc INTO v_proc, v_nome, v_loinc FROM private.exame_do_catalogo(e.unidade_id, v_proc) c;
      IF v_nome IS NULL THEN RAISE EXCEPTION 'Exame % fora do grupo 02.02 do SIGTAP.', it ->> 'procedimento'; END IF;
      IF v_catalogo AND NOT EXISTS (SELECT 1 FROM public.exames_unidade WHERE unidade_id = e.unidade_id AND procedimento = v_proc AND vigente_ate IS NULL) THEN
        RAISE EXCEPTION 'O exame % não está na lista da unidade.', v_nome;
      END IF;
      -- o mesmo exame ainda pendente neste atendimento não entra de novo
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao = 'pedido' AND procedimento = v_proc);
    ELSE
      v_nome := btrim(coalesce(it ->> 'nome', '')); v_loinc := NULL;
      CONTINUE WHEN length(v_nome) < 2;
      IF length(v_nome) > 200 THEN RAISE EXCEPTION 'Nome de exame longo demais.'; END IF;
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.exames_pedidos WHERE episodio_id = e.id AND situacao = 'pedido' AND lower(exame) = lower(v_nome));
    END IF;
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, exame, procedimento, loinc, urgencia, observacao, pedido_por)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_nome, v_proc, v_loinc, p_urgencia, v_obs, private.meu_perfil_id());
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Esses exames já estão pedidos e aguardam resultado.'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.pedir_exames(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_exames(uuid, jsonb, text, text) TO authenticated;

-- 5a. pedido impresso: continua texto; a linha com o mesmo nome de um exame do
-- catálogo da unidade (ou do SIGTAP, sem catálogo) ganha o código
CREATE OR REPLACE FUNCTION private.pedido_emitido_vira_exames() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_texto text; l text; v_proc text; v_loinc text;
BEGIN
  IF NEW.tipo_documento <> 'pedido_exames' OR NEW.estado <> 'ativo' OR NEW.retificacao_de IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado = 'ativo' THEN RETURN NEW; END IF;
  BEGIN
    v_texto := coalesce(NEW.conteudo::jsonb -> 'pedido' ->> 'texto', NEW.conteudo::jsonb -> 'exames' ->> 'texto', '');
  EXCEPTION WHEN others THEN v_texto := '';
  END;
  FOREACH l IN ARRAY regexp_split_to_array(v_texto, '\n+') LOOP
    l := btrim(regexp_replace(l, '^\s*[-*•]\s*', ''));
    CONTINUE WHEN length(l) < 2;
    v_proc := NULL; v_loinc := NULL;
    IF private.unidade_tem_catalogo_exames(NEW.unidade_id) THEN
      SELECT eu.procedimento, eu.loinc INTO v_proc, v_loinc FROM public.exames_unidade eu
       WHERE eu.unidade_id = NEW.unidade_id AND eu.vigente_ate IS NULL
         AND terminologia.unaccent_text(lower(eu.nome_curto)) = terminologia.unaccent_text(lower(l)) LIMIT 1;
    ELSE
      SELECT sp.codigo INTO v_proc FROM terminologia.sigtap_procedimento sp
       WHERE sp.codigo LIKE '0202%' AND terminologia.unaccent_text(lower(sp.nome)) = terminologia.unaccent_text(lower(l)) LIMIT 1;
    END IF;
    INSERT INTO public.exames_pedidos (unidade_id, paciente_id, episodio_id, internacao_id, documento_id, exame, procedimento, loinc, pedido_por)
    VALUES (NEW.unidade_id, NEW.paciente_id, NEW.episodio_id, NEW.internacao_id, NEW.id, left(l, 200), v_proc, v_loinc, NEW.autor_id);
  END LOOP;
  RETURN NEW;
END $$;

-- o painel do atendimento passa a levar código, urgência e observação
DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('public.painel_atendimento_ps(uuid)'::regprocedure), E'\r', '');
  antigo := '''impresso'', x.documento_id IS NOT NULL, ''pedido_por'', pp.nome_completo)';
  novo := '''impresso'', x.documento_id IS NOT NULL, ''pedido_por'', pp.nome_completo,'
       || ' ''procedimento'', x.procedimento, ''urgencia'', x.urgencia, ''observacao'', x.observacao)';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'painel_atendimento_ps mudou: trecho dos exames não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;
