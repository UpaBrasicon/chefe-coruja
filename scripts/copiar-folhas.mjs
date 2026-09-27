// Copia o modelo único das folhas (src/lib/folhas.ts) para a edge function.
// Rode antes de publicar a função `folha`:  npm run folhas:copiar
// O teste src/lib/folhas.test.ts falha se as duas cópias divergirem.
import { readFileSync, writeFileSync } from 'node:fs'

const origem = readFileSync('src/lib/folhas.ts', 'utf8')
const aviso = '// GERADO por scripts/copiar-folhas.mjs a partir de src/lib/folhas.ts — não edite aqui.\n'
writeFileSync('supabase/functions/_shared/folhas.ts', aviso + origem)
console.log('supabase/functions/_shared/folhas.ts atualizado')
