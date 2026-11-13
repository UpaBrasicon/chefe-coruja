# E6: modelo, tokens e custo do mês da busca clínica

Trilha Hermes / Evidências, tarefa 6. A decisão do RT de 12/11/2026 foi E6 = A (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`):
- o relatório semanal fica no Hermes, como está;
- a busca clínica passa a guardar o modelo e os tokens de cada pergunta;
- o painel do admin mostra o custo do mês.

## O que mudou

**Banco** (migration `20270413000001_custo_busca_ia.sql`, expand puro, rollback no cabeçalho)
- `clinical_search_logs` ganha `modelo`, `tokens_entrada_cache`, `tokens_entrada` e `tokens_saida`. São opcionais: as linhas antigas e as bloqueadas ficam sem.
- `private.ia_preco_modelo` guarda o preço por 1 milhão de tokens no horário de pico, com a data em que passou a valer e a fonte. Na mudança de preço entra uma linha nova, e o passado continua com o preço antigo.
- O preço veio da página oficial da DeepSeek, conferida em 13/11/2026 (US$ por 1 milhão de tokens, pico; fora do pico a DeepSeek cobra metade):

| Modelo | Entrada no cache | Entrada | Saída |
|---|---|---|---|
| `deepseek-flash` | 0,006 | 0,30 | 1,20 |
| `deepseek-v4-flash` (nome antigo, cobrado como Flash) | 0,006 | 0,30 | 1,20 |
| `deepseek-v4-pro` | 0,044 | 1,32 | 3,96 |

- `private.ia_hora_de_pico`: o pico da DeepSeek vai de segunda a sexta, das 01:00 às 04:00 e das 06:00 às 10:00 UTC. Os feriados chineses, que também ficam fora do pico, não entram, então o custo sai um pouco acima nesses dias, nunca abaixo.
- `public.ia_custo_busca_mes(date)` devolve as perguntas ao modelo, os tokens e o custo estimado do mês. Só o super admin vê; os outros recebem 42501.

**Biblioteca** (`main.py`)
- Pede o uso ao modelo (`stream_options.include_usage`) e soma o uso da reescrita com o da resposta.
- No fim do stream manda a linha `{"type":"uso", modelo, entrada_cache, entrada, saida}`, que fica fora da memória de respostas.
- Quando a resposta vem da memória, só a reescrita conta.

**Edge `clinical-search`** (`uso.ts`)
- Tira a linha de uso do stream, que não chega à tela, e grava os números na linha da pergunta.

**Tela** (Servidores, `src/lib/custoIa.ts`)
- Linha "IA da busca clínica", com o custo do mês em dólar, as perguntas e os tokens.
- Para quem não é super admin, a linha não aparece.

## Testes

- `supabase/tests/e6_custo_busca_ia.sql`:
  - pico e fora do pico;
  - custo de 1,506 + 0,753 USD;
  - pergunta sem tokens fica à parte;
  - busca simples não conta;
  - 42501 para quem não é super admin;
  - privilégios.
  Passou na homologação. O rollback foi testado numa transação desfeita.
- `supabase/functions/clinical-search/uso.test.ts`, no CI: linha de uso, linha malformada e linha cortada entre pedaços do stream.
- `biblioteca/app/test_uso.py`: soma da reescrita com a resposta, rodada no container da homologação junto com `test_confianca.py` (11 casos).
- `src/lib/custoIa.test.ts`: o texto da linha da tela.

## Homologação (13/11/2026)

- Migration aplicada pelo `db push`, só ela pendente.
- Edge e biblioteca publicadas. A tela foi publicada na branch `homolog`, que ganhou também o `liberar.ts` do E2: a branch não o tinha, porque a Edge do E2 foi publicada direto pelo CLI.
- **Na primeira publicação a Edge não subiu** (`Identifier 'corpo' has already been declared`): o nome novo repetia o do corpo da requisição. O lint e o teste não pegaram, porque o `index.ts` da Edge não passa pelo verificador de tipos. A variável foi renomeada e a Edge republicada.
- Três perguntas com a conta de teste `medico.observacao.f5` gravaram o modelo `deepseek-flash` e os tokens: 3.072, 352 e 606; 3.584, 329 e 82; 2.816, 439 e 239.
- `ia_custo_busca_mes()` como super admin, numa transação desfeita:
  - 16 perguntas ao modelo em novembro, 13 delas sem tokens, porque são de antes do E6 ou bloqueadas;
  - US$ 0,0008 estimados.

## Fica de fora

- O custo do Hermes e dos agentes Nous (Corujinha, Clínica, Gestora). Eles usam o mesmo modelo, mas pelo gateway do Hermes, e o E6 cobre só a busca clínica.
- O modelo configurado na biblioteca é `deepseek-v4-flash`, nome que a DeepSeek aposentou. Ela ainda aceita esse nome e responde com o `deepseek-flash`. Trocar `DEEPSEEK_MODEL` no VPS é decisão à parte.
