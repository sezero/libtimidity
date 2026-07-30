# Changelog

All notable changes to this project will be documented in this file.

The changes in this release were specifically made to meet the requirements for integrating the **MIDI Player into a Digital Audio Workstation (DAW)**.

## [Unreleased]

### Added

**C API / Core Engine**
- Added `mid_song_create` function to initialize an empty `MidSong` structure without requiring a MIDI file. Crucial for creating persistent background synthesizers (real-time synths).
- Added `mid_note_on`, `mid_note_off`, and `mid_send_event` functions in `playmidi.c/h` to inject notes and MIDI Control Change events in *real-time* into the synthesizer engine.
- Added new parameters to `mid_note_on`: `bank`, `pan`, `bend`, `modulation`, `chorus`, and `sustain` to give the DAW full control over note properties during real-time playback.
- Added `mid_song_get_required_patches` and `mid_song_get_patch_names` to dynamically analyze a MIDI stream and retrieve a list of required GUS patches before playback.
- Added `mid_song_load_program` (with an `is_drum` parameter) to dynamically load a specific instrument program into the active synthesizer.
- Added `mid_song_get_current_tick` to retrieve the current tick position of the playback.
- Added `mid_song_get_info_json` to retrieve essential song metadata (number of note tracks, active channels, max tick, duration in seconds, sample rate, bit depth, and estimated PCM size) as a JSON string.
- Added `mid_song_get_controller_value_at_tick` function to simulate playback up to a tick and query the state of a specific controller (volume, pan, pitch bend, expression, sustain) for any channel.
- Added `mid_song_set_volume` to adjust global song amplification dynamically.
- Added `mid_song_resend_active_notes` to forcefully trigger the callback for all currently playing notes, allowing the UI to refresh its state.
- Added `mid_song_set_transpose` to instantly transpose all incoming notes (except drum channels) up or down by a specified number of semitones. Useful for quickly changing the key of the playback without modifying the original MIDI data.
- Added `mid_song_set_channel_mute` to independently mute or unmute any of the 16 MIDI channels. Muting a channel instantly kills any active notes on that channel to save CPU and polyphony, making it perfect for DAW 'Solo/Mute' track features.
- Added `mid_song_set_track_mute` to mute or unmute specific tracks (0-255) for MIDI Type 1 files. This allows true per-track muting in a multi-track MIDI file.
- Added `mid_song_panic` as a MIDI "Panic" feature. This instantly sends a `VOICE_DIE` command to all active polyphony voices, which is extremely useful to stop hanging notes when a DAW seeks abruptly.
- Added `mid_song_get_active_voices` to query the exact number of polyphony voices currently sounding in the synthesizer.
- Added `mid_song_get_master_peak` to query the highest absolute sample value generated since the last reset, perfect for building a true DAW Master VU/Peak Meter.
- Added **Event Callback** hook (`mid_song_set_event_callback`) to forward specific MIDI events (Note On/Off, Control Changes, lyric changes, tempo, meta-events) back to the JavaScript layer during the audio rendering loop.
- Added **Debug Callback** hook (`mid_set_debug_msg_callback`) and `timi_debug_msg` in `common.c` to bridge internal libTiMidity debug output to the web browser console instead of `stderr`.

**JavaScript API / TimidityPlayer**
- Exposed all newly added C functions (`mid_song_create`, `mid_note_on`, `mid_song_set_transpose`, `mid_song_set_channel_mute`, `mid_song_set_track_mute`, `mid_song_panic`, `mid_song_get_info_json`, etc.) via Emscripten `cwrap`.
- Added the `sendEvent()` method to forward DAW slider/control interactions simultaneously to `songPtr` (main song) and `realtimeSongPtr` (real-time synth).
- Added `setTranspose(semitones)` method to globally adjust the pitch of the playback using the new C API.
- Added `setChannelMute(channel, mute)` method to toggle the mute state of any MIDI channel.
- Added `setTrackMute(track, mute)` method to toggle the mute state of any MIDI track.
- Added `getInfo()` method to parse and return song metadata (tracks, channels, PCM size, etc.) from the new C API.
- Added `getActiveVoices()` and `getMasterPeak(reset)` wrappers to feed real-time performance and audio level data to the UI.
- Added `panic()` method mapped to the new C Panic API.
- Added a full **Mixer Solo** button logic to the web UI. Selecting Solo on a channel automatically mutes all other un-soloed channels, simulating professional DAW behavior.
- Added the `initRealtimeSong()` method to create a persistent background *synthesizer* (`realtimeSongPtr`) utilizing the new `mid_song_create` C API.

### Changed

**Behavior & Audio Management**
- **Drum Channel Adjustment**: Modified `DEFAULT_DRUMCHANNELS` in `options.h`. Channel 15 (0-based) is no longer hardcoded as a drum channel and is reverted to a standard melodic instrument channel. The engine now strictly adheres to the General MIDI standard (only 0-indexed Channel 9 is the Drum Channel).
- **Removal of Silence Trimming**: Modified `readmidi.c` so the engine no longer forcibly discards seconds of silence at the beginning of the song, maintaining strict time alignment with other DAW tracks.
- **Instrument Loading Signature**: Modified `load_instrument` in `instrum.c` to return an integer status (`0` for success, `-1` for failure) instead of `void`, allowing error handling when dynamically loading missing patches.
- **AudioContext Suspend Separation**: Modified `pause()` in JS so it does **not** disable (`suspend`) the Web Audio API. This allows real-time `noteOn` and Control Change events to operate smoothly even when the main MIDI file is paused.
- **Offline Render Protection**: The `noteOn`, `noteOff`, and `sendEvent` functions in JS are now automatically disabled if they detect the use of an `OfflineAudioContext`, preventing user inputs from corrupting the render buffer when bouncing/exporting audio.

**Callbacks & Accuracy**
- **Callback Timing Accuracy**: Modified `mid_song_read_wave` in `playmidi.c` to fire the Event Callback exactly when events are processed in the sample generation loop, drastically improving timing accuracy over the old static model.
- **Expanded Event Callback Signature**: Modified the internal `MidEvent` structure to use `uintptr_t` instead of `uint8` for parameters `a` and `b`. This safely passes memory pointers (like string addresses for lyrics) back to JS. The callback now includes absolute time (milliseconds), event status, event type, and text.
- **Offline Rendering Optimization**: Added a `skip_callback` parameter to `mid_song_read_wave` in `playmidi.c` and `timidity.h`. When set to 1, this prevents the `global_event_callback` from firing during audio sample generation. This is specifically used during offline WAV rendering to prevent excessive UI events and significantly speed up the processing time.
