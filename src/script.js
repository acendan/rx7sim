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

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 500);

// Debug
const dbg = new dat.GUI()
const dbgUtils = dbg.addFolder('Utils')

// Axes
const axes = new THREE.AxesHelper(1)
axes.visible = false
scene.add(axes)
dbgUtils.add(axes, 'visible').name('Axes')

// GLTFs
const gltfLoader = new GLTFLoader()

// Audio
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

// Animation mixers and actions
let anims = {
    mixerWheels: null,
    actWheelsRot: null, actTiresRot: null, // Wheel animations

    mixerLights: null,
    actLights0: null, actLights1: null, actLights2: null, actLights3: null, actLights4: null, // Light animations
    headLightL: null, headLightR: null,
    lightsFlipFlop: true,
    lightsIntensity: 3.0,
    lightsTimeScaleToggle: () => {
        if (anims.lightsFlipFlop) {
            anims.mixerLights.timeScale = 1.5
            anims.actLights0.time = 0
            anims.actLights1.time = 0
            anims.actLights2.time = 0
            anims.actLights3.time = 0
            anims.actLights4.time = 0
            anims.lightsFlipFlop = false
        } else {
            anims.mixerLights.timeScale = -1.5
            anims.actLights0.time = anims.actLights0.getClip().duration - anims.actLights0.time
            anims.actLights1.time = anims.actLights1.getClip().duration - anims.actLights1.time
            anims.actLights2.time = anims.actLights2.getClip().duration - anims.actLights2.time
            anims.actLights3.time = anims.actLights3.getClip().duration - anims.actLights3.time
            anims.actLights4.time = anims.actLights4.getClip().duration - anims.actLights4.time
            anims.lightsFlipFlop = true
        }
    },
    lights: () => { anims.mixerLights.stopAllAction(), anims.lightsTimeScaleToggle(), anims.actLights0.play(), anims.actLights1.play(), anims.actLights2.play(), anims.actLights3.play(), anims.actLights4.play() }
}

// Car
gltfLoader.load('/model/rx7/rx7.gltf',
    (gltfCar) => {
        console.log(gltfCar)

        gltfCar.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfCar.scene)
    }
)

// Wheels
gltfLoader.load('/model/rx7_wheels/rx7_wheels.gltf',
    (wheelRL) => {
        console.log(wheelRL)

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
gltfLoader.load('/model/rx7_lights/rx7_lights.gltf',
    (gltfLights) => {
        console.log(gltfLights)

        gltfLights.scene.scale.set(1.0, 1.0, 1.0)
        carGroup.add(gltfLights.scene)

        // Animations
        anims.mixerLights = new THREE.AnimationMixer(gltfLights.scene)
        anims.actLights0 = anims.mixerLights.clipAction(gltfLights.animations[0]) // Lights
        anims.actLights0.setLoop(THREE.LoopOnce)
        anims.actLights0.clampWhenFinished = true
        anims.actLights1 = anims.mixerLights.clipAction(gltfLights.animations[1]) // Lights
        anims.actLights1.setLoop(THREE.LoopOnce)
        anims.actLights1.clampWhenFinished = true
        anims.actLights2 = anims.mixerLights.clipAction(gltfLights.animations[2]) // Lights
        anims.actLights2.setLoop(THREE.LoopOnce)
        anims.actLights2.clampWhenFinished = true
        anims.actLights3 = anims.mixerLights.clipAction(gltfLights.animations[3]) // Lights
        anims.actLights3.setLoop(THREE.LoopOnce)
        anims.actLights3.clampWhenFinished = true
        anims.actLights4 = anims.mixerLights.clipAction(gltfLights.animations[4]) // Lights
        anims.actLights4.setLoop(THREE.LoopOnce)
        anims.actLights4.clampWhenFinished = true

        // Add to dbg anims folder
        const dbgAnims = dbg.addFolder('Lights')
        dbgAnims.add(anims, 'lights').name('Lights')

        // Add threejs directional lights to scene when headlights turn on
        anims.headLightR = new THREE.SpotLight(0xFFFFDE, anims.lightsIntensity, 10, Math.PI / 6, 0.5, 1.0)
        anims.headLightR.position.set(-0.75, 0.76, 1.8)
        anims.headLightR.target.position.set(0, 0, 10)
        anims.headLightR.castShadow = true
        anims.headLightR.shadow.mapSize.width = 1024
        anims.headLightR.shadow.mapSize.height = 1024
        anims.headLightR.shadow.camera.near = 0.5
        anims.headLightR.shadow.camera.far = 20
        anims.headLightR.shadow.camera.fov = 30
        carGroup.add(anims.headLightR)
        carGroup.add(anims.headLightR.target)

        anims.headLightL = new THREE.SpotLight(0xFFFFDE, anims.lightsIntensity, 10, Math.PI / 6, 0.5, 1.0)
        anims.headLightL.position.set(0.75, 0.76, 1.8)
        anims.headLightL.target.position.set(0, 0, 10)
        anims.headLightL.castShadow = true
        anims.headLightL.shadow.mapSize.width = 1024
        anims.headLightL.shadow.mapSize.height = 1024
        anims.headLightL.shadow.camera.near = 0.5
        anims.headLightL.shadow.camera.far = 20
        anims.headLightL.shadow.camera.fov = 30
        carGroup.add(anims.headLightL)
        carGroup.add(anims.headLightL.target)
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

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 3, 4)
scene.add(directionalLight)

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0)
directionalLight2.castShadow = true
directionalLight2.shadow.mapSize.set(1024, 1024)
directionalLight2.shadow.camera.far = 15
directionalLight2.shadow.camera.left = - 7
directionalLight2.shadow.camera.top = 7
directionalLight2.shadow.camera.right = 7
directionalLight2.shadow.camera.bottom = - 7
directionalLight2.position.set(8, 3, -1)
scene.add(directionalLight2)

const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.2)
directionalLight3.castShadow = true
directionalLight3.shadow.mapSize.set(1024, 1024)
directionalLight3.shadow.camera.far = 15
directionalLight3.shadow.camera.left = - 7
directionalLight3.shadow.camera.top = 7
directionalLight3.shadow.camera.right = 7
directionalLight3.shadow.camera.bottom = - 7
directionalLight3.position.set(-5, 5, -5)
scene.add(directionalLight3)

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight3, 0.2)
// scene.add(directionalLightHelper)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
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

// Emitter
const emitter = new THREE.PositionalAudio(listener);
// emitter.setLoop(true)
carGroup.add(emitter);

const soundEngine = {
    ignitionOnBuffer: null,
    ignitionIdleBuffer: null,
    ignitionOffBuffer: null,
    ignitionOn: () => {
        audioLoader.load('/audio/ignition_on.ogg', (buffer) => {
            emitter.setBuffer(buffer)
            emitter.setRefDistance(20)
            // emitter.setVolume(0.5)

            emitter.onEnded = () => {
                // After ignition sound ends, start engine idle sound
                if (!soundEngine.ignitionIdleBuffer) {
                    console.warn('Ignition idle buffer not loaded yet! Expect hiccup in playback.')
                    audioLoader.load('/audio/idle.ogg', (bufferIdle) => {
                        soundEngine.ignitionIdleBuffer = bufferIdle
                        
                        emitter.stop()
                        emitter.setBuffer(bufferIdle)
                        emitter.setRefDistance(20)
                        emitter.setLoop(true)
                        // emitter.setVolume(0.5)
                        emitter.play()
                    });
                } else {
                    emitter.stop()
                    emitter.setBuffer(soundEngine.ignitionIdleBuffer)
                    emitter.setRefDistance(20)
                    emitter.setLoop(true)
                    // emitter.setVolume(0.5)
                    emitter.play()
                }
            }

            emitter.play()

            driveState = DriveState.ACCEL
            anims.mixerWheels.stopAllAction()
            anims.actWheelsRot.play()
            anims.actTiresRot.play()
            anims.mixerWheels.timeScale = 0.01

            // Load ignition idle and off buffers for later use
            audioLoader.load('/audio/idle.ogg', (bufferIdle) => {
                soundEngine.ignitionIdleBuffer = bufferIdle
            });
            audioLoader.load('/audio/ignition_off.ogg', (bufferOff) => {
                soundEngine.ignitionOffBuffer = bufferOff
            });
        });
    },

    ignitionOff: () => {
        if (!soundEngine.ignitionOffBuffer) {
            console.warn('Ignition off buffer not loaded yet! Expect hiccup in playback.')
            audioLoader.load('/audio/ignition_off.ogg', (bufferOff) => {
                soundEngine.ignitionOffBuffer = bufferOff
                
                emitter.stop()
                emitter.setBuffer(bufferOff)
                emitter.setRefDistance(20)
                emitter.setLoop(false)
                // emitter.setVolume(0.5)

                // Override onEnded to just stop the emitter after shutdown sound
                emitter.onEnded = () => { emitter.stop() }

                emitter.play()

                driveState = DriveState.DECEL
            });
        } else {
            emitter.stop()
            emitter.setBuffer(soundEngine.ignitionOffBuffer)
            emitter.setRefDistance(20)
            emitter.setLoop(false)
            // emitter.setVolume(0.5)

            // Override onEnded to just stop the emitter after shutdown sound
            emitter.onEnded = () => { emitter.stop() }

            emitter.play()

            driveState = DriveState.DECEL
        }
    }
}

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

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()