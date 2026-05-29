FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY index.js package.json ./

EXPOSE 3000

CMD ["npm", "start"]
