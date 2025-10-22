import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'

THREE.ColorManagement.enabled = false

const DriveState = {
    STOP: 'stop',
    DRIVE: 'drive',
    ACCEL: 'accel',
    DECEL: 'decel'
}
var driveState = DriveState.STOP;

import { particleSystem } from './systems/exhaust.js';
import { createDirectionalLights, createHeadlightSpots, playPositionalAudio, createLineButton } from './systems/helpers.js'

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
const dbgUtils = dbg.addFolder('Utils')

// Axes
const axes = new THREE.AxesHelper(1)
axes.visible = false
scene.add(axes)
dbgUtils.add(axes, 'visible').name('Axes')

// Loaders
const gltfLoader = new GLTFLoader()
const audioLoader = new THREE.AudioLoader();

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
 * Objects
 */
let carGroup = new THREE.Group()
scene.add(carGroup)
carGroup.add(particleSystem.getMesh())

// Line buttons: will be created after car model loads; store them here
const lineButtons = []
const clickableMeshes = []

// Raycaster and pointer for click handling
const pointer = new THREE.Vector2()
const clickRaycaster = new THREE.Raycaster()

function onPointerDown(event) {
    // Translate pointer to NDC
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1
    clickRaycaster.setFromCamera(pointer, camera)
    const intersects = clickRaycaster.intersectObjects(clickableMeshes, true)
    if (intersects.length > 0) {
        const m = intersects[0].object
        console.log('Line button clicked:', m.userData._lineButtonLabel || m.name || m.id)
    }
}

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

        // Line buttons anchored to screen corners and pointing to local car positions
        let hoodBtn, exhaustBtn, driverBtn
        hoodBtn = createLineButton({ screenAnchor: new THREE.Vector2(-0.5, -0.8), targetLocalPos: new THREE.Vector3(0, 0.2, 2.1), targetObject: gltfCar.scene, label: 'Intake', color: 0x449edd })
        exhaustBtn = createLineButton({ screenAnchor: new THREE.Vector2(0.8, -0.8), targetLocalPos: new THREE.Vector3(-0.5, 0.3, -2.0), targetObject: gltfCar.scene, label: 'Exhaust', color: 0x9cff7f })
        driverBtn = createLineButton({ screenAnchor: new THREE.Vector2(0.2, -0.8), targetLocalPos: new THREE.Vector3(0.0, 0.1, -0.2), targetObject: gltfCar.scene, label: 'Interior', color: 0xffe894 })

            // Add their groups to scene and register clickable meshes
            ;[hoodBtn, exhaustBtn, driverBtn].forEach(btn => {
                scene.add(btn.group)
                lineButtons.push(btn)
                clickableMeshes.push(btn.getClickable())
            })

        // Line button visibility
        const buttonVisibility = { 'Mic Perspective Btns': true }
        dbgUtils.add(buttonVisibility, 'Mic Perspective Btns').onChange(visible => {
            hoodBtn.setVisible(visible)
            exhaustBtn.setVisible(visible)
            driverBtn.setVisible(visible)
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
        const dbgAnims = dbg.addFolder('Lights')
        dbgAnims.add(anims, 'lights').name('Lights')
    }
)


/**
 * Lighting
 */
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.4);
hemiLight.position.set(0, 100, 0);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const directionalLights = createDirectionalLights([
    { color: 0xffffff, intensity: 1.0, position: [5, 3, 4] },
    { color: 0xffffff, intensity: 1.0, position: [8, 3, -1] },
    { color: 0xffffff, intensity: 0.2, position: [-5, 5, -5] }
])
directionalLights.forEach(l => scene.add(l))

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLights[0], 0.2)
// scene.add(directionalLightHelper)

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

// Pointer events for clickable line buttons
renderer.domElement.addEventListener('pointerdown', onPointerDown)

/**
 * Audio
 */
// Listener
const listener = new THREE.AudioListener();
camera.add(listener);

// Emitter
const emitter = new THREE.PositionalAudio(listener);
carGroup.add(emitter);

const soundEngine = {
    ignitionOnBuffer: null,
    ignitionIdleBuffer: null,
    ignitionOffBuffer: null,
    ignitionOn: () => {
        playPositionalAudio(audioLoader, emitter, './audio/ignition_on.ogg', {
            store: soundEngine, storeKey: 'ignitionOnBuffer', loop: false,
            onEnded: () => {
                // After ignition sound ends, start engine idle loop
                playPositionalAudio(audioLoader, emitter, './audio/idle.ogg', { store: soundEngine, storeKey: 'ignitionIdleBuffer', loop: true })
            }
        })

        driveState = DriveState.ACCEL
        anims.mixerWheels.stopAllAction()
        anims.actWheelsRot.play()
        anims.actTiresRot.play()
        anims.mixerWheels.timeScale = 0.01
    },

    ignitionOff: () => {
        playPositionalAudio(audioLoader, emitter, './audio/ignition_off.ogg', {
            store: soundEngine, storeKey: 'ignitionOffBuffer', loop: false,
            onEnded: () => {
                emitter.stop()
            }
        })
        driveState = DriveState.DECEL
    },

    load: () => {
        // Cache buffers on startup for seamless playback
        audioLoader.load('./audio/ignition_on.ogg', (buffer) => { soundEngine.ignitionOnBuffer = buffer });
        audioLoader.load('./audio/idle.ogg', (buffer) => { soundEngine.ignitionIdleBuffer = buffer });
        audioLoader.load('./audio/ignition_off.ogg', (buffer) => { soundEngine.ignitionOffBuffer = buffer });
    }
}
soundEngine.load()


/**
 * Debug
 */
const dbgEngine = dbg.addFolder('Engine')
dbgEngine.add(soundEngine, 'ignitionOn').name('Ignition On')
dbgEngine.add(soundEngine, 'ignitionOff').name('Ignition Off')

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

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()