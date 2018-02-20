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

GAMES = {}
IDS = []
COLORS = ['purple', 'red', 'green', 'orange']

def get_board_name_list():
    puzfiles = os.listdir('./puzzles/')
    for puzfile in puzfiles:
        puz = puzfile.replace(".puz", "")
        GAMES[puz] = None

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
    GAMES[board_name] = {
        'players': {}, 
        'cells': {}, 
        'puzzleSpec': read_puzzle(board_name),
        'colors': [color for color in COLORS]
    }

def remove_player(game, uuid):
    cursor = game['players'][uuid]['cursor']
    orientation = game['players'][uuid]['orientation']
    if cursor is not None:
        game['cells'][cursor]['selected'][orientation].remove(uuid)
        send_updates_for_cells([cursor], game, uuid)
    game['colors'].append(game['players'][uuid]['color'])
    del game['players'][uuid]
    IDS.remove(uuid)

def add_player(game, uuid, websocket):
    color = random.choice(game['colors'])
    game['colors'].remove(color)
    game['players'][uuid] = {'websocket': websocket, 'cursor': None, 'orientation': None, 
                             'color': color}
    IDS.append(uuid)

@asyncio.coroutine
def run_game(websocket, path):
    board_name = None
    while True:
        init_info = yield from websocket.recv()
        init_info = json.loads(init_info)
        if not 'boardName' in init_info:
            yield from send_error(websocket, path, "Please provide a board name.")
        board_name = init_info['boardName']
        if not board_name in GAMES:
            yield from send_error(websocket, path, "Board does not exist.")
        else:
            break
    if GAMES[board_name] is None:
        create_board(board_name)
    game = GAMES[board_name]
    if 'uuid' in init_info and init_info['uuid'] in game['players']:
        uuid = init_info['uuid']
    else:
        uuid = get_random_id() 
        add_player(game, uuid, websocket)
    yield from send_board(websocket, path, game, uuid)
    try:
        while True:
            update_message = yield from websocket.recv()
            update = json.loads(update_message)
            yield from handle_update(websocket, path, update, game)
    except websockets.exceptions.ConnectionClosed:
        remove_player(game, uuid)

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
        orientation = update['data'][1]
        if old_cursor is not None:
            cells[old_cursor]['selected'][old_orientation].remove(uuid)
            cursors_to_update.append(old_cursor)
        game['players'][uuid]['cursor'] = cursor
        game['players'][uuid]['orientation'] = orientation
        cells[cursor]['selected'][orientation].append(uuid)
        cursors_to_update.append(cursor)
    if update_type == 'letterPlaced':
        cells[cursor]['letter'] = update['data'][1]
        cursors_to_update.append(cursor)
    send_updates_for_cells(cursors_to_update, game, uuid)

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
def send_board(websocket, path, game, uuid):
    message = {'puzzleSpec': game['puzzleSpec'], 
               'updates': get_updates_from_cells(game, uuid), 
               'uuid': uuid}
    yield from websocket.send(json.dumps(message))

@asyncio.coroutine
def send_error(websocket, path, error_msg):
    print("sending error: " + error_msg)
    yield from websocket.send(json.dumps({"error": error_msg}))
    
def run():
    get_board_name_list()
    start_server = websockets.serve(run_game, '0.0.0.0', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
  
run()
