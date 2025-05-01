// script.js (COMPLETE - Version with Phases, Circle, Waveform, Transposition)

// --- Imports ---
import * as pitchy from 'https://esm.sh/pitchy@4.1.0';
console.log("Imported pitchy module:", pitchy);

// --- DOM Elements ---
const selectionPhaseDiv = document.getElementById('selectionPhase');
const lessonPhaseDiv = document.getElementById('lessonPhase');

// Selection Phase Elements
const startButton = document.getElementById('startButton');
const circleOfFifthsSVG = document.getElementById('circleOfFifths');
const keyQualitySelect = document.getElementById('keyQualitySelect');
const progressionSelect = document.getElementById('progressionSelect');
const tempoSlider = document.getElementById('tempoSlider');
const tempoValueSpan = document.getElementById('tempoValue');

// Lesson Phase Elements
const stopButton = document.getElementById('stopButton');
const lessonInfoSpan = document.getElementById('lessonInfo');
const pitchOutputDiv = document.getElementById('pitchOutput');
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformCtx = waveformCanvas.getContext('2d');
let waveformDataArray = null; // To store waveform data buffer

// --- Note Data & Base Progressions ---
const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_TO_MIDI_BASE = { // MIDI numbers for octave 0
    "C": 12, "C#": 13, "Db": 13, "D": 14, "D#": 15, "Eb": 15, "E": 16, "Fb": 16,
    "F": 17, "F#": 18, "Gb": 18, "G": 19, "G#": 20, "Ab": 20, "A": 21, "A#": 22, "Bb": 22,
    "B": 23, "Cb": 23
};
const MIDI_TO_NOTE_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIDI_TO_NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// !! CRITICAL: Ensure this object is defined correctly !!
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
// Add console log right after definition to verify it exists in scope
console.log("baseProgressionsData defined:", baseProgressionsData);


// --- State Variables ---
let isRunning = false;
let currentKeyRoot = 'C'; // Default Key Root
let currentKeyQuality = 'Major'; // Default Key Quality
let currentProgressionId = null; // Initialize, will be set during init
let audioContext = null;
let analyserNode = null;
let detector = null;
let mediaStreamSource = null;
let animationFrameId = null; // Store the request ID

// --- Tone.js Variables ---
let synth = null;
let part = null;
let reverb = null;
let delay = null;

// === NOTE CONVERSION HELPERS ===
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


// === PITCHY HELPER FUNCTIONS ===
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
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; // Sharp preference
    const midiNumFloat = 12 * (Math.log2(frequency / a4Frequency)) + 69; // 69 is MIDI for A4
    if (!isFinite(midiNumFloat)) {
         return null;
    }
    const midiNumInt = Math.round(midiNumFloat);
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));

    // Calculate note name and octave from MIDI integer
    const octave = Math.floor(midiNumInt / 12) - 1;
    const noteIndex = midiNumInt % 12;
    const noteName = noteNames[noteIndex];

    return { note: noteName, octave: octave, cents: cents };
}


// === PITCH DETECTION & DISPLAY ===
function updatePitch() {
    let pitch = 0;
    let clarity = 0;
    try {
        if (!detector || !audioContext || !analyserNode || !isRunning || audioContext.state !== 'running') {
            return; // Exit if detection isn't ready or running
        }
        if (!waveformDataArray) return; // Need the buffer

        // Use getFloatTimeDomainData for Pitchy
        const input = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(input);

        if (typeof detector.findPitch !== 'function') {
             console.error("updatePitch: detector.findPitch is not a function!");
             pitchOutputDiv.innerHTML = `<span class="error">Pitch detector error.</span>`;
             stopApp(); // Stop if detector fails fundamentally
             return;
        }

        [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);

        // Update Pitch Output Div
        if (clarity > 0.90) { // Clarity threshold
            const noteInfo = frequencyToNoteInfo(pitch);
            if (!noteInfo) {
                 pitchOutputDiv.innerHTML = `
                    <span class="note">...</span>
                    <span class="frequency">${pitch > 0 ? pitch.toFixed(2) + ' Hz' : '--- Hz'}</span>
                    <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>
                 `;
                 pitchOutputDiv.className = ''; // Reset color class
                 return;
            }
            const noteName = noteInfo.note;
            const octave = noteInfo.octave;
            const centsOff = noteInfo.cents;

            // Apply color feedback classes
             pitchOutputDiv.className = ''; // Clear previous classes
             const absCents = Math.abs(centsOff);
             if (absCents <= 10) pitchOutputDiv.classList.add('in-tune');
             else if (absCents <= 25) pitchOutputDiv.classList.add('slightly-off');
             else pitchOutputDiv.classList.add('off');

            // Display info
            pitchOutputDiv.innerHTML = `
                <span class="note">${noteName}${octave}</span>
                <span class="frequency">${pitch.toFixed(2)} Hz (Cents: ${centsOff})</span>
                <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>
            `;
        } else {
             // Low clarity
             pitchOutputDiv.className = ''; // Reset color
             pitchOutputDiv.innerHTML = `
                 <span class="note">---</span>
                 <span class="frequency">--- Hz</span>
                 <span class="clarity">Clarity: ${clarity.toFixed(2)} (Low)</span>
            `;
        }
    } catch (err) {
        console.error("Error during updatePitch:", err);
        pitchOutputDiv.innerHTML = `<span class="error">Error detecting pitch. Check console.</span>`;
        pitchOutputDiv.className = ''; // Reset background on error
    }
}

// === WAVEFORM DRAWING FUNCTION ===
function drawWaveform() {
    if (!analyserNode || !waveformCtx || !waveformDataArray || !isRunning) {
        return; // Exit if drawing isn't ready or running
    }

    // Get the time domain data (Byte for visual waveform is fine)
    analyserNode.getByteTimeDomainData(waveformDataArray);

    // Clear the canvas
    waveformCtx.fillStyle = 'var(--input-bg)';
    waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    // Set line style
    waveformCtx.lineWidth = 2;
    waveformCtx.strokeStyle = 'var(--accent-color)';
    waveformCtx.beginPath();

    const sliceWidth = waveformCanvas.width * 1.0 / analyserNode.fftSize;
    let x = 0;

    for (let i = 0; i < analyserNode.fftSize; i++) {
        const v = waveformDataArray[i] / 128.0; // Scale byte value (0-255) centered at 1.0
        const y = v * waveformCanvas.height / 2; // Scale to canvas height

        if (i === 0) waveformCtx.moveTo(x, y);
        else waveformCtx.lineTo(x, y);

        x += sliceWidth;
    }

    waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2); // End line at center
    waveformCtx.stroke(); // Draw the path
}


// === PITCH DETECTION SETUP ===
async function setupPitchDetection() {
    if (audioContext && audioContext.state === 'suspended') {
       console.log("Resuming existing audio context for pitch detection.");
       await audioContext.resume();
    }

    if (analyserNode && detector && mediaStreamSource && mediaStreamSource.numberOfOutputs > 0 && waveformDataArray) {
         console.log("Pitch detection components seem to exist and be connected.");
         return true;
    }

    console.log("Running full pitch detection setup...");

    try {
        // Ensure Tone.js context is active (usually done by startApp)
        if (!Tone.context || Tone.context.state !== 'running') {
             console.warn("Tone.js context not running, attempting Tone.start()");
             await Tone.start(); // Attempt to start/resume if needed
             if (Tone.context.state !== 'running') {
                 throw new Error("AudioContext could not be started/resumed.");
             }
        }
        audioContext = Tone.context; // Use Tone's context

        // Request microphone stream source if needed
        if (!mediaStreamSource) {
             console.log("Requesting microphone access...");
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             console.log("Microphone access granted.");
             if (audioContext.state !== 'running') { // Double-check context after await
                 throw new Error("AudioContext became invalid after getUserMedia.");
             }
             mediaStreamSource = audioContext.createMediaStreamSource(stream);
        }

        // Create Analyser node if needed
        if (!analyserNode) {
             console.log("Creating AnalyserNode...");
              if (audioContext.state !== 'running') {
                 throw new Error("AudioContext became invalid before creating AnalyserNode.");
             }
             analyserNode = audioContext.createAnalyser();
             analyserNode.fftSize = 2048; // Standard size for pitch detection
        }

        // Create waveform data buffer if needed
        if (analyserNode && !waveformDataArray) {
             waveformDataArray = new Uint8Array(analyserNode.fftSize);
             console.log("Waveform data array created, size:", analyserNode.fftSize);
        }

        // Connect source to analyser (disconnect first to be safe)
        if (mediaStreamSource && analyserNode) {
            try { mediaStreamSource.disconnect(analyserNode); } catch (e) {} // Disconnect specific if exists
            try { mediaStreamSource.disconnect(); } catch (e) {} // Disconnect all just in case
            mediaStreamSource.connect(analyserNode);
            console.log("Connected mediaStreamSource -> analyserNode.");
        } else {
            if (!mediaStreamSource) console.error("Cannot connect: mediaStreamSource is null");
            if (!analyserNode) console.error("Cannot connect: analyserNode is null");
        }


        // Create pitch detector if needed
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
        // Cleanup on error
        if (mediaStreamSource) {
            mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
            try { mediaStreamSource.disconnect(); } catch(e){}
            mediaStreamSource = null;
        }
        if (analyserNode) {
            try { analyserNode.disconnect(); } catch(e) {}
            analyserNode = null;
        }
        waveformDataArray = null;
        detector = null;
        return false;
    }
}


// === REPLACE setupToneJS (with temporary debug connection) ===
function setupToneJS() {
    console.log(`Setting up Tone.js for: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}`);

    // --- TEMPORARY DEBUG: SIMPLIFY SYNTH CONNECTION ---
    if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, { volume: -8, // Ensure volume is audible
            envelope: { attack: 0.04, decay: 0.5, sustain: 0.3, release: 0.5 }
        }).toDestination(); // Connect DIRECTLY to destination
        console.log("setupToneJS: Synth created and connected DIRECTLY to destination (DEBUG).");
    } else {
         // Ensure it's connected directly if it already exists
         try {
             synth.disconnect(); // Disconnect any previous connections
             synth.toDestination(); // Reconnect directly
             console.log("setupToneJS: Synth reconnected DIRECTLY to destination (DEBUG).");
         } catch (e) {
             console.error("setupToneJS: Error reconnecting synth directly:", e);
             return false;
         }
    }
    // --- END OF TEMPORARY DEBUG ---

    /* --- COMMENT OUT ORIGINAL EFFECTS CHAIN ---
    if (!reverb) { reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.05, wet: 0.4 }).toDestination(); console.log("Reverb created."); }
    if (!delay) { delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.5, wet: 0.3 }).toDestination(); console.log("Delay created."); }

    // Connect synth to effects (fan out) - COMMENTED OUT FOR DEBUG
    // if (synth && reverb && delay) {
    //     try {
    //         synth.disconnect(); // Disconnect previous chains if any
    //         synth.fan(reverb, delay); // Send synth signal to both effects in parallel
    //         console.log("Synth successfully fanned out to Reverb and Delay.");
    //     } catch (error) {
    //         console.error("Error setting up synth fan out:", error);
    //          pitchOutputDiv.innerHTML = `<span class="error">Error connecting audio components.</span>`;
    //          return false; // Indicate failure
    //     }
    // } else {
    //     console.error("Cannot setup Tone.js chain: Synth, Reverb, or Delay not initialized.");
    //     return false; // Indicate failure
    // }
    */ // --- END OF COMMENT OUT ---


    // --- Get the BASE progression data ---
    console.log(`DEBUG: Accessing baseProgressionsData[${currentKeyQuality}][${currentProgressionId}]`);
    const baseProgression = baseProgressionsData[currentKeyQuality]?.[currentProgressionId];
    console.log(`DEBUG: Found baseProgression:`, baseProgression);

    if (!baseProgression) {
        console.error(`Base progression data not found for quality "${currentKeyQuality}" and progression "${currentProgressionId}"`);
        pitchOutputDiv.innerHTML = `<span class="error">Error: Could not find base progression data.</span>`;
        return false; // Indicate failure
    }
    console.log("Using base progression:", baseProgression.name, `(Based on ${baseProgression.baseKeyRoot} ${baseProgression.baseKeyQuality})`);

    // --- Calculate Transposition Interval ---
    const baseRootMidi = noteNameToMidi(baseProgression.baseKeyRoot + '3');
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
    console.log("setupToneJS: Transposed chords to play:", JSON.stringify(chordsToPlay)); // Log the final chords


    // Clear previous part events before creating a new one
    if (part) {
        part.clear();
        part.dispose();
        console.log("Cleared and disposed previous Tone.Part");
        part = null;
    }

    // Create a new Part with the (potentially) transposed chords
    try {
        // Add extra validation for chordsToPlay
        if (!Array.isArray(chordsToPlay) || chordsToPlay.length === 0) {
             console.error("setupToneJS: chordsToPlay array is invalid or empty before creating Tone.Part.", chordsToPlay);
             throw new Error("Cannot create Tone.Part with invalid chord data.");
        }
        // Check if notes within chords are valid arrays
        for(const chordEvent of chordsToPlay) {
            if (!chordEvent || typeof chordEvent !== 'object' || !Array.isArray(chordEvent.note) || chordEvent.note.length === 0) {
                 console.error("setupToneJS: Invalid chord event structure in chordsToPlay:", chordEvent);
                 throw new Error("Invalid chord event structure found.");
            }
        }

        console.log("setupToneJS: Creating Tone.Part with valid chords array.");
        part = new Tone.Part((time, event) => {
            // Add defensiveness inside the callback too
            if (synth && event && event.note && event.duration) {
                // Check if note is an array and has content
                if (Array.isArray(event.note) && event.note.length > 0) {
                     synth.triggerAttackRelease(event.note, event.duration, time);
                } else {
                     console.warn("Skipping Tone.Part event: Invalid note array.", event);
                }
            } else {
                 console.warn("Skipping invalid event in Tone.Part callback:", event);
            }
        }, chordsToPlay);

        part.loop = true;
        part.loopStart = 0;
        part.loopEnd = baseProgression.loopEnd;
        Tone.Transport.timeSignature = [4, 4];
        console.log("setupToneJS: Tone.Part created successfully.");

    } catch (e) {
        console.error("Error creating Tone.Part:", e);
        console.error("Chords data that caused error:", JSON.stringify(chordsToPlay));
        pitchOutputDiv.innerHTML = `<span class="error">Error setting up playback sequence.</span>`;
        return false;
    }

    console.log("Tone.js components setup/updated for new key/progression.");
    return true; // Indicate success
}
// === END OF REPLACE setupToneJS ===

// === MAIN CONTROL FUNCTIONS ===
// === REPLACE startApp ===
async function startApp() {
    if (isRunning) return;
    console.log("startApp: Entered"); // Log entry
    startButton.disabled = true;
    startButton.textContent = 'Starting...';

    try {
        // Start/Resume Tone.js Audio Context FIRST
        console.log("startApp: Attempting Tone.start()...");
        await Tone.start();
        console.log('startApp: Tone.start() completed. Context state:', Tone.context.state); // Log context state

        const currentTempo = parseInt(tempoSlider.value, 10);
        console.log(`startApp: Starting with: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}, Tempo=${currentTempo} BPM`);
        Tone.Transport.bpm.value = currentTempo;

        // Set up Tone.js playback components (Needs valid Progression ID)
        console.log("startApp: Calling setupToneJS...");
        const toneSetupSuccess = setupToneJS();
        console.log("startApp: setupToneJS returned:", toneSetupSuccess); // Log return value
        if (!toneSetupSuccess) {
            throw new Error("Failed Tone setup. Check logs in setupToneJS.");
        }

        // Set up Pitch Detection components
        console.log("startApp: Calling setupPitchDetection...");
        const pitchSetupSuccess = await setupPitchDetection();
        console.log("startApp: setupPitchDetection returned:", pitchSetupSuccess); // Log return value
        if (!pitchSetupSuccess) {
             // Attempt to stop Tone if it started part way
             if (Tone.Transport.state === 'started') Tone.Transport.stop();
             if (part) part.stop();
             throw new Error("Failed Pitch Detection setup. Check mic permissions.");
        }

        // Switch UI Phases
        selectionPhaseDiv.classList.add('hidden');
        lessonPhaseDiv.classList.remove('hidden');
        console.log("startApp: Switched to Lesson Phase");

        // Update Lesson Info Display
        const currentProgressionName = baseProgressionsData[currentKeyQuality]?.[currentProgressionId]?.name || 'Unknown';
        lessonInfoSpan.textContent = `${currentProgressionName} in ${currentKeyRoot} ${currentKeyQuality} at ${currentTempo} BPM`;
        console.log("startApp: Updated lesson info span.");

        // Start Tone Transport & Part
        console.log("startApp: Resetting and starting Transport...");
        if (Tone.Transport.state === 'started') { Tone.Transport.stop(); Tone.Transport.cancel(0); }
        Tone.Transport.position = 0;
        Tone.Transport.start("+0.1"); // Start slightly ahead
        console.log("startApp: Transport state after start:", Tone.Transport.state); // Log transport state

        if (!part) { throw new Error("Tone.Part object is null or undefined after setup."); }
        console.log("startApp: Tone Part object:", part); // Log the part object
        console.log("startApp: Part length:", part.length, "Part loopEnd:", part.loopEnd); // Log part details

        console.log("startApp: Starting Tone Part...");
        part.start(0); // Start the part at the beginning of the transport timeline
        console.log("startApp: Tone Part scheduled with start(0).");


        // Start Animation Loop (Pitch Update & Waveform)
        isRunning = true; // Set flag BEFORE starting loop
        let lastUpdateTime = 0;
        const updateIntervalMs = 50; // Target ~20fps for updates

        function animationLoop(currentTime) {
            if (!isRunning) return; // Check flag to stop the loop
            animationFrameId = requestAnimationFrame(animationLoop); // Schedule next frame
            const deltaTime = currentTime - lastUpdateTime;
             if (deltaTime >= updateIntervalMs) {
                  updatePitch(); // Update text display
                  lastUpdateTime = currentTime;
             }
            drawWaveform(); // Draw waveform smoothly
        }
        animationFrameId = requestAnimationFrame(animationLoop); // Start the loop
        console.log("startApp: Started animation loop.");

        // Update UI State (Lesson Phase Active)
        stopButton.disabled = false;
        pitchOutputDiv.innerHTML = 'Listening...';
        pitchOutputDiv.className = ''; // Reset color

        console.log("Application started successfully.");

    } catch (err) {
        console.error("Error starting the application:", err);
        // Display error in the lesson phase div as it's likely visible now
        lessonInfoSpan.textContent = "Error";
        pitchOutputDiv.innerHTML = `<span class="error">Failed to start: ${err.message}. Check console.</span>`;
        pitchOutputDiv.className = '';
        // Use stopApp for cleanup, it should handle resetting UI state too
        stopApp(); // Attempt cleanup
        // stopApp should re-enable the start button and show selection phase
    }
}

function stopApp() {
    // Prevent stopping multiple times
    if (!isRunning && Tone.Transport.state !== 'started' && !animationFrameId) {
        console.log("Stop requested, but appears already stopped.");
        // Ensure UI state is correct anyway
        lessonPhaseDiv.classList.add('hidden');
        selectionPhaseDiv.classList.remove('hidden');
        startButton.disabled = false;
        startButton.textContent = 'Start Practice';
        stopButton.disabled = true;
        return;
    }
    console.log("Stop button clicked.");

    // Stop Animation Loop FIRST
    isRunning = false; // Set flag immediately
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Cancelled animation frame loop.");
    }

    // Stop Tone.js Transport FIRST to prevent new events firing
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0); // Cancel scheduled events
        console.log("Tone.js Transport stopped and events cancelled.");
    }
    if (part) {
        part.stop(0); // Stop the part immediately
        // Dispose part to clean up resources and prevent potential issues on restart
        part.dispose();
        part = null;
        console.log("Tone.js Part stopped and disposed.");
    }

    // Stop Mic Stream & Disconnect Nodes (Pitchy)
    if (mediaStreamSource) {
        mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
        try { mediaStreamSource.disconnect(); } catch (e) { console.warn("Error disconnecting mediaStreamSource:", e); }
        mediaStreamSource = null;
        console.log("Microphone stream stopped and source disconnected.");
    }
    if (analyserNode) {
        try { analyserNode.disconnect(); } catch (e) { console.warn("Error disconnecting analyserNode:", e); }
        analyserNode = null;
        waveformDataArray = null; // Clear buffer with analyser
        console.log("AnalyserNode disconnected and reset.");
    }
    if (detector) {
        detector = null; // Allow GC
        console.log("Pitchy detector reset.");
    }

    // Switch UI Phases
    lessonPhaseDiv.classList.add('hidden');
    selectionPhaseDiv.classList.remove('hidden');
    console.log("Switched to Selection Phase");

    // Update UI State (Selection Phase Active)
    startButton.disabled = false;
    startButton.textContent = 'Start Practice';
    stopButton.disabled = true;
    // Clear lesson phase displays
    pitchOutputDiv.innerHTML = 'Stopped.';
    pitchOutputDiv.className = '';
    lessonInfoSpan.textContent = '...';

    // Clear Waveform Canvas
    if(waveformCtx) {
      waveformCtx.fillStyle = 'var(--input-bg)';
      waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }

    console.log("Application stopped.");
}


// === ADD THIS FUNCTION DEFINITION BACK ===

// === CIRCLE OF FIFTHS ===
const MAJOR_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]; // Use flats for > 6#
const MINOR_KEYS = ["A", "E", "B", "F#", "C#", "G#", "D#", "Bb", "F", "C", "G", "D"]; // Corresponding relative minors

// === REPLACE createCircleOfFifths ===
function createCircleOfFifths() {
    const svgNS = "http://www.w3.org/2000/svg";
    const center = 50;
    const numSegments = 12;
    const angleStep = 360 / numSegments;

    // Define Radii for both rings with a distinct gap
    const outerMajorRadius = 48; // Slightly larger outer
    const innerMajorRadius = 36; // Make outer ring thicker
    const outerMinorRadius = 34; // Start minor ring with a gap
    const innerMinorRadius = 22; // Make inner ring thick enough for label

    circleOfFifthsSVG.innerHTML = ''; // Clear previous

    for (let i = 0; i < numSegments; i++) {
        const angleStart = i * angleStep - 90 - (angleStep / 2); // Center segments on 12 o'clock
        const angleEnd = angleStart + angleStep;
        const midAngle = angleStart + angleStep / 2;
        const largeArcFlag = 0; // Angle step is always < 180

        // --- Create Major Segment (Outer Ring) ---
        const majorKeyName = MAJOR_KEYS[i];
        const pathMajor = `
            M ${center + outerMajorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + outerMajorRadius * Math.sin(angleStart * Math.PI / 180)}
            A ${outerMajorRadius} ${outerMajorRadius} 0 ${largeArcFlag} 1 ${center + outerMajorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + outerMajorRadius * Math.sin(angleEnd * Math.PI / 180)}
            L ${center + innerMajorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + innerMajorRadius * Math.sin(angleEnd * Math.PI / 180)}
            A ${innerMajorRadius} ${innerMajorRadius} 0 ${largeArcFlag} 0 ${center + innerMajorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + innerMajorRadius * Math.sin(angleStart * Math.PI / 180)}
            Z`;

        const segmentMajor = document.createElementNS(svgNS, 'path');
        segmentMajor.setAttribute('d', pathMajor);
        segmentMajor.setAttribute('class', 'key-segment-major');
        segmentMajor.setAttribute('data-key', majorKeyName);
        segmentMajor.setAttribute('data-quality', 'Major');
        // Pass only the relevant info for THIS segment's click
        segmentMajor.addEventListener('click', () => handleCircleClick(majorKeyName, 'Major', segmentMajor));
        circleOfFifthsSVG.appendChild(segmentMajor);

        // --- Create Minor Segment (Inner Ring) ---
        const minorKeyName = MINOR_KEYS[i];
        const pathMinor = `
            M ${center + outerMinorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + outerMinorRadius * Math.sin(angleStart * Math.PI / 180)}
            A ${outerMinorRadius} ${outerMinorRadius} 0 ${largeArcFlag} 1 ${center + outerMinorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + outerMinorRadius * Math.sin(angleEnd * Math.PI / 180)}
            L ${center + innerMinorRadius * Math.cos(angleEnd * Math.PI / 180)} ${center + innerMinorRadius * Math.sin(angleEnd * Math.PI / 180)}
            A ${innerMinorRadius} ${innerMinorRadius} 0 ${largeArcFlag} 0 ${center + innerMinorRadius * Math.cos(angleStart * Math.PI / 180)} ${center + innerMinorRadius * Math.sin(angleStart * Math.PI / 180)}
            Z`;

        const segmentMinor = document.createElementNS(svgNS, 'path');
        segmentMinor.setAttribute('d', pathMinor);
        segmentMinor.setAttribute('class', 'key-segment-minor');
        segmentMinor.setAttribute('data-key', minorKeyName);
        segmentMinor.setAttribute('data-quality', 'Minor');
        // Pass only the relevant info for THIS segment's click
        segmentMinor.addEventListener('click', () => handleCircleClick(minorKeyName, 'Minor', segmentMinor));
        circleOfFifthsSVG.appendChild(segmentMinor);

        // --- Add Major Key Label (Inside Outer Ring) ---
        const majorLabelRadius = (outerMajorRadius + innerMajorRadius) / 2; // Center within outer ring
        const majorLabelX = center + majorLabelRadius * Math.cos(midAngle * Math.PI / 180);
        const majorLabelY = center + majorLabelRadius * Math.sin(midAngle * Math.PI / 180);

        const majorText = document.createElementNS(svgNS, 'text');
        majorText.setAttribute('x', majorLabelX);
        majorText.setAttribute('y', majorLabelY);
        majorText.setAttribute('class', 'key-label');
        majorText.style.fontSize = '5px'; // Adjust size as needed
        majorText.textContent = majorKeyName;
        circleOfFifthsSVG.appendChild(majorText);

        // --- Add Minor Key Label (Inside Inner Ring) ---
        const minorLabelRadius = (outerMinorRadius + innerMinorRadius) / 2; // Center within inner ring
        const minorLabelX = center + minorLabelRadius * Math.cos(midAngle * Math.PI / 180);
        const minorLabelY = center + minorLabelRadius * Math.sin(midAngle * Math.PI / 180);

        const minorText = document.createElementNS(svgNS, 'text');
        minorText.setAttribute('x', minorLabelX);
        minorText.setAttribute('y', minorLabelY);
        minorText.setAttribute('class', 'key-label');
        minorText.style.fontSize = '4px'; // Make minor labels smaller
        minorText.textContent = minorKeyName + 'm'; // Add 'm' for minor
        circleOfFifthsSVG.appendChild(minorText);
    }
    // Initial highlight handled by initializeApp after creation
}
// === END OF REPLACE createCircleOfFifths ===

// === Event Listeners ===
startButton.addEventListener('click', startApp); // <<< ADD THIS LINE BACK
stopButton.addEventListener('click', stopApp);
tempoSlider.addEventListener('input', (event) => { tempoValueSpan.textContent = event.target.value; });
// --- REMOVE THIS EVENT LISTENER ---
/*
keyQualitySelect.addEventListener('change', (event) => {
    currentKeyQuality = event.target.value;
    console.log(`Key Quality changed to: ${currentKeyQuality}`);
    populateProgressionSelect(); // Update progression list based on new quality
});
*/
// --- END OF REMOVAL ---

// === REPLACE handleCircleClick ===
function handleCircleClick(keyName, quality, clickedSegment) { // Simplified params
    console.log(`Circle segment clicked: Key=${keyName}, Quality=${quality}`);

    // Update State
    currentKeyRoot = keyName;
    currentKeyQuality = quality;

    // Update Visual Selection - highlight ONLY the clicked segment
    highlightCircleSegment(keyName, quality, clickedSegment);

    // Update progression list based on the NEWLY selected quality
    populateProgressionSelect();
}
// === END OF REPLACE handleCircleClick ===

// === REPLACE highlightCircleSegment ===
function highlightCircleSegment(keyToHighlight, qualityToHighlight, segmentToHighlight) {
    // Remove selection from ALL segments first
    document.querySelectorAll('#circleOfFifths .key-segment-major.selected, #circleOfFifths .key-segment-minor.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection ONLY to the passed segment
    if (segmentToHighlight) {
        segmentToHighlight.classList.add('selected');
        console.log(`Highlighted segment for: ${keyToHighlight} ${qualityToHighlight}`);
    } else {
        // Fallback for initial load if segment isn't passed
        const qualityClass = qualityToHighlight.toLowerCase();
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
// === END OF REPLACE highlightCircleSegment ===


// --- REMOVE THIS EVENT LISTENER ---
/*
keyQualitySelect.addEventListener('change', (event) => {
    currentKeyQuality = event.target.value;
    console.log(`Key Quality changed to: ${currentKeyQuality}`);
    populateProgressionSelect(); // Update progression list based on new quality
});
*/
// --- END OF REMOVAL ---

progressionSelect.addEventListener('change', (event) => {
    // Ensure the selected value isn't null or empty before updating state
    if (event.target.value) {
         currentProgressionId = event.target.value;
         console.log(`Progression selection changed to: ${currentProgressionId}`);
    } else {
         console.warn("Progression selection changed to an empty value.");
         currentProgressionId = null; // Handle case where a "--" option might be selected
    }
});


// === Initialization Functions ===

// --- Populate Progression Select Dropdown --- (Revised logic)
function populateProgressionSelect() {
    progressionSelect.innerHTML = ''; // Clear existing options
    console.log(`Populating progressions for quality: ${currentKeyQuality}`); // Debug
    // Verify baseProgressionsData structure before accessing
    if (!baseProgressionsData || typeof baseProgressionsData !== 'object') {
        console.error("CRITICAL: baseProgressionsData is not defined or not an object!");
        progressionSelect.disabled = true;
        // Add error option
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
    progressionIds.forEach(progId => {
        const option = document.createElement('option');
        option.value = progId;
        option.textContent = qualityData[progId].name;
        progressionSelect.appendChild(option);
    });

    // Update state from the select element's current value AFTER populating
    currentProgressionId = progressionSelect.value;
    // Add a check to ensure the value derived is actually one of the keys,
    // otherwise default to the first key if available.
    if (!progressionIds.includes(currentProgressionId) && progressionIds.length > 0) {
         console.warn(`Progression select value '${currentProgressionId}' not in keys, defaulting to first: ${progressionIds[0]}`);
         currentProgressionId = progressionIds[0];
         progressionSelect.value = currentProgressionId; // Sync UI if defaulted
    } else if (progressionIds.length === 0) {
         currentProgressionId = null; // No valid progressions
    }

    console.log(`Populated progressions for ${currentKeyQuality}. Current ID set to: '${currentProgressionId}'`);
}


// === REPLACE initializeApp ===
function initializeApp() {
    console.log("Initializing App...");
    // Initial UI State
    lessonPhaseDiv.classList.add('hidden');
    selectionPhaseDiv.classList.remove('hidden');
    stopButton.disabled = true;
    startButton.disabled = false;
    startButton.textContent = 'Start Practice';

    // Set initial values from state (Tempo)
    tempoValueSpan.textContent = tempoSlider.value;

    // Create Circle
    createCircleOfFifths(); // Create the circle graphic

    // --- Initial Highlight (No segment passed initially) ---
    highlightCircleSegment(currentKeyRoot, currentKeyQuality); // Pass key and quality, let it find the segment

    // Populate Progressions based on initial quality
    populateProgressionSelect();

    pitchOutputDiv.innerHTML = 'Select Key & Progression, then Start';

    console.log("App Initialized. Default Key Root:", currentKeyRoot, "Default Quality:", currentKeyQuality, "Default Prog:", currentProgressionId);
}
// === END OF REPLACE initializeApp ===

// Optional: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        console.log("Page hidden, stopping application to conserve resources.");
        stopApp();
    }
});

// --- Run Initialization ---
try {
    initializeApp();
} catch (error) {
    console.error("Error during initialization:", error);
    // Display error prominently if init fails
    document.body.innerHTML = `<h1 style="color: red;">Initialization Error</h1><p>Could not initialize the application. Check the console for details.</p><pre>${error.stack}</pre>`;
}

console.log("Full script loaded. UI should be ready.");