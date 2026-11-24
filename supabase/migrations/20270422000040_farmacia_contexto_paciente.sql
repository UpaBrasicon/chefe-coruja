-- ════════════════════════════════════════════════════════════════════════════
-- Revisão do perfil Farmacêutico (24/11/2026), VA1 e DI3.
--
-- VA1 — decisão do RT (24/11/2026): "idade e alergias podem ir para a farmácia
-- para que o farmacêutico dispense com segurança". Hoje fila_validacao não traz
-- idade nem alergias e a RLS de pacientes e alergias_paciente não abre ao
-- farmacêutico. Nada disso muda: a leitura é uma função nova, só de leitura,
-- ligada à finalidade.
--
-- • public.contexto_paciente_farmacia(paciente, unidade): idade (texto como o
--   app mostra, e anos/meses/dias), público (adulto, pediátrico ou
--   desconhecido; pediatria até 13 anos, 11 meses e 29 dias, o mesmo corte de
--   private.pediatrico_em), alergias ativas (substância, tipo, reação,
--   gravidade) com o estado em quatro valores de public.estado_alergia (tem,
--   nega, desconhece, nao_registrada) e o peso de referência que já vai na
--   prescrição (prescricao_itens.peso_kg, o mesmo de fila_validacao). Sem nome,
--   CPF, CNS ou data de nascimento: a tela já tem o nome pela fila.
--   Acesso: super admin, ou farmacêutico da unidade quando o paciente tem ao
--   menos um item de medicamento ativo numa prescrição ativa da unidade (o que
--   está na validação ou na dispensação). Fora disso, "Acesso negado".
--   Cada leitura grava uma linha em public.log_acesso_prontuario (tipo
--   leitura_prontuario, documento_tipo "Validação da farmácia", motivo
--   validacao_farmacia), como as outras leituras de dado do paciente; aparece
--   em "Acessos ao prontuário" da Auditoria.
--
-- DI3 — decisão do RT (24/11/2026): na falta de um medicamento, quem fica sem,
-- com o leito e o próximo horário aprazado.
-- • public.pacientes_das_faltas(unidade): para cada item ativo de medicamento
--   com falta aberta (registrada ou em cotação) na unidade: item, paciente,
--   leito atual (identificador; sem leito, nulo), setor, local (leito ou
--   setor), se necessário, aprazado, próximo horário (o primeiro horário do
--   aprazamento da enfermagem a partir de agora, ainda sem checagem; nulo sem
--   aprazamento) e se o item está vencido. Ordem: o horário mais próximo
--   primeiro. Sem nome do paciente: a tela junta pelo item com a leitura da
--   Dispensação (itens_para_dispensar), que já traz o nome.
--   Acesso igual ao de itens_para_dispensar: super admin ou farmacêutico da
--   unidade (todos os itens); enfermeiro ou técnico só dos pacientes em que
--   pode atuar. itens_para_dispensar não muda.
--
-- Expand: duas funções novas, nenhuma tabela, nenhuma coluna, nenhuma
-- política. Idempotente (CREATE OR REPLACE).
-- Volta: supabase/snippets/farmacia_contexto_paciente_rollback.sql
-- Teste: supabase/tests/farmacia_contexto_paciente.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── VA1: idade e alergias para a validação da farmácia ──────────────────────
CREATE OR REPLACE FUNCTION public.contexto_paciente_farmacia(p_paciente uuid, p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_super boolean := private.eh_super_admin() IS TRUE;
  v_farm boolean := private.tenho_papel(p_unidade, 'farmaceutico') IS TRUE;
  v_nasc date;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_idade interval;
  v_anos int;
  v_meses int;
  v_dias int;
  v_total_dias int;
  v_texto text;
  v_publico text;
  v_peso numeric;
  v_peso_em timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR p_paciente IS NULL OR p_unidade IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- menor privilégio: o farmacêutico só lê o paciente que tem item a validar
  -- ou a dispensar na unidade dele
  IF NOT (v_super OR (v_farm AND EXISTS (
      SELECT 1 FROM public.prescricoes pr
        JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
       WHERE pr.paciente_id = p_paciente AND pr.unidade_id = p_unidade AND pr.status = 'ativa'
         AND it.tipo = 'medicamento' AND it.suspenso_em IS NULL))) THEN
    RAISE EXCEPTION 'Acesso negado: idade e alergias só para o farmacêutico da unidade, de paciente com item de prescrição ativo.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT pa.data_nascimento INTO v_nasc FROM public.pacientes pa WHERE pa.id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  -- idade no dia de Brasília; sem nascimento (ou no futuro), desconhecida —
  -- nunca tratada como adulto
  IF v_nasc IS NULL OR v_nasc > v_hoje THEN
    v_publico := 'desconhecida';
  ELSE
    v_idade := age(v_hoje, v_nasc);
    v_anos := extract(year FROM v_idade)::int;
    v_meses := extract(month FROM v_idade)::int;
    v_dias := extract(day FROM v_idade)::int;
    v_total_dias := v_hoje - v_nasc;
    v_publico := CASE WHEN private.pediatrico_em(v_nasc, v_hoje) THEN 'pediatrico' ELSE 'adulto' END;
    -- o mesmo texto de idadeLegivel (src/lib/cadastroPaciente.ts)
    v_texto := CASE
      WHEN v_anos >= 2 THEN v_anos || ' anos'
      WHEN v_anos * 12 + v_meses >= 1 THEN
        CASE WHEN v_anos * 12 + v_meses = 1 THEN '1 mês' ELSE (v_anos * 12 + v_meses) || ' meses' END
      ELSE CASE WHEN v_total_dias = 1 THEN '1 dia' ELSE v_total_dias || ' dias' END
    END;
  END IF;

  -- peso de referência: o que já vai na prescrição (o mesmo de fila_validacao)
  SELECT it.peso_kg, it.created_at INTO v_peso, v_peso_em
    FROM public.prescricoes pr
    JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
   WHERE pr.paciente_id = p_paciente AND pr.unidade_id = p_unidade AND pr.status = 'ativa'
     AND it.suspenso_em IS NULL AND it.peso_kg IS NOT NULL
   ORDER BY it.created_at DESC LIMIT 1;

  -- LG9 / registro de acesso: cada leitura fica na auditoria do prontuário
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, documento_tipo, motivo, ip, user_agent)
  SELECT u.organizacao_id, u.id, p_paciente, v_perfil,
         CASE WHEN v_farm THEN 'farmaceutico' ELSE coalesce(nullif(private.papel_na_unidade(u.id), ''), 'super_admin') END,
         'leitura_prontuario', 'Validação da farmácia',
         'validacao_farmacia: idade e alergias para validar e dispensar (RT 24/11/2026)',
         private.requisicao_ip(), private.requisicao_navegador()
    FROM public.unidades u WHERE u.id = p_unidade;

  RETURN jsonb_build_object(
    'idade', CASE WHEN v_texto IS NULL THEN NULL ELSE jsonb_build_object(
               'texto', v_texto, 'anos', v_anos, 'meses', v_meses, 'dias', v_dias, 'total_dias', v_total_dias) END,
    'publico', v_publico,
    'alergias', jsonb_build_object(
      'estado', public.estado_alergia(p_paciente),
      'ativas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'substancia', a.substancia, 'tipo', a.tipo, 'reacao', a.reacao, 'gravidade', a.gravidade,
                 'registrado_em', a.registrado_em)
                 ORDER BY (a.gravidade = 'grave') DESC, a.registrado_em DESC)
          FROM public.alergias_paciente a
         WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL), '[]'::jsonb)),
    'peso_kg', v_peso,
    'peso_em', v_peso_em);
END $$;
REVOKE ALL ON FUNCTION public.contexto_paciente_farmacia(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contexto_paciente_farmacia(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.contexto_paciente_farmacia(uuid, uuid) IS
  'VA1 (RT 24/11/2026): idade, público e alergias do paciente para o farmacêutico validar e dispensar. Só do paciente com item de medicamento ativo na unidade; cada leitura grava em log_acesso_prontuario (motivo validacao_farmacia).';

-- ── DI3: quem fica sem o medicamento em falta, com leito e próximo horário ──
CREATE OR REPLACE FUNCTION public.pacientes_das_faltas(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_farm boolean;
BEGIN
  PERFORM private.exigir_segundo_fator();
  -- o mesmo acesso de itens_para_dispensar
  v_farm := private.eh_super_admin() IS TRUE OR private.farmaceutico_da(p_unidade);
  IF NOT (v_farm OR private.tenho_papel(p_unidade, 'enfermeiro') OR private.tenho_papel(p_unidade, 'tecnico_enfermagem')) THEN
    RAISE EXCEPTION 'Acesso negado: dispensação é da farmácia (ou da enfermagem com a farmácia fechada).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x ->> 'proximo_em') IS NULL, x ->> 'proximo_em', x ->> 'local') FROM (
      SELECT jsonb_build_object(
               'item_id', it.id, 'paciente_id', pr.paciente_id, 'medicamento_id', it.medicamento_id,
               'leito', lt.identificador,
               'setor', (SELECT s.nome FROM public.setores s WHERE s.id = private.prescricao_setor(pr)),
               'local', coalesce(lt.identificador, (SELECT s.nome FROM public.setores s WHERE s.id = private.prescricao_setor(pr))),
               'se_necessario', it.se_necessario,
               'aprazado', cardinality(coalesce(it.horarios, '{}'::text[])) > 0,
               'proximo_em', (SELECT min(d.previsto_em) FROM private.doses_do_item(it.id) d
                               WHERE d.previsto_em >= now() AND d.situacao NOT IN ('feito', 'nao_feito', 'recusado')),
               'vencido', private.validade_item(it.valida_ate) = 'vencido') AS x
        FROM public.prescricao_itens it
        JOIN public.prescricoes pr ON pr.id = it.prescricao_id AND pr.status = 'ativa' AND pr.unidade_id = p_unidade
        LEFT JOIN LATERAL (
          SELECT l.identificador FROM public.internacoes i JOIN public.leitos l ON l.id = i.leito_atual_id
           WHERE i.paciente_id = pr.paciente_id AND i.data_alta IS NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
           ORDER BY i.data_admissao DESC LIMIT 1) lt ON true
       WHERE it.tipo = 'medicamento' AND it.suspenso_em IS NULL
         AND EXISTS (SELECT 1 FROM public.faltas_medicamento f
                      WHERE f.unidade_id = p_unidade AND f.medicamento_id = it.medicamento_id AND f.situacao <> 'reposta')
         AND (v_farm OR private.pode_atuar_no_paciente(pr.paciente_id))
       LIMIT 300) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.pacientes_das_faltas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pacientes_das_faltas(uuid) TO authenticated;
COMMENT ON FUNCTION public.pacientes_das_faltas(uuid) IS
  'DI3 (RT 24/11/2026): itens ativos de medicamento com falta aberta na unidade, com leito, setor e o próximo horário aprazado (o mais próximo primeiro). Sem nome do paciente; mesmo acesso de itens_para_dispensar.';
