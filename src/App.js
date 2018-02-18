import React, { Component } from 'react'
import { ReactCytoscape } from 'react-cytoscape'
import './App.css'

class App extends Component {
  getElements() {
    return [
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      {
        data: {
          id: 'ab',
          source: 'a',
          target: 'b'
        }
      }
    ]
  }

  render() {
    return (
      <div>
        <ReactCytoscape
          elements={this.getElements()}
          containerID="cy"
          cyRef={(cy) => {
            console.log(cy)
          }}
        />
      </div>
    )
  }
}

export default App