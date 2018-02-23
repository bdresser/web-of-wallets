import React, { Component } from 'react'
import cytoscape from 'cytoscape'
import keyboardJS from 'keyboardjs'
import uniqid from 'uniqid'
import './App.css'

const cyStyle = [
  {
    selector: 'node',
    style: {
      'content': 'data(text)',
      'background-color': 'grey',
    }
  },
  {
    selector: ':selected',
    style: {
      'background-color': null,
      'border-width': '.1em',
      'border-style': 'solid',
      'border-color': 'blue',
      'line-color': 'blue',
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

  componentDidMount() {
    const a = this.nextId()
    const b = this.nextId()
    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: {
        nodes: [
          { data: { id: a, text: 'A' } },
          { data: { id: b, text: 'B' } },
        ],
        edges: [
          { data: { id: a.concat(b), source: a, target: b } }
        ]
      },
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
      })
      keyboardJS.bind('l', e => {
        const json = JSON.parse(window.localStorage.getItem('mindmap'))
        cy.json(json)
      })
      keyboardJS.bind('x', null, e => {
        if (!this.state.runningLayout) {
          const options = {
            name: 'cose',
            ready: () => {
              this.setState({runningLayout: true})
            },
            stop: () => {
              this.setState({runningLayout: false})
            },
            animate: true,
            animationThreshold: 250,
            refresh: 20,
            fit: true,
            padding: 30,
            nodeRepulsion: node => (2048),
            nodeOverlap: 4,
            idealEdgeLength: edge => (32),
            edgeElasticity: edge => (32),
            nodeDimensionsIncludeLabels: true,
            nestingFactor: 1.2,
            gravity: 1,
            numIter: 1000,
            initialTemp: 1000,
            coolingFactor: 0.99,
            minTemp: 1.0,
            weaver: false,
          }
          const layout = cy.layout(options)
          layout.run()
        }
      })
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
        this.state.selectedNodes.forEach(node => {node.remove()})
      })
      keyboardJS.bind(']', e => {
        this.state.selectedNodes.forEach(node => {
          cy.edges(`[source="${node.id()}"]`).targets().select()
        })
      })
      keyboardJS.bind('[', e => {
        this.state.selectedNodes.forEach(node => {
          cy.edges(`[target="${node.id()}"]`).sources().select()
        })
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
        this.state.selectedNodes.forEach(node => {node.remove()})
      })
      keyboardJS.bind(']', e => {
        this.state.selectedNodes.forEach(node => {
          cy.edges(`[source="${node.id()}"]`).targets().select()
        })
      })
      keyboardJS.bind('[', e => {
        this.state.selectedNodes.forEach(node => {
          cy.edges(`[target="${node.id()}"]`).sources().select()
        })
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
      </div>
    )
  }
}

export default App