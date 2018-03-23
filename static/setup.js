const setupHandlers = () => {
  $('#submit-board-name').click(() => {
    const boardName = $('#board-name').val();
    $.post({
      'url': "create-game",
      'data': {"boardName": boardName},
      'success': (result) => {
        if (result['status'] === "SUCCESS") {
          const gameId = result['data']['game_id'];
          window.location =  "crossword/" + gameId;
        } else {
          $("#board-name-error").text(result['errors'][0]);
        }
      }
    });
  });                             
  $('#submit-game-id').click(() => {
    const gameId = $('#game-id').val();
    $.post({
      'url': "game-exists",
      'data': {"gameId": gameId},
      'success': (result) => {
        if (result['status'] === "SUCCESS") {
          window.location = "crossword/" + gameId;
        } else {
          $("#game-id-error").text(result['errors'][0]);
        }
      }
    });
  });
}

$(document).ready(setupHandlers);
