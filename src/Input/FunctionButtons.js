import React from "react"
import katex from 'katex'
import './FunctionButtons.sass'
import {symToLatex} from './latex'

const functionDisplay = {
  '/': '\\frac{\\square}{\\square}',
  'sqrt': '\\sqrt{\\square}',
  'root': '\\sqrt[\\square]{\\square}',
  '^': '\\square^\\square',
  'dne': '\\text{DNE}',
  'undef': '\\text{UND}',
}
function symLatex(sym) {
  if (sym === '*') {
    return sym
  }
  let latex = functionDisplay[sym] || symToLatex[sym]
  if (latex) {
    return latex
  }
  if (sym.length > 1) {
    return '\\' + sym
  }
  return sym
}
function buttonLatex(button) {
  let latex
  if (typeof button === 'object') {
    latex = symLatex(button.sym)
    if (button.sub) {
      latex += `_{${button.sub}}`
    }
    if (button.sup) {
      latex += `^{${button.sup}}`
    }
  } else {
    latex = symLatex(button)
  }
  return latex
}
export default function FunctionButtons({commands, inputRef}) {
  const onPress = c => inputRef.current.command(c)
  return <div className='functionButtons'>
    {commands.map(button => <div key={JSON.stringify(button)} className='functionButton' onClick={() => onPress(button)}>
      <span dangerouslySetInnerHTML={{__html: katex.renderToString(buttonLatex(button))}}/>
    </div>)}
  </div>
}
