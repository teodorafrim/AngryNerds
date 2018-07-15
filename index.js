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
var highscores = require('./resources/highscores');

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

    var addedWords = [];
    var badWords = [];


    for (let newWord in wordArray) {
        // Check if data is in String format
        if (!isNaN(wordArray[newWord])) {
            console.log(wordArray[newWord] + 'is an invalid input');
            badWords.push(wordArray[newWord]);
        }
        else {

            var isDuplicate = false;

            // Check if word already exists
            for (let existingWord in words) {
                if (words[existingWord] === wordArray[newWord]) isDuplicate = true;
            }

            // If not a duplicate, add it to the array
            if (isDuplicate) {
                console.log(wordArray[newWord] + ' is a duplicate');
                badWords.push(wordArray[newWord]);
            }
            else {

                words.push(wordArray[newWord]);
                addedWords.push(wordArray[newWord]);
                const json = JSON.stringify(words);
                fs.writeFile("./resources/words.json", json, (err) => {
                    if (err) throw err;
                }
                );
            }
        }
    }

    if (badWords.length > 0) {
        if (addedWords.length > 0)
            res.status(400).json({ message: `Duplicate/Invalid inputs found: "${badWords}".\n"${addedWords}" successfully added.` });
        else
            res.status(400).json({ message: `Duplicate/Invalid inputs found: "${badWords}".` });
    }
    else
        res.status(200).json({ message: `"${addedWords}" successfully added.` })
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
        disconnectedUser = onlineUsers[index];
        // If the disconnected user was also logged in (otherwise his ID won't show up in onlineUsers)
        if (index !== -1) {
            onlineUsers.splice(index, 1);
            io.sockets.emit('new message', { msg: `${disconnectedUser.username} left.` });

            if (isRoundRunning == true && onlineUsers.length < 2) {
                endGame();
            }

            else {
                // End the round when the player to draw disconnects
                if (currentUser != undefined) {
                    if (disconnectedUser.socketID === currentUser.socketID) {
                        endRound();
                    }

                    else if (isRoundRunning) {
                        checkIfEverybodyGuessed();
                    }
                }
            }
        }
        console.log('Disconnected: %s sockets connected', io.engine.clientsCount);
        socket.broadcast.emit('users', onlineUsers);
    });

    //Send Message
    socket.on('send message', function (data) {
        let index = onlineUsers.findIndex(user => user.socketID === socket.id);
        let username = onlineUsers[index].username;

        // The drawer and those who have already guessed are not allowed to send messages
        if (onlineUsers[index].status != 'drawing' && onlineUsers[index].status != 'guessed') {
            // If the player has guessed the word
            if (isRoundRunning && data === currentWord) {
                onlineUsers[index].status = 'guessed';
                onlineUsers[index].score += 10;
                guessedCounter += 1; //Increment the counter if a user guessed the current word
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
            //Notify new users who is currently drawing
            socket.emit('notification', { msg: `It's ${currentUser.username}'s turn to draw.`, delay: 2500 });

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
var timeout;
var timeWarning;
var guessedCounter = 0;

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
            currentUser = onlineUsers[i];
            break;
        }

    // If one player was found, start actually the round
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
            .emit('notification', { msg: `It's ${currentUser.username}'s turn to draw. You have 60 seconds to guess.`, delay: 2500 });
        console.log("Word to guess: ", currentWord);
        isRoundRunning = true;
        timeout = setTimeout(function () {
            endRound();
            io.sockets.emit('new message', { msg: 'Time is up!' });
        }, 60000);
        var timeCounter = 50;
        timeWarning = setInterval(function() {
            io.sockets.emit('new message', { msg: `${timeCounter} seconds remaining.` });
            timeCounter -= 10;
        }, 10000);
    }

    // End the game if not
    else
        endGame();

}

// End the game and start a new one if there are enough players
function endGame() {
    isGameRunning = false;
    if (isRoundRunning)
        endRound();
    // start a new game if there are enough players
    if (onlineUsers.length > 1) {
        io.sockets.emit('notification', { msg: 'Game has ended. Starting a new game ...', delay: 3000 });
        setTimeout(startGame, 3100);
    }
    else if (onlineUsers.length == 1) {
        setTimeout(function () {
            if (onlineUsers.length == 1)
                io.to(onlineUsers[0].socketID).emit('notification', { msg: 'Waiting for more players ...', delay: 0 });
        }, 2600);
    }

}
// Notify the users, reset variables, start a new round.
// Note: The round is ended when everybody has guessed the word or the drawer has disconnected.
function endRound() {
    clearTimeout(timeout);
    clearInterval(timeWarning);
    //Update the score of the user that drew after everybody guessed the word / after the timer ran out
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].status == 'drawing' && guessedCounter > 0)
            onlineUsers[i].score += Math.round((guessedCounter / (onlineUsers.length - 1)) * 10);
        if (onlineUsers[i].status == 'drawing' && guessedCounter == 0)
            onlineUsers[i].score = 0;
    }

    io.to(currentUser.socketID).emit('finished draw');
    linesHistory = [];
    io.sockets.emit('notification', { msg: 'Round has ended.', delay: 2500 })
    io.sockets.emit('users', onlineUsers); //update the scores list
    io.sockets.emit('drawing', 'clear');

    for (var i = 0; i < onlineUsers.length; i++)
        onlineUsers[i].status = 'idle';
    index = onlineUsers.findIndex(user => user.socketID === currentUser.socketID);
    if (index != -1)
        onlineUsers[index].mustDraw = false;

    currentUser = undefined;
    currentWord = undefined;
    guessedCounter = 0;
    isRoundRunning = false;
    updateHighscores();
    if (isGameRunning)
        setTimeout(startRound, 4000);
}

function updateHighscores() {
    highscores = require('./resources/highscores');
    for (var i = 0; i < onlineUsers.length; i++) {
        newUser = onlineUsers[i].username;
        newScore = onlineUsers[i].score;
        for (let name in highscores) {
            if (name == newUser) {
                if (newScore > highscores[name])
                    highscores[name] = newScore;
            }
            else
                highscores[newUser] = newScore;
        }
    }
    const json = JSON.stringify(highscores);
    fs.writeFile("./resources/highscores.json", json, (err) => {
        if (err) throw err;
    }
    );
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
