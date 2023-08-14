FROM node:20-alpine

WORKDIR /app
COPY index.js ./
COPY package.json ./
RUN pwd
RUN ls -lah
RUN npm install
CMD ["node", "index.js"]