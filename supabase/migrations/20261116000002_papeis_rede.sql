-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 12 — papéis de rede como módulo (decisões do RT de
-- 11/10/2026, BACKLOG.md).
--
-- • Papéis: Secretaria, Regulação regional e Faturamento da secretaria.
-- • O super admin liga o módulo na organização, aponta a unidade
--   administrativa "Secretaria" e cadastra as pessoas de rede (convite só
--   nela). O gestor de cada unidade decide se a unidade entra (ou sai) do
--   alcance dos papéis de rede. Tudo auditado.
-- • Escala: todo mundo tem escala, menos administrador e gestor. Os papéis de
--   rede são escalados na Secretaria; fora do plantão, nada abre.
-- • O que veem (só das unidades liberadas):
--   - Secretaria: agregados (mapa de vagas, regulações por unidade), sem
--     nome nem prontuário;
--   - Regulação regional: também a lista nominal dos pedidos, só leitura,
--     com o acesso registrado;
--   - Faturamento da secretaria: produção por unidade e competência e os
--     arquivos já fechados (BPA, APAC), só leitura.
-- ════════════════════════════════════════════════════════════════════════════

-- ── módulo por organização ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_modulo (
  organizacao_id         uuid PRIMARY KEY REFERENCES public.organizacoes(id),
  ativo                  boolean NOT NULL DEFAULT false,
  secretaria_unidade_id  uuid UNIQUE REFERENCES public.unidades(id),
  alterado_por           uuid NOT NULL REFERENCES public.perfis(id),
  alterado_em            timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT ativo OR secretaria_unidade_id IS NOT NULL)
);
ALTER TABLE public.rede_modulo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rede_modulo FROM anon, authenticated;

-- liberação de cada unidade pelo gestor
CREATE TABLE IF NOT EXISTS public.rede_unidades_liberadas (
  unidade_id    uuid PRIMARY KEY REFERENCES public.unidades(id),
  liberada      boolean NOT NULL,
  alterado_por  uuid NOT NULL REFERENCES public.perfis(id),
  alterado_em   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rede_unidades_liberadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rede_unidades_liberadas FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rede_liberacoes_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id),
  liberada    boolean NOT NULL,
  por         uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_rede_liberacoes_historico_so_insercao ON public.rede_liberacoes_historico;
CREATE TRIGGER trg_rede_liberacoes_historico_so_insercao BEFORE UPDATE OR DELETE ON public.rede_liberacoes_historico
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.rede_liberacoes_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rede_liberacoes_historico FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.eh_papel_rede(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p IN ('secretaria', 'regulacao_regional', 'faturamento_rede')
$$;

-- papel de rede só na unidade Secretaria de uma organização
CREATE OR REPLACE FUNCTION private.vinculo_papel_rede()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.eh_papel_rede(NEW.papel::text)
     AND NOT EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = NEW.unidade_id) THEN
    RAISE EXCEPTION 'Papel de rede só na unidade Secretaria da organização.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vinculo_papel_rede ON public.vinculos;
CREATE TRIGGER trg_vinculo_papel_rede BEFORE INSERT OR UPDATE OF papel, unidade_id ON public.vinculos
  FOR EACH ROW EXECUTE FUNCTION private.vinculo_papel_rede();

-- Confere o acesso de rede: módulo ligado, p_unidade é a Secretaria, a pessoa
-- tem um dos papéis nela e está no plantão (escala). Devolve a organização.
CREATE OR REPLACE FUNCTION private.rede_exigir(p_unidade uuid, p_papeis text[])
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.rede_modulo;
BEGIN
  SELECT * INTO m FROM public.rede_modulo WHERE secretaria_unidade_id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta unidade não é a Secretaria da rede.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT m.ativo THEN RAISE EXCEPTION 'O módulo de rede está desligado nesta organização.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(p_papeis) x WHERE private.tenho_papel(p_unidade, x)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT private.na_escala_agora(p_unidade) THEN
    RAISE EXCEPTION 'Fora do plantão: os papéis de rede entram pela escala.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN m.organizacao_id;
END $$;
REVOKE ALL ON FUNCTION private.rede_exigir(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- unidades liberadas pelos gestores na organização
CREATE OR REPLACE FUNCTION private.rede_unidades(p_org uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id FROM public.unidades u JOIN public.rede_unidades_liberadas l ON l.unidade_id = u.id AND l.liberada
   WHERE u.organizacao_id = p_org AND u.ativo
$$;
REVOKE ALL ON FUNCTION private.rede_unidades(uuid) FROM PUBLIC, anon, authenticated;

-- ── convite: papel de rede só pelo super admin, na Secretaria ───────────────
CREATE OR REPLACE FUNCTION public.gerar_convite(p_unidade uuid, p_papel public.papel, p_setor uuid DEFAULT NULL,
  p_para_quem text DEFAULT NULL, p_primeiro_plantao_inicio timestamptz DEFAULT NULL, p_primeiro_plantao_fim timestamptz DEFAULT NULL,
  p_validade_dias integer DEFAULT 7)
RETURNS TABLE(id uuid, codigo text, expira_em timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- sem 0/O, 1/I/L
  v_codigo text;
  v_bytes  bytea;
  v_id     uuid;
  v_expira timestamptz;
  v_secretaria boolean;
  i int;
BEGIN
  IF auth.uid() IS NULL OR NOT private.pode_gerir_convites(p_unidade) THEN
    RAISE EXCEPTION 'Só o gestor da unidade gera convite para ela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_papel IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Gestão e administração entram pelo contrato da rede, não por convite.';
  END IF;
  -- Fase 4, tarefa 12: pessoas de rede, só pelo super admin e só na Secretaria
  v_secretaria := EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade);
  IF private.eh_papel_rede(p_papel::text) THEN
    IF NOT private.eh_super_admin() THEN
      RAISE EXCEPTION 'Pessoas de rede são cadastradas pelo administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT v_secretaria THEN RAISE EXCEPTION 'Papel de rede só na unidade Secretaria da organização.'; END IF;
  ELSIF v_secretaria THEN
    RAISE EXCEPTION 'Na unidade Secretaria entram só os papéis de rede.';
  END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = p_setor AND s.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'O setor não é desta unidade.';
  END IF;
  IF p_validade_dias IS NULL OR p_validade_dias NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'A validade do convite vai de 1 a 30 dias.';
  END IF;
  IF p_primeiro_plantao_fim IS NOT NULL AND (p_primeiro_plantao_inicio IS NULL OR p_primeiro_plantao_fim <= p_primeiro_plantao_inicio) THEN
    RAISE EXCEPTION 'O fim do primeiro plantão vem depois do início.';
  END IF;

  v_expira := now() + make_interval(days => p_validade_dias);
  LOOP
    v_bytes := extensions.gen_random_bytes(5);
    v_codigo := 'CC-';
    FOR i IN 0..4 LOOP
      v_codigo := v_codigo || substr(alfabeto, (get_byte(v_bytes, i) % length(alfabeto)) + 1, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.convites (codigo, unidade_id, setor_id, papel, para_quem,
                                   primeiro_plantao_inicio, primeiro_plantao_fim, criado_por, expira_em)
      VALUES (v_codigo, p_unidade, p_setor, p_papel, nullif(btrim(p_para_quem), ''),
              p_primeiro_plantao_inicio, p_primeiro_plantao_fim, auth.uid(), v_expira)
      RETURNING convites.id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- código repetido (raro): sorteia outro
    END;
  END LOOP;

  PERFORM private.registrar_auditoria('gerar_convite', 'convites', v_id, p_unidade,
    jsonb_build_object('papel', p_papel, 'setor_id', p_setor));
  RETURN QUERY SELECT v_id, v_codigo, v_expira;
END $$;

-- ── super admin: liga o módulo e aponta a Secretaria ────────────────────────
CREATE OR REPLACE FUNCTION public.rede_modulos()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'organizacao', jsonb_build_object('id', o.id, 'nome', o.nome),
      'ativo', coalesce(m.ativo, false),
      'secretaria', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = m.secretaria_unidade_id),
      'alterado_em', m.alterado_em,
      'alterado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = m.alterado_por),
      'unidades', coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome,
                     'liberada', coalesce((SELECT l.liberada FROM public.rede_unidades_liberadas l WHERE l.unidade_id = u.id), false)) ORDER BY u.nome)
                     FROM public.unidades u WHERE u.organizacao_id = o.id AND u.ativo), '[]'::jsonb),
      'pessoas', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', p.nome_completo, 'papel', v.papel) ORDER BY p.nome_completo)
                     FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
                    WHERE v.unidade_id = m.secretaria_unidade_id AND v.ativo AND private.eh_papel_rede(v.papel::text)), '[]'::jsonb))
      ORDER BY o.nome)
    FROM public.organizacoes o LEFT JOIN public.rede_modulo m ON m.organizacao_id = o.id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rede_modulos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_modulos() TO authenticated;

CREATE OR REPLACE FUNCTION public.rede_definir_modulo(p_org uuid, p_ativo boolean, p_secretaria uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_antes public.rede_modulo;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Quem liga o módulo de rede é o administrador da plataforma.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_secretaria IS NULL AND p_ativo THEN RAISE EXCEPTION 'Para ligar, escolha a unidade Secretaria.'; END IF;
  IF p_secretaria IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_secretaria AND u.organizacao_id = p_org AND u.ativo) THEN
      RAISE EXCEPTION 'A Secretaria precisa ser uma unidade ativa desta organização.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_secretaria) THEN
      RAISE EXCEPTION 'A Central de Regulação não pode ser a Secretaria.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = p_secretaria AND v.ativo
                 AND NOT private.eh_papel_rede(v.papel::text) AND v.papel NOT IN ('admin')) THEN
      RAISE EXCEPTION 'Use uma unidade administrativa só para a Secretaria: esta já tem equipe de atendimento.';
    END IF;
  END IF;
  SELECT * INTO v_antes FROM public.rede_modulo WHERE organizacao_id = p_org;
  IF v_antes.secretaria_unidade_id IS NOT NULL AND v_antes.secretaria_unidade_id IS DISTINCT FROM p_secretaria
     AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.unidade_id = v_antes.secretaria_unidade_id AND v.ativo
                   AND private.eh_papel_rede(v.papel::text)) THEN
    RAISE EXCEPTION 'A Secretaria atual tem pessoas de rede: desative os vínculos antes de trocar.';
  END IF;
  INSERT INTO public.rede_modulo (organizacao_id, ativo, secretaria_unidade_id, alterado_por, alterado_em)
  VALUES (p_org, p_ativo, p_secretaria, private.meu_perfil_id(), now())
  ON CONFLICT (organizacao_id) DO UPDATE SET ativo = excluded.ativo, secretaria_unidade_id = excluded.secretaria_unidade_id,
    alterado_por = excluded.alterado_por, alterado_em = now();
  -- a escala da Secretaria precisa de um setor
  IF p_secretaria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.unidade_id = p_secretaria) THEN
    INSERT INTO public.setores (unidade_id, nome, tipo) VALUES (p_secretaria, 'Secretaria', 'outro');
  END IF;
  PERFORM private.registrar_auditoria('rede_modulo_definido', 'rede_modulo', NULL, p_secretaria,
    jsonb_build_object('ativo', p_ativo, 'anterior', v_antes.ativo));
END $$;
REVOKE ALL ON FUNCTION public.rede_definir_modulo(uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_definir_modulo(uuid, boolean, uuid) TO authenticated;

-- ── gestor: libera ou retira a unidade ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rede_liberacao(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.rede_modulo; l public.rede_unidades_liberadas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT rm.* INTO m FROM public.rede_modulo rm JOIN public.unidades u ON u.organizacao_id = rm.organizacao_id WHERE u.id = p_unidade;
  SELECT * INTO l FROM public.rede_unidades_liberadas WHERE unidade_id = p_unidade;
  RETURN jsonb_build_object(
    'modulo_ativo', coalesce(m.ativo, false),
    'eh_secretaria', m.secretaria_unidade_id = p_unidade,
    'secretaria', (SELECT u.nome FROM public.unidades u WHERE u.id = m.secretaria_unidade_id),
    'liberada', coalesce(l.liberada, false),
    'alterado_em', l.alterado_em,
    'alterado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = l.alterado_por),
    'pessoas', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', p.nome_completo, 'papel', v.papel) ORDER BY v.papel, p.nome_completo)
                 FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
                WHERE v.unidade_id = m.secretaria_unidade_id AND v.ativo AND private.eh_papel_rede(v.papel::text)), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.rede_liberacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_liberacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rede_liberar_unidade(p_unidade uuid, p_liberar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.rede_modulo;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN
    RAISE EXCEPTION 'Quem libera a unidade para os papéis de rede é o gestor dela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT rm.* INTO m FROM public.rede_modulo rm JOIN public.unidades u ON u.organizacao_id = rm.organizacao_id WHERE u.id = p_unidade;
  IF p_liberar AND NOT coalesce(m.ativo, false) THEN RAISE EXCEPTION 'O módulo de rede está desligado nesta organização.'; END IF;
  IF m.secretaria_unidade_id = p_unidade THEN RAISE EXCEPTION 'A Secretaria não é liberada para si mesma.'; END IF;
  INSERT INTO public.rede_unidades_liberadas (unidade_id, liberada, alterado_por, alterado_em)
  VALUES (p_unidade, p_liberar, private.meu_perfil_id(), now())
  ON CONFLICT (unidade_id) DO UPDATE SET liberada = excluded.liberada, alterado_por = excluded.alterado_por, alterado_em = now();
  INSERT INTO public.rede_liberacoes_historico (unidade_id, liberada, por) VALUES (p_unidade, p_liberar, private.meu_perfil_id());
  PERFORM private.registrar_auditoria(CASE WHEN p_liberar THEN 'rede_unidade_liberada' ELSE 'rede_unidade_retirada' END,
    'rede_unidades_liberadas', NULL, p_unidade, jsonb_build_object('ativo', p_liberar));
END $$;
REVOKE ALL ON FUNCTION public.rede_liberar_unidade(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_liberar_unidade(uuid, boolean) TO authenticated;

-- ── pessoas de rede ─────────────────────────────────────────────────────────
-- Contexto da tela Rede (sem exigir o plantão, para a tela explicar o motivo).
CREATE OR REPLACE FUNCTION public.rede_contexto(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.rede_modulo;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO m FROM public.rede_modulo WHERE secretaria_unidade_id = p_unidade;
  RETURN jsonb_build_object(
    'eh_secretaria', m.organizacao_id IS NOT NULL,
    'modulo_ativo', coalesce(m.ativo, false),
    'papeis', coalesce((SELECT jsonb_agg(v.papel ORDER BY v.papel) FROM public.vinculos v
                         WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo
                           AND private.eh_papel_rede(v.papel::text)), '[]'::jsonb),
    'no_plantao', private.na_escala_agora(p_unidade),
    'unidades', CASE WHEN m.ativo THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes) ORDER BY u.nome)
                   FROM public.unidades u WHERE u.id IN (SELECT private.rede_unidades(m.organizacao_id))), '[]'::jsonb) ELSE '[]'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.rede_contexto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_contexto(uuid) TO authenticated;

-- Regulações por unidade liberada, só contagens (Secretaria e Regulação regional).
CREATE OR REPLACE FUNCTION public.rede_regulacao_resumo(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_org := private.rede_exigir(p_unidade, ARRAY['secretaria', 'regulacao_regional']);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'unidade', jsonb_build_object('id', u.id, 'nome', u.nome),
      'como_origem', (SELECT jsonb_build_object(
          'esperando_central', count(*) FILTER (WHERE s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida')),
          'aguardando_destino', count(*) FILTER (WHERE s.status = 'aguardando_destino'),
          'a_caminho', count(*) FILTER (WHERE s.status IN ('autorizada', 'agendada', 'em_transito')),
          'atrasados', count(*) FILTER (WHERE (private.regulacao_sla(s)->>'atrasado_origem')::boolean
                                          OR (private.regulacao_sla(s)->>'atrasado_central')::boolean),
          'realizados_30d', count(*) FILTER (WHERE s.status = 'realizada' AND s.realizada_em > now() - interval '30 days'))
        FROM public.regulacao_solicitacoes s WHERE s.unidade_origem_id = u.id),
      'como_destino', (SELECT jsonb_build_object(
          'aguardando_aceite', count(*) FILTER (WHERE s.status = 'aguardando_destino'),
          'a_caminho', count(*) FILTER (WHERE s.status IN ('autorizada', 'agendada', 'em_transito')),
          'recebidos_30d', count(*) FILTER (WHERE s.status = 'realizada' AND s.realizada_em > now() - interval '30 days'))
        FROM public.regulacao_solicitacoes s WHERE s.destino_unidade_id = u.id))
      ORDER BY u.nome)
    FROM public.unidades u WHERE u.id IN (SELECT private.rede_unidades(v_org))), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rede_regulacao_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_regulacao_resumo(uuid) TO authenticated;

-- Lista nominal dos pedidos (só Regulação regional): origem ou destino liberados.
CREATE OR REPLACE FUNCTION public.rede_regulacoes(p_unidade uuid, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; f jsonb := coalesce(p_filtros, '{}'::jsonb); v_abertos boolean := coalesce((f->>'so_abertos')::boolean, true);
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_org := private.rede_exigir(p_unidade, ARRAY['regulacao_regional']);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'numero', s.numero, 'status', s.status, 'tipo', s.tipo, 'tipo_leito', s.tipo_leito,
      'procedimento', s.procedimento, 'especialidade', s.especialidade,
      'prioridade', s.prioridade, 'prioridade_regulador', s.prioridade_regulador,
      'paciente', (SELECT jsonb_build_object('nome', coalesce(pa.nome_social, pa.nome)) FROM public.pacientes pa WHERE pa.id = s.paciente_id),
      'paciente_nao_identificado', s.paciente_nao_identificado,
      'origem', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.unidade_origem_id),
      'destino', (SELECT jsonb_build_object('id', u.id, 'nome', u.nome) FROM public.unidades u WHERE u.id = s.destino_unidade_id),
      'destino_externo', s.destino_externo, 'criada_em', s.criada_em, 'sla', private.regulacao_sla(s))
      ORDER BY s.criada_em DESC)
    FROM (SELECT * FROM public.regulacao_solicitacoes x
           WHERE x.organizacao_id = v_org
             AND (x.unidade_origem_id IN (SELECT private.rede_unidades(v_org)) OR x.destino_unidade_id IN (SELECT private.rede_unidades(v_org)))
             AND (NOT v_abertos OR x.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada', 'em_transito'))
             AND (NOT f ? 'unidade_id' OR x.unidade_origem_id = (f->>'unidade_id')::uuid OR x.destino_unidade_id = (f->>'unidade_id')::uuid)
           ORDER BY x.criada_em DESC LIMIT 300) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rede_regulacoes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_regulacoes(uuid, jsonb) TO authenticated;

-- Detalhe só leitura, com o acesso registrado no prontuário da origem.
CREATE OR REPLACE FUNCTION public.rede_regulacao_detalhe(p_unidade uuid, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; s public.regulacao_solicitacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_org := private.rede_exigir(p_unidade, ARRAY['regulacao_regional']);
  SELECT * INTO s FROM public.regulacao_solicitacoes x
   WHERE x.id = p_id AND x.organizacao_id = v_org
     AND (x.unidade_origem_id IN (SELECT private.rede_unidades(v_org)) OR x.destino_unidade_id IN (SELECT private.rede_unidades(v_org)));
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  INSERT INTO public.log_acesso_prontuario (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso)
  VALUES (s.organizacao_id, s.unidade_origem_id, s.paciente_id, private.meu_perfil_id(), 'regulacao_regional', 'leitura_prontuario');
  RETURN private.regulacao_json(s) || jsonb_build_object(
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = e.por), 'em', e.em)
        ORDER BY e.em) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id), '[]'::jsonb),
    'origem_pode_responder', false, 'sou_destino', false);
END $$;
REVOKE ALL ON FUNCTION public.rede_regulacao_detalhe(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_regulacao_detalhe(uuid, uuid) TO authenticated;

-- Produção por unidade liberada e competência (Faturamento da secretaria).
CREATE OR REPLACE FUNCTION public.rede_faturamento(p_unidade uuid, p_competencia text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_org := private.rede_exigir(p_unidade, ARRAY['faturamento_rede']);
  IF p_competencia IS NULL OR p_competencia !~ '^\d{4}(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência no formato AAAAMM.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'unidade', jsonb_build_object('id', u.id, 'nome', u.nome, 'cnes', u.cnes),
      'bpa', (SELECT jsonb_build_object('id', b.id, 'situacao', b.situacao, 'linhas', b.linhas, 'linhas_bpa_c', b.linhas_bpa_c,
                     'folhas', b.folhas, 'fechado_em', b.fechado_em, 'tem_arquivo', b.arquivo IS NOT NULL)
                FROM public.bpa_fechamentos b WHERE b.unidade_id = u.id AND b.competencia = p_competencia ORDER BY b.fechado_em DESC LIMIT 1),
      'apac', (SELECT jsonb_build_object('id', a.id, 'situacao', a.situacao, 'apacs', a.apacs, 'fechado_em', a.fechado_em,
                      'tem_arquivo', a.arquivo IS NOT NULL)
                 FROM public.apac_fechamentos a WHERE a.unidade_id = u.id AND a.competencia = p_competencia ORDER BY a.fechado_em DESC LIMIT 1),
      'aih', coalesce((SELECT jsonb_object_agg(x.status, x.n) FROM (SELECT ai.status, count(*) AS n FROM public.aihs ai
                         WHERE ai.unidade_id = u.id AND ai.competencia = p_competencia GROUP BY ai.status) x), '{}'::jsonb),
      'apacs_status', coalesce((SELECT jsonb_object_agg(x.status, x.n) FROM (SELECT ap.status, count(*) AS n FROM public.apacs ap
                         WHERE ap.unidade_id = u.id AND to_char(coalesce(ap.validade_inicio, ap.solicitada_em::date), 'YYYYMM') = p_competencia
                         GROUP BY ap.status) x), '{}'::jsonb))
      ORDER BY u.nome)
    FROM public.unidades u WHERE u.id IN (SELECT private.rede_unidades(v_org))), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rede_faturamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_faturamento(uuid, text) TO authenticated;

-- Arquivo já fechado (BPA ou APAC) de uma unidade liberada; o download fica auditado.
CREATE OR REPLACE FUNCTION public.rede_baixar_arquivo(p_unidade uuid, p_tipo text, p_fechamento uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; v_un uuid; v_comp text; v_arq text; v_sit text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  v_org := private.rede_exigir(p_unidade, ARRAY['faturamento_rede']);
  IF p_tipo = 'bpa' THEN
    SELECT unidade_id, competencia, arquivo, situacao INTO v_un, v_comp, v_arq, v_sit FROM public.bpa_fechamentos WHERE id = p_fechamento;
  ELSIF p_tipo = 'apac' THEN
    SELECT unidade_id, competencia, arquivo, situacao INTO v_un, v_comp, v_arq, v_sit FROM public.apac_fechamentos WHERE id = p_fechamento;
  ELSE
    RAISE EXCEPTION 'Tipo de arquivo: bpa ou apac.';
  END IF;
  IF v_un IS NULL OR v_un NOT IN (SELECT private.rede_unidades(v_org)) THEN RAISE EXCEPTION 'Arquivo não encontrado.'; END IF;
  IF v_sit <> 'fechada' OR v_arq IS NULL THEN RAISE EXCEPTION 'Só arquivo de competência fechada.'; END IF;
  PERFORM private.registrar_auditoria('rede_arquivo_baixado', CASE WHEN p_tipo = 'bpa' THEN 'bpa_fechamentos' ELSE 'apac_fechamentos' END,
    p_fechamento, v_un, jsonb_build_object('tipo', p_tipo));
  RETURN jsonb_build_object('nome', upper(p_tipo) || '_' || coalesce((SELECT cnes FROM public.unidades WHERE id = v_un), 'unidade') || '_' || v_comp || '.txt',
                            'conteudo', v_arq);
END $$;
REVOKE ALL ON FUNCTION public.rede_baixar_arquivo(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_baixar_arquivo(uuid, text, uuid) TO authenticated;

-- ── mapa de vagas (tarefa 8) para a Secretaria e a Regulação regional ───────
CREATE OR REPLACE FUNCTION public.regulacao_mapa_vagas(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; v_central uuid; v_rede boolean := false;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c WHERE c.organizacao_id = v_org;
  IF EXISTS (SELECT 1 FROM public.rede_modulo m WHERE m.secretaria_unidade_id = p_unidade) THEN
    PERFORM private.rede_exigir(p_unidade, ARRAY['secretaria', 'regulacao_regional']);
    v_rede := true;
  ELSIF NOT (private.eh_super_admin()
          OR private.tenho_papel(p_unidade, 'gestor')
          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'unidades', coalesce((SELECT jsonb_agg(x.j ORDER BY x.nome) FROM (
        SELECT u.nome, jsonb_build_object(
          'id', u.id, 'nome', u.nome, 'cnes', u.cnes,
          'leitos', private.regulacao_leitos_unidade(u.id),
          'servicos', coalesce((SELECT jsonb_agg(private.regulacao_servico_json(v) ORDER BY v.tipo, v.nome)
                                  FROM public.regulacao_servicos v WHERE v.unidade_id = u.id AND v.ativo), '[]'::jsonb),
          'editavel', NOT v_rede AND private.tenho_papel(u.id, 'gestor'),
          'minha', u.id = p_unidade) AS j
          FROM public.unidades u
         WHERE u.organizacao_id = v_org AND u.id IS DISTINCT FROM v_central
           AND (NOT v_rede OR u.id IN (SELECT private.rede_unidades(v_org)))
           AND (u.id = p_unidade AND NOT v_rede
                OR EXISTS (SELECT 1 FROM public.setores st WHERE st.unidade_id = u.id AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL)
                OR EXISTS (SELECT 1 FROM public.regulacao_servicos v WHERE v.unidade_id = u.id AND v.ativo))) x), '[]'::jsonb),
    'totais', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_leito', t.tipo, 'livre', t.livre, 'higienizacao', t.hig, 'total', t.total) ORDER BY t.tipo)
        FROM (SELECT st.regulacao_tipo_leito AS tipo, count(*) FILTER (WHERE l.status = 'livre') AS livre,
                     count(*) FILTER (WHERE l.status = 'higienizacao') AS hig, count(*) AS total
                FROM public.setores st JOIN public.unidades u ON u.id = st.unidade_id AND u.organizacao_id = v_org
                JOIN public.leitos l ON l.setor_id = st.id AND l.ativo
               WHERE st.ativo AND st.regulacao_tipo_leito IS NOT NULL
                 AND (NOT v_rede OR u.id IN (SELECT private.rede_unidades(v_org)))
               GROUP BY st.regulacao_tipo_leito) t), '[]'::jsonb),
    'agora', now());
END $$;
