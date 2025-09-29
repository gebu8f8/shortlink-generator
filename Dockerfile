# 使用更小的基礎鏡像
FROM node:22-alpine

# 設置工作目錄
WORKDIR /app

# 先複製 package.json (利用 Docker 層緩存)
COPY package*.json ./

# 安裝生產依賴並清理緩存
RUN apk add --no-cache --virtual .build-deps \
    python3 make g++ sqlite && \
    npm ci --only=production && \
    npm cache clean --force && \
    apk del .build-deps

# 複製應用代碼
COPY . .

# 創建數據目錄
RUN mkdir -p /app/database

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["node", "app.js"]