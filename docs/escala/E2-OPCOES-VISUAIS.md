# Aba Escala, entrega E2 — opções visuais

28/10/2026. A E2 deixa o gestor escalar todas as categorias pela tela (hoje só escala plantonista) e
faz o envio ao ERP levar só o plantão médico. A E1 já grava a categoria de cada plantão. Antes de
aplicar, três opções para a Escala do gestor (aba Mensal, opção A da 3.9: o mês com o dia ao lado).

**Nada aplicado.** As maquetes usam os componentes reais do app com dados fictícios (página de teste,
fora do repositório).

## Referências do Refero

| Tela | O que se aproveita |
|---|---|
| Hello Ivy, pessoas (`a73e30bf`) | Controle segmentado acima da lista para trocar o grupo visto |
| Mangomint, calendário da equipe (`96e5af32`) | Filtro "mostrar por grupo" em popover sobre o calendário de várias pessoas |
| Missive, mês (`d90906b7`) | Mês com itens de várias agendas juntos, marcados pela origem |
| GlossGenius, atribuir papel (`f2aa4b0e`) | Escolha do papel em lista antes de confirmar a atribuição |
| Cron, dia ao lado (`0e4d878a`) | Painel estreito do dia escolhido ao lado do mês |

## Opções (`maquetes/e2-A|B|C-claro|escuro.jpg`)

Em todas: o painel do dia continua setor por setor e faixa por faixa; a vaga passa a dizer a
categoria; quem tem dois papéis na unidade aparece nas duas listas e é escalado na categoria
escolhida (resposta 6 do RT).

- **A · uma categoria por vez** (Hello Ivy, Mangomint). Abas acima do mês: Médicos, Enfermeiros,
  Técnicos, Recepção, Farmácia…, cada uma com o número de vagas abertas em âmbar. O mês e o dia
  mostram só a categoria da aba; "coberto" e "vaga" passam a ser daquela categoria. "Escalar" já
  chega com a categoria da aba ("Escalar técnico de enfermagem") e lista só quem tem esse papel.
  Muda pouco a tela de hoje; para ver a equipe inteira do dia, o gestor troca de aba.
- **B · todas juntas, categoria ao lado do nome** (Missive, Mangomint). Um mês só. A célula do dia diz
  quantas vagas e de quais categorias ("3 vagas · Téc · Enf · Méd") ou que categoria ficou sem ninguém
  ("sem Rec, Farm"). No dia, cada nome leva a sigla da categoria. Filtro "Categorias: todas" para
  recortar. "Escalar" pede primeiro a categoria e depois a pessoa.
- **C · cada faixa diz o que falta** (GlossGenius, Cron). A célula do dia mostra Méd, Enf e Téc, em
  âmbar a que tem vaga. No dia, cada faixa tem uma linha por categoria: o nome, "vaga aberta" ou "—"
  com "Escalar" na própria linha (a categoria vem da linha). Recepção, farmácia e as outras ficam em
  "Outras categorias". Pede saber quais categorias cada setor precisa (pergunta 3).

## Fora do visual

- **ERP:** o envio de plantões ao ERP (`private.plantoes_erp_linhas`) passa a levar só o plantão
  médico, pela categoria gravada na E1 (pergunta 2).
- **Cobertura:** `private.escala_faixas`, `escala_mes_gestor` e `vagas_abertas` passam a contar por
  categoria; a vaga marcada pelo gestor ganha categoria (`marcar_vaga_escala`) e o aviso vai só para
  quem tem aquele papel.
- **Lista do gestor:** `profissionais_da_unidade(p_unidade, p_papel)` no lugar de
  `plantonistas_da_unidade` na tela (a antiga fica).
- **Fixa:** a escala fixa ganha a categoria, e a geração do mês a leva para os plantões.

## Perguntas ao RT

1. **Qual opção:** A, B ou C?
2. **ERP:** "plantão médico" é só plantonista, ou plantonista e telemedicina?
3. **Só na opção C:** quais categorias aparecem em cada faixa do dia? Sugestão: médico, enfermeiro e
   técnico em todo setor assistencial; as outras em "Outras categorias".
