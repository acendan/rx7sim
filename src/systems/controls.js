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
export function createControls({ initVisible = false, initIgnition = false, initHeadlights = true } = {}) {
    let panel = null
    let visible = initVisible

    let ignitionOn = initIgnition
    let ignitionCallback = null

    let headlightsOn = initHeadlights
    let headlightsCallback = null

    /**  
     * Sets the callback for ignition toggle
     * @param {Function} callback - The callback function to call on ignition toggle
     */
    function registerIgnitionCallback(callback) {
        ignitionCallback = callback
    }

    /**
     * Sets the callback for headlights toggle
     * @param {Function} callback - The callback function to call on headlights toggle
     */
    function registerHeadlightsCallback(callback) {
        headlightsCallback = callback
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
            background: 'rgba(0,0,0,0.0)', // Transparent
            color: '#fff',
            borderRadius: '6px',
            zIndex: 9999,
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'none',
            display: visible ? '' : 'none',
            border: 'none' // No border
        })

        // Circular "Push to Start/Stop" button
        const ignitionBtn = document.createElement('button')
        ignitionBtn.className = 'ignition-toggle'
        ignitionBtn.innerHTML = `
            <span class="ignition-start" style="font-weight:bold;color:#fff;">START</span>
            <span class="ignition-stop" style="color:#aaa;">STOP</span>
        `
        Object.assign(ignitionBtn.style, {
            display: 'block',
            margin: '4px 0',
            padding: '0',
            width: '75px',
            height: '75px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 60% 40%, #a00 80%, #cc2f2f 100%)',
            border: '2px solid #fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '16px',
            textAlign: 'center',
            lineHeight: '16px',
            position: 'relative',
            transition: 'background 0.2s'
        })

        // Track ignition state
        function updateIgnitionButton() {
            const startSpan = ignitionBtn.querySelector('.ignition-start')
            const stopSpan = ignitionBtn.querySelector('.ignition-stop')
            if (ignitionOn) {
                startSpan.style.fontWeight = 'normal'
                startSpan.style.color = '#888'
                stopSpan.style.fontWeight = 'bold'
                stopSpan.style.color = '#fff'
                ignitionBtn.style.background = 'radial-gradient(circle at 60% 40%, #cc2f2f 80%, #a00 100%)'
            } else {
                startSpan.style.fontWeight = 'bold'
                startSpan.style.color = '#fff'
                stopSpan.style.fontWeight = 'normal'
                stopSpan.style.color = '#888'
                ignitionBtn.style.background = 'radial-gradient(circle at 60% 40%, #a00 80%, #cc2f2f 100%)'
            }
            if (ignitionCallback) {
                ignitionCallback(ignitionOn)
            }
        }

        // Toggle ignition state on click
        ignitionBtn.addEventListener('click', () => {
            ignitionOn = !ignitionOn
            updateIgnitionButton()
        })
        panel.style.pointerEvents = 'auto'
        panel.appendChild(ignitionBtn)

        // Headlights toggle button, with dashboard-style headlight symbol
        const headlightsBtn = document.createElement('button')
        headlightsBtn.className = 'headlights-toggle'
        headlightsBtn.innerHTML = `
            <span style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
            position: absolute;
            left: 0; top: 0;
            ">
            <svg width="36" height="36" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <!-- Bulb -->
            <path d="M18 36 A6 6 0 0 1 18 12" fill="none" stroke="#fff" stroke-width="2.2"/>
            <line x1="18" y1="12" x2="18" y2="36" stroke="#fff" stroke-width="2.2"/>
            <!-- Beams, angled downwards -->
            <line class="beam beam-1" x1="26" y1="19" x2="40" y2="23" stroke="#ff0" stroke-width="3" stroke-linecap="round" opacity="1"/>
            <line class="beam beam-2" x1="26" y1="24" x2="40" y2="28" stroke="#ff0" stroke-width="3" stroke-linecap="round" opacity="1"/>
            <line class="beam beam-3" x1="26" y1="29" x2="40" y2="33" stroke="#ff0" stroke-width="3" stroke-linecap="round" opacity="1"/>
            </svg>
            </span>
        `
        Object.assign(headlightsBtn.style, {
            display: 'block',
            margin: '12px auto 0 auto', // top margin, auto left/right for centering
            padding: '0',
            width: '56px',
            height: '28px',
            borderRadius: '10px',
            background: 'radial-gradient(circle at 60% 40%, #181818 80%, #222 100%)', // dark grey
            border: '2px solid #fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '14px',
            textAlign: 'center',
            lineHeight: '14px',
            position: 'relative',
            transition: 'background 0.2s',
            overflow: 'hidden'
        })

        // Animation helpers
        let beams = null
        let beamsAnimating = false
        function getBeams() {
            if (!beams) {
            beams = [
                headlightsBtn.querySelector('.beam-1'),
                headlightsBtn.querySelector('.beam-2'),
                headlightsBtn.querySelector('.beam-3')
            ]
            }
            return beams
        }

        function setBeamState(idx, on) {
            const beam = getBeams()[idx]
            beam.setAttribute('stroke', on ? '#ff0' : '#888')
            beam.style.opacity = on ? '1' : '0.5'
        }

        function animateBeams(turnOn, callback) {
            if (beamsAnimating) return
            beamsAnimating = true
            const beamsArr = getBeams()
            const order = turnOn ? [0, 1, 2] : [2, 1, 0]
            let i = 0
            function step() {
            setBeamState(order[i], turnOn)
            i++
            if (i < order.length) {
                setTimeout(step, 70)
            } else {
                beamsAnimating = false
                if (callback) callback()
            }
            }
            step()
        }

        function updateHeadlightsButton(animated = false) {
            if (animated) {
            animateBeams(headlightsOn, () => {
                headlightsBtn.style.background = headlightsOn
                ? 'radial-gradient(circle at 60% 40%, #222 80%, #333 100%)'
                : 'radial-gradient(circle at 60% 40%, #181818 80%, #222 100%)'
                if (headlightsCallback) headlightsCallback(headlightsOn)
            })
            } else {
            getBeams().forEach((beam, idx) => setBeamState(idx, headlightsOn))
            headlightsBtn.style.background = headlightsOn
                ? 'radial-gradient(circle at 60% 40%, #222 80%, #333 100%)'
                : 'radial-gradient(circle at 60% 40%, #181818 80%, #222 100%)'
            if (headlightsCallback) headlightsCallback(headlightsOn)
            }
        }
        // Initialize button state
        updateHeadlightsButton(false)
        headlightsBtn.addEventListener('click', () => {
            headlightsOn = !headlightsOn
            updateHeadlightsButton(true)
        })
        panel.appendChild(headlightsBtn)


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
        registerIgnitionCallback,
        registerHeadlightsCallback,
        update,
        setVisible,
        isVisible: () => visible,
        dispose
    }
}
