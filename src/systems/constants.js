// Centralized constants for the project
export const DriveState = {
    STOP: 'stop',
    DRIVE: 'drive',
    ACCEL: 'accel',
    DECEL: 'decel'
}

export const SoloState = {
    MIX: 'mix',
    INTAKE: 'intake',
    EXHAUST: 'exhaust',
    INTERIOR: 'interior'
}

export const SoloBtnColors = {
    MIX: 0xa056aa,
    INTAKE: 0x4e9eff,
    EXHAUST: 0x9cff7f,
    INTERIOR: 0xffe894
}

// Global per-emitter volume multipliers (useful for balancing perspectives)
export const EmitterVolMults = {
    MIX: 0.8,       // Applied to each individually during mix solo state
    INTAKE: 0.5,
    EXHAUST: 0.8,
    INTERIOR: 0.3
}

export const ConeEmitterSettings = {
    innerAngle: 45.0, // degrees
    outerAngle: 120.0, // degrees
    outerGain: 0.3    // volume multiplier outside outer cone
}

// Default lighting colors/intensities; central place to tweak base scene look
export const LightingDefaults = {
    ambient: { color: 0xffffff, intensity: 0.5 },
    hemisphere: { skyColor: 0xffffff, groundColor: 0x8d8d8d, intensity: 0.4 },
    directional: [
        { color: 0xfeffed, intensity: 1.0 },
        { color: 0xfff7f2, intensity: 1.0 },
        { color: 0xf8feff, intensity: 0.2 }
    ]
}

// HDRI environment presets with associated reverb and lighting overrides
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
