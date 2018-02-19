# across:     [[# : int, clue : string], ...]
# down:       [[# : int, clue "string"], ...]
# cells_array:[[x, y, #], ...]
# filled:     [[x, y], ...]

import puz
import asyncio
import websockets
import json
import random

GAMES = {}
IDS = []

def get_random_id():
    new_id = random.randint(0, 10000000)
    if new_id in IDS:
        return get_random_id()
    else:
        return new_id

def read_puzzle(boardName):
    p = puz.read(boardName+".puz")
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
    GAMES[board_name] = {'players': {}, 'cells': {}, 'puzzleSpec': read_puzzle(board_name)}

def remove_player(game, uuid):
    cursor = game['players'][uuid]['cursor']
    if cursor is None:
        return
    cell = game['cells'][cursor]
    cell['removed'].append(uuid)
    del game['players'][uuid]
    send_updates_for_cell(cursor, game, uuid)
    IDS.remove(uuid)
    print("removed player " + str(uuid))

def add_player(game, uuid, websocket):
    game['players'][uuid] = {'websocket': websocket, 'cursor': None}
    IDS.append(uuid)
    print("added player " + str(uuid))


@asyncio.coroutine
def run_game(websocket, path):
    init_info = yield from websocket.recv()
    init_info = json.loads(init_info)
    if not 'boardName' in init_info:
        return
    board_name = init_info['boardName']
    if not board_name in GAMES:
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
    if not cursor in cells:
        cells[cursor] = {'selected': [], 'removed': []}
    if update_type == 'cursorMoved':
        oldCursor = game['players'][uuid]['cursor']
        if oldCursor is not None:
            cells[oldCursor]['selected'].remove(uuid)
        game['players'][uuid]['cursor'] = cursor
        cells[cursor]['selected'].append(uuid)
    if update_type == 'letterPlaced':
        cells[cursor]['letter'] = update['data'][1]
    send_updates_for_cell(cursor, game, uuid)

def send_updates_for_cell(cursor, game, uuid):
    for u in game['players']:
        if u != uuid:
            updates = create_updates_for_cell(cursor, game, u)
            yield from game['players'][u]['websocket'].send(json.dumps(updates))    

def create_updates_for_cell(cursor, game, uuid):
    cell = game['cells'][cursor]
    updates = []
    selected = filter(lambda x: x != uuid, cell['selected'])
    removed = filter(lambda x: x != uuid, cell['removed'])
    loc = cursor_to_loc(cursor)
    for u in list(selected):
        updates.append({'type': 'cursorMoved', 'data': [loc, u]})
    if ('letter' in cell):
        updates.append({'type': 'letterPlaced', 'data': [loc, cell['letter']]})
    for u in removed:
        updates.append({'type': 'playerRemoved', 'data': [u]})
    cell['removed'] = []
    return updates
        

def get_updates_from_cells(game, uuid):
    updates = []
    for cursor in game['cells']:
        updates = updates + create_updates_for_cell(cursor, game, uuid)
    return updates

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

def run():
    start_server = websockets.serve(run_game, '0.0.0.0', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
  
run()
