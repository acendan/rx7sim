/**
 * @fileoverview Utility functions for 3D objects, audio, UI, and resource management
 * @module systems/helpers
 */

import * as THREE from 'three'
import { ConeEmitterSettings } from './constants.js'
// Note: colorToHex is defined below; forward usage inside file is fine.

/**
 * Checks if WebGL is available and supported by the browser
 * Tests for WebGL context and required extensions
 * @returns {{available: boolean, error: string|null}} Support status and error message if unavailable
 */
export function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        
        if (!gl) {
            return { 
                available: false, 
                error: 'WebGL is not supported by your browser or graphics driver.' 
            }
        }

        // Check for required extensions
        const requiredExtensions = ['OES_element_index_uint']
        for (const ext of requiredExtensions) {
            if (!gl.getExtension(ext)) {
                return { 
                    available: false, 
                    error: `WebGL extension ${ext} is not supported.` 
                }
            }
        }

        return { available: true, error: null }
    } catch (err) {
        return { 
            available: false, 
            error: `WebGL check failed: ${err.message}` 
        }
    }
}

/**
 * Checks if Web Audio API is available and supported by the browser
 * @returns {{available: boolean, error: string|null}} Support status and error message if unavailable
 */
export function checkWebAudioSupport() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!AudioContext) {
            return { 
                available: false, 
                error: 'Web Audio API is not supported by your browser.' 
            }
        }
        return { available: true, error: null }
    } catch (err) {
        return { 
            available: false, 
            error: `Web Audio API check failed: ${err.message}` 
        }
    }
}

/**
 * Creates and displays an error overlay with a message
 * Used for critical errors and non-blocking warnings
 * @param {string} title - Error title displayed prominently
 * @param {string} message - Detailed error message with optional line breaks
 * @param {boolean} [blocking=true] - Whether this error prevents the app from running
 */
export function showErrorUI(title, message, blocking = true) {
    // Remove existing error overlay if any
    const existing = document.getElementById('error-overlay')
    if (existing) {
        existing.remove()
    }

    const overlay = document.createElement('div')
    overlay.id = 'error-overlay'
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: blocking ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '99999',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
        padding: '20px',
        boxSizing: 'border-box'
    })

    const container = document.createElement('div')
    Object.assign(container.style, {
        maxWidth: '500px',
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid #333'
    })

    const titleEl = document.createElement('h2')
    titleEl.textContent = title
    Object.assign(titleEl.style, {
        margin: '0 0 16px 0',
        fontSize: '24px',
        fontWeight: '600',
        color: '#ff6b6b'
    })

    const messageEl = document.createElement('p')
    messageEl.textContent = message
    Object.assign(messageEl.style, {
        margin: '0 0 24px 0',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#ccc'
    })

    container.appendChild(titleEl)
    container.appendChild(messageEl)

    if (!blocking) {
        const closeBtn = document.createElement('button')
        closeBtn.textContent = 'Dismiss'
        Object.assign(closeBtn.style, {
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 24px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '500'
        })
        closeBtn.addEventListener('click', () => overlay.remove())
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#555')
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#444')
        container.appendChild(closeBtn)
    }

    overlay.appendChild(container)
    document.body.appendChild(overlay)
}

/**
 * Shows a loading overlay with a spinner and progress message
 * Returns an object with methods to update the message or remove the overlay
 * @param {string} [message='Loading...'] - Initial loading message
 * @returns {{update: function(string): void, remove: function(): void}} Controller object
 * @returns {function(string): void} return.update - Updates the loading message
 * @returns {function(): void} return.remove - Removes the loading overlay
 */
export function showLoadingUI(message = 'Loading...') {
    // Remove existing loading overlay if any
    const existing = document.getElementById('loading-overlay')
    if (existing) {
        existing.remove()
    }

    const overlay = document.createElement('div')
    overlay.id = 'loading-overlay'
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '99998',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff'
    })

    const container = document.createElement('div')
    Object.assign(container.style, {
        textAlign: 'center'
    })

    const spinner = document.createElement('div')
    Object.assign(spinner.style, {
        width: '50px',
        height: '50px',
        margin: '0 auto 20px',
        border: '4px solid #333',
        borderTop: '4px solid #fff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    })

    const messageEl = document.createElement('div')
    messageEl.textContent = message
    Object.assign(messageEl.style, {
        fontSize: '16px',
        color: '#ccc'
    })

    // Add keyframe animation for spinner
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style')
        style.id = 'spinner-style'
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `
        document.head.appendChild(style)
    }

    container.appendChild(spinner)
    container.appendChild(messageEl)
    overlay.appendChild(container)
    document.body.appendChild(overlay)

    return {
        update: (newMessage) => {
            messageEl.textContent = newMessage
        },
        remove: () => {
            overlay.remove()
        }
    }
}

/**
 * Ensure audio context is resumed (handles autoplay policy)
 * @param {AudioContext} audioContext - The audio context to resume
 * @returns {Promise<boolean>} Resolves to true if resumed successfully
 */
export async function resumeAudioContext(audioContext) {
    if (!audioContext) return false

    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume()
            return true
        } catch (err) {
            console.error('Failed to resume audio context:', err)
            return false
        }
    }
    
    return audioContext.state === 'running'
}

/**
 * Loads a GLTF model asynchronously with comprehensive error handling
 * @param {THREE.GLTFLoader} loader - The GLTF loader instance
 * @param {string} path - Path to the .gltf or .glb model file
 * @param {function(ProgressEvent): void} [onProgress=null] - Optional progress callback
 * @returns {Promise<Object>} Promise that resolves with loaded GLTF object containing scene, animations, etc.
 * @throws {Error} If the model fails to load
 */
export function loadGLTFModel(loader, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                console.log(`✓ Loaded model: ${path}`)
                resolve(gltf)
            },
            onProgress,
            (error) => {
                console.error(`✗ Failed to load model: ${path}`, error)
                reject(new Error(`Failed to load model ${path}: ${error.message}`))
            }
        )
    })
}

/**
 * Loads an audio file asynchronously with error handling
 * @param {THREE.AudioLoader} loader - The Three.js audio loader instance
 * @param {string} path - Path to the audio file (.ogg, .mp3, etc.)
 * @returns {Promise<AudioBuffer>} Promise that resolves with decoded audio buffer
 * @throws {Error} If the audio file fails to load or decode
 */
export function loadAudioFile(loader, path) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (buffer) => {
                console.log(`✓ Loaded audio: ${path}`)
                resolve(buffer)
            },
            null,
            (error) => {
                console.error(`✗ Failed to load audio: ${path}`, error)
                reject(new Error(`Failed to load audio ${path}: ${error.message}`))
            }
        )
    })
}

/**
 * Loads an HDR texture for environment mapping with error handling
 * @param {THREE.RGBELoader} loader - The RGBE (HDR) loader instance
 * @param {string} path - Path to the .hdr file
 * @returns {Promise<THREE.DataTexture>} Promise that resolves with loaded HDR texture
 * @throws {Error} If the HDR file fails to load
 */
export function loadHDRTexture(loader, path) {
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (texture) => {
                console.log(`✓ Loaded HDR: ${path}`)
                resolve(texture)
            },
            null,
            (error) => {
                console.error(`✗ Failed to load HDR: ${path}`, error)
                reject(new Error(`Failed to load HDR ${path}: ${error.message}`))
            }
        )
    })
}

/**
 * Recursively dispose of Three.js object and all its children
 * Cleans up geometries, materials, textures, and render targets
 * @param {THREE.Object3D} object - Object to dispose
 */
export function disposeObject(object) {
    if (!object) return

    // Traverse all children first
    if (object.children) {
        for (let i = object.children.length - 1; i >= 0; i--) {
            disposeObject(object.children[i])
        }
    }

    // Dispose geometry
    if (object.geometry) {
        object.geometry.dispose()
    }

    // Dispose material(s)
    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(material => disposeMaterial(material))
        } else {
            disposeMaterial(object.material)
        }
    }

    // Dispose render target
    if (object.renderTarget) {
        object.renderTarget.dispose()
    }

    // Remove from parent
    if (object.parent) {
        object.parent.remove(object)
    }
}

/**
 * Dispose of a material and its textures
 * @private
 * @param {THREE.Material} material - Material to dispose
 */
function disposeMaterial(material) {
    if (!material) return

    // Dispose all texture properties
    Object.keys(material).forEach(prop => {
        const value = material[prop]
        if (value && typeof value === 'object' && 'minFilter' in value) {
            // It's a texture
            value.dispose()
        }
    })

    material.dispose()
}

/**
 * Dispose of an HDR texture with error handling
 * @param {THREE.Texture} texture - Texture to dispose
 */
export function disposeTexture(texture) {
    if (!texture) return
    
    try {
        texture.dispose()
    } catch (err) {
        console.error('Failed to dispose texture:', err)
    }
}

/**
 * Stop and disconnect a positional audio emitter, cleaning up its resources
 * @param {THREE.PositionalAudio} emitter - Audio emitter to clean up
 */
export function disposeAudioEmitter(emitter) {
    if (!emitter) return

    try {
        // Stop playback
        if (emitter.isPlaying) {
            emitter.stop()
        }

        // Disconnect custom reverb nodes if present
        if (emitter._reverbNodes) {
            const { dryGain, wetGain, convolver } = emitter._reverbNodes
            try {
                dryGain.disconnect()
                wetGain.disconnect()
                convolver.disconnect()
            } catch (err) {
                console.warn('Error disconnecting reverb nodes:', err)
            }
            emitter._reverbNodes = null
        }

        // Disconnect the emitter itself
        emitter.disconnect()

        // Clear buffer reference
        emitter.buffer = null
    } catch (err) {
        console.error('Failed to dispose audio emitter:', err)
    }
}

/**
 * Clean up an audio analyser
 * @param {THREE.AudioAnalyser} analyser - Analyser to clean up
 */
export function disposeAudioAnalyser(analyser) {
    if (!analyser) return

    try {
        if (analyser.analyser) {
            analyser.analyser.disconnect()
        }
    } catch (err) {
        console.warn('Error disposing audio analyser:', err)
    }
}

/**
 * Create a configured directional light with shadow mapping
 * @param {Object} opts - Configuration options
 * @param {number} [opts.color=0xffffff] - Hex color value
 * @param {number} [opts.intensity=1.0] - Light intensity
 * @param {number} [opts.mapSize=1024] - Shadow map resolution (power of 2)
 * @param {number} [opts.far=15] - Shadow camera frustum far plane
 * @param {Object} [opts.bounds={left: -7, right: 7, top: 7, bottom: -7}] - Shadow camera frustum bounds
 * @param {Array<number>} [opts.position=[5, 3, 4]] - Light position [x, y, z]
 * @returns {THREE.DirectionalLight} Configured directional light with shadows
 */
export function createDirectionalLight({ color = 0xffffff, intensity = 1.0, mapSize = 1024, far = 15, bounds = { left: -7, right: 7, top: 7, bottom: -7 }, position = [5, 3, 4] } = {}) {
    const light = new THREE.DirectionalLight(color, intensity)
    light.castShadow = true
    light.shadow.mapSize.set(mapSize, mapSize)
    light.shadow.camera.far = far
    light.shadow.camera.left = bounds.left
    light.shadow.camera.right = bounds.right
    light.shadow.camera.top = bounds.top
    light.shadow.camera.bottom = bounds.bottom
    light.position.set(...position)
    return light
}

/**
 * Convenience function to create multiple directional lights from an array of configs
 * @param {Array<Object>} [configs=[]] - Array of config objects passed to createDirectionalLight
 * @returns {Array<THREE.DirectionalLight>} Array of configured directional lights
 */
export function createDirectionalLights(configs = []) {
    return configs.map(cfg => createDirectionalLight(cfg))
}

/**
 * Convert a numeric color to a #RRGGBB hex string
 * Safely handles already-string inputs (returns them unchanged if they look like a hex color)
 * @param {number|string} c - Color as number (0xff00aa) or string
 * @returns {string} Color formatted as #RRGGBB hex string
 * @example
 * colorToHex(0xff00aa) // "#ff00aa"
 * colorToHex("#ff00aa") // "#ff00aa"
 * colorToHex("0xff00aa") // "#ff00aa"
 */
export function colorToHex(c) {
    if (typeof c === 'string') {
        if (c.startsWith('#') && (c.length === 7 || c.length === 9)) return c.slice(0,7)
        // Attempt to parse numeric from string
        try {
            const n = Number(c)
            if (!Number.isNaN(n)) return `#${(n >>> 0).toString(16).padStart(6, '0')}`
        } catch (_) { /* ignore */ }
        return c // fallback
    }
    return `#${(c >>> 0).toString(16).padStart(6, '0')}`
}

/**
 * Create a visual helper for an audio emitter showing its position and details
 * @param {THREE.PositionalAudio} emitter - The audio emitter to debug
 * @param {Object} opts - options
 * @param {number} opts.size - Size of the helper
 * @param {number} opts.color - Color of the helper
 * @param {boolean} opts.showCone - If true, show a cone instead of sphere (for directional audio)
 * @param {number} opts.coneAngle - Cone angle in degrees (if showCone is true, defaults to ConeEmitterSettings.innerAngle)
 * @param {THREE.Vector3} opts.coneDirection - Direction the cone points (if showCone is true)
 * @returns {THREE.Group} The helper object
 */
export function createAudioEmitterDebugger(emitter, { size = 0.2, color = 0xffff00, showCone = false, coneAngle = ConeEmitterSettings.innerAngle, coneDirection = new THREE.Vector3(0, 0, 1) } = {}) {
    const helper = new THREE.Group()
    
    if (showCone) {
        // Create a cone geometry to visualize directional audio
        const coneHeight = size * 3
        const coneAngleRad = THREE.MathUtils.degToRad(coneAngle)
        const coneRadius = Math.tan(coneAngleRad) * coneHeight
        const geometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true)
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        })
        const cone = new THREE.Mesh(geometry, material)
        
        // Rotate cone to point in the specified direction
        // Default cone points along Y axis, we need to align it with coneDirection
        const defaultDir = new THREE.Vector3(0, -1, 0)
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(defaultDir, coneDirection.clone().normalize())
        cone.quaternion.copy(quaternion)
        
        // Offset cone so its tip is at the emitter position
        cone.position.copy(coneDirection.clone().normalize().multiplyScalar(coneHeight / 2))
        
        helper.add(cone)
        
        // Add a small sphere at the tip (emitter position)
        const tipGeometry = new THREE.SphereGeometry(size * 0.3)
        const tipMaterial = new THREE.MeshBasicMaterial({ 
            color, 
            transparent: true,
            opacity: 0.9 
        })
        const tip = new THREE.Mesh(tipGeometry, tipMaterial)
        helper.add(tip)
    } else {
        // Sphere at emitter position
        const geometry = new THREE.SphereGeometry(size)
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true,
            transparent: true,
            opacity: 0.8 
        })
        const sphere = new THREE.Mesh(geometry, material)
        helper.add(sphere)
    }

    // Match position to emitter
    helper.position.copy(emitter.position)

    return helper
}

/**
 * Create a pair of headlight SpotLights (left and right) with shadow mapping
 * @param {Object} opts - Configuration options
 * @param {number} [opts.color=0xFFFFDE] - Hex color value (warm white)
 * @param {number} [opts.intensity=3.0] - Light intensity
 * @param {number} [opts.distance=10] - Maximum light distance
 * @param {number} [opts.angle=Math.PI/6] - Cone angle in radians
 * @param {number} [opts.penumbra=0.5] - Penumbra value (0-1)
 * @param {number} [opts.decay=1.0] - Light decay factor
 * @param {Array<number>} [opts.leftPosition=[0.75, 0.76, 1.8]] - Left headlight position [x, y, z]
 * @param {Array<number>} [opts.rightPosition=[-0.75, 0.76, 1.8]] - Right headlight position [x, y, z]
 * @param {Array<number>} [opts.targetPosition=[0, 0, 10]] - Light target position [x, y, z]
 * @returns {Object} Object with left and right SpotLight instances: { left: THREE.SpotLight, right: THREE.SpotLight }
 */
export function createHeadlightSpots({ color = 0xFFFFDE, intensity = 3.0, distance = 10, angle = Math.PI / 6, penumbra = 0.5, decay = 1.0, leftPosition = [0.75, 0.76, 1.8], rightPosition = [-0.75, 0.76, 1.8], targetPosition = [0, 0, 10] } = {}) {
    const left = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)
    left.position.set(...leftPosition)
    left.target.position.set(...targetPosition)
    left.castShadow = true
    left.shadow.mapSize.width = 1024
    left.shadow.mapSize.height = 1024
    left.shadow.camera.near = 0.5
    left.shadow.camera.far = 20
    left.shadow.camera.fov = 30

    const right = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)
    right.position.set(...rightPosition)
    right.target.position.set(...targetPosition)
    right.castShadow = true
    right.shadow.mapSize.width = 1024
    right.shadow.mapSize.height = 1024
    right.shadow.camera.near = 0.5
    right.shadow.camera.far = 20
    right.shadow.camera.fov = 30

    return { left, right }
}

/**
 * Load (if needed) and play audio on a THREE.PositionalAudio emitter with caching support
 * If a `store` object and `storeKey` are provided, the loaded buffer will be cached there and reused
 * @param {THREE.AudioLoader} audioLoader - Instance used to load audio files
 * @param {THREE.PositionalAudio} emitter - The positional audio emitter to play the buffer on
 * @param {string} path - URL/path to the audio file
 * @param {Object} [opts] - Configuration options
 * @param {Object} [opts.store=null] - Optional object to cache loaded buffers (e.g., soundEngine)
 * @param {string} [opts.storeKey=null] - Key on the store where the buffer will be saved/loaded
 * @param {boolean} [opts.loop=false] - Whether to loop the audio
 * @param {number} [opts.refDistance=20] - Emitter reference distance for spatial audio falloff
 * @param {number|null} [opts.volume=null] - Optional volume to set (0..1)
 * @param {number} [opts.offset=0] - Playback start offset in seconds
 * @param {function(): void|null} [opts.onEnded=null] - Optional onEnded callback to set on emitter
 * @example
 * playPositionalAudio(audioLoader, exhaustEmitter, 'audio/exhaust/idle.ogg', {
 *   store: soundEngine,
 *   storeKey: 'exhaustIdleBuffer',
 *   loop: true,
 *   refDistance: 15,
 *   volume: 0.8
 * });
 */
export function playPositionalAudio(audioLoader, emitter, path, { store = null, storeKey = null, loop = false, refDistance = 20, volume = null, offset = 0, onEnded = null } = {}) {
    const playBuffer = (buffer) => {
        try {
            emitter.stop()
            emitter.setBuffer(buffer)
            emitter.setRefDistance(refDistance)
            emitter.setLoop(loop)
            if (typeof volume === 'number' && emitter.setVolume) emitter.setVolume(volume)
            if (onEnded) emitter.onEnded = onEnded
            emitter.play()
        } catch (err) {
            console.error('Failed to play positional audio:', err)
        }
    }

    if (store && storeKey && store[storeKey]) {
        playBuffer(store[storeKey])
        return
    }

    loadAudioFile(audioLoader, path).then(buffer => {
        if (store && storeKey) store[storeKey] = buffer
        playBuffer(buffer)
    }).catch(err => {
        console.error('Failed to load and play audio:', path, err)
    })
}

/**
 * Create a line with a clickable button that connects a 2D screen anchor to a 3D world position
 * Useful for creating interactive UI elements that point to specific parts of the 3D scene
 * @param {Object} opts - Configuration options
 * @param {THREE.Vector2} [opts.screenAnchor=new THREE.Vector2(-0.9, 0.9)] - NDC coordinates (x,y) in range [-1,1] for the fixed screen point (e.g. upper-left = [-0.9,0.9])
 * @param {THREE.Vector3} [opts.targetLocalPos=new THREE.Vector3(0, 0, 0)] - Position in local space of the target object (e.g. point on car model)
 * @param {THREE.Object3D|null} [opts.targetObject=null] - Object3D that the local position belongs to (used to compute world position and raycast intersection)
 * @param {string} [opts.label='btn'] - Button text label
 * @param {number} [opts.color=0x00ff00] - Hex color for line and button
 * @returns {Object} Controller object with methods: { line: THREE.Line, button: HTMLButtonElement, update(camera): void, setVisible(visible): void, getClickable(): HTMLButtonElement, dispose(): void }
 * @example
 * const exhaustBtn = createLineButton({
 *   screenAnchor: new THREE.Vector2(-0.9, 0.8),
 *   targetLocalPos: new THREE.Vector3(0, 0, -2),
 *   targetObject: carModel,
 *   label: 'Exhaust',
 *   color: 0xff6600
 * });
 * // In render loop:
 * exhaustBtn.update(camera);
 * // Add click handler:
 * exhaustBtn.getClickable().addEventListener('click', () => console.log('Exhaust clicked'));
 */
export function createLineButton({ screenAnchor = new THREE.Vector2(-0.9, 0.9), targetLocalPos = new THREE.Vector3(0, 0, 0), targetObject = null, label = 'btn', color = 0x00ff00 } = {}) {
    // Line geometry (two points)
    const points = [new THREE.Vector3(), new THREE.Vector3()]
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: color })
    const line = new THREE.Line(lineGeom, lineMat)
    line.set

    // Create a DOM button that will be positioned at the line's start point
    let domButton = null
    if (typeof document !== 'undefined') {
        domButton = document.createElement('button')
        domButton.color = color
        domButton.dimmed = false
        domButton.className = 'three-linebutton'
        domButton.style.position = 'absolute'
        domButton.style.padding = '4px 12px'
        domButton.style.border = 'none'
        domButton.style.borderRadius = '12px'
    domButton.style.backgroundColor = colorToHex(color)
        domButton.style.color = '#272727ff'
        domButton.style.fontFamily = 'sans-serif'
        domButton.style.fontSize = '14px'
        domButton.style.cursor = 'pointer'
        domButton.style.transform = 'translate(-50%, -50%)'
        domButton.style.boxShadow = '0 2px 2px rgba(0, 0, 0, 0.25)'
        domButton.style.userSelect = 'none'
        domButton.textContent = label
        document.body.appendChild(domButton)

        // Add hover effect
        domButton.addEventListener('mouseenter', () => {
            domButton.style.backgroundColor = colorToHex(Math.min(color * 4, 0xffffff))
        })
        domButton.addEventListener('mouseleave', () => {
            domButton.style.backgroundColor = domButton.dimmed ? `#444444` : colorToHex(color)
        })
    }

    // Raycaster used internally to find intersection point on targetObject
    const raycaster = new THREE.Raycaster()

    // Track visibility state
    let isVisible = true
    
    // Cache frequently accessed values
    const _ndc = new THREE.Vector3()
    const _dir = new THREE.Vector3()
    const _startPoint = new THREE.Vector3()
    const _targetWorld = new THREE.Vector3()
    const _rayDir = new THREE.Vector3()
    const _endPoint = new THREE.Vector3()
    const _proj = new THREE.Vector3()
    let _canvas = null
    let _canvasRect = null
    let _frameCount = 0

    // Update function to be called each frame
    function update(camera) {
        // Cache canvas rect every 30 frames to avoid constant DOM queries
        if (_frameCount % 30 === 0 || !_canvas) {
            _canvas = document.querySelector('canvas.webgl')
            if (_canvas) {
                _canvasRect = _canvas.getBoundingClientRect()
            }
        }
        _frameCount++
        
        // Compute world start point from screenAnchor (NDC) at z = 0.5
        _ndc.set(screenAnchor.x, screenAnchor.y, 0.5)
        _ndc.unproject(camera)
        _dir.copy(_ndc).sub(camera.position).normalize()
        // set a reasonable distance for the start point along the ray (near camera)
        _startPoint.copy(camera.position).add(_dir.multiplyScalar(1.0))

        // Compute target world position from targetLocalPos / targetObject
        if (targetObject) {
            _targetWorld.copy(targetLocalPos)
            targetObject.localToWorld(_targetWorld)
        } else {
            _targetWorld.copy(targetLocalPos)
        }

        // Raycast from camera towards targetWorld to find intersection with targetObject (car)
        _rayDir.copy(_targetWorld).sub(camera.position).normalize()
        raycaster.set(camera.position, _rayDir)
        _endPoint.copy(_targetWorld)
        
        if (targetObject) {
            const hits = raycaster.intersectObject(targetObject, true)
            if (hits && hits.length > 0) {
                _endPoint.copy(hits[0].point)
            }
        }

        // Update line geometry positions (startPoint -> endPoint)
        const posAttr = line.geometry.attributes.position
        posAttr.setXYZ(0, _startPoint.x, _startPoint.y, _startPoint.z)
        posAttr.setXYZ(1, _endPoint.x, _endPoint.y, _endPoint.z)
        posAttr.needsUpdate = true

        // Update DOM button position at the line's start point
        if (domButton && _canvasRect) {
            _proj.copy(_startPoint).project(camera)
            // Hide if behind camera or offscreen
            if (!isVisible || _proj.z > 1 || _proj.z < -1 || _proj.x < -1.2 || _proj.x > 1.2 || _proj.y < -1.2 || _proj.y > 1.2) {
                domButton.style.display = 'none'
            } else {
                domButton.style.display = ''
                const x = (_proj.x * 0.5 + 0.5) * _canvasRect.width + _canvasRect.left
                const y = (-_proj.y * 0.5 + 0.5) * _canvasRect.height + _canvasRect.top
                domButton.style.left = `${x}px`
                domButton.style.top = `${y}px`
            }
        }
    }

    // Toggle visibility of both line and DOM button
    function setVisible(visible) {
        isVisible = visible
        line.visible = visible
        if (domButton) {
            domButton.style.display = visible ? '' : 'none'
        }
    }

    // Clean up DOM element and event listeners
    function dispose() {
        if (domButton && domButton.parentElement) {
            domButton.removeEventListener('mouseenter', null)
            domButton.removeEventListener('mouseleave', null)
            domButton.parentElement.removeChild(domButton)
            domButton = null
        }
        if (line.geometry) {
            line.geometry.dispose()
        }
        if (line.material) {
            line.material.dispose()
        }
    }

    return {
        line,
        button: domButton,
        update,
        setVisible,
        dispose
    }
}
