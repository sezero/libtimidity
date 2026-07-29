# Changelog

All notable changes to this project will be documented in this file.

The changes in this release were specifically made to meet the requirements for integrating the **MIDI Player into a Digital Audio Workstation (DAW)**.

## [Unreleased]

### Added

**C API / Core Engine**
- Added `mid_song_get_controller_value_at_tick` function to query the state of a specific controller (e.g., volume, pan, pitch bend) for any channel at a specific MIDI tick. This is crucial for UI elements like VU meters or automation lanes.
- Added `mid_send_event` function in `playmidi.c/h` to inject various MIDI Control Change events in *real-time* into the synthesizer engine.
- Added new parameters to `mid_note_on`: `bank`, `pan`, `bend`, `modulation`, `chorus`, and `sustain` to give the DAW full control over note properties during real-time playback.
- Added `is_drum` parameter to `mid_song_load_program` to differentiate between melodic instruments and Drum Kit presets during dynamic instrument loading.
- Added a new **Event Callback** hook to forward specific MIDI events (lyric changes, meta-events, song markers) back to the JavaScript layer during rendering.
- Added a new **Debug Callback** (`mid_set_debug_msg_callback`) to bridge debugging output directly from the C core (libTiMidity) to the web browser console.

**JavaScript API / TimidityPlayer**
- Exposed the new C function as `player.getControllerValueAtTick(channel, cc, tick)`.
- Added the `sendEvent()` method to forward DAW slider/control interactions simultaneously to `songPtr` (main song) and `realtimeSongPtr` (real-time synth).
- Added the `initRealtimeSong()` method to create a persistent background *synthesizer* (`realtimeSongPtr`) that runs independently of the play/pause status of the main song.

### Changed

**Behavior & Audio Management**
- **AudioContext Suspend Separation**: Modified `pause()` so it does **not** disable (`suspend`) the Web Audio API. This allows real-time `noteOn` and Control Change events to operate smoothly even when the main MIDI file is paused.
- **Offline Render Protection**: The `noteOn`, `noteOff`, and `sendEvent` functions are now automatically disabled if they detect the use of an `OfflineAudioContext`, preventing user inputs from corrupting the render buffer when bouncing/exporting audio.
- **Drum Channel Adjustment**: Channel 15 (1-based) is no longer hardcoded as a drum channel and is reverted to a standard melodic instrument channel. The engine now strictly adheres to the General MIDI standard (only Channel 10 / 0-indexed Channel 9 is the Drum Channel).
- **Removal of Silence Trimming**: The engine no longer forcibly discards seconds of silence at the beginning of the song, maintaining strict time alignment with other DAW tracks.

**Callbacks & Accuracy**
- **Callback Timing Accuracy**: Changed the working cycle of the Event Callback to fire parameters at their exact sample reading momentum in `read_wave`, drastically improving timing over the static old model.
- **Expanded Event Callback Signature**: Expanded the C-to-JS callback to include absolute time (milliseconds), event status, event type, and a pointer reference to text (for lyrics/text events), ensuring the DAW receives a 100% sample-accurate read position.
