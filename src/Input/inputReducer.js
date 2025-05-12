import React, {useState, useCallback} from "react"

function deepCopy(s) {
  if (Array.isArray(s)) {
    return s.map(deepCopy)
  }
  if (typeof s === 'object') {
    const s2 = {}
    for (const k in s) {
      s2[k] = deepCopy(s[k])
    }
    return s2
  }
  return s
}

function alwaysAllowed(k) {
  if (k.length > 1) {
    return true
  }
  if (k.match(/[ 0-9.()]/)) {
    return true
  }
}
const unops = [
  'log', 'ln',
  'sin', 'cos', 'tan',
  'sec', 'cot', 'csc',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'sech', 'csch', 'coth',
  'det', 'cis',
]
const relOps = [ '=', '<=', '>=', '<', '>',]
const binops = [
  '+', '-', '*', '%',
  'nn', 'uu', ...relOps
]
const shortcutOps = [...unops, '<=', '>=', 'nn', 'uu']
const shortcutWords = [...shortcutOps, 'sqrt', 'root']
const parenPairs = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<:': ':>'
}
const oppParenPairs = {}
for (const l in parenPairs) {
  oppParenPairs[parenPairs[l]] = l
}
const altParenPairs = {
  '(': '[',
  '[': '(',
  ')': ']',
  ']': ')',
}
function parenEq(p1, p2) {
  return p1 === p2 || p1 === altParenPairs[p2]
}

function maxCursor(n) {
  return n.cursorPosition - 1
}
function totalLength({nodes, root}) {
  let n = 1
  if (nodes) {
    n = nodes.reduce((a, c) => a + totalLength(c), n)
  }
  return n
}
function sequenceIndexCursor(seq, index) {
  if (index <= 0) {
    return Math.max(0, seq.cursorPositionSeqStart + index)
  }
  return seq.nodes[index-1].cursorPosition
}
function sequenceOffsetTo({nodes}, index) {
  let n = 0
  for (let i = 0; i < Math.min(nodes.length, index); i++) {
    n += totalLength(nodes[i])
  }
  return n
}
function sequenceDeleteAt(seq, index) {
  const nodes = seq.nodes
  const newNodes = nodes.slice(0, index-1).concat(nodes.slice(index))
  return {...seq, nodes: newNodes}
}
function sequenceDeleteNextRParen(seq, index, sym) {
  let symIndex
  let parenLevel = 0
  for (let i = index - 1; i < seq.nodes.length; i++) {
    const nn = seq.nodes[i]
    if (parenPairs[nn.sym]) {
      parenLevel++
    } else if (oppParenPairs[nn.sym]) {
      if (parenLevel === 0 && parenEq(nn.sym, sym)) {
        symIndex = i + 1
        break
      }
      parenLevel--
    }
  }
  if (symIndex) {
    return sequenceDeleteAt(seq, symIndex)
  }
  return seq
}
function sequenceDeleteNextLParen(seq, index, sym) {
  let symIndex
  let parenLevel = 0
  for (let i = index - 1; i >= 0; i--) {
    const nn = seq.nodes[i]
    if (oppParenPairs[nn.sym]) {
      parenLevel++
    } else if (parenPairs[nn.sym]) {
      if (parenLevel === 0 && parenEq(nn.sym, sym)) {
        symIndex = i + 1
        break
      }
      parenLevel--
    }
  }
  if (symIndex) {
    return sequenceDeleteAt(seq, symIndex)
  }
  return seq
}
function sequenceReplaceAt(seq, index, elems) {
  const nodes = seq.nodes
  return {...seq, nodes: seq.nodes.slice(0, index-1).concat(elems).concat(nodes.slice(index))}
}
// Indices inclusive, i.e. all must be excluded from the output
function sequenceReplaceRangeAt(seq, leftIndex, rightIndex, elems) {
  const nodes = seq.nodes
  return {...seq, nodes: seq.nodes.slice(0, leftIndex).concat(elems).concat(nodes.slice(rightIndex))}
}
function sequenceInsertAfter(seq, index, elems) {
  const nodes = seq.nodes
  return {...seq, nodes: seq.nodes.slice(0, index).concat(elems).concat(nodes.slice(index))}
}
function unzipToCursor(node, cursor) {
  function rec(n) {
    if (n.cursorPositionSeqStart === cursor) {
      // Initial insertion point of sequence
      return [{}, {index: 0, node: n}]
    }
    if (n.cursorPosition === cursor) {
      return [{node: n}]
    }
    if (n.nodes) {
      for (let i = 0; i < n.nodes.length; i++) {
        const nn = n.nodes[i]
        const r = rec(nn)
        if (r) {
          r.push({node: n, index: i + 1})
          return r
        }
      }
    }
    return
  }
  return rec(node)
}
function zip1(zipper, v) {
  if (zipper.length === 0) {
    return v
  }
  const {node, index} = zipper.shift()
  const newNodes = node.nodes.slice()
  newNodes[index-1] = v
  return {...node, nodes: newNodes}
}
function zip(zipper, v) {
  while (zipper.length) {
    v = zip1(zipper, v)
  }
  return v
}
function sequenceSymSpanFrom({nodes}, index) {
  let res = ""
  for (let i = index - 1; i >= 0; i--) {
    const nn = nodes[i]
    if (nn.sym && nn.sym.length === 1) {
      res = nn.sym + res
    } else {
      break
    }
  }
  return res
}
function isSuffix(a, b) {
  const i = a.lastIndexOf(b)
  return a.length >= b.length && i === a.length - b.length
}
function applyShortcuts(node, index) {
  let symSpan = sequenceSymSpanFrom(node, index)
  let match
  let matchLen
  for (const op of shortcutOps) {
    if (isSuffix(symSpan, op)) {
      matchLen = op.length
      match = {sym: op, operator: true}
      break
    }
  }
  if (isSuffix(symSpan, 'sqrt')) {
    matchLen = 4
    match = {op: 'sqrt', operator: true, nodes: []}
  } else if (isSuffix(symSpan, 'root')) {
    matchLen = 4
    match = {op: 'root', operator: true, nodes: [{nodes: [], rootRadix: true}, {nodes: [], rootOperand: true}]}
  }
  if (match) {
    return {seq: sequenceReplaceRangeAt(node, index-matchLen, index, [match]), delta: matchLen - 1}
  }
}
function insert(st, newNode) {
  const {root, cursor} = deleteSelectionIfExists(st)
  const zipper = unzipToCursor(root, cursor)
  const [, {node: seq, index}, ...rest] = zipper
  let newSeq = seq
  if (index > 0 && seq.nodes[index - 1].implicitParen) {
    newSeq = sequenceReplaceAt(newSeq, index, [{...seq.nodes[index - 1], implicitParen: undefined}])
  }
  newSeq = sequenceInsertAfter(newSeq, index, [newNode])
  let newCursor = cursor + totalLength(newNode)
  if (newNode.op === 'root') {
    newCursor = cursor + 1
  }
  const scRes = applyShortcuts(newSeq, index + 1)
  if (scRes) {
    return {root: zip(rest, scRes.seq), cursor: newCursor - scRes.delta}
  }
  return {root: zip(rest, newSeq), cursor: newCursor}
}

function sequenceHandleBackspace(seq, index, opts) {
  if (index === 0) {
    if (['^', 'sqrt'].includes(seq.op) || seq.rootOperand) {
      // Delete self, merge subseq up
      return {mergeUp: seq.nodes, propagate: true}
    }
    // Default is to just backspace out of the sequence
    return {node: seq}
  }
  const deletedElem = seq.nodes[index-1]
  const pp = parenPairs[deletedElem.sym]
  const opp = oppParenPairs[deletedElem.sym]
  let cursorDelta = 1
  if (opts.mergeUp) {
    seq = sequenceReplaceAt(seq, index, opts.mergeUp)
  } else if (deletedElem.implicitParen) {
    seq = sequenceReplaceAt(seq, index, [{...deletedElem, implicitParen: true}])
  } else {
    seq = sequenceDeleteAt(seq, index)
    if (pp) {
      seq = sequenceDeleteNextRParen(seq, index, pp)
    } else if (opp) {
      seq = sequenceDeleteNextLParen(seq, index-1, opp)
      cursorDelta = 2
    }
  }
  if (seq.nodes.length === 0 && !seq.numerator && !seq.denominator && !seq.rootRadix && !seq.rootOperand && seq.op !== 'sqrt') {
    // This depends on the type of node but let's say base class is self
    // elimination
    return {node: seq, propagate: true, cursorDelta}
  }
  return {node: seq, cursorDelta}
}

function backspace({root, cursor}) {
  const [, ...zipper] = unzipToCursor(root, cursor)
  let r = {propagate: true}
  while (zipper.length && r.propagate) {
    const {node, index} = zipper.shift()
    if (r.node) {
      node.nodes = node.nodes.slice()
      node.nodes[index-1] = r.node
    }
    if (r.collapseFraction) {
      r = {mergeUp: node.nodes[0].nodes.concat(node.nodes[1].nodes), propagate: true, cursor: node.nodes[1].cursorPositionSeqStart-2}
    } else if (node.op === 'root') {
      r = {mergeUp: r.mergeUp, propagate: true, cursor: node.nodes[0].cursorPositionSeqStart-1}
    } else {
      let mergeUpCursor = r.cursor
      r = sequenceHandleBackspace(node, index, r)
      if (mergeUpCursor) {
        cursor = mergeUpCursor
      } else {
        cursor = sequenceIndexCursor(node, index-(r.cursorDelta || 1))
      }
    }
  }
  const newRoot = zip(zipper, r.node)
  return {root: newRoot, cursor}
}

function deleteSelection({root, selectEffectiveStartCursor, cursor}) {
  const {seq, i1, i2, rest} = findCommonSequence(root, selectEffectiveStartCursor, cursor)
  let newCursor
  const imin = Math.min(i1, i2)
  const imax = Math.max(i1, i2)
  if (imin === 0) {
    newCursor = seq.cursorPositionSeqStart
  } else {
    newCursor = seq.nodes[imin-1].cursorPosition
  }
  const seq2 = sequenceReplaceRangeAt(seq, imin, imax, [])
  return {root: zip(rest, seq2), cursor: newCursor, selectEffectiveStartCursor: undefined, selectStartCursor: undefined}
}
function deleteSelectionIfExists(st) {
  if (st.selectEffectiveStartCursor !== undefined && st.cursor !== st.selectEffectiveStartCursor) {
    return deleteSelection(st)
  }
  return st
}

// Returns index exclusive
function numeratorSpan(seq, index) {
  const breakingOps = ["-", "+", ...relOps]
  let parenLevel = 0
  for (let i = index - 1; i >= 0; i--) {
    const n = seq.nodes[i]
    if (oppParenPairs[n.sym]) {
      parenLevel++
      continue
    }
    if (parenPairs[n.sym]) {
      if (parenLevel > 0) {
        parenLevel--
        continue
      }
      return i + 1
    }
    if (parenLevel > 0) {
      continue
    }
    if (n.num || n.alpha) {
      continue
    }
    if (n.sym && !breakingOps.includes(n.sym)) {
      continue
    }
    if (n.op && !breakingOps.includes(n.op)) {
      continue
    }
    return i+1
  }
  return 0
}
function insertFrac(st) {
  let leftIndex, index, seq, rest, cursor
  if (st.selectEffectiveStartCursor) {
    const {seq: sseq, i1, i2, rest: srest} = findCommonSequence(st.root, st.selectEffectiveStartCursor, st.cursor)
    leftIndex = Math.min(i1, i2)
    index = Math.max(i1, i2)
    seq = sseq
    rest = srest
    cursor = Math.max(st.cursor, st.selectEffectiveStartCursor)
  } else {
    const {root, cursor: rcursor} = st
    const [, {node: rseq, index: rindex}, ...rrest] = unzipToCursor(root, rcursor)
    seq = rseq
    index = rindex
    rest = rrest
    leftIndex = numeratorSpan(seq, index)
    cursor = rcursor
  }
  const numerator = seq.nodes.slice(leftIndex, index)
  const frac = {op: 'frac', operator: true, vertical: true, nodes: [{nodes: numerator, numerator: true}, {nodes: [], denominator: true}]}
  const newNode = sequenceReplaceRangeAt(seq, leftIndex, index, [frac])
  return {root: zip(rest, newNode), cursor: cursor + (numerator.length > 0 ? 2 : 1)}
}

function insertImplicitRParen(seq, index, parenType) {
  let parenLevel = 0
  let insertAt = seq.nodes.length
  for (let i = index; i <= seq.nodes.length; i++) {
    const nn = seq.nodes[i-1]
    if (oppParenPairs[nn.sym]) {
      if (parenLevel === 0) {
        insertAt = i - 1
        break
      } else {
        parenLevel--
        if (parenLevel < 0) {
          break
        }
      }
    } else if (parenPairs[nn.sym]) {
      parenLevel++
    }
  }
  return sequenceInsertAfter(seq, insertAt, [{sym: parenType[1], implicitParen: true}])
}
function insertImplicitLParen(seq, index, parenType) {
  let parenLevel = 0
  let insertAt = 0
  if (seq.nodes.length > 0) {
    for (let i = index; i > 0; i--) {
      const nn = seq.nodes[i-1]
      if (parenPairs[nn.sym]) {
        if (parenLevel === 0) {
          insertAt = i
          break
        } else {
          parenLevel--
          if (parenLevel < 0) {
            break
          }
        }
      } else if (oppParenPairs[nn.sym]) {
        parenLevel++
      }
    }
  }
  return sequenceInsertAfter(seq, insertAt, [{sym: parenType[0], implicitParen: true}])
}

function insertLParen(st, parenType) {
  let {root, cursor} = deleteSelectionIfExists(st)
  const [, {node: seq, index}, ...rest] = unzipToCursor(root, cursor)
  let parenLevel = 0
  let implicitL
  if (seq.nodes.length > index && parenEq(seq.nodes[index].sym, parenType[0]) && seq.nodes[index].implicitParen) {
    return {root: zip(rest, sequenceReplaceAt(seq, index+1, [{sym: parenType[0]}])), cursor: cursor+1}
  }
  for (let i = index; i > 0; i--) {
    const nn = seq.nodes[i-1]
    if (oppParenPairs[nn.sym]) {
      parenLevel++
    } else if (parenPairs[nn.sym]) {
      if (parenLevel === 0 && nn.implicitParen && parenEq(nn.sym, parenType[0])) {
        implicitL = i
        break
      }
      parenLevel--
      if (parenLevel < 0) {
        break
      }
    }
  }
  let newSeq
  if (implicitL) {
    newSeq = sequenceDeleteAt(sequenceInsertAfter(seq, index, [{sym: parenType[0]}]), implicitL)
  } else {
    newSeq = insertImplicitRParen(sequenceInsertAfter(seq, index, [{sym: parenType[0]}]), index + 2, parenType)
    cursor++
  }
  return {root: zip(rest, newSeq), cursor}
}

function insertRParen(st, parenType) {
  let {root, cursor} = deleteSelectionIfExists(st)
  const zipper = unzipToCursor(root, cursor)
  for (let i = 1; i < zipper.length; i++) {
    let parenBalance = 0
    const {node: seq, index} = zipper[i]
    if (index > 0 && parenEq(seq.nodes[index-1].sym, parenType[1]) && seq.nodes[index-1].implicitParen) {
      return {root: zip(zipper.slice(i+1), sequenceReplaceAt(seq, index, [{sym: parenType[1]}])), cursor}
    }
    let parenLevel = 0
    for (let j = index + 1; j <= seq.nodes.length; j++) {
      const nn = seq.nodes[j-1]
      if (parenPairs[nn.sym]) {
        parenLevel++
      } else if (oppParenPairs[nn.sym]) {
        if (parenLevel === 0 && nn.implicitParen && parenEq(nn.sym, parenType[1])) {
          const newSeq = sequenceInsertAfter(sequenceDeleteAt(seq, j), index, [{sym: parenType[1]}])
          return {root: zip(zipper.slice(i+1), newSeq), cursor: cursor + 1}
        }
        parenLevel--
        if (parenLevel < 0) {
          break
        }
      }
    }
  }
  const {node: seq, index} = zipper[1]
  const newSeq = sequenceInsertAfter(insertImplicitLParen(seq, index, parenType), index + 1, [{sym: parenType[1]}])
  return {root: zip(zipper.slice(2), newSeq), cursor: cursor + 2}
}

function cursorRight(root, cursor) {
  if (root.nodes.length === 0) {
    return cursor
  }
  if (cursor < maxCursor(root)) {
    return cursor + 1
  }
  return cursor
}
function cursorLeft(cursor) {
  return Math.max(0, cursor - 1)
}
function cursorVert(root, cursor, up) {
  const zipper = unzipToCursor(root, cursor)
  for (let i = 1; i < zipper.length; i++) {
    const {node, index} = zipper[i]
    if (node.vertical && (up ? index > 1 : index < node.nodes.length)) {
      const curIndex = zipper[i-1].index
      const aboveSeq = node.nodes[index-1 + (up ? -1 : 1)]
      if (aboveSeq.nodes.length === 0 || curIndex === 0) {
        return aboveSeq.cursorPositionSeqStart
      }
      const elem = aboveSeq.nodes[Math.min(aboveSeq.nodes.length-1, curIndex-1)]
      return elem.cursorPosition
    }
  }
  return cursor
}
function updateCursorPosition(root) {
  let c = -1
  function rec(n) {
    if (!n.root) {
      n.leftCursorPosition = c
    }
    if (n.op === 'frac' || n.op === 'root') {
      n.nodes.forEach(nn => {
        nn.cursorPositionSeqStart = ++c
        nn.nodes.forEach(rec)
      })
    } else if (n.nodes) {
      n.cursorPositionSeqStart = ++c
      n.nodes.forEach(rec)
    }
    n.cursorPosition = ++c
  }
  rec(root)
}
// If already inside a super, return cursor.
// If to the right of a super, return cursor-1
function getPreviousSuperCursor({root, cursor}) {
  const zipper = unzipToCursor(root, cursor)
  const [cur, ...rest] = zipper
  if (cur.node) {
    if (cur.node.op === '^') {
      return cursor - 1
    }
    if (cur.node.sym && cur.node.operator) {
      // Can't super on an operator
      return cursor
    }
  }
  if (rest.length > 0 && rest[0].index === 0) {
    // Can't super at the start of a sequence
    return cursor
  }
  if (rest.some(({node}) => node.op === '^')) {
    return cursor
  }
}
function shiftSelection(state, newCursor) {
  if (state.selectStartCursor !== undefined) {
    if (newCursor === state.selectStartCursor) {
      return {...clearSelection(state), cursor: newCursor}
    }
    return continueSelect(state, newCursor)
  } else {
    return continueSelect({
      ...state,
      selectStartCursor: state.cursor,
      selectEffectiveStartCursor: state.cursor,
    }, newCursor)
  }
}
function onKey(state, key, command, shift) {
  //console.log('got key', key, state)
  if (typeof key === 'object') {
    const alpha = !!key.sym.match(/^[A-Za-z]$/)
    return insert(state, {...key, alpha, operator: true})
  }
  if (key.match(/^[A-Za-z]$/)) {
    return insert(state, {sym: key, alpha: true})
  } else if (key.match(/^[0-9\.]$/)) {
    return insert(state, {sym: key, num: true})
  } else if (key.match(/^[|,]$/)) {
    return insert(state, {sym: key})
  } else if (key === '/') {
    return insertFrac(state)
  } else if (key === '^') {
    const prevSuperCursor = getPreviousSuperCursor(state)
    if (prevSuperCursor !== undefined) {
      return {...state, cursor: prevSuperCursor}
    }
    return insert(state, {op: '^', operator: true, nodes: []})
  } else if (key === 'sqrt') {
    return insert(state, {op: 'sqrt', operator: true, nodes: []})
  } else if (key === 'root') {
    return insert(state, {op: 'root', operator: true, nodes: [
      {nodes: [], rootRadix: true},
      {nodes: [], rootOperand: true}
    ]})
  } else if (binops.includes(key)) {
    return insert(state, {sym: key, operator: true})
  } else if (key === 'Backspace') {
    if (state.selectEffectiveStartCursor !== undefined) {
      return deleteSelection(state)
    }
    return backspace(state)
  } else if (key === 'ArrowLeft') {
    if (shift) {
      return shiftSelection(state, cursorLeft(state.cursor))
    }
    return {...clearSelection(state), cursor: cursorLeft(state.cursor)}
  } else if (key === 'ArrowRight' || key === ' ') {
    if (shift) {
      return shiftSelection(state, cursorRight(state.root, state.cursor))
    }
    return {...clearSelection(state), cursor: cursorRight(state.root, state.cursor)}
  } else if (key === 'ArrowUp') {
    if (shift) {
      return shiftSelection(state, cursorVert(state.root, state.cursor, true))
    }
    return {...clearSelection(state), cursor: cursorVert(state.root, state.cursor, true)}
  } else if (key === 'ArrowDown') {
    if (shift) {
      return shiftSelection(state, cursorVert(state.root, state.cursor, false))
    }
    return {...clearSelection(state), cursor: cursorVert(state.root, state.cursor, false)}
  } else if (parenPairs[key]) {
    return insertLParen(state, [key, parenPairs[key]])
  } else if (oppParenPairs[key]) {
    return insertRParen(state, [oppParenPairs[key], key])
  } else if (unops.includes(key)) {
    return insert(state, {sym: key, operator: true})
  } else if (command) {
    return insert(state, {sym: key, alpha: true})
  }
  return state
}
function stripMetadata(root) {
  function strip(n) {
    delete n.highlight
    delete n.invalid
    if (n.nodes) {
      n.nodes.forEach(strip)
    }
  }
  strip(root)
}
function highlightParens({root, cursor}) {
  const zipper = unzipToCursor(root, cursor)
  const [, {node: seq, index}, ...rest] = zipper
  let iterStep, parBegs, parEnds, startIndex
  // Order of these cases matters
  if (index > 0 && parenPairs[seq.nodes[index-1].sym]) {
    // Open paren to cursor left
    iterStep = 1
    startIndex = index + 1
    parBegs = parenPairs
    parEnds = oppParenPairs
    seq.nodes[index-1].highlight = true
  } else if (index > 1 && oppParenPairs[seq.nodes[index-1].sym]) {
    // Close paren to cursor left
    iterStep = -1
    startIndex = index - 1
    parBegs = oppParenPairs
    parEnds = parenPairs
    seq.nodes[index-1].highlight = true
  } else if (seq.nodes.length > index && parenPairs[seq.nodes[index].sym]) {
    // Open paren to cursor right
    iterStep = 1
    startIndex = index + 2
    parBegs = parenPairs
    parEnds = oppParenPairs
    seq.nodes[index].highlight = true
  } else if (seq.nodes.length > index && oppParenPairs[seq.nodes[index].sym]) {
    // Close paren to cursor right
    iterStep = -1
    startIndex = index
    parBegs = oppParenPairs
    parEnds = parenPairs
    seq.nodes[index].highlight = true
  }
  if (startIndex) {
    let parenLevel = 0
    const iterEnd = iterStep === 1 ? seq.nodes.length : -1
    for (let i = startIndex - 1; i !== iterEnd; i += iterStep) {
      const nn = seq.nodes[i]
      if (parBegs[nn.sym]) {
        parenLevel++
      } else if (parEnds[nn.sym]) {
        if (parenLevel === 0) {
          nn.highlight = true
          break
        } else {
          parenLevel--
        }
      }
    }
  }
}
function checkOperatorRHS(root) {
  let invalid
  function rec(n) {
    if (!n.nodes) {
      return
    }
    n.nodes.forEach(rec)
    if (n.nodes.length === 0 && !n.root) {
      n.invalid = true
      invalid = true
    } else if (n.nodes.length) {
      const last = n.nodes[n.nodes.length - 1]
      if (last.sym && last.operator) {
        last.invalid = true
        invalid = true
      }
    }
  }
  rec(root)
  return !invalid
}
function removeEmptyUnfocusedSupers({root, cursor, ...rest}) {
  let newCursor = cursor
  updateCursorPosition(root)
  function rec(n) {
    if (n.nodes) {
      n.nodes = n.nodes.map(rec)
      let newNodes = []
      for (const m of n.nodes) {
        if (m.op === '^' && m.nodes.length === 0 && cursor !== m.cursorPositionSeqStart) {
          if (m.cursorPositionSeqStart < cursor) {
            newCursor -= 2
          }
        } else {
          newNodes.push(m)
        }
      }
      n.nodes = newNodes
    }
    return n
  }
  root = rec(root)
  return {...rest, root, cursor: newCursor}
}
function findCommonSequence(root, c1, c2) {
  const z1 = unzipToCursor(root, c1).slice(1)
  const z2 = unzipToCursor(root, c2).slice(1)
  for (let i = 0; i < z1.length; i++) {
    const {node: n1, index: i1} = z1[i]
    for (let j = 0; j < z2.length; j++) {
      const {node: n2, index: i2} = z2[j]
      if (n1 === n2 && n1.op !== 'frac' && n1.op !== 'root') {
        return {seq: n1, i1: i1 || 0, i1Lift: i > 0, i2: i2 || 0, i2Lift: j > 0, rest: z1.slice(i + 1)}
      }
    }
  }
  // Should be impossible since at the top is root
  throw new Error('impossible')
}
function continueSelect(state, toCursor) {
  const {root, selectStartCursor} = state
  if (selectStartCursor === toCursor) {
    return {...state, cursor: toCursor}
  }
  let newCursor
  let selectEffectiveStartCursor = selectStartCursor
  const l2r = selectStartCursor < toCursor
  const {seq, i1, i1Lift, i2, i2Lift} = findCommonSequence(root, selectStartCursor, toCursor)
  if (i1 === i2) {
    const nn = seq.nodes[i1-1]
    if (selectStartCursor > toCursor) {
      selectEffectiveStartCursor = nn.cursorPosition
      newCursor = nn.leftCursorPosition
    } else {
      selectEffectiveStartCursor = nn.leftCursorPosition
      newCursor = nn.cursorPosition
    }
  } else {
    if (i1 === 0) {
      selectEffectiveStartCursor = seq.cursorPositionSeqStart
    } else {
      const nn = seq.nodes[i1-1]
      if (i1Lift && l2r) {
        selectEffectiveStartCursor = nn.leftCursorPosition
      } else {
        selectEffectiveStartCursor = nn.cursorPosition
      }
    }
    if (i2 === 0) {
      newCursor = seq.cursorPositionSeqStart
    } else {
      const n2 = seq.nodes[i2-1]
      if (i2Lift && !l2r) {
        newCursor = n2.leftCursorPosition
      } else {
        newCursor = n2.cursorPosition
      }
    }
  }
  return {
    ...state,
    selectEffectiveStartCursor,
    cursor: newCursor
  }
}

function clearSelection(state) {
  return {
    ...state,
    selectStartCursor: undefined,
    selectEffectiveStartCursor: undefined,
    selecting: undefined
  }
}

function reducer(state, action, allowedKeys, onIgnored) {
  switch (action.type) {
    case 'key':
      if (!action.command && allowedKeys && !alwaysAllowed(action.key) && !allowedKeys.includes(action.key) &&
        !allowedKeys.some(ak => shortcutWords.includes(ak) && ak.includes(action.key))) {
        onIgnored && onIgnored(action.key)
        return state
      }
      onIgnored && onIgnored()
      let st = onKey(state, action.key, action.command, action.shift)
      st = removeEmptyUnfocusedSupers(st)
      updateCursorPosition(st.root)
      stripMetadata(st.root)
      highlightParens(st)
      st.valid = checkOperatorRHS(st.root)
      return st
    case 'setCursor':
      const newState = {
        ...clearSelection(state),
        cursor: action.cursor
      }
      highlightParens(newState)
      return newState
    case 'startSelect':
      return {
        ...state,
        selectStartCursor: action.cursor,
        selectEffectiveStartCursor: action.cursor,
        cursor: action.cursor,
        selecting: true
      }
    case 'continueSelect':
      if (state.selecting) {
        return continueSelect(state, action.cursor)
      }
      return state
    case 'endSelect':
      const ns = {...state, selecting: false}
      highlightParens(ns)
      return ns
    default:
      return state
  }
}
const initState = {
  cursor: 0,
  root: {nodes: [], cursorPositionSeqStart: 0, cursorPosition: 0, root: true}
}
export default function useInputReducer(initRoot, allowedKeys, onChange, onIgnored) {
  let s = initState
  if (initRoot) {
    updateCursorPosition(initRoot)
    s = {...s, root: initRoot}
  }
  const [state, setState] = useState(s)
  const disp = useCallback(action => {
    setState(st => {
      const ns = reducer(deepCopy(st), action, allowedKeys, onIgnored)
      onChange && onChange(ns.root, ns.valid)
      return ns
    })
  }, [setState, onChange, onIgnored, allowedKeys])
  return [state, disp]
}
