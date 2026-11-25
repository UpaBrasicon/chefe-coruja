-- ════════════════════════════════════════════════════════════════════════════
-- Regulação do médico regulador no modelo do RT (25/11/2026), RG2 e RG3.
--
-- RG2 — isolamento do pedido:
-- • dois tipos novos: reverso (protetor) e contato + aerossol (combinado);
-- • a situação (suspeito ou confirmado) e o agente ou motivo (texto curto);
-- • public.regulacao_definir_isolamento: quem pede (logo depois de enviar) e
--   o regulador da central gravam; fica na linha do tempo e na auditoria.
-- • A trava do leito segue igual: pedido com isolamento só aceita leito de
--   isolamento no destino, qualquer tipo (o combinado conta como contato e
--   aerossol). Só o rótulo aprende os tipos novos.
--
-- RG3 — leito com pressão negativa:
-- • leitos.pressao_negativa (padrão false). O leito de isolamento já existe
--   (leitos.tipo = 'isolamento'); não há coluna nova para ele, para não haver
--   duas marcas do mesmo fato. Quem edita é quem já edita o leito (a política
--   leitos_update decide; aqui só a permissão da coluna).
-- • O mapa de vagas passa a contar, por tipo de leito, os livres de
--   isolamento comum e os livres com pressão negativa
--   (private.regulacao_leitos_unidade: chaves novas, as antigas iguais).
-- • public.regulacao_vagas_compativeis(p_central): unidades da rede com o
--   saldo geral / isolamento / pressão negativa por tipo de leito, com o
--   município e as coordenadas (a distância só é calculada quando as duas
--   pontas têm coordenadas).
-- • public.regulacao_fila_extras(p_central): o que a fila do regulador precisa
--   e o JSON da fila não traz (situação e agente do isolamento, município da
--   origem, número de evoluções). Função nova para não redefinir
--   regulacao_fila, que outras frentes mudam.
--
-- Expand: só colunas novas nulas ou com padrão, CHECK alargado, funções
-- novas e uma função auxiliar redefinida com as mesmas chaves de antes.
-- Rollback no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── RG2: tipos, situação e agente ────────────────────────────────────────────
DO $$
DECLARE v_nome text;
BEGIN
  FOR v_nome IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.conrelid = 'public.regulacao_solicitacoes'::regclass AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%isolamento_tipo%'
       AND pg_get_constraintdef(c.oid) NOT LIKE '%NOT isolamento%'
  LOOP
    EXECUTE format('ALTER TABLE public.regulacao_solicitacoes DROP CONSTRAINT %I', v_nome);
  END LOOP;
END $$;
ALTER TABLE public.regulacao_solicitacoes
  ADD CONSTRAINT regulacao_solicitacoes_isolamento_tipo_check
  CHECK (isolamento_tipo IN ('contato', 'goticula', 'aerossol', 'reverso', 'contato_aerossol'));

ALTER TABLE public.regulacao_solicitacoes
  ADD COLUMN IF NOT EXISTS isolamento_situacao text,
  ADD COLUMN IF NOT EXISTS isolamento_agente text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regulacao_solicitacoes_isolamento_situacao_check') THEN
    ALTER TABLE public.regulacao_solicitacoes ADD CONSTRAINT regulacao_solicitacoes_isolamento_situacao_check
      CHECK (isolamento_situacao IS NULL OR isolamento_situacao IN ('suspeito', 'confirmado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regulacao_solicitacoes_isolamento_agente_check') THEN
    ALTER TABLE public.regulacao_solicitacoes ADD CONSTRAINT regulacao_solicitacoes_isolamento_agente_check
      CHECK (isolamento_agente IS NULL OR length(isolamento_agente) <= 120);
  END IF;
END $$;

-- Rótulo dos tipos (aviso ao NIR, recusa da trava do leito): conhece os novos.
CREATE OR REPLACE FUNCTION private.rotulo_isolamento(p_tipos text[])
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT string_agg(CASE t WHEN 'goticula' THEN 'gotícula' WHEN 'reverso' THEN 'reverso (protetor)'
                           WHEN 'contato_aerossol' THEN 'contato e aerossol' ELSE t END, ' e ' ORDER BY o)
    FROM unnest(p_tipos) WITH ORDINALITY AS x(t, o)
$$;

CREATE OR REPLACE FUNCTION public.regulacao_definir_isolamento(p_id uuid, p_tipo text, p_situacao text, p_agente text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.regulacao_solicitacoes;
  v_tipo text := nullif(btrim(coalesce(p_tipo, '')), '');
  v_sit text := nullif(btrim(coalesce(p_situacao, '')), '');
  v_agente text := nullif(btrim(coalesce(p_agente, '')), '');
  v_antes jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (coalesce(private.tenho_papel(s.central_id, 'regulador'), false) OR coalesce(private.regulacao_origem_pode(s), false)) THEN
    RAISE EXCEPTION 'O isolamento do pedido é definido por quem pede e pelo médico regulador da central.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada') THEN
    RAISE EXCEPTION 'O isolamento só muda com o pedido em aberto.';
  END IF;
  IF v_tipo IS NOT NULL AND v_tipo NOT IN ('contato', 'goticula', 'aerossol', 'reverso', 'contato_aerossol') THEN
    RAISE EXCEPTION 'Tipo de isolamento: contato, gotícula, aerossol, reverso ou contato + aerossol.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_sit IS NOT NULL AND v_sit NOT IN ('suspeito', 'confirmado') THEN
    RAISE EXCEPTION 'Situação do isolamento: suspeito ou confirmado.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(coalesce(v_agente, '')) > 120 THEN
    RAISE EXCEPTION 'O agente ou motivo vai até 120 letras.' USING ERRCODE = 'check_violation';
  END IF;
  -- o paciente marcado no atendimento não sai sem isolamento pela regulação
  IF v_tipo IS NULL AND cardinality(private.isolamento_ativo(s.paciente_id)) > 0 THEN
    RAISE EXCEPTION 'O paciente está marcado em isolamento por % no atendimento: a regulação não pode tirar o isolamento.',
      private.rotulo_isolamento(private.isolamento_ativo(s.paciente_id)) USING ERRCODE = 'check_violation';
  END IF;
  v_antes := jsonb_build_object('tipo', s.isolamento_tipo, 'situacao', s.isolamento_situacao, 'agente', s.isolamento_agente);
  UPDATE public.regulacao_solicitacoes
     SET isolamento = v_tipo IS NOT NULL,
         isolamento_tipo = v_tipo,
         isolamento_situacao = CASE WHEN v_tipo IS NULL THEN NULL ELSE v_sit END,
         isolamento_agente = CASE WHEN v_tipo IS NULL THEN NULL ELSE v_agente END
   WHERE id = s.id RETURNING * INTO s;
  PERFORM private.regulacao_evento(s.id, 'isolamento_alterado', jsonb_build_object(
    'de', v_antes, 'para', jsonb_build_object('tipo', s.isolamento_tipo, 'situacao', s.isolamento_situacao, 'agente', s.isolamento_agente)));
  PERFORM private.registrar_auditoria('regulacao_isolamento', 'regulacao_solicitacoes', s.id, s.central_id,
    jsonb_build_object('de', v_antes, 'para', s.isolamento_tipo, 'situacao', s.isolamento_situacao));
  RETURN jsonb_build_object('id', s.id, 'isolamento', s.isolamento, 'isolamento_tipo', s.isolamento_tipo,
    'isolamento_situacao', s.isolamento_situacao, 'isolamento_agente', s.isolamento_agente);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_definir_isolamento(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_definir_isolamento(uuid, text, text, text) TO authenticated;

-- ── RG3: leito com pressão negativa ──────────────────────────────────────────
ALTER TABLE public.leitos ADD COLUMN IF NOT EXISTS pressao_negativa boolean NOT NULL DEFAULT false;
GRANT INSERT (pressao_negativa) ON public.leitos TO authenticated;
GRANT UPDATE (pressao_negativa) ON public.leitos TO authenticated;

-- Por tipo de leito ofertado: as chaves de antes e os livres de isolamento
-- comum e com pressão negativa ("livre" continua sendo o total de livres).
CREATE OR REPLACE FUNCTION private.regulacao_leitos_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('tipo_leito', x.tipo, 'livre', x.livre, 'reservado', x.reservado,
           'higienizacao', x.higienizacao, 'bloqueado', x.bloqueado, 'ocupado', x.ocupado, 'total', x.total,
           'livre_isolamento', x.livre_iso, 'livre_pressao_negativa', x.livre_pn,
           'isolamento', x.iso, 'pressao_negativa', x.pn) ORDER BY x.tipo), '[]'::jsonb)
    FROM (SELECT st.regulacao_tipo_leito AS tipo,
                 count(*) FILTER (WHERE l.status = 'livre') AS livre,
                 count(*) FILTER (WHERE l.status = 'reservado') AS reservado,
                 count(*) FILTER (WHERE l.status = 'higienizacao') AS higienizacao,
                 count(*) FILTER (WHERE l.status = 'bloqueado') AS bloqueado,
                 count(*) FILTER (WHERE l.status = 'ocupado') AS ocupado,
                 count(*) AS total,
                 count(*) FILTER (WHERE l.status = 'livre' AND l.tipo = 'isolamento' AND NOT l.pressao_negativa) AS livre_iso,
                 count(*) FILTER (WHERE l.status = 'livre' AND l.tipo = 'isolamento' AND l.pressao_negativa) AS livre_pn,
                 count(*) FILTER (WHERE l.tipo = 'isolamento' AND NOT l.pressao_negativa) AS iso,
                 count(*) FILTER (WHERE l.tipo = 'isolamento' AND l.pressao_negativa) AS pn
            FROM public.setores st JOIN public.leitos l ON l.setor_id = st.id AND l.ativo
           WHERE st.unidade_id = p_unidade AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL
           GROUP BY st.regulacao_tipo_leito) x
$$;
REVOKE ALL ON FUNCTION private.regulacao_leitos_unidade(uuid) FROM PUBLIC, anon, authenticated;

-- Regulador ou gestor da central (ou super admin): mesma porta da fila.
CREATE OR REPLACE FUNCTION private.regulacao_acesso_central(p_central uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = p_central) THEN
    RAISE EXCEPTION 'Esta unidade não é uma central de regulação.';
  END IF;
  IF NOT (private.eh_super_admin() OR coalesce(private.tenho_papel(p_central, 'regulador'), false)
          OR coalesce(private.tenho_papel(p_central, 'gestor'), false)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.regulacao_acesso_central(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.regulacao_vagas_compativeis(p_central uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_org uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_acesso_central(p_central);
  SELECT u.organizacao_id INTO v_org FROM public.unidades u WHERE u.id = p_central;
  RETURN jsonb_build_object(
    'unidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', u.id, 'nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf,
        'latitude', u.latitude, 'longitude', u.longitude,
        'leitos', private.regulacao_leitos_unidade(u.id)) ORDER BY u.nome)
        FROM public.unidades u
       WHERE u.organizacao_id = v_org AND u.id <> p_central AND u.ativo
         AND NOT EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = u.id)
         AND EXISTS (SELECT 1 FROM public.setores st WHERE st.unidade_id = u.id AND st.ativo AND st.regulacao_tipo_leito IS NOT NULL)),
      '[]'::jsonb),
    'agora', now());
END $$;
REVOKE ALL ON FUNCTION public.regulacao_vagas_compativeis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_vagas_compativeis(uuid) TO authenticated;

-- Para a fila do regulador: o que o JSON da fila não traz (sem nome de paciente).
CREATE OR REPLACE FUNCTION public.regulacao_fila_extras(p_central uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.regulacao_acesso_central(p_central);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'isolamento_situacao', s.isolamento_situacao, 'isolamento_agente', s.isolamento_agente,
      'origem_municipio', u.municipio, 'origem_uf', u.uf, 'origem_latitude', u.latitude, 'origem_longitude', u.longitude,
      'evolucoes', (SELECT count(*) FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'evolucao_atualizada')))
    FROM public.regulacao_solicitacoes s
    JOIN public.unidades u ON u.id = s.unidade_origem_id
   WHERE s.central_id = p_central
     AND s.status IN ('enviada', 'em_analise', 'pendencia', 'devolvida', 'aguardando_destino', 'autorizada', 'agendada')), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.regulacao_fila_extras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_fila_extras(uuid) TO authenticated;

-- ── ROLLBACK (testar na homologação) ─────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.regulacao_fila_extras(uuid);
-- DROP FUNCTION IF EXISTS public.regulacao_vagas_compativeis(uuid);
-- DROP FUNCTION IF EXISTS private.regulacao_acesso_central(uuid);
-- DROP FUNCTION IF EXISTS public.regulacao_definir_isolamento(uuid, text, text, text);
-- Recriar private.regulacao_leitos_unidade e private.rotulo_isolamento como
--   em 20261114000001_mapa_vagas.sql e 20261120000001_isolamento_trava_leito.sql.
-- UPDATE public.regulacao_solicitacoes SET isolamento_tipo = CASE isolamento_tipo
--   WHEN 'contato_aerossol' THEN 'aerossol' WHEN 'reverso' THEN 'contato' ELSE isolamento_tipo END
--   WHERE isolamento_tipo IN ('contato_aerossol', 'reverso');   -- só se precisar voltar o CHECK
-- ALTER TABLE public.regulacao_solicitacoes DROP CONSTRAINT regulacao_solicitacoes_isolamento_tipo_check;
-- ALTER TABLE public.regulacao_solicitacoes ADD CONSTRAINT regulacao_solicitacoes_isolamento_tipo_check
--   CHECK (isolamento_tipo IN ('contato', 'goticula', 'aerossol'));
-- As colunas novas (isolamento_situacao, isolamento_agente, leitos.pressao_negativa)
-- ficam (contract em outra janela): REVOKE INSERT (pressao_negativa), UPDATE (pressao_negativa)
--   ON public.leitos FROM authenticated;
