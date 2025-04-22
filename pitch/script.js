// Import using esm.sh which resolves internal dependencies
import * as pitchy from 'https://esm.sh/pitchy@4.1.0'; // Import EVERYTHING as 'pitchy'

// --- Add logging right after import ---
console.log("Imported pitchy module:", pitchy);
// Let's see if PitchDetector exists within the imported object
console.log("PitchDetector object inside pitchy:", pitchy.PitchDetector);
// --- End of new logging ---

const startButton = document.getElementById('startButton');
const outputDiv = document.getElementById('output');

let audioContext = null;
let analyserNode = null;
let detector = null;
let mediaStreamSource = null;
let updatePitchInterval = null;
let isListening = false;

// --- Web Audio API Setup ---
async function setupAudio() {
    try {
        console.log("Setting up audio context..."); // Logging
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Requesting microphone access..."); // Logging
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted."); // Logging

        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;

        mediaStreamSource.connect(analyserNode);
        console.log("Audio nodes connected."); // Logging

        // --- Add logging before the failing line ---
        console.log("Attempting to create PitchDetector. AnalyserNode:", analyserNode);
        console.log("Using pitchy object:", pitchy);
        console.log("Trying to access pitchy.PitchDetector:", pitchy.PitchDetector);
        // --- End of new logging ---

        // NEW - Use forFloat32Array, providing the expected buffer size
        detector = pitchy.PitchDetector.forFloat32Array(analyserNode.fftSize);

        console.log("Pitch detector initialized:", detector); // Logging success
        return true;

    } catch (err) {
        // Add logging for the error itself
        console.error("Error during setupAudio:", err);
        outputDiv.innerHTML = `<span class="error">Error: Could not access microphone or init detector. Check console. ${err.message}</span>`;
        if (audioContext) {
            audioContext.close().catch(e => console.error("Error closing context:", e));
            audioContext = null;
        }
        return false;
    }
}
/**
 * Converts a frequency in Hz to the nearest musical note name, octave, and cents deviation.
 * @param {number} frequency - The frequency in Hz.
 * @param {number} a4Frequency - The reference frequency for A4 (usually 440).
 * @returns {{note: string, octave: number, cents: number}|null} - Object with note info, or null if frequency is invalid.
 */
function frequencyToNoteInfo(frequency, a4Frequency = 440.0) {
    if (frequency <= 0) {
        return null; // Invalid frequency
    }

    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    // Calculate the MIDI note number (can be fractional)
    // Formula: 12 * log2(freq / A4_freq) + 69 (MIDI number for A4)
    const midiNumFloat = 12 * (Math.log(frequency / a4Frequency) / Math.log(2)) + 69;

    // Find the nearest integer MIDI note number
    const midiNumInt = Math.round(midiNumFloat);

    // Calculate the deviation in cents
    // Cents = 100 * (fractional_midi - integer_midi)
    const cents = Math.round(100 * (midiNumFloat - midiNumInt));

    // Calculate octave and note index
    const octave = Math.floor(midiNumInt / 12) - 1; // MIDI note 69 (A4) is in octave 4
    const noteIndex = midiNumInt % 12;

     // Handle potential edge cases for noteIndex (e.g., negative results if frequency is very low)
     const correctedNoteIndex = (noteIndex + 12) % 12;

    const noteName = noteNames[correctedNoteIndex];

    return {
        note: noteName,
        octave: octave,
        cents: cents
    };
}
// --- Pitch Detection Loop ---
function updatePitch() {
    if (!detector || !audioContext || !analyserNode) {
        return;
    }

    let pitch = 0;
    let clarity = 0;

    try {
        const input = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(input);

        [pitch, clarity] = detector.findPitch(input, audioContext.sampleRate);

        if (clarity > 0.90) { // Make sure clarity is high enough before converting
            // *** THE CORE CHANGE IS HERE ***
            // Use our custom frequencyToNoteInfo function
            const noteInfo = frequencyToNoteInfo(pitch);
            // *** END OF CORE CHANGE ***

            // Check if our function returned valid info
            if (!noteInfo) {
                 console.warn("frequencyToNoteInfo returned null for pitch:", pitch);
                 outputDiv.innerHTML = `
                    <span class="note">Note ?</span>
                    <span class="frequency">${pitch.toFixed(2)} Hz</span>
                    <span class="clarity">Clarity: ${clarity.toFixed(2)}</span>
                 `;
                 return;
            }

            // Proceed with the returned info
            const noteName = noteInfo.note;
            const octave = noteInfo.octave;
            const centsOff = noteInfo.cents; // Use the 'cents' property from our function

            outputDiv.innerHTML = `
                <span class="note">${noteName}${octave}</span>
                <span class="frequency">${pitch.toFixed(2)} Hz</span>
                <span class="clarity">Clarity: ${clarity.toFixed(2)}, Cents off: ${centsOff}</span>
            `; // Removed .toFixed(1) for cents as it's already rounded

        } else {
            // Display placeholder if clarity is too low
            outputDiv.innerHTML = `
                 <span class="note">---</span>
                 <span class="frequency">--- Hz</span>
                 <span class="clarity">Clarity: ${clarity.toFixed(2)} (Low)</span>
            `;
        }
    } catch (err) {
        console.error("Error during updatePitch:", err);
        console.error("Error occurred for pitch value (approx):", pitch, "Clarity:", clarity);
        outputDiv.innerHTML = `<span class="error">Error detecting/converting pitch. Check console.</span>`;
    }
}

// --- Start/Stop Logic --- (Added some logging)
async function startListening() {
    if (isListening) return;
    console.log("StartListening called."); // Logging

    if (audioContext && audioContext.state === 'suspended') {
        console.log("Resuming suspended audio context..."); // Logging
        await audioContext.resume();
    }

    if (!audioContext) {
        console.log("Audio context not found, running setupAudio..."); // Logging
        const success = await setupAudio();
        if (!success) {
            console.log("setupAudio failed, exiting startListening."); // Logging
            return;
        }
    }

    console.log("Starting pitch update interval."); // Logging
    updatePitchInterval = setInterval(updatePitch, 100);
    isListening = true;
    startButton.textContent = 'Stop Listening';
    outputDiv.innerHTML = 'Listening...';
}

function stopListening() {
    if (!isListening) return;
    console.log("StopListening called."); // Logging

    if (updatePitchInterval) {
        clearInterval(updatePitchInterval);
        updatePitchInterval = null;
        console.log("Pitch update interval cleared."); // Logging
    }

    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
        mediaStreamSource = null;
        console.log("Media stream source disconnected and tracks stopped."); // Logging
    }
     if (audioContext) {
         audioContext.suspend().catch(e => console.error("Error suspending context:", e));
         console.log("Audio context suspended."); // Logging
     }


    isListening = false;
    startButton.textContent = 'Start Listening';
    outputDiv.innerHTML = 'Stopped.';
}

// --- Event Listener --- (No changes needed)
startButton.addEventListener('click', () => {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isListening) {
        stopListening();
        console.log("Stopped listening due to page visibility change."); // Logging
    }
});

console.log("Pitch detection script loaded. Module import attempted. Click 'Start Listening'."); // Modified log