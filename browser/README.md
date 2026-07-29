# LibTiMidity Web (DAW Edition)

This is a WebAssembly port of the `libTiMidity` MIDI synthesizer engine, equipped with a comprehensive JavaScript API (`TimidityPlayer`) designed specifically for integration into a **Digital Audio Workstation (DAW)** operating in the web browser.

## Overview

The standard libTiMidity engine has been heavily modified and extended to meet the real-time interaction, sample accuracy, and dynamic requirements of modern web-based DAWs. 

### Key Features
- **Real-Time Synthesizer (MIDI Controller Support)**: 
  A dedicated background synthesizer instance runs independently of the main playback. This allows you to play notes via a MIDI controller or computer keyboard with zero latency, even if the main track is paused.
- **Dynamic Instrument Loading**: 
  Instead of freezing the browser to load hundreds of megabytes of soundfonts at once, the engine analyzes your `.mid` files or takes direct commands to load *only* the specific patches required for playback on-the-fly.
- **Sample-Accurate Callbacks**:
  Events (such as Lyrics, Meta-events, and Note On/Off triggers) are dispatched back to JavaScript precisely when the audio buffer reaches that exact sample. This guarantees flawless UI synchronization (like lighting up virtual piano keys or updating lyrics).
- **DAW Controller Emulation**:
  Full support for sending and retrieving `Control Change` events (Volume, Pan, Pitch Bend, Expression, Sustain) dynamically.
- **Offline Rendering Protection**:
  Automatically manages Web Audio API contexts, preventing accidental real-time inputs from corrupting offline rendering tasks (e.g., bouncing tracks to a WAV file).

## Quick Start

Include the scripts in your HTML:

```html
<script src="libtimidity.js"></script>
<script src="timidity-player.js"></script>
```

Initialize the player:

```javascript
const player = new TimidityPlayer();

player.on('onInit', async () => {
    console.log("Synthesizer is ready!");
    
    // Load a MIDI file
    await player.load(midiDataBuffer);
    
    // Start playback
    player.play();
});

// Initialize the engine
player.init();
```

### Handling Real-Time MIDI Input

If you have a MIDI controller connected, you can directly inject real-time events into the engine:

```javascript
// Press Middle C (Pitch 60) on Channel 0
player.noteOn(0, instrumentProgram, 60, 100);

// Release Middle C
player.noteOff(0, 60);

// Adjust Pitch Bend
player.sendEvent(256, 0, bendValue);
```

## Documentation
Please refer to the JSDoc comments within `timidity-player.js` for an exhaustive list of methods and events. For a detailed list of changes made to the C Core, read `CHANGELOG.md`.

## License
The C core synthesizer is licensed under the **LGPL** (borrowed from the original `libTiMidity` project). The JavaScript bindings, WebAssembly bridge, and `TimidityPlayer` class created for this specific repository are provided under the **MIT License**. See the `LICENSE` file for details.
