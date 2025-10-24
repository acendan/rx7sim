import * as THREE from 'three'
import { ConeEmitterSettings } from './constants.js'
// Note: colorToHex is defined below; forward usage inside file is fine.

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
 * Create a configured directional light
 * @param {Object} opts - options
 * @param {Number} opts.color - hex color
 * @param {Number} opts.intensity - light intensity
 * @param {Number} opts.mapSize - shadow map size (number)
 * @param {Number} opts.far - shadow camera far
 * @param {Object} opts.bounds - {left, right, top, bottom}
 * @param {Array} opts.position - [x,y,z]
 * @returns {THREE.DirectionalLight}
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
 * Convenience to create multiple directional lights from an array of configs
 * @param {Array} configs - array of config objects passed to createDirectionalLight
 * @returns {Array} lights
 */
export function createDirectionalLights(configs = []) {
    return configs.map(cfg => createDirectionalLight(cfg))
}

/**
 * Convert a numeric color (e.g. 0xff00aa) to a #RRGGBB string.
 * Safely handles already-string inputs (returns them unchanged if they look like a hex color).
 * @param {number|string} c
 * @returns {string} #RRGGBB
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
 * Create a pair of headlight SpotLights (left and right) with standard parameters.
 * @param {Object} opts - options
 * @param {Number} opts.color - hex color
 * @param {Number} opts.intensity - intensity
 * @param {Number} opts.distance - distance
 * @param {Number} opts.angle - cone angle radians
 * @param {Number} opts.penumbra - penumbra
 * @param {Number} opts.decay - decay
 * @param {Array} opts.leftPosition - [x,y,z]
 * @param {Array} opts.rightPosition - [x,y,z]
 * @param {Array} opts.targetPosition - [x,y,z]
 * @returns {Object} { left: SpotLight, right: SpotLight }
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
 * Load (if needed) and play audio on a THREE.PositionalAudio emitter.
 * If a `store` object and `storeKey` are provided, the loaded buffer will be cached there and reused.
 * @param {THREE.AudioLoader} audioLoader - instance used to load audio files
 * @param {THREE.PositionalAudio} emitter - the positional audio emitter to play the buffer on
 * @param {String} path - URL/path to the audio file
 * @param {Object} [opts]
 * @param {Object} [opts.store] - optional object to cache loaded buffers (e.g., soundEngine)
 * @param {String} [opts.storeKey] - key on the store where the buffer will be saved/loaded
 * @param {Boolean} [opts.loop=false] - whether to loop the audio
 * @param {Number} [opts.refDistance=20] - emitter reference distance
 * @param {Number|null} [opts.volume=null] - optional volume to set (0..1)
 * @param {Function|null} [opts.onEnded=null] - optional onEnded callback to set on emitter
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
        } catch (e) {
            // Defensive: if emitter is not ready, log and ignore
            // (caller should ensure emitter is attached to listener)
            // console.warn('playPositionalAudio: emitter playback failed', e)
        }
    }

    if (store && storeKey && store[storeKey]) {
        playBuffer(store[storeKey])
        return
    }

    audioLoader.load(path, (buffer) => {
        console.log(`Loaded Audio - ${pos}: ${key}`)
        
        if (store && storeKey) store[storeKey] = buffer
        playBuffer(buffer)
    })
}

/**
 * Create a line with a clickable button at the end.
 * - screenAnchor: NDC coordinates (x,y) in range [-1,1] for the fixed screen point (e.g. upper-left = [-0.9,0.9])
 * - targetLocalPos: THREE.Vector3 position in local space of the target object (e.g. point on car model)
 * - targetObject: THREE.Object3D that the local position belongs to (used to compute world position and raycast intersection)
 * Returns an object { line, button, update(camera), getClickable() }
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
        domButton.style.boxShadow = '0 2px 2px rgba(255, 255, 255, 0.24)'
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

    // Update function to be called each frame
    function update(camera) {
        // Compute world start point from screenAnchor (NDC) at z = 0.5
        const ndc = new THREE.Vector3(screenAnchor.x, screenAnchor.y, 0.5)
        ndc.unproject(camera)
        const dir = ndc.clone().sub(camera.position).normalize()
        // set a reasonable distance for the start point along the ray (near camera)
        const startPoint = camera.position.clone().add(dir.clone().multiplyScalar(1.0))

        // Compute target world position from targetLocalPos / targetObject
        let targetWorld = new THREE.Vector3()
        if (targetObject) {
            targetWorld.copy(targetLocalPos)
            targetObject.localToWorld(targetWorld)
        } else {
            targetWorld.copy(targetLocalPos)
        }

        // Raycast from camera towards targetWorld to find intersection with targetObject (car)
        const rayDir = targetWorld.clone().sub(camera.position).normalize()
        raycaster.set(camera.position, rayDir)
        let endPoint = targetWorld.clone()
        if (targetObject) {
            const hits = raycaster.intersectObject(targetObject, true)
            if (hits && hits.length > 0) {
                endPoint.copy(hits[0].point)
            } else {
                // fallback: use targetWorld
                endPoint.copy(targetWorld)
            }
        }

        // Update line geometry positions (startPoint -> endPoint)
        const posAttr = line.geometry.attributes.position
        posAttr.setXYZ(0, startPoint.x, startPoint.y, startPoint.z)
        posAttr.setXYZ(1, endPoint.x, endPoint.y, endPoint.z)
        posAttr.needsUpdate = true

        // Update DOM button position at the line's start point
        if (domButton) {
            const proj = startPoint.clone().project(camera)
            // Hide if behind camera or offscreen
            if (!isVisible || proj.z > 1 || proj.z < -1 || proj.x < -1.2 || proj.x > 1.2 || proj.y < -1.2 || proj.y > 1.2) {
                domButton.style.display = 'none'
            } else {
                domButton.style.display = ''
                const canvas = document.querySelector('canvas.webgl')
                if (canvas) {
                    const rect = canvas.getBoundingClientRect()
                    const x = (proj.x * 0.5 + 0.5) * rect.width + rect.left
                    const y = (-proj.y * 0.5 + 0.5) * rect.height + rect.top
                    domButton.style.left = `${x}px`
                    domButton.style.top = `${y}px`
                }
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
