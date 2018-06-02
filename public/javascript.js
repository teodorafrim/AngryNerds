
$(document).ready(function () {


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
    $('#addWord').on("click", function () {
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

    // TODO: Fill the highscores table with the received data.
    // Get the highscores when the highscore page is ready.
    const currentPage = window.location.pathname.split('/')[window.location.pathname.split('/').length-1];
    if (currentPage=='highscore.html') {
        $(document).ready(function () {
            $.ajax({
                type: 'GET',
                url: 'http://localhost:3000/highscore',
                dataType: 'json'
            });
        });
    }
});

    // TODO: Update the highscores after every game.

