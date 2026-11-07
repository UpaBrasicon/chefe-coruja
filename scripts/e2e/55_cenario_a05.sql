-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A05.
-- Anafilaxia pediátrica na porta da UPA, com liberação da farmácia.
-- Especificação: CENARIOS-A, seção A05.
--
-- Triagem vermelha → atendimento → prescrição conforme ped-anafilaxia-icr →
-- 1ª dose de alta vigilância antes da liberação (com motivo) → farmácia →
-- reavaliação e 2ª dose → observação pediátrica → alta pelo médico da porta
-- (decisão do RT de 06/11/2026) com receita e atestado → conta e BPA.
-- Cada passo roda COMO a conta do papel (RLS ligado); resultado em
-- e2e.resultados (passos 'A05.NN.*', paciente = 5). Nada é corrigido no produto.
-- Prescrição SEM dose de memória: dose = 'conforme protocolo — dado fictício de
-- teste de fluxo'; os itens citam ped-anafilaxia-icr. A cor é a escolha da
-- enfermeira de teste. O box da observação pediátrica usa as contas do 49a.
--
-- Rodar antes: 41_checkin_fase5.sql (e, uma vez, 49a_ambiente_bloco_a.sql).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/55_cenario_a05.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── apoio do roteiro (mesmo corpo do 50; recriados aqui) ────────────────────
CREATE OR REPLACE FUNCTION e2e.confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;
CREATE OR REPLACE FUNCTION e2e.cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((90000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;

-- ── apoio do bloco A (A02 a A06; mesmo corpo nos scripts 52 a 56) ──────────
-- sinais vitais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.ba_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-a',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;
-- conferência no banco, como postgres (o que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.ba_banco(p_n int, p_passo text, p_descricao text, p_sql text, p_guardar text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; v_sit text; v_det text;
BEGIN
  BEGIN
    EXECUTE p_sql INTO r;
    IF p_guardar IS NOT NULL THEN
      IF r IS NULL THEN RAISE EXCEPTION 'nenhuma linha'; END IF;
      PERFORM e2e.guardar(p_guardar, r);
    END IF;
    v_sit := 'ok'; v_det := left(r, 400);
  EXCEPTION WHEN OTHERS THEN
    v_sit := 'falha'; v_det := SQLSTATE || ': ' || SQLERRM;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;
-- passo que depende de ids de passos anteriores (lista separada por vírgula):
-- sem algum deles, vira lacuna "bloqueado pelo passo X"
CREATE OR REPLACE FUNCTION e2e.ba(p_n int, p_dep text, p_dep_passo text, p_passo text, p_papel text, p_rota text, p_descricao text,
                                 p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY string_to_array(coalesce(p_dep, ''), ',') LOOP
    IF btrim(d) <> '' AND e2e.v(btrim(d)) IS NULL THEN
      RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || btrim(d) || ')');
    END IF;
  END LOOP;
  IF p_papel = 'banco' THEN RETURN e2e.ba_banco(p_n, p_passo, p_descricao, p_sql, p_guardar); END IF;
  RETURN e2e.ba_passo(p_passo, p_n, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;
-- ajuste de ambiente (datas, prazo) que não derruba a rodada se falhar
CREATE OR REPLACE FUNCTION e2e.ba_ajuste(p_n int, p_passo text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_sql IS NULL THEN
    RETURN e2e.lacuna(p_passo, p_n, NULL, p_descricao, 'bloqueado: faltou o id de um passo anterior');
  END IF;
  BEGIN
    EXECUTE p_sql;
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'ajuste', left(p_sql, 400));
    RETURN 'ajuste — ' || p_passo;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'falha', 'ajuste recusado: ' || SQLERRM);
    RETURN 'falha — ' || p_passo;
  END;
END $$;
-- passo só de registro: roda como o papel, guarda "aceito" ou "recusado" e desfaz o que fez
CREATE OR REPLACE FUNCTION e2e.ba_registra(p_n int, p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_det text;
BEGIN
  IF p_sql IS NULL THEN RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado: faltou o id de um passo anterior'); END IF;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql;
    PERFORM set_config('role', 'postgres', true);
    RAISE EXCEPTION 'e2e_desfazer';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    v_det := CASE WHEN SQLERRM = 'e2e_desfazer' THEN 'ACEITO (a ação foi desfeita para não mudar o cenário)' ELSE 'RECUSADO: ' || SQLERRM END;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, p_papel, p_rota, p_descricao, 'registrar', 'ok', v_det);
  RETURN 'registrado — ' || p_passo || ' — ' || v_det;
END $$;
-- SQL que leva um episódio da UBS (e os sinais de agora) para o passado
CREATE OR REPLACE FUNCTION e2e.ba_sql_passado(p_ep uuid, p_pac uuid, p_dias int) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_ep IS NULL OR p_pac IS NULL THEN NULL ELSE
    format($q$UPDATE public.episodios SET chegada_em = chegada_em - %1$L::interval,
                     atendimento_iniciado_em = atendimento_iniciado_em - %1$L::interval,
                     classificado_em = classificado_em - %1$L::interval, desfecho_em = desfecho_em - %1$L::interval,
                     encerrado_em = encerrado_em - %1$L::interval WHERE id = %2$L;
                   UPDATE public.observacao SET aferido_em = aferido_em - %1$L::interval
                    WHERE paciente_id = %3$L AND aferido_em >= now() - interval '1 minute'$q$,
           p_dias || ' days', p_ep, p_pac) END
$$;
-- contas do bloco A: as do framework (47) mais as três do 49a
CREATE OR REPLACE FUNCTION e2e.conta_a(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'f5_med_obsped' THEN 'f5200000-0000-4000-8000-0000000000a1'::uuid
    WHEN 'f5_enf_obsped' THEN 'f5200000-0000-4000-8000-0000000000a2'::uuid
    WHEN 'f5_enf_int'    THEN 'f5200000-0000-4000-8000-0000000000a3'::uuid
    ELSE e2e.conta(p_papel) END
$$;
-- e2e.passo do 04 com as contas do bloco A (e2e.conta_a); o e2e.passo do 04 não é tocado
CREATE OR REPLACE FUNCTION e2e.ba_passo(p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                    p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_resultado text; v_situacao text; v_detalhe text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql INTO v_resultado;
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'ok'; v_detalhe := left(v_resultado, 400);
      IF p_guardar IS NOT NULL THEN
        INSERT INTO e2e.vars VALUES (p_guardar, v_resultado) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'PASSOU sem erro (deveria ser recusado): ' || left(coalesce(v_resultado, ''), 300);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'falha'; v_detalhe := SQLSTATE || ': ' || SQLERRM;
    ELSIF p_esperado = 'erro' OR SQLERRM LIKE substr(p_esperado, 6) || '%' THEN
      v_situacao := 'ok'; v_detalhe := 'recusado: ' || SQLERRM;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'recusado com outra mensagem: ' || SQLERRM;
    END IF;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_rota, p_descricao, p_esperado, v_situacao, v_detalhe);
  RETURN v_situacao || ' — ' || p_passo || ' — ' || coalesce(v_detalhe, '');
END $$;

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.guardar('a05_rodada', (coalesce(e2e.v('a05_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a05_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a05\_%' AND nome NOT IN ('a05_rodada', 'a05_inicio');
SELECT e2e.guardar('a05_sufixo', CASE WHEN e2e.v('a05_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('a05_rodada')::int) ELSE '' END);
SELECT e2e.guardar('a05_nome', 'Sofia A05 Teste' || e2e.v('a05_sufixo'));
SELECT e2e.guardar('a05_cadastro', jsonb_build_object('nome', e2e.v('a05_nome'),
  'data_nascimento', (private.data_atual() - interval '6 years 2 months')::date, 'sexo', 'F', 'raca_cor', 'parda',
  'cns', e2e.cns(70500 + e2e.v('a05_rodada')::int), 'nome_mae', 'Mãe Fictícia de Sofia A05', 'responsavel_nome', 'Mãe Fictícia de Sofia A05',
  'responsavel_parentesco', 'mãe', 'endereco', 'Rua do Teste, 5', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.guardar('a05_adr', '05d757fb-f81f-4f78-a499-89d523a24514');   -- Adrenalina, ampola 1 mL (alta vigilância na UPA F5)
SELECT e2e.guardar('a05_sf',  '9b38746a-ae39-448c-91c7-68a5c5cb3524');   -- Cloreto de sódio, bolsa 500 mL
SELECT e2e.guardar('a05_sal', '98a79ff3-6264-4907-be93-0409f0416aaf');   -- Salbutamol aerossol

-- ── 1. recepção ─────────────────────────────────────────────────────────────
SELECT e2e.ba_passo('A05.01.ficha', 5, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Ficha de Sofia no PS: reação alérgica',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Reação alérgica minutos depois de comer amendoim', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a05_cadastro')), 'ok', 'a05_ep');
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.01.paciente', 'banco', NULL, 'Paciente', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a05_ep')), 'ok', 'a05_pac');
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.01.conta', 'f5_fat', '/faturamento/contas', 'Conta ambulatorial aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' AND c ->> 'status' = 'aberta' LIMIT 1), e2e.falhar('conta não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a05_nome')), 'ok', 'a05_conta');

-- ── 2. triagem vermelha ─────────────────────────────────────────────────────
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.02.chamar', 'f5_enf_upa', '/triagem (Fila)', 'Chama Sofia',
  format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a05_ep'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.02.classificar', 'f5_enf_upa', '/triagem (Classificar)',
  'Fluxograma pediátrico "Alterações dermatológicas" (escolha da enfermeira), sinais crus; a enfermeira de teste classifica vermelho',
  format($q$SELECT public.classificar_risco(%L::uuid, 'vermelho', '{"frequencia-cardiaca":150,"frequencia-respiratoria":36,"saturacao-o2":91,"pressao-arterial-sistolica":82,"pressao-arterial-diastolica":50,"temperatura":36.8,"escala-dor":4}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'Urticária, edema de lábios e sibilos após amendoim', false, %L::boolean)::text$q$,
    e2e.u('a05_ep'), '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'vermelho'), 'Edema de lábios com sibilos após alimento (livre, teste A05)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'vermelho') IS NULL)::text), 'ok', 'a05_class');
SELECT e2e.ba(5, 'a05_class', 'A05.02.classificar', 'A05.02.cor', 'banco', NULL, 'Cor da enfermeira; grupo pediátrico',
  format($q$SELECT e2e.confere(cor = 'vermelho' AND publico = 'pediatrico', 'cor ' || cor || ', público ' || publico || ', discriminador ' || coalesce(discriminador, '?'))
    FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a05_class')));

-- ── 3. médico: assume, peso aferido, SOAP ───────────────────────────────────
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.03.iniciar', 'f5_med_upa', '/atendimento', 'Médico assume na hora', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a05_ep')));
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.03.peso', 'f5_med_upa', '/atendimento (peso)', 'Peso aferido na porta', e2e.ba_sinais(e2e.u('a05_pac'), '{"peso":21}', NULL, 'aferido'));
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.03.soap', 'f5_med_upa', '/atendimento', 'SOAP com CID de anafilaxia alimentar (T78.0)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Urticária, edema de lábios e sibilos após amendoim (teste A05)', 'FC 150, FR 36, SpO2 91%%, PA 82x50; peso aferido 21 kg', 'Anafilaxia', 'Conduta conforme a ferramenta ped-anafilaxia-icr (teste de fluxo)', 'T78.0')::text$q$, e2e.u('a05_ep')));

-- ── 4. prescrição conforme ped-anafilaxia-icr ───────────────────────────────
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.04.epinefrina', 'f5_med_upa', '/atendimento (Prescrição)',
  'Primeira linha: epinefrina IM, "Agora" (dose única), conforme ped-anafilaxia-icr; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a05_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('a05_adr'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'intramuscular', 'posologia', 'Agora', 'observacao', 'Primeira linha conforme ped-anafilaxia-icr (ICr cap. 6) — teste de fluxo')), 'ok', 'a05_item_adr');
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.04.cristaloide', 'f5_med_upa', '/atendimento (Prescrição)',
  'Segunda linha: cristaloide (SF) EV, "Agora", conforme ped-anafilaxia-icr; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a05_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('a05_sf'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora', 'observacao', 'Segunda linha conforme ped-anafilaxia-icr — teste de fluxo')), 'ok', 'a05_item_sf');
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.04.salbutamol', 'f5_med_upa', '/atendimento (Prescrição)',
  'Salbutamol aerossol "Se necessário" para o broncoespasmo, conforme ped-anafilaxia-icr; dose = texto de teste',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a05_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('a05_sal'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'inalatoria', 'posologia', 'Se necessário', 'se_necessario', true, 'observacao', 'Broncoespasmo, conforme ped-anafilaxia-icr — teste de fluxo')), 'ok', 'a05_item_sal');
SELECT e2e.ba(5, 'a05_item_adr', 'A05.04.epinefrina', 'A05.04.alta_vigilancia', 'f5_farm', '/farmacia (fila)', 'A epinefrina está na fila como alta vigilância, aguardando liberação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.alta_vigilancia), 'na fila com alta vigilância')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a05_item_adr')));

-- ── 5. enfermagem administra antes da liberação (emergência) ────────────────
SELECT e2e.ba(5, 'a05_item_adr', 'A05.04.epinefrina', 'A05.05.motivo_9_letras', 'f5_enf_upa', '/checagem', 'Checar sem liberação com motivo de 9 letras (deve ser recusado)',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, 'Emergênci')::text$q$, e2e.u('a05_item_adr')), 'erro:Alta vigilância sem liberação');
SELECT e2e.ba(5, 'a05_item_adr', 'A05.04.epinefrina', 'A05.05.checar_sem_liberacao', 'f5_enf_upa', '/checagem', 'Checa "feito" a epinefrina antes da liberação, com motivo de 10+ letras',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, 'Anafilaxia em curso, farmácia avisada (teste A05)')::text$q$, e2e.u('a05_item_adr')), 'ok', 'a05_adm1');
SELECT e2e.ba(5, 'a05_adm1', 'A05.05.checar_sem_liberacao', 'A05.05.marcada', 'banco', NULL, 'A administração fica sem_liberacao = true, autor = login da enfermeira',
  format($q$SELECT e2e.confere(sem_liberacao AND registrado_por = 'f5200000-0000-4000-8000-000000000007', 'sem_liberacao ' || sem_liberacao || ', motivo "' || coalesce(motivo, '') || '"')
    FROM public.administracoes WHERE id = %L$q$, e2e.u('a05_adm1')));
SELECT e2e.ba(5, 'a05_item_sf', 'A05.04.cristaloide', 'A05.05.checar_sf', 'f5_enf_upa', '/checagem', 'Checa "feito" o cristaloide (não é alta vigilância)',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a05_item_sf')), 'ok', 'a05_adm_sf');
SELECT e2e.ba(5, 'a05_item_sal', 'A05.04.salbutamol', 'A05.B.enf_outro_setor', 'f5_enf_obs', '/checagem', 'Enfermeira da Observação Adulto checa item de paciente do PS (deve ser recusado)',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a05_item_sal')), 'erro:A checagem é da enfermagem de plantão no setor do paciente');

-- ── 6. farmácia: vê, valida, dispensa ───────────────────────────────────────
SELECT e2e.ba(5, 'a05_adm1', 'A05.05.checar_sem_liberacao', 'A05.06.ve_sem_liberacao', 'f5_farm', '/alta-vigilancia', 'O farmacêutico vê a administração sem liberação',
  format($q$SELECT e2e.confere(public.administracoes_sem_liberacao(%L::uuid)::text LIKE '%%' || %L || '%%', 'na lista do farmacêutico')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a05_adm1')));
SELECT e2e.ba(5, 'a05_item_adr', 'A05.04.epinefrina', 'A05.06.validar_adr', 'f5_farm', '/alta-vigilancia', 'Valida a epinefrina (confere = liberação)', format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a05_item_adr')));
SELECT e2e.ba(5, 'a05_item_sf', 'A05.04.cristaloide', 'A05.06.validar_sf', 'f5_farm', '/farmacia', 'Valida o cristaloide', format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a05_item_sf')));
SELECT e2e.ba(5, 'a05_item_sal', 'A05.04.salbutamol', 'A05.06.validar_sal', 'f5_farm', '/farmacia', 'Valida o salbutamol', format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a05_item_sal')));
SELECT e2e.ba(5, 'a05_item_adr', 'A05.04.epinefrina', 'A05.06.dispensar_adr', 'f5_farm', '/dispensacao', 'Dispensa a epinefrina (inclusive a já administrada)', format('SELECT public.dispensar_item(%L::uuid, 2, NULL)::text', e2e.u('a05_item_adr')));
SELECT e2e.ba(5, 'a05_item_sf', 'A05.04.cristaloide', 'A05.06.dispensar_sf', 'f5_farm', '/dispensacao', 'Dispensa o cristaloide', format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a05_item_sf')));
SELECT e2e.ba(5, 'a05_item_sal', 'A05.04.salbutamol', 'A05.06.dispensar_sal', 'f5_farm', '/dispensacao', 'Dispensa o salbutamol', format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a05_item_sal')));
SELECT e2e.ba_passo('A05.06.extrato', 5, 'f5_farm', '/estoque (extrato)', 'O extrato da epinefrina mostra a saída por prescrição',
  format($q$SELECT e2e.confere(public.extrato_estoque(%L::uuid, %L::uuid, 1)::text LIKE '%%saida_prescricao%%', left(public.extrato_estoque(%L::uuid, %L::uuid, 1)::text, 250))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a05_adr'), 'f5100000-0000-4000-8000-000000000002', e2e.v('a05_adr')));
SELECT e2e.ba(5, 'a05_item_sal', 'A05.04.salbutamol', 'A05.B.enf_dispensa_sem_justificativa', 'f5_enf_upa', '/dispensacao', 'Enfermagem dispensa sem farmacêutico e sem justificativa (deve ser recusado)',
  format('SELECT public.dispensar_item(%L::uuid, 1, NULL)::text', e2e.u('a05_item_sal')), 'erro:Retirada sem farmacêutico');
SELECT e2e.ba_registra(5, 'A05.B.enf_dispensa_com_farmacia_aberta', 'f5_enf_upa', '/dispensacao',
  'Enfermagem dispensa com justificativa enquanto o farmacêutico está de plantão (o catálogo diz: só com a farmácia fechada) — registro, desfeito',
  CASE WHEN e2e.v('a05_item_sal') IS NULL THEN NULL ELSE format($q$SELECT public.dispensar_item(%L::uuid, 1, 'Farmácia fechada no teste A05 (justificativa)')$q$, e2e.v('a05_item_sal')) END);
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.B.farm_prontuario', 'f5_farm', '/prontuarios', 'Farmacêutico pede acesso ao prontuário (deve ser recusado)',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'Conferência da anafilaxia (teste A05)')::text$q$, e2e.u('a05_pac')), 'erro');

-- ── 7. interações ───────────────────────────────────────────────────────────
SELECT e2e.ba_passo('A05.07.lista', 5, 'f5_farm', '/interacoes', 'Lista de interações críticas da UPA',
  format($q$SELECT 'pares ' || jsonb_array_length(l -> 'pares') || ' (ativos ' || (SELECT count(*) FROM jsonb_array_elements(l -> 'pares') p WHERE p ->> 'situacao' = 'ativa') || ')'
    FROM (SELECT public.lista_interacoes(%L::uuid) l) x$q$, 'f5100000-0000-4000-8000-000000000002'));
SELECT e2e.ba(5, 'a05_item_adr,a05_item_sf,a05_item_sal', 'A05.04.epinefrina', 'A05.07.justificadas', 'f5_farm', '/interacoes', 'Interações justificadas entre os itens prescritos (nenhuma esperada)',
  format('SELECT public.interacoes_justificadas(ARRAY[%L, %L, %L]::uuid[])::text', e2e.v('a05_item_adr'), e2e.v('a05_item_sf'), e2e.v('a05_item_sal')));

-- ── 8. reavaliação e segunda dose ───────────────────────────────────────────
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.08.reavaliacao', 'f5_med_upa', '/atendimento (Reavaliação)', 'Reavaliação: sibilos persistentes',
  format($q$SELECT public.registrar_reavaliacao(%L::uuid, 'Persistem sibilos e PA 88x52 após a 1ª dose (teste A05)')::text$q$, e2e.u('a05_ep')));
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.08.sinais', 'f5_med_upa', '/atendimento (Reavaliação)', 'Sinais crus da reavaliação',
  e2e.ba_sinais(e2e.u('a05_pac'), '{"frequencia-cardiaca":142,"frequencia-respiratoria":32,"saturacao-o2":93,"pressao-arterial-sistolica":88,"pressao-arterial-diastolica":52}'));
SELECT e2e.ba(5, 'a05_pac', 'A05.01.paciente', 'A05.08.segunda_dose', 'f5_med_upa', '/atendimento (Prescrição)',
  'Segunda dose de epinefrina IM "Agora", conforme a ferramenta (repetir se a resposta não for plena)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a05_pac'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', e2e.v('a05_adr'), 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'intramuscular', 'posologia', 'Agora', 'observacao', 'Segunda dose conforme ped-anafilaxia-icr — teste de fluxo')), 'ok', 'a05_item_adr2');
SELECT CASE WHEN e2e.v('a05_item_adr2') IS NOT NULL OR e2e.v('a05_item_adr') IS NULL THEN 'contorno não preciso'
  ELSE e2e.ba_passo('A05.08.segunda_dose_alterar', 5, 'f5_med_upa', '/atendimento (Prescrição)',
    'Contorno (o do A01): altera o item da 1ª dose para a 2ª; vira item novo, sem a liberação anterior',
    format($q$SELECT public.alterar_item_prescricao(%L::uuid, %L::jsonb, 'Segunda dose por resposta incompleta, conforme a ferramenta (teste A05)')::text$q$,
      e2e.v('a05_item_adr'), jsonb_build_object('posologia', 'Agora', 'dose', 'segunda dose conforme protocolo — dado fictício de teste de fluxo')), 'ok', 'a05_item_adr2') END;
SELECT e2e.ba(5, 'a05_item_adr2', 'A05.08.segunda_dose', 'A05.B.alterado_perde_liberacao', 'f5_farm', '/farmacia (fila)', 'O item novo volta à fila sem liberação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.fila_validacao(%L::uuid) f WHERE f.item_id = %L::uuid AND f.ultima_situacao IS DISTINCT FROM 'confere'), 'na fila, sem confere')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a05_item_adr2')));
SELECT e2e.ba(5, 'a05_item_adr2', 'A05.08.segunda_dose', 'A05.08.sem_motivo_antes', 'f5_enf_upa', '/checagem', 'Checar a 2ª dose sem motivo antes da liberação (deve ser recusado)',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a05_item_adr2')), 'erro:Alta vigilância sem liberação');
SELECT e2e.ba(5, 'a05_item_adr2', 'A05.08.segunda_dose', 'A05.08.validar_2', 'f5_farm', '/alta-vigilancia', 'Farmacêutico libera a 2ª dose (confere)', format('SELECT public.validar_item(%L::uuid, true, NULL)::text', e2e.u('a05_item_adr2')));
SELECT e2e.ba(5, 'a05_item_adr2', 'A05.08.segunda_dose', 'A05.08.checar_2', 'f5_enf_upa', '/checagem', 'Depois do confere, a 2ª dose checa sem motivo',
  format($q$SELECT public.checar(%L::uuid, 'feito', NULL, NULL)::text$q$, e2e.u('a05_item_adr2')), 'ok', 'a05_adm2');
SELECT e2e.ba(5, 'a05_conta', 'A05.01.conta', 'A05.08.medicacao_na_conta', 'f5_fat', '/faturamento/contas', 'Conta: quantas linhas e quantidade de "administração de medicamento" no dia',
  format($q$SELECT e2e.confere(count(*) = 1, count(*) || ' linha(s) 0301100012, quantidade ' || coalesce(string_agg(i ->> 'quantidade', ', '), '?'))
    FROM jsonb_array_elements(public.conta_detalhe(%L::uuid) -> 'itens') i WHERE i ->> 'procedimento' = '0301100012'$q$, e2e.u('a05_conta')));

-- ── 9 e 10. observação pediátrica ───────────────────────────────────────────
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.09.observacao', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho observação (a ferramenta recomenda observar 4 a 6 h)',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'observacao', NULL, '{}'::jsonb)::text$q$, e2e.u('a05_ep')));
SELECT e2e.ba(5, 'a05_ep', 'A05.01.ficha', 'A05.09.internacao', 'banco', NULL, 'Internação de observação', format($q$SELECT (desfecho_detalhes ->> 'internacao_id') FROM public.episodios WHERE id = %L AND etapa = 'observacao'$q$, e2e.u('a05_ep')), 'ok', 'a05_int');
SELECT e2e.ba(5, 'a05_int', 'A05.09.internacao', 'A05.09.box', 'banco', NULL, 'Box na Observação Pediátrica (o catálogo previa a Observação Adulto)',
  format($q$SELECT e2e.confere(s.nome = 'Observação Pediátrica', 'setor ' || s.nome || ', box ' || coalesce(l.identificador, 'nenhum'))
    FROM public.internacoes i JOIN public.setores s ON s.id = i.setor_atual_id LEFT JOIN public.leitos l ON l.id = i.leito_atual_id WHERE i.id = %L$q$, e2e.u('a05_int')));
SELECT e2e.ba(5, 'a05_int', 'A05.09.internacao', 'A05.10.sinais', 'f5_enf_obsped', '/enfermagem/pronto-socorro', 'Sinais seriados crus no box',
  e2e.ba_sinais(e2e.u('a05_pac'), '{"frequencia-cardiaca":118,"frequencia-respiratoria":26,"saturacao-o2":97,"pressao-arterial-sistolica":98,"pressao-arterial-diastolica":60}', e2e.u('a05_int')));

-- ── 11. alta pelo médico da porta (decisão do RT, 06/11/2026) ───────────────
SELECT e2e.ba(5, 'a05_int', 'A05.09.internacao', 'A05.11.alta_pelo_medico_da_porta', 'f5_med_upa', '/plantao/observacao',
  'O médico da porta, que pôs Sofia em observação e não está escalado nela, encerra com alta (T78.0)',
  format($q$SELECT public.finalizar_observacao(%L::uuid, 'alta_medica', 'T78.0', 'Sem nova reação no período de observação; orientações à mãe (teste A05)', '{}'::jsonb)::text$q$,
    e2e.u('a05_int')), 'ok', 'a05_finalizada');
SELECT e2e.ba(5, 'a05_finalizada', 'A05.11.alta_pelo_medico_da_porta', 'A05.11.encerrado', 'banco', NULL, 'Episódio encerrado, alta registrada pelo médico da porta',
  format($q$SELECT e2e.confere(e.etapa = 'encerrado' AND i.alta_por = 'f5200000-0000-4000-8000-000000000008', 'episódio ' || e.etapa || ', internação ' || i.status || ', alta por ' || right(i.alta_por::text, 2))
    FROM public.internacoes i JOIN public.episodios e ON e.id = i.episodio_id WHERE i.id = %L$q$, e2e.u('a05_int')));
SELECT e2e.ba(5, 'a05_pac,a05_finalizada', 'A05.11.alta_pelo_medico_da_porta', 'A05.11.receita', 'f5_med_upa', '/atendimento (Receita)', 'Receita para o responsável (texto de teste, sem dose)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'receita', 'Medicação de alta conforme ped-anafilaxia-icr e autoinjetor conforme a ferramenta — dado fictício de teste de fluxo', %L::uuid) ->> 'id')$q$,
    e2e.u('a05_pac'), e2e.u('a05_ep')), 'ok', 'a05_receita');
SELECT e2e.ba(5, 'a05_pac,a05_finalizada', 'A05.11.alta_pelo_medico_da_porta', 'A05.11.atestado', 'f5_med_upa', '/atendimento (Atestado)', 'Atestado de acompanhamento para a mãe (texto de teste)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'atestado', 'Atesto que a responsável acompanhou a paciente no atendimento de hoje (teste A05)', %L::uuid) ->> 'id')$q$,
    e2e.u('a05_pac'), e2e.u('a05_ep')), 'ok', 'a05_atestado');
SELECT e2e.ba(5, 'a05_receita,a05_atestado', 'A05.11.receita', 'A05.11.autor', 'banco', NULL, 'Receita e atestado com autor = login do médico',
  format($q$SELECT e2e.confere(count(*) = 2 AND bool_and(autor_id = 'f5200000-0000-4000-8000-000000000008'), string_agg(tipo_documento || ' nº ' || coalesce(numero::text, '?') || ' ' || estado, ', '))
    FROM public.documentos_clinicos WHERE id IN (%L, %L)$q$, e2e.v('a05_receita'), e2e.v('a05_atestado')));

-- ── 12. notificação compulsória ─────────────────────────────────────────────
SELECT e2e.ba_passo('A05.12.agravo', 5, 'f5_med_upa', '/notificacao-compulsoria', 'O CID T78.0 não sugere agravo da LNNC',
  $q$SELECT e2e.confere(count(*) = 0, count(*) || ' sugestão(ões)' || coalesce(': ' || left(string_agg(to_jsonb(x)::text, '; '), 200), '')) FROM public.notificacao_compulsoria_dos_cids(ARRAY['T78.0']) x$q$);

-- ── 13. faturamento ─────────────────────────────────────────────────────────
SELECT e2e.ba(5, 'a05_conta', 'A05.01.conta', 'A05.13.detalhe', 'f5_fat', '/faturamento/contas', 'Itens SIGTAP, medicamentos sem valor, total e pendências',
  format($q$SELECT 'itens ' || jsonb_array_length(d -> 'itens') || ' (' || coalesce((SELECT string_agg((i ->> 'procedimento') || ' qt ' || coalesce(i ->> 'quantidade', '?') || ' = ' || coalesce(i ->> 'valor_total', 'nulo'), '; ') FROM jsonb_array_elements(d -> 'itens') i), '') || ')'
      || '; medicamentos ' || jsonb_array_length(coalesce(d -> 'medicamentos', '[]'::jsonb)) || '; total ' || coalesce(d ->> 'total_referencia', 'nulo') || '; pendências ' || jsonb_array_length(d -> 'pendencias')
      || ' [' || coalesce((SELECT string_agg(left(p ->> 'texto', 60), ' | ') FROM jsonb_array_elements(d -> 'pendencias') p), '') || ']; bloqueantes sem liberação ' || coalesce(d ->> 'bloqueantes_sem_liberacao', '?')
    FROM (SELECT public.conta_detalhe(%L::uuid) d) x$q$, e2e.u('a05_conta')));
SELECT e2e.ba(5, 'a05_conta', 'A05.01.conta', 'A05.13.conferencia', 'f5_fat', '/faturamento/contas', 'aberta → em_conferencia', format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a05_conta'), 'em_conferencia'));
SELECT e2e.ba(5, 'a05_conta,a05_finalizada', 'A05.11.alta_pelo_medico_da_porta', 'A05.13.fechar', 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta',
  format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a05_conta'), 'fechada'), 'ok', 'a05_fechada');
SELECT CASE WHEN e2e.v('a05_conta') IS NULL OR e2e.v('a05_finalizada') IS NULL OR e2e.v('a05_fechada') IS NOT NULL THEN 'liberar: não precisou'
  ELSE e2e.ba_passo('A05.13.liberar', 5, 'f5_ges_upa', '/faturamento/contas', 'Gestora libera o fechamento com motivo (havia pendência bloqueante)',
    format($q$SELECT left(public.liberar_fechamento_conta(%L::uuid, 'Teste de fluxo A05: pendências conhecidas da rede de teste')::text, 200)$q$, e2e.u('a05_conta'))) END;
SELECT CASE WHEN e2e.v('a05_conta') IS NULL OR e2e.v('a05_finalizada') IS NULL OR e2e.v('a05_fechada') IS NOT NULL THEN 'fechar: já fechada ou bloqueada'
  ELSE e2e.ba_passo('A05.13.fechar_liberada', 5, 'f5_fat', '/faturamento/contas', 'Faturamento fecha a conta liberada',
    format('SELECT left(public.mudar_etapa_conta(%L::uuid, %L, NULL)::text, 120)', e2e.u('a05_conta'), 'fechada'), 'ok', 'a05_fechada') END;
SELECT e2e.ba_passo('A05.13.bpa', 5, 'f5_fat', '/faturamento (BPA)', 'BPA da UPA: linhas de Sofia (classificação, consulta, medicação)',
  format($q$SELECT e2e.confere(count(*) >= 3, count(*) || ' linhas: ' || string_agg((x ->> 'procedimento') || ' qt ' || coalesce(x ->> 'quantidade', '?') || ' críticas ' || coalesce((x -> 'criticas')::text, '[]'), '; '))
    FROM jsonb_array_elements(public.bpa_conferencia(%L::uuid, %L) -> 'linhas') x WHERE x ->> 'paciente' = %L$q$,
    'f5100000-0000-4000-8000-000000000002', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM'), e2e.v('a05_nome')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A05.%' AND em >= e2e.v('a05_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
