$(document).ready(function () {

    //AJAX Requests

    // TODO: Get the words when is somebody's turn to draw.
    //For now, everytime we click on send word, it gets the data (-> placeholder)
    $('#addWord').click(function () {
        $.ajax({
            type: 'GET',
            url: 'http://localhost:3000/words',
            dataType: 'json'
            /*Window alert success
            success: function (data){
                $.each(data,function (index,element) {
                   window.alert(element);
                });
            }*/
        });
    });


    // add-word PUT Request
    $('#addWord').on('click', function () {
        var $word = $('#typeWord').val();
        array = [$word];
        var json = JSON.stringify(array);
        console.log(json);
        $.ajax({
            type: 'PUT', //Auf Meilenstein 2 Anforderungen Zusammenfassung steht "POST"??
            contentType: "application/json; charset=utf-8",
            url: 'http://localhost:3000/add-word',
            data: json
        });
    });

    // Get the highscores when the highscore page is ready and update the highscores table.
    const currentPage = window.location.pathname.split('/')[window.location.pathname.split('/').length - 1];
    if (currentPage == 'highscore.html') {
        $(document).ready(function () {
            $.ajax({
                type: 'GET',
                url: 'http://localhost:3000/highscore',
                success: function (data) {
                    for (var key in data) {
                        $('#highscoresTable tbody').append(`<tr> <td>${key}</td> <td>${data[key]}</td> </tr>`);
                    }

                }
            });
        });
    }
});


// TODO: Update the highscores after every game.

//Skribbl javascript


var socket = io.connect();

var $chatInput = $('#submit');
var $message = $('#message');
var $chat = $('#chatMessages');
var $gameContainer = $('#gameContainer');

var $loginWindow = $('#loginWindow');
var $userForm = $('#userForm');
var $users = $('#users tbody');
var $username = $('#username');

var $canvas = $('#drawCanvas');
var $notification = $('#notificationWindow p');
var $notificationWindow = $('#notificationWindow');

//Submit the Message
$chatInput.click(function (e) {
    e.preventDefault();
    console.log($message.val()); //test
    socket.emit('send message', $message.val());
    $message.val(''); //clear it
});

//submit a new User + hide the Login Window + show Game Container
$userForm.submit(function (e) {
    e.preventDefault();
    console.log('Submitted'); //test
    if ($username.val()) {
        $loginWindow.addClass('hidden');
        $gameContainer.addClass('visible');
        socket.emit('new user', $username.val());
    }
    $username.val(''); //clear it
});

//Add the new users to our current user playing list
socket.on('users', function (data) {
    console.log(data.length);
    $users.empty();
    for (i = 0; i < data.length; i++) {
        console.log(data.length);
        $users.append(`<tr> <td>${data[i].username}</td> <td>${data[i].score}</td> </tr>`);
    }
});

//Add the Message to our Chat Window
socket.on('new message', function (data) {
    if (Object.keys(data).length === 1) {
        $chat.append('<p class="well"><strong>' + data.msg + '</p>');
    }
    else {
        $chat.append('<p class="well"><strong>' + data.user + '</strong>: ' + data.msg + '</p>');
    }
});

//Add the new users to our current user playing list
socket.on('users', function (data) {
    console.log(data.length);
    $users.empty();
    for (i = 0; i < data.length; i++) {
        console.log(data.length);
        $users.append(`<tr> <td>${data[i].username}</td> <td>${data[i].score}</td> </tr>`);
    }
});

<<<<<<< HEAD
socket.on('must draw', onMustDraw);
=======
//submit a new User + hide the Login Window + show Game Container
$userForm.submit(function (e) {
    e.preventDefault();
    console.log('Submitted'); //test
    if ($username.val()) {
        $loginWindow.addClass('hidden');
        $gameContainer.addClass('visible');
        socket.emit('new user', $username.val());
    }
    $username.val(''); //clear it
});
>>>>>>> a955f60e28f3dc8a4733dd7a3c0e60c0ce9b3b71

socket.on('notification', onNotification);

function onNotification(data) {
    $notificationWindow.show();
    $notification.text(data.msg);
    if (data.delay !== 0) {
        $notificationWindow.fadeOut(data.delay);
    }
}

function onMustDraw(data) {
    $notificationWindow.show();
    $notification.text(`It's your turn to draw: \n ${data}`);
    $notificationWindow.fadeOut(4000);
    
    addDrawingEventListeners();
}

//Canvas Drawing Logic

var canvas = document.getElementById('drawCanvas');
var context = canvas.getContext('2d');
var drawContainer = document.getElementById('drawContainer')

var current = {
    color: 'black'
};

var next = {
    x: undefined,
    y: undefined
}

var drawing = false;

function addDrawingEventListeners() {
    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mouseout', onMouseUp, false);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);
    console.log('Event listeners added');
}

function removeDrawingEventListeners() {
    canvas.removeEventListener('mousedown', onMouseDown, false);
    canvas.removeEventListener('mouseup', onMouseUp, false);
    canvas.removeEventListener('mouseout', onMouseUp, false);
    canvas.removeEventListener('mousemove', throttle(onMouseMove, 10), false);
    console.log('Event listeners removed');
}

addDrawingEventListeners();

socket.on('drawing', onDrawingEvent);

window.addEventListener('resize', onResize, false);

onResize();

function drawLine(x0, y0, x1, y1, color, emit) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    context.closePath();

    if (!emit) { return; }
    var w = canvas.width;
    var h = canvas.height;

    socket.emit('drawing', {
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color
    });
}

function onMouseDown(e) {
    drawing = true;
    current.x = e.clientX - drawContainer.offsetLeft;
    current.y = e.clientY - drawContainer.offsetTop;
}

function onMouseUp(e) {
    if (!drawing) { return; }
    drawing = false;

    drawLine(current.x, current.y, next.x, next.y, current.color, true);
}

function onMouseMove(e) {
    if (!drawing) { return; }
    next.x = e.clientX - drawContainer.offsetLeft;
    next.y = e.clientY - drawContainer.offsetTop;
    drawLine(current.x, current.y, next.x, next.y, current.color, true);
    current.x = e.clientX - drawContainer.offsetLeft;
    current.y = e.clientY - drawContainer.offsetTop;
}


// limit the number of events per second
function throttle(callback, delay) {
    var previousCall = new Date().getTime();
    return function () {
        var time = new Date().getTime();

        if ((time - previousCall) >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}

function onDrawingEvent(data) {
    if (data === 'clear') {
        canvas.clearRect(0, 0, canvas.width, canvas.height);
    }
    else {
    var w = canvas.width;
    var h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
    }
}


function onResize() {
    // Make the canvas fill its parent (will erase it's content)
    canvas.width = drawContainer.offsetWidth;
    canvas.height = drawContainer.offsetHeight;
    socket.emit('current drawing'); //request the current drawing and redraw it
}

