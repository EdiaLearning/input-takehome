import React from "react"
import {classes} from '../utils'
function isAlpha(s) {
  return !!s.match(/^[A-Za-z]$/)
}
function inSelectedRange(start, end, cr, cl) {
  if (start < end) {
    return start <= cl && cr <= end
  } else {
    return end <= cl && cr <= start
  }
}
function Cursor() {
  return <span className='cursor'/>
}
function Placeholder({dispatch, cursorPosition, selected, invalid}) {
  return <span
    onClick={() => dispatch({type: 'setCursor', cursor: cursorPosition})}
    className={classes('elem first placeholder', selected && ' selected', invalid && 'invalid')}>
      ⬚
    </span>
}
function Sequence({nodes, dispatch, cursor, selectStartCursor, cursorPosition, cursorPositionSeqStart, root, invalid, ...rest}) {
  let elems = []
  const showCursor = selectStartCursor === undefined || selectStartCursor === cursor
  if (showCursor && cursor === cursorPositionSeqStart && (root || nodes.length > 0)) {
    elems.push(<Cursor key='cursor'/>)
  }
  let lastCursorPos = cursorPositionSeqStart
  if (!root && nodes.length === 0) {
    elems.push(<Placeholder dispatch={dispatch} cursorPosition={cursorPositionSeqStart} selected={cursorPositionSeqStart === cursor} key={cursorPositionSeqStart} invalid={invalid && cursor !== cursorPositionSeqStart}/>)
  } else {
    let prevOp
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      elems.push(<Node key={n.cursorPosition} dispatch={dispatch} cursor={cursor} selectStartCursor={selectStartCursor} selecting={rest.selecting} {...n} first={i === 0} last={i === nodes.length - 1} prevOp={prevOp}/>)
      prevOp = (n.op && n.op !== 'frac' && n.op !== 'sqrt' && n.op !== 'root') || (n.operator && n.sym)
      if (showCursor && cursor === n.cursorPosition) {
        elems.push(<Cursor key='cursor'/>)
      }
      lastCursorPos = n.cursorPosition
    }
  }
  function onMouseDown() {
    dispatch({type: 'startSelect', cursor: lastCursorPos})
    let handleUp
    handleUp = () => {
      dispatch({type: 'endSelect'})
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mouseup', handleUp)
  }
  return <span className={classes('sequence')}>
    <span className={classes('leftPad', root && 'root')} onClick={() => dispatch({type: 'setCursor', cursor: cursorPositionSeqStart})}/>
    {elems}
    <span className={classes('rightPad', root && 'root')} onClick={() => dispatch({type: 'setCursor', cursor: lastCursorPos})} onMouseDown={onMouseDown}/>
  </span>
}
function Super(props) {
  const specialPredecessors = {
    'sqrt': 'bySqrt',
    'root': 'bySqrt',
    'frac': 'byFrac'
  }
  return <span className={classes('super', specialPredecessors[props.prevOp])}><Sequence {...props}/></span>
}
function Frac({nodes, cursorPosition, leftCursorPosition, dispatch, ...rest}) {
  const [num, denom] = nodes
  return <span className={classes('fraction', inSelectedRange(rest.selectStartCursor, rest.cursor, cursorPosition, leftCursorPosition) && 'selected')}>
    <span className='vertical'>
      <span className='numerator'><Sequence {...rest} dispatch={dispatch} {...num}/></span>
      <span className='bar'/>
      <span className='denominator'><Sequence  {...rest} dispatch={dispatch} {...denom}/></span>
    </span>
  </span>
}
function Sqrt(props) {
  function onMouseEnter() {
    props.dispatch({type: 'continueSelect', cursor: props.cursorPosition})
  }
return <span className={classes('squareRoot', inSelectedRange(props.selectStartCursor, props.cursor, props.cursorPosition, props.leftCursorPosition) && 'selected')}>
    <span className='radical' onMouseEnter={onMouseEnter}>√</span>
    <span className='vertical'>
      <span className='sqrtLine'/>
      <Sequence {...props}/>
    </span>
  </span>
}
function Root({nodes: [radix, operands], ...rest}) {
  function onMouseEnter() {
    rest.dispatch({type: 'continueSelect', cursor: rest.cursorPosition})
  }
  return <span className={classes('squareRoot', inSelectedRange(rest.selectStartCursor, rest.cursor, rest.cursorPosition, rest.leftCursorPosition) && 'selected')}>
    <span className='radix'><Sequence {...rest} {...radix}/></span>
    <span className='radical' onMouseEnter={onMouseEnter}>√</span>
    <span className='vertical'>
      <span className='sqrtLine'/>
      <Sequence {...rest} {...operands}/>
    </span>
  </span>
}
const op1 = {
  '+': true,
  '-': true,
  '=': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
}
const dispSyms = {
  '*': '⋅',
  '-': '−',
  '+-': '±',
  '>=': '≥',
  '<=': '≤',
  'uu': '∪',
  'nn': '∩',
  '<:': '⟨',
  ':>': '⟩',
  'oo': '∞',
  'alpha': 'α',
  "beta": 'β',
  "gamma": 'γ',
  "delta": 'δ',
  "epsilon": 'ϵ',
  "varepsilon": 'ε',
  "zeta": 'ζ',
  "eta": 'η',
  "theta": 'θ',
  "Theta": 'Θ',
  "vartheta": 'ϑ',
  "iota": 'ι',
  "kappa": 'κ',
  "lambda": 'λ',
  "Lambda": 'Λ',
  "mu": 'μ',
  "nu": 'ν',
  "xi": 'ξ',
  "Xi": 'Ξ',
  "pi": 'π',
  "Pi": 'Π',
  "rho": 'ρ',
  "sigma": 'σ',
  "Sigma": 'Σ',
  "tau": 'τ',
  "upsilon": 'υ',
  "Upsilon": 'Υ',
  "phi": 'ϕ',
  "Phi": 'Φ',
  "varphi": 'φ',
  "chi": 'χ',
  "psi": 'ψ',
  "Psi": 'Ψ',
  "omega": 'ω',
  "Omega": 'Ω',
  'dne': "DNE",
  'undef': 'undefined'
}
function Sym({selecting, dispatch, sym, sub, sup, operator, implicitParen, cursor, leftCursorPosition, cursorPosition, first, last, num, alpha, highlight, invalid, prevOp, selectStartCursor, ...rest}) {
  function indicatedCursor(e) {
    let cursor = cursorPosition
    const rect = e.target.getBoundingClientRect()
    if ((e.clientX - rect.x) / rect.width < 0.4) {
      cursor = leftCursorPosition
    }
    return cursor
  }
  function onClick(e) {
    let cursor = indicatedCursor(e)
    dispatch({type: 'setCursor', cursor})
  }
  function onMouseDown(e) {
    const cursor = indicatedCursor(e)
    dispatch({type: 'startSelect', cursor})
    let handleUp
    handleUp = () => {
      dispatch({type: 'endSelect'})
      document.removeEventListener('mouseup', handleUp)
    }
    document.addEventListener('mouseup', handleUp)
  }
  function onMouseMove(e) {
    if (selecting) {
      const evCursor = indicatedCursor(e)
      dispatch({type: 'continueSelect', cursor: evCursor})
    }
  }
  let type
  if (op1[sym]) {
    type = 'op op1'
  } else if (operator) {
    type = 'op'
  } else if (sym === 'undef' || sym === 'dne') {
    type = 'op' // style like an op
  } else if (num) {
    type = 'num'
  } else if (alpha) {
    type = 'alpha'
  } else if (sym === ',') {
    type = 'comma'
  }
  let unary
  if ((sym === '-' || sym === '+') && (first || prevOp)) {
    unary = 'unary'
  }
  let dispSym = sym
  if (dispSyms[sym]) {
    dispSym = dispSyms[sym]
  }
  if (sub || sup) {
    dispSym = <>
      <span className={classes("", isAlpha(dispSym) && 'alpha')}>{dispSym}</span>
      {sub && <span className={classes("sub", isAlpha(sub) && 'alpha', !isNaN(parseInt(sub)) && 'num')}>{sub}</span>}
      {sup && <span className={classes("super", isAlpha(sup) && 'alpha', !isNaN(parseInt(sup)) && 'num')}>{sup}</span>}
    </>
  }
  let className = classes('sym',
    first && 'first',
    last && 'last',
    type,
    unary,
    implicitParen && 'implicit',
    highlight && 'highlight',
    invalid && cursor !== cursorPosition && 'invalid',
    selectStartCursor !== undefined && inSelectedRange(selectStartCursor, cursor, cursorPosition, leftCursorPosition) && 'selected'
  )
  return <span onClick={onClick} className={className}
    onMouseDown={onMouseDown} onMouseMove={onMouseMove}>
      {dispSym}
    </span>
}
export default function Node(props) {
  switch (props.op) {
    case '^':
      return <Super {...props}/>
    case 'frac':
      return <Frac {...props}/>
    case 'sqrt':
      return <Sqrt {...props}/>
    case 'root':
      return <Root {...props}/>
    default:
      if (props.nodes) {
        return <Sequence {...props}/>
      } else {
        return <Sym {...props}/>
      }
  }
}
