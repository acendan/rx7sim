/**
 * @fileoverview Centralized constants and configuration for rx7sim
 * @module systems/constants
 */

/**
 * Vehicle drive states for animation and audio control
 * @enum {string}
 * @readonly
 */
export const DriveState = {
    /** Vehicle is stationary with engine at idle */
    STOP: 'stop',
    /** Vehicle is cruising at constant speed */
    DRIVE: 'drive',
    /** Vehicle is accelerating (transitioning from idle to drive) */
    ACCEL: 'accel',
    /** Vehicle is decelerating (transitioning from drive to stop) */
    DECEL: 'decel'
}

/**
 * Audio solo/mix states for microphone perspective control
 * @enum {string}
 * @readonly
 */
export const SoloState = {
    /** Mix of all audio perspectives */
    MIX: 'mix',
    /** Intake/front perspective only */
    INTAKE: 'intake',
    /** Exhaust/rear perspective only */
    EXHAUST: 'exhaust',
    /** Interior/cabin perspective only */
    INTERIOR: 'interior'
}

/**
 * Color values for solo button UI elements
 * @enum {number}
 * @readonly
 */
export const SoloBtnColors = {
    /** Purple - Mix perspective color */
    MIX: 0xa056aa,
    /** Blue - Intake perspective color */
    INTAKE: 0x4e9eff,
    /** Green - Exhaust perspective color */
    EXHAUST: 0x9cff7f,
    /** Yellow - Interior perspective color */
    INTERIOR: 0xffe894
}

/**
 * Global per-emitter volume multipliers for balancing audio perspectives
 * @type {Object.<string, number>}
 * @property {number} MIX - Applied to each emitter during mix solo state (0-1)
 * @property {number} INTAKE - Intake emitter volume multiplier
 * @property {number} EXHAUST - Exhaust emitter volume multiplier
 * @property {number} INTERIOR - Interior emitter volume multiplier
 */
export const EmitterVolMults = {
    MIX: 0.8,       // Applied to each individually during mix solo state
    INTAKE: 0.5,
    EXHAUST: 0.8,
    INTERIOR: 0.3
}

/**
 * Configuration for directional audio emitters (intake/exhaust)
 * @type {Object}
 * @property {number} innerAngle - Inner cone angle in degrees where volume is at maximum
 * @property {number} outerAngle - Outer cone angle in degrees where volume starts to attenuate
 * @property {number} outerGain - Volume multiplier outside the outer cone (0-1)
 */
export const ConeEmitterSettings = {
    innerAngle: 45.0, // degrees
    outerAngle: 120.0, // degrees
    outerGain: 0.3    // volume multiplier outside outer cone
}

/**
 * Default lighting configuration for the scene
 * @type {Object}
 * @property {Object} ambient - Ambient light settings
 * @property {number} ambient.color - Hex color value
 * @property {number} ambient.intensity - Light intensity (0-1+)
 * @property {Object} hemisphere - Hemisphere light settings
 * @property {number} hemisphere.skyColor - Sky color hex value
 * @property {number} hemisphere.groundColor - Ground color hex value
 * @property {number} hemisphere.intensity - Light intensity (0-1+)
 * @property {Array<Object>} directional - Array of directional light configurations
 */
export const LightingDefaults = {
    ambient: { color: 0xffffff, intensity: 0.5 },
    hemisphere: { skyColor: 0xffffff, groundColor: 0x8d8d8d, intensity: 0.4 },
    directional: [
        { color: 0xfeffed, intensity: 1.0 },
        { color: 0xfff7f2, intensity: 1.0 },
        { color: 0xf8feff, intensity: 0.2 }
    ]
}

/**
 * HDRI environment presets with associated reverb and lighting overrides
 * Each preset defines the visual environment, audio reverb, and custom lighting
 * @type {Object.<string, Object>}
 * @property {Object} Garage - Enclosed garage environment
 * @property {string} Garage.path - Path to HDR texture file
 * @property {string} Garage.reverb - Name of reverb preset to apply
 * @property {Object} Garage.lighting - Custom lighting override
 * @property {Object} Track - Open track environment
 * @property {string} Track.path - Path to HDR texture file
 * @property {string} Track.reverb - Name of reverb preset to apply
 * @property {Object} Track.lighting - Custom lighting override
 */
export const EnvironmentPresets = {
    'Garage': {
        path: './hdri/garage.hdr',
        reverb: 'Garage',
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
        reverb: 'Outdoors',
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

export default {
    DriveState,
    SoloState,
    SoloBtnColors,
    EmitterVolMults,
    ConeEmitterSettings,
    LightingDefaults,
    EnvironmentPresets
}
