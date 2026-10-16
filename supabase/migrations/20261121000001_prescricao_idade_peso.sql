-- Portão 2, tarefa 2: prescrição de medicamento exige idade e peso (decisões do
-- RT em 16/10/2026, "1a 2a 3a 4a 5 sim 6 sim").
--
--  1a. Peso do adulto pode ser aferido, estimado ou referido pelo paciente; fica
--      marcado (observacao.metodo) e registrado nos sinais vitais.
--  2a. Idade = data de nascimento ou idade estimada em anos, gravada no cadastro
--      com a marca "estimada" (pacientes.data_nascimento_estimada).
--  3a. O peso vale a internação inteira, ou o atendimento de porta (não 24 h).
--  4a. Sem exceção de emergência: o peso estimado resolve.
--  5.  Só item de medicamento exige (cuidado e dieta não). Vale nos três caminhos
--      do banco (prescrever, registrar_prescricao_itens, alterar_item_prescricao)
--      e em inserção direta: a trava é um gatilho em prescricao_itens.
--  6.  A mensagem diz exatamente o que falta.
--
-- Antes só a criança (< 14 anos) ou o paciente sem data de nascimento precisava
-- de peso aferido, e a janela era o episódio aberto ou as últimas 24 h.

-- 1a. como o peso (e qualquer medida) foi obtido; nulo = aferido (registros antigos)
ALTER TABLE public.observacao ADD COLUMN IF NOT EXISTS metodo text
  CHECK (metodo IN ('aferido', 'estimado', 'referido'));
COMMENT ON COLUMN public.observacao.metodo IS
  'Como a medida foi obtida: aferido, estimado (pela equipe) ou referido (pelo paciente/acompanhante). Nulo = aferido.';

-- 2a. idade estimada
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS data_nascimento_estimada boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pacientes.data_nascimento_estimada IS
  'Data de nascimento calculada de uma idade estimada (registrar_idade_estimada). Volta a falso quando a data real é gravada.';

-- quem grava a data real tira a marca; só registrar_idade_estimada a liga
CREATE OR REPLACE FUNCTION private.trg_pacientes_nascimento_estimado()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF coalesce(current_setting('chefe.idade_estimada', true), '') <> '1' THEN
    IF NEW.data_nascimento IS DISTINCT FROM OLD.data_nascimento OR NEW.data_nascimento IS NULL THEN
      NEW.data_nascimento_estimada := false;
    ELSE
      NEW.data_nascimento_estimada := OLD.data_nascimento_estimada;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pacientes_nascimento_estimado ON public.pacientes;
CREATE TRIGGER trg_pacientes_nascimento_estimado
  BEFORE UPDATE OF data_nascimento, data_nascimento_estimada ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION private.trg_pacientes_nascimento_estimado();

-- 3a. início do atendimento atual: a internação ativa (desde a chegada à porta,
-- se veio de um episódio), senão o episódio aberto, senão as últimas 24 h
CREATE OR REPLACE FUNCTION private.inicio_do_atendimento(p_paciente uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT least(i.data_admissao, i.internado_em, e.chegada_em)
       FROM public.internacoes i LEFT JOIN public.episodios e ON e.id = i.episodio_id
      WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado')
      ORDER BY i.data_admissao DESC NULLS LAST LIMIT 1),
    (SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)),
    now() - interval '24 hours')
$$;

-- último peso (aferido, estimado ou referido) do atendimento atual
CREATE OR REPLACE FUNCTION private.peso_do_atendimento(p_paciente uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.valor_num FROM public.observacao o
    JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
   WHERE o.paciente_id = p_paciente AND o.aferido_em >= private.inicio_do_atendimento(p_paciente) AND o.valor_num > 0
   ORDER BY o.aferido_em DESC LIMIT 1
$$;

-- 6. o que falta para prescrever medicamento; nulo = nada
CREATE OR REPLACE FUNCTION private.falta_para_prescrever(p_paciente uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_falta text[] := '{}';
BEGIN
  IF (SELECT data_nascimento FROM public.pacientes WHERE id = p_paciente) IS NULL THEN
    v_falta := v_falta || 'data de nascimento ou idade estimada'::text;
  END IF;
  IF private.peso_do_atendimento(p_paciente) IS NULL THEN
    v_falta := v_falta || 'peso deste atendimento (aferido ou estimado)'::text;
  END IF;
  IF cardinality(v_falta) = 0 THEN RETURN NULL; END IF;
  RETURN 'Falta para prescrever: ' || array_to_string(v_falta, '; ') || '.';
END $$;

REVOKE ALL ON FUNCTION private.inicio_do_atendimento(uuid), private.peso_do_atendimento(uuid),
  private.falta_para_prescrever(uuid) FROM PUBLIC, anon, authenticated;

-- 5. trava em todo caminho que grava item de medicamento
CREATE OR REPLACE FUNCTION private.trg_prescricao_exige_idade_peso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_paciente uuid; v_falta text;
BEGIN
  SELECT paciente_id INTO v_paciente FROM public.prescricoes WHERE id = NEW.prescricao_id;
  v_falta := private.falta_para_prescrever(v_paciente);
  IF v_falta IS NOT NULL THEN RAISE EXCEPTION '%', v_falta; END IF;
  IF NEW.peso_kg IS NULL THEN NEW.peso_kg := private.peso_do_atendimento(v_paciente); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prescricao_exige_idade_peso ON public.prescricao_itens;
CREATE TRIGGER trg_prescricao_exige_idade_peso
  BEFORE INSERT ON public.prescricao_itens
  FOR EACH ROW WHEN (NEW.tipo = 'medicamento')
  EXECUTE FUNCTION private.trg_prescricao_exige_idade_peso();

-- prescrever: troca o bloco só-pediátrico pela regra geral (a mensagem sai antes
-- de diluição e interação). Trecho conferido no corpo atual; se não bater, para.
DO $$
DECLARE
  -- sem \r: o corpo gravado pode ter fim de linha do Windows
  def text := replace(pg_get_functiondef('public.prescrever(uuid, jsonb)'::regprocedure), E'\r', '');
  antigo text := $old$    -- pediatria: peso aferido no episódio
    -- criança (até 13a11m29d) ou idade desconhecida: peso aferido no episódio
    IF v_nasc IS NULL OR v_nasc > (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '14 years' THEN
      SELECT coalesce((SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)), now() - interval '24 hours') INTO v_desde;
      SELECT o.valor_num INTO v_peso FROM public.observacao o
        JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
       WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_desde AND o.valor_num > 0
       ORDER BY o.aferido_em DESC LIMIT 1;
      IF v_peso IS NULL THEN
        RAISE EXCEPTION '%', CASE WHEN v_nasc IS NULL
          THEN 'Idade desconhecida: registre o peso aferido neste atendimento (ou a data de nascimento) antes de prescrever medicamento.'
          ELSE 'Criança: registre o peso aferido neste atendimento antes de prescrever medicamento.' END;
      END IF;
    END IF;$old$;
  novo text := $new$    -- Portão 2, tarefa 2 (RT 16/10/2026): todo medicamento, em qualquer idade,
    -- exige data de nascimento (ou idade estimada) e peso deste atendimento
    -- (aferido, estimado ou referido). O gatilho em prescricao_itens repete a trava.
    IF private.falta_para_prescrever(p_paciente) IS NOT NULL THEN
      RAISE EXCEPTION '%', private.falta_para_prescrever(p_paciente);
    END IF;
    v_peso := private.peso_do_atendimento(p_paciente);$new$;
BEGIN
  -- o arquivo desta migração também pode chegar com \r (checkout no Windows):
  -- em 16/10/2026 a produção recusou por isso, com o corpo idêntico
  antigo := replace(antigo, E'\r', '');
  novo := replace(novo, E'\r', '');
  IF position(antigo IN def) = 0 THEN
    RAISE EXCEPTION 'prescrever mudou: o bloco de peso pediátrico não foi encontrado';
  END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- 2a. idade estimada em anos (ex.: 40; 0,5 = seis meses), gravada no cadastro
CREATE OR REPLACE FUNCTION public.registrar_idade_estimada(p_paciente uuid, p_anos numeric)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_nasc date; v_estimada boolean; v_nova date;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento, data_nascimento_estimada INTO v_unidade, v_nasc, v_estimada
    FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.eh_super_admin()
          OR private.paciente_em_cuidado_no_plantao(p_paciente)
          OR private.tenho_papel(v_unidade, 'recepcao')
          OR private.tenho_papel(v_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_anos IS NULL OR p_anos < 0 OR p_anos > 130 THEN
    RAISE EXCEPTION 'Informe a idade estimada em anos (de 0 a 130).';
  END IF;
  IF v_nasc IS NOT NULL AND NOT v_estimada THEN
    RAISE EXCEPTION 'O paciente já tem data de nascimento no cadastro.';
  END IF;
  v_nova := ((now() AT TIME ZONE 'America/Sao_Paulo')::date - make_interval(months => round(p_anos * 12)::int))::date;
  PERFORM set_config('chefe.idade_estimada', '1', true);
  UPDATE public.pacientes SET data_nascimento = v_nova, data_nascimento_estimada = true, updated_at = now()
   WHERE id = p_paciente;
  PERFORM set_config('chefe.idade_estimada', '', true);
  PERFORM private.registrar_auditoria('registrar_idade_estimada', 'pacientes', p_paciente, v_unidade,
    jsonb_build_object('anos', p_anos, 'data_nascimento', v_nova, 'anterior', v_nasc));
  RETURN v_nova;
END $$;
REVOKE ALL ON FUNCTION public.registrar_idade_estimada(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_idade_estimada(uuid, numeric) TO authenticated;

-- 1a. o registro de sinais vitais (online e fila sem conexão) grava o método
CREATE OR REPLACE FUNCTION private.inserir_observacao_sincronizada(
  p_id uuid, p_unidade uuid, p_autor uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text, d jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.observacao
    (id, unidade_id, internacao_id, paciente_id, conceito_id, aferido_em, registrado_por,
     valor_num, valor_texto, valor_conceito_id, unidade, origem, sem_conexao, aparelho_id, metodo)
  VALUES
    (p_id, p_unidade, nullif(d ->> 'internacao_id', '')::uuid, (d ->> 'paciente_id')::uuid, (d ->> 'conceito_id')::uuid,
     p_hora, p_autor, (d ->> 'valor_num')::numeric, d ->> 'valor_texto', nullif(d ->> 'valor_conceito_id', '')::uuid,
     d ->> 'unidade', coalesce(d ->> 'origem', 'manual'), p_sem_conexao, left(p_aparelho, 64),
     CASE WHEN d ->> 'metodo' IN ('aferido', 'estimado', 'referido') THEN d ->> 'metodo' END);
$$;
REVOKE ALL ON FUNCTION private.inserir_observacao_sincronizada(uuid, uuid, uuid, timestamptz, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
