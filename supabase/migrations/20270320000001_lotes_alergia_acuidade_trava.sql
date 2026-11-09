-- ════════════════════════════════════════════════════════════════════════════
-- Item 08 do kit de desempenho (docs/desempenho/AUDITORIA.md, seção 3.1):
-- consultas N+1. Três telas pediam uma chamada por paciente ou por remédio:
--   • painel de observação: alergias_do_paciente + acuidade por cartão;
--   • checagem da enfermagem: alergias_do_paciente por paciente;
--   • receita: alergia_trava_medicamento por remédio da receita e dos favoritos.
--
-- Três funções novas leem o lote numa chamada só. Cada uma chama a função de
-- um paciente que já existe: as regras de acesso, o segundo fator e o
-- conteúdo da resposta são os mesmos, por construção. Diferença única: o
-- paciente que daria erro (sem acesso, não encontrado) volta como
-- {"erro": "<mensagem>"} no lugar dele, sem derrubar os outros da lista.
-- O segundo fator vencido continua derrubando a chamada inteira, como antes,
-- para a tela pedir o código de novo.
--
-- Só cria funções (expand). Nenhuma tabela, coluna ou função antiga muda.
-- Limite de 200 itens por chamada.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.alergias_dos_pacientes(uuid[]);
--   DROP FUNCTION IF EXISTS public.acuidade_dos_pacientes(uuid[]);
--   DROP FUNCTION IF EXISTS public.alergia_trava_medicamentos(uuid, uuid[]);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.alergias_dos_pacientes(p_pacientes uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  r jsonb := '{}'::jsonb;
BEGIN
  -- segundo fator vencido derruba a chamada inteira (a tela pede o código)
  PERFORM private.exigir_segundo_fator();
  v_ids := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_pacientes) x WHERE x IS NOT NULL), '{}'::uuid[]);
  IF cardinality(v_ids) > 200 THEN RAISE EXCEPTION 'No máximo 200 pacientes por leitura.'; END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    BEGIN
      r := r || jsonb_build_object(v_id::text, jsonb_build_object('dados', public.alergias_do_paciente(v_id)));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_object(v_id::text, jsonb_build_object('erro', SQLERRM));
    END;
  END LOOP;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.alergias_dos_pacientes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alergias_dos_pacientes(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.acuidade_dos_pacientes(p_pacientes uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  r jsonb := '{}'::jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  v_ids := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_pacientes) x WHERE x IS NOT NULL), '{}'::uuid[]);
  IF cardinality(v_ids) > 200 THEN RAISE EXCEPTION 'No máximo 200 pacientes por leitura.'; END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    BEGIN
      r := r || jsonb_build_object(v_id::text, jsonb_build_object('dados', public.acuidade(v_id)));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_object(v_id::text, jsonb_build_object('erro', SQLERRM));
    END;
  END LOOP;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.acuidade_dos_pacientes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acuidade_dos_pacientes(uuid[]) TO authenticated;

-- Mesma regra de alergia_trava_medicamento: quem não pode atuar no paciente
-- recebe nada (o remédio fica fora do resultado, como o NULL de antes).
CREATE OR REPLACE FUNCTION public.alergia_trava_medicamentos(p_paciente uuid, p_medicamentos uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  r jsonb := '{}'::jsonb;
BEGIN
  v_ids := coalesce((SELECT array_agg(DISTINCT x) FROM unnest(p_medicamentos) x WHERE x IS NOT NULL), '{}'::uuid[]);
  IF cardinality(v_ids) > 200 THEN RAISE EXCEPTION 'No máximo 200 medicamentos por leitura.'; END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    r := r || jsonb_build_object(v_id::text, public.alergia_trava_medicamento(p_paciente, v_id));
  END LOOP;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.alergia_trava_medicamentos(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alergia_trava_medicamentos(uuid, uuid[]) TO authenticated;
