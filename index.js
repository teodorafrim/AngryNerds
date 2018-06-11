const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const port = process.env.PORT || '3000';
app.set('port', port);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const words = require('./resources/words');
const highscores = require('./resources/highscores');

app.use(function (err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).send(JSON.stringify({
            error: {
                code: "INVALID_JSON",
                message: "The body of your request is not valid JSON."
            }
        }))
    }
});

app.get('/highscore', (req, res) => {
    res.status(200).json(highscores);
});

app.post('/highscore', (req, res) => {
    const newScore = req.body;

    for (let user in newScore) {
        if (Number.isInteger(newScore[user])) {
            if (!(highscores[user] > newScore[user])) highscores[user] = newScore[user];
        }

        else {
            res.status(400).json({ message: 'The score for ' + user + ' is not an Integer' });
            return;
        }
    }

    const json = JSON.stringify(highscores);
    fs.writeFile("./resources/highscores.json", json, (err) => {
        if (err) throw err;
        console.log('complete');
    }
    );
    res.status(200).json({ message: 'Data has been successfully added' });
});

app.get('/words', (req, res) => {
    res.status(200).json(words);
});

app.put('/add-word', (req, res) => {
    const wordArray = req.body;
    // Check if data is an array
    if (!Array.isArray(wordArray)) {
        res.status(400).json({ message: 'Data must be a JSON array' });
        return;
    }

    for (let newWord in wordArray) {
        // Check if data is in String format
        if (typeof wordArray[newWord] !== 'string') {
            res.status(400).json({ message: 'Data in array must be Strings' });
            return;
        }

        let isDuplicate = false;

        // Check if word already exists
        for (let existingWord in words) {
            if (words[existingWord] === wordArray[newWord]) isDuplicate = true;
        }

        // If not a duplicate, add it to the array
        if (isDuplicate) console.log(wordArray[newWord] + ' is a duplicate');
        else {
            words.push(wordArray[newWord]);
            const json = JSON.stringify(words);
            fs.writeFile("./resources/words.json", json, (err) => {
                if (err) throw err;
                console.log('complete');
            }
            );
        }
    }

    res.status(200).json({ message: 'Data has been successfully added' })
});

// Socket setup

const socket = require('socket.io');
const server = app.listen(port, () => {
    console.log('Listening on port ' + port);
});
var io = socket(server);

onlineUsers = [];
linesHistory = [];

io.on('connection', function (socket) {

    console.log(`Current number of connections: ${io.engine.clientsCount} `);
    console.log(socket.id);

    //Disconnect
    socket.on('disconnect', function (data) {
        console.log(onlineUsers);
        index = onlineUsers.findIndex(user => user.socketID === socket.id);
        console.log(index);
        if(index !== -1) {
            onlineUsers.splice(index, 1);
        }
        console.log('Disconnected: %s sockets connected', io.engine.clientsCount);
        socket.broadcast.emit('users', onlineUsers);
    });

    //Send Message
    socket.on('send message', function (data) {
        console.log(data, socket.username);
        let index = onlineUsers.findIndex(user => user.socketID === socket.id);
        let username = onlineUsers[index].username;
        io.sockets.emit('new message', { msg: data, user: username });
    });

    //New User
    socket.on('new user', function (data) {
        onlineUsers.push({ socketID: socket.id, username: data, score: 0 });
        console.log(onlineUsers[onlineUsers.length-1]);
        io.sockets.emit('users', onlineUsers);
    });

    //Listen, save and broadcast new drawing elements
    socket.on('drawing', function (data) {
        linesHistory.push(data);
        socket.broadcast.emit('drawing', data);
    });

    //Send the current drawing
    socket.on('current drawing', function () {
        for (var i in linesHistory) {
            socket.emit('drawing', linesHistory[i]);
        }
    });

});
