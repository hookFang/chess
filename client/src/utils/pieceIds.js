/**
 * pieceIds.js
 * Assigns stable instance IDs to chess pieces so framer-motion can track
 * them across board updates and animate movement between squares.
 *
 * ID format: "wP#3" — piece code + "#" + counter
 */

import { useRef } from 'react';
import { boardFromState } from './chess';

export function usePieceIds(boardState) {
  const idsRef      = useRef(null);
  const prevStateRef = useRef(null);

  if (idsRef.current === null) {
    idsRef.current   = initIds(boardFromState(boardState));
    prevStateRef.current = boardState;
  } else if (boardState !== prevStateRef.current) {
    const prevBoard = boardFromState(prevStateRef.current);
    const newBoard  = boardFromState(boardState);
    idsRef.current  = diffIds(idsRef.current, prevBoard, newBoard);
    prevStateRef.current = boardState;
  }

  return idsRef.current; // { "r,c": "wP#3", ... }
}

/* ── Helpers ────────────────────────────────────────────────────── */

function initIds(board) {
  const ids     = {};
  const counts  = {};
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        counts[p] = (counts[p] || 0) + 1;
        ids[`${r},${c}`] = `${p}#${counts[p]}`;
      }
    }
  }
  return ids;
}

function diffIds(prevIds, prevBoard, newBoard) {
  const next    = {};
  const removed = []; // { key, piece, id }
  const added   = []; // { key, piece }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const key  = `${r},${c}`;
      const prev = prevBoard[r][c];
      const curr = newBoard[r][c];

      if (prev === curr) {
        // Unchanged square — carry ID forward
        if (curr) next[key] = prevIds[key];
      } else {
        if (prev) removed.push({ key, piece: prev, id: prevIds[key] });
        if (curr) added.push({ key, piece: curr });
      }
    }
  }

  // Match each new piece to a removed piece of the same type (the move)
  for (const { key, piece } of added) {
    const idx = removed.findIndex(r => r.piece === piece);
    if (idx >= 0) {
      // Same piece type moved here — transfer its stable ID
      next[key] = removed[idx].id;
      removed.splice(idx, 1);
    } else {
      // No match (promotion to a new piece type) — assign a fresh ID
      next[key] = `${piece}#x${Math.random().toString(36).slice(2, 7)}`;
    }
  }
  // Any remaining `removed` entries are captures — their IDs simply vanish.

  return next;
}
