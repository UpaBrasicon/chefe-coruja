# Guarda automática de 20 anos (Fase 0, tarefa 8). pg_dump/psql 17 + Node.
# Build (na raiz do repositório): docker build -f infra/guarda/Dockerfile -t chefe-coruja-guarda .
FROM postgres:17-alpine
# A imagem só existe enquanto a guarda roda (docker run --rm), então nenhum
# container a segura. O cron de limpeza do VPS (infra/guarda/docker-image-prune.cron)
# pula imagens com esta etiqueta. Sem ela, o prune apagou a imagem e a guarda
# ficou parada de 07/10 a 16/11/2026.
LABEL br.com.chefecoruja.manter="guarda de 20 anos"
RUN apk add --no-cache nodejs ca-certificates
COPY scripts/arquivo/caminho.mjs scripts/arquivo/cofre.mjs scripts/arquivo/guarda-automatica.mjs /app/
# roda sem root; a cópia sem cifra fica só no /tmp do container (tmpfs em
# memória, ver chefe-coruja-guarda.service) e é apagada no fim
USER postgres
ENV GUARDA_ESTADO=/estado GUARDA_TMP=/tmp
ENTRYPOINT ["node", "/app/guarda-automatica.mjs"]
