-- ════════════════════════════════════════════════════════════════════════════
-- Correções do Portão 2, tarefa 1 — isolamento trava o leito (R2-01 do teste
-- de ponta a ponta de 12/10/2026; decisões do RT de 13 e 14/10/2026,
-- BACKLOG.md, "Correções do Portão 2").
--
-- • A marca fica no atendimento atual (porta ou internação) e sai sozinha na
--   alta. Se o paciente voltar, marca de novo.
-- • Tipos: contato, gotícula e aerossol (os mesmos da regulação). Pode haver
--   mais de um ao mesmo tempo.
-- • Médico ou enfermeiro marca e retira, sempre com motivo; tudo na auditoria.
-- • Serve qualquer leito do tipo "isolamento", em qualquer setor.
-- • Sem leito de isolamento livre, o paciente fica sem leito, aguardando, e o
--   NIR recebe aviso. Nunca vai para leito comum.
-- • Trava na internação ou observação com leito, na troca de leito, na
--   reserva e no aceite de leito da regulação; a regulação aberta para o
--   paciente marcado já leva o isolamento.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.isolamentos_paciente (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id      uuid REFERENCES public.episodios(id),
  internacao_id    uuid REFERENCES public.internacoes(id),
  tipo             text NOT NULL CHECK (tipo IN ('contato', 'goticula', 'aerossol')),
  motivo           text NOT NULL CHECK (length(btrim(motivo)) >= 5),
  marcado_por      uuid NOT NULL REFERENCES public.perfis(id),
  marcado_em       timestamptz NOT NULL DEFAULT now(),
  retirado_por     uuid REFERENCES public.perfis(id),
  retirado_em      timestamptz,
  motivo_retirada  text,
  CHECK (retirado_em IS NULL OR length(btrim(coalesce(motivo_retirada, ''))) >= 3)
);
CREATE UNIQUE INDEX IF NOT EXISTS isolamentos_um_ativo_por_tipo
  ON public.isolamentos_paciente (paciente_id, tipo) WHERE retirado_em IS NULL;
CREATE INDEX IF NOT EXISTS isolamentos_paciente_ativo ON public.isolamentos_paciente (paciente_id) WHERE retirado_em IS NULL;

ALTER TABLE public.isolamentos_paciente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.isolamentos_paciente FROM anon, authenticated;
GRANT SELECT ON public.isolamentos_paciente TO authenticated;   -- grava só pelas RPCs
DROP POLICY IF EXISTS isolamentos_membro ON public.isolamentos_paciente;
CREATE POLICY isolamentos_membro ON public.isolamentos_paciente FOR SELECT TO authenticated
  USING (coalesce(private.membro_da_unidade(unidade_id), false));
DROP POLICY IF EXISTS isolamentos_segundo_fator ON public.isolamentos_paciente;
CREATE POLICY isolamentos_segundo_fator ON public.isolamentos_paciente AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- Tipos ativos do paciente, do mais restritivo para o menos (aerossol, gotícula, contato).
CREATE OR REPLACE FUNCTION private.isolamento_ativo(p_paciente uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(tipo ORDER BY CASE tipo WHEN 'aerossol' THEN 1 WHEN 'goticula' THEN 2 ELSE 3 END), '{}'::text[])
    FROM public.isolamentos_paciente
   WHERE paciente_id = p_paciente AND retirado_em IS NULL
$$;
REVOKE ALL ON FUNCTION private.isolamento_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.isolamento_ativo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.rotulo_isolamento(p_tipos text[])
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT string_agg(CASE t WHEN 'goticula' THEN 'gotícula' ELSE t END, ' e ' ORDER BY o)
    FROM unnest(p_tipos) WITH ORDINALITY AS x(t, o)
$$;

-- Aviso ao NIR: paciente em isolamento internado fora de leito de isolamento
-- (sem leito ou em leito comum, porque a marca veio depois).
CREATE OR REPLACE FUNCTION private.avisar_isolamento_sem_leito(p_paciente uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes; v_tipos text[] := private.isolamento_ativo(p_paciente);
  v_nome text; v_setor text; v_leito text; v_msg text;
BEGIN
  IF cardinality(v_tipos) = 0 THEN RETURN; END IF;
  SELECT * INTO i FROM public.internacoes
   WHERE paciente_id = p_paciente AND data_alta IS NULL AND status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF i.leito_atual_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leitos WHERE id = i.leito_atual_id AND tipo = 'isolamento') THEN
    RETURN;
  END IF;
  SELECT coalesce(nome_social, nome) INTO v_nome FROM public.pacientes WHERE id = p_paciente;
  SELECT nome INTO v_setor FROM public.setores WHERE id = i.setor_atual_id;
  SELECT identificador INTO v_leito FROM public.leitos WHERE id = i.leito_atual_id;
  v_msg := v_nome || ' (' || coalesce(v_setor, 'sem setor') || ') precisa de isolamento por ' || private.rotulo_isolamento(v_tipos)
           || CASE WHEN v_leito IS NULL THEN ' e aguarda leito de isolamento.'
                   ELSE ', mas está no leito ' || v_leito || ', que não é de isolamento.' END;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT v.perfil_id, i.unidade_id, private.data_atual(), 'isolamento_' || i.id, v_msg
    FROM public.vinculos v WHERE v.unidade_id = i.unidade_id AND v.ativo AND v.papel = 'nir'
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
END $$;
REVOKE ALL ON FUNCTION private.avisar_isolamento_sem_leito(uuid) FROM PUBLIC, anon, authenticated;

-- ── Marcar e retirar ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_isolamento(p_paciente uuid, p_tipo text, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ep uuid; v_int uuid; v_unidade uuid; v_id uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_tipo IS NULL OR p_tipo NOT IN ('contato', 'goticula', 'aerossol') THEN
    RAISE EXCEPTION 'Escolha o tipo de isolamento: contato, gotícula ou aerossol.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Diga o motivo do isolamento (ex.: suspeita de tuberculose bacilífera).' USING ERRCODE = 'check_violation';
  END IF;
  SELECT id, unidade_id INTO v_int, v_unidade FROM public.internacoes
   WHERE paciente_id = p_paciente AND data_alta IS NULL AND status IN ('admitido', 'em_observacao', 'internado')
   ORDER BY created_at DESC LIMIT 1;
  v_ep := private.episodio_aberto(p_paciente);
  IF v_unidade IS NULL AND v_ep IS NOT NULL THEN SELECT unidade_id INTO v_unidade FROM public.episodios WHERE id = v_ep; END IF;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'O paciente não tem atendimento nem internação aberta: o isolamento vale para o atendimento atual.';
  END IF;
  IF NOT (coalesce(private.tenho_papel(v_unidade, 'plantonista'), false) OR coalesce(private.tenho_papel(v_unidade, 'enfermeiro'), false)) THEN
    RAISE EXCEPTION 'O isolamento é marcado pelo médico ou pelo enfermeiro.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT coalesce(private.paciente_no_meu_plantao(p_paciente), false) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.isolamentos_paciente WHERE paciente_id = p_paciente AND tipo = p_tipo AND retirado_em IS NULL) THEN
    RAISE EXCEPTION 'O paciente já está em isolamento por %.', private.rotulo_isolamento(ARRAY[p_tipo]) USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.isolamentos_paciente (unidade_id, paciente_id, episodio_id, internacao_id, tipo, motivo, marcado_por)
  VALUES (v_unidade, p_paciente, v_ep, v_int, p_tipo, v_motivo, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('isolamento_marcado', 'isolamentos_paciente', v_id, v_unidade,
    jsonb_build_object('tipo', p_tipo, 'paciente_id', p_paciente));
  PERFORM private.avisar_isolamento_sem_leito(p_paciente);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.marcar_isolamento(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_isolamento(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_isolamento(p_isolamento uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.isolamentos_paciente; v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.isolamentos_paciente WHERE id = p_isolamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Isolamento não encontrado.'; END IF;
  IF r.retirado_em IS NOT NULL THEN RAISE EXCEPTION 'Este isolamento já foi retirado.'; END IF;
  IF NOT (coalesce(private.tenho_papel(r.unidade_id, 'plantonista'), false) OR coalesce(private.tenho_papel(r.unidade_id, 'enfermeiro'), false)) THEN
    RAISE EXCEPTION 'O isolamento é retirado pelo médico ou pelo enfermeiro.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT coalesce(private.paciente_no_meu_plantao(r.paciente_id), false) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Diga por que o isolamento sai (ex.: baciloscopias negativas).' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.isolamentos_paciente
     SET retirado_em = now(), retirado_por = private.meu_perfil_id(), motivo_retirada = v_motivo
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('isolamento_retirado', 'isolamentos_paciente', r.id, r.unidade_id,
    jsonb_build_object('tipo', r.tipo, 'paciente_id', r.paciente_id));
END $$;
REVOKE ALL ON FUNCTION public.retirar_isolamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_isolamento(uuid, text) TO authenticated;

-- Para a tela: isolamentos ativos, com quem marcou.
CREATE OR REPLACE FUNCTION public.isolamento_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT coalesce(private.membro_da_unidade(v_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', i.id, 'tipo', i.tipo, 'motivo', i.motivo, 'marcado_em', i.marcado_em,
                                        'marcado_por', p.nome_completo)
                     ORDER BY CASE i.tipo WHEN 'aerossol' THEN 1 WHEN 'goticula' THEN 2 ELSE 3 END)
      FROM public.isolamentos_paciente i LEFT JOIN public.perfis p ON p.id = i.marcado_por
     WHERE i.paciente_id = p_paciente AND i.retirado_em IS NULL), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.isolamento_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.isolamento_do_paciente(uuid) TO authenticated;

-- ── Travas ───────────────────────────────────────────────────────────────────
-- Internação ou observação com leito, troca de leito, conversão: só leito de isolamento.
CREATE OR REPLACE FUNCTION private.internacao_isolamento_no_leito()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tipos text[]; v_ident text;
BEGIN
  IF NEW.leito_atual_id IS NULL OR NEW.data_alta IS NOT NULL
     OR (TG_OP = 'UPDATE' AND NEW.leito_atual_id IS NOT DISTINCT FROM OLD.leito_atual_id) THEN
    RETURN NEW;
  END IF;
  v_tipos := private.isolamento_ativo(NEW.paciente_id);
  IF cardinality(v_tipos) > 0 AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = NEW.leito_atual_id AND tipo = 'isolamento') THEN
    SELECT identificador INTO v_ident FROM public.leitos WHERE id = NEW.leito_atual_id;
    RAISE EXCEPTION 'Paciente em isolamento por %: o leito % não é de isolamento. Escolha um leito de isolamento ou deixe sem leito, aguardando.',
      private.rotulo_isolamento(v_tipos), v_ident USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_isolamento_no_leito ON public.internacoes;
CREATE TRIGGER trg_internacao_isolamento_no_leito BEFORE INSERT OR UPDATE OF leito_atual_id ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_isolamento_no_leito();

-- Internou sem leito (aguardando isolamento): avisa o NIR.
CREATE OR REPLACE FUNCTION private.internacao_isolamento_aviso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.data_alta IS NULL AND NEW.leito_atual_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.leito_atual_id IS NOT NULL OR OLD.setor_atual_id IS DISTINCT FROM NEW.setor_atual_id) THEN
    PERFORM private.avisar_isolamento_sem_leito(NEW.paciente_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_isolamento_aviso ON public.internacoes;
CREATE TRIGGER trg_internacao_isolamento_aviso AFTER INSERT OR UPDATE OF leito_atual_id, setor_atual_id ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_isolamento_aviso();

-- Reserva de leito para o paciente marcado: só leito de isolamento.
CREATE OR REPLACE FUNCTION private.reserva_isolamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tipos text[]; v_ident text;
BEGIN
  IF NEW.paciente_id IS NULL THEN RETURN NEW; END IF;
  v_tipos := private.isolamento_ativo(NEW.paciente_id);
  IF cardinality(v_tipos) > 0 AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = NEW.leito_id AND tipo = 'isolamento') THEN
    SELECT identificador INTO v_ident FROM public.leitos WHERE id = NEW.leito_id;
    RAISE EXCEPTION 'Paciente em isolamento por %: o leito % não é de isolamento.', private.rotulo_isolamento(v_tipos), v_ident
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reserva_isolamento ON public.reservas_leito;
CREATE TRIGGER trg_reserva_isolamento BEFORE INSERT ON public.reservas_leito
  FOR EACH ROW EXECUTE FUNCTION private.reserva_isolamento();

-- Regulação aberta para paciente marcado: já sai com o isolamento (o mais restritivo).
CREATE OR REPLACE FUNCTION private.regulacao_leva_isolamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tipos text[];
BEGIN
  IF NEW.paciente_id IS NULL THEN RETURN NEW; END IF;
  v_tipos := private.isolamento_ativo(NEW.paciente_id);
  IF cardinality(v_tipos) > 0 THEN
    IF NOT coalesce(NEW.isolamento, false) THEN
      NEW.isolamento := true;
      NEW.isolamento_tipo := v_tipos[1];
    ELSIF NEW.isolamento_tipo IS DISTINCT FROM v_tipos[1]
          AND array_position(ARRAY['aerossol', 'goticula', 'contato'], v_tipos[1]) < array_position(ARRAY['aerossol', 'goticula', 'contato'], NEW.isolamento_tipo) THEN
      NEW.isolamento_tipo := v_tipos[1];   -- não deixa a regulação pedir menos do que a marca
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_regulacao_leva_isolamento ON public.regulacao_solicitacoes;
CREATE TRIGGER trg_regulacao_leva_isolamento BEFORE INSERT ON public.regulacao_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION private.regulacao_leva_isolamento();

-- Aceite do destino com leito: se a regulação pede isolamento, o leito tem de ser de isolamento.
CREATE OR REPLACE FUNCTION private.aceite_isolamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.regulacao_solicitacoes; v_ident text;
BEGIN
  IF NEW.resposta <> 'aceita' OR NEW.leito_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = NEW.solicitacao_id;
  IF coalesce(s.isolamento, false) AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = NEW.leito_id AND tipo = 'isolamento') THEN
    SELECT identificador INTO v_ident FROM public.leitos WHERE id = NEW.leito_id;
    RAISE EXCEPTION 'A regulação pede isolamento por %: o leito % não é de isolamento. Reserve um leito de isolamento.',
      private.rotulo_isolamento(ARRAY[s.isolamento_tipo]), v_ident USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aceite_isolamento ON public.regulacao_destino_respostas;
CREATE TRIGGER trg_aceite_isolamento BEFORE INSERT ON public.regulacao_destino_respostas
  FOR EACH ROW EXECUTE FUNCTION private.aceite_isolamento();

-- A escolha de leito na tela já mostra só os de isolamento para o paciente marcado.
CREATE OR REPLACE FUNCTION public.leitos_para_ocupar(p_setor uuid, p_paciente uuid DEFAULT NULL)
RETURNS TABLE (id uuid, identificador text, reservado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_isol boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT s.unidade_id INTO v_unidade FROM public.setores s WHERE s.id = p_setor;
  IF v_unidade IS NULL OR NOT coalesce(private.membro_da_unidade(v_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_isol := p_paciente IS NOT NULL AND cardinality(private.isolamento_ativo(p_paciente)) > 0;
  RETURN QUERY
  SELECT l.id, l.identificador, l.status = 'reservado'
    FROM public.leitos l
    LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
   WHERE l.setor_id = p_setor AND l.ativo
     AND (NOT v_isol OR l.tipo = 'isolamento')
     AND (l.status = 'livre'
          OR (l.status = 'reservado' AND (rv.paciente_id IS NULL OR rv.paciente_id = p_paciente OR rv.expira_em <= now())))
   ORDER BY l.status = 'reservado' DESC, l.identificador;
END; $$;

-- ── Fim na alta ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.encerrar_isolamento(p_paciente uuid, p_por uuid, p_motivo text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.isolamentos_paciente
     SET retirado_em = now(), retirado_por = coalesce(p_por, marcado_por), motivo_retirada = p_motivo
   WHERE paciente_id = p_paciente AND retirado_em IS NULL
$$;
REVOKE ALL ON FUNCTION private.encerrar_isolamento(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.internacao_alta_encerra_isolamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.data_alta IS NULL AND NEW.data_alta IS NOT NULL THEN
    PERFORM private.encerrar_isolamento(NEW.paciente_id, coalesce(NEW.alta_por, private.meu_perfil_id()),
      'Encerrado com a alta da internação');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_internacao_alta_encerra_isolamento ON public.internacoes;
CREATE TRIGGER trg_internacao_alta_encerra_isolamento AFTER UPDATE OF data_alta ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.internacao_alta_encerra_isolamento();

-- Desfecho da porta sem internação nem observação (alta, evasão, óbito, transferência…).
CREATE OR REPLACE FUNCTION private.episodio_fim_encerra_isolamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.etapa IS DISTINCT FROM 'encerrado' AND NEW.etapa = 'encerrado'
     AND coalesce(NEW.desfecho, '') NOT IN ('internacao', 'observacao')
     AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = NEW.paciente_id AND i.data_alta IS NULL
                       AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    PERFORM private.encerrar_isolamento(NEW.paciente_id, coalesce(NEW.desfecho_por, NEW.encerrado_por, private.meu_perfil_id()),
      'Encerrado com o desfecho do atendimento');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_episodio_fim_encerra_isolamento ON public.episodios;
CREATE TRIGGER trg_episodio_fim_encerra_isolamento AFTER UPDATE OF etapa ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.episodio_fim_encerra_isolamento();
