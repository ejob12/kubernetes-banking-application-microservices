FROM node:20-alpine

WORKDIR /app
COPY shared ./shared
COPY services/balancer ./services/balancer

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/services/balancer
CMD ["node", "src/index.js"]
