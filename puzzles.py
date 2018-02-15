# across:     [[# : int, clue : string], ...]
# down:       [[# : int, clue "string"], ...]
# cells_array:[[x, y, #], ...]

import puz
import asyncio
import websockets
import json

def readPuzzle():
	p = puz.read("washpost.puz")
	numbering = p.clue_numbering()
	cells = dict()

	across = []
	for clue in numbering.across:
		across.append([clue["num"], clue["clue"]])
		cell = clue["cell"]
		cells[clue["num"]] = [cell % p.width, cell // p.height]

	down = []
	for clue in numbering.down:
		down.append([clue["num"], clue["clue"]])
		cell = clue["cell"]
		cells[clue["num"]] = [cell % p.width, cell // p.height]

	cells_array = [cells[key]+[key] for key in cells.keys()]
	return json.dumps({"across": across, "down": down, "nums": cells_array})

def updateState(message):
	print(message)
  
@asyncio.coroutine
def get_updates(websocket, path):
	yield from send_board(websocket, path)
	while True:
		message = yield from websocket.recv()
		print(message)
		websocket.send("got it")
		
@asyncio.coroutine
def send_board(websocket, path):
	message = readPuzzle()
	yield from websocket.send(message)

@asyncio.coroutine		
def handler(websocket, path):
    consumer_task = asyncio.async(get_updates(websocket, path))
    producer_task = asyncio.async(send_updates(websocket, path))
    done, pending = yield from asyncio.wait(
        [consumer_task, producer_task],
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()
	
def run():
	start_server = websockets.serve(get_updates, 'localhost', 5678)
	asyncio.get_event_loop().run_until_complete(start_server)
	asyncio.get_event_loop().run_forever()
  
run()