-- ════════════════════════════════════════════════════════════════════════════
-- Fase 0, tarefas 6 e 7 do BACKLOG.md — ciclo de vida do leito.
--
-- Diagnóstico (06/10/2026):
--   • alta/óbito/transferência mandam o leito para 'higienizacao' e não havia
--     como voltar a 'livre' — o leito ficava preso (o evento
--     'higienizacao_concluida' existia no schema e nunca era emitido);
--   • não havia bloqueio/desbloqueio com motivo: a tela de Setores trocava o
--     status direto na tabela (sem motivo, sem evento, podia bloquear leito
--     ocupado e "liberar" leito ocupado);
--   • abrir_internacao e a transferência de leito (registrar_evento_adt)
--     ocupavam o leito sem conferir que estava livre — e gravavam
--     status_antes = 'livre' fixo.
--
-- Decisões do responsável (06/10/2026):
--   1. concluem a higienização: enfermagem (enfermeiro e técnico) e gestor;
--   2. bloqueiam/desbloqueiam: gestor e enfermeiro, motivo obrigatório
--      (manutenção, isolamento, falta de equipe);
--   3. leito ocupado não é bloqueado — só depois da alta ou da transferência.
--
-- Mudança:
--   a) private.leito_transicao(): gatilho BEFORE UPDATE OF status em leitos —
--      a regra vale para TODA função que mexa no leito (as de hoje e as
--      futuras). Transições:
--        livre        → ocupado | bloqueado
--        higienizacao → livre | bloqueado | ocupado (só o retorno de alta cancelada)
--        ocupado      → higienizacao
--        bloqueado    → livre
--      Ocupar leito que não está livre dá erro (é o bug de abrir_internacao e
--      da transferência). Liberação (→ higienizacao) nunca trava uma alta: de
--      'livre' passa; de 'bloqueado' o leito continua bloqueado.
--   b) RPCs concluir_higienizacao, bloquear_leito, desbloquear_leito,
--      liberar_leito_sem_paciente (gestor; leito "ocupado" sem internação —
--      dado antigo, que a trava deixaria preso) e situacao_leitos (tela).
--   c) status do leito deixa de ser gravável pela API (grant por coluna): só
--      pelas RPCs.
--   d) cancelar_alta: o retorno ao leito em higienização passa pela trava e
--      o evento grava o status real de antes.
--
-- ROLLBACK (manual):
--   DROP TRIGGER IF EXISTS leito_transicao ON public.leitos;
--   DROP FUNCTION IF EXISTS private.leito_transicao(), private.leito_da_unidade(uuid),
--     public.concluir_higienizacao(uuid), public.bloquear_leito(uuid, text, text),
--     public.desbloquear_leito(uuid, text), public.liberar_leito_sem_paciente(uuid, text),
--     public.situacao_leitos(uuid);
--   GRANT INSERT, UPDATE ON public.leitos TO authenticated;
--   cancelar_alta: recriar pela versão de 20260928000004_fase3_alta_pacote.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── a) Trava das transições ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.leito_transicao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'higienizacao' THEN
    IF OLD.status = 'bloqueado' THEN
      NEW.status := 'bloqueado';               -- liberação não desbloqueia
    ELSIF OLD.status NOT IN ('ocupado', 'livre') THEN
      RAISE EXCEPTION 'Leito % já está em higienização.', OLD.identificador USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'ocupado' THEN
    IF OLD.status = 'livre'
       OR (OLD.status = 'higienizacao' AND current_setting('cc.leito_retorno', true) = 'on') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Leito % não está livre (%). Escolha um leito livre.', OLD.identificador,
      CASE OLD.status WHEN 'ocupado' THEN 'ocupado' WHEN 'bloqueado' THEN 'bloqueado'
                      WHEN 'higienizacao' THEN 'em higienização' ELSE OLD.status::text END
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'bloqueado' THEN
    IF OLD.status IN ('livre', 'higienizacao') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Leito % não pode ser bloqueado (%): só depois da alta ou da transferência.', OLD.identificador,
      CASE OLD.status WHEN 'ocupado' THEN 'ocupado' ELSE 'já bloqueado' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- NEW.status = 'livre'
  IF OLD.status IN ('higienizacao', 'bloqueado') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Leito % não pode ser liberado a partir de "%".', OLD.identificador, OLD.status
    USING ERRCODE = 'check_violation';
END; $$;

DROP TRIGGER IF EXISTS leito_transicao ON public.leitos;
CREATE TRIGGER leito_transicao
  BEFORE UPDATE OF status ON public.leitos
  FOR EACH ROW EXECUTE FUNCTION private.leito_transicao();

-- ── b) RPCs ─────────────────────────────────────────────────────────────────
-- Leito e unidade, travando a linha (duas pessoas no mesmo leito: a segunda
-- espera e vê o status novo).
CREATE OR REPLACE FUNCTION private.leito_da_unidade(p_leito uuid, OUT leito public.leitos, OUT unidade_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  SELECT l.* INTO leito FROM public.leitos l WHERE l.id = p_leito FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito não encontrado.' USING ERRCODE = 'no_data_found'; END IF;
  SELECT s.unidade_id INTO unidade_id FROM public.setores s WHERE s.id = leito.setor_id;
END; $$;
REVOKE ALL ON FUNCTION private.leito_da_unidade(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.concluir_higienizacao(p_leito uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false)
          OR private.tenho_papel(r.unidade_id, 'enfermeiro')
          OR private.tenho_papel(r.unidade_id, 'tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'Só a enfermagem ou o gestor da unidade concluem a higienização.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'higienizacao' THEN
    RAISE EXCEPTION 'Leito % não está em higienização.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'higienizacao_concluida', 'higienizacao', 'livre', v_perfil, 'Higienização concluída');
END; $$;

-- p_motivo: manutencao | isolamento | falta_equipe | outro (com observação)
CREATE OR REPLACE FUNCTION public.bloquear_leito(p_leito uuid, p_motivo text, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só o gestor ou o enfermeiro da unidade bloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_motivo IS NULL OR p_motivo NOT IN ('manutencao', 'isolamento', 'falta_equipe', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_motivo = 'outro' AND length(coalesce(v_obs, '')) < 5 THEN
    RAISE EXCEPTION 'Descreva o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'bloqueado' WHERE id = p_leito;   -- a trava recusa ocupado
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'bloqueio', (r.leito).status, 'bloqueado', v_perfil,
          p_motivo || coalesce(': ' || v_obs, ''));
END; $$;

CREATE OR REPLACE FUNCTION public.desbloquear_leito(p_leito uuid, p_observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro')) THEN
    RAISE EXCEPTION 'Só o gestor ou o enfermeiro da unidade desbloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'bloqueado' THEN
    RAISE EXCEPTION 'Leito % não está bloqueado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'desbloqueio', 'bloqueado', 'livre', v_perfil,
          coalesce(nullif(btrim(coalesce(p_observacao, '')), ''), 'Desbloqueio'));
END; $$;

-- Leito marcado como ocupado sem nenhuma internação ativa nele (dado antigo:
-- antes desta migration o status podia ser trocado à mão). Só o gestor; vai
-- para higienização, como numa alta, com motivo.
CREATE OR REPLACE FUNCTION public.liberar_leito_sem_paciente(p_leito uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) THEN
    RAISE EXCEPTION 'Só o gestor da unidade libera leito sem paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'ocupado' THEN
    RAISE EXCEPTION 'Leito % não está ocupado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes i
              WHERE i.leito_atual_id = p_leito AND i.status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'Leito % tem paciente: libere pela alta ou pela transferência.', (r.leito).identificador
      USING ERRCODE = 'check_violation';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Escreva o motivo.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'higienizacao' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'liberacao', 'ocupado', 'higienizacao', v_perfil, 'Sem paciente: ' || btrim(p_motivo));
END; $$;

-- Para a tela: leitos ativos da unidade com o status, desde quando e o motivo
-- do bloqueio, e o que a pessoa pode fazer neles.
CREATE OR REPLACE FUNCTION public.situacao_leitos(p_unidade uuid)
RETURNS TABLE (leito_id uuid, identificador text, setor_id uuid, setor_nome text, status public.status_leito,
               desde timestamptz, motivo text, pode_higienizar boolean, pode_bloquear boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_gestor boolean;
  v_enf boolean;
  v_tec boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.membro_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_gestor := coalesce(private.sou_gestor_da_unidade(p_unidade), false);
  v_enf := private.tenho_papel(p_unidade, 'enfermeiro');
  v_tec := private.tenho_papel(p_unidade, 'tecnico_enfermagem');
  RETURN QUERY
  SELECT l.id, l.identificador, s.id, s.nome, l.status,
         ev.created_at,
         CASE WHEN l.status = 'bloqueado' THEN
           (SELECT e.motivo FROM public.eventos_leito e
             WHERE e.leito_id = l.id AND e.tipo_evento = 'bloqueio' ORDER BY e.created_at DESC LIMIT 1) END,
         v_gestor OR v_enf OR v_tec,
         v_gestor OR v_enf
    FROM public.leitos l
    JOIN public.setores s ON s.id = l.setor_id
    LEFT JOIN LATERAL (SELECT e.created_at FROM public.eventos_leito e
                        WHERE e.leito_id = l.id ORDER BY e.created_at DESC LIMIT 1) ev ON true
   WHERE s.unidade_id = p_unidade AND l.ativo
   ORDER BY s.nome, l.identificador;
END; $$;

REVOKE ALL ON FUNCTION public.concluir_higienizacao(uuid), public.bloquear_leito(uuid, text, text),
  public.desbloquear_leito(uuid, text), public.liberar_leito_sem_paciente(uuid, text),
  public.situacao_leitos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_higienizacao(uuid), public.bloquear_leito(uuid, text, text),
  public.desbloquear_leito(uuid, text), public.liberar_leito_sem_paciente(uuid, text),
  public.situacao_leitos(uuid) TO authenticated;

-- ── c) Status só pelas RPCs ─────────────────────────────────────────────────
-- O cadastro (Setores) continua criando, renomeando e desativando leitos.
REVOKE INSERT, UPDATE ON public.leitos FROM authenticated;
GRANT INSERT (setor_id, identificador, tipo, ativo) ON public.leitos TO authenticated;
GRANT UPDATE (identificador, tipo, ativo, updated_at) ON public.leitos TO authenticated;

-- ── d) cancelar_alta: retorno ao leito pela trava, status real no evento ────
CREATE OR REPLACE FUNCTION public.cancelar_alta(p_internacao uuid, p_justificativa text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  ev public.eventos_adt;
  v_status text;
  v_leito uuid;
  v_status_leito public.status_leito;
  v_estado jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status IN ('admitido', 'em_observacao', 'internado') OR i.alta_registrada_em IS NULL THEN
    RAISE EXCEPTION 'Não há alta para cancelar.';
  END IF;
  IF NOT (i.alta_por = v_perfil OR private.papel_na_unidade(i.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Só quem deu a alta, ou o gestor, cancela.';
  END IF;
  IF i.alta_registrada_em < now() - interval '24 hours' THEN RAISE EXCEPTION 'A alta tem mais de 24 horas: fale com o gestor.'; END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Justifique o cancelamento (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = i.paciente_id AND id <> i.id
               AND status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'O paciente já tem outra internação ativa.';
  END IF;

  SELECT * INTO ev FROM public.eventos_adt WHERE internacao_id = i.id ORDER BY seq DESC LIMIT 1;
  v_status := coalesce(ev.estado_antes ->> 'status', 'internado');
  v_leito := nullif(ev.estado_antes ->> 'leito', '')::uuid;
  -- o leito volta se ainda não foi ocupado por outro
  IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND status IN ('livre', 'higienizacao')) THEN
    v_leito := NULL;
  END IF;

  v_estado := jsonb_build_object('status', v_status, 'setor', i.setor_atual_id, 'leito', v_leito);
  INSERT INTO public.eventos_adt (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento, estado_antes, estado_depois,
    leito_destino_id, setor_destino_id, autor_id, motivo, hash_previo, hash_conteudo)
  VALUES (ev.seq + 1, i.organizacao_id, i.unidade_id, i.id, i.paciente_id, 'cancelamento_alta', ev.estado_depois, v_estado,
    v_leito, i.setor_atual_id, v_perfil, btrim(p_justificativa), ev.hash_conteudo,
    private.hash_evento(ev.seq + 1, 'cancelamento_alta', v_estado, v_perfil, btrim(p_justificativa), ev.hash_conteudo));

  UPDATE public.internacoes
     SET status = v_status, leito_atual_id = v_leito, data_alta = NULL, cid_alta = NULL, alta_por = NULL,
         alta_registrada_em = NULL, alta_justificativa_retroativa = NULL, alta_observacoes = NULL, alta_detalhes = NULL,
         updated_at = now()
   WHERE id = i.id;
  IF v_leito IS NOT NULL THEN
    -- o paciente volta ao leito que deixou: única ocupação permitida a partir
    -- de 'higienizacao' (trava em private.leito_transicao)
    SELECT l.status INTO v_status_leito FROM public.leitos l WHERE l.id = v_leito FOR UPDATE;
    PERFORM set_config('cc.leito_retorno', 'on', true);
    UPDATE public.leitos SET status = 'ocupado' WHERE id = v_leito;
    PERFORM set_config('cc.leito_retorno', 'off', true);
    INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito, i.unidade_id, 'ocupacao', v_status_leito, 'ocupado', i.id, v_perfil, 'Alta cancelada');
  END IF;
  UPDATE public.pacientes SET setor_id = i.setor_atual_id, updated_at = now() WHERE id = i.paciente_id;
  UPDATE public.pacotes_alta SET situacao = 'revogado', revogado_em = now(), revogado_por = v_perfil
   WHERE internacao_id = i.id AND situacao = 'ativo';
  UPDATE public.alta_paciente SET status = 'cancelada', justificativa = coalesce(justificativa || ' · ', '') || 'Cancelada: ' || btrim(p_justificativa), updated_at = now()
   WHERE paciente_id = i.paciente_id AND criterios ->> 'internacao_id' = i.id::text AND status = 'concluida';
END $function$;
