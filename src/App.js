import React, { Component } from 'react'
import { ReactCytoscape } from 'react-cytoscape'
import keyboardJS from 'keyboardjs'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      cy: null
    }
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
      <div>
        <ReactCytoscape
          elements={this.getElements()}
          containerID="cy"
          style={[
            {
              selector: 'node',
              style: {
                'content': 'data(text)'
              }
            },
            {
              selector: ':selected',
              style: {
                'background-color': 'green'
              }
            }
          ]}
          cyRef={(cy) => { this.initCy(cy) }}
          cytoscapeOptions={{
            wheelSensitivity: 0.1,
            boxSelectionEnabled: true,
          }}
        />
      </div>
    )
  }
}

export default App