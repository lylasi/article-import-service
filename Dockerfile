# 預設用 node:20-alpine；要換版本或離線環境用本地已有的映像時：
#   docker build --build-arg NODE_IMAGE=node:22-alpine -t article-import-service:local .
ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE}

WORKDIR /app
ENV NODE_ENV=production

# 先裝依賴再複製原始碼，改程式碼時不會重裝 node_modules
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index-node.js"]
