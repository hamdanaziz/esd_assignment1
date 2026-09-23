FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p /app/logs

ENV PORT=3000
ENV LOG_FILE=/app/logs/quickbite.log

EXPOSE 3000

CMD ["node", "server.js"]
