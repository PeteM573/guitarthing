// script.js

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton'); // Added to grab the stop button!

startButton.addEventListener('click', async () => {
    await Tone.start();
    console.log('audio is ready');

    // ** Code for your project, below, goes here. **

    // Step 3: Create a Synth and Chord Progression

    // Create a synth
    const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
            attack: 0.04,
            decay: 0.5,
            sustain: 0.3,
            release: .5
        }
    });


    // Define the notes for the II-V-I progression in C major (Dmin7, G7, Cmaj7)
    const chords = [
        { time: "0:0:0", note: ["D3", "F3", "A3", "C4"], duration: "2n" }, // Dmin7
        { time: "0:2:0", note: ["G2", "B2", "D3", "F3"], duration: "2n" }, // G7
        { time: "1:0:0", note: ["C3", "E3", "G3", "B3"], duration: "2n" }  // Cmaj7
    ];

    // Create a Tone.Part to schedule the notes
    const part = new Tone.Part(function(time, event) {
        // the events will be given to the callback with the time they occur
        synth.triggerAttackRelease(event.note, event.duration, time);
    }, chords);

    // Step 4: Schedule the Chord Progression

    // Use the part.loop property to set the progression to repeat indefinitely.
    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = '2m';

    // Start the Tone.js transport (the main clock for scheduling events).
    Tone.Transport.bpm.value = 60;  // Set the tempo

    // **Effects code BEGIN**

    // Create the effects
    const reverb = new Tone.Reverb({
        decay: 1.5,
        preDelay: 0.1
    });

    const delay = new Tone.PingPongDelay({
        delayTime: "8n",
        feedback: 0.6,
        wet: 0.3
    });

     // Connect the synth to the effects, and the effects to the destination
    synth.connect(reverb);
    reverb.connect(delay);
    delay.toDestination();

    // **Effects code END**

    Tone.Transport.start();

    part.start(0); //Start the part at the beginning
});

stopButton.addEventListener('click', () => {
    Tone.Transport.stop(); // Added stop functionality
});