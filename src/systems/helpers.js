import * as THREE from 'three'

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
export function createHeadlightSpots({ color = 0xFFFFDE, intensity = 3.0, distance = 10, angle = Math.PI / 6, penumbra = 0.5, decay = 1.0, leftPosition = [0.75, 0.76, 1.8], rightPosition = [-0.75, 0.76, 1.8], targetPosition = [0,0,10] } = {}) {
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
export function playPositionalAudio(audioLoader, emitter, path, { store = null, storeKey = null, loop = false, refDistance = 20, volume = null, onEnded = null } = {}) {
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
        if (store && storeKey) store[storeKey] = buffer
        playBuffer(buffer)
    })
}
