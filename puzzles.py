# across:     [[# : int, clue : string], ...]
# down:       [[# : int, clue "string"], ...]
# cells_array:[[x, y, #], ...]
# filled:     [[x, y], ...]

import puz
import asyncio
import websockets
import json
import random
import os
import threading

GAMES = {}
IDS = []
COLORS = ['purple', 'red', 'green', 'orange']

def get_random_id():
    new_id = random.randint(0, 10000000)
    if new_id in IDS:
        return get_random_id()
    else:
        return new_id

def read_puzzle(boardName):
    p = puz.read("puzzles/" + boardName + ".puz")
    numbering = p.clue_numbering()
    cells = dict()

    across = []
    for clue in numbering.across:
        across.append([clue["num"], clue["clue"]])
        cell = clue["cell"]
        cells[clue["num"]] = [cell // p.height, cell % p.width]

    down = []
    for clue in numbering.down:
        down.append([clue["num"], clue["clue"]])
        cell = clue["cell"]
        cells[clue["num"]] = [cell // p.height, cell % p.width]

    filled = []
    for i in range (p.width * p.height):
        c = p.fill[i]
        if (c == "."):
            filled.append([i // p.height, i % p.width])

    cells_array = [[cells[key], key] for key in cells.keys()]

    return {"across": across,
            "down": down,
            "nums": cells_array,
            "filled": filled,
            "dims": [p.height, p.width]}

def create_board(board_name):
    try:
        puzzleSpec = read_puzzle(board_name)
        game_id = get_random_id()
        GAMES[game_id] = {
            'boardName': board_name,
            'players': {}, 
            'cells': {}, 
            'puzzleSpec': puzzleSpec,
            'colors': [color for color in COLORS]
        }
        return game_id
    except FileNotFoundError:
        return None

@asyncio.coroutine
def remove_player(game, uuid):
    cursor = game['players'][uuid]['cursor']
    orientation = game['players'][uuid]['orientation']
    if cursor is not None:
        game['cells'][cursor]['selected'][orientation].remove(uuid)
        yield from send_updates_for_cells([cursor], game, uuid)
    game['colors'].append(game['players'][uuid]['color'])
    del game['players'][uuid]
    IDS.remove(uuid)

def add_player(game, uuid, websocket):
    if len(game['colors']) == 0:
        return False
    color = random.choice(game['colors'])
    game['colors'].remove(color)
    game['players'][uuid] = {'websocket': websocket, 'cursor': None, 'orientation': None, 
                             'color': color}
    IDS.append(uuid)
    return True

@asyncio.coroutine
def run_game(websocket, path):
    board_name = None
    while True:
        init_info = yield from websocket.recv()
        init_info = json.loads(init_info)
        if 'boardName' in init_info:
            board_name = init_info['boardName']
            game_id = create_board(board_name)
            if game_id is None:
                yield from send_error(websocket, path, "board-name", 
                                      "The provided board name does not exist.")
                continue
        elif 'gameId' in init_info:
            try:
                game_id = int(init_info['gameId'])
            except ValueError:
                yield from send_error(websocket, path, "game-id",
                                      "The provided game ID is not a valid format.")
            if not game_id in GAMES:
                yield from send_error(websocket, path, "game-id", 
                                      "The provided game ID does not exist.")
                continue
            
        game = GAMES[game_id]
        if 'uuid' in init_info and init_info['uuid'] in game['players']:
            uuid = init_info['uuid']
        else:
            uuid = get_random_id()
            if add_player(game, uuid, websocket):
                break
            else:
                yield from send_error(websocket, path, "game-id", 
                                      "The game you are trying to join is full.")
    yield from send_board(websocket, path, game, uuid, game_id)
    try:
        while True:
            update_message = yield from websocket.recv()
            update = json.loads(update_message)
            yield from handle_update(websocket, path, update, game)
    except websockets.exceptions.ConnectionClosed:
        yield from remove_player(game, uuid)

@asyncio.coroutine
def handle_update(websocket, path, update, game):
    if not 'uuid' in update or not 'type' in update or not 'data' in update:
        return
    uuid = update['uuid']
    if not uuid in game['players']:
        return
    update_type = update['type']
    cells = game['cells']
    loc = update['data'][0]
    cursor = loc_to_cursor(loc)
    cursors_to_update = []
    if not cursor in cells:
        cells[cursor] = {'selected': {'down': [], 'across': []}}
    if update_type == 'cursorMoved':
        old_cursor = game['players'][uuid]['cursor']
        old_orientation = game['players'][uuid]['orientation']
        if old_cursor is not None:
            cells[old_cursor]['selected'][old_orientation].remove(uuid)
            cursors_to_update.append(old_cursor)
        orientation = update['data'][1]
        game['players'][uuid]['cursor'] = cursor
        game['players'][uuid]['orientation'] = orientation
        cells[cursor]['selected'][orientation].append(uuid)
        cursors_to_update.append(cursor)
    if update_type == 'letterPlaced':
        cells[cursor]['letter'] = update['data'][1]
        cursors_to_update.append(cursor)
    yield from send_updates_for_cells(cursors_to_update, game, uuid)

@asyncio.coroutine
def send_updates_for_cells(cursors, game, uuid):
    for u in game['players']:
        if u != uuid:
            updates = create_updates_for_cells(cursors, game, u)
            yield from game['players'][u]['websocket'].send(json.dumps(updates))    

def create_updates_for_cells(cursors, game, uuid):
    updates = []
    for cursor in cursors:
        cell = game['cells'][cursor]
        otherSelectedDown = filter(lambda x: x != uuid, cell['selected']['down'])
        othersDown = map(lambda x: {'uuid': x, 'color': game['players'][x]['color']}, 
                         otherSelectedDown)
        otherSelectedAcross = filter(lambda x: x != uuid, cell['selected']['across'])
        othersAcross = map(lambda x: {'uuid': x, 'color': game['players'][x]['color']}, 
                           otherSelectedAcross)
        state = {}
        state['otherSelected'] = {'down': list(othersDown), 'across': list(othersAcross)}
        if 'letter' in cell:
            state['letter'] = cell['letter']
        updates.append({
            'loc': cursor_to_loc(cursor), 
            'state': state
        })
    return updates

def get_updates_from_cells(game, uuid):
    return create_updates_for_cells(game['cells'].keys(), game, uuid)

def cursor_to_loc(cursor):
    return list(map(lambda x: int(x), cursor.split(',')))

def loc_to_cursor(loc):
    return ','.join(map(lambda x: str(x), loc))
		
@asyncio.coroutine
def send_board(websocket, path, game, uuid, game_id):
    message = {'puzzleSpec': game['puzzleSpec'], 
               'updates': get_updates_from_cells(game, uuid), 
               'uuid': uuid,
               'gameId': game_id}
    yield from websocket.send(json.dumps(message))

@asyncio.coroutine
def send_error(websocket, path, error_field, error_msg):
    yield from websocket.send(json.dumps({"error": {"message": error_msg, "field": error_field}}))
    
def run():
    start_server = websockets.serve(run_game, '0.0.0.0', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)
    t = threading.Thread(target=asyncio.get_event_loop().run_forever)
    t.start()

if __name__ == "__main__":
    run()
    
