# Regras de Ouro — Encoding de Arquivos (OBRIGATÓRIO)

Este projeto contém **texto em português com acentos** em todos os arquivos
(`.ts`, `.tsx`, `.sql`, `.md`). Qualquer erro de encoding corrompe o código e
quebra o app (símbolos como `Ã£`, `â€“`, `�`).

## REGRA Nº 1 — NUNCA use PowerShell para ler/escrever arquivos do projeto

O PowerShell 5.1 (shell padrão deste Windows) lê/grava arquivos como
**Windows-1252** por padrão. Usar `Get-Content` / `Set-Content` / `Add-Content`
/ `Out-File` em arquivos com acento causa **dupla codificação** (UTF-8 → 1252 →
UTF-8) e corrompe o arquivo permanentemente.

**PROIBIDO:**
- `Set-Content`, `Add-Content`, `Out-File`, `Get-Content` (sem `-Encoding`)
- Qualquer edição de arquivo via shell PowerShell

**PERMITIDO (use sempre estes):**
- Ferramentas `Edit` / `Write` / `Read` do opencode (preservam UTF-8)
- `node -e "..."` ou scripts `.cjs` com `fs.readFileSync/writeFileSync`
  (`fs` grava UTF-8 sem BOM corretamente)

## REGRA Nº 2 — Confirme a codificação antes de reescrever um arquivo

Se precisar manipular arquivos em massa via script, **use Node**, nunca
PowerShell. Verificação rápida de corrupção (rodar via Node):

```bash
node -e "const s=require('fs').readFileSync('src/pages/Escala.tsx','utf8');
console.log('U+FFFD:', s.includes('\uFFFD'));
console.log('ManhÃ£:', s.includes('ManhÃ£'));"
```

## REGRA Nº 3 — Se o app ficar com tela branca ou símbolos estranhos

1. Checar o arquivo com a verificação da Regra 2.
2. Se corrompido, NÃO reescrever com PowerShell. Reverter a dupla codificação
   com Node (decodificar UTF-8 → re-codificar cp1252 → decodificar UTF-8) ou
   restaurar do git (`git checkout -- <arquivo>`).
3. Reiniciar o dev server (`node_modules` HMR trava com arquivos editados via
   shell): encerrar processos `node` e subir `npm run dev` de novo.

## REGRA Nº 4 — Git e encoding

- `git checkout -- <arquivo>` restaura a última versão commitada (UTF-8 bom).
- Se o commit já contém corrupção, corrigir o arquivo e commitar a correção.
- Nunca commitar arquivos com BOM duplicado ou U+FFFD.
