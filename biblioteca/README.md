# Biblioteca clínica (busca inteligente da Central)

API de busca e resposta com citação usada pela barra "Buscar por droga, escore
ou conduta…" da Central do Plantonista e pela tool `biblioteca_clinica_buscar`
do Hermes. Roda no VPS do Hermes em `/srv/biblioteca` (usuário `hermes`),
Docker Compose com Qdrant + Ollama (bge-m3) + FastAPI, tudo só em 127.0.0.1;
o Caddy do Hermes publica `biblioteca.chefecoruja.com.br`.

Guia completo: `produto/docs/pesquisa/busca-ia-guia-implementacao.md`.

## Regras

- R1 nada do Hermes em execução é alterado (só um bloco novo no Caddyfile e a
  rede `deploy_default` compartilhada).
- R2 serviços novos só em 127.0.0.1.
- R3 o modelo não calcula dose nem escore: aponta a ferramenta da Central.
- ~~R4~~ retirada pelo responsável técnico em 28/09/2026: toda fonte continua
  registrada em `fontes.yaml` (título, editor, ano, `licenca`), mas a licença
  não bloqueia mais a ingestão. Os dois livros (Manual HCFMUSP 2022 e PS
  Pediatria ICr 2023) já estão em `raw/` no VPS, mas **a linha deles em
  `fontes.yaml` e a ingestão ficaram para o usuário** (a IA foi impedida de
  registrá-los): obras comerciais da Manole sem licença de uso; a
  responsabilidade é do RT. Modelo da entrada no fim deste arquivo.
- R5 pseudonimização (CPF, CNS, telefone, data, prontuário) na Edge Function e
  na API; o log guarda só a pergunta mascarada.
- R6 a busca local (Fuse.js) funciona com o VPS desligado.

## Conteúdo indexado

1. (Pendente do usuário) Os dois livros-fonte das ferramentas
   (`raw/manual_hcfmusp_3ed_2022.pdf`, `raw/ps_pediatria_icr_4ed_2023.pdf`,
   `licenca: sem-licenca`; a página citada é a do PDF).
2. Fontes abertas do Ministério da Saúde (`raw/ms_*.pdf`, `licenca:
   acesso-aberto-governo`).
3. Corpus da própria Central (`corpus/*.md`, gerado por
   `npm run corpus:central` a partir de `src/clinico`): cada ferramenta com a
   sua ficha, fontes com página e os dados que a tela usa. `licenca:
   institucional`, tenant `global`.

## Operação

```bash
# no VPS, como hermes
cd /srv/biblioteca
docker compose up -d qdrant ollama
docker compose exec ollama ollama pull bge-m3
docker compose build api
docker compose run --rm api python ingest.py            # fontes.yaml
docker compose run --rm api python index_tools.py       # ferramentas.json
docker compose up -d api
curl -s localhost:8710/health
docker compose run --rm api python /srv/biblioteca/evals/run.py
```

Do repositório: `npm run biblioteca:sync` gera `ferramentas.json` e o corpus e
copia tudo para o VPS (precisa da chave SSH do usuário). Os `.py` entram na
imagem da API (`COPY` no Dockerfile): depois de mudar `app/*.py`, rode
`docker compose build api` antes de `docker compose run`/`up`.

## Entrada dos livros em `fontes.yaml` (para o usuário acrescentar)

```yaml
- arquivo: manual_hcfmusp_3ed_2022.pdf
  titulo: "Manual de Medicina de Emergência — HCFMUSP, 3ª ed."
  editor: "Manole (Brandão Neto RA et al., eds.)"
  ano: 2022
  licenca: "sem-licenca"
  nota: "Obra comercial (ISBN 9786555767827), sem licença de uso; decisão do RT em 28/09/2026. Anexo 1 tem erros de digitação (CLAUDE.md)."
  tenant_id: global

- arquivo: ps_pediatria_icr_4ed_2023.pdf
  titulo: "Pronto-Socorro — Pediatria ICr-HCFMUSP, 4ª ed."
  editor: "Manole (Schvartsman C et al., coords.)"
  ano: 2023
  licenca: "sem-licenca"
  nota: "Obra comercial (ISBN 978-65-5576-759-9), sem licença de uso; decisão do RT em 28/09/2026. Não cobre o período neonatal."
  tenant_id: global
```

Depois, no VPS (como hermes, em `/srv/biblioteca`), com a mesma entrada
copiada para `/srv/biblioteca/fontes.yaml`:

```bash
docker compose run --rm api python ingest.py manual_hcfmusp_3ed_2022.pdf ps_pediatria_icr_4ed_2023.pdf
```

São ~2.400 páginas: a 24 chunks/min no VPS, conte várias horas. As evals já
têm perguntas que esperam os dois livros.
