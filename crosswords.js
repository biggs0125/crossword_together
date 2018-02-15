// BEGIN SETUP FUNCTIONS

const makeSquare = (x,y) => {
  const square = $("<td>");
  square.addClass("board-cell");
  square.attr("loc", `${x},${y}`);
  $(square).click(handleCellClick);
  const numHolder = $("<span>");
  numHolder.addClass("num-holder");
  square.append(numHolder);
  const letterHolder = $("<span>");
  letterHolder.addClass("letter-holder");
  square.append(letterHolder);
  return square;
};

const makeBoard = (dims) => {
  const board = $("<table>");
  board.attr("id", "board");
  $("#board-holder").append(board)
  for (let i=0; i < dims[0]; i++) {
    const row = $("<tr>");
	row.addClass("board-row");
    for (let j=0; j < dims[1]; j++) {
	  row.append(makeSquare(i,j));
	}
	board.append(row);
  }
}

const makeClue = (cluesElem) => (c) => {
  const clue = $("<div>");
  clue.addClass("clue");
  clue.text(c[0] + ". " + c[1]);
  $(clue).attr("clue-num", c[0]);
  cluesElem.append(clue);
  $(clue).click(handleClueClick(clue));
}

const fillCells = (cells) => {
  cells.forEach((cell) => {
	getCell(cell).addClass("filled-cell");
  });
}

const addClues = (across, down) => {
  const acrossClues = $("#across-clues");
  const downClues = $("#down-clues");
  across.forEach(makeClue(acrossClues));
  down.forEach(makeClue(downClues));
}

const addNumbers = (numbers) => {
  numbers.forEach((number) => {
    const cell = getCell([number[0],number[1]]);
	$(cell).attr("num", number[2]);
	cell.children(".num-holder").text(number[2]);
	cell.click(() => {
	  selectClue($(`[clue-num='${number[2]}']`));
	})
  });
}

const setup = () => {
  dims = [15,15]
  filled = [];
  makeBoard(dims);
  $(document).keydown(handleKeypress(dims, filled));
  const socket = new WebSocket('ws://localhost:5678');
  socket.onmessage = (event) => {
	const data = JSON.parse(event.data);
	const acrossClues = data['across'];
	const downClues = data['down'];
	const cellNumbers = data['nums'];
	addNumbers(cellNumbers);
	addClues(acrossClues, downClues);
  };
}

// END SETUP FUNCTIONS

// BEGIN GETTERS

const getCell = (cell) => {
  return $(`td[loc='${cell[0]},${cell[1]}']`);
}

const getClue = (clue) => {
  return $(`[clue-num='${clue}']`)
}

const getLocForCell = (cellElement) => {
  const loc = cellElement.attr("loc");
  if (!loc) {
    return null;
  }
  const xy = loc.split(",");
  return xy.map((x) => parseInt(x));
}

const getCellForClue = (clue) => {
  const cellElement = $(`[num='${clue}']`);
  return getLocForCell(cellElement);
}

const getClueNumForClue = (clueElement) => {
  return clueElement.attr("clue-num");
}

// END GETTERS

// BEGIN UPDATERS

const updateSelectedCell = (newSelected, opt_skipUpdateClue) => {
  const invalidCode = validateCell(newSelected);
  if (invalidCode) {
	return invalidCode;
  }
  getCell(selectedCell).removeClass("selected-cell");
  selectedCell = newSelected;
  const cell = getCell(selectedCell)
  cell.addClass("selected-cell");
  const num = cell.attr("num");
  if (!opt_skipUpdateClue) {
	updateSelectedClue(num, true);
  }
  return true;
}

const updateSelectedClue = (newSelected, opt_skipUpdateCell) => {
  getClue(selectedClue).removeClass("selected");
  selectedClue = newSelected;
  getClue(selectedClue).addClass("selected");
  const cell = getCellForClue(newSelected);
  if (!opt_skipUpdateCell && !!cell) {
	updateSelectedCell(cell, true);
  }
}

const selectCell = (cellElement) => {
  updateSelectedCell(getLocForCell(cellElement));
}

const selectClue = (clueElement) => {
  updateSelectedClue(getClueNumForClue(clueElement));
}

const putCharInSelected = (c) => {
  const cell = getCell(selectedCell); 
  cell.children(".letter-holder")
    .text(String.fromCharCode(c));
  if (c !== 32) {
    cell.addClass("has-letter");
  } else {
	cell.removeClass("has-letter");
  }
}

// END UPDATERS

// BEGIN HANDLERS

const handleCellClick = (event) => {
  selectCell($(event.currentTarget));
}

const handleKeypress = (dims, filled) => (event) => {
  if (event.which > 36 && event.which < 41) {
	let deltaX = 0;
	let deltaY = 0;
	switch(event.which) {
	  case 37:
		deltaY = -1;
		break;
	  case 38:
		deltaX = -1;
		break;
      case 39:
		deltaY = 1;
		break;
      case 40:
		deltaX = 1;
		break;		
	}
	const curX = selectedCell[0];
	const curY = selectedCell[1];
	let newX = curX + deltaX;
	let newY = curY + deltaY;
	let invalidCode;
	while (invalidCode = updateSelectedCell([newX, newY]) === 1) {
	  newX += deltaX;
	  newY += deltaY;
	}
	if (invalidCode === 2) {
	  updateSelectedCell([curX, curY]);
	}
  } else if (event.which > 64 && event.which < 91) {
	putCharInSelected(event.which);
  } else if (event.which === 8 || event.which === 46) {
	putCharInSelected(32)
  }
}

const handleClueClick = (clue) => () => {
  selectClue(clue);
}

// END HANDLERS

// BEGIN HELPERS

const validateCell = (cell) => {
  const cellsEq = (cell1) => (cell2) => 
    cell1[0] === cell2[0] && cell1[1] === cell2[1];
  if(filled.some(cellsEq([cell[0], cell[1]]))) {
    return 1;
  };
  if (cell[0] >= dims[0] || cell[0] < 0 || 
	  cell[1] >= dims[1] || cell[1] < 0) {
	return 2;	  
  }
  return 0;
}

// END HELPERS

let selectedCell = [-1,-1];
let selectedClue = -1;
let filled, dims;

$(document).ready(setup);