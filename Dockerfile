FROM node:20.11.1

WORKDIR /app

COPY package.json ./

RUN npm install express ioredis socket.io "@socket.io/cluster-adapter" "@socket.io/sticky"

COPY . .

EXPOSE 3000

CMD ["node"]["server.js"]
