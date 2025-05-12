export const symToLatex = {
  '{': '\\{ ',
  '}': '\\} ',
  '*': '\\cdot ',
  'nn': '\\cap',
  'uu': '\\cup',
  '<=': '\\le',
  '>=': '\\ge',
  '<:': '\\langle',
  ':>': '\\rangle',
  'oo': '\\infty',
  'cis': '\\mathop{\\mathrm{cis}}',
  'undef': '\\text{undefined}',
  'dne': '\\text{DNE}'
}
export default function nodeToLatex(n) {
  let lnodes
  if (n.nodes) {
    lnodes = n.nodes.map(nodeToLatex)
  }
  switch (n.op) {
    case 'frac':
      return `\\frac{${lnodes[0]}}{${lnodes[1]}}`
    case 'sqrt':
      return `\\sqrt{${lnodes.join("")}}`
    case 'root':
      return `\\sqrt[${lnodes[0]}]{${lnodes[1]}}`
    case '^':
      if (lnodes.length === 0) {
        return ''
      }
      return `^{${lnodes.join("")}}`
    default:
      if (lnodes) {
        if (lnodes.length > 0) {
          if (n.root) {
            return lnodes.join("")
          } else {
            return `{${lnodes.join("")}}`
          }
        } else {
          return ""
        }
      }
      let lsym = symToLatex[n.sym] || (n.sym.length > 1 && `\\${n.sym} `) || n.sym
      if (n.sup) {
        lsym += `^{${n.sup}}`
      }
      if (n.sub) {
        lsym += `_{${n.sub}}`
      }
      return lsym
  }
}
