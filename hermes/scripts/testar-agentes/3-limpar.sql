begin;
delete from public.cerbero_incidentes
 where detectado_em > now() - interval '2 hours'
   and (evidencia->>'observacao_id' in (select id::text from public.observacao where aparelho_id = 'GATILHO-HERMES')
        or evidencia->>'phone' = '5500000000000');
delete from public.observacao where aparelho_id = 'GATILHO-HERMES';
delete from public.hermes_audit_log where tool_name = 'GATILHO-HERMES';
commit;
select json_build_object(
  'obs', (select count(*) from public.observacao where aparelho_id = 'GATILHO-HERMES'),
  'audit', (select count(*) from public.hermes_audit_log where tool_name = 'GATILHO-HERMES'),
  'incidentes_novos', (select count(*) from public.cerbero_incidentes where detectado_em > now() - interval '2 hours'),
  'incidentes_total', (select count(*) from public.cerbero_incidentes));
