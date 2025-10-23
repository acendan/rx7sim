import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'

THREE.ColorManagement.enabled = false

import { DriveState, SoloState, SoloBtnColors } from './systems/constants.js'
var driveState = DriveState.STOP
var soloState = SoloState.MIX

import { particleSystem } from './systems/exhaust.js'
import { createDirectionalLights, createHeadlightSpots, playPositionalAudio, createLineButton } from './systems/helpers.js'
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
const dbgAudio = dbg.addFolder('Audio')

// Axes
// const axes = new THREE.AxesHelper(1)
// axes.visible = false
// scene.add(axes)
// dbgUtils.add(axes, 'visible').name('Axes')

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
        intakeSoloBtn = createLineButton({ screenAnchor: new THREE.Vector2(-0.6, -0.8), targetLocalPos: new THREE.Vector3(0, 0.2, 2.1), targetObject: gltfCar.scene, label: 'Intake', color: SoloBtnColors.INTAKE })
        exhaustSoloBtn = createLineButton({ screenAnchor: new THREE.Vector2(0.6, -0.8), targetLocalPos: new THREE.Vector3(-0.5, 0.3, -2.0), targetObject: gltfCar.scene, label: 'Exhaust', color: SoloBtnColors.EXHAUST })
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
                                otherBtn.button.style.backgroundColor = `#${SoloBtnColors[otherBtn.button.textContent.toUpperCase()].toString(16).padStart(6, '0')}`
                                otherBtn.button.style.color = `#272727ff`
                                otherBtn.line.visible = true
                                otherBtn.button.dimmed = false
                            }
                        })

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
                            } else {
                                otherBtn.button.style.color = `#272727ff`
                                otherBtn.line.visible = true
                                otherBtn.button.dimmed = false
                            }
                        })
                    }
                })
            })

        // Line button visibility
        const buttonVisibility = { 'Mic Perspectives': true }
        dbgAudio.add(buttonVisibility, 'Mic Perspectives').onChange(visible => {
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

// Add emitters to car at appropriate positions & starting volume
Object.entries(audioEmitters).forEach(([pos, emitter]) => {
    carGroup.add(emitter);
    switch(pos) {
        case 'intake':
            emitter.position.set(0, 0.2, 2.1); // Front of car
            emitter.setVolume(0);
            break;
        case 'exhaust':
            emitter.position.set(-0.5, 0.3, -2.0); // Rear of car
            emitter.setVolume(0);
            break;
        case 'interior':
            emitter.position.set(0.0, 0.1, -0.2); // Inside car
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
        mix: { ignitionOn: null, idle: null, ignitionOff: null },
        intake: { ignitionOn: null, idle: null, ignitionOff: null },
        exhaust: { ignitionOn: null, idle: null, ignitionOff: null },
        interior: { ignitionOn: null, idle: null, ignitionOff: null }
    },

    // Track current active emitter for smooth transitions
    currentEmitter: null,

    setEmitterVolumes(currSoloState) {
        const soloStates = Object.values(SoloState)
        soloStates.forEach(posToSolo => {
            const posEmitter = audioEmitters[posToSolo]
            if (!posEmitter) return // skip unknown positions

            // Handle volume transitions
            if (posToSolo === currSoloState) {
                // Fade in
                if (posEmitter.getVolume() < 1.0) {
                    const vol = Math.min(1.0, posEmitter.getVolume() + 0.2)
                    posEmitter.setVolume(vol)
                }
            } else {
                // Fade out
                if (posEmitter.getVolume() > 0.0) {
                    const vol = Math.max(0.0, posEmitter.getVolume() - 0.2)
                    posEmitter.setVolume(vol)
                }
            }
        });
    },

    ignitionOn: () => {
        // Start ignition for all positions
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/ignition_on.ogg`, {
                store: soundEngine.buffers[pos], 
                storeKey: 'ignitionOn',
                loop: false,
                onEnded: () => {
                    // After ignition sound ends, start engine idle loop for this position
                    playPositionalAudio(audioLoader, emitter, `./audio/${pos}/idle.ogg`, {
                        store: soundEngine.buffers[pos],
                        storeKey: 'idle',
                        loop: true,
                        onEnded: () => {}
                    });
                }
            });
        });

        driveState = DriveState.ACCEL;
        anims.mixerWheels.stopAllAction();
        anims.actWheelsRot.play();
        anims.actTiresRot.play();
        anims.mixerWheels.timeScale = 0.01;

        dbgEngineIgnOn.hide();
        dbgEngineIgnOff.show();
    },

    ignitionOff: () => {
        // Play ignition off for all positions
        Object.entries(audioEmitters).forEach(([pos, emitter]) => {
            playPositionalAudio(audioLoader, emitter, `./audio/${pos}/ignition_off.ogg`, {
                store: soundEngine.buffers[pos],
                storeKey: 'ignitionOff',
                loop: false,
                onEnded: () => {
                    emitter.stop();
                }
            });
        });

        driveState = DriveState.DECEL;

        dbgEngineIgnOn.show();
        dbgEngineIgnOff.hide();
    },

    load() {
        // Cache buffers for all positions
        const engine = this; // Store reference to soundEngine
        Object.keys(engine.buffers).forEach(pos => {
            audioLoader.load(`./audio/${pos}/ignition_on.ogg`, 
                (buffer) => { engine.buffers[pos].ignitionOn = buffer });
            audioLoader.load(`./audio/${pos}/idle.ogg`,
                (buffer) => { engine.buffers[pos].idle = buffer });
            audioLoader.load(`./audio/${pos}/ignition_off.ogg`,
                (buffer) => { engine.buffers[pos].ignitionOff = buffer });
        });
    }
}
soundEngine.load()


// Create meters panel
const audioMeters = createMixer({ emitters: audioEmitters, initialVisible: true })

// Add debug toggle for meter visibility
const audioDebug = { 'Meters': true }
dbgAudio.add(audioDebug, 'Meters').onChange(v => audioMeters.setVisible(v))


/**
 * Debug
 */
const dbgVehicle = dbg.addFolder('Vehicle')
const dbgEngineIgnOn = dbgVehicle.add(soundEngine, 'ignitionOn').name('Ignition On')
const dbgEngineIgnOff = dbgVehicle.add(soundEngine, 'ignitionOff').name('Ignition Off').hide()

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