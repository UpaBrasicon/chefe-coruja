-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 7 — cuidados de enfermagem (protótipo: painel
-- "Cuidados" do PS da enfermagem e da internação da enfermagem; ESTADO.md,
-- "Recepção, Enfermagem e Pronto Socorro (23/09)").
--
-- O que entra:
--   1. sae_registros — Processo de Enfermagem em cinco etapas (COFEN
--      736/2024, como o protótipo cita): avaliação de enfermagem (histórico,
--      entrevista e exame físico), diagnósticos (NANDA-I), planejamento
--      (resultados NOC), implementação (intervenções NIC) e evolução. Os
--      códigos e títulos são DIGITADOS da licença NANDA-I/NOC/NIC da unidade:
--      o sistema não tem a lista (não há lista com fonte aqui) e não sugere
--      nada. Uma linha por VERSÃO, por atendimento (internação, ou episódio
--      quando não há internação); a vigente é a última. Só o enfermeiro
--      registra (protótipo: "Só o enfermeiro edita").
--   2. dispositivos_enfermagem — tipo (lista do protótipo, DISPOSITIVOS_ENF,
--      sem "Curativo", que tem registro próprio), local, calibre, data de
--      inserção, troca prevista (digitada: nenhuma regra de prazo sem fonte)
--      e retirada. Nada se apaga: retirar é a única alteração, uma vez.
--   3. balanco_hidrico — lançamentos de entrada e saída em mL com a hora do
--      fato. Cancelar pede motivo (continua no histórico). A soma por período
--      e o balanço de 24 h são de src/clinico/enfermagem/balancoHidrico.ts.
--   4. curativos_enfermagem — local, tipo (cobertura), aspecto e próxima
--      troca. Só inserção: cada troca é um registro novo.
--   5. Leituras: cuidados_enfermagem (o painel inteiro numa chamada) e
--      private.dispositivos_em_uso_texto (a lista pronta para a evolução
--      médica: "Tipo · local · calibre (Dn)").
--
-- Reusa o que existe: sinais vitais em public.observacao (gravados pela porta
-- de sincronização, sincronizar_registros); Braden e Morse em
-- avaliacoes_escala (registrar_avaliacao); anotação e evolução de enfermagem
-- em documentos_clinicos (registrar_evolucao). Nada disso é recriado aqui.
--
-- Quem escreve: enfermagem (enfermeiro ou técnico) de plantão no setor do
-- paciente; a SAE, só o enfermeiro. Tabelas com RLS, escrita só por RPC
-- (SECURITY DEFINER, search_path vazio, segundo fator), sem DELETE (guarda de
-- 20 anos, 20261001000004). Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabelas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sae_registros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  versao          integer NOT NULL CHECK (versao >= 1),
  avaliacao       text NOT NULL DEFAULT '',
  -- [{ "codigo": "00132", "titulo": "Dor aguda", "detalhe": "relacionado a … evidenciado por …" }]
  diagnosticos    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(diagnosticos) = 'array'),
  planejamento    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(planejamento) = 'array'),
  implementacao   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(implementacao) = 'array'),
  evolucao        text NOT NULL DEFAULT '',
  registrado_por  uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sae_registros_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS sae_registros_versao ON public.sae_registros (coalesce(internacao_id, episodio_id), versao);
CREATE INDEX IF NOT EXISTS sae_registros_paciente ON public.sae_registros (paciente_id, registrado_em DESC);
COMMENT ON TABLE public.sae_registros IS
  'Porte (onda 7): SAE em cinco etapas (COFEN 736/2024). Uma linha por versão, por atendimento; a vigente é a última. NANDA-I/NOC/NIC digitados da licença da unidade.';

CREATE TABLE IF NOT EXISTS public.dispositivos_enfermagem (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id      uuid REFERENCES public.episodios(id),
  internacao_id    uuid REFERENCES public.internacoes(id),
  tipo             text NOT NULL CHECK (tipo IN ('Acesso venoso periférico', 'Cateter venoso central', 'Sonda vesical de demora',
                                                 'Sonda nasogástrica ou nasoenteral', 'Dreno', 'Traqueostomia')),
  local            text NOT NULL DEFAULT '',
  calibre          text NOT NULL DEFAULT '',
  inserido_em      date NOT NULL,
  troca_prevista   date,
  observacao       text NOT NULL DEFAULT '',
  registrado_por   uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em    timestamptz NOT NULL DEFAULT now(),
  retirado_em      timestamptz,
  retirado_por     uuid REFERENCES public.perfis(id),
  motivo_retirada  text,
  CONSTRAINT dispositivos_enfermagem_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  CONSTRAINT dispositivos_enfermagem_troca CHECK (troca_prevista IS NULL OR troca_prevista >= inserido_em),
  CONSTRAINT dispositivos_enfermagem_retirada CHECK ((retirado_em IS NULL) = (retirado_por IS NULL))
);
CREATE INDEX IF NOT EXISTS dispositivos_enfermagem_paciente ON public.dispositivos_enfermagem (paciente_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS dispositivos_enfermagem_em_uso ON public.dispositivos_enfermagem (paciente_id) WHERE retirado_em IS NULL;
COMMENT ON TABLE public.dispositivos_enfermagem IS
  'Porte (onda 7): dispositivos registrados pela enfermagem. Retirar é a única alteração (uma vez); nada se apaga.';

CREATE TABLE IF NOT EXISTS public.balanco_hidrico (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  tipo                text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao           text NOT NULL CHECK (length(btrim(descricao)) >= 2),
  volume_ml           numeric(7, 1) NOT NULL CHECK (volume_ml > 0 AND volume_ml <= 10000),
  aferido_em          timestamptz NOT NULL,
  registrado_por      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em       timestamptz NOT NULL DEFAULT now(),
  cancelado_em        timestamptz,
  cancelado_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  CONSTRAINT balanco_hidrico_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL),
  CONSTRAINT balanco_hidrico_cancelamento CHECK (
    cancelado_em IS NULL OR (cancelado_por IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 10))
);
CREATE INDEX IF NOT EXISTS balanco_hidrico_paciente ON public.balanco_hidrico (paciente_id, aferido_em DESC);
COMMENT ON TABLE public.balanco_hidrico IS
  'Porte (onda 7): entradas e saídas em mL com a hora do fato. Cancelar pede motivo; nada se apaga. Soma: src/clinico/enfermagem/balancoHidrico.ts.';

CREATE TABLE IF NOT EXISTS public.curativos_enfermagem (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id     uuid REFERENCES public.episodios(id),
  internacao_id   uuid REFERENCES public.internacoes(id),
  local           text NOT NULL CHECK (length(btrim(local)) >= 2),
  tipo            text NOT NULL CHECK (length(btrim(tipo)) >= 2),
  aspecto         text NOT NULL DEFAULT '',
  proxima_troca   date,
  observacao      text NOT NULL DEFAULT '',
  registrado_por  uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curativos_enfermagem_atendimento CHECK (episodio_id IS NOT NULL OR internacao_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS curativos_enfermagem_paciente ON public.curativos_enfermagem (paciente_id, registrado_em DESC);
COMMENT ON TABLE public.curativos_enfermagem IS
  'Porte (onda 7): curativo realizado (local, tipo, aspecto, próxima troca). Só inserção: cada troca é um registro novo.';

-- SAE e curativo: só inserção. Dispositivo: só a retirada, uma vez.
-- Balanço: só o cancelamento, uma vez.
DROP TRIGGER IF EXISTS trg_sae_so_insercao ON public.sae_registros;
CREATE TRIGGER trg_sae_so_insercao BEFORE UPDATE ON public.sae_registros
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
DROP TRIGGER IF EXISTS trg_curativo_so_insercao ON public.curativos_enfermagem;
CREATE TRIGGER trg_curativo_so_insercao BEFORE UPDATE ON public.curativos_enfermagem
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE OR REPLACE FUNCTION private.cuidado_so_encerramento() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_antes jsonb := to_jsonb(OLD); v_depois jsonb := to_jsonb(NEW); c text; v_campos text[];
BEGIN
  v_campos := CASE TG_TABLE_NAME
    WHEN 'dispositivos_enfermagem' THEN ARRAY['retirado_em', 'retirado_por', 'motivo_retirada']
    WHEN 'balanco_hidrico' THEN ARRAY['cancelado_em', 'cancelado_por', 'motivo_cancelamento'] END;
  IF v_antes ->> v_campos[1] IS NOT NULL THEN
    RAISE EXCEPTION '%: registro já encerrado não se altera.', TG_TABLE_NAME;
  END IF;
  FOREACH c IN ARRAY v_campos LOOP
    v_antes := v_antes - c; v_depois := v_depois - c;
  END LOOP;
  IF v_antes IS DISTINCT FROM v_depois THEN
    RAISE EXCEPTION '%: só a retirada ou o cancelamento se registram depois; o resto não se altera.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.cuidado_so_encerramento() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dispositivo_so_retirada ON public.dispositivos_enfermagem;
CREATE TRIGGER trg_dispositivo_so_retirada BEFORE UPDATE ON public.dispositivos_enfermagem
  FOR EACH ROW EXECUTE FUNCTION private.cuidado_so_encerramento();
DROP TRIGGER IF EXISTS trg_balanco_so_cancelamento ON public.balanco_hidrico;
CREATE TRIGGER trg_balanco_so_cancelamento BEFORE UPDATE ON public.balanco_hidrico
  FOR EACH ROW EXECUTE FUNCTION private.cuidado_so_encerramento();

-- ── 2. atendimento em que o cuidado entra ───────────────────────────────────
-- Internação informada: precisa ser do paciente e estar aberta (o episódio
-- vem dela). Sem internação: o episódio informado (ou o aberto) precisa estar
-- aberto; havendo internação aberta do episódio, o registro vai para ela.
CREATE OR REPLACE FUNCTION private.atendimento_enfermagem(p_paciente uuid, p_episodio uuid, p_internacao uuid)
RETURNS TABLE (unidade_id uuid, episodio_id uuid, internacao_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; e public.episodios; v_ep uuid; v_int uuid;
BEGIN
  SELECT a.episodio_id, a.internacao_id INTO v_ep, v_int
    FROM private.atendimento_do_paciente(p_paciente, p_episodio, p_internacao, true) a;
  IF v_int IS NULL AND v_ep IS NOT NULL THEN
    SELECT x.id INTO v_int FROM public.internacoes x
     WHERE x.episodio_id = v_ep AND x.status IN ('admitido', 'em_observacao', 'internado')
     ORDER BY x.data_admissao DESC LIMIT 1;
  END IF;
  IF v_int IS NOT NULL THEN
    SELECT * INTO i FROM public.internacoes x WHERE x.id = v_int;
    IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
    RETURN QUERY SELECT i.unidade_id, coalesce(i.episodio_id, v_ep), i.id;
    RETURN;
  END IF;
  SELECT * INTO e FROM public.episodios x WHERE x.id = v_ep;
  IF e.etapa = 'encerrado' THEN RAISE EXCEPTION 'Atendimento encerrado.'; END IF;
  RETURN QUERY SELECT e.unidade_id, e.id, NULL::uuid;
END $$;
REVOKE ALL ON FUNCTION private.atendimento_enfermagem(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- a enfermagem de plantão com o paciente (a SAE pede o enfermeiro)
CREATE OR REPLACE FUNCTION private.exigir_enfermagem(p_paciente uuid, p_so_enfermeiro boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  SELECT pa.unidade_id INTO v_unidade FROM public.pacientes pa WHERE pa.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF p_so_enfermeiro AND private.tenho_papel(v_unidade, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A SAE é do enfermeiro.';
  END IF;
  IF NOT p_so_enfermeiro AND private.sou_enfermagem(v_unidade) IS NOT TRUE THEN
    RAISE EXCEPTION 'Este registro é da enfermagem.';
  END IF;
  IF private.paciente_no_meu_plantao(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.exigir_enfermagem(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── 3. SAE ──────────────────────────────────────────────────────────────────
-- Item de lista (diagnóstico, resultado, intervenção): título obrigatório
-- (é o da licença), código e detalhe opcionais. Devolve a lista limpa.
CREATE OR REPLACE FUNCTION private.sae_lista(p jsonb, p_nome text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE x jsonb; saida jsonb := '[]'::jsonb;
BEGIN
  IF p IS NULL THEN RETURN saida; END IF;
  IF jsonb_typeof(p) <> 'array' THEN RAISE EXCEPTION '%: envie uma lista.', p_nome; END IF;
  IF jsonb_array_length(p) > 30 THEN RAISE EXCEPTION '%: no máximo 30 itens.', p_nome; END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(x) <> 'object' OR length(btrim(coalesce(x ->> 'titulo', ''))) < 3 THEN
      RAISE EXCEPTION '%: cada item precisa do título (da licença).', p_nome;
    END IF;
    IF length(btrim(coalesce(x ->> 'codigo', ''))) > 20 THEN RAISE EXCEPTION '%: código com mais de 20 caracteres.', p_nome; END IF;
    saida := saida || jsonb_build_array(jsonb_build_object(
      'codigo', btrim(coalesce(x ->> 'codigo', '')), 'titulo', btrim(x ->> 'titulo'), 'detalhe', btrim(coalesce(x ->> 'detalhe', ''))));
  END LOOP;
  RETURN saida;
END $$;
REVOKE ALL ON FUNCTION private.sae_lista(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_sae(
  p_paciente uuid, p_avaliacao text, p_diagnosticos jsonb, p_planejamento jsonb, p_implementacao jsonb, p_evolucao text,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a record; v_id uuid; v_versao int;
  v_diag jsonb := private.sae_lista(p_diagnosticos, 'Diagnósticos');
  v_plan jsonb := private.sae_lista(p_planejamento, 'Planejamento');
  v_impl jsonb := private.sae_lista(p_implementacao, 'Implementação');
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.exigir_enfermagem(p_paciente, true);
  SELECT * INTO a FROM private.atendimento_enfermagem(p_paciente, p_episodio, p_internacao);
  IF length(btrim(coalesce(p_avaliacao, ''))) = 0 AND length(btrim(coalesce(p_evolucao, ''))) = 0
     AND jsonb_array_length(v_diag) + jsonb_array_length(v_plan) + jsonb_array_length(v_impl) = 0 THEN
    RAISE EXCEPTION 'Preencha ao menos uma etapa da SAE.';
  END IF;
  -- uma versão por vez no mesmo atendimento
  PERFORM pg_advisory_xact_lock(hashtextextended('sae:' || coalesce(a.internacao_id, a.episodio_id)::text, 0));
  SELECT coalesce(max(s.versao), 0) + 1 INTO v_versao FROM public.sae_registros s
   WHERE coalesce(s.internacao_id, s.episodio_id) = coalesce(a.internacao_id, a.episodio_id);
  INSERT INTO public.sae_registros (unidade_id, paciente_id, episodio_id, internacao_id, versao, avaliacao, diagnosticos,
                                    planejamento, implementacao, evolucao, registrado_por)
  VALUES (a.unidade_id, p_paciente, a.episodio_id, a.internacao_id, v_versao, btrim(coalesce(p_avaliacao, '')), v_diag,
          v_plan, v_impl, btrim(coalesce(p_evolucao, '')), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_sae(uuid, text, jsonb, jsonb, jsonb, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_sae(uuid, text, jsonb, jsonb, jsonb, text, uuid, uuid) TO authenticated;

-- ── 4. dispositivos ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_dispositivo(
  p_paciente uuid, p_tipo text, p_local text, p_calibre text, p_inserido_em date, p_troca_prevista date DEFAULT NULL,
  p_observacao text DEFAULT NULL, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.exigir_enfermagem(p_paciente, false);
  SELECT * INTO a FROM private.atendimento_enfermagem(p_paciente, p_episodio, p_internacao);
  IF p_tipo IS NULL OR p_tipo NOT IN ('Acesso venoso periférico', 'Cateter venoso central', 'Sonda vesical de demora',
                                      'Sonda nasogástrica ou nasoenteral', 'Dreno', 'Traqueostomia') THEN
    RAISE EXCEPTION 'Escolha o tipo de dispositivo.';
  END IF;
  IF p_inserido_em IS NULL THEN RAISE EXCEPTION 'Informe a data da inserção.'; END IF;
  IF p_inserido_em > private.data_atual() THEN RAISE EXCEPTION 'A inserção não pode ser no futuro.'; END IF;
  IF p_troca_prevista IS NOT NULL AND p_troca_prevista < p_inserido_em THEN
    RAISE EXCEPTION 'A troca prevista não pode ser antes da inserção.';
  END IF;
  INSERT INTO public.dispositivos_enfermagem (unidade_id, paciente_id, episodio_id, internacao_id, tipo, local, calibre,
                                              inserido_em, troca_prevista, observacao, registrado_por)
  VALUES (a.unidade_id, p_paciente, a.episodio_id, a.internacao_id, p_tipo, btrim(coalesce(p_local, '')),
          btrim(coalesce(p_calibre, '')), p_inserido_em, p_troca_prevista, btrim(coalesce(p_observacao, '')), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_dispositivo(uuid, text, text, text, date, date, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_dispositivo(uuid, text, text, text, date, date, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_dispositivo(p_dispositivo uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.dispositivos_enfermagem;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.dispositivos_enfermagem WHERE id = p_dispositivo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispositivo não encontrado.'; END IF;
  PERFORM private.exigir_enfermagem(d.paciente_id, false);
  IF d.retirado_em IS NOT NULL THEN RAISE EXCEPTION 'Dispositivo já retirado.'; END IF;
  UPDATE public.dispositivos_enfermagem
     SET retirado_em = now(), retirado_por = private.meu_perfil_id(), motivo_retirada = nullif(btrim(coalesce(p_motivo, '')), '')
   WHERE id = d.id;
END $$;
REVOKE ALL ON FUNCTION public.retirar_dispositivo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_dispositivo(uuid, text) TO authenticated;

-- Leitura para a evolução médica (contexto_evolucao devolve hoje '[]'): os
-- dispositivos em uso do paciente, um texto por dispositivo, na ordem da
-- inserção. D1 é o dia da inserção (mesma contagem do antimicrobiano).
CREATE OR REPLACE FUNCTION private.dispositivos_em_uso_texto(p_paciente uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(
           concat_ws(' · ', d.tipo, nullif(d.local, ''), nullif(d.calibre, ''))
           || ' (D' || (private.data_atual() - d.inserido_em + 1) || ')'
           ORDER BY d.inserido_em, d.registrado_em), '[]'::jsonb)
    FROM public.dispositivos_enfermagem d
   WHERE d.paciente_id = p_paciente AND d.retirado_em IS NULL
$$;
REVOKE ALL ON FUNCTION private.dispositivos_em_uso_texto(uuid) FROM PUBLIC, anon, authenticated;

-- ── 5. balanço hídrico ──────────────────────────────────────────────────────
-- A hora do fato pode ser até 24 h para trás (o lançamento do período) e não
-- pode ser no futuro.
CREATE OR REPLACE FUNCTION public.lancar_balanco(
  p_paciente uuid, p_tipo text, p_descricao text, p_volume_ml numeric, p_aferido_em timestamptz DEFAULT NULL,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; v_id uuid; v_quando timestamptz := coalesce(p_aferido_em, now());
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.exigir_enfermagem(p_paciente, false);
  SELECT * INTO a FROM private.atendimento_enfermagem(p_paciente, p_episodio, p_internacao);
  IF p_tipo IS NULL OR p_tipo NOT IN ('entrada', 'saida') THEN RAISE EXCEPTION 'Escolha entrada ou saída.'; END IF;
  IF length(btrim(coalesce(p_descricao, ''))) < 2 THEN RAISE EXCEPTION 'Descreva o que entrou ou saiu.'; END IF;
  IF p_volume_ml IS NULL OR p_volume_ml <= 0 OR p_volume_ml > 10000 THEN
    RAISE EXCEPTION 'Volume em mL, maior que zero e até 10000.';
  END IF;
  IF v_quando > now() + interval '1 minute' THEN RAISE EXCEPTION 'A hora não pode ser no futuro.'; END IF;
  IF v_quando < now() - interval '24 hours' THEN RAISE EXCEPTION 'Lançamento com mais de 24 h: fale com o enfermeiro do setor.'; END IF;
  INSERT INTO public.balanco_hidrico (unidade_id, paciente_id, episodio_id, internacao_id, tipo, descricao, volume_ml, aferido_em, registrado_por)
  VALUES (a.unidade_id, p_paciente, a.episodio_id, a.internacao_id, p_tipo, btrim(p_descricao), round(p_volume_ml, 1), v_quando,
          private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.lancar_balanco(uuid, text, text, numeric, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lancar_balanco(uuid, text, text, numeric, timestamptz, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_balanco(p_lancamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.balanco_hidrico;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO b FROM public.balanco_hidrico WHERE id = p_lancamento FOR UPDATE;
  IF NOT FOUND OR b.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Lançamento não encontrado ou já cancelado.'; END IF;
  PERFORM private.exigir_enfermagem(b.paciente_id, false);
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que o lançamento é cancelado (mínimo de 10 letras).'; END IF;
  UPDATE public.balanco_hidrico SET cancelado_em = now(), cancelado_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = b.id;
END $$;
REVOKE ALL ON FUNCTION public.cancelar_balanco(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_balanco(uuid, text) TO authenticated;

-- ── 6. curativos ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_curativo(
  p_paciente uuid, p_local text, p_tipo text, p_aspecto text, p_proxima_troca date DEFAULT NULL, p_observacao text DEFAULT NULL,
  p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.exigir_enfermagem(p_paciente, false);
  SELECT * INTO a FROM private.atendimento_enfermagem(p_paciente, p_episodio, p_internacao);
  IF length(btrim(coalesce(p_local, ''))) < 2 THEN RAISE EXCEPTION 'Informe o local do curativo.'; END IF;
  IF length(btrim(coalesce(p_tipo, ''))) < 2 THEN RAISE EXCEPTION 'Informe o tipo de curativo (cobertura).'; END IF;
  IF p_proxima_troca IS NOT NULL AND p_proxima_troca < private.data_atual() THEN
    RAISE EXCEPTION 'A próxima troca não pode ser antes de hoje.';
  END IF;
  INSERT INTO public.curativos_enfermagem (unidade_id, paciente_id, episodio_id, internacao_id, local, tipo, aspecto, proxima_troca,
                                           observacao, registrado_por)
  VALUES (a.unidade_id, p_paciente, a.episodio_id, a.internacao_id, btrim(p_local), btrim(p_tipo), btrim(coalesce(p_aspecto, '')),
          p_proxima_troca, btrim(coalesce(p_observacao, '')), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_curativo(uuid, text, text, text, date, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_curativo(uuid, text, text, text, date, text, uuid, uuid) TO authenticated;

-- ── 7. leitura do painel ────────────────────────────────────────────────────
-- Tudo o que o painel "Cuidados" mostra, numa chamada: o que cada um pode,
-- a SAE vigente do atendimento, dispositivos, balanço (lançamentos das
-- últimas 48 h: a soma é do cliente), curativos e as últimas aferições de
-- sinais vitais (observacao, agrupadas por hora e autor).
CREATE OR REPLACE FUNCTION public.cuidados_enfermagem(p_paciente uuid, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes; v_ep uuid := p_episodio; v_int uuid := p_internacao; v_chave uuid; v_aberto boolean;
  v_plantao boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF private.pode_ler_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'O atendimento informado não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'A internação informada não é deste paciente.';
  END IF;
  -- sem nenhum informado: o episódio aberto, ou a internação aberta
  IF v_ep IS NULL AND v_int IS NULL THEN
    SELECT e.id INTO v_ep FROM public.episodios e WHERE e.paciente_id = p_paciente AND e.etapa <> 'encerrado'
     ORDER BY e.chegada_em DESC LIMIT 1;
    IF v_ep IS NULL THEN
      SELECT i.id INTO v_int FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
       ORDER BY i.data_admissao DESC LIMIT 1;
    END IF;
  END IF;
  IF v_int IS NULL AND v_ep IS NOT NULL THEN
    SELECT x.id INTO v_int FROM public.internacoes x
     WHERE x.episodio_id = v_ep AND x.status IN ('admitido', 'em_observacao', 'internado') ORDER BY x.data_admissao DESC LIMIT 1;
  END IF;
  v_chave := coalesce(v_int, v_ep);
  v_aberto := CASE WHEN v_int IS NOT NULL THEN EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int
                                                         AND i.status IN ('admitido', 'em_observacao', 'internado'))
                   WHEN v_ep IS NOT NULL THEN EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.etapa <> 'encerrado')
                   ELSE false END;
  v_plantao := private.paciente_no_meu_plantao(p_paciente) IS TRUE;

  RETURN jsonb_build_object(
    'episodio_id', v_ep,
    'internacao_id', v_int,
    'atendimento_aberto', v_aberto,
    'pode_registrar', v_aberto AND v_plantao AND private.sou_enfermagem(pa.unidade_id) IS TRUE,
    'pode_sae', v_aberto AND v_plantao AND private.tenho_papel(pa.unidade_id, 'enfermeiro') IS TRUE,
    'sae', (
      SELECT jsonb_build_object('id', s.id, 'versao', s.versao, 'avaliacao', s.avaliacao, 'diagnosticos', s.diagnosticos,
                                'planejamento', s.planejamento, 'implementacao', s.implementacao, 'evolucao', s.evolucao,
                                'registrado_em', s.registrado_em, 'autor', pf.nome_completo)
        FROM public.sae_registros s LEFT JOIN public.perfis pf ON pf.id = s.registrado_por
       WHERE v_chave IS NOT NULL AND coalesce(s.internacao_id, s.episodio_id) = v_chave
       ORDER BY s.versao DESC LIMIT 1),
    'dispositivos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'tipo', d.tipo, 'local', d.local, 'calibre', d.calibre, 'inserido_em', d.inserido_em,
               'troca_prevista', d.troca_prevista, 'observacao', d.observacao, 'registrado_em', d.registrado_em,
               'autor', pf.nome_completo, 'dia', private.data_atual() - d.inserido_em + 1,
               'retirado_em', d.retirado_em, 'retirado_por', pr.nome_completo, 'motivo_retirada', d.motivo_retirada)
               ORDER BY (d.retirado_em IS NULL) DESC, d.inserido_em DESC, d.registrado_em DESC)
        FROM public.dispositivos_enfermagem d
        LEFT JOIN public.perfis pf ON pf.id = d.registrado_por
        LEFT JOIN public.perfis pr ON pr.id = d.retirado_por
       WHERE d.paciente_id = p_paciente AND (d.retirado_em IS NULL OR d.retirado_em > now() - interval '7 days')), '[]'::jsonb),
    'balanco', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', b.id, 'tipo', b.tipo, 'descricao', b.descricao, 'volume_ml', b.volume_ml, 'aferido_em', b.aferido_em,
               'autor', pf.nome_completo, 'cancelado_em', b.cancelado_em, 'cancelado_por', pc.nome_completo,
               'motivo_cancelamento', b.motivo_cancelamento)
               ORDER BY b.aferido_em DESC)
        FROM public.balanco_hidrico b
        LEFT JOIN public.perfis pf ON pf.id = b.registrado_por
        LEFT JOIN public.perfis pc ON pc.id = b.cancelado_por
       WHERE b.paciente_id = p_paciente AND b.aferido_em > now() - interval '48 hours'), '[]'::jsonb),
    'curativos', coalesce((
      SELECT jsonb_agg(x.j ORDER BY x.registrado_em DESC) FROM (
        SELECT c.registrado_em, jsonb_build_object(
                 'id', c.id, 'local', c.local, 'tipo', c.tipo, 'aspecto', c.aspecto, 'proxima_troca', c.proxima_troca,
                 'observacao', c.observacao, 'registrado_em', c.registrado_em, 'autor', pf.nome_completo) AS j
          FROM public.curativos_enfermagem c LEFT JOIN public.perfis pf ON pf.id = c.registrado_por
         WHERE c.paciente_id = p_paciente ORDER BY c.registrado_em DESC LIMIT 20) x), '[]'::jsonb),
    'sinais_vitais', coalesce((
      SELECT jsonb_agg(g.j ORDER BY g.quando DESC) FROM (
        SELECT date_trunc('minute', o.aferido_em) AS quando,
               jsonb_build_object('aferido_em', date_trunc('minute', o.aferido_em), 'autor', max(pf.nome_completo),
                                  'valores', jsonb_object_agg(c.nome, o.valor_num)) AS j
          FROM public.observacao o
          JOIN public.conceito c ON c.id = o.conceito_id
          LEFT JOIN public.perfis pf ON pf.id = o.registrado_por
         WHERE o.paciente_id = p_paciente AND o.aferido_em > now() - interval '48 hours' AND o.valor_num IS NOT NULL
           AND c.nome IN ('pressao-arterial-sistolica', 'pressao-arterial-diastolica', 'frequencia-cardiaca', 'frequencia-respiratoria',
                          'temperatura', 'saturacao-o2', 'escala-dor', 'glicemia-capilar', 'peso')
         GROUP BY date_trunc('minute', o.aferido_em), o.registrado_por
         ORDER BY 1 DESC LIMIT 8) g), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.cuidados_enfermagem(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cuidados_enfermagem(uuid, uuid, uuid) TO authenticated;

-- ── 8. RLS e guarda ─────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sae_registros', 'dispositivos_enfermagem', 'balanco_hidrico', 'curativos_enfermagem'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_select ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated
      USING (private.papel_na_unidade(unidade_id) = ''gestor'' OR private.paciente_no_meu_plantao(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_segundo_fator ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_segundo_fator ON public.%1$I AS RESTRICTIVE FOR ALL TO authenticated USING (private.segundo_fator_ok())', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_pedido_acesso ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_pedido_acesso ON public.%1$I FOR SELECT TO authenticated
      USING (private.acesso_encerrado_vigente(paciente_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS %1$s_teleinterconsulta ON public.%1$I', t);
    EXECUTE format('CREATE POLICY %1$s_teleinterconsulta ON public.%1$I FOR SELECT TO authenticated
      USING (private.teleinterconsulta_vigente(paciente_id))', t);
    -- guarda de 20 anos: registro clínico não sai por DELETE
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
  END LOOP;
END $$;
