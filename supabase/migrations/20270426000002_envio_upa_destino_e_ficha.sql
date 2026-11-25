-- ════════════════════════════════════════════════════════════════════════════
-- Envio da UBS à UPA: dois consertos do teste de fluxo UBS → UPA (25/11/2026).
--
-- 1. encaminhar_upa aceitava a Central de Regulação como destino: a central é
--    uma unidade (tipo "upa" ou "hospital") da mesma rede, e a conferência só
--    olhava o tipo. A tela não oferece a central (regulacao_contexto tira), mas
--    a RPC gravava o envio e avisava a central. Agora recusa com a mesma
--    mensagem dos outros destinos inválidos.
-- 2. encaminhamento_upa_marcar_chegada aceitava ligar a chegada a uma ficha
--    que já é a chegada de OUTRO envio (a lista da recepção mostra todas as
--    fichas do dia). Dois envios na mesma ficha confundem o retorno à UBS.
--    Agora recusa, dizendo o número do outro envio.
--
-- Não muda: quem envia, quem marca a chegada, o "chegou" sem ficha que corrige
-- o "não chegou" do prazo (teste 5a_encaminhamento_upa, item 4) e a chegada
-- automática pela ficha.
--
-- Expand/contract: só troca trechos do corpo das duas funções (mesmo padrão de
-- 20270415000002). Idempotente: trecho já trocado é pulado; trecho não achado
-- aborta a migration.
--
-- Rollback: rodar as mesmas trocas com os pares invertidos (o trecho novo de
-- cada troca volta ao antigo); nenhum dado muda.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.fa_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. a central de regulação não é destino do envio ────────────────────────
SELECT pg_temp.fa_trocar('public.encaminhar_upa(uuid, uuid, text)',
$a$     OR u_destino.tipo::text NOT IN ('upa', 'hospital') OR NOT coalesce(u_destino.ativo, true) THEN$a$,
$b$     OR u_destino.tipo::text NOT IN ('upa', 'hospital') OR NOT coalesce(u_destino.ativo, true)
     OR EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = u_destino.id) THEN$b$);

-- ── 2. uma ficha é a chegada de um envio só ─────────────────────────────────
SELECT pg_temp.fa_trocar('public.encaminhamento_upa_marcar_chegada(uuid, boolean, uuid, text)',
$a$    RAISE EXCEPTION 'A ficha informada não é desta unidade.';
  END IF;$a$,
$b$    RAISE EXCEPTION 'A ficha informada não é desta unidade.';
  END IF;
  IF p_chegou AND p_episodio IS NOT NULL AND EXISTS (SELECT 1 FROM public.encaminhamentos_upa o
                                                     WHERE o.episodio_destino_id = p_episodio AND o.id <> x.id) THEN
    RAISE EXCEPTION 'Esta ficha já é a chegada do envio nº %: escolha a ficha deste paciente.',
      (SELECT o.numero FROM public.encaminhamentos_upa o WHERE o.episodio_destino_id = p_episodio AND o.id <> x.id ORDER BY o.enviado_em DESC LIMIT 1);
  END IF;$b$);

DROP FUNCTION pg_temp.fa_trocar(regprocedure, text[]);
