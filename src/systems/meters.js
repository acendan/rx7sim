// Minimal portable mixer panel for showing emitter volumes
export function createMixer({ emitters = {}, initialVisible = false } = {}) {
    let visible = initialVisible
    let panel = null

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
            background: '#4e9eff',
            transition: 'width 0.08s linear'
        })

        const value = document.createElement('div')
        value.className = 'vol-value'
        Object.assign(value.style, {
            marginLeft: '8px',
            minWidth: '36px',
            textAlign: 'right'
        })
        value.textContent = '0%'

        if (pos === 'exhaust') barInner.style.background = '#9cff7f'
        if (pos === 'interior') barInner.style.background = '#ffe894'
        if (pos === 'mix') barInner.style.background = '#a056aaff'

        barContainer.appendChild(barInner)
        row.appendChild(label)
        row.appendChild(barContainer)
        row.appendChild(value)
        return row
    }

    function update() {
        const p = ensurePanel()
        Object.entries(emitters).forEach(([pos, emitter]) => {
            let row = p.querySelector(`[data-pos="${pos}"]`)
            if (!row) {
                row = buildRow(pos)
                p.appendChild(row)
            }

            const volume = emitter && emitter.getVolume ? emitter.getVolume() : 0
            const barInner = row.querySelector('.vol-bar')
            const value = row.querySelector('.vol-value')
            barInner.style.width = `${Math.max(0, Math.min(1, volume)) * 100}%`
            value.textContent = `${Math.round(volume * 100)}%`
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
