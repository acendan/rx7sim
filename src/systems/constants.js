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
    INTAKE: 0x4e9eff,
    EXHAUST: 0x9cff7f,
    INTERIOR: 0xffe894
}

// Global per-emitter volume multipliers (useful for balancing perspectives)
export const EmitterVolMults = {
    MIX: 0.8,       // Applied to each individually during mix solo state
    INTAKE: 0.5,
    EXHAUST: 0.8,
    INTERIOR: 0.6
}

export default {
    DriveState,
    SoloState,
    SoloBtnColors,
    EmitterVolMults
}
