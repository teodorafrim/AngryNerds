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
        index = onlineUsers.findIndex(user => user.socketID === socket.id);
        // If the disconnected user was also logged in (otherwise his ID won't show up in onlineUsers)
        if (index !== -1) {
            // End the round when the player to draw disconnects
            if (onlineUsers[index].socketID === currentUser.socketID) {
                endRound();
            }
            else {
                checkIfEverybodyGuessed();
            }
            onlineUsers.splice(index, 1);
        }
        if (onlineUsers.length < 2) {
            endGame();
        }
        console.log('Disconnected: %s sockets connected', io.engine.clientsCount);
        socket.broadcast.emit('users', onlineUsers);
    });

    //Send Message
    socket.on('send message', function (data) {
        console.log(data, socket.username);
        let index = onlineUsers.findIndex(user => user.socketID === socket.id);
        let username = onlineUsers[index].username;

        // The drawer and those who have already guessed are not allowed to send messages
        if (onlineUsers[index].status != 'drawing' && onlineUsers[index].status != 'guessed') {
            // If the player has guessed the word
            if (isRoundRunning && data === currentWord) {
                onlineUsers[index].status = 'guessed';
                onlineUsers[index].score += 1;
                io.to(socket.id).emit('notification', { msg: 'You have guessed the word!', delay: 2500 });
                io.sockets.emit('new message', { msg: `${username} has guessed the word!` });
                io.sockets.emit('users', onlineUsers);
                checkIfEverybodyGuessed();
            }
            else {
                io.sockets.emit('new message', { msg: data, user: username });
            }
        }

        else {
            io.to(socket.id).emit('new message', { msg: `You are not allowed to send messages right now.` });
        }
    });

    //New User
    socket.on('new user', function (data) {
        onlineUsers.push({ socketID: socket.id, username: data, score: 0, mustDraw: false });
        console.log('New user: ', onlineUsers[onlineUsers.length - 1]);

        if (isRoundRunning) {
            let index = onlineUsers.findIndex(user => user.socketID === socket.id);
            onlineUsers[index].status = 'guessing';
        }

        if (onlineUsers.length > 1 && isGameRunning == false)
            startGame();

        if (onlineUsers.length == 1) {
            socket.emit('notification', { msg: 'Waiting for more players ...', delay: 0 });
        }
        io.sockets.emit('users', onlineUsers);

    });

    //Listen, save and broadcast new drawing elements
    socket.on('drawing', function (data) {
        linesHistory.push(data);
        socket.broadcast.emit('drawing', data);
    });

    //Send the current drawing
    socket.on('current drawing', function () {
        for (var i = 0; i < linesHistory.length; i++) {
            socket.emit('drawing', linesHistory[i]);
        }
    });

});

// Game logic

var isGameRunning = false;
var isRoundRunning = false;
var currentWord = undefined;
var currentUser = undefined;

function startGame() {
    console.log('Game started');
    for (var i = 0; i < onlineUsers.length; i++) {
        console.log(onlineUsers[i])
        onlineUsers[i].mustDraw = true; // only users present at the beginning are required to draw
        onlineUsers[i].score = 0;
    }
    io.sockets.emit('users', onlineUsers);
    isGameRunning = true;
    startRound();
}

function startRound() {
    currentUser = undefined;
    console.log('Round started', onlineUsers);
    // Check if there are still players who have to draw
    for (var i = 0; i < onlineUsers.length; i++)
        if (onlineUsers[i].mustDraw) {
            console.log(onlineUsers[i].socketID);
            currentUser = onlineUsers[i];
            break;
        }

    // If one was found, start actually the round
    if (currentUser !== undefined) {
        for (var i = 0; i < onlineUsers.length; i++) {
            if (onlineUsers[i].socketID == currentUser.socketID)
                onlineUsers[i].status = 'drawing';
            else
                onlineUsers[i].status = 'guessing';
        }
        console.log('Online users', onlineUsers);
        chooseRandomWord();
        io.to(currentUser.socketID).emit('must draw', currentWord);
        io.sockets.connected[currentUser.socketID].broadcast
            .emit('notification', { msg: `It's ${currentUser.username}'s turn to draw.`, delay: 4000 });
        console.log(currentWord);
        isRoundRunning = true;
    }

    // End the game if not
    else
        endGame();
}

// End the game and start a new one if there are enough players
function endGame() {
    if (isRoundRunning)
        endRound();
    if (onlineUsers.length > 1) {
        io.sockets.emit('notification', { msg: 'Game has ended. Starting a new game ...', delay: 3000 });
        setTimeout(startGame, 4000);
    }
    else if (onlineUsers.length == 1) {
        io.to(onlineUsers[0].socketID).emit('notification', { msg: 'Waiting for more players ...', delay: 0 });
    }

}
// Notify the users, reset variables, start a new round.
// Note: The round is ended when everybody has guessed the word or the drawer has disconnected.
function endRound() {
    io.sockets.emit('notification', { msg: 'Round has ended.', delay: 3000 })
    io.sockets.emit('users', onlineUsers); //update the scores list
    io.sockets.emit('drawing', 'clear');
    for (var i = 0; i < onlineUsers.length; i++)
        onlineUsers[i].status = 'idle';

    index = onlineUsers.findIndex(user => user.socketID === currentUser.socketID);
    if (index != -1)
        onlineUsers[index].mustDraw = false;
    linesHistory = [];
    currentUser = undefined;
    currentWord = undefined;
    isRoundRunning = false;
    //TODO: Update highscores
    setTimeout(startRound, 4000);
}

function checkIfEverybodyGuessed() {
    for (var i = 0; i < onlineUsers.length; i++)
        if (onlineUsers[i].status == 'guessing')
            return;
    // If there was not found an user who still has to guess, end the round
    endRound();
}


function chooseRandomWord() {
    index = Math.floor(Math.random() * words.length);
    currentWord = words[index];
}

