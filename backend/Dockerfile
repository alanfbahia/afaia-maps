FROM node:20-alpine

WORKDIR /app

# Dependências nativas (sharp, etc.)
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "src/index.js"]
