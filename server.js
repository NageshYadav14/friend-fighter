// ==========================================
// FRIEND FIGHTER - ONLINE MULTIPLAYER SERVER
// ==========================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;


// Serve website files
app.use(express.static(__dirname));


// Store active rooms
const rooms = new Map();


// Generate 6-character room code
function generateRoomCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {
        code = "";

        for (let i = 0; i < 6; i++) {
            code += characters[
                Math.floor(Math.random() * characters.length)
            ];
        }

    } while (rooms.has(code));

    return code;
}


// Get room safely
function getRoom(code) {
    return rooms.get(String(code || "").toUpperCase());
}


// Remove player from room
function removePlayer(socket) {

    const code = socket.data.roomCode;

    if (!code) return;

    const room = getRoom(code);

    if (!room) return;

    room.players = room.players.filter(
        player => player.id !== socket.id
    );

    socket.leave(code);

    socket.data.roomCode = null;
    socket.data.playerNumber = null;


    if (room.players.length === 0) {

        rooms.delete(code);

    } else {

        io.to(code).emit("match:opponent-left");

        io.to(code).emit("room:update", {
            players: room.players.length
        });

    }

}


// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on("connection", socket => {

    console.log("Player connected:", socket.id);


    // CREATE ROOM
    socket.on("room:create", data => {

        const code = generateRoomCode();

        const room = {
            host: socket.id,
            players: [
                {
                    id: socket.id,
                    name: data?.name || "Player 1"
                }
            ],
            started: false
        };

        rooms.set(code, room);

        socket.join(code);

        socket.data.roomCode = code;
        socket.data.playerNumber = 1;

        socket.emit("room:created", {
            roomCode: code
        });

        console.log("Room created:", code);

    });


    // JOIN ROOM
    socket.on("room:join", data => {

        const code = String(
            data?.roomCode || ""
        ).toUpperCase();

        const room = getRoom(code);


        if (!room) {

            socket.emit("room:error", {
                message: "Room does not exist."
            });

            return;

        }


        if (room.players.length >= 2) {

            socket.emit("room:error", {
                message: "Room is already full."
            });

            return;

        }


        if (room.started) {

            socket.emit("room:error", {
                message: "Match has already started."
            });

            return;

        }


        room.players.push({

            id: socket.id,

            name: data?.name || "Player 2"

        });


        socket.join(code);

        socket.data.roomCode = code;

        socket.data.playerNumber = 2;


        socket.emit("room:joined", {
            roomCode: code
        });


        io.to(code).emit("room:ready", {

            players: room.players.length

        });


        console.log("Player joined room:", code);

    });


    // START MATCH
    socket.on("match:start", data => {

        const code = String(
            data?.roomCode || ""
        ).toUpperCase();

        const room = getRoom(code);


        if (!room) return;

        if (room.host !== socket.id) return;

        if (room.players.length !== 2) return;

        if (room.started) return;


        room.started = true;


        io.to(code).emit("match:start", {

            characters: data.characters

        });


        console.log("Match started:", code);

    });


    // RELAY PLAYER INPUT
    socket.on("game:input", data => {

        const code = socket.data.roomCode;

        const room = getRoom(code);

        if (!room || !room.started) return;


        if (
            typeof data?.key !== "string" ||
            typeof data?.down !== "boolean"
        ) return;


        socket.to(code).emit("game:input", {

            key: data.key,

            down: data.down

        });

    });


    // SYNCHRONIZE ROUND RESULTS
    socket.on("match:round-end", data => {

        const code = socket.data.roomCode;

        const room = getRoom(code);

        if (!room || room.host !== socket.id) return;


        io.to(code).emit("match:sync-round", {

            winner: data.winner,

            score1: data.score1,

            score2: data.score2,

            roundNumber: data.roundNumber,

            finished: data.finished

        });

    });


    // LEAVE ROOM
    socket.on("room:leave", () => {

        removePlayer(socket);

    });


    // DISCONNECT
    socket.on("disconnect", () => {

        removePlayer(socket);

        console.log("Player disconnected:", socket.id);

    });

});




server.listen(PORT, "0.0.0.0", () => {

    console.log("--------------------------------");

    console.log("FRIEND FIGHTER SERVER RUNNING");

    console.log(`Server running on port ${PORT}`);

    console.log("--------------------------------");

});
