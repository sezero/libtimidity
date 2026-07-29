# Changelog

All changes in this release were specifically made to meet the requirements for integrating the **MIDI Player into a Digital Audio Workstation (DAW)**.

## [Unreleased]

### 1. Added Methods
- **C API**: Added the `mid_send_event` function in `playmidi.c/h` to inject various MIDI Control Change events (Volume, Expression, Pitch Bend, Pan, Sustain, etc.) in *real-time* into the synthesizer engine.
- **JavaScript API**: Added the `sendEvent()` method to the `TimidityPlayer` class to forward DAW slider/control interactions simultaneously to `songPtr` (main song) and `realtimeSongPtr` (real-time synth).
- **Real-time Architecture**: Added the `initRealtimeSong()` method in JavaScript to create a persistent background *synthesizer* (`realtimeSongPtr`) that runs independently of the play/pause status of the main song.

### 2. Added Parameters to Existing Methods
- **`mid_note_on`**: Added new parameters namely `bank`, `pan`, `bend`, `modulation`, `chorus`, and `sustain`. This addition is absolutely necessary so the DAW has full control over the properties of each note pressed via the *real-time playing* feature.
- **`mid_song_load_program`**: Added the `is_drum` parameter so that the *dynamic instrument loading* function can differentiate loading a melodic instrument from a standard bank versus a *Drum Kit* preset.

### 3. Added Callbacks
- **Event Callback**: Added a callback hook to forward specific MIDI events (such as lyric changes, meta-events, or song markers) back to the JavaScript *layer* during rendering.
- **Debug Callback**: Added the `mid_set_debug_msg_callback` function to bridge the debugging *output* directly from the C core (libTiMidity) to the web *browser* console.

### 4. Added Parameters to Existing Callbacks
- Expanded the callback function *signature* from C to JS to now include **absolute time (milliseconds)**, **event status**, **event type**, and a pointer reference to **text** (for *lyrics/text events*). This ensures the DAW receives a 100% *sample-accurate* read position.

### 5. Changed Behavior of Existing Methods and Callbacks for DAW Needs
- **AudioContext Suspend Separation**: Modified the `pause()` method so that it does **not** disable (`suspend`) the *Web Audio API*. In this way, *real-time noteOn* and parameter changes (*Control Change*) can be operated smoothly even if the main MIDI file is in a frozen (paused) state.
- **Offline Render Protection**: The `noteOn`, `noteOff`, and `sendEvent` functions are automatically disabled if they detect the use of an `OfflineAudioContext`. This prevents spontaneous user inputs from corrupting the *rendering buffer* when the DAW is *bouncing* or exporting audio.
- **Callback Timing Accuracy**: Changed the working cycle of the Event Callback to fire parameters at their exact sample reading momentum in `read_wave`, compared to the static old model.

### Major Configuration Changes
- **Removal of Silence Trimming**: 
  - **Before**: The engine forcibly discarded (trimmed) seconds of silence at the beginning of the song.
  - **After**: Initial silence trimming is completely removed. The start time of the played file is strictly kept as is to maintain *alignment* with other DAW tracks.
- **Drum Channel Adjustment**:
  - **Before**: Channel 15 was hardcoded as a drum channel.
  - **After**: Channel 15 has been reverted to a standard melodic instrument channel. The engine now strictly adheres to the *General MIDI* standard by only assigning Channel 9 as the *Drum Channel*.
