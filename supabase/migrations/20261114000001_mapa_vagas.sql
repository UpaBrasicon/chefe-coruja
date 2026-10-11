-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4, tarefa 8 — mapa simples de vagas (decisões do RT de 11/10/2026,
-- BACKLOG.md).
--
-- • O gestor da unidade marca cada setor ofertado à regulação com um tipo da
--   lista de leitos da regulação. Setor não marcado fica fora do mapa.
-- • Leitos em tempo real, do mapa de leitos: livre (a vaga), reservado, em
--   higienização, bloqueado e ocupado, com o total, por unidade e por tipo.
-- • Serviços da unidade (disponibilidade manual): cadastro com tipo e SIGTAP
--   opcional; situação disponível, restrito ou indisponível, vagas e
--   observação; hora e autor; "desatualizado" depois de 12 h sem confirmar.
-- • Veem a rede: o regulador e o gestor da central, e o gestor de cada unidade
--   (que edita só a dele). Só números, sem nome de paciente. Só consulta: a
--   reserva e o aceite são da unidade destino (tarefa 9).
-- ════════════════════════════════════════════════════════════════════════════

-- ── setor ofertado à regulação ──────────────────────────────────────────────
ALTER TABLE public.setores
  ADD COLUMN IF NOT EXISTS regulacao_tipo_leito text
    CHECK (regulacao_tipo_leito IN ('clinico', 'cirurgico', 'pediatrico', 'obstetrico', 'psiquiatrico',
                                    'uti_adulto', 'uti_pediatrica', 'uti_neonatal',
                                    'uci_adulto', 'uci_pediatrica', 'uci_neonatal',
                                    'uti_queimados', 'unidade_coronariana', 'outro')),
  ADD COLUMN IF NOT EXISTS regulacao_ofertado_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS regulacao_ofertado_em timestamptz;

-- ── serviços da unidade ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulacao_servicos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  nome            text NOT NULL CHECK (length(btrim(nome)) >= 3),
  tipo            text NOT NULL CHECK (tipo IN ('exame', 'consulta', 'procedimento', 'cirurgia', 'outro')),
  procedimento    text CHECK (procedimento ~ '^\d{10}$'),
  situacao        text NOT NULL CHECK (situacao IN ('disponivel', 'restrito', 'indisponivel')),
  vagas           integer CHECK (vagas BETWEEN 0 AND 9999),
  observacao      text,
  ativo           boolean NOT NULL DEFAULT true,
  criado_por      uuid NOT NULL REFERENCES public.perfis(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_por  uuid NOT NULL REFERENCES public.perfis(id),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  confirmado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regulacao_servicos ON public.regulacao_servicos (unidade_id) WHERE ativo;
ALTER TABLE public.regulacao_servicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_servicos FROM anon, authenticated;

-- cada mudança e confirmação, só inserção
CREATE TABLE IF NOT EXISTS public.regulacao_servicos_historico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id  uuid NOT NULL REFERENCES public.regulacao_servicos(id),
  acao        text NOT NULL CHECK (acao IN ('criado', 'atualizado', 'confirmado', 'desativado')),
  situacao    text,
  vagas       integer,
  observacao  text,
  por         uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regulacao_servicos_historico ON public.regulacao_servicos_historico (servico_id, em);
DROP TRIGGER IF EXISTS trg_regulacao_servicos_historico_so_insercao ON public.regulacao_servicos_historico;
CREATE TRIGGER trg_regulacao_servicos_historico_so_insercao BEFORE UPDATE OR DELETE ON public.regulacao_servicos_historico
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.regulacao_servicos_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regulacao_servicos_historico FROM anon, authenticated;

-- ── apoio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_servico_json(v public.regulacao_servicos)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', v.id, 'nome', v.nome, 'tipo', v.tipo, 'procedimento', v.procedimento,
    'procedimento_nome', (SELECT p.nome FROM terminologia.sigtap_procedimento p WHERE p.codigo = v.procedimento),
    'situacao', v.situacao, 'vagas', v.vagas, 'observacao', v.observacao,
    'atualizado_em', v.atualizado_em, 'atualizado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = v.atualizado_por),
    'confirmado_em', greatest(v.atualizado_em, v.confirmado_em),
    'desatualizado', greatest(v.atualizado_em, v.confirmado_em) < now() - interval '12 hours')
$$;
REVOKE ALL ON FUNCTION private.regulacao_servico_json(public.regulacao_servicos) FROM PUBLIC, anon, authenticated;

-- Contagem dos leitos ofertados de uma unidade, por tipo da regulação.
CREATE OR REPLACE FUNCTION private.regulacao_leitos_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo_leito', x.tipo, 'livre', x.livre, 'reservado', x.reservado,
           'higienizacao', x.higienizacao, 'bloqueado', x.bloqueado, 'ocupado', x.ocupado, 'total', x.total) ORDER BY x.tipo), '[]'::jsonb)
    FROM (SELECT st.regulacao_tipo_leito AS tipo,
                 count(*) FILTER (WHERE l.status = 'livre') AS livre,
                 count(*) FILTER (WHERE l.status = 'reservado') AS reservado,
                 count(*) FILTER (WHERE l.status = 'higienizacao') AS higienizacao,
                 count(*) FILTER (WHERE l.status = 'bloqueado') AS bloqueado,
                 count(*) FILTER (WHERE l.status = 'ocupado') AS ocupado,
                 count(*) AS total
            FROM public.setores st JOIN public.leitos l ON l.setor_id = st.id AND l.ativo
           WHERE st.unidade_id = p_unidade AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL
           GROUP BY st.regulacao_tipo_leito) x
$$;
REVOKE ALL ON FUNCTION private.regulacao_leitos_unidade(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.regulacao_gestor_servico(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.tenho_papel(p_unidade, 'gestor') THEN
    RAISE EXCEPTION 'Quem informa a oferta da unidade é o gestor dela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_gestor_servico(uuid) FROM PUBLIC, anon, authenticated;

-- ── oferta dos setores (gestor da unidade) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.regulacao_setores_oferta(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_gestor_servico(p_unidade);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', st.id, 'nome', st.nome, 'tipo', st.tipo, 'especialidade', st.especialidade, 'publico', st.publico,
      'regulacao_tipo_leito', st.regulacao_tipo_leito, 'ofertado_em', st.regulacao_ofertado_em,
      'ofertado_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = st.regulacao_ofertado_por),
      'leitos', (SELECT count(*) FROM public.leitos l WHERE l.setor_id = st.id AND l.ativo))
      ORDER BY st.ordem, st.nome)
    FROM public.setores st WHERE st.unidade_id = p_unidade AND st.ativo), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_setores_oferta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_setores_oferta(uuid) TO authenticated;

-- p_tipo_leito nulo tira o setor do mapa.
CREATE OR REPLACE FUNCTION public.regulacao_ofertar_setor(p_setor uuid, p_tipo_leito text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, regulacao_tipo_leito INTO v_unidade, v_antes FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  PERFORM private.regulacao_gestor_servico(v_unidade);
  IF p_tipo_leito IS NOT NULL AND p_tipo_leito NOT IN ('clinico', 'cirurgico', 'pediatrico', 'obstetrico', 'psiquiatrico',
       'uti_adulto', 'uti_pediatrica', 'uti_neonatal', 'uci_adulto', 'uci_pediatrica', 'uci_neonatal',
       'uti_queimados', 'unidade_coronariana', 'outro') THEN
    RAISE EXCEPTION 'Tipo de leito fora da lista da regulação.';
  END IF;
  UPDATE public.setores
     SET regulacao_tipo_leito = p_tipo_leito,
         regulacao_ofertado_por = CASE WHEN p_tipo_leito IS NULL THEN NULL ELSE private.meu_perfil_id() END,
         regulacao_ofertado_em = CASE WHEN p_tipo_leito IS NULL THEN NULL ELSE now() END
   WHERE id = p_setor;
  PERFORM private.registrar_auditoria('regulacao_setor_ofertado', 'setores', p_setor, v_unidade,
    jsonb_build_object('anterior', v_antes, 'tipo', p_tipo_leito));
END $$;
REVOKE ALL ON FUNCTION public.regulacao_ofertar_setor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_ofertar_setor(uuid, text) TO authenticated;

-- ── serviços (gestor da unidade) ────────────────────────────────────────────
-- p_id nulo cria. p_dados: nome, tipo, procedimento, situacao, vagas, observacao.
CREATE OR REPLACE FUNCTION public.regulacao_salvar_servico(p_unidade uuid, p_id uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v public.regulacao_servicos;
  v_proc text := nullif(btrim(coalesce(d->>'procedimento', '')), '');
  v_vagas integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_gestor_servico(p_unidade);
  IF length(btrim(coalesce(d->>'nome', ''))) < 3 THEN RAISE EXCEPTION 'Escreva o nome do serviço.'; END IF;
  IF coalesce(d->>'tipo', '') NOT IN ('exame', 'consulta', 'procedimento', 'cirurgia', 'outro') THEN
    RAISE EXCEPTION 'Tipo: exame, consulta, procedimento, cirurgia ou outro.';
  END IF;
  IF coalesce(d->>'situacao', '') NOT IN ('disponivel', 'restrito', 'indisponivel') THEN
    RAISE EXCEPTION 'Situação: disponível, restrito ou indisponível.';
  END IF;
  IF v_proc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento p WHERE p.codigo = v_proc) THEN
    RAISE EXCEPTION 'Procedimento SIGTAP não encontrado.';
  END IF;
  IF nullif(d->>'vagas', '') IS NOT NULL THEN
    IF (d->>'vagas') !~ '^\d{1,4}$' THEN RAISE EXCEPTION 'Vagas: número de 0 a 9999, ou vazio.'; END IF;
    v_vagas := (d->>'vagas')::integer;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.regulacao_servicos (unidade_id, nome, tipo, procedimento, situacao, vagas, observacao, criado_por, atualizado_por)
    VALUES (p_unidade, btrim(d->>'nome'), d->>'tipo', v_proc, d->>'situacao', v_vagas, nullif(btrim(coalesce(d->>'observacao', '')), ''),
            private.meu_perfil_id(), private.meu_perfil_id())
    RETURNING * INTO v;
    INSERT INTO public.regulacao_servicos_historico (servico_id, acao, situacao, vagas, observacao, por)
    VALUES (v.id, 'criado', v.situacao, v.vagas, v.observacao, private.meu_perfil_id());
  ELSE
    UPDATE public.regulacao_servicos
       SET nome = btrim(d->>'nome'), tipo = d->>'tipo', procedimento = v_proc, situacao = d->>'situacao', vagas = v_vagas,
           observacao = nullif(btrim(coalesce(d->>'observacao', '')), ''),
           atualizado_por = private.meu_perfil_id(), atualizado_em = now(), confirmado_em = now()
     WHERE id = p_id AND unidade_id = p_unidade AND ativo
    RETURNING * INTO v;
    IF v.id IS NULL THEN RAISE EXCEPTION 'Serviço não encontrado.'; END IF;
    INSERT INTO public.regulacao_servicos_historico (servico_id, acao, situacao, vagas, observacao, por)
    VALUES (v.id, 'atualizado', v.situacao, v.vagas, v.observacao, private.meu_perfil_id());
  END IF;
  RETURN v.id;
END $$;
REVOKE ALL ON FUNCTION public.regulacao_salvar_servico(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_salvar_servico(uuid, uuid, jsonb) TO authenticated;

-- Confirma que a situação continua a mesma (renova o prazo de 12 h).
CREATE OR REPLACE FUNCTION public.regulacao_confirmar_servico(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.regulacao_servicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.regulacao_servicos WHERE id = p_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado.'; END IF;
  PERFORM private.regulacao_gestor_servico(v.unidade_id);
  UPDATE public.regulacao_servicos SET confirmado_em = now() WHERE id = p_id;
  INSERT INTO public.regulacao_servicos_historico (servico_id, acao, situacao, vagas, observacao, por)
  VALUES (v.id, 'confirmado', v.situacao, v.vagas, v.observacao, private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_confirmar_servico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_confirmar_servico(uuid) TO authenticated;

-- Tira o serviço do mapa (fica guardado com o histórico).
CREATE OR REPLACE FUNCTION public.regulacao_desativar_servico(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.regulacao_servicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.regulacao_servicos WHERE id = p_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço não encontrado.'; END IF;
  PERFORM private.regulacao_gestor_servico(v.unidade_id);
  UPDATE public.regulacao_servicos SET ativo = false, atualizado_por = private.meu_perfil_id(), atualizado_em = now() WHERE id = p_id;
  INSERT INTO public.regulacao_servicos_historico (servico_id, acao, situacao, vagas, observacao, por)
  VALUES (v.id, 'desativado', v.situacao, v.vagas, v.observacao, private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_desativar_servico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_desativar_servico(uuid) TO authenticated;

-- ── mapa da rede ────────────────────────────────────────────────────────────
-- p_unidade: a unidade ativa de quem consulta. Veem: regulador e gestor da
-- central, gestor de qualquer unidade da organização, super admin.
CREATE OR REPLACE FUNCTION public.regulacao_mapa_vagas(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid; v_central uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  SELECT c.unidade_id INTO v_central FROM public.centrais_regulacao c WHERE c.organizacao_id = v_org;
  IF NOT (private.eh_super_admin()
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
          'editavel', private.tenho_papel(u.id, 'gestor'),
          'minha', u.id = p_unidade) AS j
          FROM public.unidades u
         WHERE u.organizacao_id = v_org AND u.id IS DISTINCT FROM v_central
           AND (u.id = p_unidade
                OR EXISTS (SELECT 1 FROM public.setores st WHERE st.unidade_id = u.id AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL)
                OR EXISTS (SELECT 1 FROM public.regulacao_servicos v WHERE v.unidade_id = u.id AND v.ativo))) x), '[]'::jsonb),
    -- vagas da rede por tipo de leito
    'totais', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo_leito', t.tipo, 'livre', t.livre, 'higienizacao', t.hig, 'total', t.total) ORDER BY t.tipo)
        FROM (SELECT st.regulacao_tipo_leito AS tipo, count(*) FILTER (WHERE l.status = 'livre') AS livre,
                     count(*) FILTER (WHERE l.status = 'higienizacao') AS hig, count(*) AS total
                FROM public.setores st JOIN public.unidades u ON u.id = st.unidade_id AND u.organizacao_id = v_org
                JOIN public.leitos l ON l.setor_id = st.id AND l.ativo
               WHERE st.ativo AND st.regulacao_tipo_leito IS NOT NULL
               GROUP BY st.regulacao_tipo_leito) t), '[]'::jsonb),
    'agora', now());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_mapa_vagas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_mapa_vagas(uuid) TO authenticated;
