from flask import Flask, render_template, url_for, request, redirect, jsonify
import flask_cache_bust as cache_bust
from game_support import create_game, game_id_str_valid
from datetime import datetime

app = Flask(__name__)
cache_bust.init_cache_busting(app)

def make_success_response(data):
    return jsonify({"status": "SUCCESS", "data": data})

def make_error_response(errors):
    return jsonify({"status": "ERROR", "errors": errors})

@app.route('/')
def setup():
    return render_template('setup.html',
                           css_url=url_for('static', filename='setup.css'),
                           js_url=url_for('static', filename='setup.js'))

@app.route('/create-game', methods=['POST'])
def create_game_endpoint():
    boardname = request.form.get("boardName", None)
    if boardname is None:
        return make_error_response(["You must choose a date to proceed."])
    boardname = datetime.strptime(boardname, "%Y-%m-%d").strftime("%b%d%y")
    game_id = create_game(boardname)
    if game_id is None:
        return make_error_response(["No board could be found for the date you selected."])
    else:
        return make_success_response({"game_id": game_id})

@app.route('/game-exists', methods=['POST'])
def game_exists_endpoint():
    game_id = request.form.get("gameId", None)
    if game_id is None:
        return make_error_response(["You must provide a game ID to proceed."])
    if game_id_str_valid:
        return make_success_response({})
    return make_error_response(['No game could be found with the provided ID.'])

@app.route('/crossword/<game_id>', methods=['GET'])
def crossword(game_id):
    return render_template('crosswords.html',
                           css_url=url_for('static', filename='crosswords.css'),
                           js_url=url_for('static', filename='crosswords.js'))

if __name__ == "__main__":
    app.run(host='0.0.0.0')
