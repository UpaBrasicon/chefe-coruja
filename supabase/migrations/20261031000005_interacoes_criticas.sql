-- Fase 2, tarefa 3 do BACKLOG.md — interações medicamentosas críticas (opção A).
--
-- Decisão do RT (09/10/2026): opção C da pesquisa
-- (produto/docs/pesquisa/interacoes-medicamentosas-fontes.md). Começa pela A,
-- uma lista curada de pares críticos de autoria do RT ou do farmacêutico, a
-- partir da lista ONC e das bulas ANVISA. A B (base comercial licenciada) é
-- plano futuro: a tabela já tem fonte por linha para receber outra origem.
--   • a lista é da UNIDADE: grupos de fármacos (por princípio ativo) e pares
--     de grupos, com gravidade, efeito, conduta e fonte;
--   • os 15 pares da lista ONC de alta prioridade (Phansalkar S. et al.
--     J Am Med Inform Assoc 2012;19(5):735-43, doi:10.1136/amiajnl-2011-000612)
--     entram como PROPOSTA, resumidos com as nossas palavras e sem copiar o
--     artigo. Não alertam até o farmacêutico conferir, preencher os grupos de
--     classe e ativar. Só os grupos de um único fármaco já vêm com ele;
--   • o par "prolongam o QT" não usa a CredibleMeds (licença paga): a lista
--     sai das bulas e é montada pela farmácia;
--   • na prescrição, interação ativa com item vigente trava o item até o
--     médico justificar; a justificativa fica no item e na auditoria.
-- Só aditiva, salvo prescrever() e alterar_item_prescricao(): corpo trocado,
-- mesma assinatura.
--
-- ROLLBACK: reaplicar public.prescrever de 20261022000006 e
--   public.alterar_item_prescricao de 20261031000004; DROP das funções novas;
--   DROP TABLE public.alertas_interacao, public.interacoes_criticas,
--   public.grupos_interacao_membros, public.grupos_interacao, private.modelos_interacao.

-- ── modelo ONC (proposta, copiada para cada unidade quando a farmácia abre a tela) ──
CREATE TABLE IF NOT EXISTS private.modelos_interacao (
  codigo    text PRIMARY KEY,
  grupo_a   text NOT NULL,
  grupo_b   text NOT NULL,
  efeito    text NOT NULL,
  ordem     int NOT NULL
);
REVOKE ALL ON private.modelos_interacao FROM PUBLIC, anon, authenticated;
INSERT INTO private.modelos_interacao (codigo, grupo_a, grupo_b, efeito, ordem) VALUES
  ('onc-01', 'Anfetaminas e derivados', 'Inibidores da MAO', 'Risco de crise hipertensiva.', 1),
  ('onc-02', 'Atazanavir', 'Inibidores da bomba de prótons', 'Queda da absorção e do nível do atazanavir.', 2),
  ('onc-03', 'Febuxostate', 'Azatioprina e mercaptopurina', 'Acúmulo da tiopurina e risco de mielotoxicidade.', 3),
  ('onc-04', 'Inibidores seletivos da recaptação de serotonina', 'Inibidores da MAO', 'Risco de síndrome serotoninérgica.', 4),
  ('onc-05', 'Irinotecano', 'Inibidores fortes do CYP3A4', 'Aumento da exposição e da toxicidade do irinotecano.', 5),
  ('onc-06', 'Analgésicos opioides (os da lista ONC)', 'Inibidores da MAO', 'Risco de síndrome serotoninérgica ou de toxicidade do opioide.', 6),
  ('onc-07', 'Antidepressivos tricíclicos', 'Inibidores da MAO', 'Risco de síndrome serotoninérgica e de crise hipertensiva.', 7),
  ('onc-08', 'Prolongam o intervalo QT', 'Prolongam o intervalo QT', 'Soma de prolongamento do QT e risco de torsades de pointes.', 8),
  ('onc-09', 'Ramelteona', 'Inibidores do CYP1A2', 'Aumento importante do nível da ramelteona.', 9),
  ('onc-10', 'Indutores fortes do CYP3A4', 'Inibidores de protease', 'Queda do nível do inibidor de protease e falha terapêutica.', 10),
  ('onc-11', 'Estatinas metabolizadas pelo CYP3A4', 'Inibidores do CYP3A4 (inclui inibidores de protease)', 'Risco de miopatia e rabdomiólise.', 11),
  ('onc-12', 'Inibidores do CYP3A4 (inclui inibidores de protease)', 'Alcaloides do ergot', 'Risco de ergotismo e isquemia.', 12),
  ('onc-13', 'Tizanidina', 'Inibidores do CYP1A2', 'Aumento do nível da tizanidina: hipotensão e sedação.', 13),
  ('onc-14', 'Tranilcipromina', 'Procarbazina', 'Risco de crise hipertensiva.', 14),
  ('onc-15', 'Triptanos', 'Inibidores da MAO', 'Risco de síndrome serotoninérgica.', 15)
ON CONFLICT (codigo) DO NOTHING;

-- grupos de um fármaco só: o membro é o próprio nome
CREATE TABLE IF NOT EXISTS private.modelos_grupo_membro (
  grupo     text NOT NULL,
  principio text NOT NULL,
  PRIMARY KEY (grupo, principio)
);
REVOKE ALL ON private.modelos_grupo_membro FROM PUBLIC, anon, authenticated;
INSERT INTO private.modelos_grupo_membro (grupo, principio) VALUES
  ('Atazanavir', 'atazanavir'), ('Febuxostate', 'febuxostate'), ('Irinotecano', 'irinotecano'),
  ('Ramelteona', 'ramelteona'), ('Tizanidina', 'tizanidina'), ('Tranilcipromina', 'tranilcipromina'),
  ('Procarbazina', 'procarbazina')
ON CONFLICT DO NOTHING;

-- ── lista da unidade ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grupos_interacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id),
  nome        text NOT NULL CHECK (length(btrim(nome)) >= 3),
  criado_por  uuid REFERENCES public.perfis(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, nome)
);
CREATE TABLE IF NOT EXISTS public.grupos_interacao_membros (
  grupo_id     uuid NOT NULL REFERENCES public.grupos_interacao(id),
  principio    text NOT NULL CHECK (length(btrim(principio)) >= 3),   -- princípio ativo normalizado (nome_comparavel)
  incluido_por uuid REFERENCES public.perfis(id),
  incluido_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, principio)
);
CREATE TABLE IF NOT EXISTS public.interacoes_criticas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  grupo_a       uuid NOT NULL REFERENCES public.grupos_interacao(id),
  grupo_b       uuid NOT NULL REFERENCES public.grupos_interacao(id),
  gravidade     text NOT NULL DEFAULT 'contraindicada' CHECK (gravidade IN ('contraindicada', 'grave')),
  efeito        text NOT NULL CHECK (length(btrim(efeito)) >= 5),
  conduta       text,
  fonte         text NOT NULL CHECK (length(btrim(fonte)) >= 5),
  situacao      text NOT NULL DEFAULT 'proposta' CHECK (situacao IN ('proposta', 'ativa', 'inativa')),
  modelo        text,
  atualizado_por uuid REFERENCES public.perfis(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  motivo        text,
  UNIQUE (unidade_id, modelo)
);
CREATE TABLE IF NOT EXISTS public.alertas_interacao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  item_id        uuid NOT NULL REFERENCES public.prescricao_itens(id),
  interacao_id   uuid NOT NULL REFERENCES public.interacoes_criticas(id),
  outro_item_id  uuid NOT NULL REFERENCES public.prescricao_itens(id),
  justificativa  text NOT NULL,
  por            uuid NOT NULL REFERENCES public.perfis(id),
  em             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alertas_interacao_item ON public.alertas_interacao (item_id);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['grupos_interacao', 'grupos_interacao_membros', 'interacoes_criticas', 'alertas_interacao'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS grupos_interacao_select ON public.grupos_interacao;
CREATE POLICY grupos_interacao_select ON public.grupos_interacao FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS grupos_interacao_membros_select ON public.grupos_interacao_membros;
CREATE POLICY grupos_interacao_membros_select ON public.grupos_interacao_membros FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grupos_interacao g WHERE g.id = grupo_id AND private.membro_da_unidade(g.unidade_id)));
DROP POLICY IF EXISTS interacoes_criticas_select ON public.interacoes_criticas;
CREATE POLICY interacoes_criticas_select ON public.interacoes_criticas FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS alertas_interacao_select ON public.alertas_interacao;
CREATE POLICY alertas_interacao_select ON public.alertas_interacao FOR SELECT TO authenticated USING (private.membro_da_unidade(unidade_id));
CREATE OR REPLACE FUNCTION private.alerta_interacao_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Justificativa de interação é só de inserção.'; END $$;
DROP TRIGGER IF EXISTS alertas_interacao_so_insercao ON public.alertas_interacao;
CREATE TRIGGER alertas_interacao_so_insercao BEFORE UPDATE OR DELETE ON public.alertas_interacao
  FOR EACH ROW EXECUTE FUNCTION private.alerta_interacao_so_insercao();

-- quem cuida da lista: farmacêutico ou gestor da unidade
CREATE OR REPLACE FUNCTION private.cuida_da_lista_interacoes(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.gestor_da_unidade(p_unidade) OR coalesce(private.tenho_papel(p_unidade, 'farmaceutico'), false);
$$;
REVOKE ALL ON FUNCTION private.cuida_da_lista_interacoes(uuid) FROM PUBLIC, anon;

-- copia o modelo ONC para a unidade (uma vez; o que a farmácia mudou fica)
CREATE OR REPLACE FUNCTION private.semear_interacoes(p_unidade uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m private.modelos_interacao; ga uuid; gb uuid;
BEGIN
  FOR m IN SELECT * FROM private.modelos_interacao ORDER BY ordem LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.interacoes_criticas WHERE unidade_id = p_unidade AND modelo = m.codigo);
    INSERT INTO public.grupos_interacao (unidade_id, nome) VALUES (p_unidade, m.grupo_a) ON CONFLICT (unidade_id, nome) DO NOTHING;
    INSERT INTO public.grupos_interacao (unidade_id, nome) VALUES (p_unidade, m.grupo_b) ON CONFLICT (unidade_id, nome) DO NOTHING;
    SELECT id INTO ga FROM public.grupos_interacao WHERE unidade_id = p_unidade AND nome = m.grupo_a;
    SELECT id INTO gb FROM public.grupos_interacao WHERE unidade_id = p_unidade AND nome = m.grupo_b;
    INSERT INTO public.interacoes_criticas (unidade_id, grupo_a, grupo_b, gravidade, efeito, fonte, situacao, modelo)
    VALUES (p_unidade, ga, gb, 'contraindicada', m.efeito,
            'Lista ONC de alta prioridade — Phansalkar S. et al. J Am Med Inform Assoc 2012;19(5):735-43 (resumo nosso; conferir na bula ANVISA)',
            'proposta', m.codigo);
  END LOOP;
  INSERT INTO public.grupos_interacao_membros (grupo_id, principio)
  SELECT g.id, mm.principio FROM private.modelos_grupo_membro mm
    JOIN public.grupos_interacao g ON g.unidade_id = p_unidade AND g.nome = mm.grupo
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION private.semear_interacoes(uuid) FROM PUBLIC, anon;

-- grupos em que um medicamento do cadastro entra (palavra inteira do princípio ativo)
CREATE OR REPLACE FUNCTION private.grupos_do_medicamento(p_unidade uuid, p_medicamento uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT mb.grupo_id
    FROM public.medicamento m
    JOIN public.grupos_interacao_membros mb ON m.principio_ativo_norm ~ ('\m' || mb.principio || '\M')
    JOIN public.grupos_interacao g ON g.id = mb.grupo_id AND g.unidade_id = p_unidade
   WHERE m.id = p_medicamento;
$$;
REVOKE ALL ON FUNCTION private.grupos_do_medicamento(uuid, uuid) FROM PUBLIC, anon;

-- interações ATIVAS entre um medicamento novo e os itens vigentes da prescrição
CREATE OR REPLACE FUNCTION private.interacoes_com_prescricao(p_presc uuid, p_medicamento uuid, p_unidade uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
           'interacao_id', ic.id, 'outro_item_id', it.id, 'outro', it.descricao,
           'gravidade', ic.gravidade, 'efeito', ic.efeito, 'conduta', ic.conduta, 'fonte', ic.fonte,
           'grupos', ga.nome || ' × ' || gb.nome)), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.interacoes_criticas ic ON ic.unidade_id = p_unidade AND ic.situacao = 'ativa'
    JOIN public.grupos_interacao ga ON ga.id = ic.grupo_a
    JOIN public.grupos_interacao gb ON gb.id = ic.grupo_b
   WHERE it.prescricao_id = p_presc AND it.suspenso_em IS NULL AND it.tipo = 'medicamento'
     AND it.medicamento_id IS NOT NULL AND it.medicamento_id <> p_medicamento
     AND ((ic.grupo_a IN (SELECT private.grupos_do_medicamento(p_unidade, p_medicamento))
           AND ic.grupo_b IN (SELECT private.grupos_do_medicamento(p_unidade, it.medicamento_id)))
       OR (ic.grupo_b IN (SELECT private.grupos_do_medicamento(p_unidade, p_medicamento))
           AND ic.grupo_a IN (SELECT private.grupos_do_medicamento(p_unidade, it.medicamento_id))));
$$;
REVOKE ALL ON FUNCTION private.interacoes_com_prescricao(uuid, uuid, uuid) FROM PUBLIC, anon;

-- ── tela da farmácia ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lista_interacoes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF private.cuida_da_lista_interacoes(p_unidade) THEN PERFORM private.semear_interacoes(p_unidade); END IF;
  RETURN jsonb_build_object(
    'pode_editar', private.cuida_da_lista_interacoes(p_unidade),
    'grupos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome,
                 'membros', coalesce((SELECT jsonb_agg(mb.principio ORDER BY mb.principio) FROM public.grupos_interacao_membros mb WHERE mb.grupo_id = g.id), '[]'::jsonb),
                 'no_cadastro', (SELECT count(*) FROM public.medicamento m WHERE m.ativo
                                   AND EXISTS (SELECT 1 FROM public.grupos_interacao_membros mb WHERE mb.grupo_id = g.id
                                                 AND m.principio_ativo_norm ~ ('\m' || mb.principio || '\M'))))
                 ORDER BY g.nome) FROM public.grupos_interacao g WHERE g.unidade_id = p_unidade), '[]'::jsonb),
    'pares', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ic.id, 'grupo_a', ga.nome, 'grupo_b', gb.nome,
                 'grupo_a_id', ga.id, 'grupo_b_id', gb.id, 'gravidade', ic.gravidade, 'efeito', ic.efeito, 'conduta', ic.conduta,
                 'fonte', ic.fonte, 'situacao', ic.situacao, 'motivo', ic.motivo, 'atualizado_em', ic.atualizado_em,
                 'atualizado_por', p.nome_completo, 'modelo', ic.modelo)
                 ORDER BY CASE ic.situacao WHEN 'ativa' THEN 0 WHEN 'proposta' THEN 1 ELSE 2 END, ga.nome)
               FROM public.interacoes_criticas ic
               JOIN public.grupos_interacao ga ON ga.id = ic.grupo_a
               JOIN public.grupos_interacao gb ON gb.id = ic.grupo_b
               LEFT JOIN public.perfis p ON p.id = ic.atualizado_por
              WHERE ic.unidade_id = p_unidade), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.lista_interacoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lista_interacoes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_grupo_interacao(p_unidade uuid, p_nome text, p_principios text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_p text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.cuida_da_lista_interacoes(p_unidade) THEN
    RAISE EXCEPTION 'Só o farmacêutico ou o gestor da unidade cuida da lista de interações.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_nome, ''))) < 3 THEN RAISE EXCEPTION 'Dê um nome ao grupo.'; END IF;
  INSERT INTO public.grupos_interacao (unidade_id, nome, criado_por) VALUES (p_unidade, btrim(p_nome), private.meu_perfil_id())
  ON CONFLICT (unidade_id, nome) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_id;
  -- a lista de membros passa a ser a enviada
  DELETE FROM public.grupos_interacao_membros WHERE grupo_id = v_id
     AND principio <> ALL (SELECT private.nome_comparavel(x) FROM unnest(coalesce(p_principios, '{}')) x);
  FOREACH v_p IN ARRAY coalesce(p_principios, '{}') LOOP
    CONTINUE WHEN length(btrim(coalesce(v_p, ''))) < 3;
    INSERT INTO public.grupos_interacao_membros (grupo_id, principio, incluido_por)
    VALUES (v_id, private.nome_comparavel(v_p), private.meu_perfil_id()) ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_grupo_interacao', 'grupos_interacao', v_id, p_unidade,
    jsonb_build_object('nome', btrim(p_nome), 'principios', p_principios));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_grupo_interacao(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_grupo_interacao(uuid, text, text[]) TO authenticated;

-- novo par (p_id nulo) ou alteração de um par: situação, gravidade, efeito, conduta e fonte, sempre com motivo
CREATE OR REPLACE FUNCTION public.salvar_interacao(p_unidade uuid, p_id uuid, p_grupo_a uuid, p_grupo_b uuid, p_gravidade text,
  p_efeito text, p_conduta text, p_fonte text, p_situacao text, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.cuida_da_lista_interacoes(p_unidade) THEN
    RAISE EXCEPTION 'Só o farmacêutico ou o gestor da unidade cuida da lista de interações.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga o motivo da mudança (mínimo de 5 letras).'; END IF;
  IF p_situacao NOT IN ('proposta', 'ativa', 'inativa') OR p_gravidade NOT IN ('contraindicada', 'grave') THEN
    RAISE EXCEPTION 'Situação ou gravidade desconhecida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupos_interacao WHERE id = p_grupo_a AND unidade_id = p_unidade)
     OR NOT EXISTS (SELECT 1 FROM public.grupos_interacao WHERE id = p_grupo_b AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Escolha os dois grupos da unidade.';
  END IF;
  IF p_situacao = 'ativa' AND (NOT EXISTS (SELECT 1 FROM public.grupos_interacao_membros WHERE grupo_id = p_grupo_a)
                               OR NOT EXISTS (SELECT 1 FROM public.grupos_interacao_membros WHERE grupo_id = p_grupo_b)) THEN
    RAISE EXCEPTION 'Para ativar, os dois grupos precisam ter ao menos um princípio ativo.';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.interacoes_criticas (unidade_id, grupo_a, grupo_b, gravidade, efeito, conduta, fonte, situacao, atualizado_por, motivo)
    VALUES (p_unidade, p_grupo_a, p_grupo_b, p_gravidade, btrim(p_efeito), nullif(btrim(coalesce(p_conduta, '')), ''), btrim(p_fonte),
            p_situacao, private.meu_perfil_id(), btrim(p_motivo))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.interacoes_criticas
       SET grupo_a = p_grupo_a, grupo_b = p_grupo_b, gravidade = p_gravidade, efeito = btrim(p_efeito),
           conduta = nullif(btrim(coalesce(p_conduta, '')), ''), fonte = btrim(p_fonte), situacao = p_situacao,
           atualizado_por = private.meu_perfil_id(), atualizado_em = now(), motivo = btrim(p_motivo)
     WHERE id = p_id AND unidade_id = p_unidade
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Interação não encontrada.'; END IF;
  END IF;
  PERFORM private.registrar_auditoria('salvar_interacao', 'interacoes_criticas', v_id, p_unidade,
    jsonb_build_object('situacao', p_situacao, 'gravidade', p_gravidade, 'efeito', p_efeito, 'conduta', p_conduta,
                       'fonte', p_fonte, 'motivo', p_motivo));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_interacao(uuid, uuid, uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_interacao(uuid, uuid, uuid, uuid, text, text, text, text, text, text) TO authenticated;

-- justificativas registradas nos itens (para a prescrição e a checagem)
CREATE OR REPLACE FUNCTION public.interacoes_justificadas(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('item_id', a.item_id, 'outro', o.descricao, 'efeito', ic.efeito,
           'gravidade', ic.gravidade, 'justificativa', a.justificativa, 'por', p.nome_completo, 'em', a.em)), '[]'::jsonb)
    FROM public.alertas_interacao a
    JOIN public.interacoes_criticas ic ON ic.id = a.interacao_id
    JOIN public.prescricao_itens o ON o.id = a.outro_item_id
    LEFT JOIN public.perfis p ON p.id = a.por
   WHERE a.item_id = ANY (p_itens) AND private.segundo_fator_ok() AND private.membro_da_unidade(a.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.interacoes_justificadas(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.interacoes_justificadas(uuid[]) TO authenticated;

-- ── prescrição: interação crítica pede justificativa (corpo de 20261022000006 + o bloco da tarefa 3) ──
CREATE OR REPLACE FUNCTION public.prescrever(p_paciente uuid, p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_alergia text;
  v_presc uuid; v_unidade uuid; v_nasc date; v_peso numeric; v_desde timestamptz; v_id uuid;
  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  m public.medicamento; dv record; al record;
  v_dil_id uuid; v_dil_versao int; v_dil_texto text;
  v_via text := upper(nullif(btrim(p_item ->> 'via'), ''));
  v_dil_div text := nullif(btrim(p_item ->> 'diluicao_divergente'), '');
  -- Fase 2, tarefa 3: interação crítica pede justificativa
  v_inter jsonb;
  v_just_inter text := nullif(btrim(p_item ->> 'justificativa_interacao'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A prescrição é do médico de plantão no setor do paciente.';
  END IF;

  IF v_tipo = 'cuidado' THEN
    IF length(btrim(coalesce(p_item ->> 'descricao', ''))) < 3 THEN RAISE EXCEPTION 'Descreva o cuidado.'; END IF;
  ELSIF v_tipo = 'medicamento' THEN
    SELECT * INTO m FROM public.medicamento WHERE id = nullif(p_item ->> 'medicamento_id', '')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'dose', ''))) = 0 THEN RAISE EXCEPTION 'Informe a dose.'; END IF;
    IF v_via IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'posologia', ''))) = 0 THEN RAISE EXCEPTION 'Informe a frequência.'; END IF;
    -- alergia trava o item (e nada a contorna): mesmo medicamento, mesmo
    -- princípio ativo ou a classe (ATC) dele — private.alergia_que_trava
    v_alergia := private.alergia_que_trava(p_paciente, m.id);
    IF v_alergia IS NOT NULL THEN
      RAISE EXCEPTION 'ALERGIA: o paciente tem alergia registrada a "%". Este item não foi prescrito.', v_alergia;
    END IF;
    -- pediatria: peso aferido no episódio
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
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;

  v_presc := private.prescricao_do_paciente(p_paciente, true);
  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;
  IF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;

  -- Fase 2, tarefa 3: interação crítica ativa na unidade com item vigente
  IF v_tipo = 'medicamento' THEN
    v_inter := private.interacoes_com_prescricao(v_presc, m.id, v_unidade);
    IF jsonb_array_length(v_inter) > 0 AND (v_just_inter IS NULL OR length(v_just_inter) < 10) THEN
      RAISE EXCEPTION 'INTERAÇÃO CRÍTICA com %. Para prescrever mesmo assim, justifique (mínimo de 10 letras).',
        (SELECT string_agg((x ->> 'outro') || ' (' || (x ->> 'gravidade') || ')', '; ') FROM jsonb_array_elements(v_inter) x)
        USING DETAIL = v_inter::text, HINT = 'interacao_critica';
    END IF;
  END IF;

  -- diluição vigente agora (a da unidade tem preferência)
  IF v_tipo = 'medicamento' THEN
    SELECT * INTO dv FROM public.diluicao_vigente(m.id, v_via, now(), v_unidade);
    IF FOUND THEN v_dil_id := dv.id; v_dil_versao := dv.versao; v_dil_texto := dv.texto; END IF;
    IF v_dil_div IS NOT NULL AND length(btrim(coalesce(p_item ->> 'justificativa_divergencia', ''))) < 10 THEN
      RAISE EXCEPTION 'Diluição diferente do padrão só com justificativa (mínimo de 10 letras).';
    END IF;
  END IF;

  INSERT INTO public.prescricao_itens (prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, observacao,
    tipo, peso_kg, diluicao_id, diluicao_versao, diluicao_texto, diluicao_divergente, justificativa_divergencia, autor_id, ordem)
  VALUES (v_presc, m.id,
          CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') ELSE m.principio_ativo || coalesce(' ' || m.apresentacao, '') END,
          nullif(btrim(p_item ->> 'dose'), ''), v_via, nullif(btrim(p_item ->> 'posologia'), ''),
          coalesce((p_item ->> 'se_necessario')::boolean, false), nullif(btrim(p_item ->> 'observacao'), ''),
          v_tipo, v_peso, v_dil_id, v_dil_versao, coalesce(v_dil_div, v_dil_texto), v_dil_div IS NOT NULL,
          CASE WHEN v_dil_div IS NOT NULL THEN btrim(p_item ->> 'justificativa_divergencia') END,
          private.meu_perfil_id(),
          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1))
  RETURNING id INTO v_id;
  IF jsonb_array_length(coalesce(v_inter, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.alertas_interacao (unidade_id, item_id, interacao_id, outro_item_id, justificativa, por)
    SELECT v_unidade, v_id, (x ->> 'interacao_id')::uuid, (x ->> 'outro_item_id')::uuid, v_just_inter, private.meu_perfil_id()
      FROM jsonb_array_elements(v_inter) x;
    PERFORM private.registrar_auditoria('prescrever_com_interacao', 'prescricao_itens', v_id, v_unidade,
      jsonb_build_object('interacoes', v_inter, 'justificativa', v_just_inter));
  END IF;
  RETURN v_id;
END $function$;

-- ── alteração de item: a justificativa de interação da versão anterior segue (corpo de 20261031000004) ──
CREATE OR REPLACE FUNCTION public.alterar_item_prescricao(p_item uuid, p_mudancas jsonb, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it public.prescricao_itens;
  pr public.prescricoes;
  v_novo uuid;
  v_item jsonb;
  v_dose text; v_via text; v_pos text; v_sn boolean; v_obs text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item FOR UPDATE;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou já suspenso.'; END IF;
  IF it.tipo <> 'medicamento' THEN RAISE EXCEPTION 'Só medicamento se altera; cuidado se suspende e se prescreve de novo.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.paciente_no_meu_plantao(pr.paciente_id) OR private.tenho_papel(pr.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Alterar a prescrição é do médico de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Diga por que altera (mínimo de 5 letras).'; END IF;

  v_dose := coalesce(nullif(btrim(p_mudancas ->> 'dose'), ''), it.dose);
  v_via := upper(coalesce(nullif(btrim(p_mudancas ->> 'via'), ''), it.via));
  v_pos := coalesce(nullif(btrim(p_mudancas ->> 'posologia'), ''), it.posologia);
  v_sn := coalesce((p_mudancas ->> 'se_necessario')::boolean, it.se_necessario);
  v_obs := CASE WHEN p_mudancas ? 'observacao' THEN nullif(btrim(p_mudancas ->> 'observacao'), '') ELSE it.observacao END;
  IF v_dose IS NOT DISTINCT FROM it.dose AND v_via IS NOT DISTINCT FROM upper(it.via) AND v_pos IS NOT DISTINCT FROM it.posologia
     AND v_sn = it.se_necessario AND v_obs IS NOT DISTINCT FROM it.observacao THEN
    RAISE EXCEPTION 'Nada mudou: altere dose, via, frequência, "se necessário" ou observação.';
  END IF;

  -- a anterior sai da prescrição vigente (fica guardada, com o motivo)
  UPDATE public.prescricao_itens
     SET suspenso_em = now(), suspenso_por = private.meu_perfil_id(), motivo_suspensao = 'Alterado: ' || btrim(p_motivo)
   WHERE id = it.id;

  -- a nova versão passa pelas mesmas travas da prescrição
  v_item := jsonb_build_object('tipo', 'medicamento', 'medicamento_id', it.medicamento_id, 'dose', v_dose, 'via', v_via,
                               'posologia', v_pos, 'se_necessario', v_sn, 'observacao', v_obs);
  -- interação crítica já justificada na versão anterior: a justificativa segue (Fase 2, tarefa 3)
  v_item := v_item || coalesce((SELECT jsonb_build_object('justificativa_interacao', 'Mantida da versão anterior: ' || a.justificativa)
                                  FROM public.alertas_interacao a WHERE a.item_id = it.id ORDER BY a.em DESC LIMIT 1), '{}'::jsonb);
  IF it.diluicao_divergente AND v_via = upper(it.via) THEN
    v_item := v_item || jsonb_build_object('diluicao_divergente', it.diluicao_texto, 'justificativa_divergencia', it.justificativa_divergencia);
  END IF;
  v_novo := public.prescrever(pr.paciente_id, v_item);

  UPDATE public.prescricao_itens
     SET substitui_item_id = it.id, versao = it.versao + 1, motivo_alteracao = btrim(p_motivo), ordem = it.ordem,
         horarios = CASE WHEN v_pos IS NOT DISTINCT FROM it.posologia AND NOT v_sn THEN it.horarios END
   WHERE id = v_novo;
  PERFORM private.registrar_auditoria('alterar_item_prescricao', 'prescricao_itens', v_novo, pr.unidade_id,
    jsonb_build_object('anterior', it.id, 'versao', it.versao + 1,
                       'antes', jsonb_build_object('dose', it.dose, 'via', it.via, 'posologia', it.posologia, 'se_necessario', it.se_necessario),
                       'depois', jsonb_build_object('dose', v_dose, 'via', v_via, 'posologia', v_pos, 'se_necessario', v_sn)));
  RETURN v_novo;
END $$;
