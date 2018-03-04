import React, { Component } from 'react'
import cytoscape from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import popper from 'cytoscape-popper'
import keyboardJS from 'keyboardjs'
import uniqid from 'uniqid'
import { SketchPicker } from 'react-color'
import './App.css'

const cyStyle = [
  {
    selector: 'node',
    style: {
      'display': 'data(display)',
      'content': 'data(text)',
      'background-color': 'data(color)',
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
    }
  },
  {
    selector: 'edge',
    style: {
      'mid-target-arrow-shape': 'triangle',
      'arrow-scale': 1.5,
    }
  },
  {
    selector: 'node.link',
    style: {
      'shape': 'cutrectangle',
    }
  },
  {
    selector: '.fade',
    style: {
      'opacity': 0.2,
    }
  },
]

const defaultNodeData = {
  display: 'element',
  tags: [],
}
const defaultNodeColor = 'grey'
const defaultViewport = {zoom: 1, pan: {x:0, y:0}}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      siblings: null,
      selectedNodes: [],
      collapsedNodes: [],
      selectedSibling: null,
      tags: {},
      focusedTag: null,
      viewports: Array(10).fill(defaultViewport),

      showInput: false,
      lastContext: null,
      selectedColor: '#fff',
      showColorPicker: false,
      inputSubmitHandler: null,
      inputCancelHandler: null,
      showTags: true,

      presetColors: ['#fff','#eee','#ddd','#ccc','#bbb','#aaa','#999','#888','#777','#000'],

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
    cytoscape.use(popper)
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
      ready: () => { this.setState({runningLayout: true}) },
      stop: () => { this.setState({runningLayout: false}) },
      // settings animate: true breaks layout for selected subset
      animate: false,
      fit: false,
      nodeDimensionsIncludeLabels: true,
      randomize: false,
      idealEdgeLength: 80,
      edgeElasticity: 0.04,
    }

    const toggleEdge = (a, b) => {
      const edgeId = `#${a}${b}`
      const edge = cy.$(edgeId)
      if (edge.length) {
        cy.remove(edgeId)
      } else {
        const edge = cy.add({ data: { id: a + b, source: a, target: b } })
        if (this.state.focusedTag) edge.addClass('fade')
      }
    }

    const toggleEdges = (reverse) => {
      const nodes = this.state.selectedNodes
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
        .style({'content': n => (`${n.data('text')} (+${numChildren})`)})
    }

    const uncollapseNodes = nodes => {
      nodes
        .data('collapsedChildren', null)
        .removeStyle('content label')
    }

    const removeSelectedNodes = () => {
      const selectedCollapsedNodes = cy.collection(this.state.selectedNodes)
        .intersection(this.state.collapsedNodes)
      cy.startBatch()
      selectedCollapsedNodes.forEach(n => {
        uncollapseNodes(n)
        n.successors('node').data('display', 'element')
      })
      cy.endBatch()
      this.setState({
        collapsedNodes: this.state.collapsedNodes
          .difference(selectedCollapsedNodes)
      })
      this.state.selectedNodes.forEach(n => {
        n.data('tags').forEach(tag => {
          console.log(`remove ${n.id()} from tags[${tag}]`)
          this.setState({
            tags: {
              ...this.state.tags,
              [tag]: this.state.tags[tag].filter(i => (i !== n))
            }
          })
        })

        this.state.viewports.forEach((viewport, i) => {
          if (viewport.nodes && viewport.nodes.contains(n)) {
            const newNodes = viewport.nodes.difference(n)
            const newViewport = newNodes.length > 0 ?
              { nodes: newNodes } :
              defaultViewport
            const viewports = [
              ...this.state.viewports.slice(0, i),
              newViewport,
              ...this.state.viewports.slice(i + 1)
            ]
            this.setState({ viewports })
          }
        })
      })
      cy.collection(this.state.selectedNodes).remove()
    }

    const showPopper = n => {
      const pop = n.popper({
        content: () => {
          const div = document.createElement('div')
          div.className = 'urlPopper'
          const a = document.createElement('a')
          a.href = n.data('url')
          a.target = '_blank'
          a.innerHTML = n.data('url')
          div.appendChild(a)
          document.body.appendChild(div)
          return div
        },
        popper: {
          removeOnDestroy: true,
          placement: 'bottom',
          popper: {
            modifiers: {
              offset: { offset: '100, 100', enabled: true }
            }
          }
        }
      })
      n.data('popper', pop)
      let update = () => { pop.scheduleUpdate() }
      cy.on('pan zoom resize', update)
      n.on('position', update)
    }

    const hidePopper = n => {
      const pop = n.data('popper')
      if (pop) {
        pop.destroy()
        n.data('popper', null)
      }
    }

    const getTagAndToggle = () => {
      cy.startBatch()
      const focusedTag = this.state.focusedTag
      if (focusedTag) {
        console.log('toggle focused tag:', focusedTag)
        toggleTag(focusedTag, true)
        cy.endBatch()
      } else {
        this.inputText()
          .then(tag => { toggleTag(tag) })
          .catch(error => { console.log('toggle tag error:', error) })
          .finally(() => {
            this.hideInput()
            cy.endBatch()
          })
      }
    }

    const toggleTag = (tag, isFocused) => {
      this.state.selectedNodes.forEach(n => {
        const tags = n.data('tags')
        // console.log('tags: ', tags)
        const tagIndex = tags.indexOf(tag)
        const shouldAddTag = tagIndex === -1
        n.data('tags', shouldAddTag ?
          [...tags, tag] :
          [...tags.slice(0, tagIndex), ...tags.slice(tagIndex + 1)]
        )

        const taggedNodes = this.state.tags[tag] || cy.collection()
        this.setState({
          tags: {
            ...this.state.tags,
            [tag]: shouldAddTag ?
              taggedNodes.union(n) :
              taggedNodes.difference(n)
          }
        })

        if (isFocused) n.toggleClass('fade', !shouldAddTag)
      })
    }

    const focusTag = () => {
      cy.startBatch()
      cy.$('.fade').removeClass('fade')
      this.inputText()
        .then(tag => {
          const taggedNodes = this.state.tags[tag] || cy.collection()
          cy.$().difference(taggedNodes).addClass('fade')
          this.setState({ focusedTag: tag.length > 0 ? tag : null })
        })
        .catch(error => {
          this.setState({ focusedTag: null })
          console.log('focus tag error: ', error)
        })
        .finally(() => {
          this.hideInput()
          cy.endBatch()
        })
    }

    this.toggleFocusTag = tag => {
      cy.startBatch()
      cy.$('.fade').removeClass('fade')
      const isFocused = this.state.focusedTag === tag
      if (!isFocused) {
        const taggedNodes = this.state.tags[tag] || cy.collection()
        cy.$().difference(taggedNodes).addClass('fade')
      }
      this.setState({ focusedTag: isFocused ? null : tag })
      cy.endBatch()
    }

    this.selectTag = tag => {
      const taggedNodes = this.state.tags[tag]
      if (taggedNodes && taggedNodes.length > 0) {
        taggedNodes.select()
      }
    }

    const selectTaggedNodes = () => {
      this.inputText()
        .then(tag => {
          this.hideInput()
          this.selectTag(tag)
        })
        .catch(error => {
          console.log('select nodes by tag error: ', error)
          this.hideInput()
        })
    }

    const getNewNode = (id, text, color) => {
      return {
        data: { ...defaultNodeData, text, id, color },
        renderedPosition: getNewNodePosition()
      }
    }

    const getNewEdge = (sourceId, targetId) => {
      return { data: { id: sourceId + targetId, source: sourceId, target: targetId }}
    }

    const addNode = () => {
      this.inputText()
        .then(text => {
          const newNode = cy.add(getNewNode(this.nextId(), text, defaultNodeColor))
          if (this.state.focusedTag) newNode.addClass('fade')
        })
        .catch(error => { console.log('add child node error: ', error) })
        .finally(() => { this.hideInput() })
    }

    const addChildNode = () => {
      const selectedNode = this.state.selectedNodes[0]
      this.inputText()
        .then(text => {
          const sourceId = selectedNode.id()
          const targetId = this.nextId()
          const newEles = cy.add([
            getNewNode(targetId, text, defaultNodeColor),
            getNewEdge(sourceId, targetId)
          ])
          if (this.state.focusedTag) newEles.addClass('fade')
        })
        .catch(error => { console.log('add child node error: ', error) })
        .finally(() => { this.hideInput() })
    }

    const setViewport = i => () => {
      const viewport = this.state.selectedNodes.length > 0 ?
        { nodes: cy.collection(this.state.selectedNodes) } :
        { zoom: cy.zoom(), pan: { ...cy.pan() }}
      this.setState({
        viewports: [
          ...this.state.viewports.slice(0, i),
          viewport,
          ...this.state.viewports.slice(i + 1)
        ]
      })
    }

    const selectViewport = i => () => {
      const viewport = this.state.viewports[i]
      if (viewport.nodes) {
        const selected = cy.collection(this.state.selectedNodes)
        if (selected.same(viewport.nodes)) {
          if (viewport.nodes.length === 1) {
            cy.center(viewport.nodes)
          } else {
            cy.fit(viewport.nodes, 50)
          }
        } else {
          selected.unselect()
          viewport.nodes.select()
        }
      } else {
        cy.viewport(this.state.viewports[i])
      }
    }

    this.idsFromNodes = nodes => (
      nodes.toArray().map(n => (`#${n.id()}`))
    )

    this.nodesFromIds = ids => (
      cy.$(ids.join(','))
    )

    const saveData = () => {
      const tags = {}
      for (const tag in this.state.tags) {
        const tagCollection = this.state.tags[tag]
        if (tagCollection && tagCollection.length > 0) {
          tags[tag] = this.idsFromNodes(tagCollection)
        }
      }

      const viewports = Array(10)
      for (const i in this.state.viewports) {
        const viewport = this.state.viewports[i]
        viewports[i] = viewport.nodes ?
          { nodes: this.idsFromNodes(viewport.nodes) } :
          viewport
      }

      const json = JSON.stringify({
        cy: cy.json(),
        collapsedNodes: this.idsFromNodes(this.state.collapsedNodes),
        viewports: viewports,
        tags: tags,
        focusedTag: this.state.focusedTag,
        presetColors: this.state.presetColors,
      })

      this.inputText()
        .then(filename => {
          const blob = new Blob([json], { type: 'application/octet-stream'})
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.setAttribute('href', url)
          link.setAttribute('download', `${filename}-${new Date().getTime()}.json`)
          link.click()
          URL.revokeObjectURL(url)
        })
        .catch(error => {
          console.log('download save data failed:', error)
        })
        .finally(() => {
          localStorage.setItem('mindgraph-data', json)
          this.hideInput()
        })

      console.group('save graph')
      console.log('json', json)
      console.groupEnd()
    }

    const loadData = json => {
      cy.startBatch()
      uncollapseNodes(this.state.collapsedNodes)

      cy.json(json.cy)

      const collapsedNodes = json.collapsedNodes && json.collapsedNodes.length > 0 ?
        this.nodesFromIds(json.collapsedNodes) :
        cy.collection()
      collapsedNodes.forEach(n => {
        const successors = n.successors('node')
        successors.data('display', 'none')
        collapseNodes(n, successors.length)
      })

      const tags = {}
      for (const tag in json.tags) {
        tags[tag] = this.nodesFromIds(json.tags[tag])
      }

      const viewports = Array(10)
      json.viewports.forEach((viewport, i) => {
        viewports[i] = viewport.nodes ?
          { nodes: this.nodesFromIds(viewport.nodes) } :
          viewport
      })

      cy.endBatch()

      this.setState({
        collapsedNodes,
        viewports,
        tags,
        focusedTag: json.focusedTag,
        presetColors: json.presetColors,
      })

      console.group('load graph')
      console.log('json', json)
      console.groupEnd()
    }

    const loadLocalData = () => {
      const json = JSON.parse(window.localStorage.getItem('mindgraph-data'))
      loadData(json)
    }

    // ----------------------
    // SET UP EVENT LISTENERS
    // ----------------------
    document.body.addEventListener('dragenter', e => { e.preventDefault() })
    document.body.addEventListener('dragover', e => { e.preventDefault() })
    document.body.addEventListener('drop', e => {
      e.stopPropagation()
      e.preventDefault()
      console.log(e.dataTransfer.files)
      const reader = new FileReader()
      const file = e.dataTransfer.files[0]
      reader.onload = (f => e => {
        const json = JSON.parse(e.target.result)
        loadData(json)
      })(file)
      reader.readAsText(file)
    })

    cy.on('select', 'node', e => {
      const selected = cy.$(':selected').toArray()
      this.setState({
        selectedNodes: selected
      })
      const n = selected.length
      if (n === 1) {
        keyboardJS.setContext('singleNode')
        setSiblings(selected[0])
      } else {
        keyboardJS.setContext('multipleNodes')
      }

      if (e.target.data('url')) {
        showPopper(e.target)
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

      hidePopper(e.target)
    })

    cy.on('remove', 'node', e => {
      e.target.unselect()
    })

    // -------------------
    // SET UP KEY BINDINGS
    // -------------------
    const bindViewportKeys = () => {
      keyboardJS.bind('ctrl + 1', setViewport(0))
      keyboardJS.bind('ctrl + 2', setViewport(1))
      keyboardJS.bind('ctrl + 3', setViewport(2))
      keyboardJS.bind('ctrl + 4', setViewport(3))
      keyboardJS.bind('ctrl + 5', setViewport(4))
      keyboardJS.bind('ctrl + 6', setViewport(5))
      keyboardJS.bind('ctrl + 7', setViewport(6))
      keyboardJS.bind('ctrl + 8', setViewport(7))
      keyboardJS.bind('ctrl + 9', setViewport(8))
      keyboardJS.bind('ctrl + 0', setViewport(9))
      keyboardJS.bind('1', selectViewport(0))
      keyboardJS.bind('2', selectViewport(1))
      keyboardJS.bind('3', selectViewport(2))
      keyboardJS.bind('4', selectViewport(3))
      keyboardJS.bind('5', selectViewport(4))
      keyboardJS.bind('6', selectViewport(5))
      keyboardJS.bind('7', selectViewport(6))
      keyboardJS.bind('8', selectViewport(7))
      keyboardJS.bind('9', selectViewport(8))
      keyboardJS.bind('0', selectViewport(9))
    }

    keyboardJS.withContext('root', () => {
      bindViewportKeys()
      keyboardJS.bind('a', null, addNode)
      keyboardJS.bind('s', null, saveData)
      keyboardJS.bind('l', loadLocalData)
      keyboardJS.bind('x', null, e => {
        if (!this.state.runningLayout) {
          cy.layout(layoutOptions).run()
        }
      })
      keyboardJS.bind('q', e => {
        cy.startBatch()
        this.state.collapsedNodes.forEach(n => {
          uncollapseNodes(n)
          n.successors('node').data('display', 'element')
        })
        cy.endBatch()
        this.setState({
          collapsedNodes: cy.collection()
        })
      }, null)
      keyboardJS.bind('t', null, focusTag)
      keyboardJS.bind('shift + t', null, selectTaggedNodes)
    })

    keyboardJS.withContext('singleNode', () => {
      bindViewportKeys()
      keyboardJS.bind('a', null, addChildNode)
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
        this.setState({
          selectedColor: selectedNode.data('color')
        })
        this.inputColor()
          .then(color => {
            selectedNode.data('color', color)
          })
          .catch(error => {
            console.log('set node color error:', error)
          })
          .finally(() => { this.hideColor() })
      }, null)
      keyboardJS.bind('q', e => {
        const selectedNode = this.state.selectedNodes[0]
        const successors = selectedNode.successors('node')
        if (successors.length > 0) {
          cy.startBatch()
          if (selectedNode.data('collapsedChildren')) {
            uncollapseNodes(selectedNode)
            successors.data('display', 'element')
            this.setState({
              collapsedNodes: this.state.collapsedNodes.difference(selectedNode)
            })
          } else {
            const collapsedSuccessors = successors.intersection(this.state.collapsedNodes)
            uncollapseNodes(collapsedSuccessors)
            collapseNodes(selectedNode, successors.length)
            successors.data('display', 'none')
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
      keyboardJS.bind('shift + g', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        this.inputText()
          .then(result => {
            hidePopper(selectedNode)
            selectedNode.data('url', result)
            selectedNode.addClass('link')
            showPopper(selectedNode)
          })
          .catch(error => {
            selectedNode.data('url', null)
            selectedNode.removeClass('link')
            hidePopper(selectedNode)
          })
          .finally(() => this.hideInput())
      })
      keyboardJS.bind('g', null, e => {
        const selectedNode = this.state.selectedNodes[0]
        const selectedUrl = selectedNode.data('url')
        if (selectedUrl) {
          window.open(selectedUrl, '_blank')
        }
      })
      keyboardJS.bind('t', null, getTagAndToggle)
    })

    keyboardJS.withContext('multipleNodes', () => {
      bindViewportKeys()
      keyboardJS.bind('c', e => {
        toggleEdges()
      }, null)
      keyboardJS.bind('shift + c', e => {
        toggleEdges(true)
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
            this.state.selectedNodes.forEach(node => {
              node.data('color', color)
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
      keyboardJS.bind('t', null, getTagAndToggle)
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

      const setColor = i => () => {
        this.setState({
          presetColors: [
            ...this.state.presetColors.slice(0, i),
            this.state.selectedColor,
            ...this.state.presetColors.slice(i + 1)
          ]
        })
      }
      keyboardJS.bind('ctrl + 1', setColor(0))
      keyboardJS.bind('ctrl + 2', setColor(1))
      keyboardJS.bind('ctrl + 3', setColor(2))
      keyboardJS.bind('ctrl + 4', setColor(3))
      keyboardJS.bind('ctrl + 5', setColor(4))
      keyboardJS.bind('ctrl + 6', setColor(5))
      keyboardJS.bind('ctrl + 7', setColor(6))
      keyboardJS.bind('ctrl + 8', setColor(7))
      keyboardJS.bind('ctrl + 9', setColor(8))
      keyboardJS.bind('ctrl + 0', setColor(9))

      const selectPresetColor = i => () => {
        this.setState({ selectedColor: this.state.presetColors[i] })
        this.state.inputSubmitHandler()
      }
      keyboardJS.bind('1', selectPresetColor(0))
      keyboardJS.bind('2', selectPresetColor(1))
      keyboardJS.bind('3', selectPresetColor(2))
      keyboardJS.bind('4', selectPresetColor(3))
      keyboardJS.bind('5', selectPresetColor(4))
      keyboardJS.bind('6', selectPresetColor(5))
      keyboardJS.bind('7', selectPresetColor(6))
      keyboardJS.bind('8', selectPresetColor(7))
      keyboardJS.bind('9', selectPresetColor(8))
      keyboardJS.bind('0', selectPresetColor(9))
    })

    keyboardJS.setContext('root')
    window.c = () => (keyboardJS.getContext())
    window.s = () => (this.state)

    // -----------------
    // SET INITIAL STATE
    // -----------------
    this.setState({
      collapsedNodes: cy.collection()
    })
  }

  render() {
    const selectedTags = this.state.selectedNodes.length === 1 ?
      this.state.selectedNodes[0].data('tags') :
      null

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
        { this.state.showTags &&
          <div className="sidebar">
            <ul>
              {Object.keys(this.state.tags).map(
                (tag, i) => {
                  let classes = []
                  if (this.state.focusedTag && this.state.focusedTag !== tag) classes.push('faded')
                  if (selectedTags && selectedTags.includes(tag)) {
                      classes.push('selected')
                  }
                  return <li
                    className={classes.join(' ')}
                    key={`tag-${i}`}>
                    <span
                      style={{flex: 1}}
                      onClick={() => { this.toggleFocusTag(tag) }}
                    >{tag}</span>
                    <span
                      onClick={() => { this.selectTag(tag) }}
                    >[select]</span>
                  </li>
                }
              )}
            </ul>
          </div>
        }
      </div>
    )
  }
}

export default App