import asyncio
import websockets
import random
import time
import json
from game_support import save_game, get_or_load_game, game_empty
from puzzles import read_puzzle

@asyncio.coroutine
def remove_player(game, uuid):
    cursor = game['players'][uuid]['cursor']
    orientation = game['players'][uuid]['orientation']
    if cursor is not None:
        game['cells'][cursor]['selected'][orientation].remove(uuid)
        yield from send_updates_for_cells([cursor], game, uuid)
    game['colors'].append(game['players'][uuid]['color'])
    del game['players'][uuid]
    clean_cells([cursor], game)

def add_player(game, uuid, websocket):
    if len(game['colors']) == 0:
        return False
    color = random.choice(game['colors'])
    game['colors'].remove(color)
    game['players'][uuid] = {'websocket': websocket, 'cursor': None, 'orientation': None,
                             'color': color}
    return True

@asyncio.coroutine
def handle_connection_closed(game, game_id, uuid):
    yield from remove_player(game, uuid)
    if len(game['players']) == 0:
        save_game(game, game_id)
        game_empty(game_id)

@asyncio.coroutine
def run_game(websocket, path):
    board_name = None
    while True:
        init_info = yield from websocket.recv()
        init_info = json.loads(init_info)
        if 'gameId' in init_info:
            try:
                game_id = int(init_info['gameId'])
            except ValueError:
                # The URL is malformed and so there's no point in keeping the connection open.
                yield from websocket.close()
        game = get_or_load_game(game_id)
        puzzle_spec = read_puzzle(game['boardName'])
        if puzzle_spec is None:
            yield from send_error(websocket, path, "board-name", 
                          "We do not have a board for the date you have chosen.")
            continue
        uuid = int(str(time.time()).replace(".","")[2:])
        if add_player(game, uuid, websocket):
            break
        yield from send_error(websocket, path, "game-id",
                              "The game you are trying to join is full.")
            
    yield from send_board(websocket, path, game, game_id, puzzle_spec, uuid)
    del puzzle_spec
    try:
        while True:
            update_message = yield from websocket.recv()
            update = json.loads(update_message)
            yield from handle_update(websocket, path, update, game, uuid)
    except websockets.exceptions.ConnectionClosed:
        yield from handle_connection_closed(game, game_id, uuid)

@asyncio.coroutine
def handle_update(websocket, path, update, game, uuid):
    if not 'type' in update or not 'data' in update:
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
    clean_cells(cursors_to_update, game)

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

def clean_cells(cursors, game):
    cells = game['cells']
    for cursor in cursors:
        if cursor in cells:
            cell = cells[cursor]
            if len(cell['selected']['down']) == 0 and len(cell['selected']['across']) == 0 \
               and ((not 'letter' in cell) or cell['letter'] == ' '):
                del cells[cursor]

def get_updates_from_cells(game, uuid):
    return create_updates_for_cells(game['cells'].keys(), game, uuid)

def cursor_to_loc(cursor):
    return list(map(lambda x: int(x), cursor.split(',')))

def loc_to_cursor(loc):
    return ','.join(map(lambda x: str(x), loc))

@asyncio.coroutine
def send_board(websocket, path, game, game_id, puzzle_spec, uuid):
    message = {'puzzleSpec': puzzle_spec,
               'updates': get_updates_from_cells(game, uuid),
               'gameId': game_id}
    yield from websocket.send(json.dumps(message))

@asyncio.coroutine
def send_error(websocket, path, error_field, error_msg):
    yield from websocket.send(json.dumps({"error": {"message": error_msg, "field": error_field}}))

def run():
    start_server = websockets.serve(run_game, '0.0.0.0', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()

if __name__ == "__main__":
    run()
