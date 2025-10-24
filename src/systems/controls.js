/**
 * @fileoverview Control panel for ignition, throttle, and other inputs
 * @module systems/controls
 */

import * as THREE from 'three'
import { colorToHex } from './helpers.js'

/**
 * Creates the controls panel
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.initialVisible=false] - Whether the panel should be visible initially
 * @returns {Object} Panel instance with control methods
 * @returns {Function} return.update - Updates all controls (call once per frame)
 * @returns {Function} return.setVisible - Shows/hides the controls panel
 * @returns {Function} return.dispose - Removes panel and cleans up resources
 * 
 * @example
 * const controls = createControls({
 *     initialVisible: true 
 * })
 * 
 * function animate() {
 *     controls.update()
 *     // ... rendering code
 * }
 */
export function createControls({ initialVisible = false } = {}) {
    let visible = initialVisible
    let panel = null
    
    /**  
     * Sets the callback for ignition toggle
     * @param {Function} callback - The callback function to call on ignition toggle
     */
    function onIgnitionToggle(callback) {
        const p = ensurePanel()
        p.addEventListener('click', (event) => {
            if (event.target.matches('.ignition-toggle')) {
                callback()
            }
        })
    }

    /**
     * Ensures the controls panel DOM element exists
     * @private
     * @returns {HTMLDivElement} The controls panel element
     */
    function ensurePanel() {
        if (panel) return panel
        panel = document.createElement('div')
        panel.id = 'controls-panel'
        Object.assign(panel.style, {
            position: 'fixed',
            top: '10px', // Upper left corner
            left: '10px',
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

        // Example ignition toggle button
        const ignitionBtn = document.createElement('button')
        ignitionBtn.className = 'ignition-toggle'
        ignitionBtn.textContent = 'Toggle Ignition'
        Object.assign(ignitionBtn.style, {
            display: 'block',
            margin: '4px 0',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#fff'
        })
        panel.appendChild(ignitionBtn)
        // Make button clickable
        panel.style.pointerEvents = 'auto'

        document.body.appendChild(panel)
        return panel
    }

    /**
     * Updates all controls once per frame
     */
    function update() {
        const p = ensurePanel()
        
        

        panel.style.display = visible ? '' : 'none'
    }

    /**
     * Sets the visibility of the controls panel
     * @param {boolean} v - Whether the panel should be visible
     */
    function setVisible(v) {
        visible = !!v
        if (panel) panel.style.display = visible ? '' : 'none'
    }

    /**
     * Cleans up removes the controls panel from DOM
     */
    function dispose() {
        // Do other disposal...

        // Remove DOM panel
        if (panel && panel.parentElement) {
            panel.parentElement.removeChild(panel)
            panel = null
        }
    }

    return {
        onIgnitionToggle,
        update,
        setVisible,
        isVisible: () => visible,
        dispose
    }
}
