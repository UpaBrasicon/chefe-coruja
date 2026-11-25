-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 7: caminhos errados que precisam de preparo próprio.
-- Tudo desfeito (nada fica gravado além do resultado em e2e.resultados):
-- fora do plantão (check-out feito), regulador sem papel na central, técnico
-- ou médico abrindo ficha, isolamento do pedido menor que a marca do paciente.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;
CREATE FUNCTION e2e.fb_ler(p_sql text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE r text; BEGIN EXECUTE p_sql INTO r; RETURN r; END $$;
CREATE FUNCTION e2e.fb_seq(p_sql text, p_ler text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE p_sql; RETURN e2e.fb_ler(p_ler); END $$;
GRANT EXECUTE ON FUNCTION e2e.fb_ler(text), e2e.fb_seq(text, text) TO authenticated;

-- fora do plantão: a pessoa fez o check-out dos plantões de hoje
CREATE TEMP TABLE _fora ON COMMIT DROP AS
SELECT format($q$UPDATE public.presenca_plantonista SET checkout_em = now() - interval '1 minute', checkout_automatico = false WHERE perfil_id = e2e.fb_login() AND unidade_id = %L AND data = DATE '2026-11-25'$q$, e2e.fb_upa()) AS sql;
INSERT INTO _r (txt)
SELECT e2e.fb(x.n, 'FB.15.fora_do_plantao_' || x.passo, x.papel, 'Fora do plantão (check-out feito): ' || x.descricao, x.sql, x.esperado, NULL, true, NULL, (SELECT sql FROM _fora))
  FROM (VALUES
    (1, 9, 'ficha', 'rec', 'recepção abre ficha', format($q$SELECT public.registrar_ficha(%L::uuid, 'Dor de cabeça', NULL, '{"nome":"Teste Fluxo B fora do plantão","data_nascimento":"1990-01-01","sexo":"F"}'::jsonb)::text$q$, '32000000-0000-4000-8000-000000000001'), 'erro:não está de plantão'),
    (2, 9, 'exames', 'med', 'médico pede exames no leito', format($q$SELECT public.pedir_exames_internacao(%L::uuid, '[{"procedimento":"0202010473"}]'::jsonb, 'laboratorio', 'rotina', NULL)::text$q$, e2e.fbu(9, 'int')), 'erro:o pedido de exames é do médico de plantão'),
    (3, 9, 'prescricao', 'med', 'médico prescreve', format($q$SELECT public.prescrever(%L::uuid, '{"tipo":"cuidado","descricao":"Cuidado fora do plantão (teste)"}'::jsonb)::text$q$, e2e.fbu(9, 'pac')), 'erro:A prescrição é do médico de plantão'),
    (4, 9, 'alterado', 'med', 'médico marca "alterado"', format('SELECT public.marcar_resultado_alterado(%L::uuid, false)::text', (SELECT ep.id FROM public.exames_pedidos ep WHERE ep.internacao_id = e2e.fbu(9, 'int') AND ep.procedimento = '0202010600')), 'erro:quem marca o resultado como alterado'),
    (5, 9, 'nir_painel', 'nir', 'NIR abre o painel', format('SELECT left(public.nir_pendencias(%L::uuid)::text, 60)', e2e.fb_upa()), 'erro:Fora do plantão'),
    (6, 9, 'nir_mapa', 'nir', 'NIR abre o mapa de leitos (registro)', format('SELECT left(public.nir_mapa_leitos(%L::uuid)::text, 60)', e2e.fb_upa()), 'registrar'),
    (7, 9, 'nir_pendencia_unidade', 'nir', 'NIR cria pendência da unidade (registro)', format($q$SELECT public.regulacao_pendencia_unidade_criar(%L::uuid, 'outro', 'Pendência criada fora do plantão (teste)', 'normal', NULL, 'nir')::text$q$, e2e.fbu(9, 'reg')), 'registrar'),
    (8, 9, 'nir_evolucao', 'nir', 'NIR atualiza a evolução do pedido (registro)', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução escrita fora do plantão (teste)', NULL)::text$q$, e2e.fbu(9, 'reg')), 'registrar'),
    (9, 9, 'medico_evolucao_pedido', 'med', 'médico atualiza a evolução do pedido de regulação (registro)', format($q$SELECT public.regulacao_atualizar_evolucao(%L::uuid, 'Evolução escrita fora do plantão (teste)', NULL)::text$q$, e2e.fbu(9, 'reg')), 'registrar'),
    (10, 10, 'medico_pede_vaga', 'med', 'médico abre pedido de regulação (registro)', format($q$SELECT left(public.regulacao_solicitar(%L::uuid, %L::uuid, '{"tipo":"leito","tipo_leito":"clinico","procedimento":"0303010037","cid":"A41.9","carater":"urgencia","prioridade":"urgencia","destino_tipo":"a_definir","quadro_clinico":"Pedido aberto fora do plantão (teste de fluxo)."}'::jsonb)::text, 80)$q$, e2e.fb_upa(), e2e.fbu(10, 'pac')), 'registrar'),
    (11, 9, 'documento_transferencia', 'med', 'médico emite documento de transferência', format($q$SELECT public.emitir_documento_transferencia(%L::uuid, '{"resumo_clinico":"Resumo clínico fora do plantão (teste)","condutas":"Condutas de teste","motivo":"Motivo de teste fora do plantão"}'::jsonb)::text$q$, e2e.fbu(9, 'pac')), 'erro:fora dos setores do seu plantão'),
    (12, 9, 'triagem_lista', 'enf', 'enfermeiro marca isolamento', format($q$SELECT public.marcar_isolamento(%L::uuid, 'contato', 'teste fora do plantão')::text$q$, e2e.fbu(9, 'pac')), 'erro')
  ) x(o, n, passo, papel, descricao, sql, esperado) ORDER BY x.o;

-- regulador sem papel na central (só tem "regulador" na UPA)
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.15.regulador_sem_central_' || x.passo, 'regupa', 'Regulador com papel só na UPA: ' || x.descricao, x.sql, x.esperado, NULL, true)
  FROM (VALUES
    (1, 'fila', 'lê a fila da central', format($q$SELECT left(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text, 60)$q$, e2e.fb_central()), 'erro:Acesso negado'),
    (2, 'autoriza', 'autoriza pedido', format($q$SELECT public.regulacao_autorizar(%L::uuid, 'externo', NULL, 'Hospital de fora', NULL, NULL, NULL)::text$q$, e2e.fbu(9, 'reg')), 'erro:Quem decide é o médico regulador da central'),
    (3, 'detalhe', 'abre o detalhe de um pedido da própria UPA (registro)', format('SELECT left(public.regulacao_detalhe(%L::uuid)::text, 60)', e2e.fbu(9, 'reg')), 'registrar'),
    (4, 'lista_upa', 'lê a lista de regulação da UPA (registro)', format('SELECT left(public.regulacao_lista(%L::uuid)::text, 60)', e2e.fb_upa()), 'registrar'),
    (5, 'conversa', 'escreve na conversa do pedido (registro)', format($q$SELECT public.regulacao_conversa_enviar(%L::uuid, 'Mensagem do regulador sem central', 'mensagem')::text$q$, e2e.fbu(9, 'reg')), 'registrar')
  ) x(o, passo, descricao, sql, esperado) ORDER BY x.o;

-- quem abre ficha (sem a marca de super admin do login)
INSERT INTO _r (txt)
SELECT e2e.fb(0, 'FB.15.ficha_por_' || x.papel, x.papel, 'Quem abre ficha na porta: ' || x.papel || ' escalado no Pronto Socorro (registro)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor de cabeça', NULL, %L::jsonb) ->> 'etapa')$q$, '32000000-0000-4000-8000-000000000001',
    jsonb_build_object('nome', 'Teste Fluxo B ficha por ' || x.papel, 'data_nascimento', '1990-01-01', 'sexo', 'F')), 'registrar', NULL, true)
  FROM (VALUES ('tec'), ('enf'), ('med'), ('far'), ('nir')) x(papel);

-- isolamento do pedido menor que a marca do paciente (B09 está marcado em gotícula)
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.15.isolamento_menor_que_a_marca_' || coalesce(x.tipo, 'nenhum'), 'med', 'Paciente marcado em gotícula, pedido novo com isolamento "' || coalesce(x.tipo, 'nenhum') || '": o que fica gravado (registro)',
  format('SELECT e2e.fb_seq(%L, %L)', format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)$q$, e2e.fb_upa(), e2e.fbu(9, 'pac'),
      jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303140046', 'cid', 'J44.1', 'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir',
        'quadro_clinico', 'Segundo pedido de teste para conferir o isolamento gravado.', 'isolamento', x.tipo IS NOT NULL, 'isolamento_tipo', x.tipo)),
    format($q$SELECT 'gravado: ' || coalesce(s.isolamento_tipo, 'sem isolamento') FROM public.regulacao_solicitacoes s WHERE s.paciente_id = %L ORDER BY s.criada_em DESC LIMIT 1$q$, e2e.fbu(9, 'pac'))),
  'registrar', NULL, true)
  FROM (VALUES ('contato'), ('reverso'), ('contato_aerossol'), ('aerossol'), (NULL)) x(tipo);

DROP FUNCTION e2e.fb_seq(text, text);
DROP FUNCTION e2e.fb_ler(text);
SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
