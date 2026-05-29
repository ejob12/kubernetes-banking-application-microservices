FROM node:20-alpine

WORKDIR /app
COPY shared ./shared
COPY services/analytics ./services/analytics

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/services/analytics
CMD ["node", "src/index.js"]
