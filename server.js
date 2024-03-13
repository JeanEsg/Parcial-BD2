const Redis = require("ioredis");
const redisClient = new Redis();
const cluster = require('node:cluster');
const http = require('node:http');
const numCPUs = require('node:os').availableParallelism();
const process = require('node:process');
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const { Server } = require("socket.io");
const express = require("express");

if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);
    const httpServer = http.createServer();
    httpServer.listen(3000);
    setupMaster(httpServer, {
        loadBalancingMethod: "least-connection"
    });
    setupPrimary();
    cluster.setupPrimary({
        serialization: "advanced"
    });
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    console.log(`Worker ${process.pid} started`);
    const app = express();
    const httpServer = http.createServer(app);
    const io = new Server(httpServer);
    io.adapter(createAdapter());
    setupWorker(io);
    
    // Manejador de eventos "connection" único
    io.on("connection", async (socket) => {
        console.log(`User connected to worker ${process.pid}`);
        
        socket.on("message", async (data) => {
            console.log(`Message arrived at ${process.pid}:`, data);
            await redisClient.lpush("chat_messages", JSON.stringify(data));
            io.emit("message", data);
        });

        // Envía mensajes históricos al usuario cuando se conecta
        const existingMessages = await redisClient.lrange("chat_messages", 0, -1);
        const parsedMessages = existingMessages.map((item) => JSON.parse(item));
        socket.emit("historical_messages", parsedMessages);
    });

    app.get("/", (req, res) => {
        res.send("Hello world");
    });
}