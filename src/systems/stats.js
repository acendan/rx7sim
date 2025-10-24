/**
 * Lightweight performance monitor for FPS and frame time
 */
export function createPerformanceMonitor({ initialVisible = false } = {}) {
    let visible = initialVisible
    let panel = null
    
    // Performance tracking
    let frames = 0
    let prevTime = performance.now()
    let fps = 0
    let frameTime = 0

    function ensurePanel() {
        if (panel) return panel
        panel = document.createElement('div')
        panel.id = 'performance-stats'
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            padding: '8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            borderRadius: '6px',
            zIndex: 9999,
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'none',
            display: visible ? '' : 'none',
            minWidth: '120px'
        })
        document.body.appendChild(panel)
        return panel
    }

    function update() {
        frames++
        const currentTime = performance.now()
        const delta = currentTime - prevTime

        // Update FPS every second
        if (delta >= 1000) {
            fps = Math.round((frames * 1000) / delta)
            frameTime = delta / frames
            frames = 0
            prevTime = currentTime
        }

        // Update panel if visible
        if (visible) {
            const p = ensurePanel()
            
            // Color code FPS
            let fpsColor = '#00ff00' // Green
            if (fps < 60) fpsColor = '#ffff00' // Yellow
            if (fps < 30) fpsColor = '#ff0000' // Red
            
            p.innerHTML = `
                <div style="margin-bottom: 4px;">
                    <span style="color: #888;">FPS:</span> 
                    <span style="color: ${fpsColor}; font-weight: bold;">${fps}</span>
                </div>
                <div>
                    <span style="color: #888;">Frame:</span> 
                    <span>${frameTime.toFixed(2)}ms</span>
                </div>
            `
        }
    }

    function setVisible(v) {
        visible = !!v
        if (panel) panel.style.display = visible ? '' : 'none'
    }

    function dispose() {
        if (panel && panel.parentElement) {
            panel.parentElement.removeChild(panel)
            panel = null
        }
    }

    return {
        update,
        setVisible,
        isVisible: () => visible,
        dispose,
        getStats: () => ({ fps, frameTime })
    }
}
