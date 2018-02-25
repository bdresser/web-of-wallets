import React, { Component } from 'react'
import cytoscape from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import keyboardJS from 'keyboardjs'
import uniqid from 'uniqid'
import { SketchPicker } from 'react-color'
import './App.css'

const cyStyle = [
  {
    selector: 'node',
    style: {
      'content': 'data(text)',
      'background-color': 'grey',
      'text-margin-y': 0,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': 240,
      'width': 'label',
      'height': 'label',
      'shape': 'roundrectangle',
      'padding': 10,
      'color': 'white',
    }
  },
  {
    selector: ':selected',
    style: {
      'background-color': null,
      'border-width': '.3em',
      'border-style': 'solid',
      'border-color': 'white',
      'line-color': 'white',
    }
  },
  {
    selector: 'edge',
    style: {
      'mid-target-arrow-shape': 'triangle',
      'arrow-scale': 1.5,
    }
  }
]

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      selectedNodes: [],
      siblings: null,
      selectedSibling: null,
      collapsedNodes: [],

      lastContext: null,
      inputSubmitHandler: null,
      inputCancelHandler: null,
      showInput: false,
      showColorPicker: false,
      selectedColor: '#fff',

      nodeStyles: {},
      presetColors: ['#fff','#eee','#ddd','#ccc','#bbb','#aaa','#999','#888','#777'],

      runningLayout: false,
    }
  }
  
  nextId() {
    return uniqid.time()
  }

  inputText() { 
    const lastContext = keyboardJS.getContext()
    keyboardJS.setContext('textInput')
    return new Promise((resolve, reject) => {
      this.setState({
        showInput: true,
        lastContext,
        inputSubmitHandler: () => {
          const inputText = document.getElementById('textInput').value
          return !!inputText && inputText !== '' ?
            resolve(inputText) :
            reject('empty input')
        },
        inputCancelHandler: () => { return reject('canceled by user') },
      })
      document.getElementById('textInput').focus()
    })
  }

  hideInput() {
    keyboardJS.setContext(this.state.lastContext)
    this.setState({
      lastContext: null,
      showInput: false,
    })
  }

  inputColor() {
    const lastContext = keyboardJS.getContext()
    keyboardJS.setContext('colorInput')
    return new Promise((resolve, reject) => {
      this.setState({
        showColorPicker: true,
        lastContext,
        inputSubmitHandler: () => { return resolve(this.state.selectedColor) },
        inputCancelHandler: () => { return reject('canceled by user') },
      })
    })
  }

  hideColor() {
    keyboardJS.setContext(this.state.lastContext)
    this.setState({
      lastContext: null,
      showColorPicker: false,
    })
  }

  componentDidMount() {
    // --------------------
    // INITIALIZE CYTOSCAPE
    // --------------------
    cytoscape.use(coseBilkent)
    const cy = cytoscape({
      container: document.getElementById('cy'),
      style: cyStyle
    })
    window.cy = cy

    // ----------------
    // SET UP FUNCTIONS
    // ----------------
    const layoutOptions = {
      name: 'cose-bilkent',
      ready: () => {
        this.setState({runningLayout: true})
      },
      stop: () => {
        this.setState({runningLayout: false})
      },
      animate: false,
      fit: false,
      padding: 10,
      nodeDimensionsIncludeLabels: true,
      randomize: false,
    }

    const setNodeStyle = (node, style) => {
      node.style(style)
      const nodeStyles = {
        ...this.state.nodeStyles,
        [node.id()]: style
      }
      this.setState({nodeStyles})
    }

    const toggleEdge = (a, b) => {
      const edgeId = `#${a}${b}`
      const edge = cy.$(edgeId)
      if (edge.length) {
        cy.remove(edgeId)
      } else {
        cy.add({ data: { id: a + b, source: a, target: b } })
      }
    }

    const toggleEdges = (nodes, reverse) => {
      if (nodes.length > 1) {
        for (let i = 0; i < nodes.length - 1; i++) {
          toggleEdge(
            nodes[i + (reverse ? 1 : 0)].data().id,
            nodes[i + (reverse ? 0 : 1)].data().id
          )
        }
      }
    }

    const getNewNodePosition = () => {
      const d = Math.random() * Math.min(window.innerHeight, window.innerWidth) / 4
      const theta = Math.random() * 2 * Math.PI
      return {
        x: window.innerWidth / 2 + d * Math.cos(theta),
        y: window.innerHeight / 2 + d * Math.sin(theta),
      }
    }

    const setSiblings = n => {
      let setNew = true
      
      if (this.state.siblings) {
        let selectedSibling = this.state.siblings.indexOf(n)
        if (selectedSibling !== -1) {
          setNew = false
          this.setState({
            selectedSibling,
          })
        }
      }

      if (setNew) {
        const siblings = n.incomers().outgoers('node').toArray()
        const selectedSibling = siblings.indexOf(n) 
        this.setState({
          siblings,
          selectedSibling,
        })
      }
    }

    const collapseNodes = (nodes, numChildren) => {
      nodes
        .data('collapsedChildren', numChildren)
        .style({'content': n => `${n.data('text')} (+${numChildren})`})
    }

    const uncollapseNodes = nodes => {
      nodes
        .data('collapsedChildren', null)
        .style({'content': n => n.data('text')})
    }

    const removeSelectedNodes = () => {
      const selectedCollapsedNodes = this.state.collapsedNodes
        .intersection(this.state.selectedNodes)
      cy.startBatch()
      selectedCollapsedNodes.forEach(n => {
        uncollapseNodes(n)
        n.successors('node').style({'display': 'element'})
      })
      cy.endBatch()
      this.setState({
        collapsedNodes: this.state.collapsedNodes
          .difference(selectedCollapsedNodes)
      })
      cy.collection(this.state.selectedNodes).remove()
    }

    // ----------------------
    // SET UP EVENT LISTENERS
    // ----------------------
    cy.on('select', 'node', e => {
      this.setState({
        selectedNodes: [...this.state.selectedNodes, e.target]
      })
      const n = this.state.selectedNodes.length
      if (n === 1) {
        keyboardJS.setContext('singleNode')
        setSiblings(this.state.selectedNodes[0])
      } else {
        keyboardJS.setContext('multipleNodes')
      }
    })

    cy.on('unselect', 'node', e => {
      const i = this.state.selectedNodes.indexOf(e.target)
      const selectedNodes = [
        ...this.state.selectedNodes.slice(0, i),
        ...this.state.selectedNodes.slice(i + 1)
      ]
      const n = selectedNodes.length
      this.setState({
        selectedNodes: selectedNodes
      })

      if (n === 1) keyboardJS.setContext('singleNode')
      else if (n === 0) keyboardJS.setContext('root')
    })

    cy.on('remove', 'node', e => {
      e.target.unselect()
    })

    // -------------------
    // SET UP KEY BINDINGS
    // -------------------
    keyboardJS.withContext('root', () => {
      keyboardJS.bind('a', null, e => {
        this.inputText()
          .then(result => {
            cy.add({
              data: { id: this.nextId(), text: result },
              renderedPosition: getNewNodePosition(),
            })
          })
          .catch(error => {
            console.log('add node canceled: ', error)
          })
          .finally(() => {this.hideInput()})
      })
      keyboardJS.bind('s', e => {
        const json = cy.json()
        window.localStorage.setItem('mindmap', JSON.stringify(json))
        window.localStorage.setItem('presetColors', JSON.stringify(this.state.presetColors))
        window.localStorage.setItem('nodeStyles', JSON.stringify(this.state.nodeStyles))
        window.localStorage.setItem('collapsedNodes', JSON.stringify(
          this.state.collapsedNodes.toArray().map(n => (`#${n.id()}`))
        ))
        console.group('save graph')
        console.log(json)
        console.log(this.state.presetColors)
        console.log(this.state.nodeStyles)
        console.log(this.state.collapsedNodes)
        console.groupEnd()
      })
      keyboardJS.bind('l', e => {
        const json = JSON.parse(window.localStorage.getItem('mindmap'))
        cy.json(json)
        const presetColors = JSON.parse(window.localStorage.getItem('presetColors'))
        const nodeStyles = JSON.parse(window.localStorage.getItem('nodeStyles'))
        const collapsedNodeIds = JSON.parse(window.localStorage.getItem('collapsedNodes'))
        const collapsedNodes = collapsedNodeIds ? cy.$(collapsedNodeIds.join(',')) : cy.collection()

        cy.startBatch()
        for (let id in nodeStyles) {
          cy.$(`#${id}`).style(nodeStyles[id])
        }
        cy.$('node[display="none"]').style({'display': 'element'})
        collapsedNodes.forEach(n => {
          const successors = n.successors('node')
          collapseNodes(n, successors.length)
          successors.style({'display': 'none'})
        })
        cy.endBatch()

        this.setState({
          presetColors,
          nodeStyles,
          collapsedNodes,
        })
        console.group('load graph')
        console.log(json)
        console.log(presetColors)
        console.log(nodeStyles)
        console.log(collapsedNodes)
        console.groupEnd()
      })
      keyboardJS.bind('x', null, e => {
        if (!this.state.runningLayout) {
          cy.layout(layoutOptions).run()
        }
      })
      keyboardJS.bind('q', e => {
        cy.startBatch()
        this.state.collapsedNodes.forEach(n => {
          uncollapseNodes(n)
          n.successors('node').style({'display': 'element'})
        })
        cy.endBatch()
        this.setState({
          collapsedNodes: cy.collection()
        })
      }, null)
    })

    keyboardJS.withContext('singleNode', () => {
      keyboardJS.bind('a', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputText()
          .then(result => {
            const selectedId = selectedNode.id()
            const newId = this.nextId()
            cy.add([{
              data: { id: newId, text: result },
              renderedPosition: getNewNodePosition(),
            }, {
              data: { id: selectedId + newId, source: selectedId, target: newId }
            }])
          })
          .catch(error => {
            console.log('add child node canceled: ', error)
          })
          .finally(() => {this.hideInput()})
      })
      keyboardJS.bind('e', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputText()
          .then(result => {
            selectedNode.data('text', result)
          })
          .catch(error => {
            console.log('edit node text canceled: ', error)
          })
          .finally(() => {this.hideInput()})
      })
      keyboardJS.bind('d', e => {
        removeSelectedNodes()
      }, null)
      keyboardJS.bind(']', e => {
        cy.collection(this.state.selectedNodes).outgoers('node').select()
      }, null)
      keyboardJS.bind('[', e => {
        cy.collection(this.state.selectedNodes).incomers('node').select()
      }, null)
      keyboardJS.bind('f', e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputColor()
          .then(color => {
            setNodeStyle(selectedNode, { 'background-color': color })
          })
          .catch(error => {
            console.log('set node color error:', error)
          })
          .finally(() => { this.hideColor() })
      }, null)
      keyboardJS.bind('q', e => {
        // toggle collapse children
        const selectedNode = this.state.selectedNodes[0]
        const successors = selectedNode.successors('node')
        if (successors.length > 0) {
          cy.startBatch()
          if (selectedNode.data('collapsedChildren')) {
            // expand children
            uncollapseNodes(selectedNode)
            successors.style({'display': 'element'})
            this.setState({
              collapsedNodes: this.state.collapsedNodes.difference(selectedNode)
            })
          } else {
            // expand any collapsed successors
            const collapsedSuccessors = successors.intersection(this.state.collapsedNodes)
            uncollapseNodes(collapsedSuccessors)
            // collapse children
            collapseNodes(selectedNode, successors.length)
            successors.style({'display': 'none'})
            this.setState({
              collapsedNodes: this.state.collapsedNodes.difference(collapsedSuccessors).union(selectedNode)
            })
          }
          cy.endBatch()
        }
      }, null)
      keyboardJS.bind('h', e => {
        let numSiblings = this.state.siblings.length
        if (numSiblings > 1) {
          let prevSibling = this.state.selectedSibling > 0 ?
            this.state.selectedSibling - 1 :
            numSiblings - 1
          this.state.siblings[this.state.selectedSibling].unselect()
          this.state.siblings[prevSibling].select()
        }
      }, null)
      keyboardJS.bind('j', e => {
        const selectedNode = this.state.selectedNodes[0]
        const parents = selectedNode.incomers('node')
        if (parents.length) {
          selectedNode.unselect()
          parents[0].select()
        }
      }, null)
      keyboardJS.bind('k', e => {
        const selectedNode = this.state.selectedNodes[0]
        const children = selectedNode.outgoers('node')
        if (children.length) {
          selectedNode.unselect()
          children[0].select()
        }
      }, null)
      keyboardJS.bind('l', e => {
        let numSiblings = this.state.siblings.length
        if (numSiblings > 1) {
          let nextSibling = this.state.selectedSibling < numSiblings - 1 ?
            this.state.selectedSibling + 1 :
            0
          this.state.siblings[this.state.selectedSibling].unselect()
          this.state.siblings[nextSibling].select()
        }
      }, null)
    })

    keyboardJS.withContext('multipleNodes', () => {
      keyboardJS.bind('c', e => {
        toggleEdges(this.state.selectedNodes)
      }, null)
      keyboardJS.bind('shift + c', e => {
        toggleEdges(this.state.selectedNodes, true)
      }, null)
      keyboardJS.bind('d', e => {
        removeSelectedNodes()
      }, null)
      keyboardJS.bind(']', e => {
        cy.collection(this.state.selectedNodes).outgoers('node').select()
      }, null)
      keyboardJS.bind('[', e => {
        cy.collection(this.state.selectedNodes).incomers('node').select()
      }, null)
      keyboardJS.bind('f', null, e => {
        this.inputColor()
          .then(color => {
            const style = { 'background-color': color }
            this.state.selectedNodes.forEach(node => {
              setNodeStyle(node, style)
            })
          })
          .catch(error => {
            console.log('set node color canceled: ', error)
          })
          .finally(() => { this.hideColor() })
      }, null)
      keyboardJS.bind('x', e => {
        if (!this.state.runningLayout) {
          const others = cy.nodes().difference(':selected')
          others.lock()
          cy.layout(layoutOptions).run()
          others.unlock()
        }
      }, null)
    })

    keyboardJS.withContext('textInput', () => {
      keyboardJS.bind('enter', null, e => {
        this.state.inputSubmitHandler()
      })
      keyboardJS.bind(['escape', 'ctrl + ['], null, e => {
        this.state.inputCancelHandler()
      })
    })

    keyboardJS.withContext('colorInput', () => {
      keyboardJS.bind('enter', null, e => {
        this.state.inputSubmitHandler()
      })
      keyboardJS.bind(['escape', 'ctrl + ['], null, e => {
        this.state.inputCancelHandler()
      })

      const setColor = i => {
        this.setState({
          presetColors: [
            ...this.state.presetColors.slice(0, i),
            this.state.selectedColor,
            ...this.state.presetColors.slice(i + 1)
          ]
        })
      }
      keyboardJS.bind('ctrl + 1', e => { setColor(0) })
      keyboardJS.bind('ctrl + 2', e => { setColor(1) })
      keyboardJS.bind('ctrl + 3', e => { setColor(2) })
      keyboardJS.bind('ctrl + 4', e => { setColor(3) })
      keyboardJS.bind('ctrl + 5', e => { setColor(4) })
      keyboardJS.bind('ctrl + 6', e => { setColor(5) })
      keyboardJS.bind('ctrl + 7', e => { setColor(6) })
      keyboardJS.bind('ctrl + 8', e => { setColor(7) })
      keyboardJS.bind('ctrl + 9', e => { setColor(8) })
      keyboardJS.bind('ctrl + 0', e => { setColor(9) })

      const selectPresetColor = i => {
        this.setState({ selectedColor: this.state.presetColors[i] })
        this.state.inputSubmitHandler()
      }
      keyboardJS.bind('1', e => { selectPresetColor(0) })
      keyboardJS.bind('2', e => { selectPresetColor(1) })
      keyboardJS.bind('3', e => { selectPresetColor(2) })
      keyboardJS.bind('4', e => { selectPresetColor(3) })
      keyboardJS.bind('5', e => { selectPresetColor(4) })
      keyboardJS.bind('6', e => { selectPresetColor(5) })
      keyboardJS.bind('7', e => { selectPresetColor(6) })
      keyboardJS.bind('8', e => { selectPresetColor(7) })
      keyboardJS.bind('9', e => { selectPresetColor(8) })
      keyboardJS.bind('0', e => { selectPresetColor(9) })
    })

    keyboardJS.setContext('root')

    // -----------------
    // SET INITIAL STATE
    // -----------------
    this.setState({
      collapsedNodes: cy.collection()
    })
  }

  render() {
    return (
      <div>
        <div id="cy">
        </div>
        { this.state.showInput &&
          <div className="inputOverlay">
            <input id="textInput" />
          </div>
        }
        { this.state.showColorPicker &&
          <div className="inputOverlay">
            <SketchPicker
              color={this.state.selectedColor}
              onChangeComplete={color => { this.setState({selectedColor: color.hex}) }}
              presetColors={this.state.presetColors}
            />
          </div>
        }
      </div>
    )
  }
}

export default App