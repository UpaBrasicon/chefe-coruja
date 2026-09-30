-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo — alergia em três estados e evento adverso.
--
-- Segurança do paciente. O estado da alergia de cada paciente tem TRÊS valores
-- (protótipo, D4 — "lista vazia é resposta, não dado faltando"):
--   * tem alergia(s)  — há registro ativo em alergias_paciente;
--   * nega alergias   — registro explícito em alergias_negacoes, com autor e
--                       hora (não é campo em branco);
--   * não registrada  — nada: ninguém perguntou ainda.
-- Registrar uma alergia encerra o "nega" vigente; registrar "nega" só é aceito
-- sem alergia ativa (para negar, inative antes, com motivo).
--
-- Evento adverso (protótipo, aba "Alergias e eventos adversos"): ligado ao
-- paciente e, quando houver, ao item da prescrição; grau de 1 a 6 com os
-- rótulos do protótipo (Muito leve, Leve, Moderado, Grave, Risco de morte,
-- Morte); evoluir o grau grava histórico com autor e hora.
--
-- A TRAVA DA PRESCRIÇÃO NÃO MUDA: public.prescrever continua lendo
-- alergias_paciente (substância ativa × princípio ativo) e nada a contorna.
-- Nada se apaga: inativar exige motivo; as tabelas novas entram no gatilho da
-- guarda de 20 anos (20261001000004). Escrita só pelas RPCs abaixo.
--
-- Reaplicável: IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. alergias_paciente: tipo, gravidade e ligação ao cadastro ─────────────
ALTER TABLE public.alergias_paciente
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'medicamento',
  ADD COLUMN IF NOT EXISTS gravidade text NOT NULL DEFAULT 'desconhecida',
  ADD COLUMN IF NOT EXISTS medicamento_id uuid REFERENCES public.medicamento(id);
ALTER TABLE public.alergias_paciente DROP CONSTRAINT IF EXISTS alergias_paciente_tipo_check;
ALTER TABLE public.alergias_paciente ADD CONSTRAINT alergias_paciente_tipo_check
  CHECK (tipo IN ('medicamento', 'alimento', 'latex', 'contraste', 'outro'));
ALTER TABLE public.alergias_paciente DROP CONSTRAINT IF EXISTS alergias_paciente_gravidade_check;
ALTER TABLE public.alergias_paciente ADD CONSTRAINT alergias_paciente_gravidade_check
  CHECK (gravidade IN ('leve', 'moderada', 'grave', 'desconhecida'));
ALTER TABLE public.alergias_paciente DROP CONSTRAINT IF EXISTS alergias_paciente_medicamento_check;
ALTER TABLE public.alergias_paciente ADD CONSTRAINT alergias_paciente_medicamento_check
  CHECK (medicamento_id IS NULL OR tipo = 'medicamento');
-- inativar exige motivo (a RPC já pedia; agora o banco também). NOT VALID: vale
-- para o que for gravado daqui em diante sem reprovar linha antiga.
ALTER TABLE public.alergias_paciente DROP CONSTRAINT IF EXISTS alergias_paciente_inativacao_check;
ALTER TABLE public.alergias_paciente ADD CONSTRAINT alergias_paciente_inativacao_check
  CHECK (inativada_em IS NULL OR (inativada_por IS NOT NULL AND length(btrim(coalesce(motivo_inativacao, ''))) >= 10)) NOT VALID;
COMMENT ON COLUMN public.alergias_paciente.reacao IS 'Observação: reação apresentada, quando, quem informou.';
COMMENT ON COLUMN public.alergias_paciente.gravidade IS 'leve | moderada | grave (inclui anafilaxia) | desconhecida.';
COMMENT ON COLUMN public.alergias_paciente.medicamento_id IS 'Cadastro do medicamento, quando a substância é um. A trava da prescrição continua sendo por nome (substancia_norm).';

-- ── 2. "nega alergias": registro explícito, com autor e hora ────────────────
CREATE TABLE IF NOT EXISTS public.alergias_negacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  registrado_por      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em       timestamptz NOT NULL DEFAULT now(),
  encerrada_em        timestamptz,
  encerrada_por       uuid REFERENCES public.perfis(id),
  motivo_encerramento text,
  CONSTRAINT alergias_negacoes_encerramento CHECK (
    encerrada_em IS NULL OR (encerrada_por IS NOT NULL AND length(btrim(coalesce(motivo_encerramento, ''))) > 0))
);
-- no máximo um "nega" vigente por paciente
CREATE UNIQUE INDEX IF NOT EXISTS alergias_negacoes_vigente ON public.alergias_negacoes (paciente_id) WHERE encerrada_em IS NULL;
COMMENT ON TABLE public.alergias_negacoes IS
  'Porte: "nega alergias" como registro (autor e hora). Vigente = encerrada_em nula. Registrar alergia encerra; reconfirmar gera nova linha.';

-- ── 3. evento adverso e o histórico do grau ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos_adversos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id         uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id        uuid NOT NULL REFERENCES public.pacientes(id),
  prescricao_item_id uuid REFERENCES public.prescricao_itens(id),
  item_descricao     text,          -- retrato do item no registro (a leitura do item tem RLS própria)
  evento             text NOT NULL CHECK (length(btrim(evento)) >= 3),
  grau               smallint NOT NULL CHECK (grau BETWEEN 1 AND 6),  -- o grau atual = o último do histórico
  observacao         text,
  registrado_por     uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em      timestamptz NOT NULL DEFAULT now(),
  grau_em            timestamptz NOT NULL DEFAULT now(),
  inativado_em       timestamptz,
  inativado_por      uuid REFERENCES public.perfis(id),
  motivo_inativacao  text,
  CONSTRAINT eventos_adversos_inativacao CHECK (
    inativado_em IS NULL OR (inativado_por IS NOT NULL AND length(btrim(coalesce(motivo_inativacao, ''))) >= 10))
);
CREATE INDEX IF NOT EXISTS eventos_adversos_paciente ON public.eventos_adversos (paciente_id);
COMMENT ON TABLE public.eventos_adversos IS
  'Porte: evento adverso ligado ao paciente e, quando houver, ao item da prescrição. Grau 1–6 (Muito leve … Morte), histórico em eventos_adversos_graus.';

CREATE TABLE IF NOT EXISTS public.eventos_adversos_graus (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id      uuid NOT NULL REFERENCES public.eventos_adversos(id),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  grau           smallint NOT NULL CHECK (grau BETWEEN 1 AND 6),
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eventos_adversos_graus_evento ON public.eventos_adversos_graus (evento_id, registrado_em);
DROP TRIGGER IF EXISTS trg_eventos_adversos_graus_so_insercao ON public.eventos_adversos_graus;
CREATE TRIGGER trg_eventos_adversos_graus_so_insercao BEFORE UPDATE ON public.eventos_adversos_graus
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE OR REPLACE FUNCTION public.rotulo_grau_evento(p_grau int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (ARRAY['Muito leve', 'Leve', 'Moderado', 'Grave', 'Risco de morte', 'Morte'])[p_grau]
$$;
REVOKE ALL ON FUNCTION public.rotulo_grau_evento(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotulo_grau_evento(int) TO authenticated;

-- ── 4. leitura: as mesmas regras de alergias_paciente ───────────────────────
-- (gestor ou paciente no meu plantão; pedido de acesso encerrado; teleinterconsulta)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alergias_negacoes', 'eventos_adversos', 'eventos_adversos_graus'] LOOP
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

-- ── 5. o estado em três valores ─────────────────────────────────────────────
-- SECURITY INVOKER: responde com o que a RLS deixa o usuário ler.
CREATE OR REPLACE FUNCTION public.estado_alergia(p_paciente uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL) THEN 'tem'
    WHEN EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = p_paciente AND encerrada_em IS NULL) THEN 'nega'
    ELSE 'nao_registrada'
  END
$$;
REVOKE ALL ON FUNCTION public.estado_alergia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_alergia(uuid) TO authenticated;

-- uma escrita de alergia por paciente por vez (nega × registrar não se cruzam)
CREATE OR REPLACE FUNCTION private.travar_alergias_do_paciente(p_paciente uuid)
RETURNS void LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('alergias:' || p_paciente::text, 0))
$$;
REVOKE ALL ON FUNCTION private.travar_alergias_do_paciente(uuid) FROM PUBLIC, anon, authenticated;

-- ── 6. registrar alergia (substitui a versão da fase 4, mesma chamada curta) ──
DROP FUNCTION IF EXISTS public.registrar_alergia(uuid, text, text);
CREATE OR REPLACE FUNCTION public.registrar_alergia(
  p_paciente uuid, p_substancia text, p_reacao text DEFAULT NULL,
  p_tipo text DEFAULT 'medicamento', p_gravidade text DEFAULT 'desconhecida', p_medicamento uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_unidade uuid; v_med uuid := p_medicamento; v_sub text := btrim(coalesce(p_substancia, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(private.norm(v_sub)) < 3 THEN RAISE EXCEPTION 'Informe a substância.'; END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('medicamento', 'alimento', 'latex', 'contraste', 'outro') THEN
    RAISE EXCEPTION 'Tipo de alergia desconhecido: use medicamento, alimento, látex, contraste ou outro.';
  END IF;
  IF p_gravidade IS NULL OR p_gravidade NOT IN ('leve', 'moderada', 'grave', 'desconhecida') THEN
    RAISE EXCEPTION 'Gravidade desconhecida: use leve, moderada, grave ou desconhecida.';
  END IF;
  IF v_med IS NOT NULL THEN
    IF p_tipo <> 'medicamento' THEN RAISE EXCEPTION 'Só alergia a medicamento se liga ao cadastro de medicamentos.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.medicamento WHERE id = v_med) THEN RAISE EXCEPTION 'Medicamento não encontrado no cadastro.'; END IF;
  ELSIF p_tipo = 'medicamento' THEN
    -- liga sozinho quando o nome é exatamente o princípio ativo do cadastro
    SELECT id INTO v_med FROM public.medicamento
     WHERE principio_ativo_norm = private.norm(v_sub) AND ativo ORDER BY id LIMIT 1;
  END IF;

  PERFORM private.travar_alergias_do_paciente(p_paciente);
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  SELECT id INTO v_id FROM public.alergias_paciente
   WHERE paciente_id = p_paciente AND substancia_norm = private.norm(v_sub) AND inativada_em IS NULL;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- tem alergia: o "nega" vigente deixa de valer (fica no histórico)
  UPDATE public.alergias_negacoes
     SET encerrada_em = now(), encerrada_por = private.meu_perfil_id(), motivo_encerramento = 'Alergia registrada: ' || v_sub
   WHERE paciente_id = p_paciente AND encerrada_em IS NULL;

  INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, reacao, registrado_por, tipo, gravidade, medicamento_id)
  VALUES (v_unidade, p_paciente, v_sub, private.norm(v_sub), nullif(btrim(p_reacao), ''), private.meu_perfil_id(), p_tipo, p_gravidade, v_med)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_alergia(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_alergia(uuid, text, text, text, text, uuid) TO authenticated;

-- ── 7. nega alergias ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_nega_alergia(p_paciente uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_unidade uuid; v_lista text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  PERFORM private.travar_alergias_do_paciente(p_paciente);
  SELECT string_agg(substancia, ', ' ORDER BY registrado_em) INTO v_lista
    FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL;
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'O paciente tem alergia ativa registrada (%). Para registrar que nega alergias, inative antes cada uma, com o motivo.', v_lista;
  END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  -- reconfirmar: o anterior fica no histórico, o novo leva autor e hora de agora
  UPDATE public.alergias_negacoes
     SET encerrada_em = now(), encerrada_por = private.meu_perfil_id(), motivo_encerramento = 'Reconfirmado'
   WHERE paciente_id = p_paciente AND encerrada_em IS NULL;
  INSERT INTO public.alergias_negacoes (unidade_id, paciente_id, registrado_por)
  VALUES (v_unidade, p_paciente, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_nega_alergia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_nega_alergia(uuid) TO authenticated;

-- ── 8. evento adverso ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_evento_adverso(
  p_paciente uuid, p_evento text, p_grau int, p_item uuid DEFAULT NULL, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_unidade uuid; v_desc text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(btrim(coalesce(p_evento, ''))) < 3 THEN RAISE EXCEPTION 'Descreva o evento adverso.'; END IF;
  IF p_grau IS NULL OR p_grau NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Grau do evento: de 1 (muito leve) a 6 (morte).'; END IF;
  IF p_item IS NOT NULL THEN
    SELECT i.descricao || coalesce(' — ' || i.dose, '') || coalesce(' · ' || i.via, '') INTO v_desc
      FROM public.prescricao_itens i JOIN public.prescricoes p ON p.id = i.prescricao_id
     WHERE i.id = p_item AND p.paciente_id = p_paciente;
    IF NOT FOUND THEN RAISE EXCEPTION 'O item de prescrição não é deste paciente.'; END IF;
  END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  INSERT INTO public.eventos_adversos (unidade_id, paciente_id, prescricao_item_id, item_descricao, evento, grau, observacao, registrado_por)
  VALUES (v_unidade, p_paciente, p_item, v_desc, btrim(p_evento), p_grau, nullif(btrim(p_observacao), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  INSERT INTO public.eventos_adversos_graus (evento_id, unidade_id, paciente_id, grau, registrado_por)
  VALUES (v_id, v_unidade, p_paciente, p_grau, private.meu_perfil_id());
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_evento_adverso(uuid, text, int, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento_adverso(uuid, text, int, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.evoluir_grau_evento(p_evento uuid, p_grau int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.eventos_adversos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.eventos_adversos WHERE id = p_evento FOR UPDATE;
  IF NOT FOUND OR e.inativado_em IS NOT NULL THEN RAISE EXCEPTION 'Evento adverso não encontrado ou inativo.'; END IF;
  IF private.pode_atuar_no_paciente(e.paciente_id) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_grau IS NULL OR p_grau NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Grau do evento: de 1 (muito leve) a 6 (morte).'; END IF;
  IF p_grau = e.grau THEN RAISE EXCEPTION 'O evento já está nesse grau.'; END IF;
  INSERT INTO public.eventos_adversos_graus (evento_id, unidade_id, paciente_id, grau, registrado_por)
  VALUES (e.id, e.unidade_id, e.paciente_id, p_grau, private.meu_perfil_id());
  UPDATE public.eventos_adversos SET grau = p_grau, grau_em = now() WHERE id = e.id;
END $$;
REVOKE ALL ON FUNCTION public.evoluir_grau_evento(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evoluir_grau_evento(uuid, int) TO authenticated;

-- ── 9. inativar selecionados / todos (alergias e eventos), com motivo ───────
-- Tudo ou nada: se um só não puder, nenhum é inativado.
CREATE OR REPLACE FUNCTION public.inativar_registros_alergia(p_alergias uuid[], p_eventos uuid[], p_motivo text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; a public.alergias_paciente; e public.eventos_adversos; n int := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Diga por que o registro deixa de valer (mínimo de 10 letras).'; END IF;
  FOREACH v_id IN ARRAY coalesce(p_alergias, '{}') LOOP
    SELECT * INTO a FROM public.alergias_paciente WHERE id = v_id FOR UPDATE;
    IF NOT FOUND OR a.inativada_em IS NOT NULL THEN RAISE EXCEPTION 'Alergia não encontrada ou já inativa.'; END IF;
    IF private.pode_atuar_no_paciente(a.paciente_id) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    UPDATE public.alergias_paciente SET inativada_em = now(), inativada_por = private.meu_perfil_id(), motivo_inativacao = btrim(p_motivo)
     WHERE id = a.id;
    n := n + 1;
  END LOOP;
  FOREACH v_id IN ARRAY coalesce(p_eventos, '{}') LOOP
    SELECT * INTO e FROM public.eventos_adversos WHERE id = v_id FOR UPDATE;
    IF NOT FOUND OR e.inativado_em IS NOT NULL THEN RAISE EXCEPTION 'Evento adverso não encontrado ou já inativo.'; END IF;
    IF private.pode_atuar_no_paciente(e.paciente_id) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
    UPDATE public.eventos_adversos SET inativado_em = now(), inativado_por = private.meu_perfil_id(), motivo_inativacao = btrim(p_motivo)
     WHERE id = e.id;
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Nada selecionado para inativar.'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.inativar_registros_alergia(uuid[], uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inativar_registros_alergia(uuid[], uuid[], text) TO authenticated;

-- inativar_alergia (fase 4) continua valendo como está: motivo ≥ 10 letras.

-- ── 10. leitura do painel, com o nome de quem registrou ─────────────────────
-- A policy de perfis não deixa ler o nome de outro profissional; como em
-- prescricao_vigente, a leitura vem por função, com a MESMA regra das policies
-- de SELECT (gestor, paciente no meu plantão, pedido de acesso, teleinterconsulta).
CREATE OR REPLACE FUNCTION public.alergias_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)
          OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT jsonb_build_object(
    'estado', CASE
      WHEN EXISTS (SELECT 1 FROM public.alergias_paciente WHERE paciente_id = p_paciente AND inativada_em IS NULL) THEN 'tem'
      WHEN EXISTS (SELECT 1 FROM public.alergias_negacoes WHERE paciente_id = p_paciente AND encerrada_em IS NULL) THEN 'nega'
      ELSE 'nao_registrada' END,
    'alergias', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'substancia', a.substancia, 'tipo', a.tipo, 'gravidade', a.gravidade, 'reacao', a.reacao,
        'medicamento_id', a.medicamento_id, 'registrado_em', a.registrado_em, 'autor', pr.nome_completo,
        'inativada_em', a.inativada_em, 'inativada_por', pi.nome_completo, 'motivo_inativacao', a.motivo_inativacao)
        ORDER BY a.inativada_em IS NOT NULL, a.registrado_em DESC)
      FROM public.alergias_paciente a
      LEFT JOIN public.perfis pr ON pr.id = a.registrado_por
      LEFT JOIN public.perfis pi ON pi.id = a.inativada_por
      WHERE a.paciente_id = p_paciente), '[]'::jsonb),
    'negacoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id, 'registrado_em', n.registrado_em, 'autor', pr.nome_completo,
        'encerrada_em', n.encerrada_em, 'encerrada_por', pe.nome_completo, 'motivo_encerramento', n.motivo_encerramento)
        ORDER BY n.encerrada_em IS NOT NULL, n.registrado_em DESC)
      FROM public.alergias_negacoes n
      LEFT JOIN public.perfis pr ON pr.id = n.registrado_por
      LEFT JOIN public.perfis pe ON pe.id = n.encerrada_por
      WHERE n.paciente_id = p_paciente), '[]'::jsonb),
    'eventos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'evento', e.evento, 'grau', e.grau, 'observacao', e.observacao,
        'prescricao_item_id', e.prescricao_item_id, 'item_descricao', e.item_descricao,
        'registrado_em', e.registrado_em, 'autor', pr.nome_completo, 'grau_em', e.grau_em,
        'inativado_em', e.inativado_em, 'inativado_por', pi.nome_completo, 'motivo_inativacao', e.motivo_inativacao,
        'graus', (SELECT jsonb_agg(jsonb_build_object('grau', g.grau, 'registrado_em', g.registrado_em, 'autor', pg.nome_completo)
                                   ORDER BY g.registrado_em)
                  FROM public.eventos_adversos_graus g LEFT JOIN public.perfis pg ON pg.id = g.registrado_por
                  WHERE g.evento_id = e.id))
        ORDER BY e.inativado_em IS NOT NULL, e.grau_em DESC)
      FROM public.eventos_adversos e
      LEFT JOIN public.perfis pr ON pr.id = e.registrado_por
      LEFT JOIN public.perfis pi ON pi.id = e.inativado_por
      WHERE e.paciente_id = p_paciente), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.alergias_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alergias_do_paciente(uuid) TO authenticated;
