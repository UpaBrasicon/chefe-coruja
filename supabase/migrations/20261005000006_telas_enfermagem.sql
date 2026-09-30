-- ════════════════════════════════════════════════════════════════════════════
-- Porte do protótipo — as telas da enfermagem (Pronto Socorro, Internação e a
-- passagem de plantão da enfermagem; P/index.html 1892–1926, 8168–8203).
--
-- Acesso: a escala é a porta (ADR 0003). Tudo aqui lê só os setores em que a
-- pessoa está escalada agora (setores_na_escala_agora); nenhuma política nova
-- abre paciente fora disso. O Pronto Socorro da enfermagem lê episodios pela
-- política que já existe e a observação por painel_observacao; aqui entram:
--
--  * APRAZAMENTO ATRASADO (private.aprazamentos_atrasados): horário aprazado
--    de item ativo, que não é "se necessário", cujo instante passou há mais de
--    2 horas (tolerância: organização do plantão e início do serviço) e há
--    menos de 12 horas, sem checagem daquele horário registrada a partir de
--    2 horas antes dele. O horário é de Brasília; um horário conta hoje e
--    ontem (a noite que virou o dia).
--  * enfermagem_leitos: a lista por leito dos setores da escala (fora os de
--    observação, que ficam no Pronto Socorro da enfermagem), com a contagem
--    de aprazamentos atrasados.
--  * enfermagem_pendencias: os aprazamentos atrasados, item a item, dos
--    pacientes dos setores da escala — as "pendências do turno".
--
-- PASSAGEM DE PLANTÃO DA ENFERMAGEM — modelo diferente da médica. A médica
-- (passagens_plantao) é por paciente, de um médico para outro nomeado, com
-- aceite ou recusa. A da enfermagem é um registro do SETOR, feito LEITO A
-- LEITO (decisão da unidade; o protótipo tinha um texto único da unidade):
--  * entregar: quem é da enfermagem e está escalado no setor agora escreve a
--    passagem de cada paciente do setor (todos, nenhum fica sem) e, se
--    quiser, uma observação geral (material em falta, intercorrências do
--    setor); o banco guarda junto, em cada leito, o retrato das pendências
--    do turno naquele instante (aprazamentos atrasados), que não muda depois;
--  * receber: outra pessoa da enfermagem escalada no setor dá ciência (uma
--    vez; quem entregou não recebe a própria);
--  * não se apaga (guarda de 20 anos) e só muda o campo do recebimento.
--
-- Balanço hídrico: não há tabela no banco ainda (é da frente dos cuidados de
-- enfermagem); quando houver, a pendência "balanço não fechado" entra em
-- enfermagem_leitos. Escrita só pelas RPCs, com segundo fator. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. aprazamentos atrasados ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.aprazamentos_atrasados(p_pacientes uuid[])
RETURNS TABLE (paciente_id uuid, item_id uuid, descricao text, horario text, previsto_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pr.paciente_id, it.id, it.descricao, h.h, s.slot
    FROM public.prescricoes pr
    JOIN public.prescricao_itens it ON it.prescricao_id = pr.id
    CROSS JOIN LATERAL unnest(coalesce(it.horarios, '{}'::text[])) h(h)
    CROSS JOIN LATERAL (
      SELECT ((d.d + h.h::time) AT TIME ZONE 'America/Sao_Paulo') AS slot
        FROM (VALUES ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
                     ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)) d(d)) s
   WHERE pr.paciente_id = ANY (p_pacientes)
     AND pr.status = 'ativa'
     AND it.suspenso_em IS NULL
     AND NOT it.se_necessario
     AND h.h ~ '^([01]\d|2[0-3]):[0-5]\d$'
     AND s.slot <= now() - interval '2 hours'
     AND s.slot > now() - interval '12 hours'
     AND s.slot > it.created_at
     AND NOT EXISTS (SELECT 1 FROM public.administracoes a
                      WHERE a.item_id = it.id AND a.horario_previsto = h.h
                        AND a.registrado_em >= s.slot - interval '2 hours')
$$;

-- ── 2. a lista por leito da enfermagem ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enfermagem_leitos(p_unidade uuid)
RETURNS TABLE (
  internacao_id uuid, paciente_id uuid, episodio_id uuid, nome text, data_nascimento date, sexo text,
  setor_id uuid, setor_nome text, leito text, status text, data_admissao timestamptz,
  cid_principal text, queixa text, aprazamentos_atrasados int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_setores uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_enfermagem(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: tela da enfermagem.'; END IF;
  SELECT array_agg(x) INTO v_setores FROM private.setores_na_escala_agora() x
   WHERE NOT private.setor_de_observacao(x)
     AND EXISTS (SELECT 1 FROM public.setores s WHERE s.id = x AND s.unidade_id = p_unidade);
  IF v_setores IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH ativos AS (
    SELECT i.* FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND i.setor_atual_id = ANY (v_setores)
  ), atr AS (
    SELECT a.paciente_id, count(*)::int AS n
      FROM private.aprazamentos_atrasados((SELECT array_agg(x.paciente_id) FROM ativos x)) a
     GROUP BY a.paciente_id
  )
  SELECT i.id, i.paciente_id, i.episodio_id, coalesce(pa.nome_social, pa.nome), pa.data_nascimento, pa.sexo,
         i.setor_atual_id, s.nome, l.identificador, i.status, i.data_admissao,
         i.cid_principal, ep.queixa, coalesce(atr.n, 0)
    FROM ativos i
    JOIN public.pacientes pa ON pa.id = i.paciente_id
    JOIN public.setores s ON s.id = i.setor_atual_id
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
    LEFT JOIN public.episodios ep ON ep.id = i.episodio_id
    LEFT JOIN atr ON atr.paciente_id = i.paciente_id
   ORDER BY s.nome, l.identificador NULLS LAST, pa.nome;
END $$;

-- ── 3. pendências do turno: os aprazamentos atrasados, item a item ──────────
-- Pacientes dos setores da escala (porta, observação e internação).
CREATE OR REPLACE FUNCTION public.enfermagem_pendencias(p_unidade uuid)
RETURNS TABLE (paciente_id uuid, nome text, setor_id uuid, local text, item_id uuid, descricao text,
               horario text, previsto_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_pacientes uuid[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_enfermagem(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: tela da enfermagem.'; END IF;
  SELECT array_agg(DISTINCT x) INTO v_pacientes FROM (
    SELECT i.paciente_id AS x FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
       AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
    UNION
    SELECT e.paciente_id FROM public.episodios e
     WHERE e.unidade_id = p_unidade AND e.etapa IN ('triagem', 'atendimento')
       AND e.setor_id IN (SELECT private.setores_na_escala_agora())
  ) q;
  IF v_pacientes IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.paciente_id, coalesce(pa.nome_social, pa.nome), coalesce(i.setor_atual_id, e.setor_id, pa.setor_id),
         coalesce(l.identificador, s.nome), a.item_id, a.descricao, a.horario, a.previsto_em
    FROM private.aprazamentos_atrasados(v_pacientes) a
    JOIN public.pacientes pa ON pa.id = a.paciente_id
    LEFT JOIN public.internacoes i ON i.paciente_id = a.paciente_id AND i.status IN ('admitido', 'em_observacao', 'internado')
    LEFT JOIN public.episodios e ON e.paciente_id = a.paciente_id AND e.etapa IN ('triagem', 'atendimento')
    LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
    LEFT JOIN public.setores s ON s.id = coalesce(i.setor_atual_id, e.setor_id, pa.setor_id)
   ORDER BY a.previsto_em, 2;
END $$;

-- ── 4. passagem de plantão da enfermagem (do setor, leito a leito) ─────────
-- Os pacientes do setor, na ordem dos leitos: internados nele (leito) ou, na
-- porta, com o episódio aberto nele. Quem tem as duas coisas conta uma vez,
-- pela internação.
CREATE OR REPLACE FUNCTION private.pacientes_do_setor_enfermagem(p_setor uuid)
RETURNS TABLE (paciente_id uuid, nome text, local text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT q.paciente_id, coalesce(pa.nome_social, pa.nome), q.local
    FROM (
      SELECT DISTINCT ON (x.paciente_id) x.paciente_id, x.local
        FROM (
          SELECT i.paciente_id, coalesce(l.identificador, s.nome) AS local, 0 AS pri
            FROM public.internacoes i
            JOIN public.setores s ON s.id = i.setor_atual_id
            LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
           WHERE i.setor_atual_id = p_setor AND i.status IN ('admitido', 'em_observacao', 'internado')
          UNION ALL
          SELECT e.paciente_id, s.nome, 1
            FROM public.episodios e
            JOIN public.setores s ON s.id = e.setor_id
           WHERE e.setor_id = p_setor AND e.etapa IN ('triagem', 'atendimento')
        ) x
       ORDER BY x.paciente_id, x.pri
    ) q
    JOIN public.pacientes pa ON pa.id = q.paciente_id
   ORDER BY q.local, 2;
$$;

CREATE TABLE IF NOT EXISTS public.passagens_enfermagem (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  setor_id     uuid NOT NULL REFERENCES public.setores(id),
  -- o plantão de quem entregou; turno e data ficam copiados na entrega, para
  -- a passagem (guarda de 20 anos) não depender da escala, que o gestor edita
  plantao_id   uuid REFERENCES public.escala_plantao(id) ON DELETE SET NULL,
  turno        text,
  data         date,
  -- observação geral do setor (opcional quando há leitos)
  texto        text NOT NULL DEFAULT '',
  -- leito a leito: [{paciente_id, nome, local, texto, pendencias: [...]}]
  leitos       jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(leitos) = 'array'),
  -- retrato das pendências do turno no instante da entrega (todas do setor)
  pendencias   jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pendencias) = 'array'),
  entregue_por uuid NOT NULL REFERENCES public.perfis(id),
  entregue_em  timestamptz NOT NULL DEFAULT now(),
  recebida_por uuid REFERENCES public.perfis(id),
  recebida_em  timestamptz,
  CONSTRAINT passagens_enfermagem_recebimento CHECK ((recebida_por IS NULL) = (recebida_em IS NULL)),
  CONSTRAINT passagens_enfermagem_outra_pessoa CHECK (recebida_por IS NULL OR recebida_por <> entregue_por)
);
-- reaplicação sobre a versão de texto único
ALTER TABLE public.passagens_enfermagem ADD COLUMN IF NOT EXISTS leitos jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(leitos) = 'array');
ALTER TABLE public.passagens_enfermagem ADD COLUMN IF NOT EXISTS turno text;
ALTER TABLE public.passagens_enfermagem ADD COLUMN IF NOT EXISTS data date;
-- apagar o plantão da escala não apaga nem trava a passagem
ALTER TABLE public.passagens_enfermagem DROP CONSTRAINT IF EXISTS passagens_enfermagem_plantao_id_fkey;
ALTER TABLE public.passagens_enfermagem ADD CONSTRAINT passagens_enfermagem_plantao_id_fkey
  FOREIGN KEY (plantao_id) REFERENCES public.escala_plantao(id) ON DELETE SET NULL;
ALTER TABLE public.passagens_enfermagem DROP CONSTRAINT IF EXISTS passagens_enfermagem_texto_check;
ALTER TABLE public.passagens_enfermagem ALTER COLUMN texto SET DEFAULT '';
ALTER TABLE public.passagens_enfermagem DROP CONSTRAINT IF EXISTS passagens_enfermagem_conteudo;
ALTER TABLE public.passagens_enfermagem ADD CONSTRAINT passagens_enfermagem_conteudo
  CHECK (jsonb_array_length(leitos) > 0 OR length(btrim(texto)) >= 10);
COMMENT ON TABLE public.passagens_enfermagem IS
  'Passagem de plantão da enfermagem: registro do setor, leito a leito (texto de cada paciente e retrato das pendências), com observação geral opcional e ciência de quem assume. Diferente da médica, que é por paciente e para um colega nomeado.';
CREATE INDEX IF NOT EXISTS passagens_enfermagem_setor ON public.passagens_enfermagem (setor_id, entregue_em DESC);

-- só o recebimento muda, e uma vez (e a referência ao plantão, quando ele sai
-- da escala: ON DELETE SET NULL; turno e data já estão na passagem)
CREATE OR REPLACE FUNCTION private.passagem_enfermagem_so_recebe() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.plantao_id IS NULL AND OLD.plantao_id IS NOT NULL
     AND (to_jsonb(NEW) - 'plantao_id') = (to_jsonb(OLD) - 'plantao_id') THEN
    RETURN NEW;
  END IF;
  IF OLD.recebida_em IS NOT NULL THEN RAISE EXCEPTION 'Esta passagem já foi recebida.'; END IF;
  IF (to_jsonb(NEW) - 'recebida_por' - 'recebida_em') IS DISTINCT FROM (to_jsonb(OLD) - 'recebida_por' - 'recebida_em') THEN
    RAISE EXCEPTION 'A passagem entregue não se altera: só se registra o recebimento.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_passagem_enfermagem_so_recebe ON public.passagens_enfermagem;
CREATE TRIGGER trg_passagem_enfermagem_so_recebe BEFORE UPDATE ON public.passagens_enfermagem
  FOR EACH ROW EXECUTE FUNCTION private.passagem_enfermagem_so_recebe();
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.passagens_enfermagem;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.passagens_enfermagem
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

ALTER TABLE public.passagens_enfermagem ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passagens_enfermagem FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.passagens_enfermagem FROM authenticated;
GRANT SELECT ON public.passagens_enfermagem TO authenticated;
DROP POLICY IF EXISTS passagens_enfermagem_select ON public.passagens_enfermagem;
CREATE POLICY passagens_enfermagem_select ON public.passagens_enfermagem FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor'
         OR (private.sou_enfermagem(unidade_id) AND setor_id IN (SELECT private.setores_na_escala_agora())));
DROP POLICY IF EXISTS passagens_enfermagem_segundo_fator ON public.passagens_enfermagem;
CREATE POLICY passagens_enfermagem_segundo_fator ON public.passagens_enfermagem AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());

-- os pacientes do setor para escrever a passagem, leito a leito
CREATE OR REPLACE FUNCTION public.enfermagem_pacientes_do_setor(p_setor uuid)
RETURNS TABLE (paciente_id uuid, nome text, local text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor;
  IF v_unidade IS NULL OR NOT private.sou_enfermagem(v_unidade) OR NOT private.tem_plantao_agora(p_setor) THEN
    RAISE EXCEPTION 'A passagem é da enfermagem escalada neste setor agora.';
  END IF;
  RETURN QUERY SELECT * FROM private.pacientes_do_setor_enfermagem(p_setor);
END $$;

-- p_leitos: [{paciente_id, texto}] — um por paciente do setor, todos.
DROP FUNCTION IF EXISTS public.entregar_passagem_enfermagem(uuid, text);
CREATE OR REPLACE FUNCTION public.entregar_passagem_enfermagem(p_setor uuid, p_leitos jsonb, p_texto text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  v_plantao public.escala_plantao;
  v_faltam text;
  v_leitos jsonb;
  v_pend jsonb;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT private.sou_enfermagem(v_unidade) OR NOT private.tem_plantao_agora(p_setor) THEN
    RAISE EXCEPTION 'A passagem é da enfermagem escalada neste setor agora.';
  END IF;
  IF p_leitos IS NULL OR jsonb_typeof(p_leitos) <> 'array' THEN
    RAISE EXCEPTION 'A passagem vai leito a leito.';
  END IF;
  SELECT p.* INTO v_plantao FROM private.plantoes_agora() p WHERE p.setor_id = p_setor ORDER BY p.inicio LIMIT 1;

  -- cada paciente do setor agora, com o seu texto e o retrato das suas
  -- pendências do turno; notas de quem já saiu do setor ficam fora
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'paciente_id', ps.paciente_id, 'nome', ps.nome, 'local', ps.local,
           'texto', (SELECT btrim(x ->> 'texto') FROM jsonb_array_elements(p_leitos) x
                      WHERE x ->> 'paciente_id' = ps.paciente_id::text LIMIT 1),
           'pendencias', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'descricao', a.descricao, 'horario', a.horario, 'previsto_em', a.previsto_em) ORDER BY a.previsto_em)
              FROM private.aprazamentos_atrasados(ARRAY[ps.paciente_id]) a), '[]'::jsonb)
         ) ORDER BY ps.ord), '[]'::jsonb)
    INTO v_leitos
    FROM private.pacientes_do_setor_enfermagem(p_setor) WITH ORDINALITY ps(paciente_id, nome, local, ord);

  SELECT string_agg(coalesce(x ->> 'local' || ' ', '') || (x ->> 'nome'), ', ' ORDER BY n) INTO v_faltam
    FROM jsonb_array_elements(v_leitos) WITH ORDINALITY e(x, n)
   WHERE length(coalesce(x ->> 'texto', '')) < 3;
  IF v_faltam IS NOT NULL THEN
    RAISE EXCEPTION 'Falta a passagem de: %.', v_faltam;
  END IF;
  IF jsonb_array_length(v_leitos) = 0 AND length(btrim(coalesce(p_texto, ''))) < 10 THEN
    RAISE EXCEPTION 'Setor sem pacientes: escreva a observação geral (mínimo 10 caracteres).';
  END IF;

  -- e todas as pendências juntas, no formato das pendências do turno
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'paciente_id', x ->> 'paciente_id', 'nome', x ->> 'nome', 'local', x ->> 'local',
           'descricao', p ->> 'descricao', 'horario', p ->> 'horario', 'previsto_em', p ->> 'previsto_em')
           ORDER BY p ->> 'previsto_em'), '[]'::jsonb)
    INTO v_pend
    FROM jsonb_array_elements(v_leitos) x
    CROSS JOIN LATERAL jsonb_array_elements(x -> 'pendencias') p;

  INSERT INTO public.passagens_enfermagem (unidade_id, setor_id, plantao_id, turno, data, texto, leitos, pendencias, entregue_por)
  VALUES (v_unidade, p_setor, v_plantao.id, v_plantao.turno, coalesce(v_plantao.data, private.data_atual()),
          btrim(coalesce(p_texto, '')), v_leitos, v_pend, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.receber_passagem_enfermagem(p_passagem uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pe public.passagens_enfermagem; v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pe FROM public.passagens_enfermagem WHERE id = p_passagem FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Passagem não encontrada.'; END IF;
  IF NOT private.sou_enfermagem(pe.unidade_id) OR NOT private.tem_plantao_agora(pe.setor_id) THEN
    RAISE EXCEPTION 'Recebe a passagem a enfermagem escalada neste setor agora.';
  END IF;
  IF pe.entregue_por = v_eu THEN RAISE EXCEPTION 'Quem entregou não recebe a própria passagem.'; END IF;
  IF pe.recebida_em IS NOT NULL THEN RAISE EXCEPTION 'Esta passagem já foi recebida.'; END IF;
  UPDATE public.passagens_enfermagem SET recebida_por = v_eu, recebida_em = now() WHERE id = pe.id;
END $$;

-- as passagens dos setores da escala (últimos 3 dias), com os nomes
DROP FUNCTION IF EXISTS public.passagens_enfermagem_do_plantao(uuid);
CREATE OR REPLACE FUNCTION public.passagens_enfermagem_do_plantao(p_unidade uuid)
RETURNS TABLE (id uuid, setor_id uuid, setor_nome text, texto text, leitos jsonb, pendencias jsonb,
               entregue_por uuid, entregue_por_nome text, entregue_em timestamptz, turno text, data date,
               recebida_por uuid, recebida_por_nome text, recebida_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_enfermagem(p_unidade) THEN RAISE EXCEPTION 'Acesso negado: tela da enfermagem.'; END IF;
  RETURN QUERY
  SELECT pe.id, pe.setor_id, s.nome, pe.texto, pe.leitos, pe.pendencias,
         pe.entregue_por, (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pe.entregue_por), pe.entregue_em,
         coalesce(pe.turno, ep.turno), coalesce(pe.data, ep.data),
         pe.recebida_por, (SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = pe.recebida_por), pe.recebida_em
    FROM public.passagens_enfermagem pe
    JOIN public.setores s ON s.id = pe.setor_id
    LEFT JOIN public.escala_plantao ep ON ep.id = pe.plantao_id
   WHERE pe.unidade_id = p_unidade
     AND pe.setor_id IN (SELECT private.setores_na_escala_agora())
     AND pe.entregue_em > now() - interval '3 days'
   ORDER BY pe.entregue_em DESC
   LIMIT 40;
END $$;

-- ── 5. permissões ───────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION private.aprazamentos_atrasados(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.passagem_enfermagem_so_recebe() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pacientes_do_setor_enfermagem(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enfermagem_leitos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enfermagem_pendencias(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enfermagem_pacientes_do_setor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entregar_passagem_enfermagem(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.receber_passagem_enfermagem(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.passagens_enfermagem_do_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enfermagem_leitos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enfermagem_pendencias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enfermagem_pacientes_do_setor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.entregar_passagem_enfermagem(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receber_passagem_enfermagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passagens_enfermagem_do_plantao(uuid) TO authenticated;
