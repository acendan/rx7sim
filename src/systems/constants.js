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

export default {
    DriveState,
    SoloState,
    SoloBtnColors,
    EmitterVolMults,
    ConeEmitterSettings
}
