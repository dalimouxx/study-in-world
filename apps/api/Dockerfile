FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx nest build
# Précompile le script de seed en JS brut : exécuté via "ts-node" au démarrage du conteneur, il
# dépassait les 512 Mo de RAM du plan gratuit (compilation TypeScript à la volée trop coûteuse).
# Compilé ici (à la construction de l'image, où la mémoire n'est pas contrainte), il ne reste plus
# qu'à l'exécuter avec "node" — un coût mémoire négligeable.
RUN npx tsc -p tsconfig.seed.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV NODE_ENV=production
EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
