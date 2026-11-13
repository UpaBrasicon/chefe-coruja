# E4: confiança em três níveis e identificador do trecho

Trilha Hermes / Evidências, tarefa 4. Decisão do RT de 12/11/2026: E4 = A (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`).

## O que mudou

**Biblioteca** (`biblioteca/app/main.py`)
- Cada fonte da resposta traz `trecho_id` (o id do trecho no Qdrant), `fonte_id` e `acima_do_corte`.
- O `meta` do `/v1/ask` e o `/v1/search` trazem `confianca`, calculada sobre os trechos enviados ao modelo:
  - **alta**: dois ou mais trechos de fontes diferentes acima do corte;
  - **moderada**: acima do corte, mas de uma fonte só;
  - **baixa**: abaixo do corte, e aí a IA não responde.
- O corte é o mesmo do gate: 0,50 com palavra em comum e 0,58 sem.

**Tela** (`RespostaIa`, `src/lib/respostaIa.ts`)
- No primeiro teste, a confiança calculada sobre os trechos enviados saiu "alta" em quase tudo, até na resposta que dizia que o material não trazia a conduta. Por isso, a tela recalcula o nível só com as fontes que a resposta cita (`confiancaDasCitadas`): duas ou mais fontes diferentes citadas acima do corte é alta; uma, moderada.
- Em resposta antiga guardada em cache, sem os campos novos, fica o nível da biblioteca.
- Depois da resposta aparece uma linha:
  - "Confiança alta: mais de uma fonte do material trata do assunto.";
  - "Confiança moderada: só uma fonte do material trata do assunto. Confira na fonte antes de seguir."
- Na resposta "Não encontrei", nada aparece.

O aviso de fontes que divergem ficou para depois, porque pede uma segunda leitura pelo modelo.

## Testes

- `biblioteca/app/test_confianca.py`: 7 casos, rodados dentro do container da homologação.
- `src/lib/respostaIa.test.ts`: `textoConfianca` e `confiancaDasCitadas`.

## Homologação (13/11/2026)

- Biblioteca da branch no container `biblioteca-api-homolog`. Tela publicada na homologação (commit `21a411c7` da branch `homolog`, Vercel pronto).
- Evals com o primeiro código do E4: os mesmos números do E3b, com todas as metas atingidas e as mesmas 3 reprovadas, que já falhavam na produção. O ajuste das fontes citadas não mexe na busca nem na resposta, só acrescenta campos.
- Pela Edge, com a sessão da conta de teste `medico.observacao.f5`:

| Pergunta | Fontes citadas | Nível na tela |
|---|---|---|
| conduta na FA com instabilidade hemodinâmica | [2] da Central e [6] do HCFMUSP | alta |
| conduta na crise de asma grave no adulto | [1], [2] e [3], todas da mesma ficha da Central | moderada |
| tratamento da cetoacidose diabética no adulto | resposta "Não encontrei" | nenhum |

- Todos os trechos devolvidos passaram do corte. Na prática, o nível mostra quantas fontes diferentes a resposta usa.
- **A tela não foi vista com login.** As contas de teste estão fora do plantão ou sem check-in, e a Central fica fechada para elas. A lógica que decide o texto tem teste.
