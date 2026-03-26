'use strict';

// Piece notation: wP, wR, wN, wB, wQ, wK / bP, bR, bN, bB, bQ, bK
// Board is [row][col], row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)

const INITIAL_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

function boardFromFen(state) {
  if (!state || state === 'start') {
    return INITIAL_BOARD.map(row => [...row]);
  }
  return JSON.parse(state);
}

function boardToFen(board) {
  return JSON.stringify(board);
}

function squareToRC(sq) {
  const file = sq.charCodeAt(0) - 97; // a=0, h=7
  const rank = parseInt(sq[1]);        // 1-8
  const row = 8 - rank;               // rank 8 = row 0, rank 1 = row 7
  return [row, file];
}

function rcToSquare(r, c) {
  const file = String.fromCharCode(97 + c);
  const rank = 8 - r;
  return `${file}${rank}`;
}

function pieceColor(p) {
  if (!p) return null;
  return p[0]; // 'w' or 'b'
}

function pieceType(p) {
  if (!p) return null;
  return p[1]; // P, R, N, B, Q, K
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === color + 'K') return [r, c];
    }
  }
  return null;
}

function isSquareAttackedBy(board, r, c, attackerColor) {
  const ec = attackerColor;
  const dc = ec === 'w' ? 'b' : 'w';

  // Pawn attacks
  const pawnDir = ec === 'w' ? 1 : -1; // white pawns attack upward (decreasing row)
  const pr = r + pawnDir;
  for (const pc of [c - 1, c + 1]) {
    if (inBounds(pr, pc) && board[pr][pc] === ec + 'P') return true;
  }

  // Knight attacks
  for (const [dr, dc2] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r + dr, nc = c + dc2;
    if (inBounds(nr, nc) && board[nr][nc] === ec + 'N') return true;
  }

  // Sliding pieces: rook/queen (rank+file) and bishop/queen (diagonals)
  const rookDirs = [[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr, dc2] of rookDirs) {
    let nr = r + dr, nc = c + dc2;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p === ec + 'R' || p === ec + 'Q') return true;
        break;
      }
      nr += dr; nc += dc2;
    }
  }

  const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr, dc2] of bishopDirs) {
    let nr = r + dr, nc = c + dc2;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p === ec + 'B' || p === ec + 'Q') return true;
        break;
      }
      nr += dr; nc += dc2;
    }
  }

  // King attacks
  for (const [dr, dc2] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r + dr, nc = c + dc2;
    if (inBounds(nr, nc) && board[nr][nc] === ec + 'K') return true;
  }

  return false;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  const oppColor = color === 'w' ? 'b' : 'w';
  return isSquareAttackedBy(board, king[0], king[1], oppColor);
}

// Get raw candidate moves (no check filtering)
function getRawMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const oppColor = color === 'w' ? 'b' : 'w';
  const moves = [];

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1; // white moves up (decreasing row)
    const startRow = color === 'w' ? 6 : 1;
    // Forward 1
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      // Forward 2 from start
      if (r === startRow && !board[r + 2 * dir][c]) {
        moves.push([r + 2 * dir, c]);
      }
    }
    // Diagonal captures
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] && pieceColor(board[nr][nc]) === oppColor) {
        moves.push([nr, nc]);
      }
    }
  } else if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && pieceColor(board[nr][nc]) !== color) {
        moves.push([nr, nc]);
      }
    }
  } else if (type === 'B') {
    for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        if (board[nr][nc]) {
          if (pieceColor(board[nr][nc]) === oppColor) moves.push([nr, nc]);
          break;
        }
        moves.push([nr, nc]);
        nr += dr; nc += dc;
      }
    }
  } else if (type === 'R') {
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        if (board[nr][nc]) {
          if (pieceColor(board[nr][nc]) === oppColor) moves.push([nr, nc]);
          break;
        }
        moves.push([nr, nc]);
        nr += dr; nc += dc;
      }
    }
  } else if (type === 'Q') {
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        if (board[nr][nc]) {
          if (pieceColor(board[nr][nc]) === oppColor) moves.push([nr, nc]);
          break;
        }
        moves.push([nr, nc]);
        nr += dr; nc += dc;
      }
    }
  } else if (type === 'K') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && pieceColor(board[nr][nc]) !== color) {
        moves.push([nr, nc]);
      }
    }
  }

  return moves;
}

// Get legal moves (filtered for self-check)
function getLegalMovesRC(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const raw = getRawMoves(board, r, c);
  return raw.filter(([tr, tc]) => {
    const nb = cloneBoard(board);
    nb[tr][tc] = piece;
    nb[r][c] = null;
    return !isInCheck(nb, color);
  });
}

function hasAnyLegalMove(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (pieceColor(board[r][c]) === color) {
        if (getLegalMovesRC(board, r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function buildNotation(board, fromR, fromC, toR, toC, piece, captured, promotionPiece, inCheckAfter, isCheckmate) {
  const type = pieceType(piece);
  const toSq = rcToSquare(toR, toC);
  let notation = '';

  if (type === 'K') {
    notation = 'K' + (captured ? 'x' : '') + toSq;
  } else if (type === 'Q') {
    notation = 'Q' + (captured ? 'x' : '') + toSq;
  } else if (type === 'R') {
    notation = 'R' + (captured ? 'x' : '') + toSq;
  } else if (type === 'B') {
    notation = 'B' + (captured ? 'x' : '') + toSq;
  } else if (type === 'N') {
    notation = 'N' + (captured ? 'x' : '') + toSq;
  } else if (type === 'P') {
    if (captured) {
      const fromFile = String.fromCharCode(97 + fromC);
      notation = fromFile + 'x' + toSq;
    } else {
      notation = toSq;
    }
    if (promotionPiece) notation += '=' + promotionPiece;
  }

  if (isCheckmate) notation += '#';
  else if (inCheckAfter) notation += '+';

  return notation;
}

function applyMove(boardState, fromSq, toSq, promotion) {
  const board = boardFromFen(boardState);
  const [fr, fc] = squareToRC(fromSq);
  const [tr, tc] = squareToRC(toSq);

  const piece = board[fr][fc];
  if (!piece) return { valid: false, error: 'No piece at source square' };

  const color = pieceColor(piece);
  const type = pieceType(piece);
  const oppColor = color === 'w' ? 'b' : 'w';

  const legalMoves = getLegalMovesRC(board, fr, fc);
  const isLegal = legalMoves.some(([r, c]) => r === tr && c === tc);
  if (!isLegal) return { valid: false, error: 'Illegal move' };

  const newBoard = cloneBoard(board);
  const captured = newBoard[tr][tc];
  newBoard[tr][tc] = piece;
  newBoard[fr][fc] = null;

  // Pawn promotion
  let promotionPiece = null;
  if (type === 'P') {
    const promRow = color === 'w' ? 0 : 7;
    if (tr === promRow) {
      promotionPiece = promotion || 'Q';
      newBoard[tr][tc] = color + promotionPiece;
    }
  }

  // Check game status for the opponent
  const oppInCheck = isInCheck(newBoard, oppColor);
  const oppHasMoves = hasAnyLegalMove(newBoard, oppColor);

  let gameStatus = 'active';
  let winnerColor = null;
  let isCheckmate = false;

  if (!oppHasMoves) {
    if (oppInCheck) {
      gameStatus = 'checkmate';
      winnerColor = color === 'w' ? 'white' : 'black';
      isCheckmate = true;
    } else {
      gameStatus = 'stalemate';
    }
  }

  const notation = buildNotation(board, fr, fc, tr, tc, piece, captured, promotionPiece, oppInCheck, isCheckmate);

  return {
    valid: true,
    newBoard: boardToFen(newBoard),
    captured: captured || null,
    promotion: promotionPiece,
    notation,
    gameStatus,
    winnerId: winnerColor, // caller maps color to player id
    inCheck: oppInCheck,
  };
}

module.exports = {
  INITIAL_BOARD,
  boardFromFen,
  boardToFen,
  applyMove,
  squareToRC,
  rcToSquare,
  getLegalMovesRC,
  isInCheck,
  hasAnyLegalMove,
};
