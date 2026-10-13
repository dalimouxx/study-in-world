FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx nest build
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
