// script.js (COMPLETE - Version with Phases, Circle, Waveform, Transposition)

// --- Imports ---
import * as pitchy from 'https://esm.sh/pitchy@4.1.0';
console.log("Imported pitchy module:", pitchy);

// --- DOM Elements ---
const selectionPhaseDiv = document.getElementById('selectionPhase');
const lessonPhaseDiv = document.getElementById('lessonPhase');
const startButton = document.getElementById('startButton');
const circleOfFifthsSVG = document.getElementById('circleOfFifths');
const progressionSelect = document.getElementById('progressionSelect');
const tempoSlider = document.getElementById('tempoSlider');
const tempoValueSpan = document.getElementById('tempoValue');
const stopButton = document.getElementById('stopButton');
const lessonInfoSpan = document.getElementById('lessonInfo');
const pitchOutputDiv = document.getElementById('pitchOutput');
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformCtx = waveformCanvas.getContext('2d');
const metronomeToggleButton = document.getElementById('metronomeToggle'); // Added
//const visualPulseElement = document.getElementById('visualPulse');       // Added
//console.log("Initial check - visualPulseElement:", visualPulseElement);
const MIN_DETECTION_FREQUENCY = 73.42

let lastValidPitchHTML = ''; // Store the last good HTML content (note, freq, clarity)
let lastValidKeyStatusClass = ''; // Store the class ('key-status-in' or 'key-status-out')
let lastValidPitchTime = 0; // Timestamp of the last valid update
const PITCH_CLARITY_THRESHOLD = 0.90; // Make threshold a constant
const PITCH_PERSIST_DURATION_MS = 500; // How long (ms) the display should hang

// --- Note Data & Base Progressions ---
// ... (Keep ALL_NOTES, SHARP_NOTES, FLAT_NOTES, etc. as they are) ...
const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // Semitones from root
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural Minor semitones from root
const SHARP_TO_FLAT = {
    "C#": "Db",
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb"
};

const FLAT_TO_SHARP = {
    "Db": "C#",
    "Eb": "D#",
    "Gb": "F#",
    "Ab": "G#",
    "Bb": "A#"
};


const NOTE_TO_MIDI_BASE = { // MIDI numbers for octave 0
    "C": 12, "C#": 13, "Db": 13, "D": 14, "D#": 15, "Eb": 15, "E": 16, "Fb": 16,
    "F": 17, "F#": 18, "Gb": 18, "G": 19, "G#": 20, "Ab": 20, "A": 21, "A#": 22, "Bb": 22,
    "B": 23, "Cb": 23
};
const MIDI_TO_NOTE_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIDI_TO_NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Base Progressions Data (Make sure this is also at the top level)
// ... (Keep baseProgressionsData as it is) ...
const baseProgressionsData = {
    'Major': { // Base these on C Major
        'II-V-I': { name: 'II-V-I', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '2m', chords: [ { time: "0:0:0", note: ["D3", "F3", "A3", "C4"], duration: "2n" }, { time: "0:2:0", note: ["G2", "B2", "D3", "F3"], duration: "2n" }, { time: "1:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" } ] },
        'I-V-vi-IV': { name: 'I-V-vi-IV', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "2:0:0", note: ["A2", "C3", "E3", "G3"], duration: "1m" }, { time: "3:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" } ] },
        'I-IV-V': { name: 'I-IV-V', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" }, { time: "2:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "3:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" } ] }
    },
    'Minor': { // Base these on A Minor (relative minor of C Major for simplicity)
        'ii-V-i (Minor)': { name: 'iiø7-V7-i', baseKeyRoot: 'A', baseKeyQuality: 'Minor', loopEnd: '2m', chords: [ { time: "0:0:0", note: ["B2", "D3", "F3", "A3"], duration: "2n" }, { time: "0:2:0", note: ["E2", "G#2", "B2", "D3"], duration: "2n" }, { time: "1:0:0", note: ["A2", "C3", "E3", "G3"], duration: "1m" } ] },
        'i-VI-III-VII (Minor)': { name: 'i-VI-III-VII (Andalusian)', baseKeyRoot: 'A', baseKeyQuality: 'Minor', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["A2", "C3", "E3"], duration: "1m" }, { time: "1:0:0", note: ["G2", "B2", "D3"], duration: "1m" }, { time: "2:0:0", note: ["F2", "A2", "C3"], duration: "1m" }, { time: "3:0:0", note: ["E2", "G#2", "B2"], duration: "1m" } ] }
    }
};
console.log("baseProgressionsData defined:", baseProgressionsData);


// --- State Variables ---
let isRunning = false; // Add this with other top-level variables
let currentKeyRoot = 'C'; // Default Key Root
let currentKeyQuality = 'Major'; // Default Key Quality
let currentProgressionId = null; // Initialize, will be set during init
let audioContext = null;
let analyserNode = null;
let detector = null;
let mediaStreamSource = null;
let animationFrameId = null; // Store the request ID
let waveformDataArray = null; // To store waveform data buffer
let frequencyAnalyser = null;  // <-- Make sure this exists
let frequencyDataArray = null; // <-- And this one
let isMetronomeOn = false;     // Added Metronome State
let metronome = null;          // Added Tone.Metro object
let metronomeClick = null;     // Added Tone.Synth for click sound
let metronomeEventId = null; // Added to track metronome event


// --- Tone.js Variables ---
let synth = null;
let part = null;
let reverb = null; // Not currently used, but keep if planned
let delay = null;  // Not currently used, but keep if planned


// === NOTE CONVERSION HELPERS ===
// ... (Keep noteNameToMidi, midiToNoteName functions as they are) ...
/**
 * Converts a note name (e.g., "C#4", "Db5") to its MIDI number.
 * @param {string} noteName - The note name.
 * @returns {number|null} The MIDI number or null if invalid.
 */
function noteNameToMidi(noteName) {
    const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
    if (!match) return null;

    const pitch = match[1].toUpperCase();
    const octave = parseInt(match[2], 10);

    const baseMidi = NOTE_TO_MIDI_BASE[pitch];
    if (baseMidi === undefined) return null;

    // MIDI number for octave 0 is baseMidi, add 12 for each octave higher
    return baseMidi + 12 * octave;
}

/**
 * Converts a MIDI number to a note name (e.g., 60 to "C4").
 * Prefers sharps (#) for accidentals.
 * @param {number} midiNumber - The MIDI number.
 * @returns {string|null} The note name or null if invalid.
 */
function midiToNoteName(midiNumber) {
    if (midiNumber < 12 || midiNumber > 127 || !Number.isInteger(midiNumber)) {
        return null;
    }
    const noteIndex = midiNumber % 12;
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteName = MIDI_TO_NOTE_SHARP[noteIndex];
    return noteName + octave;
}


// === TRANSPOSITION FUNCTION ===
// ... (Keep transposeProgression function as it is) ...
/**
 * Transposes an array of chord objects by a given interval.
 * @param {Array<object>} baseChords - The array of chord objects from baseProgressionsData.
 * @param {number} interval - The transposition interval in semitones.
 * @returns {Array<object>} A new array with transposed chord objects.
 */
function transposeProgression(baseChords, interval) {
    if (!baseChords || interval === 0) {
        return baseChords;
    }

    const transposedChords = [];
    for (const chord of baseChords) {
        const transposedNotes = [];
        // Ensure chord.note is actually an array before iterating
        if (Array.isArray(chord.note)) {
            for (const noteName of chord.note) {
                const baseMidi = noteNameToMidi(noteName);
                if (baseMidi !== null) {
                    const transposedMidi = baseMidi + interval;
                    const newNoteName = midiToNoteName(transposedMidi);
                    if (newNoteName) {
                        transposedNotes.push(newNoteName);
                    } else {
                        console.warn(`Could not convert transposed MIDI ${transposedMidi} back to note name.`);
                        transposedNotes.push(noteName); // Keep original if conversion fails
                    }
                } else {
                    console.warn(`Could not convert base note ${noteName} to MIDI.`);
                    transposedNotes.push(noteName); // Keep original if conversion fails
                }
            }
        } else {
             console.warn(`Chord object missing 'note' array:`, chord);
        }
        // Create a new chord object with transposed notes, keeping other properties
        transposedChords.push({
            ...chord, // Copy time, duration, etc.
            note: transposedNotes // Use the (potentially empty) transposed notes array
        });
    }
    return transposedChords;
}


// === GET SCALE NOTES FUNCTION ===
// ... (Keep getScaleNotes function as it is) ...
/**
 * Gets the notes belonging to a specific musical scale.
 * @param {string} rootNote - The root note of the scale (e.g., "C", "F#", "Bb").
 * @param {'Major' | 'Minor'} quality - The quality of the scale.
 * @returns {Set<string>} A Set containing the names of the notes in the scale (e.g., {"C", "D", "E", "F", "G", "A", "B"} for C Major). Returns empty set on error.
 */
function getScaleNotes(rootNote, quality) {
    const scaleNotes = new Set();
    const intervals = quality === 'Major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS; // Uses global constant

    let rootIndex = SHARP_NOTES.indexOf(rootNote); // Uses global constant

     if (rootIndex === -1) {
         const flatIndex = FLAT_NOTES.indexOf(rootNote); // Uses global constant
         if (flatIndex !== -1) {
             rootIndex = flatIndex; // Use the index found in the flat array directly
         }
     }

    if (rootIndex === -1) {
        console.error(`Could not find root note index for: ${rootNote}`);
        return scaleNotes;
    }

    for (const interval of intervals) {
        const noteIndex = (rootIndex + interval) % 12;
        scaleNotes.add(SHARP_NOTES[noteIndex]); // Uses global constant
    }
    // console.log(`Generated scale notes for ${rootNote} ${quality} (using rootIndex ${rootIndex}):`, scaleNotes);
    return scaleNotes;
}


// === FREQUENCY TO NOTE INFO HELPER ===
// ... (Keep frequencyToNoteInfo function as it is) ...
/**
 * Converts a frequency in Hz to the nearest musical note name, octave, and cents deviation.
 * @param {number} frequency - The frequency in Hz.
 * @param {number} a4Frequency - The reference frequency for A4 (usually 440).
 * @returns {{note: string, octave: number, cents: number}|null} - Object with note info, or null if frequency is invalid.
 */
function frequencyToNoteInfo(frequency, a4Frequency = 440.0) {
    if (frequency <= 0 || !isFinite(frequency)) {
        return null;
    }
    // Note: This function defines its own internal noteNames, which is fine,
    // but it uses sharps, matching the output needed for comparison with getScaleNotes
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const midiNumFloat = 12 * (Math.log2(frequency / a4Frequency)) + 69;
    if (!isFinite(midiNumFloat)) {
         return null;
    }
    const midiNumInt = Math.round(midiNumFloat);
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));
    const octave = Math.floor(midiNumInt / 12) - 1;
    const noteIndex = midiNumInt % 12;
    const noteName = noteNames[noteIndex];
    return { note: noteName, octave: octave, cents: cents };
}


// === PITCH DETECTION & DISPLAY ===
// ... (Keep updatePitch and handleUnclearInput functions as they are) ...
function updatePitch() {
    let pitch = 0;
    let clarity = 0;
    const now = performance.now(); // Get current time for persistence check

    try {
        // --- Essential checks ---
        if (!detector || !audioContext || !analyserNode || !isRunning || audioContext.state !== 'running') {
            return;
        }
        if (!waveformDataArray) {
            console.warn("updatePitch: waveformDataArray not ready.");
            return;
        }

        // --- Get Audio Data ---
        // **Correction:** Use analyserNode for pitch, not waveformDataArray directly from it
        const input = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(input);


        // --- Check detector ---
        if (typeof detector.findPitch !== 'function') {
            console.error("updatePitch: detector.findPitch is not a function!");
            pitchOutputDiv.innerHTML = `<span class="error">Pitch detector critical error.</span>`;
            pitchOutputDiv.className = 'pitch-output'; // Reset class
            stopApp();
            return;
        }

        // --- Get Pitch and Clarity ---
        [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);

        // --- Add Frequency Filter ---
        if (pitch < MIN_DETECTION_FREQUENCY) {
            handleUnclearInput(now); // Treat as unclear input
            return; // Exit early
        }

        // --- Process based on Clarity ---
        if (clarity >= PITCH_CLARITY_THRESHOLD) {
            // --- Valid Clarity ---
            const noteInfo = frequencyToNoteInfo(pitch);

            if (noteInfo) {
                // --- Valid Note Info ---
                const noteName = noteInfo.note;
                const octave = noteInfo.octave;
                const centsOff = noteInfo.cents; // Keep cents for display text

                // --- Check Key Status ---
                const scaleNotes = getScaleNotes(currentKeyRoot, currentKeyQuality);
                const isInScale = scaleNotes.has(noteName);
                const currentKeyStatusClass = isInScale ? "key-status-in" : "key-status-out";

                // --- Prepare Display HTML (without background class) ---
                const currentPitchHTML = `
                    <span class="note">${noteName}${octave}</span>
                    <span class="frequency">${pitch.toFixed(2)} Hz (Cents: ${centsOff})</span>
                    <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>
                `;

                // --- Update Last Valid State ---
                lastValidPitchHTML = currentPitchHTML;
                lastValidKeyStatusClass = currentKeyStatusClass;
                lastValidPitchTime = now;

                // --- Apply Updates ---
                pitchOutputDiv.className = `pitch-output ${lastValidKeyStatusClass}`; // Set background class
                pitchOutputDiv.innerHTML = lastValidPitchHTML; // Set content

            } else {
                // --- Invalid Note Info (but good clarity) ---
                // Treat this as unclear input for persistence purposes
                handleUnclearInput(now);
            }

        } else {
            // --- Low Clarity ---
            handleUnclearInput(now);
        }

    } catch (err) {
        // --- Error Handling ---
        console.error("Error during updatePitch execution:", err);
        pitchOutputDiv.innerHTML = `<span class="error">Error updating pitch display.</span>`;
        pitchOutputDiv.className = 'pitch-output'; // Reset class
        lastValidPitchHTML = ''; // Clear persistence on error
        lastValidKeyStatusClass = '';
    }
}

function handleUnclearInput(currentTime) {
    // Check if we have a recent valid reading to persist
    if (lastValidPitchHTML && (currentTime - lastValidPitchTime < PITCH_PERSIST_DURATION_MS)) {
        // --- Persist Display ---
        // Keep the existing HTML and background class
        pitchOutputDiv.className = `pitch-output ${lastValidKeyStatusClass}`;
        pitchOutputDiv.innerHTML = lastValidPitchHTML;
        // Add a subtle indicator that the input is currently weak? (Optional)
        // e.g., slightly dim the output or add a small icon/text
         // Example: pitchOutputDiv.style.opacity = '0.7'; (Remember to reset opacity below)

    } else {
        // --- Reset Display (Persistence expired or never valid) ---
        pitchOutputDiv.innerHTML = `
            <span class="note">---</span>
            <span class="frequency">--- Hz</span>
            <span class="clarity">Clarity: Low</span>
        `;
        pitchOutputDiv.className = 'pitch-output'; // Reset background to default
        // pitchOutputDiv.style.opacity = '1.0'; // Ensure opacity is reset if used above
        // Optionally clear the persisted state if you want it fully reset
        // lastValidPitchHTML = '';
        // lastValidKeyStatusClass = '';
    }
}


// === WAVEFORM DRAWING FUNCTION ===
// ... (Keep drawSpectrum and drawNoteLabels functions as they are) ...
function drawSpectrum() {
    // Add these checks at the start
    if (!frequencyAnalyser || !frequencyDataArray || !waveformCtx || !isRunning) {
        return;
    }

    try {
        frequencyAnalyser.getByteFrequencyData(frequencyDataArray);

        const ctx = waveformCtx;
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;

        // Clear canvas with your dark background
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
        ctx.fillRect(0, 0, width, height);

        const barWidth = (width / frequencyDataArray.length) * 2.5;
        let x = 0;

        // Get computed CSS variables
        const style = getComputedStyle(document.documentElement);
        const color1 = style.getPropertyValue('--spectrum-color-1').trim();
        const color2 = style.getPropertyValue('--spectrum-color-2').trim();
        const color3 = style.getPropertyValue('--spectrum-color-3').trim();

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.5, color2);
        gradient.addColorStop(1, color3);

        for (let i = 0; i < frequencyDataArray.length; i++) {
            const value = frequencyDataArray[i];
            const barHeight = (value / 255) * height;

            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }

        //drawNoteLabels(); // Keep commented out if not using
    } catch (err) {
        console.error("Error in drawSpectrum:", err);
    }
}

function drawNoteLabels() {
    const ctx = waveformCtx;
    const height = waveformCanvas.height;
    const scaleNotes = getScaleNotes(currentKeyRoot, currentKeyQuality);

    // Frequency range (guitar range)
    const minFreq = 82.41; // Low E string
    const maxFreq = 1318.51; // High E fret 12

    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    ALL_NOTES.forEach(note => {
        // Find frequency for this note (A4 = 440Hz reference)
        const midiNote = noteNameToMidi(note + '4');
        if (!midiNote) return;

        const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
        if (freq < minFreq || freq > maxFreq) return;

        // Map frequency to x-position
        const freqRatio = (Math.log(freq) - Math.log(minFreq)) /
                         (Math.log(maxFreq) - Math.log(minFreq));
        const x = freqRatio * waveformCanvas.width;

        // Highlight notes in the current key
        if (scaleNotes.has(note)) {
            ctx.fillStyle = 'var(--accent-color)';
            ctx.fillRect(x - 15, height - 20, 30, 3);
        }

        ctx.fillStyle = 'white';
        ctx.fillText(note, x, height - 10);
    });
}


// === PITCH DETECTION SETUP ===
// ... (Keep setupPitchDetection function as it is) ...
async function setupPitchDetection() {
    if (audioContext && audioContext.state === 'suspended') {
        console.log("Resuming existing audio context for pitch detection.");
        await audioContext.resume();
    }

    // Update this condition to check our new variables
    if (analyserNode && detector && mediaStreamSource && mediaStreamSource.numberOfOutputs > 0 &&
        waveformDataArray && frequencyAnalyser && frequencyDataArray) {
        console.log("Pitch detection components seem to exist and be connected.");
        return true;
    }

    console.log("Running full pitch detection setup...");

    try {
        // Ensure Tone.js context is active
        if (!Tone.context || Tone.context.state !== 'running') {
            console.warn("Tone.js context not running, attempting Tone.start()");
            await Tone.start();
            if (Tone.context.state !== 'running') {
                throw new Error("AudioContext could not be started/resumed.");
            }
        }
        audioContext = Tone.context;

        // Request microphone stream source
        if (!mediaStreamSource) {
            console.log("Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone access granted.");
            if (audioContext.state !== 'running') {
                throw new Error("AudioContext became invalid after getUserMedia.");
            }
            mediaStreamSource = audioContext.createMediaStreamSource(stream);
        }

        // Create Analyser node for pitch detection (large FFT)
        if (!analyserNode) {
            console.log("Creating AnalyserNode for pitch detection...");
            if (audioContext.state !== 'running') {
                throw new Error("AudioContext became invalid before creating AnalyserNode.");
            }
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048; // Large FFT for accurate pitch detection
            // ** Correction: Use Uint8Array or Float32Array consistently **
            // Pitchy needs Float32Array. Let's stick with that.
            // waveformDataArray = new Uint8Array(analyserNode.fftSize); // OLD
            waveformDataArray = new Float32Array(analyserNode.fftSize); // CORRECTED for pitchy
            console.log("Pitch analyser created with buffer size:", analyserNode.fftSize);
        }

        // Create Analyser node for frequency visualization (smaller FFT)
        if (!frequencyAnalyser) {
            console.log("Creating AnalyserNode for frequency visualization...");
            frequencyAnalyser = audioContext.createAnalyser();
            frequencyAnalyser.fftSize = 256; // Smaller FFT for better visualization
            frequencyDataArray = new Uint8Array(frequencyAnalyser.frequencyBinCount);
            console.log("Frequency analyser created with buffer size:", frequencyAnalyser.frequencyBinCount);
        }

        // Connect source to both analysers
        if (mediaStreamSource) {
            try {
                // Disconnect any existing connections first to be safe
                try { mediaStreamSource.disconnect(); } catch (e) {/* ignore if not connected */}

                // Connect to both analysers
                mediaStreamSource.connect(analyserNode);
                mediaStreamSource.connect(frequencyAnalyser);
                console.log("Connected mediaStreamSource to both analysers");
            } catch (e) {
                console.error("Error connecting analysers:", e);
                throw e;
            }
        } else {
            console.error("Cannot connect: mediaStreamSource is null");
             throw new Error("Media stream source is missing."); // Fail fast
        }

        // Create pitch detector
        if (!detector) {
            console.log("Attempting to create PitchDetector...");
            if (!pitchy || !pitchy.PitchDetector || typeof pitchy.PitchDetector.forFloat32Array !== 'function') {
                throw new Error("Pitchy library or PitchDetector.forFloat32Array not loaded correctly.");
            }
            detector = pitchy.PitchDetector.forFloat32Array(analyserNode.fftSize);
            console.log("Pitch detector initialized:", detector);
        }

        return true; // Setup successful

    } catch (err) {
        console.error("Error during pitch detection setup:", err);
        pitchOutputDiv.innerHTML = `<span class="error">Error setting up pitch detection: ${err.message}. Check permissions/console.</span>`;

        // Enhanced cleanup
        if (mediaStreamSource) {
            mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
            try { mediaStreamSource.disconnect(); } catch(e){}
            mediaStreamSource = null;
        }
        if (analyserNode) {
            try { analyserNode.disconnect(); } catch(e) {}
            analyserNode = null;
        }
        if (frequencyAnalyser) {
            try { frequencyAnalyser.disconnect(); } catch(e) {}
            frequencyAnalyser = null;
        }
        waveformDataArray = null;
        frequencyDataArray = null;
        detector = null;
        return false;
    }
}


// === TONE.JS SETUP ===
// ... (Keep setupToneJS function mostly as it is) ...
// We will lazy-create the metronome click synth in startApp or toggleMetronome
function setupToneJS() {
    console.log(`Setting up Tone.js for: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}`);

    // Synth for Chord Progression Playback
    if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, {
            volume: -8, // Quieter for background chords
            envelope: { attack: 0.04, decay: 0.5, sustain: 0.3, release: 0.5 }
        }).toDestination();
        console.log("setupToneJS: Chord Synth created and connected.");
    } else {
         try {
            // No need to disconnect/reconnect if only changing part data
            console.log("setupToneJS: Using existing Chord Synth.");
         } catch (e) {
             console.error("setupToneJS: Error checking synth connection:", e);
             return false;
         }
    }

    // --- Get the BASE progression data ---
    console.log(`DEBUG: Accessing baseProgressionsData[${currentKeyQuality}][${currentProgressionId}]`);
    if (!currentProgressionId || !baseProgressionsData[currentKeyQuality] || !baseProgressionsData[currentKeyQuality][currentProgressionId]) {
       console.error(`Base progression data not found for quality "${currentKeyQuality}" and progression ID "${currentProgressionId}"`);
       pitchOutputDiv.innerHTML = `<span class="error">Error: Could not find selected progression data.</span>`;
       return false;
    }
    const baseProgression = baseProgressionsData[currentKeyQuality][currentProgressionId];
    console.log(`DEBUG: Found baseProgression:`, baseProgression);


    console.log("Using base progression:", baseProgression.name, `(Based on ${baseProgression.baseKeyRoot} ${baseProgression.baseKeyQuality})`);

    // --- Calculate Transposition Interval ---
    const baseRootMidi = noteNameToMidi(baseProgression.baseKeyRoot + '3'); // Use consistent octave for calculation
    const targetRootMidi = noteNameToMidi(currentKeyRoot + '3');
    let transpositionInterval = 0;

    if (baseRootMidi !== null && targetRootMidi !== null) {
        transpositionInterval = targetRootMidi - baseRootMidi;
        console.log(`Transposition: Base=${baseProgression.baseKeyRoot}, Target=${currentKeyRoot}, Interval=${transpositionInterval} semitones.`);
    } else {
        console.error(`Could not calculate transposition interval. Base MIDI: ${baseRootMidi}, Target MIDI: ${targetRootMidi}`);
        transpositionInterval = 0;
        pitchOutputDiv.innerHTML = `<span class="warning">Warning: Could not calculate transposition. Using base key.</span>`;
    }

    // --- Transpose the Chords ---
    const chordsToPlay = transposeProgression(baseProgression.chords, transpositionInterval);
    console.log("setupToneJS: Transposed chords to play:", JSON.stringify(chordsToPlay));


    // Clear previous part events
    if (part) {
        part.clear();
        part.dispose();
        console.log("Cleared and disposed previous Tone.Part");
        part = null;
    }

    // Create a new Part
    try {
        if (!Array.isArray(chordsToPlay) || chordsToPlay.length === 0) {
             console.error("setupToneJS: chordsToPlay array is invalid or empty before creating Tone.Part.", chordsToPlay);
             throw new Error("Cannot create Tone.Part with invalid chord data.");
        }
        for(const chordEvent of chordsToPlay) {
            if (!chordEvent || typeof chordEvent !== 'object' || !Array.isArray(chordEvent.note) || chordEvent.note.length === 0) {
                 console.error("setupToneJS: Invalid chord event structure in chordsToPlay:", chordEvent);
                 throw new Error("Invalid chord event structure found.");
            }
        }

        console.log("setupToneJS: Creating Tone.Part with valid chords array.");
        part = new Tone.Part((time, event) => {
            // Ensure synth exists and event is valid before triggering
            if (synth && event && event.note && event.duration) {
                 if (Array.isArray(event.note) && event.note.length > 0) {
                      // Check synth state? Maybe not needed if created once.
                      synth.triggerAttackRelease(event.note, event.duration, time);
                 } else {
                      console.warn("Skipping Tone.Part event: Invalid note array.", event);
                 }
            } else {
                console.warn("Skipping invalid event in Tone.Part callback. Synth ready?", !!synth, "Event:", event);
            }
        }, chordsToPlay);

        part.loop = true;
        part.loopStart = 0;
        part.loopEnd = baseProgression.loopEnd;
        Tone.Transport.timeSignature = [4, 4]; // Ensure 4/4 time signature
        console.log("setupToneJS: Tone.Part created successfully.");

    } catch (e) {
        console.error("Error creating Tone.Part:", e);
        console.error("Chords data that caused error:", JSON.stringify(chordsToPlay));
        pitchOutputDiv.innerHTML = `<span class="error">Error setting up playback sequence.</span>`;
        return false;
    }

    console.log("Tone.js components setup/updated for new key/progression.");
    return true;
}

// === NEW: METRONOME TOGGLE FUNCTION ===
// === NEW/UPDATED: METRONOME TOGGLE FUNCTION ===
function toggleMetronome() {
    isMetronomeOn = !isMetronomeOn; // Toggle the state

    if (isMetronomeOn) {
        metronomeToggleButton.textContent = 'Metronome ON';
        metronomeToggleButton.style.backgroundColor = 'var(--accent-color)'; // Indicate ON state

        // Start metronome *scheduling* if the main app is already running
        if (isRunning) {
            startMetronomeScheduling(); // Call helper to setup/schedule
        }
    } else {
        metronomeToggleButton.textContent = 'Metronome OFF';
        metronomeToggleButton.style.backgroundColor = 'var(--secondary-color)'; // Indicate OFF state

        // Stop metronome *scheduling* if it exists
        // --- THIS IS THE CORRECTED LINE ---
        stopMetronomeScheduling(); // Call helper to stop/cleanup (MUST match the function name)
        // --- END CORRECTION ---
    }
    console.log(`Metronome toggled: ${isMetronomeOn ? 'ON' : 'OFF'}`);
}

// === UPDATED: METRONOME SCHEDULING START LOGIC ===
// This function now uses the top-level 'metronomeEventId' variable

function startMetronomeScheduling() {
    // Prevent duplicate scheduling if already running
    if (metronomeEventId !== null) {
        console.log("Metronome event already scheduled (ID:", metronomeEventId, "). Doing nothing.");
        return;
    }

    console.log("Attempting to start metronome scheduling...");

    // Create the click sound synth if it doesn't exist
    if (!metronomeClick) {
        try {
            metronomeClick = new Tone.MembraneSynth({
                pitchDecay: 0.008,
                octaves: 7,
                envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
                volume: 0 // Using louder volume
            }).toDestination();
            console.log("Metronome click synth created.");
        } catch (synthError) {
            console.error("!!! Failed to create metronome click synth:", synthError);
            metronomeToggleButton.textContent = 'Metronome ERR';
            metronomeToggleButton.style.backgroundColor = 'red';
            isMetronomeOn = false;
            return;
        }
    } else {
        console.log("Using existing metronome click synth.");
    }

    // Schedule the repeating event
    try {
        console.log("Calling Tone.Transport.scheduleRepeat('4n')...");
        metronomeEventId = Tone.Transport.scheduleRepeat((time) => {
            // Callback runs every quarter note

            // --- Calculate current beat number (with detailed logging) ---
            let beatInMeasure = -1; // Default to invalid beat
            let isDownbeat = false;
            let noteToPlay = "C4"; // Default note

            try {
                const ticks = Tone.Transport.getTicksAtTime(time);
                const ppq = Tone.Transport.PPQ;
                let beatsPerMeasure = 4; // Default
                let beatUnit = 4;      // Default (denominator for quarter note beat)

                // Robustly get time signature
                const ts = Tone.Transport.timeSignature;
                if (typeof ts === 'number') {
                    beatsPerMeasure = ts; // e.g., ts = 3 means 3/4
                } else if (Array.isArray(ts) && ts.length >= 2) {
                    beatsPerMeasure = ts[0]; // Numerator
                    beatUnit = ts[1];      // Denominator
                }

                // Calculate ticks per beat based on the denominator
                const ticksPerBeat = ppq * (4 / beatUnit); // e.g., if beatUnit is 4 (quarter), 4/4 = 1. If 8 (eighth), 4/8 = 0.5
                const ticksPerMeasure = ticksPerBeat * beatsPerMeasure;

                // --- Log the intermediate calculation values ---
                // console.log(`DEBUG Tick Calc: Time=${time.toFixed(3)}, Ticks=${ticks}, PPQ=${ppq}, BeatsPerMeasure=${beatsPerMeasure}, BeatUnit=${beatUnit}, TicksPerBeat=${ticksPerBeat}, TicksPerMeasure=${ticksPerMeasure}`);

                // Ensure ticksPerMeasure is valid before using modulo
                if (ticks >= 0 && ticksPerMeasure > 0 && ticksPerBeat > 0) {
                    // Calculate beat index (0-based)
                    beatInMeasure = Math.floor((ticks % ticksPerMeasure) / ticksPerBeat);
                    // Check for potential floating point issues close to the boundary
                    // If very close to 0, treat as 0. Example threshold:
                    const epsilon = 0.001 * ticksPerBeat; // Small fraction of a beat
                    if ((ticks % ticksPerMeasure) < epsilon && (ticks % ticksPerMeasure) >= 0) {
                         beatInMeasure = 0;
                         // console.log(`DEBUG Tick Calc: Corrected near-zero tick remainder to beat 0`);
                    }

                    isDownbeat = (beatInMeasure === 0);
                    noteToPlay = isDownbeat ? "G4" : "C4";
                } else {
                     console.warn(`DEBUG Tick Calc: Invalid calculation inputs. Ticks=${ticks}, TicksPerMeasure=${ticksPerMeasure}, TicksPerBeat=${ticksPerBeat}`);
                     // Keep default note C2
                }

            } catch (calcError) {
                 console.error("Error during beat calculation:", calcError);
                 // Keep default note C2
            }

            // --- Log the final decision ---
            console.log(`Metronome Tick: Time=${time.toFixed(3)}, Beat=${beatInMeasure}, Downbeat=${isDownbeat}, Note=${noteToPlay}`);


            // 1. Play sound
            if (metronomeClick) {
                try {
                     metronomeClick.triggerAttackRelease(noteToPlay, "16n", time, 1);
                     // console.log(`Callback: Triggered ${noteToPlay}.`); // Keep this log minimal now
                } catch (clickError) {
                    console.warn("Error triggering metronome sound:", clickError);
                }
            }

            // === START: Delete this entire block ===
        // 2. Visual Pulse
        /*
        Tone.Draw.schedule(() => {
            if (visualPulseElement) {
                visualPulseElement.classList.add('pulsing');
                setTimeout(() => {
                    if (visualPulseElement) { visualPulseElement.classList.remove('pulsing'); }
                }, 160);
            }
        }, time);
        */
       // === END: Delete this entire block ===

        }, "4n"); // Interval: quarter note

        // Check returned ID
        if (typeof metronomeEventId !== 'number') {
             console.warn("Tone.Transport.scheduleRepeat might not have returned a valid ID:", metronomeEventId);
             if (metronomeEventId === null || metronomeEventId === undefined){
                 throw new Error("Tone.Transport.scheduleRepeat failed to return an event ID.");
             }
        }
        console.log(`Metronome event successfully scheduled with ID: ${metronomeEventId}, repeating every 4n.`);

    } catch (scheduleError) {
        console.error("!!! Error during Tone.Transport.scheduleRepeat:", scheduleError);
        metronomeEventId = null;
        metronomeToggleButton.textContent = 'Metronome ERR';
        metronomeToggleButton.style.backgroundColor = 'red';
        isMetronomeOn = false;
    }
}



// === NEW: METRONOME STOP LOGIC HELPER ===
function stopMetronomeScheduling() {
    // Only clear if an event is actually scheduled
    if (metronomeEventId !== null) {
        console.log(`Stopping metronome scheduling (clearing event ID: ${metronomeEventId})...`);
        Tone.Transport.clear(metronomeEventId); // Clear the specific scheduled event
        metronomeEventId = null; // Reset the ID
        console.log("Metronome scheduled event cleared.");
    } else {
        console.log("No active metronome event to stop.");
    }

    // === START: Delete these lines ===
    /*
    // Reset visual pulse just in case it got stuck
    if (visualPulseElement) {
        visualPulseElement.classList.remove('pulsing');
        // Optional: Force remove animation styles if needed
        // visualPulseElement.style.animation = 'none';
    }
    */
   // === END: Delete these lines ===

    // Do NOT dispose of metronomeClick synth here, keep it for reuse
}

// === MAIN CONTROL FUNCTIONS (MODIFIED for new Metronome logic) ===
async function startApp() {
    if (isRunning) return;
    console.log("startApp: Entered");
    startButton.disabled = true;
    startButton.textContent = 'Starting...';

    try {
        // Start/Resume Tone.js Audio Context FIRST
        console.log("startApp: Attempting Tone.start()...");
        await Tone.start();
        console.log('startApp: Tone.start() completed. Context state:', Tone.context.state);

        const currentTempo = parseInt(tempoSlider.value, 10);
        console.log(`startApp: Starting with: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}, Tempo=${currentTempo} BPM`);
        Tone.Transport.bpm.value = currentTempo;

        // Set up Tone.js playback components (Chord Progression)
        console.log("startApp: Calling setupToneJS...");
        const toneSetupSuccess = setupToneJS();
        console.log("startApp: setupToneJS returned:", toneSetupSuccess);
        if (!toneSetupSuccess) {
            throw new Error("Failed Tone setup for chords. Check logs.");
        }

        // Set up Pitch Detection components
        console.log("startApp: Calling setupPitchDetection...");
        const pitchSetupSuccess = await setupPitchDetection();
        console.log("startApp: setupPitchDetection returned:", pitchSetupSuccess);
        if (!pitchSetupSuccess) {
             // Cleanup Tone.js if pitch fails
             if (Tone.Transport.state === 'started') { Tone.Transport.stop(); Tone.Transport.cancel(0); }
             if (part) { part.stop(); part.dispose(); part = null;}
             throw new Error("Failed Pitch Detection setup. Check mic permissions.");
        }

        // Switch UI Phases FIRST (to show progress)
        selectionPhaseDiv.classList.add('hidden');
        lessonPhaseDiv.classList.remove('hidden');
        console.log("startApp: Switched to Lesson Phase");

        // Update Lesson Info Display
        const currentProgressionName = baseProgressionsData[currentKeyQuality]?.[currentProgressionId]?.name || 'Unknown';
        lessonInfoSpan.textContent = `${currentProgressionName} in ${currentKeyRoot} ${currentKeyQuality} at ${currentTempo} BPM`;
        console.log("startApp: Updated lesson info span.");

        // Start Tone Transport & Chord Part
        console.log("startApp: Resetting and starting Transport...");
        // Ensure transport is stopped and cleared before restarting
        if (Tone.Transport.state === 'started') { Tone.Transport.stop(); }
        Tone.Transport.cancel(0); // Clear ALL previous events before scheduling new ones
        Tone.Transport.position = 0; // Reset transport position

        // Schedule the Chord Part first
        if (!part) { throw new Error("Tone.Part object is null or undefined after setup."); }
        console.log("startApp: Starting Tone Part (for chords)...");
        part.start(0); // Start the chord progression part relative to transport start
        console.log("startApp: Chord Part scheduled with start(0).");

        // === Metronome Scheduling (if ON) ===
        if (isMetronomeOn) {
             startMetronomeScheduling(); // Setup and schedule the metronome clicks
        }
        // === End Metronome Scheduling ===

        // NOW Start the Transport
        Tone.Transport.start("+0.1"); // Start transport slightly ahead
        console.log("startApp: Transport state after start:", Tone.Transport.state);


         // Reset pitch persistence state at the start
        lastValidPitchHTML = '';
        lastValidKeyStatusClass = '';
        lastValidPitchTime = 0;
        pitchOutputDiv.className = 'pitch-output'; // Ensure default class on start
        pitchOutputDiv.innerHTML = 'Listening...'; // Initial message

        // Start Animation Loop (Pitch Update & Spectrum)
        isRunning = true; // Set running flag HERE, after successful setup
        let lastUpdateTime = 0;
        const updateIntervalMs = 50; // Target ~20fps for updates

        function animationLoop(currentTime) {
            if (!isRunning) return; // Check flag at the start of each loop
            animationFrameId = requestAnimationFrame(animationLoop);

            const deltaTime = currentTime - lastUpdateTime;
            // Only update pitch if enough time has passed
            if (deltaTime >= updateIntervalMs) {
                updatePitch();
                lastUpdateTime = currentTime;
            }

            drawSpectrum(); // Draw spectrum visualization on every frame
        }

        animationFrameId = requestAnimationFrame(animationLoop); // Start the loop
        console.log("startApp: Started animation loop.");

        // Update UI State (Lesson Phase Active)
        stopButton.disabled = false;
        // pitchOutputDiv.innerHTML = 'Listening...'; // Already set above
        // pitchOutputDiv.className = 'pitch-output'; // Already set above

        console.log("Application started successfully.");

    } catch (err) {
        console.error("Error starting the application:", err);
        lessonInfoSpan.textContent = "Error";
        pitchOutputDiv.innerHTML = `<span class="error">Failed to start: ${err.message}. Check console.</span>`;
        pitchOutputDiv.className = 'pitch-output';
        stopApp(); // Attempt cleanup (stopApp should handle partial failures)
    } finally {
        // Ensure start button is re-enabled if something failed *before* isRunning was set true
         if (!isRunning) {
             startButton.disabled = false;
             startButton.textContent = 'Start Practice';
         }
    }
}

function stopApp() {
    // Prevent multiple stops
    if (!isRunning && Tone.Transport.state !== 'started' && !animationFrameId && metronomeEventId === null) {
        console.log("Stop requested, but appears already stopped.");
        // Ensure UI is in correct state even if already stopped
        lessonPhaseDiv.classList.add('hidden');
        selectionPhaseDiv.classList.remove('hidden');
        startButton.disabled = false;
        startButton.textContent = 'Start Practice';
        stopButton.disabled = true;
        return;
    }
    console.log("Stop button clicked or stopApp called.");

    isRunning = false; // Set running flag to false immediately

    // Stop Animation Loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled animation frame loop.");
    }

    // === Stop Metronome Scheduling FIRST ===
    stopMetronomeScheduling(); // Cleanup metronome schedule
    // === End Stop Metronome Scheduling ===


    // Stop Tone.js Transport and Clear All Events (including Chord Part)
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop(); // Stop the transport
        Tone.Transport.cancel(0); // Cancel ALL scheduled events (metronome and part)
        console.log("Tone.js Transport stopped and ALL events cancelled.");
    } else {
        // Even if not started, cancel events to be safe
        Tone.Transport.cancel(0);
        console.log("Tone.js Transport was already stopped, but cancelled any pending events.");
    }

    // Dispose the Chord Part object if it exists
    if (part) {
        // part.stop(0); // No need to stop explicitly if transport is stopped/cancelled
        part.dispose(); // Clean up the part object
        part = null;
        console.log("Tone.js Chord Part disposed.");
    }

    // Stop Microphone and Analysers
    if (mediaStreamSource) {
        mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
        try { mediaStreamSource.disconnect(); } catch (e) { console.warn("Error disconnecting mediaStreamSource:", e); }
        mediaStreamSource = null; // Reset for next start
        console.log("Microphone stream stopped and source disconnected.");
    }
    if (analyserNode) {
        try { analyserNode.disconnect(); } catch (e) { console.warn("Error disconnecting analyserNode:", e); }
        analyserNode = null; // Reset for next start
        waveformDataArray = null; // Reset buffer
        console.log("Pitch AnalyserNode disconnected and reset.");
    }
     if (frequencyAnalyser) { // Also reset the frequency analyser
        try { frequencyAnalyser.disconnect(); } catch (e) { console.warn("Error disconnecting frequencyAnalyser:", e); }
        frequencyAnalyser = null;
        frequencyDataArray = null;
        console.log("Frequency AnalyserNode disconnected and reset.");
    }
    if (detector) {
        detector = null; // Reset pitch detector
        console.log("Pitchy detector reset.");
    }

    // Switch UI Phases
    lessonPhaseDiv.classList.add('hidden');
    selectionPhaseDiv.classList.remove('hidden');
    console.log("Switched to Selection Phase");

    // Clear pitch persistence state on stop
    lastValidPitchHTML = '';
    lastValidKeyStatusClass = '';

    // Update UI State (Selection Phase Active)
    startButton.disabled = false;
    startButton.textContent = 'Start Practice';
    stopButton.disabled = true;
    // Do NOT change metronome button text here - keep its ON/OFF state persistent

    // Clear lesson phase displays
    pitchOutputDiv.innerHTML = 'Stopped.';
    pitchOutputDiv.className = 'pitch-output'; // Reset class

    // Clear the waveform canvas
    if(waveformCtx) {
      waveformCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim();
      waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }

    console.log("Application stopped cleanly.");
}


// === CIRCLE OF FIFTHS ===
const MAJOR_KEYS_CIRCLE = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const MINOR_KEYS_CIRCLE = ["A", "E", "B", "F#", "C#", "G#", "D#", "Bb", "F", "C", "G", "D"];

function createCircleOfFifths() {
    const svgNS = "http://www.w3.org/2000/svg";
    const center = 50;
    const numSegments = 12;
    const angleStep = 360 / numSegments;
    const outerMajorRadius = 48;
    const innerMajorRadius = 36;
    const outerMinorRadius = 34;
    const innerMinorRadius = 22;

    circleOfFifthsSVG.innerHTML = ''; // Clear previous SVG content

    for (let i = 0; i < numSegments; i++) {
        // Calculate angles for the segment
        const angleStart = i * angleStep - 90 - (angleStep / 2); // Start angle in degrees, adjusted for top alignment
        const angleEnd = angleStart + angleStep;                 // End angle in degrees
        const midAngle = angleStart + angleStep / 2;             // Mid angle for label placement
        const largeArcFlag = 0; // Arc segments are less than 180 degrees

        // --- Major Key Segment ---
        const majorKeyName = MAJOR_KEYS_CIRCLE[i];
        // Define the SVG path data for the major segment arc
        const pathMajor = `
            M ${center + outerMajorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + outerMajorRadius * Math.sin(angleStart * Math.PI / 180)}
            A ${outerMajorRadius} ${outerMajorRadius} 0 ${largeArcFlag} 1 ${center + outerMajorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + outerMajorRadius * Math.sin(angleEnd * Math.PI / 180)}
            L ${center + innerMajorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + innerMajorRadius * Math.sin(angleEnd * Math.PI / 180)}
            A ${innerMajorRadius} ${innerMajorRadius} 0 ${largeArcFlag} 0 ${center + innerMajorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + innerMajorRadius * Math.sin(angleStart * Math.PI / 180)}
            Z`; // Corrected: Use angleStart here
        const segmentMajor = document.createElementNS(svgNS, 'path');
        segmentMajor.setAttribute('d', pathMajor); // Use the corrected path directly
        segmentMajor.setAttribute('class', 'key-segment-major');
        segmentMajor.setAttribute('data-key', majorKeyName);
        segmentMajor.setAttribute('data-quality', 'Major');
        segmentMajor.addEventListener('click', () => handleCircleClick(majorKeyName, 'Major', segmentMajor));
        circleOfFifthsSVG.appendChild(segmentMajor);

        // --- Minor Key Segment ---
        const minorKeyName = MINOR_KEYS_CIRCLE[i];
        // Define the SVG path data for the minor segment arc
        const pathMinor = `
            M ${center + outerMinorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + outerMinorRadius * Math.sin(angleStart * Math.PI / 180)}
            A ${outerMinorRadius} ${outerMinorRadius} 0 ${largeArcFlag} 1 ${center + outerMinorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + outerMinorRadius * Math.sin(angleEnd * Math.PI / 180)}
            L ${center + innerMinorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + innerMinorRadius * Math.sin(angleEnd * Math.PI / 180)}
            A ${innerMinorRadius} ${innerMinorRadius} 0 ${largeArcFlag} 0 ${center + innerMinorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + innerMinorRadius * Math.sin(angleStart * Math.PI / 180)}
            Z`; // Corrected: Use angleStart here
        const segmentMinor = document.createElementNS(svgNS, 'path');
        segmentMinor.setAttribute('d', pathMinor); // Use the corrected path directly
        segmentMinor.setAttribute('class', 'key-segment-minor');
        segmentMinor.setAttribute('data-key', minorKeyName);
        segmentMinor.setAttribute('data-quality', 'Minor');
        segmentMinor.addEventListener('click', () => handleCircleClick(minorKeyName, 'Minor', segmentMinor));
        circleOfFifthsSVG.appendChild(segmentMinor);

        // --- Major Key Label ---
        const majorLabelRadius = (outerMajorRadius + innerMajorRadius) / 2;
        // Calculate position for the label within the major segment
        const majorLabelX = center + majorLabelRadius * Math.cos(midAngle * Math.PI / 180);
        const majorLabelY = center + majorLabelRadius * Math.sin(midAngle * Math.PI / 180);
        const majorText = document.createElementNS(svgNS, 'text');
        majorText.setAttribute('x', majorLabelX);
        majorText.setAttribute('y', majorLabelY);
        majorText.setAttribute('class', 'key-label'); // Use CSS class for styling
        majorText.textContent = majorKeyName;
        circleOfFifthsSVG.appendChild(majorText);

        // --- Minor Key Label ---
        const minorLabelRadius = (outerMinorRadius + innerMinorRadius) / 2;
        // Calculate position for the label within the minor segment
        const minorLabelX = center + minorLabelRadius * Math.cos(midAngle * Math.PI / 180);
        const minorLabelY = center + minorLabelRadius * Math.sin(midAngle * Math.PI / 180);
        const minorText = document.createElementNS(svgNS, 'text');
        minorText.setAttribute('x', minorLabelX);
        minorText.setAttribute('y', minorLabelY);
        minorText.setAttribute('class', 'key-label minor'); // Use CSS class, add 'minor' for specific styling if needed
        minorText.textContent = minorKeyName + 'm'; // Add 'm' for minor keys
        circleOfFifthsSVG.appendChild(minorText);
    }
}


function handleCircleClick(keyName, quality, clickedSegment) {
    console.log(`Circle segment clicked: Key=${keyName}, Quality=${quality}`);
    currentKeyRoot = keyName;
    currentKeyQuality = quality;
    highlightCircleSegment(keyName, quality, clickedSegment);
    populateProgressionSelect();
}

function highlightCircleSegment(keyToHighlight, qualityToHighlight, segmentToHighlight) {
    document.querySelectorAll('#circleOfFifths .key-segment-major.selected, #circleOfFifths .key-segment-minor.selected').forEach(el => {
        el.classList.remove('selected');
    });

    if (segmentToHighlight) {
        segmentToHighlight.classList.add('selected');
        console.log(`Highlighted segment for: ${keyToHighlight} ${qualityToHighlight}`);
    } else {
        // Find segment programmatically if not passed directly (e.g., on init)
        const qualityClass = qualityToHighlight.toLowerCase(); // 'major' or 'minor'
        const selector = `.key-segment-${qualityClass}[data-key="${keyToHighlight}"]`;
        const segment = document.querySelector(selector);
        if (segment) {
            segment.classList.add('selected');
            console.log(`Initial highlight set via selector for: ${keyToHighlight} ${qualityToHighlight}`);
        } else {
             console.warn(`Could not find segment for highlight: Key=${keyToHighlight}, Quality=${qualityToHighlight}`);
        }
    }
}


// === Event Listeners (MODIFIED) ===
startButton.addEventListener('click', startApp);
stopButton.addEventListener('click', stopApp);

// Tempo Slider Listener (MODIFIED - NO LONGER updates metronome frequency directly)
tempoSlider.addEventListener('input', (event) => {
    const newTempo = parseInt(event.target.value, 10);
    tempoValueSpan.textContent = newTempo;
    Tone.Transport.bpm.value = newTempo; // Update transport BPM immediately
    // NOTE: scheduleRepeat frequency is tied to BPM, so it adjusts automatically.
    // No need to manually update metronome frequency here.
    console.log(`Transport BPM updated to: ${newTempo}`);
});

progressionSelect.addEventListener('change', (event) => {
    if (event.target.value) {
         currentProgressionId = event.target.value;
         console.log(`Progression selection changed to: ${currentProgressionId}`);
         // If running, could potentially update the chord part immediately
         // but stopping and restarting is simpler for now.
    } else {
         console.warn("Progression selection changed to an empty value.");
         currentProgressionId = null;
    }
});

// NEW: Metronome Toggle Button Listener
metronomeToggleButton.addEventListener('click', toggleMetronome);


// === Initialization Functions (MODIFIED) ===
function populateProgressionSelect() {
    progressionSelect.innerHTML = '';
    console.log(`Populating progressions for quality: ${currentKeyQuality}`);

    if (!baseProgressionsData || typeof baseProgressionsData !== 'object') {
        console.error("CRITICAL: baseProgressionsData is not defined or not an object!");
        progressionSelect.disabled = true;
        const option = document.createElement('option');
        option.textContent = "--- ERROR ---";
        option.disabled = true;
        progressionSelect.appendChild(option);
        currentProgressionId = null;
        return;
    }

    const qualityData = baseProgressionsData[currentKeyQuality];

    if (!qualityData || Object.keys(qualityData).length === 0) {
        console.warn("Cannot populate progressions: No data found for", currentKeyQuality);
        const option = document.createElement('option');
        option.textContent = "--- No Progressions ---";
        option.disabled = true;
        progressionSelect.appendChild(option);
        currentProgressionId = null;
        progressionSelect.disabled = true;
        return;
    }

    progressionSelect.disabled = false;
    const progressionIds = Object.keys(qualityData);
    let firstProgId = null; // Keep track of the first valid ID

    progressionIds.forEach(progId => {
        if (!firstProgId) firstProgId = progId; // Store the first one
        const option = document.createElement('option');
        option.value = progId;
        // Use the 'name' property for display text
        option.textContent = qualityData[progId]?.name || progId; // Fallback to ID if name missing
        progressionSelect.appendChild(option);
    });

    // Set the default selected progression ID robustly
    if (progressionSelect.options.length > 0) {
        // If currentProgressionId is already set and valid for this quality, keep it
        if (currentProgressionId && qualityData[currentProgressionId]) {
            progressionSelect.value = currentProgressionId;
        } else {
            // Otherwise, default to the first progression in the list
            currentProgressionId = firstProgId;
            progressionSelect.value = currentProgressionId;
             console.log(`Defaulting progression selection to first available: ${currentProgressionId}`);
        }
    } else {
        // No progressions available
        currentProgressionId = null;
    }


    console.log(`Populated progressions for ${currentKeyQuality}. Current ID set to: '${currentProgressionId}'`);
}

function initializeApp() {
    console.log("Initializing App...");
    lessonPhaseDiv.classList.add('hidden');
    selectionPhaseDiv.classList.remove('hidden');
    stopButton.disabled = true;
    startButton.disabled = false;
    startButton.textContent = 'Start Practice';

    tempoValueSpan.textContent = tempoSlider.value; // Set initial tempo display

    createCircleOfFifths();

    // Use the default state variables for initial highlight and populate
    highlightCircleSegment(currentKeyRoot, currentKeyQuality);
    populateProgressionSelect(); // Populate based on initial quality and SETS currentProgressionId

    // Set initial Metronome Button State
    metronomeToggleButton.textContent = isMetronomeOn ? 'Metronome ON' : 'Metronome OFF';
    metronomeToggleButton.style.backgroundColor = isMetronomeOn ? 'var(--accent-color)' : 'var(--secondary-color)';
    //visualPulseElement.classList.remove('pulsing'); // Ensure pulse isn't stuck

    pitchOutputDiv.innerHTML = 'Select Key & Progression, then Start';
    pitchOutputDiv.className = 'pitch-output'; // Ensure base class is set initially

    console.log("App Initialized. Default Key Root:", currentKeyRoot, "Default Quality:", currentKeyQuality, "Default Prog:", currentProgressionId);
}


// Optional: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        console.log("Page hidden, stopping application to conserve resources.");
        stopApp(); // Call stopApp to clean up audio context etc.
    }
});

// --- Run Initialization ---
try {
    initializeApp();
} catch (error) {
    console.error("Error during initialization:", error);
    document.body.innerHTML = `<h1 style="color: red;">Initialization Error</h1><p>Could not initialize the application. Check the console for details.</p><pre>${error.stack}</pre>`;
}

console.log("Full script loaded. UI should be ready.");