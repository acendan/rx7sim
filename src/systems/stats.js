/**
 * @fileoverview Lightweight performance monitor for FPS and frame time tracking
 * @module systems/stats
 */

/**
 * Creates a performance monitor overlay for tracking FPS and frame times
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.initialVisible=false] - Whether the stats panel should be visible initially
 * @returns {Object} Performance monitor instance with methods for control and data access
 * @returns {Function} return.update - Updates performance metrics (call once per frame)
 * @returns {Function} return.setVisible - Shows/hides the stats panel
 * @returns {Function} return.isVisible - Returns current visibility state
 * @returns {Function} return.dispose - Removes the stats panel from DOM
 * @returns {Function} return.getStats - Returns current FPS and frame time data
 * 
 * @example
 * const perfMonitor = createPerformanceMonitor({ initialVisible: true })
 * 
 * function animate() {
 *     perfMonitor.update()
 *     renderer.render(scene, camera)
 *     requestAnimationFrame(animate)
 * }
 */
export function createPerformanceMonitor({ initialVisible = false } = {}) {
    let visible = initialVisible
    let panel = null
    
    // Performance tracking
    let frames = 0
    let prevTime = performance.now()
    let fps = 0
    let frameTime = 0

    /**
     * Ensures the stats panel DOM element exists
     * @private
     * @returns {HTMLDivElement} The stats panel element
     */
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

    /**
     * Updates FPS and frame time calculations
     * Should be called once per frame before rendering
     */
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

    /**
     * Sets the visibility of the performance stats panel
     * @param {boolean} v - Whether the panel should be visible
     */
    function setVisible(v) {
        visible = !!v
        if (panel) panel.style.display = visible ? '' : 'none'
    }

    /**
     * Removes the stats panel from the DOM and cleans up resources
     */
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
