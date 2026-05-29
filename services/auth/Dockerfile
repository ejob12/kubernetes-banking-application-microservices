FROM node:20-alpine

WORKDIR /app
COPY shared ./shared
COPY services/auth ./services/auth

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/services/auth
CMD ["node", "src/index.js"]
