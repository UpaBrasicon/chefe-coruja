-- ════════════════════════════════════════════════════════════════════════════
-- Achado P2-2 do A01 (teste da rede, 06/11/2026): a regulação chegava a
-- "realizada" com o paciente ainda internado na origem. Decisão do RT em
-- 07/11/2026: A em S1 a S6 (docs/teste-rede/CORRECOES-A01-DIAGNOSTICO.md).
--
-- Vale para as regulações que levam o paciente de uma unidade para outra
-- (tipo "leito" e "transferencia"). Consulta e exame não mudam.
--
-- S1. "realizada" só com as duas coisas: a chegada registrada no destino E a
--     origem encerrada (nenhum episódio aberto e nenhuma internação ativa do
--     paciente na unidade de origem). A chegada nunca é recusada.
-- S2. Sem status novo: com a origem aberta, a chegada grava chegada_em e a
--     regulação fica "em_transito". Quando a origem encerra, vira "realizada"
--     com realizada_em = chegada_em (o indicador não muda).
-- S3. regulacao_marcar_saida exige a origem encerrada. A alta por
--     transferência na origem (porta, observação ou internação) marca a saída
--     sozinha, se ainda não foi marcada, com autor = login de quem deu a alta.
-- S4. A alta por transferência pode trazer o id da regulação nos detalhes
--     (detalhes ->> 'regulacao_id'); o servidor confere que é deste paciente
--     e desta origem. A tela oferece a regulação e preenche o destino.
-- S5. Item novo no NIR da origem: "chegou ao destino, origem sem alta por
--     transferência", com aviso ao solicitante e ao médico assistente.
-- S6. Nenhum status antigo muda aqui. scripts/regulacao/conferir_realizada_
--     origem_aberta.sql lista os casos antigos para o NIR e o gestor.
-- Destino de fora da rede: a mesma regra (quem marca a chegada é a central).
--
-- O fechamento da origem é percebido por gatilhos AFTER UPDATE com WHEN
-- (OLD x NEW), não por "UPDATE OF coluna": o encerramento pode vir de outro
-- gatilho (lição do B P1-1, 20270307000001).
--
-- Funções novas: private.regulacao_leva_paciente, private.regulacao_origem_
-- encerrada, private.regulacao_concluir_origem, private.regulacao_origem_
-- fechou e os dois gatilhos. Trocas de texto reaplicáveis em
-- regulacao_marcar_saida, regulacao_marcar_chegada, private.nir_itens e
-- private.regulacao_json; se um trecho não for achado, para.
--
-- ROLLBACK (em homologação antes; as colunas podem ficar):
--   DROP TRIGGER IF EXISTS trg_regulacao_origem_episodio ON public.episodios;
--   DROP TRIGGER IF EXISTS trg_regulacao_origem_internacao ON public.internacoes;
--   e devolver regulacao_marcar_saida, regulacao_marcar_chegada, nir_itens e
--   regulacao_json às versões de 20261117000002_nir.sql (e da migration que
--   por último as trocou), tirando os trechos marcados "S1"/"S3"/"S5" daqui.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS chegada_em timestamptz;
ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS origem_encerrada_em timestamptz;
COMMENT ON COLUMN public.regulacao_solicitacoes.chegada_em IS
  'Hora em que o destino registrou a chegada do paciente (S2). Com a origem ainda aberta, a regulação segue em trânsito.';
COMMENT ON COLUMN public.regulacao_solicitacoes.origem_encerrada_em IS
  'Hora em que a origem encerrou o cuidado (alta por transferência), percebida pela regulação (S1).';

-- ── regras ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_leva_paciente(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT s.tipo IN ('leito', 'transferencia')
$$;

CREATE OR REPLACE FUNCTION private.regulacao_origem_encerrada(s public.regulacao_solicitacoes)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN s.paciente_id IS NOT NULL THEN
           NOT EXISTS (SELECT 1 FROM public.episodios e
                        WHERE e.paciente_id = s.paciente_id AND e.unidade_id = s.unidade_origem_id AND e.encerrado_em IS NULL)
       AND NOT EXISTS (SELECT 1 FROM public.internacoes i
                        WHERE i.paciente_id = s.paciente_id AND i.unidade_id = s.unidade_origem_id
                          AND i.status IN ('admitido', 'em_observacao', 'internado'))
         ELSE
           (s.episodio_id IS NULL OR EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = s.episodio_id AND e.encerrado_em IS NOT NULL))
       AND (s.internacao_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.internacoes i
                                                    WHERE i.id = s.internacao_id AND i.status IN ('admitido', 'em_observacao', 'internado')))
         END
$$;

-- a origem encerrou: grava, marca a saída se faltava e conclui se já chegou
CREATE OR REPLACE FUNCTION private.regulacao_concluir_origem(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes;
BEGIN
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT private.regulacao_leva_paciente(s) OR s.status NOT IN ('autorizada', 'agendada', 'em_transito')
     OR NOT private.regulacao_origem_encerrada(s) THEN
    RETURN;
  END IF;
  UPDATE public.regulacao_solicitacoes SET origem_encerrada_em = coalesce(origem_encerrada_em, now()) WHERE id = s.id RETURNING * INTO s;
  -- S3: a alta por transferência marca a saída que faltava
  IF s.saida_em IS NULL THEN
    UPDATE public.regulacao_solicitacoes
       SET status = 'em_transito', saida_em = least(now(), coalesce(s.chegada_em, now())), saida_por = private.meu_perfil_id()
     WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_estender_reserva(s, 8);
    PERFORM private.regulacao_evento(s.id, 'saiu', jsonb_build_object('pela_alta', true));
    PERFORM private.regulacao_avisar_destino(s, 'reg_saiu', 'Regulação nº ' || s.numero || ': o paciente saiu da origem (alta por transferência).');
  END IF;
  -- S1/S2: já tinha chegado: agora é realizada, na hora da chegada
  IF s.chegada_em IS NOT NULL THEN
    UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = s.chegada_em WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_evento(s.id, 'origem_encerrada', jsonb_build_object('realizada_em', s.realizada_em));
  END IF;
  PERFORM private.registrar_auditoria('regulacao_origem_encerrada', 'regulacao_solicitacoes', s.id, s.unidade_origem_id,
    jsonb_build_object('status', s.status, 'saida_em', s.saida_em, 'chegada_em', s.chegada_em));
END $$;

-- todas as regulações do paciente que saem desta origem
CREATE OR REPLACE FUNCTION private.regulacao_origem_fechou(p_paciente uuid, p_unidade uuid, p_regulacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record;
BEGIN
  -- S4: a regulação escolhida na alta tem de ser deste paciente e desta origem
  IF p_regulacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.regulacao_solicitacoes s
        WHERE s.id = p_regulacao AND s.paciente_id = p_paciente AND s.unidade_origem_id = p_unidade) THEN
    RAISE EXCEPTION 'A regulação escolhida não é deste paciente nesta unidade.';
  END IF;
  FOR r IN SELECT s.id FROM public.regulacao_solicitacoes s
            WHERE s.paciente_id = p_paciente AND s.unidade_origem_id = p_unidade
              AND s.tipo IN ('leito', 'transferencia') AND s.status IN ('autorizada', 'agendada', 'em_transito')
            ORDER BY s.criada_em LOOP
    PERFORM private.regulacao_concluir_origem(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.trg_regulacao_origem_episodio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_transf boolean; v_reg uuid;
BEGIN
  -- alta por transferência da porta, ou do leito que veio deste episódio
  v_transf := NEW.desfecho = 'transferencia'
           OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.episodio_id = NEW.id AND i.status = 'transferencia_externa');
  IF NOT v_transf THEN RETURN NULL; END IF;
  v_reg := coalesce(nullif(NEW.desfecho_detalhes ->> 'regulacao_id', ''),
                    (SELECT nullif(i.alta_detalhes ->> 'regulacao_id', '') FROM public.internacoes i
                      WHERE i.episodio_id = NEW.id AND i.status = 'transferencia_externa' ORDER BY i.data_alta DESC NULLS LAST LIMIT 1))::uuid;
  PERFORM private.regulacao_origem_fechou(NEW.paciente_id, NEW.unidade_id, v_reg);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_regulacao_origem_episodio ON public.episodios;
CREATE TRIGGER trg_regulacao_origem_episodio AFTER UPDATE ON public.episodios
  FOR EACH ROW WHEN (OLD.encerrado_em IS NULL AND NEW.encerrado_em IS NOT NULL)
  EXECUTE FUNCTION private.trg_regulacao_origem_episodio();

-- internação sem episódio (ADT antigo) ou que encerra depois do episódio
CREATE OR REPLACE FUNCTION private.trg_regulacao_origem_internacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.regulacao_origem_fechou(NEW.paciente_id, NEW.unidade_id, nullif(NEW.alta_detalhes ->> 'regulacao_id', '')::uuid);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_regulacao_origem_internacao ON public.internacoes;
CREATE TRIGGER trg_regulacao_origem_internacao AFTER UPDATE ON public.internacoes
  FOR EACH ROW WHEN (NEW.status = 'transferencia_externa' AND OLD.alta_detalhes IS DISTINCT FROM NEW.alta_detalhes)
  EXECUTE FUNCTION private.trg_regulacao_origem_internacao();

REVOKE ALL ON FUNCTION private.regulacao_leva_paciente(public.regulacao_solicitacoes),
                       private.regulacao_origem_encerrada(public.regulacao_solicitacoes),
                       private.regulacao_concluir_origem(uuid),
                       private.regulacao_origem_fechou(uuid, uuid, uuid),
                       private.trg_regulacao_origem_episodio(),
                       private.trg_regulacao_origem_internacao() FROM PUBLIC, anon, authenticated;

-- ── trocas de texto ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  -- sem \r: o corpo gravado e este arquivo podem ter fim de linha do Windows
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- S3: a saída só com a origem encerrada
SELECT pg_temp.trocar_uma_vez('public.regulacao_marcar_saida(uuid)'::regprocedure,
  $old$  IF s.status NOT IN ('autorizada', 'agendada') THEN RAISE EXCEPTION 'Só sai o paciente com o pedido aceito pelo destino.'; END IF;$old$,
  $new$  IF s.status NOT IN ('autorizada', 'agendada') THEN RAISE EXCEPTION 'Só sai o paciente com o pedido aceito pelo destino.'; END IF;
  -- S3 (origem encerrada): ninguém marca a saída de quem segue internado
  IF private.regulacao_leva_paciente(s) AND NOT private.regulacao_origem_encerrada(s) THEN
    RAISE EXCEPTION 'O paciente segue em atendimento na origem: a alta por transferência marca a saída.';
  END IF;
  -- fim S3$new$);

-- S1/S2: a chegada nunca é recusada; com a origem aberta, fica em trânsito
SELECT pg_temp.trocar_uma_vez('public.regulacao_marcar_chegada(uuid, boolean, text)'::regprocedure,
  $old$    UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
    PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs));$old$,
  $new$    -- S1/S2 (origem encerrada): realizada só com a origem encerrada
    IF private.regulacao_leva_paciente(s) AND NOT private.regulacao_origem_encerrada(s) THEN
      UPDATE public.regulacao_solicitacoes SET status = 'em_transito', chegada_em = now(), chegada_por = private.meu_perfil_id(),
             chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
      PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
      PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs, 'origem_aberta', true));
      PERFORM private.regulacao_avisar(s, 'reg_chegou_origem_aberta', 'Regulação nº ' || s.numero
        || ': o paciente chegou ao destino e segue sem alta por transferência na origem. Dê a alta por transferência.');
    ELSE
      UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now(), chegada_em = now(),
             origem_encerrada_em = CASE WHEN private.regulacao_leva_paciente(s) THEN coalesce(origem_encerrada_em, now()) END,
             chegada_por = private.meu_perfil_id(), chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
      PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
      PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs));
    END IF;
    -- fim S1/S2$new$);

-- a chegada é registrada uma vez só (em trânsito com a marca continua
-- "esperando a origem", não a chegada)
SELECT pg_temp.trocar_uma_vez('public.regulacao_marcar_chegada(uuid, boolean, text)'::regprocedure,
  $old$  IF s.status NOT IN ('autorizada', 'agendada', 'em_transito') THEN RAISE EXCEPTION 'Este pedido não está esperando a chegada do paciente.'; END IF;$old$,
  $new$  IF s.status NOT IN ('autorizada', 'agendada', 'em_transito') THEN RAISE EXCEPTION 'Este pedido não está esperando a chegada do paciente.'; END IF;
  IF s.chegada_em IS NOT NULL THEN RAISE EXCEPTION 'A chegada deste paciente já foi registrada.'; END IF;$new$);

-- o histórico do paciente mostra a marca e serve à escolha da regulação na alta
SELECT pg_temp.trocar_uma_vez('public.regulacao_historico_paciente(uuid)'::regprocedure,
  $old$      'outra_unidade', s.unidade_origem_id <> v_unidade,$old$,
  $new$      'outra_unidade', s.unidade_origem_id <> v_unidade,
      'chegou_origem_aberta', (s.status = 'em_transito' AND s.chegada_em IS NOT NULL),$new$);

-- S5: no NIR da origem, chegou ao destino e a origem segue aberta; no
-- destino, "a caminho sem chegada" não conta quem já chegou
SELECT pg_temp.trocar_uma_vez('private.nir_itens(uuid)'::regprocedure,
  $old$   WHERE s.destino_unidade_id = p_unidade AND s.status = 'em_transito'$old$,
  $new$   WHERE s.destino_unidade_id = p_unidade AND s.status = 'em_transito' AND s.chegada_em IS NULL
  UNION ALL
  -- S5 (origem encerrada): chegou ao destino e a origem segue sem alta por transferência
  SELECT 'reg_origem_aberta', 'regulacao', s.id,
         'Regulação nº ' || s.numero || ': chegou ao destino, origem sem alta por transferência',
         s.paciente_id, s.chegada_em,
         ARRAY(SELECT DISTINCT q FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q WHERE q IS NOT NULL), NULL
    FROM public.regulacao_solicitacoes s
   WHERE s.unidade_origem_id = p_unidade AND s.status = 'em_transito' AND s.chegada_em IS NOT NULL$new$);

-- o detalhe mostra a marca "chegou ao destino; origem sem alta"
SELECT pg_temp.trocar_uma_vez('private.regulacao_json(public.regulacao_solicitacoes)'::regprocedure,
  $old$'realizada_em', s.realizada_em, 'falta_em', s.falta_em,$old$,
  $new$'realizada_em', s.realizada_em, 'falta_em', s.falta_em,
    'chegada_em', s.chegada_em, 'origem_encerrada_em', s.origem_encerrada_em,
    'chegou_origem_aberta', (s.status = 'em_transito' AND s.chegada_em IS NOT NULL),$new$);
