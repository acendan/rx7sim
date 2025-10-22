import * as THREE from 'three'

const smokeParticles = []
const smokeGeometry = new THREE.BufferGeometry()
const smokePositions = new Float32Array(1000 * 3) // Max 1000 particles, xyz positions
const smokeColors = new Float32Array(1000 * 4) // RGBA colors
const smokeSizes = new Float32Array(1000) // Particle sizes

smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3))
smokeGeometry.setAttribute('color', new THREE.BufferAttribute(smokeColors, 4))
smokeGeometry.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1))

const smokeMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
})

const smokePoints = new THREE.Points(smokeGeometry, smokeMaterial)

export const particleSystem = {
    emitters: [],
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
                color_from: [0.9,0.9,0.9],
                color_to: [0.5,0.5,0.5],
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
    update: (deltaTime, engineState) => {
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

                while(add--) {
                    // Create new particle
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

                    smokeParticles.push({
                        offset: [x_1, emitter.position.y, z_1],
                        scale: [emitter.settings.scale_from, emitter.settings.scale_from],
                        quaternion: [direction.x, direction.y, direction.z, 3],
                        rotation: Math.random() * (emitter.settings.rotation_to - emitter.settings.rotation_from) + emitter.settings.rotation_from,
                        color: [1, 1, 1, emitter.settings.opacity],
                        blend: emitter.settings.blend,
                        texture: emitter.settings.texture,
                        live: Math.random() * (emitter.settings.live_time_to - emitter.settings.live_time_from) + emitter.settings.live_time_from,
                        scale_increase: emitter.settings.scale_increase,
                        opacity_decrease: emitter.settings.opacity_decrease,
                        color_from: emitter.settings.color_from.map(c => c * brightness),
                        color_to: emitter.settings.color_to.map(c => c * brightness),
                        color_speed: Math.random() * (emitter.settings.color_speed_to - emitter.settings.color_speed_from) + emitter.settings.color_speed_from,
                        color_pr: 0
                    })
                }
            }
        });

        // Update existing particles
        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            const p = smokeParticles[i]
            
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
            
            // Remove dead particles
            p.live -= deltaTime
            if (p.live <= 0 || p.color[3] <= 0) {
                smokeParticles.splice(i, 1)
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

        // Update geometry attributes
        smokeGeometry.attributes.position.needsUpdate = true
        smokeGeometry.attributes.color.needsUpdate = true
        smokeGeometry.attributes.size.needsUpdate = true
    },
    getMesh: () => {
        return smokePoints
    }
}