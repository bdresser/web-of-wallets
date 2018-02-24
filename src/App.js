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
      'border-color': 'black',
      'line-color': 'black',
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
      showInput: false,
      inputSubmitHandler: null,
      inputCancelHandler: null,
      selectedNodes: [],
      runningLayout: false,
      lastContext: null,
      selectedColor: '#fff',
      presetColors: ['#fff','#eee','#ddd','#ccc','#bbb','#aaa','#999','#888','#777'],
      nodeStyles: {},
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
        inputSubmitHandler: () => { return resolve(document.getElementById('textInput').value) },
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
    cytoscape.use(coseBilkent)
    const cy = cytoscape({
      container: document.getElementById('cy'),
      style: cyStyle
    })
    window.cy = cy

    cy.on('select', 'node', e => {
      this.setState({
        selectedNodes: [...this.state.selectedNodes, e.target]
      })
      const n = this.state.selectedNodes.length
      keyboardJS.setContext(n === 1 ? 'singleNode' : 'multipleNodes')
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

    keyboardJS.withContext('root', () => {
      keyboardJS.bind('a', null, e => {
        this.inputText()
          .then(result => {
            cy.add({
              data: { id: this.nextId(), text: result },
              renderedPosition: {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              },
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
        console.group('save graph')
        console.log(json)
        console.log(this.state.presetColors)
        console.log(this.state.nodeStyles)
        console.groupEnd()
      })
      keyboardJS.bind('l', e => {
        const json = JSON.parse(window.localStorage.getItem('mindmap'))
        cy.json(json)
        const presetColors = JSON.parse(window.localStorage.getItem('presetColors'))
        const nodeStyles = JSON.parse(window.localStorage.getItem('nodeStyles'))
        this.setState({
          presetColors,
          nodeStyles,
        })

        for (let id in nodeStyles) {
          cy.$(`#${id}`).style(nodeStyles[id])
        }
        console.group('load graph')
        console.log(json)
        console.log(presetColors)
        console.log(nodeStyles)
        console.groupEnd()
      })
      keyboardJS.bind('x', null, e => {
        if (!this.state.runningLayout) {
          cy.layout(layoutOptions).run()
        }
      })
    })

    const setNodeStyle = (node, style) => {
      node.style(style)
      const nodeStyles = {
        ...this.state.nodeStyles,
        [node.id()]: style
      }
      this.setState({nodeStyles})
    }

    keyboardJS.withContext('singleNode', () => {
      keyboardJS.bind('a', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputText()
          .then(result => {
            const selectedId = selectedNode.id()
            const newId = this.nextId()
            cy.add([{
              data: { id: newId, text: result },
              renderedPosition: {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
              },
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
        cy.collection(this.state.selectedNodes).remove()
      })
      keyboardJS.bind(']', e => {
        cy.collection(this.state.selectedNodes).outgoers('node').select()
      })
      keyboardJS.bind('[', e => {
        cy.collection(this.state.selectedNodes).incomers('node').select()
      })
      keyboardJS.bind('f', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputColor()
          .then(color => {
            setNodeStyle(selectedNode, { 'background-color': color, 'text-background-color': color })
          })
          .catch(error => {
            console.log('set node color error:', error)
          })
          .finally(() => { this.hideColor() })
      })
      keyboardJS.bind('q', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        const successors = selectedNode.successors('node')
        if (successors.length > 0) {
          cy.startBatch()
          if (selectedNode.data('collapsedChildren')) {
            selectedNode.data('collapsedChildren', null)
            selectedNode.style({'content': n => n.data('text')})
            successors.style({'display': 'element'})
          } else {
            selectedNode.data('collapsedChildren', successors.length)
            selectedNode.style({'content': n => `${n.data('text')} [${successors.length}]`})
            successors.style({'display': 'none'})
          }
          cy.endBatch()
        }
      })
    })

    keyboardJS.withContext('multipleNodes', () => {
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
      keyboardJS.bind('c', e => {
        toggleEdges(this.state.selectedNodes)
      })
      keyboardJS.bind('shift + c', e => {
        toggleEdges(this.state.selectedNodes, true)
      })
      keyboardJS.bind('d', e => {
        cy.collection(this.state.selectedNodes).remove()
      })
      keyboardJS.bind(']', e => {
        cy.collection(this.state.selectedNodes).outgoers('node').select()
      })
      keyboardJS.bind('[', e => {
        cy.collection(this.state.selectedNodes).incomers('node').select()
      })
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
      })
      keyboardJS.bind('x', null, e => {
        if (!this.state.runningLayout) {
          const others = cy.nodes().difference(':selected')
          others.lock()
          cy.layout(layoutOptions).run()
          others.unlock()
        }
      })
    })

    keyboardJS.withContext('textInput', () => {
      keyboardJS.bind('enter', e => {
        this.state.inputSubmitHandler()
      })
      keyboardJS.bind(['escape', 'ctrl + ['], e => {
        this.state.inputCancelHandler()
      })
    })

    keyboardJS.withContext('colorInput', () => {
      keyboardJS.bind('enter', e => {
        this.state.inputSubmitHandler()
      })
      keyboardJS.bind(['escape', 'ctrl + ['], e => {
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
  }

  render() {
    return (
      <div>
        <div id="cy">
        </div>
        { this.state.showInput &&
          <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
          }}>
            <input id="textInput" style={{
              width: '100%',
              flex: 1,
              background: 'transparent',
              textAlign: 'center',
              color: 'white',
              fontSize: '3em',
            }} />
          </div>
        }
        { this.state.showColorPicker &&
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
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