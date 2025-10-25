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
                scaleIncrease: 0,
                opacityDecrease: 0,
                colorFrom: [0, 0, 0],
                colorTo: [0, 0, 0],
                colorSpeed: 0,
                colorProgress: 0
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
    /** @type {boolean} Backfire effect active flag */
    backfireActive: false,
    /** @type {number} Backfire elapsed time tracker */
    backfireElapsed: 0,
    /** @type {number} Backfire duration in seconds */
    backfireDuration: 0.5,
    
    /**
     * Initializes the particle system and creates exhaust emitters
     */
    initialize: () => {
        // Create exhaust emitter for tailpipe
        const exhaustEmitter = {
            enabled: false,
            position: new THREE.Vector3(-0.5, 0.3, -2.0), // Tailpipe position relative to car
            settings: {
                radius1: 0.02,
                radius2: 0.1,
                radiusHeight: 0.2,
                addTime: 0.02,
                elapsed: 0,
                liveTimeFrom: 1.0,
                liveTimeTo: 1.5,
                opacityDecrease: 0.008,
                rotationFrom: 0.5,
                rotationTo: 1.0,
                speedFrom: 0.003,
                speedTo: 0.006,
                scaleFrom: 0.1,
                scaleIncrease: 0.002,
                colorFrom: [0.9, 0.9, 0.9],
                colorTo: [0.5, 0.5, 0.5],
                colorSpeedFrom: 1.0,
                colorSpeedTo: 1.0,
                brightnessFrom: 0.5,
                brightnessTo: 0.9,
                opacity: 0.6,
                blend: 0.8,
                texture: 0.5  // Smoke texture
            },
            // Backfire particle settings - red/orange/yellow flames shooting backward
            backfireSettings: {
                radius1: 0.02,
                radius2: 0.03,
                radiusHeight: 0.01, // Positive for slight upward trajectory
                addTime: 0.005, // Rapid emission
                elapsed: 0,
                liveTimeFrom: 0.2,
                liveTimeTo: 0.4,
                opacityDecrease: 0.02,
                rotationFrom: 2.0,
                rotationTo: 4.0,
                speedFrom: 0.01, // Reduced from 0.03
                speedTo: 0.02,   // Reduced from 0.06
                scaleFrom: 0.15,
                scaleIncrease: -0.003, // Shrink over time
                colorFrom: [1.0, 0.3, 0.1], // Bright red-orange
                colorTo: [0.9, 0.6, 0.0], // Yellow-orange
                colorSpeedFrom: 2.0,
                colorSpeedTo: 3.0,
                brightnessFrom: 0.8,
                brightnessTo: 1.0,
                opacity: 0.8,
                blend: 1.0,
                texture: 0.3
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
        
        // Track backfire effect timing
        if (particleSystem.backfireActive) {
            particleSystem.backfireElapsed += deltaTime
            if (particleSystem.backfireElapsed >= particleSystem.backfireDuration) {
                particleSystem.backfireActive = false
                particleSystem.backfireElapsed = 0
            }
        }
        
        // Update emitters and create new particles
        particleSystem.emitters.forEach(emitter => {
            // Determine which settings to use based on backfire state
            const activeSettings = particleSystem.backfireActive ? emitter.backfireSettings : emitter.settings
            
            if (engineState !== 'stop' || particleSystem.backfireActive) {
                emitter.enabled = true
                
                // Use backfire settings if active, otherwise adjust based on engine state
                if (particleSystem.backfireActive) {
                    activeSettings.elapsed += deltaTime
                } else {
                    activeSettings.addTime = engineState === 'accel' ? 0.01 : 0.02 // More particles during acceleration  
                    activeSettings.speedFrom = engineState === 'accel' ? 0.005 : 0.003
                    activeSettings.speedTo = engineState === 'accel' ? 0.008 : 0.006
                    activeSettings.elapsed += deltaTime
                }
            } else {
                emitter.enabled = false
            }

            if (emitter.enabled) {
                let add = 0
                add = Math.floor(activeSettings.elapsed / activeSettings.addTime)
                activeSettings.elapsed -= add * activeSettings.addTime

                while (add--) {
                    // Enforce max particle limit to prevent unbounded memory growth
                    if (particlePool.getActiveCount() >= MAX_PARTICLES) {
                        break
                    }

                    // Acquire particle from pool
                    const p = particlePool.acquire()

                    // Initialize particle position
                    const radius1 = activeSettings.radius1 * Math.sqrt(Math.random())
                    const theta = 2 * Math.PI * Math.random()
                    const x1 = emitter.position.x + radius1 * Math.cos(theta)
                    const z1 = emitter.position.z + radius1 * Math.sin(theta)

                    const radius2 = activeSettings.radius2 * Math.sqrt(Math.random())
                    const x2 = x1 + radius2 * Math.cos(theta)
                    const z2 = z1 + radius2 * Math.sin(theta)

                    const direction = new THREE.Vector3(
                        x2 - x1,
                        activeSettings.radiusHeight,
                        z2 - z1
                    ).normalize()

                    const speed = Math.random() * (activeSettings.speedTo - activeSettings.speedFrom) + activeSettings.speedFrom
                    direction.multiplyScalar(speed)

                    const brightness = Math.random() * (activeSettings.brightnessTo - activeSettings.brightnessFrom) + activeSettings.brightnessFrom

                    // Reuse particle object instead of creating new one
                    p.offset[0] = x1
                    p.offset[1] = emitter.position.y
                    p.offset[2] = z1
                    p.scale[0] = activeSettings.scaleFrom
                    p.scale[1] = activeSettings.scaleFrom
                    p.quaternion[0] = direction.x
                    p.quaternion[1] = direction.y
                    p.quaternion[2] = direction.z
                    p.quaternion[3] = 3
                    p.rotation = Math.random() * (activeSettings.rotationTo - activeSettings.rotationFrom) + activeSettings.rotationFrom
                    p.color[0] = 1
                    p.color[1] = 1
                    p.color[2] = 1
                    p.color[3] = activeSettings.opacity
                    p.blend = activeSettings.blend
                    p.texture = activeSettings.texture
                    p.live = Math.random() * (activeSettings.liveTimeTo - activeSettings.liveTimeFrom) + activeSettings.liveTimeFrom
                    p.scaleIncrease = activeSettings.scaleIncrease
                    p.opacityDecrease = activeSettings.opacityDecrease
                    p.colorFrom[0] = activeSettings.colorFrom[0] * brightness
                    p.colorFrom[1] = activeSettings.colorFrom[1] * brightness
                    p.colorFrom[2] = activeSettings.colorFrom[2] * brightness
                    p.colorTo[0] = activeSettings.colorTo[0] * brightness
                    p.colorTo[1] = activeSettings.colorTo[1] * brightness
                    p.colorTo[2] = activeSettings.colorTo[2] * brightness
                    p.colorSpeed = Math.random() * (activeSettings.colorSpeedTo - activeSettings.colorSpeedFrom) + activeSettings.colorSpeedFrom
                    p.colorProgress = 0
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
            p.scale[0] += p.scaleIncrease
            p.scale[1] += p.scaleIncrease

            // Update color
            p.colorProgress += p.colorSpeed
            if (p.colorProgress > 1) p.colorProgress = 1
            p.color[0] = p.colorFrom[0] + (p.colorTo[0] - p.colorFrom[0]) * p.colorProgress
            p.color[1] = p.colorFrom[1] + (p.colorTo[1] - p.colorFrom[1]) * p.colorProgress
            p.color[2] = p.colorFrom[2] + (p.colorTo[2] - p.colorFrom[2]) * p.colorProgress

            // Update opacity
            p.color[3] -= p.opacityDecrease

            // Remove dead particles and return to pool
            p.live -= deltaTime
            if (p.live <= 0 || p.color[3] <= 0 || p.scale[0] <= 0) {
                particlePool.release(p)
                continue
            }
        }

        // Update geometry buffers from active particles (forward iteration for correct indexing)
        const activeCount = particlePool.getActiveCount()
        for (let i = 0; i < activeCount; i++) {
            const p = activeParticles[i]
            
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

        // Tell Three.js to only render the active particles by setting draw range
        smokeGeometry.setDrawRange(0, activeCount)

        // Only update geometry if we have active particles
        if (activeCount > 0) {
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
    },
    
    /**
     * Triggers a backfire particle effect - shoots red/orange/yellow particles backward
     * Effect lasts for approximately 0.5 seconds then returns to normal smoke
     * @param {number} [duration=0.5] - Optional duration override in seconds
     */
    triggerBackfire: (duration = 0.5) => {
        particleSystem.backfireActive = true
        particleSystem.backfireElapsed = 0
        particleSystem.backfireDuration = duration
        console.log(`🔥 Backfire triggered (${duration}s)`)
    }
}