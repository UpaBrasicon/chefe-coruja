-- ════════════════════════════════════════════════════════════════════════════
-- Pedido 8, caminho C, J3: formulário "Agendar demonstração" na página de
-- entrada do app. Decisões do RT de 12/11/2026
-- (docs/landing/J3-FORMULARIO-DEMONSTRACAO-DIAGNOSTICO.md):
--   F1 = A: Edge Function pedir-demonstracao, com Turnstile, campo-isca e
--        limite por endereço de rede;
--   F2 = não gravar o pedido: o e-mail para contato@ é o registro;
--   F3 = 3 envios por endereço de rede por hora.
--
-- Só a contagem. A tabela guarda o resumo (hash) do endereço de rede e a hora,
-- nunca o endereço nem os dados da pessoa. Quem conta é a função, com a chave
-- de serviço; ninguém mais lê nem escreve.
--
-- A limpeza acontece na própria contagem: cada chamada apaga as horas com mais
-- de um dia. Não precisa de pg_cron.
--
-- Expand puro: tabela e função novas, nada existente muda.
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS public.contar_pedido_demonstracao(text);
--   DROP TABLE IF EXISTS private.pedido_demonstracao_limite;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS private.pedido_demonstracao_limite (
  chave    text        NOT NULL CHECK (chave ~ '^[0-9a-f]{64}$'),
  hora     timestamptz NOT NULL,
  pedidos  int         NOT NULL DEFAULT 0 CHECK (pedidos >= 0),
  PRIMARY KEY (chave, hora)
);
COMMENT ON TABLE private.pedido_demonstracao_limite IS
  'J3 (pedido 8): pedidos de demonstração por hora e por endereço de rede. chave = sha256 hex do endereço com um sal da função; sem dado pessoal.';
ALTER TABLE private.pedido_demonstracao_limite ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pedido_demonstracao_limite FROM PUBLIC, anon, authenticated;

-- Conta um pedido e diz se ainda cabe no limite da hora (3, decisão F3).
-- Devolve true quando o pedido pode seguir; false quando passou do limite.
CREATE OR REPLACE FUNCTION public.contar_pedido_demonstracao(p_chave text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora    timestamptz := date_trunc('hour', now());
  v_pedidos int;
BEGIN
  IF p_chave IS NULL OR p_chave !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Chave inválida.';
  END IF;
  DELETE FROM private.pedido_demonstracao_limite WHERE hora < now() - interval '1 day';
  INSERT INTO private.pedido_demonstracao_limite (chave, hora, pedidos)
  VALUES (p_chave, v_hora, 1)
  ON CONFLICT (chave, hora) DO UPDATE SET pedidos = private.pedido_demonstracao_limite.pedidos + 1
  RETURNING pedidos INTO v_pedidos;
  RETURN v_pedidos <= 3;
END; $$;
REVOKE ALL ON FUNCTION public.contar_pedido_demonstracao(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contar_pedido_demonstracao(text) TO service_role;
