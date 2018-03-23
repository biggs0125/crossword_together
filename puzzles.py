# across:     [[# : int, clue : string], ...]
# down:       [[# : int, clue "string"], ...]
# cells_array:[[x, y, #], ...]
# filled:     [[x, y], ...]

import puz
import os.path

def filename_from_board(board_name):
    return "puzzles/" + board_name + ".puz"

def does_board_exist(board_name):
    return os.path.isfile(filename_from_board(board_name))

def read_puzzle(board_name):
    try:
        p = puz.read(filename_from_board(board_name))
    except FileNotFoundError:
        return None
    numbering = p.clue_numbering()
    cells = dict()

    across = []
    for clue in numbering.across:
        across.append([clue["num"], clue["clue"]])
        cell = clue["cell"]
        cells[clue["num"]] = [cell // p.width, cell % p.width]

    down = []
    for clue in numbering.down:
        down.append([clue["num"], clue["clue"]])
        cell = clue["cell"]
        cells[clue["num"]] = [cell // p.width, cell % p.width]

    filled = []
    for i in range (p.width * p.height):
        c = p.fill[i]
        if (c == "."):
            filled.append([i // p.width, i % p.width])

    cells_array = [[cells[key], key] for key in cells.keys()]

    return {"across": across,
            "down": down,
            "nums": cells_array,
            "filled": filled,
            "dims": [p.height, p.width]}

