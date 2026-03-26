const {
  INITIAL_BOARD,
  boardFromFen,
  boardToFen,
  applyMove,
  squareToRC,
  rcToSquare,
  getLegalMovesRC,
  isInCheck,
  hasAnyLegalMove,
} = require('../../server/chess');

describe('Chess Engine', () => {
  describe('Board Setup', () => {
    test('INITIAL_BOARD is correct shape', () => {
      expect(INITIAL_BOARD).toHaveLength(8);
      expect(INITIAL_BOARD.every(row => row.length === 8)).toBe(true);
    });

    test('Pieces are correctly placed', () => {
      expect(INITIAL_BOARD[0][0]).toBe('bR'); // Black rook on a8
      expect(INITIAL_BOARD[0][4]).toBe('bK'); // Black king on e8
      expect(INITIAL_BOARD[1]).toEqual(['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP']);
      expect(INITIAL_BOARD[6]).toEqual(['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP']);
      expect(INITIAL_BOARD[7][0]).toBe('wR');
      expect(INITIAL_BOARD[7][4]).toBe('wK');
    });

    test('Serialization roundtrip', () => {
      const fen = boardToFen(INITIAL_BOARD);
      const board = boardFromFen(fen);
      expect(board).toEqual(INITIAL_BOARD);
    });

    test('boardFromFen with "start" returns initial board', () => {
      const board = boardFromFen('start');
      expect(board).toEqual(INITIAL_BOARD);
    });

    test('boardFromFen with null/undefined returns initial board', () => {
      expect(boardFromFen(null)).toEqual(INITIAL_BOARD);
      expect(boardFromFen(undefined)).toEqual(INITIAL_BOARD);
    });
  });

  describe('Square Conversion', () => {
    test('squareToRC converts correctly', () => {
      expect(squareToRC('e2')).toEqual([6, 4]); // e=4, rank 2 = row 6
      expect(squareToRC('e4')).toEqual([4, 4]); // e=4, rank 4 = row 4
      expect(squareToRC('a1')).toEqual([7, 0]);
      expect(squareToRC('h8')).toEqual([0, 7]);
    });

    test('rcToSquare converts correctly', () => {
      expect(rcToSquare(6, 4)).toBe('e2');
      expect(rcToSquare(4, 4)).toBe('e4');
      expect(rcToSquare(7, 0)).toBe('a1');
      expect(rcToSquare(0, 7)).toBe('h8');
    });

    test('Square conversion is bidirectional', () => {
      const squares = ['a1', 'e2', 'e4', 'h8', 'd4', 'c3'];
      squares.forEach(sq => {
        expect(rcToSquare(...squareToRC(sq))).toBe(sq);
      });
    });
  });

  describe('Valid Moves', () => {
    test('Pawn can move one square forward', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e2', 'e3');
      expect(result.valid).toBe(true);
      expect(result.captured).toBeNull();
    });

    test('Pawn can move two squares from starting position', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e2', 'e4');
      expect(result.valid).toBe(true);
      expect(result.captured).toBeNull();
    });

    test('Knight can move in L-shape', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'b1', 'c3');
      expect(result.valid).toBe(true);
    });

    test('Knight can move to all valid L-shapes', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'b1', 'a3');
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Moves', () => {
    test('Pawn cannot move two squares on second move', () => {
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'wP',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP',null,'wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'e4', 'e6');
      expect(result.valid).toBe(false);
    });

    test('Cannot move opponent pieces', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e7', 'e5');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Illegal move');
    });

    test('Cannot move piece into check', () => {
      // Construct a position where king would be in check if piece moves
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'bR',null,null,null,null],
        [null,null,null,'wR',null,'wP',null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'f4', 'f5');
      expect(result.valid).toBe(false);
    });

    test('Piece cannot move to occupied square with own piece', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e2', 'e1');
      expect(result.valid).toBe(false);
    });
  });

  describe('Captures', () => {
    test('Pawn captures diagonally', () => {
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP',null,'bP','bP','bP'],
        [null,null,null,null,'bP',null,null,null],
        [null,null,null,'wP',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP',null,'wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'd4', 'e5');
      expect(result.valid).toBe(true);
      expect(result.captured).toBe('bP');
    });

    test('Captured piece shows in notation', () => {
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP',null,'bP','bP','bP'],
        [null,null,null,null,'bP',null,null,null],
        [null,null,null,'wP',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP',null,'wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'd4', 'e5');
      expect(result.notation).toContain('x');
    });
  });

  describe('Game Endings', () => {
    test('Game starts active', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e2', 'e4');
      expect(result.gameStatus).toBe('active');
    });

    test('Checkmate detection (Scholar\'s Mate)', () => {
      // Setup Scholar's Mate position
      const fen = boardToFen([
        ['bR','bN','bB',null,'bK','bB','bN','bR'],
        ['bP','bP','bP','bQ','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'wB',null,'wP',null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wQ','wP',null,'wP','wP'],
        ['wR','wN',null,null,'wK',null,'wN','wR'],
      ]);
      const result = applyMove(fen, 'f4', 'f7');
      expect(result.gameStatus).toBe('checkmate');
      expect(result.winnerId).toBe('white');
    });

    test('Stalemate detection', () => {
      // Black king on a7, surrounded but not in check
      const fen = boardToFen([
        [null,null,null,null,null,null,null,null],
        ['bK',null,'wQ',null,null,null,null,null],
        ['wP',null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'c6', 'a6');
      expect(result.gameStatus).toBe('stalemate');
    });
  });

  describe('Pawn Promotion', () => {
    test('Pawn reaching rank 8 gets promoted', () => {
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        ['wP',null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'a7', 'a8', 'Q');
      expect(result.valid).toBe(true);
      expect(result.promotion).toBe('Q');
    });

    test('Promotion defaults to queen', () => {
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        ['wP',null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'a7', 'a8');
      expect(result.promotion).toBe('Q');
    });

    test('Black pawn promotion', () => {
      const fen = boardToFen([
        [null,null,null,null,'wK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['bP',null,null,null,null,null,null,null],
        [null,null,null,null,'bK',null,null,null],
      ]);
      const result = applyMove(fen, 'a2', 'a1', 'R');
      expect(result.valid).toBe(true);
      expect(result.promotion).toBe('R');
    });
  });

  describe('Check Detection', () => {
    test('King in check is detected', () => {
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'wR',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const board = boardFromFen(fen);
      expect(isInCheck(board, 'b')).toBe(true);
    });

    test('Check flag set in move result', () => {
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'wR',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ',null,'wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'd4', 'd8');
      expect(result.inCheck).toBe(true);
    });

    test('Checkmate produces # symbol', () => {
      const fen = boardToFen([
        ['bR','bN','bB',null,'bK','bB','bN','bR'],
        ['bP','bP','bP','bQ','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'wB',null,'wP',null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wQ','wP',null,'wP','wP'],
        ['wR','wN',null,null,'wK',null,'wN','wR'],
      ]);
      const result = applyMove(fen, 'f4', 'f7');
      expect(result.notation).toContain('#');
    });
  });
});
