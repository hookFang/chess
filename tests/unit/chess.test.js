const {
  INITIAL_BOARD,
  boardFromFen,
  boardToFen,
  applyMove,
  squareToRC,
  rcToSquare,
  isInCheck,
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

    test('Bishop can move diagonally', () => {
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP',null,'wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'c1', 'a3');
      expect(result.valid).toBe(true);
      expect(result.notation).toBe('Ba3');
    });

    test('Bishop capture shows x in notation', () => {
      // wB at f5, bN at d3 — diagonal capture through the empty e4 square
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,'wB',null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,'bN',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'f5', 'd3');
      expect(result.valid).toBe(true);
      expect(result.captured).toBe('bN');
      expect(result.notation).toBe('Bxd3');
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

    test('Pawn cannot move backwards', () => {
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wP',null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wP',null,'wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'e4', 'e3');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Illegal move');
    });

    test('Cannot move piece into check', () => {
      // wR at e4 is pinned to wK at e1 by bR at e8 — moving off the e-file is illegal
      const fen = boardToFen([
        [null,null,null,null,'bR',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wR',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ]);
      const result = applyMove(fen, 'e4', 'd4');
      expect(result.valid).toBe(false);
    });

    test('Piece cannot move to occupied square with own piece', () => {
      const result = applyMove(boardToFen(INITIAL_BOARD), 'e2', 'e1');
      expect(result.valid).toBe(false);
    });
  });

  describe('Captures', () => {
    test('Pawn captures diagonally', () => {
      // wP at d4 (row 4, col 3), bP at e5 (row 3, col 4)
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP',null,'bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'bP',null,null,null],
        [null,null,null,'wP',null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP',null,'wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ]);
      const result = applyMove(fen, 'd4', 'e5');
      expect(result.valid).toBe(true);
      expect(result.captured).toBe('bP');
    });

    test('Captured piece shows in notation', () => {
      // wP at d4 (row 4, col 3), bP at e5 (row 3, col 4)
      const fen = boardToFen([
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP',null,'bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'bP',null,null,null],
        [null,null,null,'wP',null,null,null,null],
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

    test('Checkmate detection', () => {
      // bK at a8, wQ at b6, wK at c7; wQ moves b6→b8 = checkmate
      const fen = boardToFen([
        ['bK',null,null,null,null,null,null,null],
        [null,null,'wK',null,null,null,null,null],
        [null,'wQ',null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
      ]);
      const result = applyMove(fen, 'b6', 'b8');
      expect(result.gameStatus).toBe('checkmate');
      expect(result.winnerId).toBe('white');
    });

    test('Stalemate detection', () => {
      // bK at a8, wK at c6, wQ at h7; wQ moves h7→c7 = stalemate
      const fen = boardToFen([
        ['bK',null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,'wQ'],
        [null,null,'wK',null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
      ]);
      const result = applyMove(fen, 'h7', 'c7');
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
      // wR at e5 attacks bK at e8 along the e-file
      const fen = boardToFen([
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wR',null,null,null],
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
      // Same back-rank mate: bK at a8, wQ at b6, wK at c7
      const fen = boardToFen([
        ['bK',null,null,null,null,null,null,null],
        [null,null,'wK',null,null,null,null,null],
        [null,'wQ',null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
      ]);
      const result = applyMove(fen, 'b6', 'b8');
      expect(result.notation).toContain('#');
    });
  });

  describe('Castling', () => {
    // Minimal board: white king e1 + rooks a1/h1, black king e8, everything else empty
    function castleBoard() {
      return [
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wR',null,null,null,'wK',null,null,'wR'],
      ];
    }

    test('White kingside castling', () => {
      const result = applyMove(boardToFen(castleBoard()), 'e1', 'g1', null, {});
      expect(result.valid).toBe(true);
      expect(result.isCastle).toBe('kingside');
      expect(result.notation).toBe('O-O');
      const b = boardFromFen(result.newBoard);
      expect(b[7][6]).toBe('wK');
      expect(b[7][5]).toBe('wR');
      expect(b[7][7]).toBeNull();
    });

    test('White queenside castling', () => {
      const result = applyMove(boardToFen(castleBoard()), 'e1', 'c1', null, {});
      expect(result.valid).toBe(true);
      expect(result.isCastle).toBe('queenside');
      expect(result.notation).toBe('O-O-O');
      const b = boardFromFen(result.newBoard);
      expect(b[7][2]).toBe('wK');
      expect(b[7][3]).toBe('wR');
      expect(b[7][0]).toBeNull();
    });

    test('Black kingside castling', () => {
      const board = [
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ];
      board[0][0] = 'bR';
      board[0][7] = 'bR';
      const result = applyMove(boardToFen(board), 'e8', 'g8', null, {});
      expect(result.valid).toBe(true);
      expect(result.isCastle).toBe('kingside');
      const b = boardFromFen(result.newBoard);
      expect(b[0][6]).toBe('bK');
      expect(b[0][5]).toBe('bR');
    });

    test('Black queenside castling', () => {
      const board = [
        [null,null,null,null,'bK',null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,'wK',null,null,null],
      ];
      board[0][0] = 'bR';
      board[0][7] = 'bR';
      const result = applyMove(boardToFen(board), 'e8', 'c8', null, {});
      expect(result.valid).toBe(true);
      expect(result.isCastle).toBe('queenside');
      const b = boardFromFen(result.newBoard);
      expect(b[0][2]).toBe('bK');
      expect(b[0][3]).toBe('bR');
    });

    test('Illegal when king has already moved', () => {
      const result = applyMove(boardToFen(castleBoard()), 'e1', 'g1', null, { whiteKingMoved: true });
      expect(result.valid).toBe(false);
    });

    test('Illegal kingside when the h-rook has moved, but queenside stays legal', () => {
      const rights = { whiteRookHMoved: true };
      const kingside = applyMove(boardToFen(castleBoard()), 'e1', 'g1', null, rights);
      expect(kingside.valid).toBe(false);
      const queenside = applyMove(boardToFen(castleBoard()), 'e1', 'c1', null, rights);
      expect(queenside.valid).toBe(true);
    });

    test('Illegal queenside when the a-rook has moved, but kingside stays legal', () => {
      const rights = { whiteRookAMoved: true };
      const queenside = applyMove(boardToFen(castleBoard()), 'e1', 'c1', null, rights);
      expect(queenside.valid).toBe(false);
      const kingside = applyMove(boardToFen(castleBoard()), 'e1', 'g1', null, rights);
      expect(kingside.valid).toBe(true);
    });

    test('Illegal when a piece blocks between king and rook', () => {
      const board = castleBoard();
      board[7][5] = 'wN'; // knight blocking f1
      const result = applyMove(boardToFen(board), 'e1', 'g1', null, {});
      expect(result.valid).toBe(false);
    });

    test('Illegal while king is currently in check', () => {
      const board = castleBoard();
      board[3][4] = 'bR'; // attacks e1 down the e-file
      const result = applyMove(boardToFen(board), 'e1', 'g1', null, {});
      expect(result.valid).toBe(false);
    });

    test('Illegal when king passes through an attacked square', () => {
      const board = castleBoard();
      board[3][5] = 'bR'; // attacks f1, the pass-through square
      const result = applyMove(boardToFen(board), 'e1', 'g1', null, {});
      expect(result.valid).toBe(false);
    });

    test('Illegal when king would land on an attacked square', () => {
      const board = castleBoard();
      board[3][6] = 'bR'; // attacks g1, the landing square
      const result = applyMove(boardToFen(board), 'e1', 'g1', null, {});
      expect(result.valid).toBe(false);
    });

    test('A normal king move revokes both castling rights', () => {
      const result = applyMove(boardToFen(castleBoard()), 'e1', 'e2', null, {});
      expect(result.valid).toBe(true);
      expect(result.newCastlingRights.whiteKingMoved).toBe(true);
    });

    test('A normal rook move revokes only that side\'s right', () => {
      const result = applyMove(boardToFen(castleBoard()), 'h1', 'h4', null, {});
      expect(result.valid).toBe(true);
      expect(result.newCastlingRights.whiteRookHMoved).toBe(true);
      expect(result.newCastlingRights.whiteRookAMoved).toBe(false);
    });

    test('Capturing an opponent\'s unmoved home-square rook revokes their right', () => {
      const board = castleBoard();
      board[0][0] = 'bR'; // black queenside rook, unmoved, on a8
      board[1][0] = 'wR'; // white rook poised to capture it on a8
      board[7][0] = null; // remove the white a1 rook so it isn't ambiguous
      const result = applyMove(boardToFen(board), 'a7', 'a8', null, {});
      expect(result.valid).toBe(true);
      expect(result.captured).toBe('bR');
      expect(result.newCastlingRights.blackRookAMoved).toBe(true);
    });

    test('Castling move that gives check produces + notation', () => {
      const board = castleBoard();
      board[0][4] = null;
      board[0][5] = 'bK'; // black king on f8, directly in front of where the rook lands
      const result = applyMove(boardToFen(board), 'e1', 'g1', null, {});
      expect(result.valid).toBe(true);
      expect(result.inCheck).toBe(true);
      expect(result.notation).toBe('O-O+');
    });
  });
});
