// Client-side chess logic for move highlighting
// Mirrors server/chess.js logic

export const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export const FILES = 'abcdefgh';

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

export function defaultBoard() {
  return INITIAL_BOARD.map(row => [...row]);
}

export function boardFromState(state) {
  if (!state || state === 'start') return defaultBoard();
  try { return JSON.parse(state); } catch { return defaultBoard(); }
}

export function squareToRC(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]);
  return [8 - rank, file];
}

export function rcToSquare(r, c) {
  return FILES[c] + (8 - r);
}

export function pieceColor(p) {
  if (!p) return null;
  return p[0];
}

function pieceType(p) {
  if (!p) return null;
  return p[1];
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

  const pawnDir = ec === 'w' ? 1 : -1;
  const pr = r + pawnDir;
  for (const pc of [c - 1, c + 1]) {
    if (inBounds(pr, pc) && board[pr][pc] === ec + 'P') return true;
  }

  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === ec + 'N') return true;
  }

  for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p === ec + 'R' || p === ec + 'Q') return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p === ec + 'B' || p === ec + 'Q') return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const nr = r + dr, nc = c + dc;
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

function getRawMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = pieceColor(piece);
  const type = pieceType(piece);
  const oppColor = color === 'w' ? 'b' : 'w';
  const moves = [];

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + 2 * dir][c]) {
        moves.push([r + 2 * dir, c]);
      }
    }
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

export function getLegalMoves(board, r, c) {
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
