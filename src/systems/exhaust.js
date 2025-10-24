/**
 * @fileoverview Particle system for exhaust smoke visualization with object pooling
 * @module systems/exhaust
 */

import * as THREE from 'three'

/** Maximum number of particles that can be active simultaneously */
const MAX_PARTICLES = 1000

/** Shared geometry for all smoke particles */
const smokeGeometry = new THREE.BufferGeometry()

/** Position buffer for particle vertices (xyz per particle) */
const smokePositions = new Float32Array(MAX_PARTICLES * 3)

/** Color buffer for particles (RGBA per particle) */
const smokeColors = new Float32Array(MAX_PARTICLES * 4)

/** Size buffer for particles */
const smokeSizes = new Float32Array(MAX_PARTICLES)

smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3))
smokeGeometry.setAttribute('color', new THREE.BufferAttribute(smokeColors, 4))
smokeGeometry.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1))

/** Material for smoke particles with additive blending */
const smokeMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
})

/** Three.js Points mesh for rendering all particles */
const smokePoints = new THREE.Points(smokeGeometry, smokeMaterial)

/**
 * Object pool for particle management
 * Reuses particle objects to minimize garbage collection pressure
 * @namespace
 */
const particlePool = {
    /** @type {Array<Object>} Pool of reusable particle objects */
    pool: [],
    /** @type {Array<Object>} Active particles currently in use */
    active: [],
    
    /**
     * Acquires a particle from the pool or creates a new one if pool is empty
     * @returns {Object} A particle object with default properties
     */
    acquire() {
        let particle
        if (this.pool.length > 0) {
            particle = this.pool.pop()
        } else {
            // Create new particle object if pool is empty
            particle = {
                offset: [0, 0, 0],
                scale: [0, 0],
                quaternion: [0, 0, 0, 0],
                rotation: 0,
                color: [1, 1, 1, 1],
                blend: 0,
                texture: 0,
                live: 0,
                scale_increase: 0,
                opacity_decrease: 0,
                color_from: [0, 0, 0],
                color_to: [0, 0, 0],
                color_speed: 0,
                color_pr: 0
            }
        }
        this.active.push(particle)
        return particle
    },
    
    /**
     * Returns a particle to the pool for later reuse
     * @param {Object} particle - The particle to release
     */
    release(particle) {
        const index = this.active.indexOf(particle)
        if (index > -1) {
            this.active.splice(index, 1)
            this.pool.push(particle)
        }
    },
    
    /**
     * Gets the count of currently active particles
     * @returns {number} Number of particles in use
     */
    getActiveCount() {
        return this.active.length
    },
    
    /**
     * Clears all active particles and returns them to the pool
     */
    clear() {
        // Return all active particles to pool
        while (this.active.length > 0) {
            this.pool.push(this.active.pop())
        }
    }
}

/**
 * Particle system for exhaust smoke effects
 * Manages smoke particle emission, animation, and rendering
 * @namespace
 */
export const particleSystem = {
    /** @type {Array<Object>} Array of particle emitters */
    emitters: [],
    /** @type {boolean} Global enable/disable flag */
    enabled: true,
    /** @type {boolean} Visibility flag for culling when off-screen */
    visible: true,
    
    /**
     * Initializes the particle system and creates exhaust emitters
     */
    initialize: () => {
        // Create exhaust emitter for tailpipe
        const exhaustEmitter = {
            enabled: false,
            position: new THREE.Vector3(-0.5, 0.3, -2.0), // Tailpipe position relative to car
            settings: {
                radius_1: 0.02,
                radius_2: 0.1,
                radius_height: 0.2,
                add_time: 0.02,
                elapsed: 0,
                live_time_from: 1.0,
                live_time_to: 1.5,
                opacity_decrease: 0.008,
                rotation_from: 0.5,
                rotation_to: 1.0,
                speed_from: 0.003,
                speed_to: 0.006,
                scale_from: 0.1,
                scale_increase: 0.002,
                color_from: [0.9, 0.9, 0.9],
                color_to: [0.5, 0.5, 0.5],
                color_speed_from: 1.0,
                color_speed_to: 1.0,
                brightness_from: 0.5,
                brightness_to: 0.9,
                opacity: 0.6,
                blend: 0.8,
                texture: 0.5  // Smoke texture
            }
        }
        particleSystem.emitters.push(exhaustEmitter)
    },
    
    /**
     * Updates particle system - creates new particles and updates existing ones
     * @param {number} deltaTime - Time elapsed since last frame in seconds
     * @param {string} engineState - Current engine state ('stop', 'drive', 'accel', 'decel')
     */
    update: (deltaTime, engineState) => {
        // Skip particle updates if system is disabled or not visible
        if (!particleSystem.enabled || !particleSystem.visible) {
            return
        }
        
        // Update emitters and create new particles
        particleSystem.emitters.forEach(emitter => {
            if (engineState !== 'stop') {
                emitter.enabled = true
                emitter.settings.add_time = engineState === 'accel' ? 0.01 : 0.02 // More particles during acceleration  
                emitter.settings.speed_from = engineState === 'accel' ? 0.005 : 0.003
                emitter.settings.speed_to = engineState === 'accel' ? 0.008 : 0.006
            } else {
                emitter.enabled = false
            }

            if (emitter.enabled) {
                let add = 0
                emitter.settings.elapsed += deltaTime
                add = Math.floor(emitter.settings.elapsed / emitter.settings.add_time)
                emitter.settings.elapsed -= add * emitter.settings.add_time

                while (add--) {
                    // Enforce max particle limit to prevent unbounded memory growth
                    if (particlePool.getActiveCount() >= MAX_PARTICLES) {
                        break
                    }

                    // Acquire particle from pool
                    const p = particlePool.acquire()

                    // Initialize particle position
                    const radius_1 = emitter.settings.radius_1 * Math.sqrt(Math.random())
                    const theta = 2 * Math.PI * Math.random()
                    const x_1 = emitter.position.x + radius_1 * Math.cos(theta)
                    const z_1 = emitter.position.z + radius_1 * Math.sin(theta)

                    const radius_2 = emitter.settings.radius_2 * Math.sqrt(Math.random())
                    const x_2 = x_1 + radius_2 * Math.cos(theta)
                    const z_2 = z_1 + radius_2 * Math.sin(theta)

                    const direction = new THREE.Vector3(
                        x_2 - x_1,
                        emitter.settings.radius_height,
                        z_2 - z_1
                    ).normalize()

                    const speed = Math.random() * (emitter.settings.speed_to - emitter.settings.speed_from) + emitter.settings.speed_from
                    direction.multiplyScalar(speed)

                    const brightness = Math.random() * (emitter.settings.brightness_to - emitter.settings.brightness_from) + emitter.settings.brightness_from

                    // Reuse particle object instead of creating new one
                    p.offset[0] = x_1
                    p.offset[1] = emitter.position.y
                    p.offset[2] = z_1
                    p.scale[0] = emitter.settings.scale_from
                    p.scale[1] = emitter.settings.scale_from
                    p.quaternion[0] = direction.x
                    p.quaternion[1] = direction.y
                    p.quaternion[2] = direction.z
                    p.quaternion[3] = 3
                    p.rotation = Math.random() * (emitter.settings.rotation_to - emitter.settings.rotation_from) + emitter.settings.rotation_from
                    p.color[0] = 1
                    p.color[1] = 1
                    p.color[2] = 1
                    p.color[3] = emitter.settings.opacity
                    p.blend = emitter.settings.blend
                    p.texture = emitter.settings.texture
                    p.live = Math.random() * (emitter.settings.live_time_to - emitter.settings.live_time_from) + emitter.settings.live_time_from
                    p.scale_increase = emitter.settings.scale_increase
                    p.opacity_decrease = emitter.settings.opacity_decrease
                    p.color_from[0] = emitter.settings.color_from[0] * brightness
                    p.color_from[1] = emitter.settings.color_from[1] * brightness
                    p.color_from[2] = emitter.settings.color_from[2] * brightness
                    p.color_to[0] = emitter.settings.color_to[0] * brightness
                    p.color_to[1] = emitter.settings.color_to[1] * brightness
                    p.color_to[2] = emitter.settings.color_to[2] * brightness
                    p.color_speed = Math.random() * (emitter.settings.color_speed_to - emitter.settings.color_speed_from) + emitter.settings.color_speed_from
                    p.color_pr = 0
                }
            }
        });

        // Update existing particles (iterate backwards for safe removal)
        const activeParticles = particlePool.active
        for (let i = activeParticles.length - 1; i >= 0; i--) {
            const p = activeParticles[i]

            // Update particle position based on quaternion direction
            p.offset[0] += p.quaternion[0]
            p.offset[1] += p.quaternion[1]
            p.offset[2] += p.quaternion[2]

            // Update scale
            p.scale[0] += p.scale_increase
            p.scale[1] += p.scale_increase

            // Update color
            p.color_pr += p.color_speed
            if (p.color_pr > 1) p.color_pr = 1
            p.color[0] = p.color_from[0] + (p.color_to[0] - p.color_from[0]) * p.color_pr
            p.color[1] = p.color_from[1] + (p.color_to[1] - p.color_from[1]) * p.color_pr
            p.color[2] = p.color_from[2] + (p.color_to[2] - p.color_from[2]) * p.color_pr

            // Update opacity
            p.color[3] -= p.opacity_decrease

            // Remove dead particles and return to pool
            p.live -= deltaTime
            if (p.live <= 0 || p.color[3] <= 0) {
                particlePool.release(p)
                continue
            }

            // Update particle attributes in geometry
            const idx = i * 3
            smokePositions[idx] = p.offset[0]
            smokePositions[idx + 1] = p.offset[1]
            smokePositions[idx + 2] = p.offset[2]

            const colorIdx = i * 4
            smokeColors[colorIdx] = p.color[0]
            smokeColors[colorIdx + 1] = p.color[1]
            smokeColors[colorIdx + 2] = p.color[2]
            smokeColors[colorIdx + 3] = p.color[3]

            smokeSizes[i] = p.scale[0]
        }

        // Only update geometry if we have active particles
        if (particlePool.getActiveCount() > 0) {
            smokeGeometry.attributes.position.needsUpdate = true
            smokeGeometry.attributes.color.needsUpdate = true
            smokeGeometry.attributes.size.needsUpdate = true
        }
    },
    
    /**
     * Gets the Three.js Points mesh for rendering
     * @returns {THREE.Points} The smoke particles mesh
     */
    getMesh: () => {
        return smokePoints
    },
    
    /**
     * Disposes of all particle system resources
     * Cleans up geometry, material, and particle pool
     */
    dispose: () => {
        // Clear particle pool
        particlePool.clear()
        
        // Dispose geometry and material
        if (smokeGeometry) {
            smokeGeometry.dispose()
        }
        if (smokeMaterial) {
            smokeMaterial.dispose()
        }
        
        // Clear emitters
        particleSystem.emitters.length = 0
    },
    
    /**
     * Gets performance statistics about the particle system
     * @returns {Object} Stats object
     * @returns {number} return.activeParticles - Number of currently active particles
     * @returns {number} return.pooledParticles - Number of particles available in pool
     * @returns {number} return.totalAllocated - Total particles allocated in memory
     */
    getStats: () => {
        return {
            activeParticles: particlePool.getActiveCount(),
            pooledParticles: particlePool.pool.length,
            totalAllocated: particlePool.active.length + particlePool.pool.length
        }
    }
}