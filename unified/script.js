// Import necessary libraries using module-aware CDN
import * as pitchy from 'https://esm.sh/pitchy@4.1.0';
import * as Tone from 'https://esm.sh/tone@14.7.77';

// --- DOM Elements ---
const practiceButton = document.getElementById('practiceButton');
const pitchOutputDiv = document.getElementById('pitchOutput');
const droneStatusDiv = document.getElementById('droneStatus');
const progressionSelect = document.getElementById('progressionSelect');
const keySelect = document.getElementById('keySelect');
// --- Shared State ---
let audioContext = null;
let analyserNode = null;
let pitchDetector = null;
let mediaStreamSource = null;
let updatePitchInterval = null;
let isPracticing = false;
let isAppInitialized = false;
let hasUserGestured = false;

// --- Tone.js Specific State ---
let synth = null;
let part = null;

const progressionLibrary = {
    "II-V-I": {
        description: "Major II-V-I",
        baseKey: "C",
        chords: [
            { time: "0:0:0", notes: ["D3", "F3", "A3", "C4"], duration: "2n", symbol: "m7" },  // Dm7
            { time: "0:2:0", notes: ["G2", "B2", "D3", "F3"], duration: "2n", symbol: "7" },   // G7
            { time: "1:0:0", notes: ["C3", "E3", "G3", "B3"], duration: "1n", symbol: "maj7" } // Cmaj7
        ]
    },
    "Blues": {
        description: "Blues in Major",
        baseKey: "C",
        chords: [
            { time: "0:0:0", notes: ["C3", "E3", "G3", "Bb3"], duration: "1n", symbol: "7" },   // C7
            { time: "1:0:0", notes: ["F3", "A3", "C4", "Eb4"], duration: "2n", symbol: "7" },   // F7
            { time: "1:2:0", notes: ["C3", "E3", "G3", "Bb3"], duration: "2n", symbol: "7" },   // C7
            { time: "2:0:0", notes: ["G3", "B3", "D4", "F4"], duration: "1n", symbol: "7" },    // G7
            { time: "3:0:0", notes: ["C3", "E3", "G3", "Bb3"], duration: "1n", symbol: "7" }    // C7
        ]
    },
    "Minor-II-V-I": {
        description: "Minor II-V-I",
        baseKey: "C",
        chords: [
            { time: "0:0:0", notes: ["D3", "F3", "Ab3", "C4"], duration: "2n", symbol: "m7b5" },// Dm7b5
            { time: "0:2:0", notes: ["G2", "B2", "D3", "F3"], duration: "2n", symbol: "7b9" },  // G7b9
            { time: "1:0:0", notes: ["C3", "Eb3", "G3", "B3"], duration: "1n", symbol: "m(maj7)" } // Cm(maj7)
        ]
    }
};

// Notes in chromatic order for transposition
const chromaticNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Define drone tempo - KEY CHANGE: Using a variable for tempo
const droneTempo = 60;

// Function to transpose a note by semitones
function transposeNote(note, semitones) {
    // Extract note name and octave
    const noteName = note.replace(/[0-9]/g, "");
    const octave = parseInt(note.match(/[0-9]/)[0]);
    
    // Find index of note in chromatic scale
    let noteIndex = chromaticNotes.indexOf(noteName);
    if (noteIndex === -1) return note; // Invalid note
    
    // Calculate new note and handle octave changes
    let newIndex = (noteIndex + semitones) % 12;
    let octaveChange = Math.floor((noteIndex + semitones) / 12);
    if (newIndex < 0) {
        newIndex += 12;
        octaveChange -= 1;
    }
    
    return chromaticNotes[newIndex] + (octave + octaveChange);
}

// Function to transpose a chord
function transposeChord(chord, semitones) {
    return {
        ...chord,
        notes: chord.notes.map(note => transposeNote(note, semitones))
    };
}

// Function to get transposition semitones between keys
function getSemitones(fromKey, toKey) {
    const fromIndex = chromaticNotes.indexOf(fromKey);
    const toIndex = chromaticNotes.indexOf(toKey);
    return (toIndex - fromIndex + 12) % 12;
}

// Function to get current progression in selected key
function getCurrentProgression() {
    const progressionType = progressionSelect.value;
    const selectedKey = keySelect.value;
    
    // Get the base progression
    if (!progressionLibrary[progressionType]) {
        console.error("Unknown progression type:", progressionType);
        return [];
    }
    
    const baseProgression = progressionLibrary[progressionType];
    const baseKey = baseProgression.baseKey;
    
    // If same key, return the original
    if (baseKey === selectedKey) {
        return baseProgression.chords;
    }
    
    // Transpose to the selected key
    const semitones = getSemitones(baseKey, selectedKey);
    return baseProgression.chords.map(chord => transposeChord(chord, semitones));
}

// Function to get chord name with proper symbol
function getChordName(notes, symbol, key) {
    if (!notes || !notes.length) return '...';
    
    // Get the root note - assuming it's always the first note
    const rootNote = notes[0].replace(/[0-9]/g, "");
    
    // Get friendly chord name
    return rootNote + symbol;
}

// Add debugging function to help diagnose issues
function debugToneStatus() {
  console.log("------ TONE.JS DEBUG INFO ------");
  console.log("Audio Context State:", audioContext?.state);
  console.log("Tone Context State:", Tone.context.state);
  console.log("Tone Transport State:", Tone.Transport.state);
  console.log("Part State:", part?.state);
  console.log("Synth exists:", !!synth);
  console.log("--------------------------------");
}

// --- Initialization Function (Runs Once) ---
async function initializeApp() {
    if (isAppInitialized) {
        console.log("initializeApp: Already initialized.");
        debugToneStatus();
        return audioContext;
    }
    console.log("initializeApp: Starting initialization...");
    try {
        // Create AudioContext
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("initializeApp: AudioContext created:", audioContext);
        
        // Set Tone context to our AudioContext
        Tone.setContext(audioContext);
        console.log("initializeApp: Tone context set to our AudioContext");
        
        // Get Mic Access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("initializeApp: Microphone access granted.");
        
        // Setup Pitch Detection
        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        mediaStreamSource.connect(analyserNode);
        pitchDetector = pitchy.PitchDetector.forFloat32Array(analyserNode.fftSize);
        
        // Setup Tone.js Synth with higher volume
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "triangle" // Softer sound
            },
            envelope: { attack: 0.04, decay: 0.5, sustain: 0.5, release: 1 },
            volume: -3 // Slightly quieter than default
        }).toDestination();
        
        // Setup Tone.js Part with explicit note triggering
        part = new Tone.Part((time, event) => {
            console.log("Part triggered:", time, event.notes);
            // IMPORTANT FIX: Use chord notation correctly
            synth.triggerAttackRelease(event.notes, event.duration, time);
            
            Tone.Draw.schedule(() => {
                const chordName = getChordName(event.notes);
                droneStatusDiv.textContent = `Drone: C Major II-V-I (${chordName}) - Playing`;
            }, time);
        }, chords);
        
        part.loop = true;
        part.loopStart = 0; 
        part.loopEnd = '2m';
        
        Tone.Transport.bpm.value = droneTempo;
        
        updateTonePart(); // This will create the initial part based on selections

        isAppInitialized = true;
        console.log("initializeApp: Initialization complete.");
        debugToneStatus();
        return audioContext;
    } catch (err) {
        console.error("Initialization failed:", err);
        pitchOutputDiv.innerHTML = `<span class="error">Init Error: ${err.message}. Check Console.</span>`;
        isAppInitialized = false;
        return null;
    }
}

// Function to update the current Tone.js Part based on selection
function updateTonePart() {
    // Get the current progression based on selected options
    const currentProgression = getCurrentProgression();
    const selectedKey = keySelect.value;
    const progressionType = progressionSelect.value;
    const description = progressionLibrary[progressionType].description;
    
    // Stop any existing part
    if (part) {
        part.stop();
        part.dispose();
    }
    
    // Create a new part with the current progression
    part = new Tone.Part((time, chord) => {
        console.log("Chord triggered:", time, chord.notes);
        
        // Play the chord
        synth.triggerAttackRelease(chord.notes, chord.duration, time);
        
        // Update the display
        Tone.Draw.schedule(() => {
            const chordName = getChordName(chord.notes, chord.symbol, selectedKey);
            droneStatusDiv.textContent = `Drone: ${description} in ${selectedKey} (${chordName}) - Playing`;
        }, time);
    }, currentProgression);
    
    // Configure the part
    part.loop = true;
    part.loopStart = 0;
    
    // Calculate loop end based on the last chord's time
    const lastChord = currentProgression[currentProgression.length - 1];
    const lastTime = Tone.Time(lastChord.time).toSeconds();
    const lastDuration = Tone.Time(lastChord.duration).toSeconds();
    part.loopEnd = `${Math.ceil(lastTime + lastDuration)}m`;
    
    // Start the part if we're currently practicing
    if (isPracticing && Tone.Transport.state === "started") {
        part.start("+0.1");
    }
    
    // Update status display
    droneStatusDiv.textContent = `Drone: ${description} in ${selectedKey} (Not Playing)`;
}

// Add event listeners for the selection dropdowns
progressionSelect.addEventListener('change', updateTonePart);
keySelect.addEventListener('change', updateTonePart);

// Modify your existing startPractice function
// Find the part where you start the part in startPractice:
/* 
if (part) {
    if (part.state !== "stopped") {
        part.stop(0);
    }
    part.start("+0.2");
    console.log("Part started");
}
*/

// --- Start Practice (Improved) ---
async function startPractice() {
    if (isPracticing) return;
    console.log("Starting practice...");
    debugToneStatus();
    
    if (!isAppInitialized || !audioContext) {
        console.error("startPractice: App not initialized or no audio context.");
        return;
    }

    try {
        // Make sure contexts are running
        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }
        
        if (Tone.context.state !== 'running') {
            await Tone.context.resume();
        }
        
        console.log("Contexts after resume:", audioContext.state, Tone.context.state);
        
        // Play a test chord
        console.log("Playing test chord...");
        synth.triggerAttackRelease(["C4", "E4", "G4"], "8n");
        
        // Start transport and part with slight delay for stability
        Tone.Transport.stop(); // Ensure clean state
        setTimeout(() => {
            Tone.Transport.start("+0.1");
            console.log("Transport started:", Tone.Transport.state);
            
            if (part) {
                part.stop();
                part.start("+0.2");
                console.log("Part started");
            }
            
            // Start pitch detection
            if (updatePitchInterval) clearInterval(updatePitchInterval);
            updatePitchInterval = setInterval(updatePitch, 100);
            
            // Update UI
            isPracticing = true;
            practiceButton.textContent = 'Stop Practice';
            practiceButton.classList.add('stop');
            pitchOutputDiv.innerHTML = 'Playing Drone...';
            droneStatusDiv.textContent = `Drone: C Major II-V-I - Starting...`;
            
            // Check status after everything is started
            setTimeout(debugToneStatus, 1000);
        }, 100);
        
    } catch (e) {
        console.error("startPractice: Error:", e);
        pitchOutputDiv.innerHTML = `<span class="error">Error: ${e.message}</span>`;
    }
}

// --- Stop Practice ---
async function stopPractice() {
    if (!isPracticing) return;
    console.log("stopPractice: Stopping practice session...");

    // Stop Tone.js
    if (Tone.Transport.state !== "stopped") {
        Tone.Transport.stop();
        if (part) part.stop();
        if (synth) synth.releaseAll();
        console.log("stopPractice: Tone.js Transport/Part stopped. Synth released.");
    }

    // Stop Pitch Detection
    if (updatePitchInterval) { 
        clearInterval(updatePitchInterval); 
        updatePitchInterval = null; 
    }
    console.log("stopPractice: Pitch detection interval cleared.");

    // Update UI
    isPracticing = false;
    practiceButton.textContent = 'Start Practice';
    practiceButton.classList.remove('stop');
    pitchOutputDiv.innerHTML = 'Stopped.';
    droneStatusDiv.textContent = `Drone: C Major II-V-I (Not Playing)`;
}

// --- Pitch Detection Loop (Function) ---
function updatePitch() {
    if (!pitchDetector || !analyserNode || !audioContext || audioContext.state !== 'running') return;
    let pitch = 0; let clarity = 0;
    try {
        const input = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(input);
        [pitch, clarity] = pitchDetector.findPitch(input, audioContext.sampleRate);
        if (clarity > 0.90 && isPracticing) {
            const noteInfo = frequencyToNoteInfo(pitch);
            if (noteInfo) {
                pitchOutputDiv.innerHTML = `<span class="note">${noteInfo.note}${noteInfo.octave}</span> <span class="frequency">${pitch.toFixed(2)} Hz</span> <span class="clarity">Clarity: ${clarity.toFixed(2)}, Cents off: ${noteInfo.cents}</span>`;
            } else {
                  pitchOutputDiv.innerHTML = `<span class="note">?</span> <span class="frequency">${pitch.toFixed(2)} Hz</span> <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>`;
            }
        } else if (isPracticing) {
            pitchOutputDiv.innerHTML = `<span class="note">---</span> <span class="frequency">--- Hz</span> <span class="clarity">Clarity: ${clarity.toFixed(2)} (Low)</span>`;
        }
    } catch (err) {
        console.error("Error during updatePitch:", err);
        if (isPracticing) { pitchOutputDiv.innerHTML = `<span class="error">Error detecting pitch. Check console.</span>`; }
    }
 }

// --- Frequency to Note Conversion ---
function frequencyToNoteInfo(frequency, a4Frequency = 440.0) {
    if (frequency <= 0) { return null; }
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const midiNumFloat = 12 * (Math.log(frequency / a4Frequency) / Math.log(2)) + 69;
    const midiNumInt = Math.round(midiNumFloat);
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));
    const octave = Math.floor(midiNumInt / 12) - 1;
    const correctedNoteIndex = (midiNumInt % 12 + 12) % 12;
    const noteName = noteNames[correctedNoteIndex];
    return { note: noteName, octave: octave, cents: cents };
}

// --- Event Listener for the Main Button ---
practiceButton.addEventListener('click', async () => {
    console.log("Practice button clicked.");

    try {
        // First make sure audio is initialized
        if (!isAppInitialized) {
            console.log("Button Click: First initialization...");
            audioContext = await initializeApp();
            if (!audioContext) {
                console.error("Button Click: Initialization failed.");
                return;
            }
        }
        
        // First click - resume context if needed
        if (!hasUserGestured) {
            console.log("First user gesture, starting audio...");
            await Tone.start();
            hasUserGestured = true;
            console.log("Audio started after user gesture");
        }

        // Toggle practice state
        if (isPracticing) {
            await stopPractice();
        } else {
            await startPractice();
        }
    } catch (err) {
        console.error("Error in button handler:", err);
        pitchOutputDiv.innerHTML = `<span class="error">Error: ${err.message}</span>`;
    }
});

// --- Optional: Stop if page visibility changes ---
document.addEventListener('visibilitychange', async () => {
    if (document.hidden && isPracticing) {
        console.log("Stopping practice due to page visibility change.");
        await stopPractice();
    }
});

console.log("Integrated practice tool script loaded. Click 'Start Practice'.");