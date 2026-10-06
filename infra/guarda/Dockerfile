# Guarda automática de 20 anos (Fase 0, tarefa 8). pg_dump/psql 17 + Node.
# Build (na raiz do repositório): docker build -f infra/guarda/Dockerfile -t chefe-coruja-guarda .
FROM postgres:17-alpine
RUN apk add --no-cache nodejs ca-certificates
COPY scripts/arquivo/cofre.mjs scripts/arquivo/guarda-automatica.mjs /app/
# roda sem root; a cópia sem cifra fica só no /tmp do container e é apagada no fim
USER postgres
ENV GUARDA_ESTADO=/estado GUARDA_TMP=/tmp
ENTRYPOINT ["node", "/app/guarda-automatica.mjs"]
