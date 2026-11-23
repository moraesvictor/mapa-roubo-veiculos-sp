FROM node:22-slim
WORKDIR /app
COPY spikes/hosting/imagem/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY spikes/bff-stack/node/app-hono.ts spikes/bff-stack/node/contrato.ts spikes/bff-stack/node/dados.ts spikes/bff-stack/node/
COPY spikes/hosting/imagem/bff.ts spikes/hosting/imagem/
COPY data/tmp/bff.duckdb data/tmp/
USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "spikes/hosting/imagem/bff.ts"]
