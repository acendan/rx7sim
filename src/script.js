/**
 * @fileoverview Main application entry point for rx7sim
 * Three.js-based 3D car visualization with spatial audio engine
 * Features positional audio with intake/exhaust/interior perspectives,
 * particle-based exhaust smoke, dynamic lighting, and HDR environments
 * @module script
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { HDRCubeTextureLoader  } from 'three/examples/jsm/loaders/HDRCubeTextureLoader.js'
import * as dat from 'lil-gui'

THREE.ColorManagement.enabled = false

import { DriveState, SoloState, SoloBtnColors, EmitterVolMults, ConeEmitterSettings, ThrottleMap, LightingDefaults, EnvironmentPresets } from './systems/constants.js'
import { colorToHex, disposeObject, disposeTexture, disposeAudioEmitter, disposeAudioAnalyser, checkWebGLSupport, checkWebAudioSupport, showErrorUI, showLoadingUI, loadGLTFModel, loadAudioFile, loadHDRTexture } from './systems/helpers.js'

/** @type {string} Current driving state (STOP, DRIVE, ACCEL, DECEL) */
var driveState = DriveState.STOP

/** @type {string} Current audio solo state (MIX, INTAKE, EXHAUST, INTERIOR) */
var soloState = SoloState.MIX

import { particleSystem } from './systems/exhaust.js'
import { createDirectionalLights, createHeadlightSpots, playPositionalAudio, createLineButton, createAudioEmitterDebugger } from './systems/helpers.js'
import { createMixer } from './systems/meters.js'
import { createControls } from './systems/controls.js'
import { createPerformanceMonitor } from './systems/stats.js'
import { resumeAudioContext } from './systems/helpers.js'

/**
 * Feature Detection & Browser Compatibility Check
 */
const webglCheck = checkWebGLSupport()
if (!webglCheck.available) {
    showErrorUI('WebGL Not Supported', webglCheck.error, true)
    throw new Error(webglCheck.error)
}

const audioCheck = checkWebAudioSupport()
if (!audioCheck.available) {
    showErrorUI('Web Audio Not Supported', audioCheck.error, true)
    throw new Error(audioCheck.error)
}

/**
 * Setup
 */
/**
 * Initialization state flags to prevent race conditions during async loading
 * @type {Object}
 * @property {boolean} modelsLoaded - Whether GLTF models have finished loading
 * @property {boolean} audioLoaded - Whether audio files have finished loading
 * @property {boolean} sceneReady - Whether the complete scene is ready for rendering
 */
const initState = {
    modelsLoaded: false,
    audioLoaded: false,
    sceneReady: false
}

/** @type {HTMLCanvasElement} Main WebGL canvas element */
const canvas = document.querySelector('canvas.webgl')

/** @type {THREE.Scene} Main Three.js scene */
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.FogExp2(0xefd1b5, 0.05);

/**
 * Debug UI controls using lil-gui
 */
/** @type {dat.GUI} Main debug GUI controller */
const dbg = new dat.GUI()

/** @type {Object} Audio debug settings */
const dbgAudioSettings = {
    'Meters': true,
    'Emitters': false
}
/** @type {dat.GUI} Audio folder in debug UI */
const dbgAudio = dbg.addFolder('Audio')
/** @type {dat.Controller|null} Reverb debug controller */
let dbgAudioReverb = null
/** @type {dat.Controller|null} Meters debug controller */
let dbgAudioMeters = null
/** @type {dat.Controller|null} Emitters debug controller */
let dbgAudioEmitters = null
/** @type {dat.Controller|null} Microphone perspective debug controller */
let dbgAudioMicPersp = null

/** @type {dat.GUI} Vehicle folder in debug UI */
const dbgVehicle = dbg.addFolder('Vehicle')
/** @type {dat.Controller|null} Level/environment selector */
let dbgVehLevelSelect = null
/** @type {dat.Controller|null} Car model selector */
let dbgVehCarSelect = null

/** @type {dat.GUI} Performance folder in debug UI */
const dbgPerformance = dbg.addFolder('Performance')
/** @type {Object} Performance debug settings */
const dbgPerfSettings = {
    'Show Stats': false
}
/** @type {dat.Controller|null} Stats display controller */
let dbgPerfStats = null

// Axes
// const axes = new THREE.AxesHelper(1)
// axes.visible = false
// scene.add(axes)
// dbgUtils.add(axes, 'visible').name('Axes')

/**
 * Asset loaders for models, audio, and HDR textures
 */
/** @type {GLTFLoader} Loader for GLTF/GLB 3D models */
const gltfLoader = new GLTFLoader()
/** @type {THREE.AudioLoader} Loader for audio files */
const audioLoader = new THREE.AudioLoader()
/** @type {RGBELoader} Loader for RGBE/HDR image files */
const rgbeLoader = new RGBELoader()
/** @type {HDRCubeTextureLoader} Loader for HDR cube map textures */
const hdrCubeLoader = new HDRCubeTextureLoader()

/**
 * Floor plane with shadow receiving
 * @type {THREE.Mesh}
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
 * HDR Environment Management
 */

/** @type {THREE.Color} Original scene background color to restore when HDR is disabled */
const originalBackground = scene.background ? scene.background.clone() : new THREE.Color(0xa0a0a0)

/** @type {THREE.DataTexture|null} Currently loaded HDR texture */
let currentHDRTexture = null

/** @type {Array<string>} Available HDR environment options */
const hdrOptions = ['None', ...Object.keys(EnvironmentPresets)]

/** @type {Object} Current HDR selection parameter */
const hdrParams = { HDR: 'None' }
dbgVehLevelSelect = dbgVehicle.add(hdrParams, 'HDR', hdrOptions).name('Level Select').onChange(name => {
    if (name === 'None') {
        // Dispose previously loaded HDR texture and restore defaults
        if (currentHDRTexture) {
            disposeTexture(currentHDRTexture)
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

    const preset = EnvironmentPresets[name]
    if (!preset) return
    
    const path = typeof preset === 'string' ? preset : preset.path
    const reverbPreset = typeof preset === 'object' ? preset.reverb : null

    loadHDRTexture(rgbeLoader, path).then((texture) => {
        if (currentHDRTexture) {
            disposeTexture(currentHDRTexture)
        }

        texture.mapping = THREE.EquirectangularReflectionMapping
        currentHDRTexture = texture

        scene.background = texture
        scene.environment = texture

        floor.visible = false

        if (preset.lighting) {
            applyLightingOverride(preset.lighting)
        }

        if (reverbPreset && reverbParams) {
            reverbParams.Reverb = reverbPreset
            if (dbgAudioReverb) {
                dbgAudioReverb.updateDisplay()
                const reverbMapEntry = reverbMap[reverbPreset]
                if (reverbMapEntry) {
                    const { path: reverbPath, blend = 0.5, scalingFactor = 1.0 } = reverbMapEntry
                    soundEngine.currentReverbBlend = blend
                    soundEngine.currentReverbScalingFactor = scalingFactor
                    loadAudioFile(new THREE.AudioLoader(), reverbPath).then((buffer) => {
                        soundEngine.applyConvolutionReverb(buffer)
                    }).catch(err => {
                        console.error('Failed to load reverb:', err)
                        showErrorUI('Reverb Load Failed', `Could not load reverb: ${err.message}`, false)
                    })
                }
            }
        }
    }).catch(err => {
        console.error('Failed to load HDR:', err)
        showErrorUI('HDR Load Failed', `Could not load environment: ${err.message}`, false)
    })
})


/**
 * 3D Objects & Models
 */

/** @type {THREE.Group} Main group container for car model and related objects */
let carGroup = new THREE.Group()
scene.add(carGroup)
carGroup.add(particleSystem.getMesh())

/** @type {Array<Object>} Collection of interactive line button UI elements */
const lineButtons = []

/**
 * Animation system
 * Central object managing all animation mixers and actions for wheels, lights, and headlights
 * @type {Object}
 * @property {THREE.AnimationMixer|null} mixerWheels - Animation mixer for wheel rotations
 * @property {THREE.AnimationAction|null} actWheelsRot - Wheel rotation animation action
 * @property {THREE.AnimationAction|null} actTiresRot - Tire rotation animation action
 * @property {THREE.AnimationMixer|null} mixerLights - Animation mixer for popup headlights
 * @property {THREE.AnimationAction|null} actLights0-4 - Individual light animation actions (5 total)
 * @property {THREE.SpotLight|null} headLightL - Left headlight spot light
 * @property {THREE.SpotLight|null} headLightR - Right headlight spot light
 * @property {boolean} lightsFlipFlop - State toggle for headlight animation direction
 * @property {number} lightsIntensity - Current headlight intensity multiplier
 * @property {function(): void} lightsTimeScaleToggle - Toggles headlight animation direction
 */
let anims = {
    mixerWheels: null,
    actWheelsRot: null, actTiresRot: null,

    mixerLights: null,
    actLights0: null, actLights1: null, actLights2: null, actLights3: null, actLights4: null,
    headLightL: null, headLightR: null,
    lightsFlipFlop: true,
    lightsIntensity: 3.0,
    lightsTimeScaleToggle: () => {
        if (!anims.mixerLights) return

        if (anims.lightsFlipFlop) {
            anims.mixerLights.timeScale = 1.5
            for (let i = 0; i < 5; i++) {
                const key = `actLights${i}`
                if (anims[key]) anims[key].time = 0
            }
            anims.lightsFlipFlop = false
        } else {
            anims.mixerLights.timeScale = -1.5
            for (let i = 0; i < 5; i++) {
                const key = `actLights${i}`
                if (anims[key]) anims[key].time = anims[key].getClip().duration - anims[key].time
            }
            anims.lightsFlipFlop = true
        }
    },
    lights: () => { 
        if (!anims.mixerLights) return
        
        anims.mixerLights.stopAllAction()
        anims.lightsTimeScaleToggle()
        if (anims.actLights0) anims.actLights0.play()
        if (anims.actLights1) anims.actLights1.play()
        if (anims.actLights2) anims.actLights2.play()
        if (anims.actLights3) anims.actLights3.play()
        if (anims.actLights4) anims.actLights4.play()
    }
}

/**
 * Asynchronously loads all 3D models (car, wheels, lights) with parallel loading
 * Sets up animations, headlights, and solo buttons after models are loaded
 * @async
 * @throws {Error} If any model fails to load
 */
async function initializeModels() {
    const loadingUI = showLoadingUI('Loading models...')
    
    try {
        loadingUI.update('Loading car model...')
        const [gltfCar, gltfWheels, gltfLights] = await Promise.all([
            loadGLTFModel(gltfLoader, './model/rx7/rx7.gltf'),
            loadGLTFModel(gltfLoader, './model/rx7_wheels/rx7_wheels.gltf'),
            loadGLTFModel(gltfLoader, './model/rx7_lights/rx7_lights.gltf')
        ])

        loadingUI.update('Setting up scene...')

        // Setup car
        gltfCar.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfCar.scene)
        particleSystem.initialize()

        // Setup wheels
        gltfWheels.scene.scale.set(1.0, 1.0, 1.0)
        gltfWheels.scene.position.set(0, 0, 0)
        carGroup.add(gltfWheels.scene)

        const wheelFL = gltfWheels.scene.clone()
        wheelFL.position.set(0, 0, 2.45)
        carGroup.add(wheelFL)

        const wheelFR = gltfWheels.scene.clone()
        wheelFR.position.set(0, 0, 2.45)
        wheelFR.scale.set(-1, 1, 1)
        carGroup.add(wheelFR)

        const wheelRR = gltfWheels.scene.clone()
        wheelRR.position.set(0, 0, 0)
        wheelRR.scale.set(-1, 1, 1)
        carGroup.add(wheelRR)

        anims.mixerWheels = new THREE.AnimationMixer(new THREE.AnimationObjectGroup(gltfWheels.scene, wheelFL, wheelFR, wheelRR))
        anims.actWheelsRot = anims.mixerWheels.clipAction(gltfWheels.animations[0])
        anims.actTiresRot = anims.mixerWheels.clipAction(gltfWheels.animations[1])

        gltfLights.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfLights.scene)

        anims.mixerLights = new THREE.AnimationMixer(gltfLights.scene)
        for (let i = 0; i < 5; i++) {
            const key = `actLights${i}`
            anims[key] = anims.mixerLights.clipAction(gltfLights.animations[i])
            anims[key].setLoop(THREE.LoopOnce)
            anims[key].clampWhenFinished = true
        }

        const { left: headLightL, right: headLightR } = createHeadlightSpots({ intensity: anims.lightsIntensity })
        anims.headLightL = headLightL
        anims.headLightR = headLightR
        carGroup.add(anims.headLightL)
        carGroup.add(anims.headLightL.target)
        carGroup.add(anims.headLightR)
        carGroup.add(anims.headLightR.target)

        setupSoloButtons(gltfCar.scene)

        initState.modelsLoaded = true

        loadingUI.remove()
        console.log('✓ All models loaded successfully')
    } catch (error) {
        loadingUI.remove()
        console.error('Failed to load models:', error)
        showErrorUI(
            'Failed to Load Models',
            `Could not load required 3D models. Please check your connection and refresh the page.\n\nError: ${error.message}`,
            false
        )
    }
}

/**
 * Creates interactive solo buttons for switching audio perspectives
 * Buttons connect screen UI to 3D positions on the car (intake, exhaust, interior)
 * @param {THREE.Object3D} carScene - The loaded car model to attach button targets to
 */
function setupSoloButtons(carScene) {
    const intakeSoloBtn = createLineButton({ 
        screenAnchor: new THREE.Vector2(-0.5, -0.8), 
        targetLocalPos: new THREE.Vector3(0, 0.2, 2.1), 
        targetObject: carScene, 
        label: 'Intake', 
        color: SoloBtnColors.INTAKE 
    })
    const exhaustSoloBtn = createLineButton({ 
        screenAnchor: new THREE.Vector2(0.5, -0.8), 
        targetLocalPos: new THREE.Vector3(-0.5, 0.3, -2.0), 
        targetObject: carScene, 
        label: 'Exhaust', 
        color: SoloBtnColors.EXHAUST 
    })
    const interiorSoloBtn = createLineButton({ 
        screenAnchor: new THREE.Vector2(0.0, -0.8), 
        targetLocalPos: new THREE.Vector3(0.0, 0.1, -0.2), 
        targetObject: carScene, 
        label: 'Interior', 
        color: SoloBtnColors.INTERIOR 
    })

    ;[intakeSoloBtn, exhaustSoloBtn, interiorSoloBtn].forEach(btn => {
        scene.add(btn.line)
        lineButtons.push(btn)

        btn.button.addEventListener('click', () => {
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
                soloState = SoloState[btn.button.textContent.toUpperCase()]

                lineButtons.forEach(otherBtn => {
                    if (otherBtn !== btn) {
                        otherBtn.button.style.backgroundColor = `#444444`
                        otherBtn.button.style.color = `#888888`
                        otherBtn.line.visible = false
                        otherBtn.button.dimmed = true

                        if (dbgAudioSettings['Emitters']) {
                            const posKey = otherBtn.button.textContent.toLowerCase()
                            const helper = emitterDebuggers.get(posKey)
                            if (helper) helper.visible = false
                        }
                    } else {
                        otherBtn.button.style.color = `#272727ff`
                        otherBtn.line.visible = true
                        otherBtn.button.dimmed = false

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

// Call the new async initialization
initializeModels().then(() => {
    // Check if everything is ready
    checkSceneReady()
}).catch(err => {
    console.error('Critical error during model initialization:', err)
})

/**
 * Checks if all async loading operations are complete and marks scene as ready
 * Called after models and audio finish loading
 */
function checkSceneReady() {
    if (initState.modelsLoaded && initState.audioLoaded && !initState.sceneReady) {
        initState.sceneReady = true
        console.log('✓ Scene fully initialized and ready')
    }
}

/**
 * Scene Lighting Setup
 * Uses default values from constants.js with support for environment-based overrides
 */

/** @type {THREE.HemisphereLight} Sky/ground hemisphere light */
const hemiLight = new THREE.HemisphereLight(
    LightingDefaults.hemisphere.skyColor,
    LightingDefaults.hemisphere.groundColor,
    LightingDefaults.hemisphere.intensity
)
hemiLight.position.set(0, 100, 0)
scene.add(hemiLight)

/** @type {THREE.AmbientLight} Global ambient illumination */
const ambientLight = new THREE.AmbientLight(
    LightingDefaults.ambient.color,
    LightingDefaults.ambient.intensity
)
scene.add(ambientLight)

/** @type {Array<THREE.DirectionalLight>} Array of directional shadow-casting lights */
const directionalLights = createDirectionalLights([
    { color: LightingDefaults.directional[0].color, intensity: LightingDefaults.directional[0].intensity, position: [5, 3, 4] },
    { color: LightingDefaults.directional[1].color, intensity: LightingDefaults.directional[1].intensity, position: [8, 3, -1] },
    { color: LightingDefaults.directional[2].color, intensity: LightingDefaults.directional[2].intensity, position: [-5, 5, -5] }
])
directionalLights.forEach(l => scene.add(l))

/**
 * Lighting snapshot system for environment-based lighting overrides
 * Captures baseline lighting state to enable reset after environment changes
 */

/** @type {Object|null} Snapshot of baseline lighting configuration */
let baseLightingSnapshot = null

/**
 * Captures current lighting state as baseline
 * Called after renderer initialization to include tone mapping exposure
 */
function buildLightingSnapshot() {
    baseLightingSnapshot = {
        ambient: { color: ambientLight.color.getHex(), intensity: ambientLight.intensity },
        hemi: { sky: hemiLight.color.getHex(), ground: hemiLight.groundColor.getHex(), intensity: hemiLight.intensity },
        directional: directionalLights.map(dl => ({ color: dl.color.getHex(), intensity: dl.intensity })),
        fog: scene.fog ? { color: scene.fog.color.getHex(), density: scene.fog.density } : null,
        exposure: (typeof renderer !== 'undefined' && typeof renderer.toneMappingExposure === 'number') ? renderer.toneMappingExposure : 1.0
    }
}

/**
 * Restores lighting to baseline snapshot state
 * Used when switching back from environment presets to default lighting
 */
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

/**
 * Applies environment-specific lighting override or resets to baseline
 * @param {Object|null} override - Lighting override configuration or null to reset
 * @param {Object} [override.ambient] - Ambient light overrides
 * @param {number} [override.ambient.color] - Ambient color as hex
 * @param {number} [override.ambient.intensity] - Ambient intensity
 * @param {Object} [override.hemisphere] - Hemisphere light overrides
 * @param {number} [override.hemisphere.skyColor] - Sky color as hex
 * @param {number} [override.hemisphere.groundColor] - Ground color as hex
 * @param {number} [override.hemisphere.intensity] - Hemisphere intensity
 * @param {Array<Object>} [override.directional] - Directional light overrides
 */
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
 * Viewport sizing and responsive handling
 */

/** @type {Object} Current viewport dimensions */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

/**
 * Handles window resize events
 * Updates camera aspect ratio, renderer size, and pixel ratio
 */
const handleResize = () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

window.addEventListener('resize', handleResize)

/**
 * Camera and Controls
 */

/** @type {THREE.PerspectiveCamera} Main perspective camera */
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(4, 2, 3)
scene.add(camera)

/** @type {OrbitControls} Orbit camera controls with damping */
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
controls.enableDamping = true

/**
 * WebGL Renderer
 * Configured with shadow mapping and linear color space
 */

/** @type {THREE.WebGLRenderer} Main WebGL renderer */
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
 * Spatial Audio System
 * Web Audio API-based positional audio with directional cones for intake/exhaust
 */

/** @type {THREE.AudioListener} Main audio listener attached to camera */
const listener = new THREE.AudioListener();
camera.add(listener);

/** @type {AudioContext} Web Audio API context */
const audioContext = listener.context

/** @type {boolean} Audio enabled state flag */
let audioEnabled = false

/**
 * Positional audio emitters for different microphone perspectives
 * @type {Object<string, THREE.PositionalAudio>}
 * @property {THREE.PositionalAudio} mix - Mix perspective (unused, legacy)
 * @property {THREE.PositionalAudio} intake - Intake microphone position (front of car)
 * @property {THREE.PositionalAudio} exhaust - Exhaust microphone position (rear of car)
 * @property {THREE.PositionalAudio} interior - Interior microphone position (inside cabin)
 */
const audioEmitters = {
    mix: new THREE.PositionalAudio(listener),
    intake: new THREE.PositionalAudio(listener),
    exhaust: new THREE.PositionalAudio(listener),
    interior: new THREE.PositionalAudio(listener)
};

console.log("Audio Emitters:", audioEmitters);

Object.entries(audioEmitters).forEach(([pos, emitter]) => {
    carGroup.add(emitter);
    switch (pos) {
        case 'intake':
            emitter.position.set(0, 0.2, 2.1);
            emitter.setVolume(0);
            emitter.setDirectionalCone(
                THREE.MathUtils.degToRad(ConeEmitterSettings.innerAngle), 
                THREE.MathUtils.degToRad(ConeEmitterSettings.outerAngle), 
                ConeEmitterSettings.outerGain
            );
            break;
        case 'exhaust':
            emitter.position.set(-0.5, 0.3, -2.0);
            emitter.setVolume(0);
            emitter.rotation.y = Math.PI;
            emitter.setDirectionalCone(
                THREE.MathUtils.degToRad(ConeEmitterSettings.innerAngle), 
                THREE.MathUtils.degToRad(ConeEmitterSettings.outerAngle), 
                ConeEmitterSettings.outerGain
            );
            break;
        case 'interior':
            emitter.position.set(0.0, 0.5, -0.2);
            emitter.setVolume(0);
            break;
        case 'mix':
            emitter.position.set(0, 0, 0);
            emitter.setVolume(1.0);
            break;
        default:
            emitter.position.set(0, 0, 0);
            break;
    }
});

/**
 * Sound engine - manages audio playback, buffers, and state transitions
 * Handles ignition sequences, emitter volume mixing, and convolution reverb
 * @type {Object}
 */
const soundEngine = {
    /**
     * Audio buffer storage organized by microphone position and sound type
     * @type {Object<string, Object<string, AudioBuffer>>}
     */
    buffers: {
        mix: {},
        intake: { ignitionOn: null, idle: null, ignitionOff: null, revShort: null, revMedium: null, revLong: null },
        exhaust: { ignitionOn: null, idle: null, ignitionOff: null, revShort: null, revMedium: null, revLong: null },
        interior: { ignitionOn: null, idle: null, ignitionOff: null, revShort: null, revMedium: null, revLong: null }
    },

    /** @type {THREE.PositionalAudio|null} Currently active audio emitter */
    currentEmitter: null,

    /**
     * Sets volume levels for all positional audio emitters based on solo state
     * Handles smooth volume transitions and applies global multipliers from constants
     * @param {string} currSoloState - Current solo state (MIX, INTAKE, EXHAUST, INTERIOR)
     */
    setEmitterVolumes(currSoloState) {
        const individualEmitters = ['intake', 'exhaust', 'interior'];

        individualEmitters.forEach(pos => {
            const emitter = audioEmitters[pos];
            if (!emitter) return;

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

        audioEmitters.mix.setVolume(0);
    },

    /**
     * Transitions to engine idle (for use after ignition, revs, etc.)
     */
    idle: (audioLoader, emitter, pos) => {
        playPositionalAudio(audioLoader, emitter, `./audio/${pos}/idle.ogg`, {
            store: soundEngine.buffers[pos],
            storeKey: 'idle',
            loop: true,
            onEnded: () => { }
        });
    },

    /**
     * Starts engine ignition sequence across all audio emitters
     * Resumes audio context on first user interaction (handles browser autoplay policy)
     * Plays ignition sound followed by idle loop, starts wheel animations
     */
    ignitionOn: () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                audioEnabled = true
                console.log('Audio context enabled via user interaction')
            }).catch(err => {
                console.error('Failed to resume audio context:', err)
            })
        }

        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            if (pos === 'mix') return;

            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/ignitionOn.ogg`, {
                store: soundEngine.buffers[pos],
                storeKey: 'ignitionOn',
                loop: false,
                onEnded: () => {
                    soundEngine.idle(audioLoader, emitter, pos);
                }
            });
        });

        driveState = DriveState.ACCEL;
        
        if (anims.mixerWheels) {
            anims.mixerWheels.stopAllAction();
            anims.actWheelsRot.play();
            anims.actTiresRot.play();
            anims.mixerWheels.timeScale = 0.01;
        }
    },

    /**
     * Stops engine and plays ignition off sequence
     * Triggers shutdown sound then stops all audio playback
     */
    ignitionOff: () => {
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            if (pos === 'mix') return;

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
    },

    /**
     * Revs engine based on throttle input duration
     * @param {number} duration - The duration the throttle is pressed
     */
    revEngine(duration) {
        const revType = duration >= ThrottleMap.long ? 'revLong' : duration >= ThrottleMap.medium ? 'revMedium' : 'revShort';
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            if (pos === 'mix') return;

            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/${revType}.ogg`, {
                store: soundEngine.buffers[pos],
                storeKey: revType,
                loop: false,
                onEnded: () => {
                    soundEngine.idle(audioLoader, emitter, pos);
                }
            });
        });
    },

    /**
     * Preloads all audio files into buffers
     * Caches audio for ignitionOn, idle, and ignitionOff for each microphone position
     * Updates initialization state when complete
     */
    load() {
        const engine = this
        const loadPromises = []
        
        Object.keys(engine.buffers).forEach(pos => {
            Object.keys(engine.buffers[pos]).forEach(key => {
                const promise = loadAudioFile(audioLoader, `./audio/${pos}/${key}.ogg`)
                    .then(buffer => {
                        engine.buffers[pos][key] = buffer
                    })
                    .catch(err => {
                        console.error(`Failed to load audio ${pos}/${key}:`, err)
                })
                loadPromises.push(promise)
            })
        })

        Promise.all(loadPromises).then(() => {
            initState.audioLoaded = true
            console.log('✓ All audio files loaded')
            checkSceneReady()
        }).catch(() => {
            initState.audioLoaded = true
            showErrorUI(
                'Audio Load Warning',
                'Some audio files failed to load. The experience may be incomplete.',
                false
            )
            checkSceneReady()
        })
    },

    /**
     * Applies convolution reverb to all audio emitters with wet/dry mixing
     * Creates parallel signal path: dry gain + (convolver -> wet gain)
     * @param {AudioBuffer} reverbBuffer - Impulse response buffer for convolution
     */
    applyConvolutionReverb(reverbBuffer) {
        const blend = this.currentReverbBlend ?? 0.5
        Object.values(audioEmitters).forEach(emitter => {
            if (emitter._reverbNodes) {
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

            const wetGain = ctx.createGain()
            const dryGain = ctx.createGain()
            wetGain.gain.value = blend * this.currentReverbScalingFactor
            dryGain.gain.value = (1.0 - blend) * this.currentReverbScalingFactor

            const sourceNode = emitter.panner
            if (!sourceNode) {
                console.warn('PositionalAudio panner node missing; cannot apply reverb graph')
                return
            }

            sourceNode.connect(dryGain)
            dryGain.connect(ctx.destination)
            sourceNode.connect(convolver)
            convolver.connect(wetGain)
            wetGain.connect(ctx.destination)

            emitter._reverbNodes = { convolver, wetGain, dryGain }
        })
    },

    /**
     * Removes convolution reverb by disconnecting custom filter graph
     * Restores direct audio path without reverb processing
     */
    removeConvolutionReverb() {
        Object.values(audioEmitters).forEach(em => {
            if (em._reverbNodes) {
                try {
                    const { dryGain, wetGain, convolver } = em._reverbNodes
                    dryGain.disconnect()
                    wetGain.disconnect()
                    convolver.disconnect()
                } catch (err) {
                    console.warn('Error disconnecting reverb nodes:', err)
                }
                em._reverbNodes = null
            }
        })
        this.currentReverbBlend = null
        this.currentReverbScalingFactor = null
    }
}
soundEngine.load()

/**
 * Convolution Reverb Configuration
 * Maps reverb preset names to impulse response files with wet/dry blend and scaling
 */

/** @type {Object<string, Object>} Reverb preset definitions */
const reverbMap = {
    'Garage': { path: './audio/ir/garage.ogg', blend: 0.8, scalingFactor: 0.33 },
    'Outdoors': { path: './audio/ir/outdoors.ogg', blend: 0.6, scalingFactor: 0.2 }
}

/** @type {Object} Current reverb selection parameter */
const reverbParams = { Reverb: 'None' }
dbgAudioReverb = dbgAudio.add(reverbParams, 'Reverb', ['None', ...Object.keys(reverbMap)]).name('Conv. Reverb').onChange(name => {
    if (name === 'None') {
        soundEngine.removeConvolutionReverb()
        return
    }
    const preset = reverbMap[name]
    if (!preset) return
    const { path, blend = 0.5, scalingFactor = 1.0 } = preset
    soundEngine.currentReverbBlend = blend
    soundEngine.currentReverbScalingFactor = scalingFactor
    loadAudioFile(new THREE.AudioLoader(), path).then((buffer) => {
        soundEngine.applyConvolutionReverb(buffer)
    }).catch(err => {
        console.error('Failed to load reverb:', err)
        showErrorUI('Reverb Load Failed', `Could not load reverb preset: ${err.message}`, false)
    })
})

/** @type {Object} Ignition and other controls */
const controlsPanel = createControls({ initVisible: true, initIgnition: false, initHeadlights: true })
// Subscribe to ignition button press event in controls panel
controlsPanel.registerIgnitionCallback((ignitionOn) => {
    console.log('Ignition:', ignitionOn ? 'ON' : 'OFF')
    if (ignitionOn) {
        soundEngine.ignitionOn()
    } else {
        soundEngine.ignitionOff()
    }
})
controlsPanel.registerHeadlightsCallback((headlightsOn) => {
    console.log('Headlights:', headlightsOn ? 'ON' : 'OFF')
    anims.lights()
})
controlsPanel.registerThrottleCallback((duration) => {
    console.log('Throttle pressed:', duration, 'ms', duration >= ThrottleMap.long ? '(Long)' : duration >= ThrottleMap.medium ? '(Medium)' : '(Short)')
    soundEngine.revEngine(duration)
})
console.log('Controls panel created', controlsPanel)

/** @type {Object} Audio volume meter system */
const audioMeters = createMixer({ emitters: audioEmitters, initialVisible: true })
dbgAudioMeters = dbgAudio.add(dbgAudioSettings, 'Meters').onChange(v => audioMeters.setVisible(v))

/** @type {Object} Performance monitoring system (FPS, frame time) */
const perfMonitor = createPerformanceMonitor({ initialVisible: false })
dbgPerfStats = dbgPerformance.add(dbgPerfSettings, 'Show Stats').onChange(v => perfMonitor.setVisible(v))

/**
 * Audio Emitter Debug Visualizers
 * Creates 3D helpers showing emitter positions and directional cones
 */

/** @type {Map<string, THREE.Group>} Map of emitter position helpers */
const emitterDebuggers = new Map()
Object.entries(audioEmitters).forEach(([pos, emitter]) => {
    if (pos === 'mix') return;
    
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

dbgAudioEmitters = dbgAudio.add(dbgAudioSettings, 'Emitters').onChange(v => {
    emitterDebuggers.forEach(helper => helper.visible = v)
})

/**
 * Vehicle Debug Controls
 */

/** @type {Array<string>} Available car models (currently only RX-7) */
const fakeListOfCars = ['Mazda RX-7 FD']
dbgVehCarSelect = dbgVehicle.add({ car: fakeListOfCars[0] }, 'car', fakeListOfCars).name('Car').onChange(v => {})

/**
 * Resource Cleanup & Disposal
 * Properly cleans up all Three.js objects, audio nodes, and event listeners
 */

/**
 * Disposes all application resources
 * Called on page unload or when resetting the scene
 * Prevents memory leaks by cleaning up geometries, materials, textures, and audio nodes
 */
function disposeAll() {
    console.log('Cleaning up resources...')

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
    }

    lineButtons.forEach(btn => {
        if (btn && btn.dispose) {
            btn.dispose()
        }
    })
    lineButtons.length = 0

    emitterDebuggers.forEach(helper => {
        disposeObject(helper)
    })
    emitterDebuggers.clear()

    if (controlsPanel && controlsPanel.dispose) {
        controlsPanel.dispose()
    }

    if (audioMeters && audioMeters.dispose) {
        audioMeters.dispose()
    }

    if (perfMonitor && perfMonitor.dispose) {
        perfMonitor.dispose()
    }

    Object.values(audioEmitters).forEach(emitter => {
        disposeAudioEmitter(emitter)
    })

    if (particleSystem && particleSystem.dispose) {
        particleSystem.dispose()
    }

    if (currentHDRTexture) {
        disposeTexture(currentHDRTexture)
        currentHDRTexture = null
    }

    if (carGroup) {
        disposeObject(carGroup)
    }
    if (floor) {
        disposeObject(floor)
    }

    if (anims.mixerWheels) {
        anims.mixerWheels.stopAllAction()
        anims.mixerWheels = null
    }
    if (anims.mixerLights) {
        anims.mixerLights.stopAllAction()
        anims.mixerLights = null
    }

    if (hemiLight) {
        scene.remove(hemiLight)
    }
    if (ambientLight) {
        scene.remove(ambientLight)
    }
    directionalLights.forEach(light => {
        scene.remove(light)
        light.dispose()
    })

    if (renderer) {
        renderer.dispose()
    }

    if (dbg) {
        dbg.destroy()
    }

    console.log('Cleanup complete')
}

/**
 * Page Visibility & Performance Optimization
 */

/** @type {number|null} Current animation frame request ID */
let animationFrameId = null

/** @type {boolean} Track page visibility for pausing heavy computations */
let isPageVisible = !document.hidden

/**
 * Pause simulation when tab is not visible to save CPU/GPU resources
 * Suspends audio context and reduces computational load
 */
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden
    
    if (isPageVisible) {
        console.log('Tab visible - resuming simulation')
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(err => {
                console.warn('Failed to resume audio context:', err)
            })
        }
    } else {
        console.log('Tab hidden - pausing heavy computations')
        audioContext.suspend()
    }
})

window.addEventListener('beforeunload', () => {
    disposeAll()
})

/**
 * Main Animation Loop
 * Handles animation updates, particle system, audio mixing, and rendering
 */

/** @type {THREE.Clock} Main animation clock for time tracking */
const clock = new THREE.Clock()

/** @type {number} Previous frame elapsed time for delta calculation */
let previousTime = 0

/**
 * Main render loop tick function
 * Updates animations, particle systems, audio, and renders the scene
 * Optimizes heavy computations based on page visibility
 */
const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    if (isPageVisible) {
        if (anims.mixerWheels) {
            anims.mixerWheels.update(deltaTime)

            switch (driveState) {
                case DriveState.ACCEL:
                    while (anims.mixerWheels.timeScale < 1.0) {
                        anims.mixerWheels.timeScale += deltaTime
                        if (anims.mixerWheels.timeScale >= 1.0) {
                            anims.mixerWheels.timeScale = 1.0
                            driveState = DriveState.DRIVE
                        }
                    }
                    break
                case DriveState.DECEL:
                    while (anims.mixerWheels.timeScale > 0.0) {
                        anims.mixerWheels.timeScale -= deltaTime
                        if (anims.mixerWheels.timeScale <= 0.0) {
                            anims.mixerWheels.timeScale = 0.0
                            driveState = DriveState.STOP
                            anims.mixerWheels.stopAllAction()
                        }
                    }
                    break
                case DriveState.DRIVE:
                    break
                case DriveState.STOP:
                    break
                default:
                    break
            }
        }

        if (anims.mixerLights) {
            anims.mixerLights.update(deltaTime)

            if (anims.actLights0 && anims.headLightL && anims.headLightR) {
                const headLightsIntensity = anims.lightsIntensity - (anims.actLights0.time / anims.actLights0.getClip().duration) * anims.lightsIntensity
                anims.headLightL.intensity = anims.headLightR.intensity = headLightsIntensity
            }
        }

        carGroup.position.z = Math.sin(elapsedTime * 2) * 0.0125

        particleSystem.update(deltaTime, driveState)

        if (lineButtons.length > 0) {
            lineButtons.forEach(btn => {
                try {
                    btn.update(camera)
                } catch (e) {
                    // Defensive: ignore update errors for now
                }
            })
        }

        soundEngine.setEmitterVolumes(soloState)

        if (controlsPanel && controlsPanel.update) {
            controlsPanel.update()
        }

        if (audioMeters && audioMeters.update) {
            audioMeters.update()
        }
    }

    controls.update()

    perfMonitor.update()

    renderer.render(scene, camera)

    animationFrameId = window.requestAnimationFrame(tick)
}

tick()