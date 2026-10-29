# ─────────────────────────────────────────────────────────────────────────────
# Serviço de envio à RNDS e simulador (Fase 5C, tarefa 5, etapa 5.3c).
# Contexto do build: a raiz do repositório (o serviço usa src/interop/fhir).
# O Node 24 roda o TypeScript direto; só a dependência de execução entra.
# O openssl é do simulador, que gera a própria CA de teste.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY services/rnds-envio/package.json services/rnds-envio/package-lock.json ./services/rnds-envio/
RUN cd services/rnds-envio && npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src/interop/fhir ./src/interop/fhir
COPY services/rnds-envio/src ./services/rnds-envio/src
COPY services/rnds-envio/simulador ./services/rnds-envio/simulador
# o volume da CA de teste nasce com o dono certo
RUN mkdir -p /certs-sim && chown node:node /certs-sim
USER node
CMD ["node", "services/rnds-envio/src/main.ts"]
