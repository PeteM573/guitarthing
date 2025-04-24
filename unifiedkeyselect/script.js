// script.js (Combined, Module Type)

// --- Pitchy Import ---
import * as pitchy from 'https://esm.sh/pitchy@4.1.0';
console.log("Imported pitchy module:", pitchy);

// --- DOM Elements ---
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const outputDiv = document.getElementById('output');
const tempoSlider = document.getElementById('tempoSlider');
const tempoValueSpan = document.getElementById('tempoValue');
const keyRootSelect = document.getElementById('keyRootSelect'); // Added
const keyQualitySelect = document.getElementById('keyQualitySelect'); // Added
const progressionSelect = document.getElementById('progressionSelect');

// --- Note Data ---
const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_TO_MIDI_BASE = { // MIDI numbers for octave 0
    "C": 12, "C#": 13, "Db": 13, "D": 14, "D#": 15, "Eb": 15, "E": 16, "Fb": 16,
    "F": 17, "F#": 18, "Gb": 18, "G": 19, "G#": 20, "Ab": 20, "A": 21, "A#": 22, "Bb": 22,
    "B": 23, "Cb": 23
};
const MIDI_TO_NOTE_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIDI_TO_NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];


// --- Progression Data (Defined relative to C Major / A Minor for simplicity) ---
// Store the STRUCTURE here. We'll transpose later.
// We use 'Major' and 'Minor' as top-level keys now.
const baseProgressionsData = {
    'Major': { // Base these on C Major
        'II-V-I': { name: 'II-V-I', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '2m', chords: [ { time: "0:0:0", note: ["D3", "F3", "A3", "C4"], duration: "2n" }, { time: "0:2:0", note: ["G2", "B2", "D3", "F3"], duration: "2n" }, { time: "1:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" } ] },
        'I-V-vi-IV': { name: 'I-V-vi-IV', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "2:0:0", note: ["A2", "C3", "E3", "G3"], duration: "1m" }, { time: "3:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" } ] },
        'I-IV-V': { name: 'I-IV-V', baseKeyRoot: 'C', baseKeyQuality: 'Major', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" }, { time: "2:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "3:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" } ] }
        // Add more MAJOR key progressions here, written as if in C Major
    },
    'Minor': { // Base these on A Minor (relative minor of C Major for simplicity)
        // Example: iiø7-V7-i in A minor (Bm7b5 - E7 - Am7)
        'ii-V-i (Minor)': { name: 'iiø7-V7-i', baseKeyRoot: 'A', baseKeyQuality: 'Minor', loopEnd: '2m', chords: [ { time: "0:0:0", note: ["B2", "D3", "F3", "A3"], duration: "2n" }, { time: "0:2:0", note: ["E2", "G#2", "B2", "D3"], duration: "2n" }, { time: "1:0:0", note: ["A2", "C3", "E3", "G3"], duration: "1m" } ] },
        // Add more MINOR key progressions here, written as if in A Minor
         'i-VI-III-VII (Minor)': { name: 'i-VI-III-VII (Andalusian)', baseKeyRoot: 'A', baseKeyQuality: 'Minor', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["A2", "C3", "E3"], duration: "1m" }, { time: "1:0:0", note: ["G2", "B2", "D3"], duration: "1m" }, { time: "2:0:0", note: ["F2", "A2", "C3"], duration: "1m" }, { time: "3:0:0", note: ["E2", "G#2", "B2"], duration: "1m" } ] }
    }
};

// --- State Variables ---
let isRunning = false;
let currentKeyRoot = 'C'; // Default Key Root
let currentKeyQuality = 'Major'; // Default Key Quality
let currentProgressionId = 'II-V-I'; // Will be updated based on quality
let audioContext = null;
let analyserNode = null;
let detector = null;
let mediaStreamSource = null;
let updatePitchInterval = null;

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
    // MIDI C4 is 60. Our base C is 12 (octave 0). C4 should be 12 + 12*4 = 60.
    return baseMidi + 12 * octave;
}

/**
 * Converts a MIDI number to a note name (e.g., 60 to "C4").
 * Prefers sharps (#) for accidentals.
 * @param {number} midiNumber - The MIDI number.
 * @returns {string|null} The note name or null if invalid.
 */
function midiToNoteName(midiNumber) {
    if (midiNumber < 12 || midiNumber > 127 || !Number.isInteger(midiNumber)) { // MIDI range C0-G9 approx
        return null;
    }
    const noteIndex = midiNumber % 12;
    const octave = Math.floor(midiNumber / 12) - 1; // MIDI C4=60 -> Octave 4
    // Decide whether to use sharps or flats - sharp preference is common
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
        return baseChords; // Return original if no transposition needed or no chords
    }

    const transposedChords = [];
    for (const chord of baseChords) {
        const transposedNotes = [];
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
        // Create a new chord object with transposed notes, keeping other properties
        transposedChords.push({
            ...chord, // Copy time, duration, etc.
            note: transposedNotes
        });
    }
    return transposedChords;
}


// === PITCHY HELPER FUNCTIONS (frequencyToNoteInfo) ===
// (Keep the frequencyToNoteInfo function exactly as it was before)
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
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const midiNumFloat = 12 * (Math.log2(frequency / a4Frequency)) + 69; // 69 is MIDI for A4
    if (!isFinite(midiNumFloat)) {
         return null;
    }
    const midiNumInt = Math.round(midiNumFloat);
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));

    // Calculate note name and octave from MIDI integer
    const octave = Math.floor(midiNumInt / 12) - 1; // MIDI C4=60 -> Octave 4
    const noteIndex = midiNumInt % 12;
    const noteName = noteNames[noteIndex]; // Use sharp-based names from MIDI mapping

    return { note: noteName, octave: octave, cents: cents };
}


// === PITCH DETECTION (updatePitch, setupPitchDetection) ===
// (Keep updatePitch and setupPitchDetection functions exactly as they were before)
// No changes needed here for transposition
function updatePitch() {
    let pitch = 0;
    let clarity = 0;
    try {
        if (!detector || !audioContext || !analyserNode || !isRunning || audioContext.state !== 'running') {
            return;
        }
        const input = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(input);
        if (typeof detector.findPitch !== 'function') {
             console.error("updatePitch: detector.findPitch is not a function!");
             outputDiv.innerHTML = `<span class="error">Pitch detector error.</span>`;
             stopApp();
             return;
        }
        [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);
        if (clarity > 0.90) { // Threshold for clarity
            const noteInfo = frequencyToNoteInfo(pitch);
            if (!noteInfo) {
                 outputDiv.innerHTML = `
                    <span class="note">...</span>
                    <span class="frequency">${pitch > 0 ? pitch.toFixed(2) + ' Hz' : '--- Hz'}</span>
                    <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>
                 `;
                 return;
            }
            const noteName = noteInfo.note;
            const octave = noteInfo.octave;
            const centsOff = noteInfo.cents;
             // --- Visual Feedback (Example - change background color based on cents) ---
             let bgColor = '#f9f9f9'; // Default
             const absCents = Math.abs(centsOff);
             if (absCents <= 10) { // Very in tune (e.g., green)
                 bgColor = `hsl(120, 70%, 90%)`; // Light green
             } else if (absCents <= 25) { // Slightly off (e.g., yellow)
                 bgColor = `hsl(60, 70%, 90%)`; // Light yellow
             } else { // More off (e.g., red)
                 bgColor = `hsl(0, 70%, 90%)`; // Light red
             }
             outputDiv.style.backgroundColor = bgColor;
             // --- End Visual Feedback Example ---

            outputDiv.innerHTML = `
                <span class="note">${noteName}${octave}</span>
                <span class="frequency">${pitch.toFixed(2)} Hz</span>
                <span class="clarity">Clarity: ${clarity.toFixed(2)}, Cents off: ${centsOff}</span>
            `;
        } else {
             outputDiv.style.backgroundColor = '#f9f9f9'; // Reset background
             outputDiv.innerHTML = `
                 <span class="note">---</span>
                 <span class="frequency">--- Hz</span>
                 <span class="clarity">Clarity: ${clarity.toFixed(2)} (Low)</span>
            `;
        }
    } catch (err) {
        console.error("Error during updatePitch:", err);
        outputDiv.innerHTML = `<span class="error">Error detecting pitch. Check console.</span>`;
        outputDiv.style.backgroundColor = '#f9f9f9'; // Reset background on error
    }
}

async function setupPitchDetection() {
    // Keep the early exit check for *existing context state*
    // but rely on analyserNode/detector being null to force re-init
    if (audioContext && audioContext.state === 'suspended') {
       console.log("Resuming existing audio context for pitch detection.");
       await audioContext.resume();
    }

    // If analyser and detector are already set up AND connected, exit early.
    if (analyserNode && detector && mediaStreamSource && mediaStreamSource.numberOfOutputs > 0) {
         console.log("Pitch detection analyser/detector seem to exist and be connected.");
         return true;
    }

    console.log("Running full pitch detection setup...");

    try {
        // Use Tone's context
        if (!audioContext || audioContext !== Tone.context){
             console.log("Setting up audio context for pitch detection (using Tone.context)...");
             audioContext = Tone.context;
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Request microphone stream source if needed
        if (!mediaStreamSource) {
             console.log("Requesting microphone access...");
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             console.log("Microphone access granted.");
             if (!audioContext || audioContext.state !== 'running') {
                 throw new Error("AudioContext became invalid before creating MediaStreamSource.");
             }
             mediaStreamSource = audioContext.createMediaStreamSource(stream);
        }

        // Create Analyser node if needed
        if (!analyserNode) {
             console.log("Creating AnalyserNode...");
             if (!audioContext || audioContext.state !== 'running') {
                 throw new Error("AudioContext became invalid before creating AnalyserNode.");
             }
             analyserNode = audioContext.createAnalyser();
             analyserNode.fftSize = 2048; // Standard size
        }

        // Connect source to analyser (disconnect first to be safe)
        try {
            // Disconnect specific connection if it exists
             if (mediaStreamSource && mediaStreamSource.numberOfOutputs > 0) {
                mediaStreamSource.disconnect(analyserNode);
                console.log("Disconnected existing mediaStreamSource -> analyserNode (if any).");
            }
        } catch (e) {
             // Ignore errors if it wasn't connected
        }
        // Ensure connection only if both source and node exist
        if (mediaStreamSource && analyserNode) {
            mediaStreamSource.connect(analyserNode);
            console.log("Connected mediaStreamSource -> analyserNode.");
        }


        // Create detector if needed
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
        outputDiv.innerHTML = `<span class="error">Error setting up pitch detection: ${err.message}. Check permissions and console.</span>`;
        // Cleanup on error
        if (mediaStreamSource) {
            mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
            try { mediaStreamSource.disconnect(); } catch(e){}
            mediaStreamSource = null;
        }
        analyserNode = null;
        detector = null;
        return false;
    }
}

// === TONE.JS SETUP FUNCTION (MODIFIED FOR TRANSPOSITION) ===
function setupToneJS() {
    console.log(`Setting up Tone.js for: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}`);
    // Ensure synth/effects are created (only once)
    if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, { volume: -8, // Slightly lower volume
            envelope: { attack: 0.04, decay: 0.5, sustain: 0.3, release: 0.5 }
        }).toDestination(); // Connect direct initially
        console.log("Synth created.");
    }
    if (!reverb) { reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.05, wet: 0.4 }).toDestination(); console.log("Reverb created."); } // Connect direct
    if (!delay) { delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.5, wet: 0.3 }).toDestination(); console.log("Delay created."); } // Connect direct

    // --- Robust Connection Logic (Connect synth to effects) ---
    if (synth && reverb && delay) {
        try {
            synth.disconnect(); // Disconnect previous chains if any
            synth.fan(reverb, delay); // Send synth signal to both effects in parallel
            console.log("Synth successfully fanned out to Reverb and Delay.");
        } catch (error) {
            console.error("Error setting up synth fan out:", error);
             outputDiv.innerHTML = `<span class="error">Error connecting audio components.</span>`;
             return false; // Indicate failure
        }
    } else {
        console.error("Cannot setup Tone.js chain: Synth, Reverb, or Delay not initialized.");
        return false; // Indicate failure
    }

    // --- Get the BASE progression data ---
    const baseProgression = baseProgressionsData[currentKeyQuality]?.[currentProgressionId];

    if (!baseProgression) {
        console.error(`Base progression data not found for quality "${currentKeyQuality}" and progression "${currentProgressionId}"`);
        outputDiv.innerHTML = `<span class="error">Error: Could not find base progression data.</span>`;
        return false; // Indicate failure
    }
    console.log("Using base progression:", baseProgression.name, `(Based on ${baseProgression.baseKeyRoot} ${baseProgression.baseKeyQuality})`);

    // --- Calculate Transposition Interval ---
    const baseRootMidi = noteNameToMidi(baseProgression.baseKeyRoot + '3'); // Use Octave 3 for root comparison
    const targetRootMidi = noteNameToMidi(currentKeyRoot + '3');
    let transpositionInterval = 0;

    if (baseRootMidi !== null && targetRootMidi !== null) {
        transpositionInterval = targetRootMidi - baseRootMidi;
        console.log(`Transposition: Base=${baseProgression.baseKeyRoot}, Target=${currentKeyRoot}, Interval=${transpositionInterval} semitones.`);
    } else {
        console.error(`Could not calculate transposition interval. Base MIDI: ${baseRootMidi}, Target MIDI: ${targetRootMidi}`);
        // Decide how to handle: proceed without transposition or fail? Let's proceed without for now.
        transpositionInterval = 0;
        outputDiv.innerHTML = `<span class="warning">Warning: Could not calculate transposition. Using base key.</span>`;
    }

    // --- Transpose the Chords ---
    const chordsToPlay = transposeProgression(baseProgression.chords, transpositionInterval);
    // console.log("Transposed Chords:", JSON.stringify(chordsToPlay)); // DEBUG: Log the final chords

    // Clear previous part events before creating a new one
    if (part) {
        part.clear();
        part.dispose();
        console.log("Cleared and disposed previous Tone.Part");
        part = null;
    }

    // Create a new Part with the (potentially) transposed chords
    part = new Tone.Part((time, event) => {
        if (synth) {
            synth.triggerAttackRelease(event.note, event.duration, time);
        }
    }, chordsToPlay); // Use the processed chords

    // Configure loop using the base progression's duration
    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = baseProgression.loopEnd;

    // Set Transport settings
    Tone.Transport.timeSignature = [4, 4];

    console.log("Tone.js components setup/updated for new key/progression.");
    return true; // Indicate success
}


// === MAIN CONTROL FUNCTIONS ===

async function startApp() {
    if (isRunning) return;
    console.log("Start button clicked.");

    try {
        // 1. Start/Resume Tone.js Audio Context
        await Tone.start();
        console.log('Tone.js audio context is ready and running.');

        // --- GET CURRENT SETTINGS ---
        const currentTempo = parseInt(tempoSlider.value, 10);
        // Key Root, Quality, and Progression ID are already stored in state variables

        console.log(`Starting with: Key=${currentKeyRoot} ${currentKeyQuality}, Progression=${currentProgressionId}, Tempo=${currentTempo} BPM`);
        Tone.Transport.bpm.value = currentTempo; // Apply selected tempo

        // Set up Tone.js Components (Synth, Part, Effects connections, Transposition)
        const toneSetupSuccess = setupToneJS(); // This now handles transposition internally
        if (!toneSetupSuccess) {
            throw new Error("Failed to set up Tone.js components.");
        }

        // Set up Pitch Detection (Mic Access, Analyser, Pitchy Detector)
        const pitchSetupSuccess = await setupPitchDetection();
        if (!pitchSetupSuccess) {
             if (Tone.Transport.state === 'started') Tone.Transport.stop();
             if (part) part.stop();
             outputDiv.innerHTML = `<span class="error">Pitch detection failed. Cannot start. Check mic permissions.</span>`;
             console.error("Pitch detection setup failed. Aborting start.");
             return; // Abort start
        }

        // Start Everything
        console.log("Starting Tone.js Transport...");
        if (Tone.Transport.state === 'started') { Tone.Transport.stop(); Tone.Transport.cancel(0); }
        Tone.Transport.position = 0;
        Tone.Transport.start("+0.1"); // Start slightly ahead

        console.log("Starting Tone.js Part...");
        if (!part) { throw new Error("Tone.Part was not created successfully."); }
        part.start(0); // Start the part at the beginning of the transport timeline

        console.log("Starting pitch update interval...");
        if (updatePitchInterval) clearInterval(updatePitchInterval);
        // Use requestAnimationFrame for smoother UI updates if possible, fallback to setInterval
        let lastUpdateTime = 0;
        const updateIntervalMs = 100; // Target ~10fps for pitch updates

        function pitchUpdateLoop(currentTime) {
            if (!isRunning) return; // Stop the loop if stopApp was called

            const deltaTime = currentTime - lastUpdateTime;

            if (deltaTime >= updateIntervalMs) {
                 updatePitch();
                 lastUpdateTime = currentTime;
            }
            requestAnimationFrame(pitchUpdateLoop); // Continue the loop
        }
        requestAnimationFrame(pitchUpdateLoop); // Start the loop
        // Fallback: updatePitchInterval = setInterval(updatePitch, 100);

        isRunning = true;
        // Disable controls
        startButton.disabled = true;
        stopButton.disabled = false;
        tempoSlider.disabled = true;
        keyRootSelect.disabled = true;    // Disable key controls
        keyQualitySelect.disabled = true; // Disable key controls
        progressionSelect.disabled = true;// Disable progression control

        const currentProgressionName = baseProgressionsData[currentKeyQuality]?.[currentProgressionId]?.name || 'Unknown Progression';
        outputDiv.innerHTML = `Playing: ${currentProgressionName} in ${currentKeyRoot} ${currentKeyQuality} at ${currentTempo} BPM. Listening...`;
        outputDiv.style.backgroundColor = '#f9f9f9'; // Reset background
        console.log("Application started successfully.");

    } catch (err) {
        console.error("Error starting the application:", err);
        outputDiv.innerHTML = `<span class="error">Failed to start: ${err.message}. Check console.</span>`;
        outputDiv.style.backgroundColor = '#f9f9f9'; // Reset background
        stopApp(); // Attempt cleanup if start fails
    }
}

function stopApp() {
    // --- Check added to prevent unnecessary stops ---
    if (!isRunning && Tone.Transport.state !== 'started') { // Simplified check
        console.log("Stop requested, but nothing appears to be running.");
        // Ensure UI is in correct stopped state anyway
        startButton.disabled = false;
        stopButton.disabled = true;
        tempoSlider.disabled = false;
        keyRootSelect.disabled = false;
        keyQualitySelect.disabled = false;
        progressionSelect.disabled = false;
        startButton.textContent = 'Start';
        return;
    }
    console.log("Stop button clicked.");

    // Stop Tone.js Transport FIRST to prevent new events firing
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0); // Cancel scheduled events
        console.log("Tone.js Transport stopped and events cancelled.");
    }
    if (part) {
        part.stop(0); // Stop the part immediately
        console.log("Tone.js Part explicitly stopped.");
        // Consider disposing part here or in setupToneJS
        // part.dispose(); part = null;
    }

    // Stop Pitch Detection Loop/Interval
    isRunning = false; // Set flag immediately to stop rAF loop
    if (updatePitchInterval) { // Clear interval if it was used as fallback
        clearInterval(updatePitchInterval);
        updatePitchInterval = null;
        console.log("Pitch update interval cleared.");
    }

    // Stop Microphone Stream and Disconnect Nodes (Pitchy)
    if (mediaStreamSource) {
        mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
        try {
            // Disconnect ALL destinations from the source
            mediaStreamSource.disconnect();
        } catch (e) {
            console.warn("Error disconnecting mediaStreamSource:", e);
        }
        mediaStreamSource = null; // Allow GC and force re-creation
        console.log("Microphone stream stopped and source disconnected.");
    }

    // Reset analyser and detector
    if(analyserNode) {
        analyserNode.disconnect(); // Disconnect analyser itself
        analyserNode = null;
        console.log("AnalyserNode disconnected and reset.");
    }
    if(detector) {
        detector = null; // Allow GC
        console.log("Pitchy detector reset.");
    }

    // Re-enable controls
    startButton.textContent = 'Start';
    startButton.disabled = false;
    stopButton.disabled = true;
    tempoSlider.disabled = false;
    keyRootSelect.disabled = false;
    keyQualitySelect.disabled = false;
    progressionSelect.disabled = false;
    outputDiv.innerHTML = 'Stopped. Select key, progression, tempo and click Start.';
    outputDiv.style.backgroundColor = '#f9f9f9'; // Reset background
    console.log("Application stopped.");
}

// === Event Listeners ===
startButton.addEventListener('click', startApp);
stopButton.addEventListener('click', stopApp);
tempoSlider.addEventListener('input', (event) => {
    tempoValueSpan.textContent = event.target.value;
    // Optionally update Tone.Transport.bpm live if needed, but might cause issues if changed rapidly during playback
    // if (isRunning) { Tone.Transport.bpm.value = parseInt(event.target.value, 10); }
});

// --- Key and Progression Listeners --- (MODIFIED)
keyRootSelect.addEventListener('change', (event) => {
    currentKeyRoot = event.target.value;
    console.log(`Key Root changed to: ${currentKeyRoot}`);
    // No need to update progressions here, quality change handles it
});

keyQualitySelect.addEventListener('change', (event) => {
    currentKeyQuality = event.target.value;
    console.log(`Key Quality changed to: ${currentKeyQuality}`);
    populateProgressionSelect(); // Update progression options based on new quality
});

progressionSelect.addEventListener('change', (event) => {
    currentProgressionId = event.target.value;
    console.log(`Progression selection changed to: ${currentProgressionId}`);
    // setupToneJS() will handle using this value when Start is clicked
});

// === Initialization Functions ===

// --- Populate Key Root Select Dropdown --- (ADDED)
function populateKeyRootSelect() {
    keyRootSelect.innerHTML = ''; // Clear existing
    ALL_NOTES.forEach(note => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = note;
        keyRootSelect.appendChild(option);
    });
    currentKeyRoot = keyRootSelect.value; // Set initial state
}

// --- Populate Progression Select Dropdown (Now depends on Quality) --- (MODIFIED)
function populateProgressionSelect() {
    progressionSelect.innerHTML = ''; // Clear existing options

    const qualityData = baseProgressionsData[currentKeyQuality];
    if (!qualityData) {
        console.error("Cannot populate progressions: Quality data not found for", currentKeyQuality);
        // Add a default "No progressions available" option?
        const option = document.createElement('option');
        option.textContent = "No progressions available";
        option.disabled = true;
        progressionSelect.appendChild(option);
        currentProgressionId = null; // No valid progression
        return;
    }

    const progressionIds = Object.keys(qualityData);

    progressionIds.forEach(progId => {
        const option = document.createElement('option');
        option.value = progId;
        // Display name might combine key info later if needed, but keep simple for now
        option.textContent = qualityData[progId].name; // Display the friendly name
        progressionSelect.appendChild(option);
    });

    // Set the initial state variable based on the first option (or default)
     if (progressionIds.length > 0) {
       // Make sure the selected value exists before assigning it
       const firstProgId = progressionIds[0];
       progressionSelect.value = firstProgId;
       currentProgressionId = firstProgId;
       console.log(`Initial progression for ${currentKeyQuality} set to:`, currentProgressionId);
     } else {
         currentProgressionId = null; // Handle case with no progressions for a quality
         console.log(`No progressions found for ${currentKeyQuality}.`);
     }
}

// --- Initial Page Setup ---
function initializeApp() {
    stopButton.disabled = true;
    tempoValueSpan.textContent = tempoSlider.value;

    populateKeyRootSelect(); // Populate key roots first
    keyRootSelect.value = currentKeyRoot; // Ensure UI matches default state

    keyQualitySelect.value = currentKeyQuality; // Ensure UI matches default state

    populateProgressionSelect(); // Populate progressions based on default quality

    outputDiv.innerHTML = 'Select key, progression, tempo, then click Start.'; // Updated initial message

    console.log("App Initialized. Default Key:", currentKeyRoot, currentKeyQuality, "Default Prog:", currentProgressionId);
}

// Optional: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        console.log("Page hidden, stopping application to conserve resources.");
        stopApp();
    }
});

// --- Run Initialization ---
initializeApp();

console.log("Combined script loaded with key, tempo and progression controls.");