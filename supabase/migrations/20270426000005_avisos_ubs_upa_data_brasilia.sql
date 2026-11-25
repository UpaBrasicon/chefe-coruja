-- Teste de fluxo A (25/11/2026), mesmo defeito do achado B-10 (migration
-- 20270426000004) nas funções do percurso UBS ↔ UPA: os avisos gravavam
-- notificacoes_plantonista.data com current_date, que no banco é a data em UTC.
-- Das 21h à meia-noite de Brasília o aviso nascia com a data do dia seguinte, e
-- a chave (perfil, unidade, data, tipo) e as listas por dia ficavam um dia à
-- frente. O padrão do app é private.data_atual() (America/Sao_Paulo).
--
-- Funções:
--   private.encaminhamento_upa_avisar  (envio da UBS à UPA: aviso à UPA e a quem enviou)
--   private.contrarreferencia_gerar    (retorno da UPA ou do hospital à UBS)
--   private.u11_rn_na_ubs_da_mae       (recém-nascido avisado à UBS da mãe)
--
-- Troca current_date por private.data_atual(). Sem mudança de regra, de
-- permissão nem de texto. Idempotente: função que já não tem current_date fica
-- como está.

DO $m$
DECLARE f regprocedure; def text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'private.encaminhamento_upa_avisar(public.encaminhamentos_upa, boolean, text, text)'::regprocedure,
    'private.contrarreferencia_gerar(uuid, uuid)'::regprocedure,
    'private.u11_rn_na_ubs_da_mae()'::regprocedure]
  LOOP
    def := replace(pg_get_functiondef(f), E'\r', '');
    IF def ~* '\mcurrent_date\M' THEN
      EXECUTE regexp_replace(def, '\mcurrent_date\M', 'private.data_atual()', 'gi');
    END IF;
  END LOOP;
END $m$;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- A troca inversa nas mesmas três funções (private.data_atual() → current_date
-- na coluna "data" do INSERT em notificacoes_plantonista). Os avisos já gravados
-- não mudam.
