FROM node:20-alpine

WORKDIR /app
COPY shared ./shared
COPY services/admin ./services/admin

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/services/admin
CMD ["node", "src/index.js"]
