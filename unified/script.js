// script.js (Combined, Module Type)

// --- Pitchy Import ---
import * as pitchy from 'https://esm.sh/pitchy@4.1.0';
console.log("Imported pitchy module:", pitchy);

// --- DOM Elements ---
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const outputDiv = document.getElementById('output');
const tempoSlider = document.getElementById('tempoSlider'); // Added
const tempoValueSpan = document.getElementById('tempoValue'); // Added
const progressionSelect = document.getElementById('progressionSelect'); // Added

// --- Progression Data (Currently only C Major) ---
const progressionsData = {
    'C Major': {
        'II-V-I': { name: 'II-V-I (C Major)', loopEnd: '2m', chords: [ { time: "0:0:0", note: ["D3", "F3", "A3", "C4"], duration: "2n" }, { time: "0:2:0", note: ["G2", "B2", "D3", "F3"], duration: "2n" }, { time: "1:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" } ] },
        'I-V-vi-IV': { name: 'I-V-vi-IV (C Major)', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "2:0:0", note: ["A2", "C3", "E3", "G3"], duration: "1m" }, { time: "3:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" } ] },
        'I-IV-V': { name: 'I-IV-V (C Major)', loopEnd: '4m', chords: [ { time: "0:0:0", note: ["C3", "E3", "G3", "B3"], duration: "1m" }, { time: "1:0:0", note: ["F2", "A2", "C3", "E3"], duration: "1m" }, { time: "2:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" }, { time: "3:0:0", note: ["G2", "B2", "D3", "F3"], duration: "1m" } ] }
    }
    // Future keys go here
};

// --- State Variables ---
let isRunning = false;
let currentKey = 'C Major'; // Added state for the current key
let currentProgressionId = 'II-V-I'; // Added state for the current progression ID
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

// === PITCHY HELPER FUNCTIONS (frequencyToNoteInfo) ===
// (Keep the frequencyToNoteInfo function exactly as it was)
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
    const midiNumFloat = 12 * (Math.log2(frequency / a4Frequency)) + 69;
    if (!isFinite(midiNumFloat)) {
         return null;
    }
    const midiNumInt = Math.round(midiNumFloat);
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));
    const octave = Math.floor(midiNumInt / 12) - 1;
    const noteIndex = midiNumInt % 12;
    const correctedNoteIndex = (noteIndex + 12) % 12;
    const noteName = noteNames[correctedNoteIndex];
    return { note: noteName, octave: octave, cents: cents };
}


// === PITCH DETECTION (updatePitch, setupPitchDetection) ===
// (Keep updatePitch and setupPitchDetection functions exactly as they were)
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
        if (clarity > 0.90) {
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
            outputDiv.innerHTML = `
                <span class="note">${noteName}${octave}</span>
                <span class="frequency">${pitch.toFixed(2)} Hz</span>
                <span class="clarity">Clarity: ${clarity.toFixed(2)}, Cents off: ${centsOff}</span>
            `;
        } else {
             outputDiv.innerHTML = `
                 <span class="note">---</span>
                 <span class="frequency">--- Hz</span>
                 <span class="clarity">Clarity: ${clarity.toFixed(2)} (Low)</span>
            `;
        }
    } catch (err) {
        console.error("Error during updatePitch:", err);
        outputDiv.innerHTML = `<span class="error">Error detecting pitch. Check console.</span>`;
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
    // We need to ensure the connection mediaStreamSource -> analyserNode exists.
    // The best way is to re-run setup if analyserNode is null.
    if (analyserNode && detector && mediaStreamSource && mediaStreamSource.numberOfOutputs > 0) {
         console.log("Pitch detection analyser/detector seem to exist and be connected.");
         return true;
    }

    // If analyserNode or detector is null, we proceed with full setup
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

        // We need a microphone stream source
        if (!mediaStreamSource) {
             console.log("Requesting microphone access...");
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             console.log("Microphone access granted.");
             // Check if context is still valid before creating source
             if (!audioContext || audioContext.state !== 'running') {
                 throw new Error("AudioContext became invalid before creating MediaStreamSource.");
             }
             mediaStreamSource = audioContext.createMediaStreamSource(stream);
        }

        // Create Analyser node if it doesn't exist
        if (!analyserNode) {
             console.log("Creating AnalyserNode...");
             if (!audioContext || audioContext.state !== 'running') {
                 throw new Error("AudioContext became invalid before creating AnalyserNode.");
             }
             analyserNode = audioContext.createAnalyser();
             analyserNode.fftSize = 2048;
        }

        // Connect source to analyser (disconnect first to be safe)
        try {
            mediaStreamSource.disconnect(analyserNode); // Try disconnecting specifically
            console.log("Disconnected existing mediaStreamSource -> analyserNode (if any).");
        } catch (e) {
             // Ignore errors if it wasn't connected
        }
        mediaStreamSource.connect(analyserNode);
        console.log("Connected mediaStreamSource -> analyserNode.");

        // Create detector if it doesn't exist
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
        outputDiv.innerHTML = `<span class="error">Error accessing microphone or initializing detector: ${err.message}. Check permissions and console.</span>`;
        // Cleanup on error
        if (mediaStreamSource) {
            mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
            try { mediaStreamSource.disconnect(); } catch(e){}
            mediaStreamSource = null;
        }
        // Don't nullify audioContext here as Tone uses it
        analyserNode = null;
        detector = null;
        return false;
    }
}

// === TONE.JS SETUP FUNCTION ===
function setupToneJS() {
    console.log(`Setting up Tone.js for: ${currentKey} - ${currentProgressionId}`);
    // Ensure synth/effects are created (only once)
    if (!synth) {
        synth = new Tone.PolySynth(Tone.Synth, { volume: -6, envelope: { attack: 0.04, decay: 0.5, sustain: 0.3, release: 0.5 } });
        console.log("Synth created.");
    }
    if (!reverb) { reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.05 }); console.log("Reverb created."); }
    if (!delay) { delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.5, wet: 0.3 }); console.log("Delay created."); }

    // --- Robust Connection Logic --- (MODIFIED)
    if (synth && reverb && delay) {
        try {
            // Always disconnect synth first to prevent duplicate connections
            synth.disconnect();
            console.log("Synth disconnected (preparation for chaining).");

            // Always re-chain to ensure the path is correct
            synth.chain(reverb, delay, Tone.Destination);
            console.log("Synth successfully chained: Synth -> Reverb -> Delay -> Destination.");
        } catch (error) {
            console.error("Error setting up synth chain:", error);
             outputDiv.innerHTML = `<span class="error">Error connecting audio components.</span>`;
             return false; // Indicate failure
        }
    } else {
        console.error("Cannot setup Tone.js chain: Synth, Reverb, or Delay not initialized.");
        return false; // Indicate failure
    }
    // --- End of Connection Logic Modification ---


    // --- Get the selected progression data --- (MODIFIED)
    const progression = progressionsData[currentKey]?.[currentProgressionId]; // Use current state

    if (!progression) {
        console.error(`Progression data not found for key "${currentKey}" and progression "${currentProgressionId}"`);
        outputDiv.innerHTML = `<span class="error">Error: Could not find progression data.</span>`;
        return false; // Indicate failure
    }
    console.log("Using progression:", progression.name);

    // Clear previous part events before creating a new one
    if (part) {
        part.clear(); // Remove all events
        part.dispose(); // Free up resources
        console.log("Cleared and disposed previous Tone.Part");
        part = null; // Ensure we create a new one
    }

    // Create a new Part with the selected progression's data
    part = new Tone.Part((time, event) => {
        if (synth) {
            synth.triggerAttackRelease(event.note, event.duration, time);
        }
    }, progression.chords); // Use the chords from the selected progression data

    // Configure loop using the selected progression's duration
    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = progression.loopEnd; // Use loopEnd from the selected progression data

    // Set Transport settings (Tempo is set in startApp)
    Tone.Transport.timeSignature = [4, 4];

    console.log("Tone.js components setup/updated for new progression.");
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
        // Progression ID is already stored in currentProgressionId via the event listener
        // Key is currently fixed to 'C Major'

        console.log(`Starting with: Key=${currentKey}, Progression=${currentProgressionId}, Tempo=${currentTempo} BPM`);
        Tone.Transport.bpm.value = currentTempo; // Apply selected tempo

        // Set up Tone.js Components (Synth, Part, Effects connections)
        const toneSetupSuccess = setupToneJS(); // This now robustly sets up connections
        if (!toneSetupSuccess) {
            throw new Error("Failed to set up Tone.js components.");
        }

        // Set up Pitch Detection (Mic Access, Analyser, Pitchy Detector connections)
        // This will now re-run fully if analyserNode/detector were nullified by stopApp
        const pitchSetupSuccess = await setupPitchDetection();
        if (!pitchSetupSuccess) {
             if (Tone.Transport.state === 'started') Tone.Transport.stop();
             if (part) part.stop();
             outputDiv.innerHTML = `<span class="error">Pitch detection failed. Cannot start full app. Check mic permissions.</span>`;
             console.error("Pitch detection setup failed. Aborting start.");
             return; // Abort start
        }

        // Start Everything
        console.log("Starting Tone.js Transport...");
        if (Tone.Transport.state === 'started') { Tone.Transport.stop(); Tone.Transport.cancel(0); }
        Tone.Transport.position = 0;
        Tone.Transport.start("+0.1");

        console.log("Starting Tone.js Part...");
        if (!part) { throw new Error("Tone.Part was not created successfully."); }
        part.start(0);

        console.log("Starting pitch update interval...");
        if (updatePitchInterval) clearInterval(updatePitchInterval);
        updatePitchInterval = setInterval(updatePitch, 100);

        isRunning = true;
        // Disable controls
        startButton.disabled = true;
        stopButton.disabled = false;
        tempoSlider.disabled = true;
        progressionSelect.disabled = true;
        outputDiv.innerHTML = `Playing: ${progressionsData[currentKey][currentProgressionId]?.name || 'Unknown Progression'} at ${currentTempo} BPM. Listening...`;
        console.log("Application started successfully.");

    } catch (err) {
        console.error("Error starting the application:", err);
        outputDiv.innerHTML = `<span class="error">Failed to start: ${err.message}. Check console.</span>`;
        stopApp(); // Attempt cleanup if start fails
    }
}

function stopApp() {
    // --- Check added to prevent unnecessary stops ---
    if (!isRunning && Tone.Transport.state !== 'started' && !updatePitchInterval) {
        console.log("Stop requested, but nothing appears to be running.");
        // Ensure UI is in correct stopped state
        startButton.disabled = false;
        stopButton.disabled = true;
        tempoSlider.disabled = false;
        progressionSelect.disabled = false;
        startButton.textContent = 'Start';
        return;
    }
    console.log("Stop button clicked.");

    // Stop Tone.js
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        console.log("Tone.js Transport stopped and events cancelled.");
    }
    if (part) {
        part.stop(0);
        console.log("Tone.js Part explicitly stopped.");
    }

    // Stop Pitch Detection Interval
    if (updatePitchInterval) {
        clearInterval(updatePitchInterval);
        updatePitchInterval = null;
        console.log("Pitch update interval cleared.");
    }

    // Stop Microphone Stream and Disconnect Nodes (Pitchy)
    if (mediaStreamSource) {
        mediaStreamSource.mediaStream?.getTracks().forEach(track => track.stop());
        try { mediaStreamSource.disconnect(); } catch (e) { console.warn("Error disconnecting mediaStreamSource:", e); }
        mediaStreamSource = null; // Allow GC and force re-creation
        console.log("Microphone stream stopped and source disconnected.");
    }

    // --- FIX: Reset analyser and detector --- (MODIFIED)
    // This forces setupPitchDetection to re-initialize fully next time
    if(analyserNode) {
        analyserNode.disconnect(); // Disconnect analyser itself
        analyserNode = null;
        console.log("AnalyserNode disconnected and reset.");
    }
    if(detector) {
        detector = null; // Allow GC
        console.log("Pitchy detector reset.");
    }
    // --- End of Fix ---

    isRunning = false;
    // Re-enable controls
    startButton.textContent = 'Start';
    startButton.disabled = false;
    stopButton.disabled = true;
    tempoSlider.disabled = false;
    progressionSelect.disabled = false;
    outputDiv.innerHTML = 'Stopped. Select progression/tempo and click Start.';
    console.log("Application stopped.");
}

// === Event Listeners ===
startButton.addEventListener('click', startApp);
stopButton.addEventListener('click', stopApp);
tempoSlider.addEventListener('input', (event) => { tempoValueSpan.textContent = event.target.value; });
progressionSelect.addEventListener('change', (event) => { currentProgressionId = event.target.value; console.log(`Progression selection changed to: ${currentProgressionId}`); });

// --- Progression Select Event Listener --- (ADDED)
progressionSelect.addEventListener('change', (event) => {
    currentProgressionId = event.target.value; // Update the state variable
    console.log(`Progression selection changed to: ${currentProgressionId}`);
    // No need to call setupToneJS here, it will be called by startApp
});

// === Initialization ===

// --- Populate Progression Select Dropdown --- (ADDED)
function populateProgressionSelect() {
    // Clear existing options
    progressionSelect.innerHTML = '';

    const keyData = progressionsData[currentKey]; // Get data for the current key
    if (!keyData) {
        console.error("Cannot populate progressions: Key data not found for", currentKey);
        return;
    }

    // Get the available progression IDs for the current key
    const progressionIds = Object.keys(keyData);

    // Create an <option> for each progression
    progressionIds.forEach(progId => {
        const option = document.createElement('option');
        option.value = progId; // The value will be 'II-V-I', 'I-V-vi-IV', etc.
        option.textContent = keyData[progId].name; // Display the friendly name
        progressionSelect.appendChild(option);
    });

    // Set the initial state variable based on the first option (or default)
     if (progressionIds.length > 0) {
       currentProgressionId = progressionSelect.value; // Ensure state matches initial UI
       console.log("Initial progression set to:", currentProgressionId);
     }

}

// Initial setup
stopButton.disabled = true;
tempoValueSpan.textContent = tempoSlider.value;
populateProgressionSelect(); // Populate dropdown on load


// Optional: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        console.log("Page hidden, stopping application.");
        stopApp();
    }
});

console.log("Combined script loaded with tempo and progression controls. Click 'Start'.");