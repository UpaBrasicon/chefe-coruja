-- Teste de fluxo B (25/11/2026), achado B-10: os avisos da regulação e do NIR
-- gravavam notificacoes_plantonista.data com current_date, que no banco é a
-- data em UTC. Das 21h à meia-noite de Brasília o aviso nascia com a data do
-- dia seguinte, e a chave (perfil, unidade, data, tipo) e as listas por dia
-- ficavam um dia à frente. O padrão do app é private.data_atual()
-- (America/Sao_Paulo), que as funções vizinhas já usam
-- (regulacao_responder_pendencia, regulacao_avisar_destino).
--
-- Troca current_date por private.data_atual() nas cinco funções que ainda
-- usavam a data em UTC. Sem mudança de regra, de permissão nem de texto.
-- Idempotente: função que já não tem current_date fica como está.

DO $m$
DECLARE f regprocedure; def text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.regulacao_atualizar_evolucao(uuid, text, text)'::regprocedure,
    'public.nir_cobrar(uuid, text, uuid)'::regprocedure,
    'private.regulacao_avisar_novo()'::regprocedure,
    'private.regulacao_avisar_pessoas(uuid[], uuid, text, text)'::regprocedure,
    'private.regulacao_avisar(public.regulacao_solicitacoes, text, text)'::regprocedure]
  LOOP
    def := replace(pg_get_functiondef(f), E'\r', '');
    IF def ~* '\mcurrent_date\M' THEN
      EXECUTE regexp_replace(def, '\mcurrent_date\M', 'private.data_atual()', 'gi');
    END IF;
  END LOOP;
END $m$;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- A troca inversa nas mesmas cinco funções (private.data_atual() → current_date
-- na coluna "data" do INSERT em notificacoes_plantonista). Os avisos já gravados
-- não mudam.
