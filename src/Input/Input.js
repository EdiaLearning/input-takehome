import React, {forwardRef, useImperativeHandle, useRef, useState, useEffect} from "react"
import {classes} from '../utils'
import useInputReducer from './inputReducer'
import nodeToLatex from './latex'
import Node from './Node'
import katex from 'katex'
import "./Input.sass"

const Input = forwardRef(({
      value, onChange,
      label, postfix,
      disabled, noFocus,
      allowedKeys, onIgnored
    }, ref) => {
  const textRef = useRef()
  function change(nodes, valid) {
    onChange(nodeToLatex(nodes), valid)
  }
  const [state, dispatch] = useInputReducer(null, allowedKeys, change, onIgnored)
  const [isFocused, setIsFocused] = useState()
  useImperativeHandle(ref, () => {
    return {
      dispatch,
      command: key => {
        dispatch({type: 'key', key, command: true})
        focusText()
      }
    }
  })
  function focusText() {
    if (textRef.current) {
      textRef.current.focus()
    }
  }
  function handleKey(e) {
    dispatch({type: 'key', key: e.key, shift: e.shiftKey})
  }
  function noop() {}
  useEffect(() => {
    if (!noFocus) {
      focusText()
    }
  }, [noFocus])
  const labelElem = label && <span className={'label' + (postfix ? ' postfix' : '')} dangerouslySetInnerHTML={{__html: katex.renderToString(label.text)}}/>
  return <div className={classes('mathInput', (state.selecting || isFocused) && 'focused')}  onClick={focusText}>
    <textarea ref={textRef}
      className='inputCollector'
      autoCapitalize="off" autoComplete="off" autoCorrect="off"
      spellCheck="false" aria-hidden="true" tabIndex="0" inputMode="decimal"
      value="" onChange={noop} onKeyDown={handleKey}
      onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused()}
      disabled={disabled}
    />
    {!postfix && labelElem}
    <Node dispatch={dispatch} {...state.root} cursor={state.cursor} selectStartCursor={state.selectEffectiveStartCursor} selecting={state.selecting}/>
    {postfix && labelElem}
  </div>
})

export default Input
