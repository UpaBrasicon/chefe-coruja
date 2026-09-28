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
- R4 toda fonte em `fontes.yaml` com `licenca` válida; sem isso a ingestão
  para. Os dois livros (Manual HCFMUSP e PS Pediatria ICr) **não** estão na
  biblioteca: são obras comerciais sem licença de uso. Se a licença vier,
  basta uma linha em `fontes.yaml` e `python ingest.py`.
- R5 pseudonimização (CPF, CNS, telefone, data, prontuário) na Edge Function e
  na API; o log guarda só a pergunta mascarada.
- R6 a busca local (Fuse.js) funciona com o VPS desligado.

## Conteúdo indexado

1. Fontes abertas do Ministério da Saúde (`raw/*.pdf`, `licenca:
   acesso-aberto-governo`).
2. Corpus da própria Central (`corpus/*.md`, gerado por
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
copia tudo para o VPS (precisa da chave SSH do usuário).
