-- ════════════════════════════════════════════════════════════════════════════
-- Fase 0, item 12 do BACKLOG.md — reserva de leito, parte 2.
--
-- Decisões do responsável (07/10/2026):
--   • reservam: plantonista, enfermeiro e gestor da unidade;
--   • para um paciente da unidade OU por motivo livre (ex.: transferência
--     externa chegando), com descrição obrigatória;
--   • validade escolhida em cada reserva: 1, 2, 4 ou 8 horas;
--   • cancelam: quem reservou, o enfermeiro e o gestor, com motivo.
--
-- Regras (na trava private.leito_transicao, valem para toda função):
--   livre → reservado (só pela RPC reservar_leito);
--   reservado → ocupado só pelo paciente da reserva (ou qualquer um, se a
--     reserva é por motivo livre) — conferido no gatilho de internacoes, que
--     marca a reserva como "ocupada";
--   reservado → livre só por cancelamento ou expiração;
--   leito reservado não é bloqueado (cancele antes).
-- Expiração automática: pg_cron a cada 5 minutos (private.expirar_reservas).
-- Só aditiva (expand): situacao_leitos ganha colunas no fim.
--
-- ROLLBACK (manual): SELECT cron.unschedule('expirar-reservas-leito');
--   DROP TRIGGER IF EXISTS reserva_na_ocupacao ON public.internacoes;
--   DROP FUNCTION IF EXISTS public.reservar_leito(uuid, int, uuid, text), public.cancelar_reserva(uuid, text),
--     public.leitos_para_ocupar(uuid, uuid), private.expirar_reservas(), private.reserva_na_ocupacao();
--   recriar private.leito_transicao, situacao_leitos, registrar_desfecho e finalizar_observacao pelas
--   versões de 20261024000001 / anteriores; a tabela reservas_leito pode ficar.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reservas_leito (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leito_id            uuid NOT NULL REFERENCES public.leitos(id),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid REFERENCES public.pacientes(id),
  motivo              text,
  reservado_por       uuid NOT NULL REFERENCES public.perfis(id),
  reservado_em        timestamptz NOT NULL DEFAULT now(),
  expira_em           timestamptz NOT NULL,
  situacao            text NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa', 'ocupada', 'cancelada', 'expirada')),
  encerrada_em        timestamptz,
  encerrada_por       uuid REFERENCES public.perfis(id),
  motivo_encerramento text,
  internacao_id       uuid REFERENCES public.internacoes(id),
  CHECK (paciente_id IS NOT NULL OR length(btrim(coalesce(motivo, ''))) >= 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS reservas_leito_uma_ativa_por_leito ON public.reservas_leito (leito_id) WHERE situacao = 'ativa';
CREATE UNIQUE INDEX IF NOT EXISTS reservas_leito_uma_ativa_por_paciente ON public.reservas_leito (paciente_id) WHERE situacao = 'ativa' AND paciente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservas_leito_expira ON public.reservas_leito (expira_em) WHERE situacao = 'ativa';

ALTER TABLE public.reservas_leito ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reservas_leito FROM anon, authenticated;
GRANT SELECT ON public.reservas_leito TO authenticated;   -- grava só pelas RPCs
DROP POLICY IF EXISTS reservas_leito_membro ON public.reservas_leito;
CREATE POLICY reservas_leito_membro ON public.reservas_leito FOR SELECT TO authenticated
  USING (coalesce(private.membro_da_unidade(unidade_id), false));
DROP POLICY IF EXISTS reservas_leito_segundo_fator ON public.reservas_leito;
CREATE POLICY reservas_leito_segundo_fator ON public.reservas_leito AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- ── Trava do leito com as regras da reserva ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.leito_transicao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'higienizacao' THEN
    IF OLD.status = 'bloqueado' THEN
      NEW.status := 'bloqueado';               -- liberação não desbloqueia
    ELSIF OLD.status NOT IN ('ocupado', 'livre') THEN
      RAISE EXCEPTION 'Leito % não pode ir para higienização a partir de "%".', OLD.identificador, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'ocupado' THEN
    IF OLD.status = 'livre'
       OR (OLD.status = 'higienizacao' AND current_setting('cc.leito_retorno', true) = 'on')
       OR (OLD.status = 'reservado' AND current_setting('cc.reserva_consumida', true) = OLD.id::text) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Leito % não está livre (%). Escolha um leito livre.', OLD.identificador,
      CASE OLD.status WHEN 'ocupado' THEN 'ocupado' WHEN 'bloqueado' THEN 'bloqueado'
                      WHEN 'higienizacao' THEN 'em higienização' WHEN 'reservado' THEN 'reservado'
                      ELSE OLD.status::text END
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'reservado' THEN
    IF OLD.status = 'livre' AND current_setting('cc.reserva_nova', true) = OLD.id::text THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Leito % não pode ser reservado (%): só leito livre, pela reserva.', OLD.identificador, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'bloqueado' THEN
    IF OLD.status IN ('livre', 'higienizacao') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Leito % não pode ser bloqueado (%): só depois da alta, da transferência ou do cancelamento da reserva.',
      OLD.identificador,
      CASE OLD.status WHEN 'ocupado' THEN 'ocupado' WHEN 'reservado' THEN 'reservado' ELSE 'já bloqueado' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- NEW.status = 'livre'
  IF OLD.status IN ('higienizacao', 'bloqueado')
     OR (OLD.status = 'reservado' AND current_setting('cc.reserva_encerrada', true) = OLD.id::text) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Leito % não pode ser liberado a partir de "%".', OLD.identificador, OLD.status
    USING ERRCODE = 'check_violation';
END; $$;

-- ── Ocupação consome a reserva (ou recusa outro paciente) ────────────────────
CREATE OR REPLACE FUNCTION private.reserva_na_ocupacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.reservas_leito;
  v_ident text;
BEGIN
  IF NEW.leito_atual_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.leito_atual_id IS NOT DISTINCT FROM OLD.leito_atual_id) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO r FROM public.reservas_leito
   WHERE leito_id = NEW.leito_atual_id AND situacao = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF r.expira_em > now() AND r.paciente_id IS NOT NULL AND r.paciente_id <> NEW.paciente_id THEN
    SELECT identificador INTO v_ident FROM public.leitos WHERE id = NEW.leito_atual_id;
    RAISE EXCEPTION 'Leito % está reservado para outro paciente.', v_ident USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reservas_leito
     SET situacao = CASE WHEN r.expira_em > now() THEN 'ocupada' ELSE 'expirada' END,
         encerrada_em = now(), encerrada_por = private.meu_perfil_id(), internacao_id = NEW.id,
         motivo_encerramento = CASE WHEN r.expira_em > now() THEN 'Ocupado pela internação' ELSE 'Expirada; ocupado por outra internação' END
   WHERE id = r.id;
  PERFORM set_config('cc.reserva_consumida', NEW.leito_atual_id::text, true);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS reserva_na_ocupacao ON public.internacoes;
-- AFTER: a internação já existe (a reserva aponta para ela); roda ao fim do
-- INSERT/UPDATE, antes de a função que interna marcar o leito como ocupado.
CREATE TRIGGER reserva_na_ocupacao
  AFTER INSERT OR UPDATE OF leito_atual_id ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION private.reserva_na_ocupacao();

-- ── RPCs ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reservar_leito(p_leito uuid, p_horas int, p_paciente uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_id uuid;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'plantonista')) THEN
    RAISE EXCEPTION 'Só plantonista, enfermeiro ou gestor da unidade reservam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_horas IS NULL OR p_horas NOT IN (1, 2, 4, 8) THEN
    RAISE EXCEPTION 'Escolha a validade da reserva: 1, 2, 4 ou 8 horas.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NULL AND length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Escolha o paciente ou descreva o motivo da reserva.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_paciente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = r.unidade_id) THEN
    RAISE EXCEPTION 'Paciente não pertence a esta unidade.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM private.expirar_reservas();   -- reserva vencida não segura leito nem paciente
  IF p_paciente IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservas_leito WHERE paciente_id = p_paciente AND situacao = 'ativa') THEN
    RAISE EXCEPTION 'Este paciente já tem um leito reservado: cancele a reserva anterior antes.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reservas_leito (leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
  VALUES (p_leito, r.unidade_id, p_paciente, v_motivo, v_perfil, now() + make_interval(hours => p_horas))
  RETURNING id INTO v_id;
  PERFORM set_config('cc.reserva_nova', p_leito::text, true);
  UPDATE public.leitos SET status = 'reservado' WHERE id = p_leito;   -- a trava recusa leito que não está livre
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'reserva', 'livre', 'reservado', v_perfil,
          CASE WHEN p_paciente IS NOT NULL THEN 'Reserva para paciente' ELSE 'Reserva: ' || v_motivo END
          || ' (' || p_horas || ' h)');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_leito uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  res public.reservas_leito;
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  SELECT * INTO res FROM public.reservas_leito WHERE leito_id = p_leito AND situacao = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito % não tem reserva ativa.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (res.reservado_por = v_perfil
          OR coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só quem reservou, o enfermeiro ou o gestor cancelam a reserva.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo do cancelamento.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reservas_leito
     SET situacao = 'cancelada', encerrada_em = now(), encerrada_por = v_perfil, motivo_encerramento = btrim(p_motivo)
   WHERE id = res.id;
  PERFORM set_config('cc.reserva_encerrada', p_leito::text, true);
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito AND status = 'reservado';
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'cancelamento_reserva', 'reservado', 'livre', v_perfil, 'Cancelada: ' || btrim(p_motivo));
END; $$;

-- Expiração: reserva vencida sai e o leito volta a livre. Roda pelo pg_cron e
-- antes de cada reserva nova.
CREATE OR REPLACE FUNCTION private.expirar_reservas()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  res public.reservas_leito;
  n int := 0;
BEGIN
  FOR res IN SELECT * FROM public.reservas_leito WHERE situacao = 'ativa' AND expira_em <= now() FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.reservas_leito SET situacao = 'expirada', encerrada_em = now(), motivo_encerramento = 'Prazo da reserva venceu'
     WHERE id = res.id;
    PERFORM set_config('cc.reserva_encerrada', res.leito_id::text, true);
    UPDATE public.leitos SET status = 'livre' WHERE id = res.leito_id AND status = 'reservado';
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
    VALUES (res.leito_id, res.unidade_id, 'cancelamento_reserva', 'reservado', 'livre', res.reservado_por, 'Reserva expirou');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION private.expirar_reservas() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expirar-reservas-leito';
SELECT cron.schedule('expirar-reservas-leito', '*/5 * * * *', 'SELECT private.expirar_reservas();');

-- Leitos que este paciente pode ocupar num setor: os livres e os reservados
-- para ele (ou por motivo livre). Para as telas de internação e observação.
CREATE OR REPLACE FUNCTION public.leitos_para_ocupar(p_setor uuid, p_paciente uuid DEFAULT NULL)
RETURNS TABLE (id uuid, identificador text, reservado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT s.unidade_id INTO v_unidade FROM public.setores s WHERE s.id = p_setor;
  IF v_unidade IS NULL OR NOT coalesce(private.membro_da_unidade(v_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT l.id, l.identificador, l.status = 'reservado'
    FROM public.leitos l
    LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
   WHERE l.setor_id = p_setor AND l.ativo
     AND (l.status = 'livre'
          OR (l.status = 'reservado' AND (rv.paciente_id IS NULL OR rv.paciente_id = p_paciente OR rv.expira_em <= now())))
   ORDER BY l.status = 'reservado' DESC, l.identificador;
END; $$;

-- Lista para as telas: agora com a reserva (colunas novas no fim).
DROP FUNCTION IF EXISTS public.situacao_leitos(uuid);
CREATE OR REPLACE FUNCTION public.situacao_leitos(p_unidade uuid)
RETURNS TABLE (leito_id uuid, identificador text, setor_id uuid, setor_nome text, status public.status_leito,
               desde timestamptz, motivo text, pode_higienizar boolean, pode_bloquear boolean,
               reserva_paciente text, reserva_motivo text, reserva_expira_em timestamptz,
               pode_reservar boolean, pode_cancelar_reserva boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_gestor boolean;
  v_enf boolean;
  v_tec boolean;
  v_med boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.membro_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_gestor := coalesce(private.sou_gestor_da_unidade(p_unidade), false);
  v_enf := private.tenho_papel(p_unidade, 'enfermeiro');
  v_tec := private.tenho_papel(p_unidade, 'tecnico_enfermagem');
  v_med := private.tenho_papel(p_unidade, 'plantonista');
  RETURN QUERY
  SELECT l.id, l.identificador, s.id, s.nome, l.status,
         ev.created_at,
         CASE WHEN l.status = 'bloqueado' THEN
           (SELECT e.motivo FROM public.eventos_leito e
             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1) END,
         v_gestor OR v_enf OR v_tec,
         v_gestor OR v_enf,
         p.nome, rv.motivo, rv.expira_em,
         v_gestor OR v_enf OR v_med,
         rv.id IS NOT NULL AND (v_gestor OR v_enf OR rv.reservado_por = v_perfil)
    FROM public.leitos l
    JOIN public.setores s ON s.id = l.setor_id
    LEFT JOIN LATERAL (SELECT e.created_at FROM public.eventos_leito e
                        WHERE e.leito_id = l.id ORDER BY e.created_at DESC LIMIT 1) ev ON true
    LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
    LEFT JOIN public.pacientes p ON p.id = rv.paciente_id
   WHERE s.unidade_id = p_unidade AND l.ativo
   ORDER BY s.nome, l.identificador;
END; $$;

REVOKE ALL ON FUNCTION public.reservar_leito(uuid, int, uuid, text), public.cancelar_reserva(uuid, text),
  public.leitos_para_ocupar(uuid, uuid), public.situacao_leitos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reservar_leito(uuid, int, uuid, text), public.cancelar_reserva(uuid, text),
  public.leitos_para_ocupar(uuid, uuid), public.situacao_leitos(uuid) TO authenticated;

-- ── Desfecho do PS e fim da observação: aceitam o leito reservado ────────────
-- (a confirmação de que a reserva é deste paciente fica no gatilho de internacoes)

CREATE OR REPLACE FUNCTION public.registrar_desfecho(p_episodio uuid, p_desfecho text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  e public.episodios;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_etapa text;
  v_setor uuid;
  v_leito uuid;
  v_internacao uuid;
  v_alta_em timestamptz;
  v_cid text;
  v_proc text;
  v_do text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  PERFORM private.medico_na_porta(e);
  IF e.etapa <> 'atendimento' THEN RAISE EXCEPTION 'O episódio não está em atendimento.'; END IF;
  IF p_desfecho NOT IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'evasao', 'obito', 'observacao', 'internacao') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;

  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros WHERE episodio_id = e.id) THEN
    RAISE EXCEPTION 'Registre o atendimento (SOAP) antes do desfecho.';
  END IF;
  -- hipótese diagnóstica (protótipo: "Informe a hipótese diagnóstica na aba Atendimento")
  IF p_desfecho <> 'evasao' AND NOT EXISTS (SELECT 1 FROM public.atendimento_registros
                                             WHERE episodio_id = e.id AND length(btrim(coalesce(avaliacao, ''))) > 0) THEN
    RAISE EXCEPTION 'Informe a hipótese diagnóstica (Avaliação) no registro do atendimento.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(btrim(coalesce(p_relato, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_desfecho = 'obito' THEN
    IF nullif(d ->> 'hora_obito', '') IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF (d ->> 'hora_obito')::timestamptz > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN RAISE EXCEPTION 'Informe o número da Declaração de Óbito.'; END IF;
  END IF;

  -- dados da alta (protótipo altaErro, manual 3.17)
  IF nullif(btrim(d ->> 'alta_em'), '') IS NOT NULL THEN
    BEGIN
      v_alta_em := (d ->> 'alta_em')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Data e hora da alta inválidas.';
    END;
    IF v_alta_em > now() + interval '1 minute' THEN RAISE EXCEPTION 'Data e hora da alta no futuro.'; END IF;
    IF v_alta_em < e.chegada_em THEN RAISE EXCEPTION 'Data e hora da alta antes da chegada do paciente.'; END IF;
    IF v_alta_em < now() - interval '30 minutes'
       AND length(btrim(coalesce(d ->> 'justificativa_retroativa', ''))) < 10 THEN
      RAISE EXCEPTION 'Alta retroativa: justifique (mínimo de 10 letras).';
    END IF;
    d := d || jsonb_build_object('alta_em', v_alta_em, 'retroativa', v_alta_em < now() - interval '30 minutes');
  END IF;
  IF p_desfecho IN ('alta', 'alta_apos_medicacao', 'alta_a_pedido', 'transferencia', 'obito') THEN
    v_cid := coalesce(nullif(btrim(d ->> 'cid_alta'), ''),
                      (SELECT s.cid FROM public.atendimento_registros s
                        WHERE s.episodio_id = e.id AND s.cid IS NOT NULL ORDER BY s.criado_em DESC LIMIT 1));
    IF v_cid IS NULL THEN RAISE EXCEPTION 'Informe o diagnóstico de alta (CID).'; END IF;
    IF private.cid_normalizado(v_cid) IS NULL THEN RAISE EXCEPTION 'Diagnóstico de alta: CID em formato inválido (ex.: J45.9).'; END IF;
    d := d || jsonb_build_object('cid_alta', private.cid_normalizado(v_cid));
  END IF;
  v_proc := nullif(regexp_replace(coalesce(d ->> 'procedimento', ''), '\D', '', 'g'), '');
  IF v_proc IS NOT NULL THEN
    IF v_proc !~ '^\d{10}$' THEN RAISE EXCEPTION 'Procedimento SIGTAP: código de 10 dígitos.'; END IF;
    IF EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento)
       AND NOT EXISTS (SELECT 1 FROM terminologia.sigtap_procedimento WHERE codigo = v_proc) THEN
      RAISE EXCEPTION 'Procedimento SIGTAP não encontrado na tabela vigente.';
    END IF;
    d := d || jsonb_build_object('procedimento', v_proc);
  END IF;
  IF p_desfecho = 'obito' THEN
    d := d || jsonb_build_object('setor_obito', coalesce(nullif(btrim(d ->> 'setor_obito'), ''),
                                                        (SELECT nome FROM public.setores WHERE id = e.setor_id)));
    IF private.cid_normalizado(d ->> 'cid_obito') IS NULL THEN RAISE EXCEPTION 'Óbito: informe o CID do óbito.'; END IF;
    v_do := regexp_replace(coalesce(d ->> 'numero_do', ''), '\D', '', 'g');
    IF v_do !~ '^\d{6,12}$' THEN RAISE EXCEPTION 'Óbito: o número da Declaração de Óbito tem de 6 a 12 dígitos.'; END IF;
    d := d || jsonb_build_object('cid_obito', private.cid_normalizado(d ->> 'cid_obito'), 'numero_do', v_do);
  END IF;

  IF p_desfecho = 'observacao' THEN
    SELECT b.setor_id, b.leito_id INTO v_setor, v_leito FROM private.box_livre(e.unidade_id, e.publico) b;
    IF v_setor IS NULL THEN RAISE EXCEPTION 'A unidade não tem setor de Observação cadastrado.'; END IF;
    v_internacao := private.internar_do_episodio(e, 'em_observacao', v_setor, v_leito);
    INSERT INTO public.pendencias (unidade_id, paciente_id, internacao_id, tipo, descricao, prazo, autor_id)
    VALUES (e.unidade_id, e.paciente_id, v_internacao, 'observacao',
            'Observação: definir conduta (alta ou internação) em até 6 horas.', now() + interval '6 hours',
            private.meu_perfil_id());
    d := d || jsonb_build_object('internacao_id', v_internacao, 'box', v_leito);
  ELSIF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = e.unidade_id
                                        AND ativo AND tipo IN ('internacao', 'uti', 'isolamento')) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    v_internacao := private.internar_do_episodio(e, 'internado', v_setor, v_leito);
    d := d || jsonb_build_object('internacao_id', v_internacao);
  END IF;

  v_etapa := CASE p_desfecho WHEN 'observacao' THEN 'observacao' WHEN 'internacao' THEN 'internacao' ELSE 'encerrado' END;
  UPDATE public.episodios
     SET etapa = v_etapa,
         desfecho = p_desfecho,
         desfecho_motivo = nullif(btrim(p_relato), ''),
         desfecho_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END,
         desfecho_em = now(), desfecho_por = private.meu_perfil_id(),
         encerrado_em = CASE WHEN v_etapa = 'encerrado' THEN now() END,
         encerrado_por = CASE WHEN v_etapa = 'encerrado' THEN private.meu_perfil_id() END,
         reavaliar_em = NULL,
         updated_at = now()
   WHERE id = e.id;
  -- Parecer órfão (decisão do RT 03/10/2026): ao encerrar o atendimento da
  -- porta, os pareceres ainda abertos deste episódio são cancelados com motivo
  -- (quando o paciente vai para observação ou internação, o parecer segue o
  -- paciente, então só cancela nos desfechos que encerram).
  IF v_etapa = 'encerrado' THEN
    PERFORM private.cancelar_pareceres_do_episodio(e, private.meu_perfil_id(),
      'Atendimento do pronto-socorro encerrado (' || p_desfecho || ') com o parecer ainda pendente.');
  END IF;
  DELETE FROM public.atendimento_rascunhos WHERE episodio_id = e.id;
  PERFORM private.registrar_auditoria('desfecho', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', v_etapa, 'tipo', p_desfecho));
END $function$;

CREATE OR REPLACE FUNCTION public.finalizar_observacao(p_internacao uuid, p_desfecho text, p_cid text DEFAULT NULL::text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_relato text := nullif(btrim(coalesce(p_relato, '')), '');
  v_tipo text;
  v_setor uuid;
  v_leito uuid;
  v_hora timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_mim(p_internacao, true);
  IF p_desfecho NOT IN ('alta_medica', 'alta_apos_medicacao', 'internacao', 'transferencia', 'evasao', 'alta_a_pedido', 'obito') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = i.id AND situacao = 'aguardando') THEN
    RAISE EXCEPTION 'Há passagem de plantão aguardando aceite. Retire a passagem antes de finalizar.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(coalesce(v_relato, '')) < 15 THEN
    RAISE EXCEPTION '%', CASE p_desfecho
      WHEN 'evasao' THEN 'Como e quando foi percebida a evasão: escreva ao menos 15 letras.'
      WHEN 'alta_a_pedido' THEN 'Riscos explicados e termo assinado: escreva ao menos 15 letras.'
      ELSE 'Circunstâncias do óbito e medidas realizadas: escreva ao menos 15 letras.' END;
  END IF;
  d := d || jsonb_build_object('desfecho_observacao', p_desfecho);

  -- quem sai da observação sai do protocolo junto
  UPDATE public.observacao_protocolos
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(),
         motivo_encerramento = 'Encerrado com o desfecho da observação'
   WHERE internacao_id = i.id AND encerrado_em IS NULL;

  IF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = i.unidade_id
                                        AND ativo AND (tipo IN ('internacao', 'uti', 'isolamento')
                                          OR (tipo = 'observacao' AND position('verm' in lower(nome)) > 0))) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    PERFORM public.registrar_evento_adt(i.id, 'internacao', v_setor, v_leito, coalesce(v_relato, 'Desfecho da observação'), d);
    UPDATE public.pacientes SET setor_id = v_setor, updated_at = now() WHERE id = i.paciente_id;
    RETURN;
  END IF;

  v_tipo := CASE p_desfecho
    WHEN 'alta_medica' THEN 'alta_melhorada'
    WHEN 'alta_apos_medicacao' THEN 'alta_melhorada'
    WHEN 'transferencia' THEN 'transferencia_externa'
    WHEN 'evasao' THEN 'alta_evasao'
    WHEN 'alta_a_pedido' THEN 'alta_pedido'
    ELSE 'obito' END;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o serviço de destino.';
  END IF;
  IF p_desfecho = 'obito' THEN
    v_hora := nullif(d ->> 'hora_obito', '')::timestamptz;
    IF v_hora IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF v_hora > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF v_hora < i.data_admissao THEN RAISE EXCEPTION 'Hora do óbito antes da entrada.'; END IF;
  END IF;
  -- a alta é registrada agora; a hora do óbito vai nos detalhes, como na porta
  PERFORM public.dar_alta(i.id, v_tipo, p_cid, NULL, NULL, v_relato, d);
END $function$;
