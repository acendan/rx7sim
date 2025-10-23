import * as THREE from 'three'
import { SoloBtnColors } from './constants.js'
import { colorToHex } from './helpers.js'

// Minimal portable mixer panel for showing emitter volumes
export function createMixer({ emitters = {}, initialVisible = false } = {}) {
    let visible = initialVisible
    let panel = null
    const analysers = new Map() // Store audio analysers for each emitter

    function ensurePanel() {
        if (panel) return panel
        panel = document.createElement('div')
        panel.id = 'audio-volume-panel'
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '10px', // Lower right corner
            right: '10px',
            padding: '8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            borderRadius: '6px',
            zIndex: 9999,
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'none',
            display: visible ? '' : 'none'
        })
        document.body.appendChild(panel)
        return panel
    }

    function buildRow(pos) {
        const row = document.createElement('div')
        row.dataset.pos = pos
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '6px',
            pointerEvents: 'auto',
            flexDirection: 'row'
        })

        const label = document.createElement('div')
        label.className = 'vol-label'
        label.textContent = pos
        Object.assign(label.style, {
            width: '70px',
            textTransform: 'capitalize'
        })

        const barContainer = document.createElement('div')
        barContainer.className = 'vol-bar-container'
        Object.assign(barContainer.style, {
            width: '64px',
            height: '12px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            marginLeft: '8px',
            marginRight: '8px'
        })

        const barInner = document.createElement('div')
        barInner.className = 'vol-bar'
        Object.assign(barInner.style, {
            width: '0%',
            height: '100%',
            background: '#666', // fallback until mapped color applied
            transition: 'width 0.08s linear'
        })

        // const value = document.createElement('div')
        // value.className = 'vol-value'
        // Object.assign(value.style, {
        //     marginLeft: '8px',
        //     minWidth: '36px',
        //     textAlign: 'right'
        // })
        // value.textContent = '0%'

        // Apply color from SoloBtnColors mapping based on position key
        const soloColorKey = pos.toUpperCase()
        if (SoloBtnColors[soloColorKey] !== undefined) {
            barInner.style.background = colorToHex(SoloBtnColors[soloColorKey])
        }

        barContainer.appendChild(barInner)
        row.appendChild(label)
        row.appendChild(barContainer)
        // row.appendChild(value)
        return row
    }

    function ensureAnalyser(pos, emitter) {
        if (!analysers.has(pos) && emitter?.getOutput()) {
            const analyser = new THREE.AudioAnalyser(emitter, 32)
            analysers.set(pos, analyser)
        }
        return analysers.get(pos)
    }

    function getEmitterVolume(pos, emitter) {
        const analyser = ensureAnalyser(pos, emitter)
        if (!analyser) return 0

        const volume = analyser.getAverageFrequency() / 255 // Normalize to 0-1
        const soloScaling = emitter && emitter.getVolume ? emitter.getVolume() : 0
        return volume * soloScaling
    }

    function update() {
        const p = ensurePanel()
        Object.entries(emitters).forEach(([pos, emitter]) => {
            // Disabling mix row, as now just using separate assets for mix
            if (pos === 'mix') return
            
            let row = p.querySelector(`[data-pos="${pos}"]`)
            if (!row) {
                row = buildRow(pos)
                p.appendChild(row)
            }

            const volume = getEmitterVolume(pos, emitter) * 3
            const barInner = row.querySelector('.vol-bar')
            barInner.style.width = `${Math.max(0, Math.min(1, volume)) * 100}%`
            
            // const value = row.querySelector('.vol-value')
            // value.textContent = `${Math.round(volume * 100)}%`
        })
        panel.style.display = visible ? '' : 'none'
    }

    function setVisible(v) {
        visible = !!v
        if (panel) panel.style.display = visible ? '' : 'none'
    }

    return {
        update,
        setVisible,
        isVisible: () => visible
    }
}
