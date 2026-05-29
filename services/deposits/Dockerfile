FROM node:20-alpine

WORKDIR /app
COPY shared ./shared
COPY services/deposits ./services/deposits

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/services/deposits
CMD ["node", "src/index.js"]
