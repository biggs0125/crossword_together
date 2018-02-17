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

def readPuzzle(boardName):
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
            "filled": filled}

def create_board(board_name):
    GAMES[board_name] = {'players': {}, 'cells': {}, 'puzzleSpec': readPuzzle(board_name)}

def add_player(board_name, uuid, websocket):
    GAMES[board_name]['players'][uuid] = {'websocket': websocket, 'cursor': None}

@asyncio.coroutine
def run_game(websocket, path):
    print("connection received")
    init_info = yield from websocket.recv()
    init_info = json.loads(init_info)
    if not 'boardName' in init_info:
        return
    board_name = init_info['boardName']
    if not board_name in GAMES:
        create_board(board_name)
    uuid = None
    if 'uuid' in init_info and init_info['uuid'] in GAMES[board_name]['players']:
        uuid = init_info['uuid']
    yield from send_board(websocket, path, board_name, uuid)
    while True:
        update_message = yield from websocket.recv()
        update = json.loads(update_message)
        yield from handle_update(websocket, path, update, board_name)

@asyncio.coroutine
def handle_update(websocket, path, update, board_name):
    if not 'uuid' in update or not 'type' in update or not 'data' in update:
        return
    uuid = update['uuid']
    if not uuid in GAMES[board_name]['players']:
        return
    update_type = update['type']
    cells = GAMES[board_name]['cells']
    if not len(update['data']) > 0:
        return
    loc = update['data'][0]
    locStr = locToLocStr(loc)
    if update_type == 'cursorMoved':
        if not locStr in cells:
            cells[locStr] = {'selected': []}
        cursor = GAMES[board_name]['players'][uuid]['cursor']
        if cursor is not None:
            cells[cursor]['selected'].remove(uuid)
        GAMES[board_name]['players'][uuid]['cursor'] = locStr
        cells[locStr]['selected'].append(uuid)
    if update_type == 'letterPlaced':
        if not len(update['data']) > 1:
            return
        if not locStr in cells:
            cells[locStr] = {'selected': []}
        cells[locStr]['letter'] = update['data'][1]
    for u in GAMES[board_name]['players']:
        if u != uuid:
            updates = createUpdateForCell(loc, cells[locStr], u)
            yield from GAMES[board_name]['players'][u]['websocket'].send(json.dumps(updates))

def createUpdateForCell(loc, cell, uuid):
    updates = []
    selected = filter(lambda x: x != uuid, cell['selected'])
    for u in list(selected):
        updates.append({'type': 'cursorMoved', 'data': [loc, u]})
    if ('letter' in cell):
        updates.append({'type': 'letterPlaced', 'data': [loc, cell['letter']]})
    return updates
        

def getUpdatesFromCells(cells, uuid):
    updates = []
    for loc in cells:
        updates = updates + createUpdateForCell(locStrToLoc(loc), cells[loc], uuid)
    return updates

def locStrToLoc(locStr):
    return list(map(lambda x: int(x), locStr.split(',')))

def locToLocStr(loc):
    return ','.join(map(lambda x: str(x), loc))
		
@asyncio.coroutine
def send_board(websocket, path, board_name, uuid):
    game = GAMES[board_name]
    if uuid is None:
        uuid = get_random_id() 
        add_player(board_name, uuid, websocket)
    message = {'puzzleSpec': game['puzzleSpec'], 
               'updates': getUpdatesFromCells(game['cells'], uuid), 
               'uuid': uuid}
    yield from websocket.send(json.dumps(message))

def run():
    start_server = websockets.serve(run_game, '0.0.0.0', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
  
run()
