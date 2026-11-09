# Item 05 — Paginar listas que crescem

Trilha de desempenho (kit de 31 passos). **Decisão do RT em 09/11/2026: A** — telas clínicas por janela de tempo (internação atual ou últimas 48 h, com "ver mais"); listas administrativas em páginas de 20 a 50, com "ver mais".

A auditoria (seção 3.2) achou 19 leituras sem limite. O item vai em partes, um PR por parte.

## 05a — telas clínicas que leem tabelas direto (sem migration)

| Leitura | Antes | Depois |
|---|---|---|
| Passagens de plantão do leito (`LeitoAberto.tsx`) | todas da internação | as 20 mais recentes. O bloco da tela usa só a pendente e a última, então não precisa de "ver mais" |
| Trilha do episódio: eventos ADT (`caderno/Trilha.tsx`) | todos da vida do paciente | os 50 mais recentes, em ordem do mais antigo para o mais novo, com "Ver eventos mais antigos" (mais 50 por vez); o resumo diz "últimos N eventos" quando há mais |
| Trilha do episódio: transferências | todas da vida do paciente | as 20 mais recentes, com "Ver transferências mais antigas" |

Conferidas e já na janela da decisão (internação atual), sem mudança: a série de sinais vitais (`getSeriesObservacao`, lida por internação), o painel de sinais (`getPainelInternacao`) e as pendências do leito.

Teste: `src/lib/janelasClinicas.test.ts` (as três leituras com limite e os botões de "ver mais"), falha no master.

## 05b — AIH e APAC da unidade em páginas (migration `20270320000003`)

- Migration `20270320000003_paginas_listas.sql` (só cria): `aihs_da_unidade_pagina` e `apacs_da_unidade_pagina`, irmãs das RPCs de lista, que devolvem `{total, itens}` só com a página pedida (`p_limite`, padrão 50, máximo 200; `p_deslocamento`). Chamam a original (`SECURITY INVOKER`): mesma regra de acesso, mesma ordem; quem chama a original não muda. Rollback: dois `DROP FUNCTION` (no cabeçalho), testado na homologação.
- Telas de AIH e APAC: páginas de 50 com "Ver mais" (`src/components/ui/ver-mais.tsx`, mostra "N de total"); a página volta a 50 ao trocar de aba. A AIH ainda se atualiza a cada minuto, agora só com a página aberta.
- Limite conhecido: o servidor ainda monta a lista inteira; o ganho é na rede e na tela. Paginar dentro da consulta fica para quando os números do item 30 pedirem.
- Homologação (09/11/2026, transação desfeita, dados reais da UPA Fase 5): páginas de 2 da AIH iguais à lista original; APAC igual; limite 0 vira 1, limite 999 vira o total, deslocamento negativo vira 0; `anon` sem execução. Depois, aplicada com a versão registrada.
- Testes: `supabase/tests/desempenho_05b_paginas.sql` (permissões, mesma recusa da original, padrão 50 e teto 200) e `src/lib/paginasAdministrativas.test.ts` (as telas leem em páginas e têm "Ver mais").

**Ficam inteiras, de propósito:** avaliações e intercorrências do paciente (a tela calcula a última de cada escala, a curva de crescimento, a versão vigente e as retificações a partir da lista toda) e os painéis do Hiperdia e da puericultura (indicadores e filtros do programa inteiro calculados na tela). Paginar mudaria o que a tela mostra; o certo é levar esses cálculos ao servidor, num passo próprio.

## Listas restantes (conferidas em 09/11/2026)

Cada leitura foi conferida no código da tela: se ela só mostra as linhas ou se calcula algo sobre a lista inteira.

| Lista | Situação | Por quê |
|---|---|---|
| Pareceres do paciente (`AbaParecer.tsx`) | dá para paginar | só mostra os cartões. Cuidado: um parecer antigo ainda aberto sairia da tela com o botão "Cancelar pedido"; paginar só os concluídos |
| Procedimentos do paciente (`ProcedimentosRealizados.tsx`) | dá para paginar | só mostra as linhas; a RPC devolve um jsonb e precisa de `p_limite` |
| Pré-natal (`PreNatal.tsx`) | fica inteira | só gestações ativas (lista limitada); cartões de resumo e filtros calculados na tela |
| Conversas do chat (`useChat.ts`) | fica inteira por ora | o total de não lidas do botão do chat soma todas as conversas; antes, levar esse total ao servidor |
| Chamados técnicos (gestor e admin) | fica inteira por ora | contadores de abertos e de alta gravidade e filtro por categoria na tela; antes, contar no servidor |
| Pessoas da organização (`Pessoas.tsx`) | fica inteira por ora | "pessoas sem vínculo" e o seletor de pessoa usam todos os perfis; antes, consulta própria no servidor |
| Diluições (`Diluicoes.tsx`) | fica inteira por ora | contadores das abas e busca na tela; a leitura traz também as versões publicadas, que a tela não usa (filtrar por status e unidade na consulta) |
| Documentos para imprimir o prontuário | fica inteira | a impressão precisa do prontuário completo (busca no texto, "marcar todos", agrupar por dia). Se pesar: listar sem o conteúdo e buscar o conteúdo só dos marcados |

As "fica inteira por ora" dependem de levar contagens e resumos ao servidor antes de paginar: trabalho próprio, a decidir com os números do item 30. Pareceres e procedimentos, de pouco volume por paciente, entram num próximo PR se o RT quiser.

**Produção:** migration `20270320000003` sem "ok produção" ainda; aplicar antes do merge.

## Medição na tela logada

Pendente para quando o RT voltar ao computador. Na homologação as listas têm poucos registros; o ganho aparece com uso real (o item 30 mede).
