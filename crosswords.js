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
  if (!cellInfo[x]) {
    cellInfo[x] = {};
  }
  cellInfo[x][y] = {
    number: 0, 
    filled: false, 
    letter: ' ', 
    clues: {'down': 0, 'across': 0},
    elem: square,
    highlighted: false,
    selected: false,
    selectedByOther: [], 
    letterElem: letterHolder, 
    numberElem: numHolder
  };
  return square;
};

const makeBoard = (dims) => {
  const board = $("<table>");
  board.attr("id", "board");
  $("#board-holder").append(board)
  for (let i = 0; i < dims[0]; i++) {
    const row = $("<tr>");
    row.addClass("board-row");
    for (let j=0; j < dims[1]; j++) {
      row.append(makeSquare(i,j));
    }
    board.append(row);
  }
}

const makeClue = (cluesElem, dir) => (c) => {
  const clue = $("<div>");
  clue.addClass("clue");
  clue.text(c[0] + ". " + c[1]);
  $(clue).attr("num", c[0]);
  $(clue).attr("dir", dir);
  cluesElem.append(clue);
  clueInfo[dir][c[0]] = {
    text: c[1], 
    cells: [],
    solved: 0,
    selected: false,
    elem: clue
  };
  $(clue).click(handleClueClick(clue));
}

const fillCells = (locs) => {
  locs.forEach((loc) => {
    getCell(loc).filled = true;
  });
}

const addClues = (across, down) => {
  const acrossClues = $("#across-clues");
  const downClues = $("#down-clues");
  across.forEach(makeClue(acrossClues, 'across'));
  down.forEach(makeClue(downClues, 'down'));
}

const addNumbers = (numbers) => {
  numbers.forEach((number) => {
    const cell = getCell(number[0]);
    cell.number = number[1];
  });
}

const associateCells = () => {
  let curAcross;
  let downDict = {};
  for (let i = 0; i < dims[0]; i++) {
    for (let j = 0; j < dims[1]; j++) {
      const cell = getCell([i,j]);
      if (cell.filled) {
        downDict[j] = null;
        curAcross = null;
        continue;
      }
      if (!curAcross) {
        curAcross = cell.number;
      } 
      cell.clues['across'] = curAcross;
      clueInfo['across'][curAcross].cells.push([i,j]);
      if (!downDict[j]) {
        downDict[j] = cell.number;
      }
      cell.clues['down'] = downDict[j];
      clueInfo['down'][downDict[j]].cells.push([i,j]);
    }
    curAcross = null;
  }
}

const doUpdates = (updates) => {
  updates.forEach(handleUpdate);
}

const setup = () => {
  socket = new WebSocket('ws://74.66.131.19:5678');
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    globalUuid = data.uuid;
    const puzzleSpec = data.puzzleSpec;
    const updates = data.updates;
    dims = puzzleSpec.dims;
    makeBoard(dims);
    $(document).keydown(handleKeypress(dims));
    const acrossClues = puzzleSpec['across'];
    const downClues = puzzleSpec['down'];
    const cellNumbers = puzzleSpec['nums'];
    addClues(acrossClues, downClues);
    addNumbers(puzzleSpec['nums']);
    fillCells(puzzleSpec['filled']);
    associateCells();
    doUpdates(updates);
    renderAllCells();
    socket.onmessage = (event) => {
      doUpdates(JSON.parse(event.data));
    }
  };
  socket.onopen = () => {
    socket.send(JSON.stringify({'boardName': 'washpost'}));
  }
}

// END SETUP FUNCTIONS

// BEGIN GETTERS

const getCell = (loc) => {
  if (loc[0] < 0 || loc[0] >= dims[0] || loc[1] < 0 || loc[1] >= dims[1]) {
    return null;
  }
  return cellInfo[loc[0]][loc[1]];
}

const getClue = (clueId) => {
  return clueInfo[clueId[0]][clueId[1]];
}

const getLocForCell = (cellElement) => {
  const loc = cellElement.attr("loc");
  const xy = loc.split(",");
  return xy.map((x) => parseInt(x));
}

const getClueDirForClue = (clueElement) => {
  return clueElement.attr("dir");
}

const getClueNumForClue = (clueElement) => {
  return clueElement.attr("num");
}

// END GETTERS

// BEGIN UPDATERS
const rotateSelected = () => {
  const cell = getCell(selectedCell);
  const newDir = selectedClue[0] === 'down' ? 'across' : 'down';
  updateSelectedClue([newDir, cell.clues[newDir]]);
}

const updateSelectedCell = (newSelected) => {
  if (newSelected[0] === selectedCell[0] && newSelected[1] === selectedCell[1]) {
    rotateSelected();
    return; 
  }
  const oldCell = getCell(selectedCell);
  if (oldCell) {
    oldCell.selected = false;
    renderCell(selectedCell);
  }
  const newCell = getCell(newSelected);
  newCell.selected = true;
  selectedCell = newSelected;
  renderCell(selectedCell);
  updateSelectedClue([selectedClue[0], newCell.clues[selectedClue[0]]]);
  socket.send(JSON.stringify({'uuid': globalUuid, 'type': 'cursorMoved', 'data': [newSelected]}));
}

const updateSelectedClue = (newSelected) => {
  const oldClue = getClue(selectedClue);
  if (oldClue) {
    oldClue.selected = false;
    renderClue(selectedClue);
    oldClue.cells.forEach((loc) => {
      const cell = getCell(loc);
      cell.highlighted = false;
      renderCell(loc);
    });
  }
  const newClue = getClue(newSelected);
  newClue.selected = true;
  selectedClue = newSelected;
  renderClue(selectedClue);
  newClue.cells.forEach((loc) => {
    const cell = getCell(loc);
    cell.highlighted = true;
    renderCell(loc);
  });
}

const selectCell = (cellElement) => {
  updateSelectedCell(getLocForCell(cellElement));
}

const selectClue = (clueElement) => {
  const c = [getClueDirForClue(clueElement), getClueNumForClue(clueElement)]
  const clue = getClue(c);
  updateSelectedClue(c);
  updateSelectedCell(clue.cells[0]);
}

const putCharInCell = (c, loc, opt_alreadyString) => {
  const cell = getCell(loc); 
  const oldLetter = cell.letter;
  const newLetter = opt_alreadyString ? c : String.fromCharCode(c);
  cell.letter = newLetter;
  let delta = 0;
  if (oldLetter === ' ' && newLetter !== ' ') {
    delta = 1;
  }
  if (oldLetter !== ' ' && newLetter === ' ') {
    delta = -1;
  }
  const downClue = getClue(['down', cell.clues['down']]);
  downClue.solved += delta;
  const acrossClue = getClue(['across', cell.clues['across']]);
  acrossClue.solved += delta;
  renderCell(loc);
  renderClue(['down', cell.clues['down']]);
  renderClue(['across', cell.clues['across']]);
  return newLetter;
}

const putCharInSelected = (c, opt_alreadyString) => {
  const newLetter = putCharInCell(c, selectedCell, opt_alreadyString);
  socket.send(JSON.stringify({'uuid': globalUuid, 
                              'type': 'letterPlaced', 
                              'data': [selectedCell, newLetter]}));
}

// END UPDATERS

// BEGIN RENDERERS

const renderCell = (loc) => {
  const info = cellInfo[loc[0]][loc[1]];
  if (info.number) {
    info.numberElem.text(info.number);
  } else {
    info.numberElem.text('');
  }
  if (info.filled) {
    info.elem.addClass('filled-cell');
  } else {
    info.elem.removeClass('filled-cell');
  }
  if (info.letter !== ' ') {
    info.elem.addClass('has-letter');
  } else {
    info.elem.removeClass('has-letter');
  }
  info.letterElem.text(info.letter);
  if (info.highlighted) {
    info.elem.addClass('highlighted-cell');
  } else {
    info.elem.removeClass('highlighted-cell');
  }
  if (info.selected) {
    info.elem.addClass('selected-cell');
  } else {
    info.elem.removeClass('selected-cell');
  }
  if (info.selectedByOther.length > 0) {
    info.elem.addClass('selected-cell-other');
  } else {
    info.elem.removeClass('selected-cell-other');
  }
}

const renderClue = (c) => {
  const clue = clueInfo[c[0]][c[1]];
  clue.elem.text(`${c[1]}. ${clue.text}`);
  if (clue.selected) {
    clue.elem.addClass('selected-clue');
  } else {
    clue.elem.removeClass('selected-clue');
  }
  if (clue.solved === clue.cells.length) {
    clue.elem.addClass('clue-solved');
  } else {
    clue.elem.removeClass('clue-solved');
  }
}

const renderAllCells = () => {
  for (let i = 0; i < dims[0]; i++) {
    for (let j = 0; j < dims[1]; j++) {
      renderCell([i,j]);
    }
  }
}

// END RENDERERS

// BEGIN HANDLERS

const handleCellClick = (event) => {
  selectCell($(event.currentTarget));
}

const handleKeypress = (dims) => (event) => {
  const moveSelected = (deltaX, deltaY) => { 
    const curX = selectedCell[0];
    const curY = selectedCell[1];
    let newX = curX + deltaX;
    let newY = curY + deltaY;
    let invalidCode;
    while (invalidCode = validateCell([newX, newY])) {
      if (invalidCode === 2) {
	if (deltaX === 1) {
          newX = -1;
        } else if (deltaX === -1) {
          newX = dims[0];
        } else if (deltaY === 1) {
          newY = -1;
        } else if (deltaY === -1) {
          newY = dims[1];
        }
      }
      newX += deltaX;
      newY += deltaY;
    }
    updateSelectedCell([newX, newY]);
  }
  
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
    moveSelected(deltaX, deltaY);
  } else if (event.which > 64 && event.which < 91) {
    putCharInSelected(event.which);
    let deltaX = 0;
    let deltaY = 0;
    if (selectedClue[0] === 'down') {
      deltaX = 1;
    } else {
      deltaY = 1;
    }
    moveSelected(deltaX, deltaY);
  } else if (event.which === 8 || event.which === 46) {
    putCharInSelected(32);
    let deltaX = 0;
    let deltaY = 0;
    if (selectedClue[0] === 'down') {
      deltaX = -1;
    } else {
      deltaY = -1;
    }
    moveSelected(deltaX, deltaY);
  } else if (event.which === 13) {
    rotateSelected();
  }
}

const handleClueClick = (clue) => () => {
  selectClue(clue);
}

const handleUpdate = (update) => {
  let loc, cell;
  const updateType = update.type;
  const data = update.data;
  switch (updateType) {
  case 'cursorMoved':
    cell = getCell(data[0]);
    loc = data[0];
    const otherUuid = data[1];
    const oldSelected = otherSelected[otherUuid];
    if (oldSelected) {
      const oldCell = getCell(oldSelected);
      oldCell.selectedByOther = oldCell.selectedByOther.filter((u) => u !== otherUuid);
      renderCell(oldSelected);
    }
    cell.selectedByOther.push(otherUuid);
    otherSelected[otherUuid] = loc;
    renderCell(loc);
    break;
  case 'letterPlaced':
    const c = data[1];
    loc = data[0];
    putCharInCell(c, loc, true);
    break;
  case 'playerRemoved':
    const uuid = data[0];
    loc = otherSelected[uuid];
    cell = getCell(loc);
    cell.selectedByOther = cell.selectedByOther.filter((u) => u !== uuid);
    delete otherSelected[uuid];
    renderCell(loc);
    break;
  default:
    return;
  }
}

// END HANDLERS

// BEGIN HELPERS

const validateCell = (loc) => {
  const cell = getCell(loc);
  if (cell === null) {
    return 2;
  }
  if (cell.filled) {
    return 1;
  };
  return 0;
}

// END HELPERS

let selectedCell = [-1,-1];
let selectedClue = ['across',-1];
let socket, globalUuid;
const cellInfo = {};
const otherSelected = {};
const clueInfo = {'across': {}, 'down': {}};
$(document).ready(setup);
