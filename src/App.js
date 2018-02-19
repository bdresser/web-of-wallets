import React, { Component } from 'react'
import cytoscape from 'cytoscape'
import keyboardJS from 'keyboardjs'
import './App.css'

const cyStyle = [
  {
    selector: 'node',
    style: {
      'content': 'data(text)'
    }
  },
  {
    selector: ':selected',
    style: {
      'border-width': '.1em',
      'border-style': 'solid',
      'border-color': 'blue',
    }
  }
]

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      cy: null
    }
  }

  componentDidMount() {
    let cy = cytoscape({
      container: document.getElementById('cy'),
      elements: {
        nodes: [
          { data: { id: 'a', text: 'hello' } },
          { data: { id: 'b', text: 'goodbye' } },
        ],
        edges: [
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ]
      },
      style: cyStyle
    })
    window.cy = cy

    cy.on('select', 'node', e => {
      console.log('node selected')
      console.log(e)
      let selectedNodes = cy.$('node:selected').length
      keyboardJS.setContext(selectedNodes === 1 ? 'singleNode' : 'multipleNodes')
    })

    cy.on('unselect', 'node', e => {
      console.log('node unselected')
      console.log(e)
      let selectedNodes = cy.$('node:selected').length
      if (selectedNodes === 1) keyboardJS.setContext('singleNode')
      else if (selectedNodes === 0) keyboardJS.setContext('root')
    })

    keyboardJS.withContext('root', () => {
      keyboardJS.bind('a', e => {
        console.log('add node')
      })
    })

    keyboardJS.withContext('singleNode', () => {
      keyboardJS.bind('ctrl + e', e => {
        console.log('edit node text')
      })
    })

    keyboardJS.withContext('multipleNodes', () => {
      keyboardJS.bind('ctrl + g', e => {
        console.log('group nodes')
      })
    })

    keyboardJS.setContext('root')
  }

  getElements() {
    return {
      nodes: [
        { data: { id: 'a', text: 'hello' } },
        { data: { id: 'b', text: 'goodbye' } },
      ],
      edges: [
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    }
  }

  initCy(cy) {
    if (this.state.cy) return
    window.cy = cy
    this.setState({
      cy: cy
    })
    console.log('init cy')
    keyboardJS.bind('a', e => {
      console.log('a pressed')
      console.log(e)
    })
  }

  render() {
    return (
      <div id="cy">
      </div>
    )
  }
}

export default App