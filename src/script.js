import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { HDRCubeTextureLoader  } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js'
import * as dat from 'lil-gui'

THREE.ColorManagement.enabled = false

import { DriveState, SoloState, SoloBtnColors, EmitterVolMults, ConeEmitterSettings, LightingDefaults } from './systems/constants.js'
import { colorToHex } from './systems/helpers.js'
var driveState = DriveState.STOP
var soloState = SoloState.MIX

import { particleSystem } from './systems/exhaust.js'
import { createDirectionalLights, createHeadlightSpots, playPositionalAudio, createLineButton, createAudioEmitterDebugger } from './systems/helpers.js'
import { createMixer } from './systems/meters.js'

/**
 * Setup
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.FogExp2(0xefd1b5, 0.05);

// Debug
const dbg = new dat.GUI()

const dbgAudioSettings = {
    'Meters': true,
    'Emitters': false
}
const dbgAudio = dbg.addFolder('Audio')
let dbgAudioReverb = null
let dbgAudioMeters = null
let dbgAudioEmitters = null
let dbgAudioMicPersp = null

const dbgVehicle = dbg.addFolder('Vehicle')
let dbgVehCarSelect = null
let dbgVehIgnOn = null
let dbgVehIgnOff = null

// Axes
// const axes = new THREE.AxesHelper(1)
// axes.visible = false
// scene.add(axes)
// dbgUtils.add(axes, 'visible').name('Axes')

// Loaders
const gltfLoader = new GLTFLoader()
const audioLoader = new THREE.AudioLoader()
const rgbeLoader = new RGBELoader()
const hdrCubeLoader = new HDRCubeTextureLoader()

/**
 * Floor
 */
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
        color: '#444444',
        metalness: 0,
        roughness: 0.5
    })
)
floor.receiveShadow = true
floor.rotation.x = - Math.PI * 0.5
scene.add(floor)

/**
 * HDRIs
 */

const hdris = {
    'Garage': {
        path: './hdri/garage.hdr',
        reverb: 'Parking Garage',
        lighting: {
            ambient: { color: 0xf0f0f0, intensity: 0.2 },
            hemisphere: { skyColor: 0xc0c0c0, groundColor: 0x3a3a3a, intensity: 0.15 },
            directional: [
                { color: 0xbcd4ff, intensity: 1.5 },
                { color: 0xffddaa, intensity: 0.5 },
                { color: 0x888888, intensity: 0.1 }
            ]
        }
    },
    'Track': {
        path: './hdri/track.hdr',
        reverb: 'Parking Garage',
        lighting: {
            ambient: { color: 0xfff693, intensity: 0.25 },
            hemisphere: { skyColor: 0xcce6ff, groundColor: 0x5a5a5a, intensity: 0.15 },
            directional: [
                { color: 0xffffff, intensity: 0.1 },
                { color: 0xfff2d1, intensity: 0.1 },
                { color: 0xaaccff, intensity: 0.0 }
            ]
        }
    }
}

// Keep reference to the original background so "None" can restore it
const originalBackground = scene.background ? scene.background.clone() : new THREE.Color(0xa0a0a0)
let currentHDRTexture = null

const hdrOptions = ['None', ...Object.keys(hdris)]
const hdrParams = { HDR: 'None' }
dbg.add(hdrParams, 'HDR', hdrOptions).name('Level').onChange(name => {
    if (name === 'None') {
        // Dispose previously loaded HDR texture and restore defaults
        if (currentHDRTexture) {
            try { currentHDRTexture.dispose() } catch (_) {}
            currentHDRTexture = null
        }
        scene.background = originalBackground.clone ? originalBackground.clone() : originalBackground
        scene.environment = null
        floor.visible = true

        // Reset lighting & atmospheric settings
        applyLightingOverride(null)
        if (scene.fog) {
            scene.fog.color.set(0xefd1b5)
            scene.fog.density = 0.05
        }
        if (typeof renderer.toneMappingExposure === 'number') renderer.toneMappingExposure = baseLightingSnapshot.exposure

        // Force material refresh (remove stale env-dependent shader variants)
        scene.traverse(obj => {
            if (obj.isMesh && obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.needsUpdate = true)
                else obj.material.needsUpdate = true
            }
        })

        // Debug log comparison
        console.log('[HDR Reset] Ambient', ambientLight.intensity, ambientLight.color.getHexString())
        directionalLights.forEach((dl,i)=>console.log(`[HDR Reset] Dir${i}`, dl.intensity, dl.color.getHexString()))
        console.log('[HDR Reset] Hemi', hemiLight.intensity, hemiLight.color.getHexString(), hemiLight.groundColor.getHexString())

        // Remove reverb
        soundEngine.removeConvolutionReverb()
        reverbParams.Reverb = 'None'
        if (dbgAudioReverb) {
            dbgAudioReverb.updateDisplay()
        }

        return
    }

    const preset = hdris[name]
    if (!preset) return
    
    // Handle both old string format and new object format
    const path = typeof preset === 'string' ? preset : preset.path
    const reverbPreset = typeof preset === 'object' ? preset.reverb : null

    rgbeLoader.load(path, (texture) => {
        // Dispose previous texture if any
        if (currentHDRTexture) {
            try { currentHDRTexture.dispose() } catch (_) {}
        }

        texture.mapping = THREE.EquirectangularReflectionMapping
        currentHDRTexture = texture

        scene.background = texture
        scene.environment = texture

        // Hide floor when HDRI is active
        floor.visible = false

        // Apply lighting override if provided
        if (preset.lighting) {
            applyLightingOverride(preset.lighting)
        }

        // Auto-select associated reverb if specified
        if (reverbPreset && reverbParams) {
            reverbParams.Reverb = reverbPreset
            // Trigger reverb load by finding and calling the controller's onChange
            if (dbgAudioReverb) {
                dbgAudioReverb.updateDisplay()
                // Manually trigger the reverb loading logic
                const reverbMapEntry = reverbMap[reverbPreset]
                if (reverbMapEntry) {
                    const { path: reverbPath, blend = 0.5 } = reverbMapEntry
                    soundEngine.currentReverbBlend = blend
                    const reverbLoader = new THREE.AudioLoader()
                    reverbLoader.load(reverbPath, (buffer) => {
                        soundEngine.applyConvolutionReverb(buffer)
                    })
                }
            }
        }
    })
})


/**
 * Objects
 */
let carGroup = new THREE.Group()
scene.add(carGroup)
carGroup.add(particleSystem.getMesh())

// Line buttons: will be created after car model loads; store them here
const lineButtons = []

// Animation mixers and actions
let anims = {
    // Wheels
    mixerWheels: null,
    actWheelsRot: null, actTiresRot: null,

    // Lights
    mixerLights: null,
    actLights0: null, actLights1: null, actLights2: null, actLights3: null, actLights4: null,
    headLightL: null, headLightR: null,
    lightsFlipFlop: true,
    lightsIntensity: 3.0,
    lightsTimeScaleToggle: () => {
        if (anims.lightsFlipFlop) {
            anims.mixerLights.timeScale = 1.5
            for (let i = 0; i < 5; i++) {
                const key = `actLights${i}`
                anims[key].time = 0
            }
            anims.lightsFlipFlop = false
        } else {
            anims.mixerLights.timeScale = -1.5
            for (let i = 0; i < 5; i++) {
                const key = `actLights${i}`
                anims[key].time = anims[key].getClip().duration - anims[key].time
            }
            anims.lightsFlipFlop = true
        }
    },
    lights: () => { anims.mixerLights.stopAllAction(), anims.lightsTimeScaleToggle(), anims.actLights0.play(), anims.actLights1.play(), anims.actLights2.play(), anims.actLights3.play(), anims.actLights4.play() }
}

// Car
gltfLoader.load('./model/rx7/rx7.gltf',
    (gltfCar) => {
        console.log("Loaded Model - RX7", gltfCar)

        gltfCar.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfCar.scene)
        particleSystem.initialize()

        // Solo buttons
        let intakeSoloBtn, exhaustSoloBtn, interiorSoloBtn
        intakeSoloBtn = createLineButton({ screenAnchor: new THREE.Vector2(-0.5, -0.8), targetLocalPos: new THREE.Vector3(0, 0.2, 2.1), targetObject: gltfCar.scene, label: 'Intake', color: SoloBtnColors.INTAKE })
        exhaustSoloBtn = createLineButton({ screenAnchor: new THREE.Vector2(0.5, -0.8), targetLocalPos: new THREE.Vector3(-0.5, 0.3, -2.0), targetObject: gltfCar.scene, label: 'Exhaust', color: SoloBtnColors.EXHAUST })
        interiorSoloBtn = createLineButton({ screenAnchor: new THREE.Vector2(0.0, -0.8), targetLocalPos: new THREE.Vector3(0.0, 0.1, -0.2), targetObject: gltfCar.scene, label: 'Interior', color: SoloBtnColors.INTERIOR })

            // Add lines to scene and store buttons for updates
            ;[intakeSoloBtn, exhaustSoloBtn, interiorSoloBtn].forEach(btn => {
                scene.add(btn.line)
                lineButtons.push(btn)

                // Solo button click event
                btn.button.addEventListener('click', () => {
                    // Clicked same button again: reset to no solo
                    if (SoloState[btn.button.textContent.toUpperCase()] === soloState) {
                        soloState = SoloState.MIX

                        // Reset all button styles
                        lineButtons.forEach(otherBtn => {
                            if (otherBtn !== btn) {
                                otherBtn.button.style.backgroundColor = colorToHex(SoloBtnColors[otherBtn.button.textContent.toUpperCase()])
                                otherBtn.button.style.color = `#272727ff`
                                otherBtn.line.visible = true
                                otherBtn.button.dimmed = false
                            }
                        })

                        // If emitter debuggers are visible, ensure emitterDebuggers are all visible
                        if (dbgAudioSettings['Emitters']) {
                            emitterDebuggers.forEach(helper => helper.visible = true)
                        }

                    } else {
                        // New solo button selected
                        soloState = SoloState[btn.button.textContent.toUpperCase()]

                        // Darken background color of other buttons
                        lineButtons.forEach(otherBtn => {
                            if (otherBtn !== btn) {
                                otherBtn.button.style.backgroundColor = `#444444`
                                otherBtn.button.style.color = `#888888`
                                otherBtn.line.visible = false
                                otherBtn.button.dimmed = true

                                // If emitter debuggers are visible, hide non-solo emitter debuggers
                                if (dbgAudioSettings['Emitters']) {
                                    const posKey = otherBtn.button.textContent.toLowerCase()
                                    const helper = emitterDebuggers.get(posKey)
                                    if (helper) helper.visible = false
                                }
                            } else {
                                otherBtn.button.style.color = `#272727ff`
                                otherBtn.line.visible = true
                                otherBtn.button.dimmed = false

                                // If emitter debuggers are visible, ensure this one is visible
                                if (dbgAudioSettings['Emitters']) {
                                    const posKey = otherBtn.button.textContent.toLowerCase()
                                    const helper = emitterDebuggers.get(posKey)
                                    if (helper) helper.visible = true
                                }
                            }
                        })
                    }
                })
            })

        // Line button visibility
        const buttonVisibility = { 'Solo Buttons': true }
        dbgAudioMicPersp = dbgAudio.add(buttonVisibility, 'Solo Buttons').onChange(visible => {
            intakeSoloBtn.setVisible(visible)
            exhaustSoloBtn.setVisible(visible)
            interiorSoloBtn.setVisible(visible)
        })
    }
)

// Wheels
gltfLoader.load('./model/rx7_wheels/rx7_wheels.gltf',
    (wheelRL) => {
        console.log("Loaded Model - Wheel", wheelRL)

        // Rear left
        wheelRL.scene.scale.set(1.0, 1.0, 1.0)
        wheelRL.scene.position.set(0, 0, 0)
        carGroup.add(wheelRL.scene)

        // Front left
        const wheelFL = wheelRL.scene.clone()
        wheelFL.position.set(0, 0, 2.45)
        carGroup.add(wheelFL)

        // Front right
        const wheelFR = wheelRL.scene.clone()
        wheelFR.position.set(0, 0, 2.45)
        wheelFR.scale.set(-1, 1, 1)
        carGroup.add(wheelFR)

        // Rear right
        const wheelRR = wheelRL.scene.clone()
        wheelRR.position.set(0, 0, 0)
        wheelRR.scale.set(-1, 1, 1)
        carGroup.add(wheelRR)

        // Wheel anims
        anims.mixerWheels = new THREE.AnimationMixer(new THREE.AnimationObjectGroup(wheelRL.scene, wheelFL, wheelFR, wheelRR))
        anims.actWheelsRot = anims.mixerWheels.clipAction(wheelRL.animations[0]) // Wheel rotation
        anims.actTiresRot = anims.mixerWheels.clipAction(wheelRL.animations[1]) // Tire rotation
    }
)

// Headlights
gltfLoader.load('./model/rx7_lights/rx7_lights.gltf',
    (gltfLights) => {
        console.log("Loaded Model - Headlights", gltfLights)

        gltfLights.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfLights.scene)

        // Animations
        anims.mixerLights = new THREE.AnimationMixer(gltfLights.scene)
        for (let i = 0; i < 5; i++) {
            const key = `actLights${i}`
            anims[key] = anims.mixerLights.clipAction(gltfLights.animations[i])
            anims[key].setLoop(THREE.LoopOnce)
            anims[key].clampWhenFinished = true
        }

        // Spotlights
        const { left: headLightL, right: headLightR } = createHeadlightSpots({ intensity: anims.lightsIntensity })
        anims.headLightL = headLightL
        anims.headLightR = headLightR
        carGroup.add(anims.headLightL)
        carGroup.add(anims.headLightL.target)
        carGroup.add(anims.headLightR)
        carGroup.add(anims.headLightR.target)

        // Dbg
        dbgVehicle.add(anims, 'lights').name('Headlights')
    }
)


/**
 * Lighting (uses defaults from constants)
 */
const hemiLight = new THREE.HemisphereLight(
    LightingDefaults.hemisphere.skyColor,
    LightingDefaults.hemisphere.groundColor,
    LightingDefaults.hemisphere.intensity
)
hemiLight.position.set(0, 100, 0)
scene.add(hemiLight)

const ambientLight = new THREE.AmbientLight(
    LightingDefaults.ambient.color,
    LightingDefaults.ambient.intensity
)
scene.add(ambientLight)

const directionalLights = createDirectionalLights([
    { color: LightingDefaults.directional[0].color, intensity: LightingDefaults.directional[0].intensity, position: [5, 3, 4] },
    { color: LightingDefaults.directional[1].color, intensity: LightingDefaults.directional[1].intensity, position: [8, 3, -1] },
    { color: LightingDefaults.directional[2].color, intensity: LightingDefaults.directional[2].intensity, position: [-5, 5, -5] }
])
directionalLights.forEach(l => scene.add(l))

// Baseline lighting snapshot (built after renderer init)
let baseLightingSnapshot = null
function buildLightingSnapshot() {
    baseLightingSnapshot = {
        ambient: { color: ambientLight.color.getHex(), intensity: ambientLight.intensity },
        hemi: { sky: hemiLight.color.getHex(), ground: hemiLight.groundColor.getHex(), intensity: hemiLight.intensity },
        directional: directionalLights.map(dl => ({ color: dl.color.getHex(), intensity: dl.intensity })),
        fog: scene.fog ? { color: scene.fog.color.getHex(), density: scene.fog.density } : null,
        exposure: (typeof renderer !== 'undefined' && typeof renderer.toneMappingExposure === 'number') ? renderer.toneMappingExposure : 1.0
    }
}
function resetLightingFromSnapshot() {
    if (!baseLightingSnapshot) buildLightingSnapshot()
    ambientLight.color.setHex(baseLightingSnapshot.ambient.color)
    ambientLight.intensity = baseLightingSnapshot.ambient.intensity
    hemiLight.color.setHex(baseLightingSnapshot.hemi.sky)
    hemiLight.groundColor.setHex(baseLightingSnapshot.hemi.ground)
    hemiLight.intensity = baseLightingSnapshot.hemi.intensity
    directionalLights.forEach((dl,i) => {
        dl.color.setHex(baseLightingSnapshot.directional[i].color)
        dl.intensity = baseLightingSnapshot.directional[i].intensity
    })
    if (scene.fog && baseLightingSnapshot.fog) {
        scene.fog.color.setHex(baseLightingSnapshot.fog.color)
        scene.fog.density = baseLightingSnapshot.fog.density
    }
    if (baseLightingSnapshot && typeof renderer !== 'undefined' && typeof renderer.toneMappingExposure === 'number') {
        renderer.toneMappingExposure = baseLightingSnapshot.exposure
    }
}

function applyLightingOverride(override) {
    if (!override) {
        resetLightingFromSnapshot()
        return
    }
    if (override.ambient) {
        if (override.ambient.color !== undefined) ambientLight.color.setHex(override.ambient.color)
        if (override.ambient.intensity !== undefined) ambientLight.intensity = override.ambient.intensity
    }
    if (override.hemisphere) {
        if (override.hemisphere.skyColor !== undefined) hemiLight.color.setHex(override.hemisphere.skyColor)
        if (override.hemisphere.groundColor !== undefined) hemiLight.groundColor.setHex(override.hemisphere.groundColor)
        if (override.hemisphere.intensity !== undefined) hemiLight.intensity = override.hemisphere.intensity
    }
    if (override.directional && Array.isArray(override.directional)) {
        directionalLights.forEach((dl, i) => {
            const ov = override.directional[i]
            if (!ov) return
            if (ov.color !== undefined) dl.color.setHex(ov.color)
            if (ov.intensity !== undefined) dl.intensity = ov.intensity
        })
    }
}

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4, 2, 3)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Build baseline lighting snapshot now that renderer exists
buildLightingSnapshot()
resetLightingFromSnapshot()

/**
 * Audio
 */
// Listener
const listener = new THREE.AudioListener();
camera.add(listener);

// Audio emitters for each position
const audioEmitters = {
    mix: new THREE.PositionalAudio(listener),
    intake: new THREE.PositionalAudio(listener),
    exhaust: new THREE.PositionalAudio(listener),
    interior: new THREE.PositionalAudio(listener)
};

console.log("Audio Emitters:", audioEmitters);

// Add emitters to car at appropriate positions & starting volume
Object.entries(audioEmitters).forEach(([pos, emitter]) => {
    carGroup.add(emitter);
    switch (pos) {
        case 'intake':
            emitter.position.set(0, 0.2, 2.1); // Front of car
            emitter.setVolume(0);
            // Point intake sound forward (along +Z axis)
            emitter.setDirectionalCone(
                THREE.MathUtils.degToRad(ConeEmitterSettings.innerAngle), 
                THREE.MathUtils.degToRad(ConeEmitterSettings.outerAngle), 
                ConeEmitterSettings.outerGain
            );
            break;
        case 'exhaust':
            emitter.position.set(-0.5, 0.3, -2.0); // Rear of car
            emitter.setVolume(0);
            // Point exhaust sound backward (along -Z axis)
            // Rotate the emitter 180 degrees around Y axis to point backward
            emitter.rotation.y = Math.PI;
            emitter.setDirectionalCone(
                THREE.MathUtils.degToRad(ConeEmitterSettings.innerAngle), 
                THREE.MathUtils.degToRad(ConeEmitterSettings.outerAngle), 
                ConeEmitterSettings.outerGain
            );
            break;
        case 'interior':
            emitter.position.set(0.0, 0.5, -0.2); // Inside car
            emitter.setVolume(0);
            break;
        case 'mix':
            emitter.position.set(0, 0, 0); // Center for mix
            emitter.setVolume(1.0);
            break;
        default:
            emitter.position.set(0, 0, 0);
            break;
    }
});

const soundEngine = {
    // Buffer storage per position
    buffers: {
        mix: {},
        intake: { ignitionOn: null, idle: null, ignitionOff: null },
        exhaust: { ignitionOn: null, idle: null, ignitionOff: null },
        interior: { ignitionOn: null, idle: null, ignitionOff: null }
    },

    // Track current active emitter for smooth transitions
    currentEmitter: null,

    setEmitterVolumes(currSoloState) {
        // Get individual emitters (excluding mix)
        const individualEmitters = ['intake', 'exhaust', 'interior'];

        individualEmitters.forEach(pos => {
            const emitter = audioEmitters[pos];
            if (!emitter) return;

            // Base target volume (before global multiplier)
            const baseTarget = (currSoloState === SoloState.MIX)
                ? EmitterVolMults.MIX
                : (pos === currSoloState)
                    ? 1.0
                    : 0.0;

            // Apply global multiplier
            const multiplier = EmitterVolMults[pos.toUpperCase()] !== undefined ? EmitterVolMults[pos.toUpperCase()] : 1.0
            const targetVolume = Math.max(0, Math.min(1, baseTarget * multiplier))

            // Smooth volume transition
            const currentVol = emitter.getVolume();
            if (currentVol < targetVolume) {
                emitter.setVolume(Math.min(targetVolume, currentVol + 0.2));
            } else if (currentVol > targetVolume) {
                emitter.setVolume(Math.max(targetVolume, currentVol - 0.2));
            }
        });

        // Always keep mix emitter silent as we're creating our own mix
        audioEmitters.mix.setVolume(0);
    },

    ignitionOn: () => {
        // Start ignition for all positions
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            if (pos === 'mix') return; // No ignition sound for mix

            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/ignitionOn.ogg`, {
                store: soundEngine.buffers[pos],
                storeKey: 'ignitionOn',
                loop: false,
                onEnded: () => {
                    // After ignition sound ends, start engine idle loop for this position
                    playPositionalAudio(audioLoader, emitter, `./audio/${pos}/idle.ogg`, {
                        store: soundEngine.buffers[pos],
                        storeKey: 'idle',
                        loop: true,
                        onEnded: () => { }
                    });
                }
            });
        });

        driveState = DriveState.ACCEL;
        anims.mixerWheels.stopAllAction();
        anims.actWheelsRot.play();
        anims.actTiresRot.play();
        anims.mixerWheels.timeScale = 0.01;

        dbgVehIgnOn.hide();
        dbgVehIgnOff.show();
    },

    ignitionOff: () => {
        // Play ignition off for all positions
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            if (pos === 'mix') return; // No ignition sound for mix

            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/ignitionOff.ogg`, {
                store: soundEngine.buffers[pos],
                storeKey: 'ignitionOff',
                loop: false,
                onEnded: () => {
                    emitter.stop();
                }
            });
        });

        driveState = DriveState.DECEL;

        dbgVehIgnOn.show();
        dbgVehIgnOff.hide();
    },

    load() {
        // Cache buffers for all positions
        const engine = this; // Store reference to soundEngine
        Object.keys(engine.buffers).forEach(pos => {
            Object.keys(engine.buffers[pos]).forEach(key => {
                audioLoader.load(`./audio/${pos}/${key}.ogg`,
                    (buffer) => { engine.buffers[pos][key] = buffer });

                console.log(`Loaded Audio - ${pos}: ${key}`);
            });
        });
    },

    applyConvolutionReverb(reverbBuffer) {
        // Uses latest selected reverb name stored on soundEngine
        const blend = this.currentReverbBlend ?? 0.5
        Object.values(audioEmitters).forEach(emitter => {
            // Remove existing filter graph if present
            if (emitter._reverbNodes) {
                // Disconnect old nodes
                try {
                    const { dryGain, wetGain, convolver } = emitter._reverbNodes
                    dryGain.disconnect()
                    wetGain.disconnect()
                    convolver.disconnect()
                } catch(_) {}
                emitter._reverbNodes = null
            }

            const ctx = listener.context
            const convolver = ctx.createConvolver()
            convolver.buffer = reverbBuffer

            // Gain nodes for wet/dry mix; apply normalization to wet path only
            const fxScalingFactor = 0.33 // Lower overall level to avoid clipping when multiple emitters active
            const wetGain = ctx.createGain()
            const dryGain = ctx.createGain()
            wetGain.gain.value = blend * fxScalingFactor
            dryGain.gain.value = (1.0 - blend) * fxScalingFactor

            // PositionalAudio has .panner as its output prior to filters
            const sourceNode = emitter.panner
            if (!sourceNode) {
                console.warn('PositionalAudio panner node missing; cannot apply reverb graph')
                return
            }

            // Connect graph: source -> dryGain -> destination; source -> convolver -> wetGain -> destination
            sourceNode.connect(dryGain)
            dryGain.connect(ctx.destination)
            sourceNode.connect(convolver)
            convolver.connect(wetGain)
            wetGain.connect(ctx.destination)

            emitter._reverbNodes = { convolver, wetGain, dryGain }
        })
    },

    removeConvolutionReverb() {
        // Remove custom filter graph (disconnect reverb nodes)
        Object.values(audioEmitters).forEach(em => {
            if (em._reverbNodes) {
                try {
                    const { dryGain, wetGain, convolver } = em._reverbNodes
                    dryGain.disconnect(); wetGain.disconnect(); convolver.disconnect();
                } catch(_) {}
                em._reverbNodes = null
            }
        })
        this.currentReverbBlend = null
    }
}
soundEngine.load()

// Convolution reverb presets with blend (0..1 wet mix)
const reverbMap = {
    'Parking Garage': { path: './audio/ir/parkingGarage.ogg', blend: 0.6 }
}
const reverbParams = { Reverb: 'None' }
dbgAudioReverb = dbgAudio.add(reverbParams, 'Reverb', ['None', ...Object.keys(reverbMap)]).name('Conv. Reverb').onChange(name => {
    if (name === 'None') {
        soundEngine.removeConvolutionReverb()
        return
    }
    const preset = reverbMap[name]
    if (!preset) return
    const { path, blend = 0.5 } = preset
    soundEngine.currentReverbBlend = blend
    const reverbLoader = new THREE.AudioLoader()
    reverbLoader.load(path, (buffer) => {
        soundEngine.applyConvolutionReverb(buffer)
    })
})

// Add meters
const audioMeters = createMixer({ emitters: audioEmitters, initialVisible: true })
dbgAudioMeters = dbgAudio.add(dbgAudioSettings, 'Meters').onChange(v => audioMeters.setVisible(v))

// Create emitter position debuggers (initially hidden)
const emitterDebuggers = new Map()
Object.entries(audioEmitters).forEach(([pos, emitter]) => {
    if (pos === 'mix') return;
    
    // Configure helper based on emitter type
    const helperConfig = {
        color: SoloBtnColors[pos.toUpperCase()] || 0xffff00,
        size: 0.4
    }
    
    // Add cone visualization for directional emitters
    if (pos === 'intake') {
        helperConfig.showCone = true
        helperConfig.coneAngle = ConeEmitterSettings.innerAngle
        helperConfig.coneDirection = new THREE.Vector3(0, 0, 1) // Forward
    } else if (pos === 'exhaust') {
        helperConfig.showCone = true
        helperConfig.coneAngle = ConeEmitterSettings.innerAngle
        helperConfig.coneDirection = new THREE.Vector3(0, 0, -1) // Backward
    }
    
    const helper = createAudioEmitterDebugger(emitter, helperConfig)
    helper.visible = false
    carGroup.add(helper)
    emitterDebuggers.set(pos, helper)
})

// Add debug toggle for emitter position helpers
dbgAudioEmitters = dbgAudio.add(dbgAudioSettings, 'Emitters').onChange(v => {
    emitterDebuggers.forEach(helper => helper.visible = v)
})

/**
 * Debug
 */
const fakeListOfCars = ['Mazda RX-7 FD']
dbgVehCarSelect = dbgVehicle.add({ car: fakeListOfCars[0] }, 'car', fakeListOfCars).name('Car').onChange(v => {})
dbgVehIgnOn = dbgVehicle.add(soundEngine, 'ignitionOn').name('Ignition On')
dbgVehIgnOff = dbgVehicle.add(soundEngine, 'ignitionOff').name('Ignition Off').hide()

/**
 * Main
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    if (anims.mixerWheels) {
        anims.mixerWheels.update(deltaTime)

        switch (driveState) {
            case DriveState.ACCEL:
                while (anims.mixerWheels.timeScale < 1.0) {
                    anims.mixerWheels.timeScale += deltaTime // Gradually increase timeScale to 1.0
                    if (anims.mixerWheels.timeScale >= 1.0) {
                        anims.mixerWheels.timeScale = 1.0
                        driveState = DriveState.DRIVE
                    }
                }
                break
            case DriveState.DECEL:
                while (anims.mixerWheels.timeScale > 0.0) {
                    anims.mixerWheels.timeScale -= deltaTime // Gradually decrease timeScale to 0.0
                    if (anims.mixerWheels.timeScale <= 0.0) {
                        anims.mixerWheels.timeScale = 0.0
                        driveState = DriveState.STOP
                        anims.mixerWheels.stopAllAction()
                    }
                }
                break
            case DriveState.DRIVE:
                // Maintain static RPM sounds
                break
            case DriveState.STOP:
                // Play idle sounds
                break
            default:
                // Do nothing, maintain current timeScale
                break
        }
    }

    if (anims.mixerLights) {
        anims.mixerLights.update(deltaTime)

        // Set light intensity to headlight time animation progress
        const headLightsIntensity = anims.lightsIntensity - (anims.actLights0.time / anims.actLights0.getClip().duration) * anims.lightsIntensity
        anims.headLightL.intensity = anims.headLightR.intensity = headLightsIntensity
    }

    // Demo of car moving back and forth slightly
    // #TODO: Hunker car backwards/forwards under acceleration/deceleration
    carGroup.position.z = Math.sin(elapsedTime * 2) * 0.0125

    // Update particle system
    particleSystem.update(deltaTime, driveState)

    // Update controls
    controls.update()

    // Update line buttons so they stay anchored to screen and car
    if (lineButtons.length > 0) {
        lineButtons.forEach(btn => {
            try {
                btn.update(camera)
            } catch (e) {
                // Defensive: ignore update errors for now
            }
        })
    }

    // Update audio emitter volumes for smooth transitions
    soundEngine.setEmitterVolumes(soloState)

    audioMeters.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()