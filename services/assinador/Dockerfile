# ─────────────────────────────────────────────────────────────────────────────
# Assinador ICP-Brasil (LG7). Contexto do build: services/assinador.
# O Node 24 roda o TypeScript direto; o Chromium do Alpine faz o PDF da folha.
# Fontes DejaVu e Noto para os acentos e símbolos da folha impressa.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ttf-dejavu font-noto
WORKDIR /app
ENV NODE_ENV=production \
    CHROMIUM=/usr/bin/chromium-browser \
    HOME=/tmp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
# o volume das sessões cifradas nasce com o dono certo
RUN mkdir -p /dados && chown node:node /dados
USER node
EXPOSE 8090
CMD ["node", "src/main.ts"]
