# Classificação de pacientes pediátricos (Dini): diagnóstico

Este é o achado guardado de 09/10/2026 (Fase 2, tarefa 5, Fugulin). O RT o abriu em 06/11/2026 como item 5 da frente "Achados guardados".

## O que acontece hoje
- **Fugulin, versão de 12 áreas** (`src/clinico/enfermagem/fugulin.ts`, migration `20261031000006_fugulin.sql`):
  - quem classifica é o enfermeiro de plantão, uma vez por dia, na internação, com histórico;
  - para corrigir no mesmo dia, retifica com motivo;
  - o servidor refaz a soma (`private.fugulin_definicao`);
  - a tabela `classificacoes_fugulin` só aceita inserção e é auditada;
  - na tela entra só um resumo nosso de cada graduação, com a citação, porque os artigos são CC BY-NC (decisão do RT de 09/10/2026).
- **Criança fica sem classificação:**
  - `registrar_fugulin` recusa quem tem menos de 14 anos;
  - a aba de registro da enfermagem mostra só a nota "o instrumento pediátrico (Dini, Fugulin et al., 2011) ainda não está no produto" (`AbasRegistro.tsx:190`);
  - a lista de leitos mostra o selo "Fugulin de hoje pendente" só para o adulto.
- **Consequência:** a unidade não tem a carga de cuidado das crianças internadas, e o gestor não vê a categoria delas.

## Fontes (levantadas no PubMed em 06/11/2026)
| Fonte | O que traz | Licença |
|---|---|---|
| Dini AP, Fugulin FMT, Veríssimo MLÓR, Guirardello EB. Rev Esc Enferm USP 2011;45(3):575-80. [doi:10.1590/s0080-62342011000300004](https://doi.org/10.1590/s0080-62342011000300004), PMID 21710060 | Define e valida as cinco categorias de cuidado (mínimos, intermediários, alta dependência, semi-intensivos, intensivos) | Não informada no PubMed |
| Dini AP, Guirardello EB. Rev Esc Enferm USP 2014;48(5):787-93. [doi:10.1590/s0080-6234201400005000003](https://doi.org/10.1590/s0080-6234201400005000003), PMID 25493481 | Versão aperfeiçoada do instrumento (Quadro 1), com 11 indicadores e as faixas de pontos. O Quadro 1 é imagem na página do SciELO | CC BY-NC 3.0 (página do SciELO) |
| Dini AP, Alves DFS, Oliveira HC, Guirardello EB. Rev Latino-Am Enfermagem 2014;22(4):598-603. [doi:10.1590/0104-1169.3575.2457](https://doi.org/10.1590/0104-1169.3575.2457), PMID 25296143, PMC4292659 | Validade e confiabilidade (227 crianças). Nomes dos 11 indicadores, pontos de 1 a 4 em cada um, soma de 11 a 44 e as faixas | CC BY 4.0 (PMC) |
| Dini AP et al. Rev Esc Enferm USP 2021;55:e03674. [doi:10.1590/S1980-220X2019033603674](https://doi.org/10.1590/S1980-220X2019033603674), PMID 33886905 | Adaptação para o neonato: 9 indicadores e 3 categorias (alta dependência, semi-intensivo, intensivo) | Não informada no PubMed |

**O que as fontes dizem** (artigo de 2014 da RLAE, CC BY 4.0, conferido no texto completo):
- **Indicadores:** são 11:
  1. atividade
  2. intervalo de aferição de controles
  3. terapêutica medicamentosa
  4. oxigenação
  5. integridade cutâneo-mucosa
  6. mobilidade e deambulação
  7. higiene corporal
  8. alimentação e hidratação
  9. eliminações
  10. participação do acompanhante
  11. rede de apoio e suporte
- **Pontuação:** cada indicador tem quatro situações, que valem de 1 a 4 pontos.
- **Faixas da soma:**
  - mínimos: 11 a 17
  - intermediários: 18 a 23
  - alta dependência: 24 a 30
  - semi-intensivos: 31 a 36
  - intensivos: 37 a 44
  - O artigo de 2014 da REEUSP traz as mesmas faixas na nota do Quadro 1.
- **Discussão do artigo:** os autores dizem que classificar crianças com menos de 6 anos como cuidados mínimos ou intermediários não reflete a necessidade real de cuidado, porque as horas que o COFEN dá a essas categorias são poucas. Isso não é regra do instrumento: o instrumento não muda a categoria.

**O que ainda não li:** o texto das quatro situações de cada indicador está só no Quadro 1 (imagem, CC BY-NC 3.0). Sem ele não há como escrever o resumo de cada graduação.

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| D1 | Qual instrumento e para quem | A versão aperfeiçoada de 2014 (11 indicadores, 11 a 44 pontos, 5 categorias) para toda criança até 13a 11m 29d, recém-nascido incluído, como na amostra do estudo (28% com menos de 1 ano) | Dini 2014 a partir de 29 dias de vida e a adaptação neonatal de 2021 (9 indicadores, 3 categorias) para o neonato. Pede outra conferência de fonte e de licença |
| D2 | Texto das graduações | Resumo nosso de cada situação, com a citação, como no Fugulin (o original é CC BY-NC e o produto é comercial) | Pedir autorização às autoras e usar o texto original |
| D3 | Como ler o Quadro 1 | Eu baixo a imagem do Quadro 1 da página pública do SciELO (artigo de 2014), leio e escrevo o resumo. Você revisa o resumo antes de qualquer código | Você traz o PDF do artigo |
| D4 | Quem, quando e onde | Igual ao Fugulin: enfermeiro de plantão, uma vez por dia, na internação, com histórico; corrigir no mesmo dia é retificar com motivo | A cada turno |
| D5 | Corte de idade | O servidor decide pela data de nascimento no dia da classificação: menos de 14 anos é Dini, 14 anos ou mais é Fugulin. O instrumento errado é recusado | Deixar o enfermeiro escolher o instrumento |
| D6 | Criança com menos de 6 anos em mínimos ou intermediários | Mostra a categoria que o instrumento dá e uma nota com a observação dos autores, sem mudar nada | Sobe a categoria sozinho para alta dependência. Não recomendo: não é regra do instrumento |
| D7 | Banco | Tabela própria `classificacoes_dini`, espelho da do Fugulin: só inserção, auditoria, RLS pela unidade e 2FA. RPCs `registrar_dini`, `dini_da_internacao` e `dini_de_hoje`. Selo "Dini de hoje pendente" na lista de leitos para a criança | Uma tabela só, com coluna de instrumento. Mexe na tabela do Fugulin, que já está em uso |

## Plano com A em tudo
1. **Fonte (D3):**
   - baixar o Quadro 1;
   - escrever o resumo das 44 situações neste documento, com a citação;
   - o RT revisa. Nenhum código antes dessa revisão.
2. **Testes antes:**
   - SQL:
     - soma e faixas nos limites 17/18, 23/24, 30/31 e 36/37;
     - indicador faltando ou fora de 1 a 4 é recusado;
     - criança com 14 anos completos é recusada no Dini;
     - adulto continua no Fugulin;
     - papel diferente de enfermeiro é recusado;
     - retificação pede motivo;
     - a tabela só aceita inserção.
   - Unidade: `totalDini` e `categoriaDini`.
   - Teste de fonte da aba de registro.
3. **Migration (expand):**
   - `private.dini_definicao` (versão, indicadores, faixas);
   - tabela `classificacoes_dini` e auditoria pelo gatilho existente;
   - as três RPCs, com o rollback escrito no cabeçalho.
4. **Telas:**
   - `CartaoDini` no lugar da nota da `AbasRegistro.tsx:190`;
   - selo na lista de leitos (`InternacaoEnfermagem.tsx`);
   - chave `dini-hoje` nas consultas guardadas sem rede.
   - A ficha nova entra na fila de aprovação do RT, como as outras.
5. **Homologação:**
   - migration com a versão registrada;
   - conferência no Chrome como `enfermeiro.upa.f5`, com uma criança internada de teste;
   - depois, PR e ok produção.

## Riscos
- **Resumo errado de uma situação:** muda a soma e a categoria. É por isso que o RT revisa o resumo antes do código.
- **Uso para dimensionamento:** a categoria serve para a gestão da equipe. O produto mostra a soma e a categoria; não calcula horas nem número de profissionais.
- **Confiabilidade baixa em parte do instrumento:** no domínio "procedimentos terapêuticos" o alfa foi 0,44 (RLAE 2014). Os autores pedem mais estudos. Fica registrado na ficha.
