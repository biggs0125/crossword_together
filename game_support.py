import json
import db
import random

GAMES = {}
COLORS = ['purple', 'red', 'green', 'orange']

def get_random_id():
    new_id = random.randint(0, 10000000)
    if new_id in db.get_all_game_ids():
        return get_random_id()
    else:
        return new_id

# GAME CREATION, SAVING, & LOADING
def create_game(board_name):
    game_id = get_random_id()
    game = {
        'boardName': board_name,
        'players': {}, 
        'cells': {},
        'colors': [color for color in COLORS]
    }
    GAMES[game_id] = game
    db.create_game(game_id, game_to_save_blob(game))
    return game_id

def save_game(game, game_id):
    db.save_game(game_id, game_to_save_blob(game))

def game_to_save_blob(game):
    return json.dumps({
        'boardName': game['boardName'],
        'cells': game['cells']
    })

def save_blob_to_game(blob):
    saved_info = json.loads(blob)
    return {
        'boardName': saved_info['boardName'],
        'players': {},
        'cells': saved_info['cells'],
        'colors': [color for color in COLORS]
    }

def load_game(game_id):
    blob = db.load_game(game_id)
    if blob is None:
        return None
    game = save_blob_to_game(blob)
    GAMES[game_id] = game
    return game

def get_or_load_game(game_id):
    if game_id in GAMES:
        return GAMES[game_id]
    return load_game(game_id)

def game_empty(game_id):
    del GAMES[game_id]
