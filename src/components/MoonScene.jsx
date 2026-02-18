import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'

const MoonScene = ({ onModeChange }) => {
  const mountRef = useRef(null)
  const [isFirstPerson, setIsFirstPerson] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const joystickRef = useRef(null)
  const joystickKnobRef = useRef(null)
  const touchStartRef = useRef(null)
  const touchMoveRef = useRef(null)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768 && 'ontouchstart' in window)
      setIsMobile(isMobileDevice)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!mountRef.current) {
      return () => {}
    }

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 1)
    mountRef.current.appendChild(renderer.domElement)

    // Constants
    const moonRadius = 500
    const moveSpeed = 0.2 // Walking speed on moon surface
    const eyeHeight = 1.7 // Human eye height above surface
    const jumpSpeed = 0.4 // Jump velocity
    const moonGravity = 0.01 // Moon gravity (much lower than Earth)
    const maxJumpHeight = 15 // Maximum jump height

    // Refs for controls
    let controls = null
    let pointerLockControls = null
    let moon = null
    let moonMaterial = null
    let terrainGroup = null
    const moveState = { forward: false, backward: false, left: false, right: false, jump: false }
    const velocity = new THREE.Vector3()
    const jumpState = { verticalVelocity: 0, isGrounded: true } // Jump state object
    const direction = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    
    // Store terrain positions for consistent placement
    const terrainPositions = []

    // Create stars
    const createStars = () => {
      const starsGeometry = new THREE.BufferGeometry()
      const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: false
      })

      const starsVertices = []
      for (let i = 0; i < 5000; i++) {
        const x = (Math.random() - 0.5) * 20000
        const y = (Math.random() - 0.5) * 20000
        const z = (Math.random() - 0.5) * 20000
        starsVertices.push(x, y, z)
      }

      starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3))
      const stars = new THREE.Points(starsGeometry, starsMaterial)
      scene.add(stars)
    }

    // Create dark black gradient background
    const createNebula = () => {
      const nebulaGeometry = new THREE.SphereGeometry(10000, 32, 32)
      const nebulaMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            // Create smooth dark black gradient
            float dist = length(vWorldPosition);
            float normalizedDist = clamp(dist / 10000.0, 0.0, 1.0);
            
            // Dark black colors - very subtle gradient
            vec3 darkBlack = vec3(0.0, 0.0, 0.0);
            vec3 slightlyLighter = vec3(0.01, 0.01, 0.01);
            
            // Smooth gradient from center to edge
            float gradientFactor = smoothstep(0.0, 1.0, normalizedDist);
            vec3 color = mix(darkBlack, slightlyLighter, gradientFactor);
            
            gl_FragColor = vec4(color, 1.0);
          }
        `
      })
      const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial)
      scene.add(nebula)
    }

    // Create realistic moon texture with enhanced details
    const createMoonTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 2048
      canvas.height = 2048
      const ctx = canvas.getContext('2d')

      // Base moon color with subtle variation
      const baseGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      baseGradient.addColorStop(0, '#9a9a9a')
      baseGradient.addColorStop(0.5, '#8a8a8a')
      baseGradient.addColorStop(1, '#7a7a7a')
      ctx.fillStyle = baseGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add large craters (mare regions) - darker areas
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 80 + 40
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        const darkness = Math.random() * 0.3 + 0.2
        gradient.addColorStop(0, `rgba(70, 70, 70, ${darkness})`)
        gradient.addColorStop(0.3, `rgba(90, 90, 90, ${darkness * 0.7})`)
        gradient.addColorStop(0.6, `rgba(110, 110, 110, ${darkness * 0.4})`)
        gradient.addColorStop(1, 'rgba(138, 138, 138, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add medium craters
      for (let i = 0; i < 250; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 35 + 8
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        gradient.addColorStop(0, `rgba(85, 85, 85, ${Math.random() * 0.5 + 0.3})`)
        gradient.addColorStop(0.4, `rgba(105, 105, 105, ${Math.random() * 0.3})`)
        gradient.addColorStop(1, 'rgba(138, 138, 138, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add small craters
      for (let i = 0; i < 600; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 12 + 2
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        gradient.addColorStop(0, `rgba(90, 90, 90, ${Math.random() * 0.4 + 0.2})`)
        gradient.addColorStop(1, 'rgba(138, 138, 138, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add surface texture noise for realism
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise))
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise))
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise))
      }
      ctx.putImageData(imageData, 0, 0)

      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      return texture
    }

    // Create normal map for surface detail
    const createNormalMap = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 2048
      canvas.height = 2048
      const ctx = canvas.getContext('2d')

      // Base normal map color (neutral)
      ctx.fillStyle = '#8080ff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add normal map details for craters
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 80 + 40
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        gradient.addColorStop(0, `rgba(100, 100, 255, ${Math.random() * 0.4 + 0.3})`)
        gradient.addColorStop(0.5, `rgba(120, 120, 255, ${Math.random() * 0.2})`)
        gradient.addColorStop(1, 'rgba(128, 128, 255, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      for (let i = 0; i < 250; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 35 + 8
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        gradient.addColorStop(0, `rgba(100, 100, 255, ${Math.random() * 0.3 + 0.2})`)
        gradient.addColorStop(1, 'rgba(128, 128, 255, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      return texture
    }

    // Create roughness map
    const createRoughnessMap = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 1024
      const ctx = canvas.getContext('2d')

      // Base roughness (medium)
      ctx.fillStyle = '#c0c0c0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add variation for craters (rougher)
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const radius = Math.random() * 40 + 10
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        
        gradient.addColorStop(0, `rgba(180, 180, 180, ${Math.random() * 0.3 + 0.2})`)
        gradient.addColorStop(1, 'rgba(192, 192, 192, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      return texture
    }

    // Add noise/displacement to geometry for organic look
    const addNoiseToGeometry = (geometry, intensity = 0.3) => {
      const positions = geometry.attributes.position
      const vertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        
        // Add Perlin-like noise for organic variation
        const noiseX = (Math.sin(x * 0.5) * Math.cos(y * 0.3) * Math.sin(z * 0.4)) * intensity
        const noiseY = (Math.cos(x * 0.4) * Math.sin(y * 0.5) * Math.cos(z * 0.3)) * intensity
        const noiseZ = (Math.sin(x * 0.3) * Math.cos(y * 0.4) * Math.sin(z * 0.5)) * intensity
        
        vertices.push(x + noiseX, y + noiseY, z + noiseZ)
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      return geometry
    }

    // Create organic crater shape
    const createOrganicCrater = (radius, depth, segments = 32) => {
      const geometry = new THREE.ConeGeometry(radius, depth, segments, 1, true)
      
      // Add noise for organic shape
      addNoiseToGeometry(geometry, radius * 0.15)
      
      // Modify vertices to create irregular crater rim
      const positions = geometry.attributes.position
      const vertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const vertex = new THREE.Vector3(x, y, z)
        
        // Add rim variations
        const distanceFromCenter = Math.sqrt(x * x + z * z)
        if (distanceFromCenter > radius * 0.7) {
          const rimVariation = (Math.sin(distanceFromCenter * 0.5) * 0.3 + 1) * 0.5
          vertex.y += rimVariation * 0.5
        }
        
        // Add inner crater wall variations
        if (distanceFromCenter < radius * 0.5) {
          const wallVariation = Math.sin(distanceFromCenter * 2) * 0.2
          vertex.y += wallVariation
        }
        
        vertices.push(vertex.x, vertex.y, vertex.z)
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      return geometry
    }

    // Create organic mountain shape
    const createOrganicMountain = (radius, height, segments = 24) => {
      const geometry = new THREE.ConeGeometry(radius, height, segments)
      
      // Add noise for organic shape
      addNoiseToGeometry(geometry, radius * 0.2)
      
      // Modify vertices for natural mountain shape
      const positions = geometry.attributes.position
      const vertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const vertex = new THREE.Vector3(x, y, z)
        
        // Add ridges and variations
        const distanceFromCenter = Math.sqrt(x * x + z * z)
        const angle = Math.atan2(z, x)
        
        // Add ridge variations
        const ridgeVariation = Math.sin(angle * 3) * 0.3
        vertex.y += ridgeVariation * (1 - distanceFromCenter / radius)
        
        // Add surface roughness
        const roughness = (Math.sin(x * 2) * Math.cos(z * 2)) * 0.2
        vertex.y += roughness
        
        vertices.push(vertex.x, vertex.y, vertex.z)
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      return geometry
    }

    // Create organic hill shape
    const createOrganicHill = (radius, height, segments = 20) => {
      const geometry = new THREE.ConeGeometry(radius, height, segments)
      
      // Add noise for organic shape
      addNoiseToGeometry(geometry, radius * 0.15)
      
      // Modify for gentle, rolling hills
      const positions = geometry.attributes.position
      const vertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const vertex = new THREE.Vector3(x, y, z)
        
        // Add gentle rolling variations
        const distanceFromCenter = Math.sqrt(x * x + z * z)
        const rollVariation = Math.sin(distanceFromCenter * 0.8) * 0.15
        vertex.y += rollVariation
        
        vertices.push(vertex.x, vertex.y, vertex.z)
      }
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      return geometry
    }

    // Create 3D terrain features (craters, mountains, hills) with moon texture
    const createTerrainFeatures = () => {
      terrainGroup = new THREE.Group()
      
      // Use moon material for all terrain features to match texture
      const getTerrainMaterial = () => {
        if (moonMaterial) {
          // Clone moon material to share textures
          const material = moonMaterial.clone()
          // Ensure textures are shared (not cloned)
          if (moonMaterial.map) material.map = moonMaterial.map
          if (moonMaterial.normalMap) material.normalMap = moonMaterial.normalMap
          if (moonMaterial.roughnessMap) material.roughnessMap = moonMaterial.roughnessMap
          return material
        }
        // Fallback material
        return new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.95,
          metalness: 0.05
        })
      }
      
      // Create organic craters (bowl-shaped depressions with natural variations)
      for (let i = 0; i < 20; i++) {
        const craterRadius = Math.random() * 12 + 5
        const craterDepth = Math.random() * 6 + 3
        
        // Create organic crater geometry
        const craterGeometry = createOrganicCrater(craterRadius, craterDepth, 32)
        const craterMaterial = getTerrainMaterial()
        
        const crater = new THREE.Mesh(craterGeometry, craterMaterial)
        
        // Position on moon surface
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const x = Math.sin(phi) * Math.cos(theta) * moonRadius
        const y = Math.cos(phi) * moonRadius
        const z = Math.sin(phi) * Math.sin(theta) * moonRadius
        
        crater.position.set(x, y, z)
        crater.lookAt(0, 0, 0)
        crater.rotateX(Math.PI)
        crater.scale.set(1, 1, 0.3) // Flatten to create bowl shape
        
        // Add slight rotation for more natural look
        crater.rotation.z = Math.random() * Math.PI * 2
        
        terrainGroup.add(crater)
        terrainPositions.push({ type: 'crater', position: new THREE.Vector3(x, y, z), radius: craterRadius })
      }
      
      // Create organic mountains (natural elevations with ridges)
      for (let i = 0; i < 15; i++) {
        const mountainHeight = Math.random() * 15 + 8
        const mountainRadius = Math.random() * 10 + 6
        
        // Create organic mountain geometry
        const mountainGeometry = createOrganicMountain(mountainRadius, mountainHeight, 24)
        const mountainMaterial = getTerrainMaterial()
        
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial)
        
        // Position on moon surface
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const x = Math.sin(phi) * Math.cos(theta) * moonRadius
        const y = Math.cos(phi) * moonRadius
        const z = Math.sin(phi) * Math.sin(theta) * moonRadius
        
        mountain.position.set(x, y, z)
        
        // Orient mountain to point away from moon center
        const direction = new THREE.Vector3(0, 0, 0).sub(mountain.position).normalize()
        mountain.lookAt(mountain.position.clone().add(direction))
        
        // Add slight rotation for natural variation
        mountain.rotateZ(Math.random() * Math.PI * 2)
        
        terrainGroup.add(mountain)
        terrainPositions.push({ type: 'mountain', position: new THREE.Vector3(x, y, z), height: mountainHeight })
      }
      
      // Create organic hills (gentle, rolling elevations)
      for (let i = 0; i < 25; i++) {
        const hillHeight = Math.random() * 8 + 4
        const hillRadius = Math.random() * 8 + 5
        
        // Create organic hill geometry
        const hillGeometry = createOrganicHill(hillRadius, hillHeight, 20)
        const hillMaterial = getTerrainMaterial()
        
        const hill = new THREE.Mesh(hillGeometry, hillMaterial)
        
        // Position on moon surface
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const x = Math.sin(phi) * Math.cos(theta) * moonRadius
        const y = Math.cos(phi) * moonRadius
        const z = Math.sin(phi) * Math.sin(theta) * moonRadius
        
        hill.position.set(x, y, z)
        
        // Orient hill to point away from moon center
        const direction = new THREE.Vector3(0, 0, 0).sub(hill.position).normalize()
        hill.lookAt(hill.position.clone().add(direction))
        
        // Add slight rotation for natural variation
        hill.rotateZ(Math.random() * Math.PI * 2)
        
        terrainGroup.add(hill)
        terrainPositions.push({ type: 'hill', position: new THREE.Vector3(x, y, z), height: hillHeight })
      }
      
      scene.add(terrainGroup)
      // Initially hide terrain (only show in first-person mode)
      terrainGroup.visible = false
      return terrainGroup
    }

    // Create moon with realistic textures
    const createMoon = () => {
      const moonGeometry = new THREE.SphereGeometry(moonRadius, 64, 64)
      
      // Try to load real moon texture, fallback to procedural
      const textureLoader = new THREE.TextureLoader()
      
      // Real moon texture URLs (NASA/public domain sources)
      const moonTextureUrls = [
        'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg',
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/17271/lroc_color_poles_1k.jpg',
        'https://threejs.org/examples/textures/planets/moon_1024.jpg'
      ]
      
      moonMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        roughness: 0.95,
        metalness: 0.05,
        bumpScale: 0.5
      })

      // Create procedural textures as fallback
      const proceduralTexture = createMoonTexture()
      const normalMap = createNormalMap()
      const roughnessMap = createRoughnessMap()
      
      // Set procedural textures initially
      moonMaterial.map = proceduralTexture
      moonMaterial.normalMap = normalMap
      moonMaterial.roughnessMap = roughnessMap

      // Try to load real moon texture
      let textureLoaded = false
      const tryLoadTexture = (urlIndex = 0) => {
        if (urlIndex >= moonTextureUrls.length || textureLoaded) {
          return
        }

        textureLoader.load(
          moonTextureUrls[urlIndex],
          (texture) => {
            // Successfully loaded real moon texture
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
            moonMaterial.map = texture
            // Keep normal and roughness maps for enhanced detail
            moonMaterial.normalMap = normalMap
            moonMaterial.roughnessMap = roughnessMap
            moonMaterial.needsUpdate = true
            textureLoaded = true
            console.log('Real moon texture loaded successfully')
          },
          undefined,
          () => {
            // Failed to load, try next URL
            console.log(`Failed to load texture from ${moonTextureUrls[urlIndex]}, trying next...`)
            tryLoadTexture(urlIndex + 1)
          }
        )
      }

      // Start loading real texture
      tryLoadTexture()

      moon = new THREE.Mesh(moonGeometry, moonMaterial)
      scene.add(moon)
      
      // Create holes/craters in moon geometry using displacement
      const createMoonHoles = () => {
        // Modify moon geometry to add actual holes/craters
        const positions = moonGeometry.attributes.position
        const vertices = []
        const craterLocations = []
        
        // Generate crater locations matching texture pattern
        for (let j = 0; j < 20; j++) {
          const theta = Math.random() * Math.PI * 2
          const phi = Math.random() * Math.PI
          const craterX = Math.sin(phi) * Math.cos(theta) * moonRadius
          const craterY = Math.cos(phi) * moonRadius
          const craterZ = Math.sin(phi) * Math.sin(theta) * moonRadius
          craterLocations.push({
            pos: new THREE.Vector3(craterX, craterY, craterZ),
            radius: Math.random() * 20 + 15, // Large craters
            depth: Math.random() * 6 + 4
          })
        }
        
        for (let j = 0; j < 40; j++) {
          const theta = Math.random() * Math.PI * 2
          const phi = Math.random() * Math.PI
          const craterX = Math.sin(phi) * Math.cos(theta) * moonRadius
          const craterY = Math.cos(phi) * moonRadius
          const craterZ = Math.sin(phi) * Math.sin(theta) * moonRadius
          craterLocations.push({
            pos: new THREE.Vector3(craterX, craterY, craterZ),
            radius: Math.random() * 10 + 6, // Medium craters
            depth: Math.random() * 3 + 2
          })
        }
        
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i)
          const y = positions.getY(i)
          const z = positions.getZ(i)
          const vertex = new THREE.Vector3(x, y, z)
          
          // Apply all craters
          for (const crater of craterLocations) {
            const distance = vertex.distanceTo(crater.pos)
            
            if (distance < crater.radius) {
              // Create smooth, organic depression with variations
              const factor = 1 - (distance / crater.radius)
              let depth = factor * factor * crater.depth // Smooth falloff
              
              // Add organic variations to crater shape
              const angle = Math.atan2(vertex.z - crater.pos.z, vertex.x - crater.pos.x)
              const organicVariation = Math.sin(angle * 4) * 0.3 + Math.cos(angle * 6) * 0.2
              depth *= (1 + organicVariation * factor)
              
              // Add rim elevation
              if (factor > 0.7 && factor < 0.95) {
                depth -= Math.sin((factor - 0.7) * Math.PI / 0.25) * 0.5 // Rim elevation
              }
              
              const direction = vertex.clone().normalize()
              vertex.sub(direction.multiplyScalar(depth))
            }
          }
          
          vertices.push(vertex.x, vertex.y, vertex.z)
        }
        
        // Add subtle surface noise for organic look
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i]
          const y = vertices[i + 1]
          const z = vertices[i + 2]
          const vertex = new THREE.Vector3(x, y, z)
          const originalDistance = vertex.length()
          
          // Add subtle surface variation (not too much to maintain sphere shape)
          const noise = (Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin(z * 0.1)) * 0.3
          const direction = vertex.clone().normalize()
          const offset = direction.multiplyScalar(noise)
          vertex.add(offset)
          
          // Normalize back to maintain sphere radius approximately
          const newDistance = vertex.length()
          if (newDistance > 0) {
            vertex.normalize().multiplyScalar(originalDistance)
          }
          
          vertices[i] = vertex.x
          vertices[i + 1] = vertex.y
          vertices[i + 2] = vertex.z
        }
        
        moonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        moonGeometry.computeVertexNormals()
        moonGeometry.computeBoundingSphere()
      }
      
      // Apply holes to moon geometry
      createMoonHoles()
      
      return moon
    }

    // Setup lighting
    const setupLighting = () => {
      // Main directional light
      const sunLight = new THREE.DirectionalLight(0xffffff, 2.0)
      sunLight.position.set(500, 500, 500)
      scene.add(sunLight)

      // Ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      // Additional light
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.8)
      rimLight.position.set(-500, 300, -500)
      scene.add(rimLight)
    }

    // Setup orbit controls
    const setupOrbitControls = () => {
      if (pointerLockControls) {
        pointerLockControls.disconnect()
        pointerLockControls = null
      }

      if (controls) {
        controls.dispose()
      }

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 600
      controls.maxDistance = 5000
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5

      camera.position.set(0, 200, 800)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()

      // Add click handler to detect moon clicks
      const handleClick = (event) => {
        // Only handle clicks in orbit mode
        if (isFirstPerson) return

        const mouse = new THREE.Vector2()
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        const clickRaycaster = new THREE.Raycaster()
        clickRaycaster.setFromCamera(mouse, camera)

        // Check if moon was clicked
        if (moon) {
          const intersects = clickRaycaster.intersectObject(moon)
          if (intersects.length > 0) {
            // Moon was clicked, toggle to first person
            if (window.toggleFirstPersonMode) {
              window.toggleFirstPersonMode()
            }
          }
        }
      }

      renderer.domElement.addEventListener('click', handleClick)
      
      return () => {
        renderer.domElement.removeEventListener('click', handleClick)
      }
    }

    // Setup first-person controls
    const setupFirstPersonControls = () => {
      if (controls) {
        controls.dispose()
        controls = null
      }

      // Position camera on moon surface (at north pole initially)
      camera.position.set(0, moonRadius + eyeHeight, 0)
      
      // Look forward along the surface (toward positive Z)
      const forwardDirection = new THREE.Vector3(0, 0, 1)
      const lookAtPos = camera.position.clone().add(forwardDirection.multiplyScalar(10))
      camera.lookAt(lookAtPos)
      camera.updateProjectionMatrix()
      
      // Reset velocity and jump state
      velocity.set(0, 0, 0)
      jumpState.verticalVelocity = 0
      jumpState.isGrounded = true

      // Reset movement state
      moveState.forward = false
      moveState.backward = false
      moveState.left = false
      moveState.right = false
      moveState.jump = false

      // Initialize mobile state
      if (isMobile) {
        window.mobileMoveState = {
          forward: false,
          backward: false,
          left: false,
          right: false
        }
        window.mobileJumpState = {
          jumping: false,
          verticalVelocity: 0,
          isGrounded: true
        }
      }

      const cleanupFunctions = []

      // Mobile touch controls
      if (isMobile) {
        // Touch-based camera rotation
        let touchRotation = { x: 0, y: 0 }
        let lastTouch = { x: 0, y: 0 }
        const rotationSpeed = 0.002

        const onTouchStart = (e) => {
          if (e.touches.length === 1) {
            lastTouch.x = e.touches[0].clientX
            lastTouch.y = e.touches[0].clientY
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }
        }

        const onTouchMove = (e) => {
          e.preventDefault()
          if (e.touches.length === 1 && touchStartRef.current) {
            const deltaX = e.touches[0].clientX - lastTouch.x
            const deltaY = e.touches[0].clientY - lastTouch.y
            
            touchRotation.y -= deltaX * rotationSpeed
            touchRotation.x -= deltaY * rotationSpeed
            
            // Limit vertical rotation
            touchRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, touchRotation.x))
            
            lastTouch.x = e.touches[0].clientX
            lastTouch.y = e.touches[0].clientY
            touchMoveRef.current = { x: deltaX, y: deltaY }
          }
        }

        const onTouchEnd = () => {
          touchStartRef.current = null
          touchMoveRef.current = null
        }

        renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false })
        renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false })
        renderer.domElement.addEventListener('touchend', onTouchEnd)
        renderer.domElement.addEventListener('touchcancel', onTouchEnd)

        cleanupFunctions.push(() => {
          renderer.domElement.removeEventListener('touchstart', onTouchStart)
          renderer.domElement.removeEventListener('touchmove', onTouchMove)
          renderer.domElement.removeEventListener('touchend', onTouchEnd)
          renderer.domElement.removeEventListener('touchcancel', onTouchEnd)
        })

        // Store touch rotation for use in animation loop
        window.mobileTouchRotation = touchRotation
        window.mobileTouchRotationRef = { current: touchRotation }
      } else {
        // Desktop pointer lock controls
        pointerLockControls = new PointerLockControls(camera, renderer.domElement)

        const handleClick = () => {
          if (!pointerLockControls.isLocked) {
            renderer.domElement.requestPointerLock()
          }
        }

        renderer.domElement.addEventListener('click', handleClick)
        cleanupFunctions.push(() => {
          renderer.domElement.removeEventListener('click', handleClick)
        })
      }

      // Click handler to detect sky clicks (return to orbit mode)
      const handleSkyClick = (event) => {
        // Only handle clicks in first-person mode
        if (!isFirstPerson) return

        const mouse = new THREE.Vector2()
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        const skyClickRaycaster = new THREE.Raycaster()
        skyClickRaycaster.setFromCamera(mouse, camera)

        // Check all objects in scene (moon, terrain, etc.)
        const allObjects = []
        if (moon) {
          allObjects.push(moon)
        }
        if (terrainGroup && terrainGroup.visible) {
          terrainGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              allObjects.push(child)
            }
          })
        }

        // If nothing was hit, clicked on sky - return to orbit mode
        const intersects = skyClickRaycaster.intersectObjects(allObjects, true)
        if (intersects.length === 0) {
          // Sky was clicked, toggle back to orbit mode
          if (window.toggleFirstPersonMode) {
            window.toggleFirstPersonMode()
          }
        }
      }

      renderer.domElement.addEventListener('click', handleSkyClick)
      cleanupFunctions.push(() => {
        renderer.domElement.removeEventListener('click', handleSkyClick)
      })

      // Keyboard controls (desktop only)
      if (!isMobile) {
        const onKeyDown = (event) => {
          switch (event.code) {
            case 'KeyW': moveState.forward = true; break
            case 'KeyS': moveState.backward = true; break
            case 'KeyA': moveState.left = true; break
            case 'KeyD': moveState.right = true; break
            case 'Space': 
              if (jumpState.isGrounded && !moveState.jump) {
                moveState.jump = true
                jumpState.verticalVelocity = jumpSpeed
                jumpState.isGrounded = false
              }
              break
          }
        }

        const onKeyUp = (event) => {
          switch (event.code) {
            case 'KeyW': moveState.forward = false; break
            case 'KeyS': moveState.backward = false; break
            case 'KeyA': moveState.left = false; break
            case 'KeyD': moveState.right = false; break
            case 'Space': moveState.jump = false; break
          }
        }

        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)

        cleanupFunctions.push(() => {
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('keyup', onKeyUp)
        })
      }

      return () => {
        cleanupFunctions.forEach(fn => fn())
      }
    }

    // Initialize scene
    createNebula()
    createStars()
    createMoon() // This sets moonMaterial
    // Create terrain after moon so it can use moon material
    createTerrainFeatures()
    setupLighting()
    let initialOrbitCleanup = setupOrbitControls()
    if (initialOrbitCleanup) {
      window.orbitCleanup = initialOrbitCleanup
    }

    let firstPersonCleanup = null

    // Animation loop
    let animationFrameId
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      if (isFirstPerson) {
        // First-person mode
        if (controls) {
          controls.enabled = false
        }

        // Handle mobile touch rotation
        if (isMobile && window.mobileTouchRotationRef) {
          const rotation = window.mobileTouchRotationRef.current
          const euler = new THREE.Euler(rotation.x, rotation.y, 0, 'YXZ')
          camera.quaternion.setFromEuler(euler)
        }

        // Always update first-person movement
        const isLocked = pointerLockControls ? pointerLockControls.isLocked : true // Mobile is always "locked"
        
        // Use mobile state if on mobile, otherwise use keyboard state
        const activeMoveState = isMobile && window.mobileMoveState ? window.mobileMoveState : moveState
        
        if (isLocked || isMobile) {
          // Apply movement damping
          velocity.x -= velocity.x * 0.1
          velocity.z -= velocity.z * 0.1

          // Calculate movement direction
          direction.z = Number(activeMoveState.forward) - Number(activeMoveState.backward)
          direction.x = Number(activeMoveState.right) - Number(activeMoveState.left)
          direction.normalize()

          // Apply movement with smooth acceleration
          const acceleration = moveSpeed * 0.1
          if (activeMoveState.forward || activeMoveState.backward) {
            velocity.z -= direction.z * acceleration
          }
          if (activeMoveState.left || activeMoveState.right) {
            velocity.x -= direction.x * acceleration
          }

          // Clamp velocity for realistic movement
          const maxSpeed = moveSpeed
          velocity.x = Math.max(-maxSpeed, Math.min(maxSpeed, velocity.x))
          velocity.z = Math.max(-maxSpeed, Math.min(maxSpeed, velocity.z))

          // Move camera relative to current orientation
          if (isMobile) {
            // Mobile: move relative to camera's current rotation
            const moveVector = new THREE.Vector3()
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
            
            moveVector.add(forward.multiplyScalar(-velocity.z))
            moveVector.add(right.multiplyScalar(-velocity.x))
            camera.position.add(moveVector)
          } else if (pointerLockControls) {
            pointerLockControls.moveRight(-velocity.x)
            pointerLockControls.moveForward(-velocity.z)
          }
        }

          // Apply gravity and jumping
          const activeJumpState = isMobile && window.mobileJumpState ? window.mobileJumpState : jumpState
          
          if (!activeJumpState.isGrounded) {
            // Apply moon gravity
            activeJumpState.verticalVelocity -= moonGravity
            
            // Move camera vertically
            const currentPos = camera.position.clone()
            const surfaceNormal = currentPos.clone().normalize()
            const verticalOffset = surfaceNormal.multiplyScalar(activeJumpState.verticalVelocity)
            camera.position.add(verticalOffset)
          }
          
          // Keep camera on moon surface using raycasting for terrain
          const currentPos = camera.position.clone()
          const surfaceNormal = currentPos.clone().normalize()
          
          // Use raycasting to find actual terrain height
          const rayOrigin = currentPos.clone().add(surfaceNormal.clone().multiplyScalar(100))
          const rayDirection = surfaceNormal.clone().negate()
          raycaster.set(rayOrigin, rayDirection)
          
          // Check intersection with moon and terrain objects
          const terrainObjects = []
          if (moon) {
            terrainObjects.push(moon)
          }
          if (terrainGroup) {
            terrainObjects.push(...terrainGroup.children)
          }
          
          const intersects = raycaster.intersectObjects(terrainObjects, true)
          
          if (intersects.length > 0) {
            const hitPoint = intersects[0].point
            let hitNormal
            
            if (intersects[0].face) {
              hitNormal = intersects[0].face.normal.clone()
              hitNormal.transformDirection(intersects[0].object.matrixWorld)
            } else {
              hitNormal = surfaceNormal
            }
            
            // Calculate distance from camera to terrain
            const distanceToTerrain = currentPos.distanceTo(hitPoint)
            const targetHeight = eyeHeight
            
            // Check if grounded (close to surface)
            if (distanceToTerrain <= targetHeight + 0.5 && activeJumpState.verticalVelocity <= 0) {
              // Land on surface
              activeJumpState.isGrounded = true
              activeJumpState.verticalVelocity = 0
              if (isMobile && window.mobileJumpState) {
                window.mobileJumpState.jumping = false
              } else {
                moveState.jump = false
              }
              const targetPos = hitPoint.clone().add(hitNormal.multiplyScalar(targetHeight))
              camera.position.lerp(targetPos, 0.5)
            } else if (!activeJumpState.isGrounded) {
              // In air, don't force to surface
              // Just apply vertical velocity
            } else {
              // On ground, follow terrain
              const targetPos = hitPoint.clone().add(hitNormal.multiplyScalar(targetHeight))
              camera.position.lerp(targetPos, 0.4)
            }
          } else {
            // Fallback to sphere surface
            if (activeJumpState.isGrounded) {
              const targetDistance = moonRadius + eyeHeight
              const targetPos = surfaceNormal.multiplyScalar(targetDistance)
              camera.position.lerp(targetPos, 0.4)
            }
          }
          
          // Prevent going too high
          const distanceFromCenter = camera.position.length()
          if (distanceFromCenter > moonRadius + maxJumpHeight) {
            activeJumpState.verticalVelocity = 0
          }
      } else {
        // Orbit mode
        if (controls) {
          controls.enabled = true
          controls.update()
        }

        if (moon) {
          moon.rotation.y += 0.001
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // Handle mode switching when isFirstPerson changes
    if (isFirstPerson) {
      // Switch to first-person mode
      if (firstPersonCleanup) {
        firstPersonCleanup()
        firstPersonCleanup = null
      }
      // Clean up orbit controls click handler
      if (window.orbitCleanup) {
        window.orbitCleanup()
        window.orbitCleanup = null
      }
      firstPersonCleanup = setupFirstPersonControls()
      // Show terrain in first-person mode
      if (terrainGroup) {
        terrainGroup.visible = true
      }
    } else {
      // Switch to orbit mode
      if (firstPersonCleanup) {
        firstPersonCleanup()
        firstPersonCleanup = null
      }
      if (pointerLockControls) {
        pointerLockControls.disconnect()
        pointerLockControls = null
      }
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock()
      }
      // Clean up previous orbit controls click handler if exists
      if (window.orbitCleanup) {
        window.orbitCleanup()
      }
      const orbitCleanup = setupOrbitControls()
      if (orbitCleanup) {
        window.orbitCleanup = orbitCleanup
      }
      // Hide terrain in orbit mode
      if (terrainGroup) {
        terrainGroup.visible = false
      }
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)

      if (firstPersonCleanup) {
        firstPersonCleanup()
      }

      if (controls) {
        controls.dispose()
      }
      if (pointerLockControls) {
        pointerLockControls.disconnect()
      }

      if (window.orbitCleanup) {
        window.orbitCleanup()
        delete window.orbitCleanup
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
          if (object.geometry) {
            object.geometry.dispose()
          }
          if (object.material instanceof THREE.Material) {
            object.material.dispose()
          }
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose())
          }
        }
      })

      renderer.dispose()
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  }, [isFirstPerson, isMobile])

  const toggleMode = () => {
    setIsFirstPerson(!isFirstPerson)
    if (onModeChange) {
      onModeChange(!isFirstPerson)
    }
  }

  // Expose toggleMode to window for use in click handler
  useEffect(() => {
    window.toggleFirstPersonMode = toggleMode
    return () => {
      delete window.toggleFirstPersonMode
    }
  }, [isFirstPerson])

  // Virtual joystick for mobile
  const joystickPosition = useRef({ x: 0, y: 0 })
  const isJoystickActive = useRef(false)

  const handleJoystickStart = (e) => {
    if (!isMobile || !isFirstPerson) return
    e.preventDefault()
    const touch = e.touches ? e.touches[0] : e
    const rect = joystickRef.current?.getBoundingClientRect()
    if (rect) {
      isJoystickActive.current = true
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      joystickPosition.current = { x: touch.clientX - centerX, y: touch.clientY - centerY }
      updateJoystickPosition(touch.clientX - centerX, touch.clientY - centerY)
    }
  }

  const handleJoystickMove = (e) => {
    if (!isMobile || !isFirstPerson || !isJoystickActive.current) return
    e.preventDefault()
    const touch = e.touches ? e.touches[0] : e
    const rect = joystickRef.current?.getBoundingClientRect()
    if (rect) {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const x = touch.clientX - centerX
      const y = touch.clientY - centerY
      updateJoystickPosition(x, y)
    }
  }

  const handleJoystickEnd = () => {
    if (!isMobile || !isFirstPerson) return
    isJoystickActive.current = false
    joystickPosition.current = { x: 0, y: 0 }
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(0, 0)'
    }
    // Reset movement state
    if (window.mobileMoveState) {
      window.mobileMoveState.forward = false
      window.mobileMoveState.backward = false
      window.mobileMoveState.left = false
      window.mobileMoveState.right = false
    }
  }

  const updateJoystickPosition = (x, y) => {
    const maxDistance = 50
    const distance = Math.sqrt(x * x + y * y)
    const angle = Math.atan2(y, x)
    
    if (distance > maxDistance) {
      x = Math.cos(angle) * maxDistance
      y = Math.sin(angle) * maxDistance
    }
    
    joystickPosition.current = { x, y }
    
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate(${x}px, ${y}px)`
    }

    // Update movement state based on joystick position
    if (window.mobileMoveState) {
      const threshold = 10
      window.mobileMoveState.forward = y < -threshold
      window.mobileMoveState.backward = y > threshold
      window.mobileMoveState.left = x < -threshold
      window.mobileMoveState.right = x > threshold
    }
  }

  const handleJump = () => {
    if (!isMobile || !isFirstPerson) return
    if (window.mobileJumpState && window.mobileJumpState.isGrounded && !window.mobileJumpState.jumping) {
      window.mobileJumpState.jumping = true
      window.mobileJumpState.verticalVelocity = 0.4 // jumpSpeed
      window.mobileJumpState.isGrounded = false
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Back to Orbit Button (only in first-person mode) */}
      {isFirstPerson && (
        <button
          onClick={toggleMode}
          style={{
            position: 'absolute',
            top: isMobile ? '10px' : '20px',
            right: isMobile ? '10px' : '20px',
            zIndex: 1000,
            padding: isMobile ? '10px 16px' : '12px 24px',
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }
          }}
        >
          🌍 Orbit View
        </button>
      )}

      {/* Mobile Virtual Joystick */}
      {isMobile && isFirstPerson && (
        <>
          <div
            ref={joystickRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            style={{
              position: 'absolute',
              bottom: '30px',
              left: '30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            <div
              ref={joystickKnobRef}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                transition: 'transform 0.1s ease-out',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Jump Button */}
          <button
            data-jump-button
            onTouchStart={handleJump}
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
              zIndex: 1000,
              cursor: 'pointer',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ⬆️
          </button>
        </>
      )}
    </div>
  )
}

export default MoonScene
