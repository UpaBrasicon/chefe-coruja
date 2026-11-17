# LG6, I1: comparativo de provedores de IA com processamento no Brasil (17/11/2026)

Decisão do RT de 17/11/2026, I1 = A: trocar o DeepSeek por um provedor que processe no Brasil, com contrato de operador e sem uso para treino, escolhido por comparativo (`docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md`).

**Não é parecer jurídico.**
- **Fontes:** páginas oficiais dos provedores, lidas em 17/11/2026 (lista no fim).
- **Preços:** sob demanda, em dólar por 1 milhão de tokens (entrada / saída).
- **Sem conta nenhuma:** nenhuma conta foi criada e nenhum modelo foi chamado.

## O que pesa na escolha

1. **A inferência fica no Brasil.** Não basta guardar o dado no Brasil: o processamento também precisa ficar aqui. Se ficar, não há transferência internacional, e o art. 33 deixa de ser problema. Isso é leitura técnica: o advogado confirma.
2. **Contrato de operador e sem treino:**
   - um DPA que cite a LGPD;
   - os dados não podem treinar o modelo.
3. **Mesma interface de hoje.** O Hermes e a biblioteca falam o formato `chat/completions` da OpenAI, com ferramentas (tool calling) e resposta em partes (streaming).
4. **Qualidade em português clínico,** medida com as avaliações da biblioteca (`biblioteca/evals`).
5. **Custo.**

## Os candidatos

### Amazon Bedrock, região São Paulo (`sa-east-1`)

| Item | O que as fontes dizem |
|---|---|
| Modelos que rodam **dentro** da região | DeepSeek V3.2; gpt-oss-120b e 20b; Qwen3 Next 80B, Qwen3 32B; Mistral Large 3 e menores; Kimi K2.5; GLM 4.7 e 5; MiniMax M2.x; Nemotron 3 Super; Gemma 3 |
| Processamento no Brasil | **Sim, com uma condição:** chamar o modelo pelo ID direto ("In-Region", "never leave the AWS Region"). O modo "Global" (prefixo `global.`) pode processar em qualquer região. Uma regra da conta (SCP) bloqueia o modo Global de vez |
| Contrato e treino | O dado não vai ao fabricante do modelo e não melhora o modelo base. O AWS DPA faz parte dos Termos de Serviço, e a página de privacidade do Brasil da AWS diz que ele atende à LGPD. Os modelos abertos não têm a guarda de 30 dias para abuso |
| Interface | Compatível com OpenAI (`chat/completions`); ferramentas e streaming conforme a ficha de cada modelo |
| Preço em `sa-east-1` (lista de 11/11/2026) | DeepSeek V3.2: 0,74 / 2,22. Qwen3 Next 80B: 0,17 / 1,44. Mistral Large 3: 0,61 / 1,82. gpt-oss-120b: 0,18 / 0,73 |

### Maritaca AI (Sabiá), empresa brasileira

| Item | O que as fontes dizem |
|---|---|
| Modelos no Brasil | Só as versões `-br-sp`: `sabia-4-br-sp`, `sabiazinho-4-br-sp` e `sabia-4-thinking-br-sp` |
| Processamento no Brasil | **Sim, nas versões `-br-sp`:** "inferência inteiramente em infraestrutura localizada no Brasil", data center em São Paulo, com logs também no Brasil. As versões sem `-br-sp` podem rodar fora do país |
| Contrato e treino | Os dados da API nunca treinam o modelo, e o conteúdo é descartado depois da resposta. Logs de erro com conteúdo ficam até 30 dias. O DPA vem nos termos, com a lista de suboperadores |
| Interface | Compatível com OpenAI, com ferramentas (exemplo com `sabia-4`). **Não confirmado:** streaming na documentação e ferramentas nas versões `-br-sp` |
| Preço (em reais; a `-br-sp` custa 30% a mais) | Sabiá 4 br-sp: R$ 6,50 / 26,00, cerca de US$ 1,26 / 5,06. Sabiazinho 4 br-sp: R$ 1,30 / 5,20 |

### Os que não servem hoje

- **Azure OpenAI, região Brazil South.**
  - Nenhum modelo de conversa no pagamento por uso regional.
  - Só existe a capacidade reservada (PTU), cara para o volume de hoje, com o gpt-4.1 e o gpt-4o.
  - As opções "Global" e "Data Zone" processam fora; a Data Zone só existe nos EUA e na UE.
- **Google Vertex AI, região São Paulo.** Só o Gemini 2.5 Flash tinha processamento garantido na região, e a página diz que ele sai de linha em 20/10/2026.

## Custo estimado do mês

Premissa: 300 perguntas por dia, ou 9.000 por mês, cada uma com 3.000 tokens de entrada (pergunta e trechos) e 600 de saída. As perguntas da Corujinha entram no mesmo bolo.

| Opção | Custo por pergunta | Mês (9.000 perguntas) |
|---|---|---|
| DeepSeek (hoje, China) | US$ 0,0016 | cerca de US$ 14 |
| Bedrock, Qwen3 Next 80B | US$ 0,0014 | cerca de US$ 13 |
| Bedrock, DeepSeek V3.2 | US$ 0,0036 | cerca de US$ 32 |
| Bedrock, Mistral Large 3 | US$ 0,0029 | cerca de US$ 27 |
| Maritaca, Sabiá 4 br-sp | US$ 0,0068 | cerca de US$ 61 |

O custo real sai do painel de custo do admin (E6) depois da troca.

## Decisões para o RT

**P1. Provedor**
- **A (recomendada):** Amazon Bedrock em `sa-east-1`, só com modelos In-Region e o modo Global bloqueado por regra da conta.
  - Tem mais de um modelo para escolher, e o contrato da AWS já cita a LGPD.
  - Já usamos a AWS no cofre da guarda.
- **B:** Maritaca (Sabiá 4 br-sp).
  - Empresa e infraestrutura brasileiras, com modelo treinado em português.
  - É a mais cara, e o streaming e as ferramentas na versão `br-sp` ainda precisam ser confirmados.

**P2. Modelo (se P1 = A)**
- **A (recomendada):** decidir pelas avaliações.
  - Rodar as perguntas de avaliação da biblioteca com o DeepSeek V3.2 (a mesma família de hoje), o Qwen3 Next 80B e o Mistral Large 3, na biblioteca da homologação.
  - Fica o de melhor nota. No empate, o mais barato.
  - O resultado volta para o RT antes da produção.
- **B:** DeepSeek V3.2 direto. É o mais parecido com o de hoje, mas custa mais que o dobro.

**P3. Conta da AWS**
- **A (recomendada):** conta nova, separada da conta do cofre (Chefe-coruja-backup), dentro de uma organização.
  - Regras da conta: só `sa-east-1`, sem perfis `global.`, e só Bedrock.
  - A chave fica só no VPS. A conta do cofre fica isolada, como hoje.
- **B:** usar a conta do cofre. Menos trabalho, mas mistura a guarda de 20 anos com a IA.

## O que o RT precisa fazer (com P1 a P3 = A)

1. Criar a conta nova da AWS e a organização; a sessão manda o passo a passo.
2. Liberar o acesso aos três modelos no Bedrock (`sa-east-1`).
3. Criar o usuário da API, com a chave posta direto no VPS. A sessão não lê a chave.

Depois disso, a sessão:
- roda as avaliações na homologação e traz o resultado;
- com a escolha do RT e o "ok produção", troca o provedor no Hermes e na biblioteca, mantendo o gateway e o NER;
- atualiza o LG1 e o LG3 com o suboperador novo.

## Fontes (lidas em 17/11/2026)

**AWS**
- Regiões dos modelos: https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.md
- Modo Global: https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html
- Proteção de dados: https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
- Abuso: https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html
- Preços: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/sa-east-1/index.json
- Privacidade no Brasil: https://aws.amazon.com/compliance/brazil-data-privacy/

**Maritaca**
- https://www.maritaca.ai/en/blog/inferencia-no-brasil/
- https://www.maritaca.ai/en/pricing
- https://www.maritaca.ai/en/data-processing
- https://www.maritaca.ai/en/terms

**Azure**
- https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability

**Google**
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash

**ANPD**
- Resolução CD/ANPD 19/2024, de 23/08/2024: https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-19-de-23-de-agosto-de-2024-58009539
- Resolução CD/ANPD 32/2026, adequação da União Europeia: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/resolucao-no-32-decisao-de-adequacao-uniao-europeia-em-lingua-inglesa.pdf

**DeepSeek**
- Política de privacidade de 10/02/2026, que diz que os dados ficam na China e que podem treinar o modelo: https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html
