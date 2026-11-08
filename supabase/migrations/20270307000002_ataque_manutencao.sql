-- ════════════════════════════════════════════════════════════════════════════
-- Achado P2-1 do A01 (teste da rede, 06/11/2026): ataque e manutenção do
-- mesmo medicamento não conviviam na prescrição. Decisão do RT em
-- 07/11/2026: A em M1 a M5 (docs/teste-rede/CORRECOES-A01-DIAGNOSTICO.md).
--
-- M1. A trava "um item ativo por medicamento e via" não conta o item "Agora":
--     o ataque ("Agora") e a manutenção (contínuo, intervalo ou se
--     necessário) ficam ativos juntos.
-- M2. Dois "Agora" do mesmo medicamento e via: recusado enquanto o anterior
--     não tiver a dose feita (evita o clique duplo); depois da dose feita, um
--     "Agora" novo é aceito.
-- M3. Duas manutenções do mesmo medicamento e via continuam recusadas.
-- M5. Vale na porta, na observação e na internação (mesma RPC). "Agora" é o
--     texto da frequência igual a "agora", sem diferença de maiúsculas e
--     espaços, como em checar (F5) e na frequência da porta (F1). Outro texto
--     ("imediato", "já") continua travando.
-- M4 (aviso "Já prescrito" antes de gravar) é só da tela.
--
-- Só troca de texto reaplicável em public.prescrever, como a 20270301000001;
-- se o trecho não for achado, para. Nenhuma tabela muda. Nenhuma dose aqui.
--
-- ROLLBACK (em homologação antes; nada aqui apaga dado):
--   DO $$
--   DECLARE d text;
--   BEGIN
--     d := replace(pg_get_functiondef('public.prescrever(uuid, jsonb)'::regprocedure), E'\r', '');
--     EXECUTE regexp_replace(d, '\n  -- M1 a M3 \(ataque e manutenção\).*?-- fim M1 a M3\n',
--       E'\n  IF v_tipo = ''medicamento'' AND EXISTS (\n       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN\n    RAISE EXCEPTION ''Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.'';\n  END IF;\n', 's');
--   END $$;
-- ════════════════════════════════════════════════════════════════════════════

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

SELECT pg_temp.trocar_uma_vez('public.prescrever(uuid, jsonb)'::regprocedure,
  $old$
  IF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;
$old$,
  $new$
  -- M1 a M3 (ataque e manutenção): o "Agora" não trava a manutenção nem é
  -- travado por ela; dois "Agora" só depois da dose feita; duas manutenções não
  IF v_tipo = 'medicamento' AND lower(btrim(coalesce(p_item ->> 'posologia', ''))) = 'agora' THEN
    IF EXISTS (SELECT 1 FROM public.prescricao_itens i
                WHERE i.prescricao_id = v_presc AND i.medicamento_id = m.id AND upper(i.via) = v_via AND i.suspenso_em IS NULL
                  AND lower(btrim(coalesce(i.posologia, ''))) = 'agora'
                  AND NOT EXISTS (SELECT 1 FROM public.administracoes a WHERE a.item_id = i.id AND a.situacao = 'feito')) THEN
      RAISE EXCEPTION 'Já há um "Agora" deste medicamento por esta via ainda sem a dose feita.';
    END IF;
  ELSIF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens i
        WHERE i.prescricao_id = v_presc AND i.medicamento_id = m.id AND upper(i.via) = v_via AND i.suspenso_em IS NULL
          AND lower(btrim(coalesce(i.posologia, ''))) <> 'agora') THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;
  -- fim M1 a M3
$new$);
