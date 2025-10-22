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
