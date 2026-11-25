-- Teste de fluxo B, decisão do RT de 25/11 (B-02): a folha do pedido de exames sai sem indicação clínica.
-- Roda em transação desfeita (ver 205 para _r, e2e.fb_ler e e2e.fb_seq).
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.23.imprimir_sem_indicacao', 'med', 'B-02: imprimir pedido de exames sem indicação clínica: agora emite',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', %L) ->> 'numero')$q$, e2e.fbu(9, 'pac'),
    '{"pedido":{"itens":["Creatinina","Ureia"],"folhas":[{"titulo":"","documento":"Solicitação de exames","grupos":[{"nome":"Laboratório","itens":["Creatinina","Ureia"]}]}],"carater":"Rotina","indicacao":"","cid":"","obs_pedido":"","itens_n":2}}'),
  'ok', NULL, true);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.23.imprimir_sem_itens', 'med', 'B-02: pedido sem nenhum exame segue recusado',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', '{"pedido":{"itens":[],"folhas":[],"carater":"Rotina","indicacao":"","cid":""}}') ->> 'numero')$q$, e2e.fbu(9, 'pac')),
  'erro:Marcar ao menos um exame', NULL, true);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.23.imprimir_cid_errado', 'med', 'B-02: CID fora do formato segue recusado',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', '{"pedido":{"itens":["Ureia"],"carater":"Rotina","indicacao":"","cid":"XX"}}') ->> 'numero')$q$, e2e.fbu(9, 'pac')),
  'erro:CID-10 fora do formato', NULL, true);
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.23.imprimir_enfermeiro', 'enf', 'B-02: enfermeiro tenta emitir pedido de exames do leito (registro do que o servidor faz)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'pedido_exames', '{"pedido":{"itens":["Ureia"],"carater":"Rotina","indicacao":"","cid":""}}') ->> 'numero')$q$, e2e.fbu(9, 'pac')),
  'registrar', NULL, true);
