// Gera supabase/dados/protocolo_aparecida_2025.sql a partir do arquivo do
// protótipo (data/protocolo-classificacao.js). O texto dos discriminadores é o
// do documento da SMS de Aparecida de Goiânia (2025); aqui só muda de formato.
// Uso: node scripts/gerar-protocolo-sql.mjs <caminho do protocolo-classificacao.js>
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const origem = process.argv[2]
if (!origem) throw new Error('Informe o caminho de protocolo-classificacao.js')
const ctx = { window: {} }
vm.runInNewContext(readFileSync(origem, 'utf8'), ctx)
const p = ctx.window.PROTOCOLO_CR
if (!p?.fluxos?.length) throw new Error('PROTOCOLO_CR vazio')

const q = (t) => (t == null ? 'NULL' : `'${String(t).replace(/'/g, "''")}'`)
const cores = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const linhas = p.fluxos.map((f, i) => {
  const disc = Object.fromEntries(cores.filter((c) => f.cores?.[c]?.length).map((c) => [c, f.cores[c]]))
  return `  (${i + 1}, ${q(f.nome)}, ${q(f.publico === 'pediatria' ? 'pediatrico' : f.publico)}, ${q(f.inclui || null)}, ${q(JSON.stringify(disc))}::jsonb)`
})

const sql = `-- Protocolo de Classificação de Risco · SMS Aparecida de Goiânia · 2025.
-- GERADO por scripts/gerar-protocolo-sql.mjs — não editar à mão.
-- Carga idempotente: substitui os fluxogramas deste protocolo.
BEGIN;
INSERT INTO public.protocolos_classificacao (codigo, fonte)
VALUES ('sms-aparecida-2025', ${q(p.fonte)})
ON CONFLICT (codigo) DO UPDATE SET fonte = EXCLUDED.fonte;

DELETE FROM public.protocolo_fluxogramas
 WHERE protocolo_id = (SELECT id FROM public.protocolos_classificacao WHERE codigo = 'sms-aparecida-2025');

INSERT INTO public.protocolo_fluxogramas (protocolo_id, ordem, nome, publico, inclui, discriminadores)
SELECT (SELECT id FROM public.protocolos_classificacao WHERE codigo = 'sms-aparecida-2025'), v.*
FROM (VALUES
${linhas.join(',\n')}
) AS v(ordem, nome, publico, inclui, discriminadores);

-- unidades sem protocolo passam a usar este
UPDATE public.unidades SET protocolo_classificacao_id = (SELECT id FROM public.protocolos_classificacao WHERE codigo = 'sms-aparecida-2025')
 WHERE protocolo_classificacao_id IS NULL;
COMMIT;
`
writeFileSync('supabase/dados/protocolo_aparecida_2025.sql', sql)
const n = (pub) => p.fluxos.filter((f) => f.publico === pub).length
console.log(`ok: ${p.fluxos.length} fluxogramas (adulto ${n('adulto')}, pediatria ${n('pediatria') + n('pediatrico')})`)
