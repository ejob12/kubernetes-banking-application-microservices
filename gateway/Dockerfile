FROM node:20-alpine

WORKDIR /app
COPY gateway ./gateway

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/gateway
CMD ["node", "src/index.js"]
