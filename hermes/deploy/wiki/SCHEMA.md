# Wiki Schema

## Domínio

Base de conhecimento clínico e regulatório para medicina de urgência e
emergência e para a gestão operacional de UPA no Brasil.

Cobre: protocolos assistenciais, condutas, fármacos e doses, escalas e escores,
diretrizes de sociedades, normas do CFM/CREMEGO/Ministério da Saúde, e
procedimentos administrativos de unidade.

**NÃO cobre e NUNCA deve conter:** dado de paciente (identificado ou
pseudonimizado), nome de profissional, CRM, escala nominal de plantão,
remuneração individual, ou qualquer conteúdo de prontuário. Este wiki é
conhecimento, não registro. Ver seção "Barreira de dado sensível".

## Barreira de dado sensível (regra dura)

Antes de gravar qualquer página ou arquivo em `raw/`, verifique:

1. Contém nome próprio de pessoa física? → **rejeitar ou anonimizar**
2. Contém CRM, CPF, CNS, número de prontuário, data de nascimento? → **rejeitar**
3. Contém descrição de caso individual identificável? → **rejeitar**
4. É escala, folha de ponto ou lista nominal? → **rejeitar** (isso é o Chefe Coruja, não o wiki)

Exceção: nomes de autores de diretrizes e de titulares de cargo público em
normas oficiais são permitidos (fazem parte da fonte publicada).

Ao rejeitar, informe ao usuário o motivo e não grave nada.

## Conventions

- Nomes de arquivo: minúsculas, hífens, sem espaço, sem acento
  (`sepse-choque-septico.md`, `cetamina.md`, `resolucao-cfm-2314-2022.md`)
- Toda página começa com frontmatter YAML (abaixo)
- Use `[[wikilinks]]` — mínimo 2 links de saída por página
- Ao atualizar uma página, sempre bumpe `updated`
- Toda página nova entra no `index.md` na seção correta, em ordem alfabética
- Toda ação vira uma entrada em `log.md`
- **Provenance:** em páginas que sintetizam 3+ fontes, anexe
  `^[raw/protocolos/arquivo.md]` ao final dos parágrafos cuja afirmação vem de
  uma fonte específica
- **Idioma:** todo o conteúdo do wiki em português do Brasil, inclusive
  resumos de fontes em inglês

## Frontmatter

```yaml
---
title: Título da Página
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary | protocolo | norma
tags: [somente tags da taxonomia abaixo]
sources: [raw/protocolos/arquivo.md]
# Campos obrigatórios neste domínio:
orgao_emissor: MS | CFM | CREMEGO | AHA | SBC | SBIT | AMIB | ABRAMEDE | outro | n/a
vigencia: YYYY-MM-DD | vigente | revogada-em-YYYY-MM-DD | indeterminada
confidence: high | medium | low
# Opcionais:
contested: true
contradictions: [slug-da-outra-pagina]
---
```

### Regras de confidence (mais rígidas que o padrão da skill)

| Nível | Quando usar |
|---|---|
| `high` | Afirmação corroborada por 2+ fontes oficiais (MS, CFM, sociedade de especialidade) e ambas vigentes |
| `medium` | Fonte única oficial, OU 2+ fontes secundárias concordantes |
| `low` | Fonte secundária isolada, revisão narrativa, opinião de especialista, ou conteúdo com vigência expirada mantido por contexto histórico |

**Dose de fármaco, via, diluição e intervalo NUNCA recebem `high` com fonte
única.** Se não houver corroboração, marque `medium` e registre a lacuna na
página.

### raw/ Frontmatter

Toda fonte em `raw/` também recebe:

```yaml
---
source_url: https://exemplo.gov.br/protocolo.pdf
orgao_emissor: MS
publicado: YYYY-MM-DD
ingested: YYYY-MM-DD
sha256: <digest hex do corpo abaixo do frontmatter>
licenca: dominio-publico | CC-BY | CC-BY-NC | reproducao-com-citacao | restrita
---
```

O `sha256` permite que uma reingestão da mesma URL detecte que nada mudou
(pula) ou que a fonte foi alterada (sinaliza drift). Calcule sobre o corpo,
não sobre o frontmatter.

O campo `licenca` é obrigatório: conteúdo marcado `CC-BY-NC` ou `restrita`
**não pode ser embutido em produto comercial** — pode ser consultado e citado,
não redistribuído.

## Tag Taxonomy

Toda tag usada precisa estar nesta lista. Tag nova entra AQUI primeiro.

**Natureza do conteúdo**
`protocolo`, `diretriz`, `norma`, `procedimento`, `escala-escore`, `fluxograma`

**Clínico — sistemas e síndromes**
`cardiovascular`, `respiratorio`, `neurologico`, `infeccioso`, `metabolico`,
`trauma`, `toxicologia`, `obstetrico`, `pediatrico`, `psiquiatrico`, `dor`

**Clínico — situações críticas**
`pcr`, `via-aerea`, `choque`, `sepse`, `avc`, `sca`, `crise-convulsiva`,
`anafilaxia`, `sedacao-analgesia`, `ventilacao`

**Farmacologia**
`farmaco`, `dose`, `diluicao`, `interacao`, `antidoto`, `controlado`

**Regulatório e gestão**
`cfm`, `cremego`, `ministerio-saude`, `classificacao-risco`, `regulacao-leitos`,
`transferencia`, `documentacao`, `responsabilidade-tecnica`, `edital-contrato`,
`indicador`

**Meta**
`comparacao`, `linha-do-tempo`, `controversia`, `revisao-pendente`

## Page Thresholds

**Criar página quando:**
- Fármaco usado rotineiramente na unidade → `entities/`
- Condição clínica com conduta protocolada → `concepts/`
- Protocolo institucional ou do MS → `concepts/` com `type: protocolo`
- Norma (resolução, portaria) citada 2+ vezes → `entities/` com `type: norma`
- Escala/escore aplicado na unidade → `entities/`

**NÃO criar página para:**
- Menção de passagem sem conduta associada
- Condição fora do escopo de urgência
- Variação regional sem fonte

**Dividir** página acima de ~200 linhas.
**Arquivar** em `_archive/` quando integralmente superada — e atualizar quem
apontava para ela.

## Update Policy — contradições

Quando informação nova conflita com o conteúdo existente:

1. Compare as datas de `vigencia` e `publicado` — norma mais recente prevalece
2. Se genuinamente contraditório, **registre as duas posições** com data e fonte
3. Marque `contradictions: [pagina]` e `contested: true` no frontmatter
4. Sinalize no relatório do próximo lint
5. **Nunca sobrescreva silenciosamente** — especialmente dose, via e indicação

Contradição envolvendo dose de fármaco é escalada imediata ao usuário, não
espera o lint.

## Estrutura das páginas

**Entity (fármaco):** o que é · apresentações · indicações na urgência · dose
adulto · dose pediátrica · diluição · contraindicações · interações relevantes ·
`[[wikilinks]]` para as condições em que é usado · fontes

**Entity (norma):** órgão · número e ano · o que determina · a quem se aplica ·
vigência e revogações · impacto prático na unidade · `[[wikilinks]]`

**Concept (condição/protocolo):** definição · reconhecimento e critérios ·
conduta escalonada · fármacos usados (`[[wikilinks]]`) · critérios de
transferência/internação · armadilhas · fontes

**Comparison:** o que se compara e por quê · tabela de dimensões · veredito ·
fontes

## Vigência e obsolescência

- Diretriz com `vigencia` expirada: manter a página, mudar `confidence` para
  `low`, marcar `revisao-pendente` e registrar no log
- O lint deve listar toda página cuja fonte principal tenha mais de 5 anos de
  `publicado` para o domínio clínico, e mais de 2 anos para o domínio
  regulatório
