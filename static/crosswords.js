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
  const dummyInput = $("<input>");
  dummyInput.addClass("dummy-input");
  dummyInput.on('input', handleInputChange(dims));
  square.append(dummyInput);
  if (!cellInfo[x]) {
    cellInfo[x] = {};
  }
  cellInfo[x][y] = {
    loc: [x,y],
    number: 0,
    filled: false,
    letter: ' ',
    solution: ' ',
    clues: {'down': 0, 'across': 0},
    elem: square,
    highlighted: false,
    selected: false,
    otherSelected: {'down': [], 'across': []},
    letterElem: letterHolder,
    numberElem: numHolder
  };
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
};

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
    otherSelected: [],
    elem: clue
  };
  $(clue).click(handleClueClick(clue));
};

const addClues = (across, down) => {
  const acrossClues = $("#across-clues");
  const downClues = $("#down-clues");
  across.forEach(makeClue(acrossClues, 'across'));
  down.forEach(makeClue(downClues, 'down'));
};

const addNumbers = (numbers) => {
  numbers.forEach((number) => {
    const cell = getCell(number[0]);
    cell.number = number[1];
  });
};

const setupCells = (sols, dims) => {
  let curAcross;
  let downDict = {};
  for (let i = 0; i < dims[0]; i++) {
    for (let j = 0; j < dims[1]; j++) {
      const cell = getCell([i,j]);
      const solution = sols[i * dims[0] + j];
      if (solution === '.') {
        cell.filled = true;
      }
      cell.solution = solution;
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
};

const setupExtraButtons = () => {
  $("#solve-clue-button").click(solveSelectedClue);
  $("#solve-cell-button").click(solveSelectedCell);
  $("#check-board-button").click(checkBoard);
  $("#check-cell-button").click(checkSelectedCell);
};

const setupTitle = (title) => {
  $("#title-holder").text(title);
};

const setup = () => {
  socket = new WebSocket('ws://' + window.location.hostname + ':5678');
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.error) {
      $(`#${data.error.field}-error`).text(data.error.message);
      return;
    }
    const puzzleSpec = data.puzzleSpec;
    const updates = data.updates;
    const gameId = data.gameId;
    dims = puzzleSpec.dims;
    makeBoard(dims);
    const acrossClues = puzzleSpec['across'];
    const downClues = puzzleSpec['down'];
    const cellNumbers = puzzleSpec['nums'];
    addClues(acrossClues, downClues);
    addNumbers(puzzleSpec['nums']);
    setupTitle(puzzleSpec['title']);
    setupCells(puzzleSpec['solutions'], dims);
    setupExtraButtons();
    $(document).keydown(handleKeypress(dims));
    handleUpdates(updates);
    renderAllCells();
    $("#game-holder").show();
    socket.onmessage = (event) => {
      handleUpdates(JSON.parse(event.data));
    };
  };
  socket.onopen = () => {
    const pathSplit = window.location.pathname.split('/');
    const gameId = pathSplit[pathSplit.length - 1];
    socket.send(JSON.stringify({'gameId': gameId}));
  };
};

// END SETUP FUNCTIONS

// BEGIN GETTERS

const getCell = (loc) => {
  if (loc[0] < 0 || loc[0] >= dims[0] || loc[1] < 0 || loc[1] >= dims[1]) {
    return null;
  }
  return cellInfo[loc[0]][loc[1]];
};

const getClue = (clueId) => {
  return clueInfo[clueId[0]][clueId[1]];
};

const getLocForCell = (cellElement) => {
  const loc = cellElement.attr("loc");
  const xy = loc.split(",");
  return xy.map((x) => parseInt(x));
};

const getClueDirForClue = (clueElement) => {
  return clueElement.attr("dir");
};

const getClueNumForClue = (clueElement) => {
  return clueElement.attr("num");
};

// END GETTERS

// BEGIN UPDATERS

const rotateSelected = () => {
  const cell = getCell(selectedCell);
  const newDir = selectedClue[0] === 'down' ? 'across' : 'down';
  updateSelectedClue([newDir, cell.clues[newDir]]);
  socket.send(JSON.stringify({'type': 'cursorMoved', 
                              'data': [selectedCell, newDir]}));
};

const updateSelectedCell = (newSelected, opt_norotate) => {  
  const oldCell = getCell(selectedCell);
  if (!opt_norotate && newSelected[0] === selectedCell[0] && newSelected[1] === selectedCell[1]) {
    oldCell.elem.find(".dummy-input").focus();
    rotateSelected();
    return; 
  }
  if (oldCell) {
    oldCell.selected = false;
    renderCell(selectedCell);
  }
  const newCell = getCell(newSelected);
  newCell.selected = true;
  selectedCell = newSelected;
  renderCell(selectedCell);
  updateSelectedClue([selectedClue[0], newCell.clues[selectedClue[0]]]);
  newCell.elem.find(".dummy-input").focus();
  socket.send(JSON.stringify({'type': 'cursorMoved', 
                              'data': [newSelected, selectedClue[0]]}));
};

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
};

const selectCell = (cellElement) => {
  const loc = getLocForCell(cellElement);
  if (validateCell(loc) !== 0) {
    return;
  }
  updateSelectedCell(loc);
};

const selectClue = (clueElement) => {
  const c = [getClueDirForClue(clueElement), getClueNumForClue(clueElement)]
  const clue = getClue(c);
  updateSelectedClue(c);
  updateSelectedCell(clue.cells[0]);
};

const putCharInCell = (c, loc, opt_alreadyString, opt_sendUpdate) => {
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
  cell.wrong = false;
  renderCell(loc);
  renderClue(['down', cell.clues['down']]);
  renderClue(['across', cell.clues['across']]);
  if (opt_sendUpdate) {
    socket.send(JSON.stringify({'type': 'letterPlaced', 
                                'data': [loc, newLetter]}));
  }
  return newLetter;
};

const putCharInSelected = (c, opt_alreadyString) => {
  const newLetter = putCharInCell(c, selectedCell, opt_alreadyString, true);
};

const solveCell = (loc) => {
  const cell = getCell(loc);
  putCharInCell(cell.solution, cell.loc, true, true);
};

const solveSelectedCell = () => {
  if (!validateCell(selectedCell)) {
    solveCell(selectedCell);
  }
}

const solveSelectedClue = () => {
  if (selectedClue[1] < 0) {
    return;
  }
  const clue = getClue(selectedClue);
  clue.cells.forEach((loc) => {
    solveCell(loc);
  });
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
  if (info.otherSelected.down.length > 0) {
    info.elem.addClass('selected-cell-other-' + info.otherSelected.down[0].color);
  } else if (info.otherSelected.across.length > 0) {
    info.elem.addClass('selected-cell-other-' + info.otherSelected.across[0].color);
  } else {
    info.elem.removeClass('selected-cell-other-red');
    info.elem.removeClass('selected-cell-other-purple');
    info.elem.removeClass('selected-cell-other-green');
    info.elem.removeClass('selected-cell-other-orange');
  }
  if (info.wrong && info.letter != ' ') {
    info.elem.addClass('wrong-solution');
  } else {
    info.elem.removeClass('wrong-solution');
  }
};

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
  if (clue.otherSelected.length > 0) {
    clue.elem.css('color', clue.otherSelected[0].color);
  } else {
    clue.elem.css('color', '');
  }
};

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
};

const handleInputChange = (dims) => (event) => {
  const target = $(event.currentTarget);
  const val = target.val();
  if (val.length > 1) {
    target.val('');
  } else if (val.length === 1) {
    if (/^[a-zA-Z]+$/.test(val)) {
      putCharInSelected(val.toUpperCase(), true);
      let deltaX = 0;
      let deltaY = 0;
      if (selectedClue[0] === 'down') {
        deltaX = 1;
      } else {
        deltaY = 1;
      }
      moveSelected(deltaX, deltaY, true);
    }
    target.val('');
  } else {
    event.which = 36;
  }
};

const handleKeypress = (dims) => (event) => {
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
  } else if (event.which === 8 || event.which === 46) {
    const cell = getCell(selectedCell);
    const updateBefore = cell.letter && cell.letter !== ' ';
    if (updateBefore) {
      putCharInSelected(32); 
    }
    let deltaX = 0;
    let deltaY = 0;
    if (selectedClue[0] === 'down') {
      deltaX = -1;
    } else {
      deltaY = -1;
    }
    moveSelected(deltaX, deltaY, true);
    if (!updateBefore) {
      putCharInSelected(32); 
    }
  } else if (event.which === 13) {
    rotateSelected();
  }
};

const handleClueClick = (clue) => () => {
  selectClue(clue);
};

const handleUpdate = (update) => {
  const loc = update.loc;
  const state = update.state;
  const cell = getCell(loc);
  if (state.otherSelected) {
    cell.otherSelected = state.otherSelected;
    const downSelected = state.otherSelected.down;
    const acrossSelected = state.otherSelected.across;
    const downClueInfo = ['down', cell.clues.down];
    const downClue = getClue(downClueInfo);
    downClue.otherSelected = downSelected;
    renderClue(downClueInfo);
    const acrossClueInfo = ['across', cell.clues.across];
    const acrossClue = getClue(acrossClueInfo);
    acrossClue.otherSelected = acrossSelected;
    renderClue(acrossClueInfo);
  }
  if (state.letter) { 
    putCharInCell(state.letter, loc, true);
  }
  renderCell(loc);
};

const handleUpdates = (updates) => {
  updates.forEach(handleUpdate);
};

// END HANDLERS

// BEGIN HELPERS

const validateCell = (loc) => {
  const cell = getCell(loc);
  if (cell === null || cell === [-1, -1]) {
    return 2;
  }
  if (cell.filled) {
    return 1;
  }
  return 0;
};

const moveSelected = (deltaX, deltaY, opt_nowraparound) => {
  const curX = selectedCell[0];
  const curY = selectedCell[1];
  let newX = curX + deltaX;
  let newY = curY + deltaY;
  let invalidCode;
  while (invalidCode = validateCell([newX, newY])) {
    if (opt_nowraparound) {
      newX -= deltaX;
      newY -= deltaY;
      break;
    }
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
  updateSelectedCell([newX, newY], true);
};

const checkCell = (loc) => {
  const cell = getCell(loc);
  const isWrong = cell.letter !== cell.solution && !cell.filled;
  if (isWrong) {
    cell.wrong = true;
    renderCell(loc);
  }
  return isWrong;
};

const checkSelectedCell = () => {
  if (!validateCell(selectedCell)) {
    checkCell(selectedCell);
  }
};

const checkBoard = () => {
  let foundWrong = false;
  for (let i=0; i < dims[0]; i++) {
    for (let j=0; j < dims[1]; j++) {
      foundWrong = checkCell([i,j]) || foundWrong;
    }
  }
  if (!foundWrong) {
    alert("You succesfully completed the puzzle!");
  }
};

// END HELPERS

let selectedCell = [-1,-1];
let selectedClue = ['across',-1];
let socket;
const cellInfo = {};
const clueInfo = {'across': {}, 'down': {}};
$(document).ready(setup);
