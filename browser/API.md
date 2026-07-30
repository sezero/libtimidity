# TimidityPlayer API Reference

`TimidityPlayer` is a high-level JavaScript class that provides an interface to the libTiMidity WebAssembly module. It handles MIDI playback, real-time MIDI input, audio context management, patch downloading, and offline audio rendering.

## Constructor

### `new TimidityPlayer(options)`
Creates a new instance of the TimidityPlayer.
- **Parameters:**
  - `options` *(Object)*: Configuration options.
    - `options.patchUrlBase` *(string)*: Base URL path for loading GUS patches and `timidity.cfg` (e.g., `'gus-patch'`).

---

## Event Emitter Methods

The player extends an internal event emitter to broadcast state changes and MIDI events.

### `on(eventName, listener)`
Registers a callback function for a specific event.
- **Parameters:**
  - `eventName` *(string)*: The name of the event.
  - `listener` *(Function)*: Callback to execute when the event fires.

#### Supported Events:
- `onInit`: Fired when the WebAudio context and WASM engine are initialized.
- `onMidiLoading(midi)`: Fired when a MIDI file starts loading.
- `onMidiLoaded(midi)`: Fired when a MIDI file has been fully loaded and parsed.
- `onInstrumentLoading(loadedCount, totalCount, filename)`: Fired while downloading required patch files.
- `onInstrumentLoaded(totalCount)`: Fired when all required patches have been successfully downloaded.
- `onPlay`, `onPause`, `onResume`, `onStop`, `onEnded`: Playback state changes.
- `onPlaying(tick, timeInSeconds)`: Fired periodically (every 1 second) during playback to report progress.
- `onSeek(tick, timeInSeconds)`: Fired when the playback position is manually shifted.
- `onRenderProgress(progressPercent)`: Fired during offline rendering.
- `onRenderComplete(wavBlob)`: Fired when offline rendering finishes.
- `onNoteOn(event)` / `onNoteOff(event)`: Fired for specific note events.
- `onMIDIEvent(event)`: Fired for all MIDI events processed by the engine.
- `error(message)`: Fired when an internal error occurs.

---

## Initialization & Lifecycle

### `init(offline = false)`
Initializes the WebAudio context and the libTiMidity engine. Must be called before loading or playing any MIDI files.
- **Parameters:**
  - `offline` *(boolean)*: If `true`, creates an `OfflineAudioContext` for rendering without audio playback.
- **Returns:** `Promise<boolean>` - `true` if initialization was successful.

### `shutdown()`
Completely shuts down the player, stops playback, frees memory, and closes the WebAudio context.

---

## Playback & Controls

### `load(midi)`
Loads a MIDI file into the player and automatically analyzes and downloads the required patches.
- **Parameters:**
  - `midi` *(File | Uint8Array)*: The MIDI file data.
- **Returns:** `Promise<boolean>` - `true` if loaded successfully.

### `play(offset = 0, options = {})`
Starts or resumes playback of the currently loaded MIDI song.
- **Parameters:**
  - `offset` *(number)*: Time offset in seconds to start playing from.
  - `options` *(Object)*: Additional playback configuration (currently reserved for future use).

### `loadAndPlay(midi, offset = 0, options = {})`
Convenience method to sequentially call `load()` and `play()`.
- **Parameters:**
  - `midi` *(File | Uint8Array)*: The MIDI file data.
  - `offset` *(number)*: Time offset in seconds.
  - `options` *(Object)*: Additional playback configuration.
- **Returns:** `Promise<void>`

### `pause()` / `resume()` / `stop()`
Controls the playback state. `stop()` will also free the currently loaded song from memory.

### `seek(timeInSeconds)`
Seeks to a specific time position within the currently loaded MIDI song.
- **Parameters:**
  - `timeInSeconds` *(number)*: The absolute target time in seconds.

### `setVolume(volume)`
Sets the master volume of the loaded song.
- **Parameters:**
  - `volume` *(number)*: The volume level (0 to 100).

### `setTranspose(semitones)`
Sets the global pitch transpose.
- **Parameters:**
  - `semitones` *(number)*: The number of semitones to shift (-12 to +12).

### `setChannelMute(channel, mute)`
Mutes or unmutes a specific MIDI channel.
- **Parameters:**
  - `channel` *(number)*: MIDI channel (0-15).
  - `mute` *(boolean)*: `true` to mute, `false` to unmute.

### `setTrackMute(track, mute)`
Mutes or unmutes a specific MIDI track.
- **Parameters:**
  - `track` *(number)*: MIDI track index (0-255).
  - `mute` *(boolean)*: `true` to mute, `false` to unmute.

### `panic()`
Instantly kills all currently sounding notes across all channels.

---

## Real-time Synthesizer (MIDI Input)

### `noteOn(channel, program, pitch, velocity = 100, params = {})`
Sends a MIDI Note On message. Dynamically downloads the instrument patch if it hasn't been loaded yet.
- **Parameters:**
  - `channel` *(number)*: MIDI channel (0-15).
  - `program` *(number)*: Instrument program number (0-127).
  - `pitch` *(number)*: MIDI pitch/note (0-127).
  - `velocity` *(number)*: Note velocity (0-127). Default is `100`.
  - `params` *(Object)*: Optional parameters to control the instrument's initial state.
    - `params.bank` *(number)*: Instrument bank number. Default is `0`.
    - `params.pan` *(number)*: Panning (0-127). Default is `64` (center).
    - `params.bend` *(number)*: Pitch bend (0-16383). Default is `8192` (center).
    - `params.modulation` *(number)*: Modulation wheel (0-127). Default is `0`.
    - `params.chorus` *(number)*: Chorus depth (0-127). Default is `0`.
    - `params.sustain` *(number)*: Sustain pedal (0-127). Default is `0`.

### `noteOff(channel, pitch)`
Sends a MIDI Note Off message.

### `sendEvent(eventType, channel, a, b = 0)`
Broadcasts a general MIDI event to the active synthesizer.
- **Parameters:**
  - `eventType` *(number)*: Internal TiMidity event constant (e.g., `this.ME_PITCHWHEEL`).

---

## Data & Information

### `getInfo()`
Gets metadata and information about the currently loaded song.
- **Returns:** `Object | null` - Parsed JSON object containing song info (title, copyright, text events, etc.).

### `getActiveVoices()`
- **Returns:** `number` - The number of currently active polyphony voices.

### `getMasterPeak(channel = 0, reset = true)`
Gets the master peak volume since the last reset, calculated directly from the WebAudio output buffer.
- **Parameters:**
  - `channel` *(number)*: `0` for Left, `1` for Right.
  - `reset` *(boolean)*: If `true`, resets the peak value after reading.
- **Returns:** `number` - Peak value scaled from 0 to 127.

### `getControllerValueAtTick(channel, cc, tick)`
- **Returns:** `number` - The controller value (0-127) at the exact tick position.

---

## Configuration & Patches

These methods read directly from the `timidity.cfg` file located at `patchUrlBase`.

### `getBankList()`
- **Returns:** `Promise<number[]>` - A sorted array of available bank IDs.

### `getInstrumentList(bank)`
- **Parameters:**
  - `bank` *(number)*: The target bank ID.
- **Returns:** `Promise<Array<{id: number, file: string}>>` - A sorted array of instrument objects containing the program `id` and the patch `file` or name.

### `getDrumList(bank)`
- **Parameters:**
  - `bank` *(number)*: The target drumset bank ID.
- **Returns:** `Promise<Array<{id: number, file: string}>>` - A sorted array of drum instrument objects.

---

## Utilities

### `renderOffline()`
Renders the currently loaded MIDI song to a WAV file offline (without playing it over speakers). Yields progress via the `onRenderProgress` event.
- **Returns:** `Promise<Blob>` - The generated WAV file as a `Blob`.

### `formatTime(seconds, withMiliSecond = false)`
Formats seconds into a human-readable string (e.g., `H:MM:SS` or `M:SS.mmm`).
- **Returns:** `string`
