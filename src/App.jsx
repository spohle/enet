import { useRef, useEffect, useState } from 'react'
import './App.css'

function App() {
  const canvasRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])
  const [contextMenu, setContextMenu] = useState(null)
  const [draggingNode, setDraggingNode] = useState(null)
  const [linkingNode, setLinkingNode] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoveredConnection, setHoveredConnection] = useState(null)
  const [editingConnection, setEditingConnection] = useState(null)
  const [editStartAngle, setEditStartAngle] = useState(null)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let updatedNodes = [...nodes]

    for (let iteration = 0; iteration < 20; iteration++) {
      updatedNodes = updatedNodes.map(node => {
        if (node.type === 'float' && getConnectionCount(node.id) > 1) {
          const linkedConnections = connections.filter(conn =>
            conn.sourceId === node.id || conn.targetId === node.id
          )

          let weightedSumX = 0
          let weightedSumY = 0
          let totalWeight = 0

          linkedConnections.forEach(conn => {
            const linkedNodeId = conn.sourceId === node.id ? conn.targetId : conn.sourceId
            const linkedNode = updatedNodes.find(n => n.id === linkedNodeId)

            if (linkedNode) {
              weightedSumX += linkedNode.x * conn.weight
              weightedSumY += linkedNode.y * conn.weight
              totalWeight += conn.weight
            }
          })

          if (totalWeight > 0) {
            return {
              ...node,
              x: weightedSumX / totalWeight,
              y: weightedSumY / totalWeight
            }
          }
        }
        return node
      })
    }

    const hasChanged = updatedNodes.some((node, i) =>
      node.x !== nodes[i].x || node.y !== nodes[i].y
    )

    if (hasChanged) {
      setNodes(updatedNodes)
    }
  }, [nodes, connections])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    connections.forEach(connection => {
      const sourceNode = nodes.find(n => n.id === connection.sourceId)
      const targetNode = nodes.find(n => n.id === connection.targetId)

      if (sourceNode && targetNode) {
        const edgePoints = getEdgePoints(sourceNode, targetNode)
        ctx.beginPath()
        ctx.moveTo(edgePoints.source.x, edgePoints.source.y)
        ctx.lineTo(edgePoints.target.x, edgePoints.target.y)
        ctx.strokeStyle = hoveredConnection?.id === connection.id ? '#ff4444' : '#888'
        ctx.lineWidth = 6
        ctx.stroke()

        if (sourceNode.type === 'float' || targetNode.type === 'float') {
          const centerX = (edgePoints.source.x + edgePoints.target.x) / 2
          const centerY = (edgePoints.source.y + edgePoints.target.y) / 2

          ctx.beginPath()
          ctx.arc(centerX, centerY, 10, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(173, 216, 230, 0.8)'
          ctx.fill()
        }
      }
    })

    if (hoveredConnection) {
      ctx.beginPath()
      ctx.arc(mousePos.x, mousePos.y, 12, 0, Math.PI * 2)
      ctx.fillStyle = '#ff4444'
      ctx.fill()
      ctx.strokeStyle = '#cc0000'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(mousePos.x - 5, mousePos.y - 5)
      ctx.lineTo(mousePos.x + 5, mousePos.y + 5)
      ctx.moveTo(mousePos.x + 5, mousePos.y - 5)
      ctx.lineTo(mousePos.x - 5, mousePos.y + 5)
      ctx.stroke()
    }

    if (linkingNode) {
      const sourceNode = nodes.find(n => n.id === linkingNode)
      if (sourceNode) {
        ctx.beginPath()
        ctx.moveTo(sourceNode.x, sourceNode.y)
        ctx.lineTo(mousePos.x, mousePos.y)
        ctx.strokeStyle = '#aaa'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    if (editingConnection) {
      ctx.beginPath()
      ctx.arc(editingConnection.clickX, editingConnection.clickY, 50, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.7)'
      ctx.lineWidth = 20
      ctx.stroke()

      const currentAngle = Math.atan2(mousePos.y - editingConnection.clickY, mousePos.x - editingConnection.clickX)
      const indicatorX = editingConnection.clickX + Math.cos(currentAngle) * 50
      const indicatorY = editingConnection.clickY + Math.sin(currentAngle) * 50

      ctx.beginPath()
      ctx.moveTo(editingConnection.clickX, editingConnection.clickY)
      ctx.lineTo(indicatorX, indicatorY)
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(255, 140, 0, 1)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(editingConnection.weight.toFixed(2), editingConnection.clickX, editingConnection.clickY - 65)
    }

    nodes.forEach(node => {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 20, 0, Math.PI * 2)
      ctx.fillStyle = node.type === 'fixed' ? '#4a90e2' : '#e67e22'
      ctx.fill()
      ctx.strokeStyle = node.type === 'fixed' ? '#2c5aa0' : '#c0662a'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [nodes, connections, linkingNode, mousePos, editingConnection, editStartAngle])

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const centerDot = getCenterDotAtPosition(mouseX, mouseY)
    if (centerDot) {
      return
    }

    if (editingConnection) {
      setEditingConnection(null)
    }
    setContextMenu(null)
  }

  const createNode = (type) => {
    if (!contextMenu) return

    saveToHistory()

    const newNode = {
      id: Date.now(),
      x: contextMenu.x,
      y: contextMenu.y,
      type: type
    }

    setNodes([...nodes, newNode])
    setContextMenu(null)
  }

  const getNodeAtPosition = (x, y) => {
    return nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2)
      )
      return distance <= 20
    })
  }

  const getConnectionCount = (nodeId) => {
    return connections.filter(conn =>
      conn.sourceId === nodeId || conn.targetId === nodeId
    ).length
  }

  const isNodeDraggable = (node) => {
    if (node.type === 'fixed') return true
    if (node.type === 'float') {
      return getConnectionCount(node.id) <= 1
    }
    return true
  }

  const getEdgePoints = (sourceNode, targetNode) => {
    const radius = 20
    const dx = targetNode.x - sourceNode.x
    const dy = targetNode.y - sourceNode.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance === 0) return { source: sourceNode, target: targetNode }

    const unitX = dx / distance
    const unitY = dy / distance

    return {
      source: {
        x: sourceNode.x + unitX * radius,
        y: sourceNode.y + unitY * radius
      },
      target: {
        x: targetNode.x - unitX * radius,
        y: targetNode.y - unitY * radius
      }
    }
  }

  const getCenterDotAtPosition = (x, y) => {
    for (const connection of connections) {
      const sourceNode = nodes.find(n => n.id === connection.sourceId)
      const targetNode = nodes.find(n => n.id === connection.targetId)

      if (!sourceNode || !targetNode) continue

      if (sourceNode.type === 'float' || targetNode.type === 'float') {
        const edgePoints = getEdgePoints(sourceNode, targetNode)
        const centerX = (edgePoints.source.x + edgePoints.target.x) / 2
        const centerY = (edgePoints.source.y + edgePoints.target.y) / 2
        const distanceToCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        )

        if (distanceToCenter <= 10) {
          return { connection, centerX, centerY }
        }
      }
    }

    return null
  }

  const getConnectionAtPosition = (x, y) => {
    const threshold = 10

    for (const connection of connections) {
      const sourceNode = nodes.find(n => n.id === connection.sourceId)
      const targetNode = nodes.find(n => n.id === connection.targetId)

      if (!sourceNode || !targetNode) continue

      if (sourceNode.type === 'float' || targetNode.type === 'float') {
        const centerX = (sourceNode.x + targetNode.x) / 2
        const centerY = (sourceNode.y + targetNode.y) / 2
        const distanceToCenter = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
        )

        if (distanceToCenter <= 10) {
          continue
        }
      }

      const edgePoints = getEdgePoints(sourceNode, targetNode)
      const startX = edgePoints.source.x
      const startY = edgePoints.source.y
      const endX = edgePoints.target.x
      const endY = edgePoints.target.y

      const lineLength = Math.sqrt(
        Math.pow(endX - startX, 2) +
        Math.pow(endY - startY, 2)
      )

      const dot = ((x - startX) * (endX - startX) +
                   (y - startY) * (endY - startY)) / Math.pow(lineLength, 2)

      if (dot < 0 || dot > 1) continue

      const closestX = startX + dot * (endX - startX)
      const closestY = startY + dot * (endY - startY)

      const distance = Math.sqrt(
        Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2)
      )

      if (distance <= threshold) {
        return connection
      }
    }

    return null
  }

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const centerDot = getCenterDotAtPosition(mouseX, mouseY)

    if (centerDot) {
      const angle = Math.atan2(mouseY - centerDot.centerY, mouseX - centerDot.centerX)
      setEditingConnection({
        ...centerDot.connection,
        centerX: centerDot.centerX,
        centerY: centerDot.centerY,
        clickX: mouseX,
        clickY: mouseY
      })
      setEditStartAngle(angle)
      return
    }

    if (hoveredConnection) {
      saveToHistory()
      setConnections(connections.filter(conn => conn.id !== hoveredConnection.id))
      setHoveredConnection(null)
      return
    }

    const clickedNode = getNodeAtPosition(mouseX, mouseY)

    if (clickedNode && e.ctrlKey) {
      setLinkingNode(clickedNode.id)
      setDraggingNode(null)
    } else if (clickedNode && linkingNode) {
      if (linkingNode !== clickedNode.id) {
        saveToHistory()
        const newConnection = {
          id: Date.now(),
          sourceId: linkingNode,
          targetId: clickedNode.id,
          weight: 1.0
        }
        setConnections([...connections, newConnection])
      }
      setLinkingNode(null)
      setDraggingNode(null)
    } else if (clickedNode) {
      if (isNodeDraggable(clickedNode)) {
        setDraggingNode(clickedNode.id)
      }
      setLinkingNode(null)
    } else {
      setLinkingNode(null)
      setDraggingNode(null)
    }
  }

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setMousePos({ x: mouseX, y: mouseY })

    if (editingConnection && editStartAngle !== null) {
      const currentAngle = Math.atan2(mouseY - editingConnection.centerY, mouseX - editingConnection.centerX)
      let angleDelta = currentAngle - editStartAngle

      if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI
      if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI

      const weightChange = angleDelta / Math.PI
      const newWeight = Math.max(0, editingConnection.weight + weightChange)

      setConnections(connections.map(conn =>
        conn.id === editingConnection.id
          ? { ...conn, weight: newWeight }
          : conn
      ))

      setEditingConnection({
        ...editingConnection,
        weight: newWeight
      })

      setEditStartAngle(currentAngle)
    } else if (draggingNode) {
      setNodes(nodes.map(node =>
        node.id === draggingNode
          ? { ...node, x: mouseX, y: mouseY }
          : node
      ))
      setHoveredConnection(null)
    } else if (!linkingNode) {
      const connection = getConnectionAtPosition(mouseX, mouseY)
      setHoveredConnection(connection)
    }
  }

  const handleMouseUp = () => {
    if (draggingNode) {
      saveToHistory()
    }
    setDraggingNode(null)
    if (editingConnection) {
      saveToHistory()
      setEditingConnection(null)
      setEditStartAngle(null)
    }
  }

  const handleSave = () => {
    const data = {
      nodes,
      connections
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'graph.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result)
            if (data.nodes && data.connections) {
              setNodes(data.nodes)
              setConnections(data.connections)
            }
          } catch (error) {
            console.error('Error loading file:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const saveToHistory = () => {
    const newState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections))
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newState)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      const prevState = history[prevIndex]
      setNodes(prevState.nodes)
      setConnections(prevState.connections)
      setHistoryIndex(prevIndex)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const nextState = history[nextIndex]
      setNodes(nextState.nodes)
      setConnections(nextState.connections)
      setHistoryIndex(nextIndex)
    }
  }

  const handleClear = () => {
    saveToHistory()
    setNodes([])
    setConnections([])
    setContextMenu(null)
    setDraggingNode(null)
    setLinkingNode(null)
    setHoveredConnection(null)
    setEditingConnection(null)
    setEditStartAngle(null)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  return (
    <div className="app-container">
      <div className="toolbar">
        <button className="toolbar-button" onClick={handleUndo} disabled={historyIndex <= 0}>Undo</button>
        <button className="toolbar-button" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>Redo</button>
        <div className="toolbar-separator"></div>
        <button className="toolbar-button" onClick={handleSave}>Save</button>
        <button className="toolbar-button" onClick={handleLoad}>Load</button>
        <button className="toolbar-button" onClick={handleClear}>Clear</button>
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="menu-item" onClick={() => createNode('fixed')}>
            Create Fixed Node
          </div>
          <div className="menu-item" onClick={() => createNode('float')}>
            Create Float Node
          </div>
        </div>
      )}
    </div>
  )
}

export default App
