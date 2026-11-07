-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário D11.
-- Cadastro duplicado e unificação: o que aparece junto depois.
-- Especificação: CENARIOS-D-bordas-acessos.md, seção D11.
--
-- Roda na UPA Bloco D com as contas do bloco (recepção, enfermagem,
-- plantonista A, médica da Observação D como quem pede acesso, gestor).
-- Paciente fictícia nova por rodada ("Maria Teste Duplicada"): cadastro A com
-- CNS e cadastro B sem CNS (aberto pela recepção como "outra pessoa", que é
-- como a duplicidade acontece na porta). A cor da classificação é a escolha
-- da enfermeira de teste. Sem dose.
--
-- Rodar antes: 47, 49d, 80 e 85 (escala e check-in do bloco D no turno).
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/90_cenario_d11.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

SELECT e2e.d_guardar('d11_rodada', (coalesce(e2e.d_v('d11_rodada')::int, 0) + 1)::text);
DELETE FROM e2e.vars WHERE nome LIKE 'd11\_%' AND nome <> 'd11_rodada';
SELECT e2e.d_guardar('d11_nome', 'Maria Teste Duplicada' || CASE WHEN e2e.d_v('d11_rodada')::int > 1 THEN ' ' || chr(64 + e2e.d_v('d11_rodada')::int) ELSE '' END);
SELECT e2e.d_guardar('d11_cad_a', jsonb_build_object('nome', e2e.d_v('d11_nome'), 'data_nascimento', '1980-10-10', 'sexo', 'F', 'raca_cor', 'parda',
  'cns', e2e.d_cns(9910 + e2e.d_v('d11_rodada')::int), 'nome_mae', 'Joana Teste', 'endereco', 'Rua do Teste, 11', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);
SELECT e2e.d_guardar('d11_cad_b', jsonb_build_object('nome', e2e.d_v('d11_nome'), 'data_nascimento', '1980-10-10', 'sexo', 'F', 'nome_mae', 'Joana Teste')::text);

-- ficha → chamada → classificação (cor da enfermeira) → médico assume e grava SOAP
CREATE OR REPLACE FUNCTION e2e.d11_atendimento(p_tag text, p_pac text, p_cad text, p_outra boolean, p_queixa text, p_cid text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_ep text;
BEGIN
  PERFORM e2e.d_passo('D11.00.ficha_' || p_tag, 11, 'd_rec', '/recepcao', 'Ficha de Maria (' || p_tag || '): ' || p_queixa,
    format($q$SELECT (public.registrar_ficha(%L::uuid, %L, %L::uuid, %L::jsonb, NULL, %L) ->> 'episodio_id')$q$, 'fd300000-0000-4000-8000-000000000011', p_queixa,
      e2e.d_v(p_pac), CASE WHEN e2e.d_v(p_pac) IS NULL THEN e2e.d_v(p_cad) ELSE '{}' END, p_outra), 'ok', 'd11_ep_' || p_tag);
  v_ep := e2e.d_v('d11_ep_' || p_tag);
  IF v_ep IS NULL THEN RETURN 'sem ficha'; END IF;
  IF e2e.d_v(p_pac) IS NULL THEN PERFORM e2e.d_guardar(p_pac, (SELECT paciente_id::text FROM public.episodios WHERE id = v_ep::uuid)); END IF;
  PERFORM e2e.d_passo('D11.00.chamar_' || p_tag, 11, 'd_enf', '/triagem', 'Chama Maria', format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', v_ep, 'fd400000-0000-4000-8000-000000000001'));
  PERFORM e2e.d_passo('D11.00.classificar_' || p_tag, 11, 'd_enf', '/triagem (Classificar)', 'Classifica (verde = escolha da enfermeira de teste), sinais crus',
    format($q$SELECT public.classificar_risco(%L::uuid, 'verde',
      '{"frequencia-cardiaca":80,"frequencia-respiratoria":16,"temperatura":36.6,"saturacao-o2":98,"escala-dor":4,"pressao-arterial-sistolica":122,"pressao-arterial-diastolica":78}'::jsonb,
      %L::uuid, e2e.disc(%L::uuid, %L::uuid, 'verde'), '{}'::jsonb)::text$q$, v_ep,
      '5b981a47-948c-46e2-838f-403c7d27da81', 'fd100000-0000-4000-8000-000000000001', '5b981a47-948c-46e2-838f-403c7d27da81'));
  PERFORM e2e.d_passo('D11.00.iniciar_' || p_tag, 11, 'd_plant_a', '/atendimento', 'Plantonista A assume', format('SELECT public.iniciar_atendimento(%L::uuid)::text', v_ep));
  PERFORM e2e.d_passo('D11.00.soap_' || p_tag, 11, 'd_plant_a', '/atendimento', 'SOAP com CID ' || p_cid,
    format($q$SELECT public.registrar_soap(%L::uuid, %L, 'Sinais crus da triagem (teste D11)', 'Avaliação do teste D11', 'Alta com orientação', %L)::text$q$, v_ep, p_queixa || ' (teste D11)', p_cid));
  RETURN v_ep;
END $$;
CREATE OR REPLACE FUNCTION e2e.d11_alta(p_passo text, p_tag text) RETURNS text LANGUAGE sql AS $$
  SELECT e2e.d_dep('d11_ep_' || p_tag, 'D11.00.ficha_' || p_tag, p_passo, 11, 'd_plant_a', '/atendimento → AbaDesfecho', 'Alta do atendimento ' || p_tag,
    format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', NULL, '{}'::jsonb)::text$q$, e2e.d_v('d11_ep_' || p_tag)))
$$;

-- ── pré-condições: A (com CNS) e B (sem CNS, "outra pessoa"), os dois encerrados; alergia só em B ──
SELECT e2e.d11_atendimento('a1', 'd11_pac_a', 'd11_cad_a', false, 'Dor de garganta', 'J02.9');
SELECT e2e.d11_alta('D11.00.alta_a1', 'a1');
SELECT e2e.d_passo('D11.00.ficha_b_recusada', 11, 'd_rec', '/recepcao', 'Nova ficha com o mesmo nome e nascimento: a recepção é avisada da duplicidade provável',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor nas costas', NULL, %L::jsonb) ->> 'episodio_id')$q$, 'fd300000-0000-4000-8000-000000000011', e2e.d_v('d11_cad_b')),
  'erro:FICHA_DUPLICATA_PROVAVEL');
SELECT e2e.d11_atendimento('b1', 'd11_pac_b', 'd11_cad_b', true, 'Dor nas costas', 'M54.5');
SELECT e2e.d_dep('d11_pac_b', 'D11.00.ficha_b1', 'D11.00.alergia_b', 11, 'd_plant_a', '/atendimento (alergias)', 'Alergia a dipirona registrada no cadastro B',
  format($q$SELECT public.registrar_alergia(%L::uuid, 'Dipirona', 'urticária', 'medicamento', 'moderada', %L::uuid)::text$q$, e2e.d_v('d11_pac_b'), '00bc3daf-b7e5-4410-99d4-2c7301dd1922'));
SELECT e2e.d11_alta('D11.00.alta_b1', 'b1');

-- ── 1 a 4. candidatos, pedido e as recusas de segurança ─────────────────────
SELECT e2e.d_dep('d11_pac_b', 'D11.00.ficha_b1', 'D11.01.candidatos', 11, 'd_rec', '/cadastros-duplicados', 'O par A/B aparece entre os candidatos (nome + nascimento)',
  format($q$SELECT e2e.d_confere(public.candidatos_duplicados(%L::uuid)::text LIKE '%%' || %L || '%%' AND public.candidatos_duplicados(%L::uuid)::text LIKE '%%' || %L || '%%', 'par listado')$q$,
    'fd100000-0000-4000-8000-000000000001', e2e.d_v('d11_pac_a'), 'fd100000-0000-4000-8000-000000000001', e2e.d_v('d11_pac_b')));
SELECT e2e.d_dep('d11_pac_b', 'D11.00.ficha_b1', 'D11.02.pedir', 11, 'd_rec', '/cadastros-duplicados', 'Recepção pede a unificação: principal A, absorvido B',
  format($q$SELECT public.pedir_unificacao(%L::uuid, %L::uuid, 'mesma pessoa, cadastro repetido na porta', true)::text$q$, e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')), 'ok', 'd11_pedido');
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.03.recepcao_decide', 11, 'd_rec', '/cadastros-duplicados', 'Recepção tenta decidir o próprio pedido (deve ser recusado)',
  format('SELECT public.decidir_unificacao(%L::uuid, true, NULL, true)::text', e2e.d_v('d11_pedido')), 'erro');
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.04.alergia_so_em_b', 11, 'd_ges', '/cadastros-duplicados', 'Gestor aprova com a alergia ativa só em B (deve ser recusado)',
  format('SELECT public.decidir_unificacao(%L::uuid, true, NULL, true)::text', e2e.d_v('d11_pedido')), 'erro');
SELECT e2e.d_dep('d11_pac_a', 'D11.00.ficha_a1', 'D11.05.alergia_a', 11, 'd_plant_a', '/atendimento (alergias)', 'A mesma alergia registrada no cadastro A',
  format($q$SELECT public.registrar_alergia(%L::uuid, 'Dipirona', 'urticária', 'medicamento', 'moderada', %L::uuid)::text$q$, e2e.d_v('d11_pac_a'), '00bc3daf-b7e5-4410-99d4-2c7301dd1922'));

-- ── 6 e 7. atendimento aberto nos dois ──────────────────────────────────────
SELECT e2e.d_dep('d11_pac_a', 'D11.00.ficha_a1', 'D11.06.ficha_a', 11, 'd_rec', '/recepcao', 'Ficha aberta em A',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Retorno por dor de garganta', %L::uuid, '{}'::jsonb) ->> 'episodio_id')$q$, 'fd300000-0000-4000-8000-000000000011', e2e.d_v('d11_pac_a')), 'ok', 'd11_ep_a2');
SELECT e2e.d_dep('d11_pac_b', 'D11.00.ficha_b1', 'D11.06.ficha_b', 11, 'd_rec', '/recepcao', 'Ficha aberta em B',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Retorno por dor nas costas', %L::uuid, '{}'::jsonb) ->> 'episodio_id')$q$, 'fd300000-0000-4000-8000-000000000011', e2e.d_v('d11_pac_b')), 'ok', 'd11_ep_b2');
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.06.aberto_nos_dois', 11, 'd_ges', '/cadastros-duplicados', 'Gestor aprova com atendimento aberto nos dois (deve ser recusado)',
  format('SELECT public.decidir_unificacao(%L::uuid, true, NULL, true)::text', e2e.d_v('d11_pedido')), 'erro');
SELECT e2e.d_dep('d11_ep_a2', 'D11.06.ficha_a', 'D11.07.encerra_a', 11, 'd_rec', '/recepcao (retirar da fila)', 'Encerra a ficha de A (retirada da fila: evasão, justificativa ≥ 15)',
  format($q$SELECT public.retirar_da_fila(%L::uuid, 'evasao', 'Saiu antes da triagem (teste D11)')::text$q$, e2e.d_v('d11_ep_a2')));
SELECT e2e.d_dep('d11_ep_b2', 'D11.06.ficha_b', 'D11.07.encerra_b', 11, 'd_rec', '/recepcao (retirar da fila)', 'Encerra a ficha de B (ficha duplicada)',
  format($q$SELECT public.retirar_da_fila(%L::uuid, 'duplicada', 'Ficha aberta no cadastro duplicado (teste D11)')::text$q$, e2e.d_v('d11_ep_b2')));

-- ── 8 a 11. aprovação e o que aparece junto ─────────────────────────────────
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.08.aprovar', 11, 'd_ges', '/cadastros-duplicados', 'Gestor aprova a unificação',
  format('SELECT public.decidir_unificacao(%L::uuid, true, NULL, true)::text', e2e.d_v('d11_pedido')));
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.08.vinculo', 11, 'banco', NULL, 'B inativo apontando para A; família {A, B}; CNS de A mantido; nenhum registro clínico mudou de paciente; auditoria',
  format($q$SELECT e2e.d_confere(NOT b.ativo AND b.unificado_em = a.id AND ARRAY(SELECT private.familia_paciente(a.id)) @> ARRAY[a.id, b.id]
        AND (SELECT count(*) FROM public.episodios WHERE paciente_id = b.id) = 2,
      'B ativo ' || b.ativo || ', unificado_em ' || coalesce(b.unificado_em::text, 'nulo') || ', família ' || array_length(ARRAY(SELECT private.familia_paciente(a.id)), 1) || ', CNS de A ' || coalesce(right(a.cns, 4), '?'))
     FROM public.pacientes a, public.pacientes b WHERE a.id = %L AND b.id = %L$q$, e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')));
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.09.busca', 11, 'd_rec', '/recepcao', 'Busca por "Maria Teste Duplicada": só A é oferecido para ficha nova',
  format($q$SELECT e2e.d_confere(count(*) = 1 AND bool_and(x.id = %L::uuid), count(*) || ' cadastro(s) na busca') FROM public.buscar_pacientes(%L::uuid, %L) x$q$,
    e2e.d_v('d11_pac_a'), 'fd100000-0000-4000-8000-000000000001', e2e.d_v('d11_nome')));
SELECT e2e.d_dep('d11_pac_a', 'D11.00.ficha_a1', 'D11.10.atendimento_a', 11, 'banco', NULL, 'Novo atendimento de Maria (A): dor lombar',
  $q$SELECT 'segue'$q$);
SELECT e2e.d11_atendimento('a3', 'd11_pac_a', 'd11_cad_a', false, 'Dor lombar há 2 dias', 'M54.5');
SELECT e2e.d_dep('d11_ep_a3', 'D11.00.ficha_a3', 'D11.11.historico_familia', 11, 'd_plant_a', '/atendimento → HistoricoEncerrado', 'O histórico de A traz os encerrados de A e de B',
  format($q$SELECT e2e.d_confere(h::text LIKE '%%' || %L || '%%' AND h::text LIKE '%%' || %L || '%%', left(h::text, 250)) FROM (SELECT public.historico_encerrado(%L::uuid) h) x$q$,
    e2e.d_v('d11_ep_a1'), e2e.d_v('d11_ep_b1'), e2e.d_v('d11_pac_a')));
SELECT e2e.d_dep('d11_ep_a3', 'D11.00.ficha_a3', 'D11.11.cadastros', 11, 'd_plant_a', '/atendimento', 'cadastros_do_paciente(A) lista A e B',
  format($q$SELECT e2e.d_confere(public.cadastros_do_paciente(%L::uuid) @> ARRAY[%L::uuid, %L::uuid], array_length(public.cadastros_do_paciente(%L::uuid), 1) || ' cadastros')$q$,
    e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b'), e2e.d_v('d11_pac_a')));
SELECT e2e.d_dep('d11_pac_a', 'D11.00.ficha_a1', 'D11.12.peso', 11, 'd_plant_a', '/atendimento (Prescrição → peso)', 'Peso referido (valor cru) antes de prescrever',
  e2e.d_sinais(e2e.d_u('d11_pac_a'), '{"peso":64}', NULL, 'referido'));
SELECT e2e.d_dep('d11_ep_a3', 'D11.00.ficha_a3', 'D11.12.trava_alergia', 11, 'd_plant_a', '/atendimento (Prescrição)', 'Prescrever dipirona em A: a trava de alergia barra (dose = texto de teste)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.d_v('d11_pac_a'),
    jsonb_build_object('tipo', 'medicamento', 'medicamento_id', '00bc3daf-b7e5-4410-99d4-2c7301dd1922', 'dose', 'conforme protocolo — dado fictício de teste de fluxo',
                       'via', 'endovenosa', 'posologia', 'Agora')), 'erro:ALERGIA');

-- ── 13. pedido de acesso a B vale para a família ────────────────────────────
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.13.pedir_b', 11, 'd_med_obs', '/prontuarios', 'Médica da Observação D (fora do Pronto Socorro) pede acesso ao cadastro B',
  format($q$SELECT public.pedir_acesso_prontuario(%L::uuid, 'revisar atendimento anterior da paciente')::text$q$, e2e.d_v('d11_pac_b')), 'ok', 'd11_pedido_acesso');
SELECT e2e.d_dep('d11_pedido_acesso', 'D11.13.pedir_b', 'D11.13.aprovar', 11, 'd_ges', '/auditoria', 'Gestor aprova o pedido',
  format('SELECT (public.decidir_pedido_acesso(%L::uuid, true, NULL)).status', e2e.d_v('d11_pedido_acesso')));
SELECT e2e.d_dep('d11_pedido_acesso', 'D11.13.pedir_b', 'D11.13.abre_a_e_b', 11, 'd_med_obs', '/prontuarios/:pacienteId', 'O acesso vale para A e para B (a família)',
  format($q$SELECT (SELECT coalesce(public.abrir_prontuario(%L::uuid, NULL)::text, 'A aberto')) || '; ' || (SELECT coalesce(public.abrir_prontuario(%L::uuid, NULL)::text, 'B aberto'))$q$,
    e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')));

-- ── 14. desfazer ────────────────────────────────────────────────────────────
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.14.desfazer', 11, 'd_ges', '/cadastros-duplicados', 'Gestor desfaz: "cadastros de pessoas diferentes, erro da recepção"',
  format($q$SELECT public.desfazer_unificacao(%L::uuid, 'cadastros de pessoas diferentes, erro da recepção')::text$q$, e2e.d_v('d11_pedido')));
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.14.separados', 11, 'banco', NULL, 'B volta a ativo, sem unificado_em; a família volta a ser só A',
  format($q$SELECT e2e.d_confere(b.ativo AND b.unificado_em IS NULL AND NOT (ARRAY(SELECT private.familia_paciente(%L::uuid)) @> ARRAY[b.id]), 'B ativo ' || b.ativo) FROM public.pacientes b WHERE b.id = %L$q$,
    e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')));

-- ── 15 e 16. cancelar; gestor pede mas não aprova o próprio ─────────────────
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.15.pedir_de_novo', 11, 'd_rec', '/cadastros-duplicados', 'Recepção pede de novo',
  format($q$SELECT public.pedir_unificacao(%L::uuid, %L::uuid, 'pedido de teste para cancelar', true)::text$q$, e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')), 'ok', 'd11_pedido2');
SELECT e2e.d_dep('d11_pedido2', 'D11.15.pedir_de_novo', 'D11.15.cancelar', 11, 'd_rec', '/cadastros-duplicados', 'Recepção cancela o próprio pedido pendente',
  format('SELECT public.cancelar_unificacao(%L::uuid)::text', e2e.d_v('d11_pedido2')));
SELECT e2e.d_dep('d11_pedido', 'D11.02.pedir', 'D11.16.gestor_pede', 11, 'd_ges', '/cadastros-duplicados', 'Gestor pede a unificação',
  format($q$SELECT public.pedir_unificacao(%L::uuid, %L::uuid, 'pedido do gestor para teste', true)::text$q$, e2e.d_v('d11_pac_a'), e2e.d_v('d11_pac_b')), 'ok', 'd11_pedido3');
SELECT e2e.d_dep('d11_pedido3', 'D11.16.gestor_pede', 'D11.16.aprova_proprio', 11, 'd_ges', '/cadastros-duplicados', 'Gestor tenta aprovar o próprio pedido (deve ser recusado)',
  format('SELECT public.decidir_unificacao(%L::uuid, true, NULL, true)::text', e2e.d_v('d11_pedido3')), 'erro');
SELECT e2e.d_dep('d11_pedido3', 'D11.16.gestor_pede', 'D11.16.cancelar', 11, 'd_ges', '/cadastros-duplicados', 'Gestor cancela o próprio pedido (não fica pendente)',
  format('SELECT public.cancelar_unificacao(%L::uuid)::text', e2e.d_v('d11_pedido3')));

-- ── fim: o atendimento novo de A é encerrado ────────────────────────────────
SELECT e2e.d11_alta('D11.99.alta_a3', 'a3');
SELECT e2e.d_lacuna('D11.B1.bordas', 11, 'd_rec', 'Bordas: mãe + nascimento com e sem acento; CPF igual com nomes diferentes; dois absorvidos; SINAN com dados do principal',
  'Não exercitadas nesta rodada.');

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'D11.%' AND em >= now() GROUP BY 1;
