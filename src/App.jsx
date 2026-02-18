import React, { useState } from 'react'
import MoonScene from './components/MoonScene'
import './App.css'

function App() {
  const [isFirstPerson, setIsFirstPerson] = useState(false)

  const handleModeChange = (mode) => {
    setIsFirstPerson(mode)
  }

  return (
    <div className="app">
      <MoonScene onModeChange={handleModeChange} />
      <div className="info">
        <h1>🌙 3D Moon</h1>
        {isFirstPerson ? (
          <>
            <p><strong>First Person Mode</strong></p>
            <p>WASD - Move</p>
            <p>Space - Jump</p>
            <p>Mouse - Look around</p>
            <p>Click to lock cursor</p>
          </>
        ) : (
          <>
            <p><strong>Orbit View</strong></p>
            <p>Click and drag to rotate</p>
            <p>Scroll to zoom</p>
          </>
        )}
      </div>
    </div>
  )
}

export default App

