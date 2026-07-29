var Module = {};

let patchUrlBase = 'gus-patch';

// This must be defined *before* libtimidity.js is loaded and executed.
Module.preRun = [() => {
    FS.mkdir('/gus-patch');
    FS.createPreloadedFile('/gus-patch', 'timidity.cfg', patchUrlBase + '/timidity.cfg', true, true);
}];


/**
 * TimidityPlayer provides a high-level JavaScript interface to the libTiMidity WebAssembly module.
 * It handles MIDI playback, real-time MIDI input, audio context management, and patch loading.
 */
class TimidityPlayer {
    /**
     * Creates a new instance of TimidityPlayer.
     * @param {Object} options - Configuration options for the player.
     * @param {string} [options.patchUrlBase] - Base URL path for loading GUS patches (e.g., 'gus-patch').
     */
    constructor(options = {}) {
        this.patchUrlBase = options.patchUrlBase;
        this.Module = Module;
        this.audioContext = null;
        this.scriptNode = null;
        this.songPtr = 0; // Pointer to the C MidSong object
        this.loadedPatches = new Set();
        this.eventListeners = {};
        this.playingInterval = null;
        this.isPlaying = false;
        this.isSyncEnabled = false; // New flag for mixer sync
        this.isPaused = false;
        this.isSeeking = false; // New flag to control seeker updates

        // MIDI Event Constants (re-added as they are used in the handler)
        this.ME_NOTEON = 1;
        this.ME_NOTEOFF = 2;
        this.ME_KEYPRESSURE = 3;
        this.ME_MAINVOLUME = 4;
        this.ME_PAN = 5;
        this.ME_SUSTAIN = 6;
        this.ME_EXPRESSION = 7;
        this.ME_PITCHWHEEL = 8;
        this.ME_PROGRAM = 9;
        this.ME_TEMPO = 10;
        this.ME_PITCH_SENS = 11;
        this.ME_ALL_SOUNDS_OFF = 12;
        this.ME_RESET_CONTROLLERS = 13;
        this.ME_ALL_NOTES_OFF = 14;
        this.ME_TONE_BANK = 15;
        this.ME_CONTROL_CHANGE = 16; // New constant for generic Control Change
        this.totalDuration = 0; // Total duration in seconds

        this.Module.onRuntimeInitialized = () => this._onRuntimeInitialized();
    }

    // --- Event Emitter ---

    /**
     * Registers a listener callback for a specific event.
     * @param {string} eventName - The name of the event to listen for.
     * @param {Function} listener - The callback function to be executed when the event is emitted.
     */
    on(eventName, listener) {
        if (!this.eventListeners[eventName]) this.eventListeners[eventName] = [];
        this.eventListeners[eventName].push(listener);
    }

    /**
     * Emits an event, calling all registered listeners with the provided arguments.
     * @param {string} eventName - The name of the event to emit.
     * @param {...any} args - The arguments to pass to the listeners.
     */
    emit(eventName, ...args) {
        this.eventListeners[eventName]?.forEach(listener => listener(...args));
    }

    // --- Private Methods ---

    /**
     * Callback triggered when the WebAssembly runtime is fully initialized.
     * Binds the C functions to JavaScript for internal usage.
     * @private
     */
    _onRuntimeInitialized() {
        const cwrap = this.Module.cwrap;
        this.c = {
            init: cwrap('mid_init', 'number', ['string']),
            exit: cwrap('mid_exit', null, []),
            getVersion: cwrap('mid_get_version', 'number', []),
            loadSong: cwrap('mid_song_load', 'number', ['number', 'number']),
            freeSong: cwrap('mid_song_free', null, ['number']),
            createSong: cwrap('mid_song_create', 'number', ['number']),
            getRequiredPatches: cwrap('mid_song_get_required_patches', 'string', ['number']),
            startSong: cwrap('mid_song_start', null, ['number']),
            setEventCallback: cwrap('mid_song_set_event_callback', null, ['number', 'number']),
            readWave: cwrap('mid_song_read_wave', 'number', ['number', 'number', 'number']),
            openMemoryStream: cwrap('mid_istream_open_mem', 'number', ['number', 'number']),
            seekStream: cwrap('mid_istream_seek', 'number', ['number', 'number', 'number']),
            closeStream: cwrap('mid_istream_close', null, ['number']),
            seekSong: cwrap('mid_song_seek', null, ['number', 'number']),
            setVolume: cwrap('mid_song_set_volume', null, ['number', 'number']),
            getTime: cwrap('mid_song_get_time', 'number', ['number']),
            getTotalTime: cwrap('mid_song_get_total_time', 'number', ['number']),
            getCurrentTick: cwrap('mid_song_get_current_tick', 'number', ['number']),
            noteOn: cwrap('mid_note_on', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']),
            noteOff: cwrap('mid_note_off', null, ['number', 'number', 'number']),
            loadProgram: cwrap('mid_song_load_program', 'number', ['number', 'number', 'number', 'number']),
            sendEvent: cwrap('mid_send_event', null, ['number', 'number', 'number', 'number', 'number']),
        };
        this.c.resendActiveNotes = this.Module.cwrap('mid_song_resend_active_notes', null, ['number']);
        this.c.getControllerValueAtTick = this.Module.cwrap('mid_song_get_controller_value_at_tick', 'number', ['number', 'number', 'number', 'number']);

        this.emit('runtimeInitialized');
    }

    _setupDebugCallback() {
        const debugCallback = (messagePtr) => {
            const message = this.Module.UTF8ToString(messagePtr);
            console.log("libTiMidity DEBUG:", message.trim()); // trim() to remove trailing newlines
        };
        const callbackPtr = this.Module.addFunction(debugCallback, 'vp');
        this.c.setDebugCallback(callbackPtr);
    }

    _handleMidiEvent(tick, timeMilisecond, eventStatus, channel, eventType, a, b, textPtr) {
        const timeSecond = timeMilisecond / 1000.0; // Convert milliseconds to seconds
        let text = '';
        if (textPtr) {
            text = this.Module.UTF8ToString(textPtr);
        }

        // Must before onMIDIEvent
        if ((eventStatus & 0xF0) === 0x90 && b > 0) { // Note On on any channel
            this.emit('onNoteOn', { tick: tick, channel: channel, pitch: a, velocity: b });
        } else if ((eventStatus & 0xF0) === 0x80 || ((eventStatus & 0xF0) === 0x90 && b === 0)) { // Note Off on any channel
            this.emit('onNoteOff', { tick: tick, channel: channel, pitch: a });
        }

        this.emit('onMIDIEvent', { tick: tick, timeSecond, status: eventStatus, eventType, channel, a, b, text });

    }

    async _loadRequiredPatches(patchListString) {
        if (!patchListString) return;

        const requiredPatches = patchListString.split('\n').filter(p => p.length > 0 && !this.loadedPatches.has(p));
        const total = requiredPatches.length;
        if (total === 0) return;

        this.emit('onInstrumentLoading', 0, total, '');

        const preloadPromises = requiredPatches.map(file => {
            const fullVirtualPath = `/${this.patchUrlBase}/${file}`; // e.g., /gus-patch/pat/0/arachno-000.pat
            this.Module.FS.mkdirTree(this.Module.PATH.dirname(fullVirtualPath)); // Create /gus-patch/pat/0
            return new Promise((resolve, reject) => {
                this.emit('onInstrumentLoading', this.loadedPatches.size, total, file);
                this.Module.FS.createPreloadedFile(this.Module.PATH.dirname(fullVirtualPath), this.Module.PATH.basename(file), `${this.patchUrlBase}/${file}`, true, true, resolve, reject); // Preload from server
            }).then(() => {
                this.loadedPatches.add(file);
            });
        });

        await Promise.all(preloadPromises);
        this.emit('onInstrumentLoaded', this.loadedPatches.size);
    }

    // --- Public API ---

    /**
     * Initializes the WebAudio context and the libTiMidity engine.
     * Must be called before loading or playing any MIDI files.
     * @param {boolean} [offline=false] - Whether to initialize an OfflineAudioContext for rendering without playback.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    async init(offline = false) {
        if (this.audioContext) {
            this.emit('error', "Already initialized.");
            return false;
        }
        const rc = this.c.init(`/${this.patchUrlBase}/timidity.cfg`); // Initialize libTiMidity with config file
        if (rc === 0) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = offline ? new OfflineAudioContext(2, 44100 * 60, 44100) : new AudioContextClass({ sampleRate: 44100 });
            if (!offline) {
                this.audioContext.suspend();

                await this.initRealtimeSong();

                const bufferSize = 4096;
                this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 0, 2);

                this.scriptNode.onaudioprocess = (e) => {
                    const outL = e.outputBuffer.getChannelData(0);
                    const outR = e.outputBuffer.getChannelData(1);
                    outL.fill(0);
                    outR.fill(0);

                    const pcmBytes = bufferSize * 2 * 2;
                    let bytesReadMain = 0;

                    if (this.songPtr !== 0 && !this.isPaused && this.isPlaying) {
                        const pcmBufferPtr = this.Module._malloc(pcmBytes);
                        bytesReadMain = this.c.readWave(this.songPtr, pcmBufferPtr, pcmBytes);
                        if (bytesReadMain > 0) {
                            const samplesRead = bytesReadMain / 4;
                            for (let i = 0; i < samplesRead; i++) {
                                outL[i] = this.Module.HEAP16[(pcmBufferPtr >> 1) + (i * 2)] / 32768.0;
                                outR[i] = this.Module.HEAP16[(pcmBufferPtr >> 1) + (i * 2) + 1] / 32768.0;
                            }
                        }
                        this.Module._free(pcmBufferPtr);

                        if (bytesReadMain <= 0) {
                            this.stop();
                            this.emit('onEnded');
                        }
                    }

                    if (this.realtimeSongPtr) {
                        const rtBufferPtr = this.Module._malloc(pcmBytes);
                        const rtBytes = this.c.readWave(this.realtimeSongPtr, rtBufferPtr, pcmBytes);
                        if (rtBytes > 0) {
                            const samplesRead = rtBytes / 4;
                            for (let i = 0; i < samplesRead; i++) {
                                outL[i] += this.Module.HEAP16[(rtBufferPtr >> 1) + (i * 2)] / 32768.0;
                                outR[i] += this.Module.HEAP16[(rtBufferPtr >> 1) + (i * 2) + 1] / 32768.0;
                            }
                        }
                        this.Module._free(rtBufferPtr);
                    }
                };

                this.scriptNode.connect(this.audioContext.destination);
            }

            // Preload the default instrument (Acoustic Grand Piano) for the real-time player
            // This ensures that the debug buttons and initial MIDI controller input work immediately.
            await this.setRealtimeInstrument(0, 0, 0).then(() => {
                console.log("Default real-time instrument (Piano) preloaded.");
            });

            const callbackPtr = this.Module.addFunction((...args) => this._handleMidiEvent(...args), 'viiiiippp');
            this.c.setEventCallback(0, callbackPtr);
            this.emit('onInit');
            return true;
        } else {
            this.emit('error', "Initialization failed. Check patch files.");
            return false;
        }
    }

    async initRealtimeSong() {
        if (this.realtimeSongPtr) return;

        const midiBytes = [
            0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x78,
            0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x0C,
            0x00, 0xFF, 0x51, 0x03, 0xFF, 0xFF, 0xFF,
            0x81, 0xEA, 0x30, 0x80, 0x00, 0x00,
            0x00, 0xFF, 0x2F, 0x00
        ];

        const emptyMidi = new Uint8Array(midiBytes);
        const midiDataPtr = this.Module._malloc(emptyMidi.length);
        this.Module.HEAPU8.set(emptyMidi, midiDataPtr);

        const optionsPtr = this.Module._malloc(12);
        this.Module.setValue(optionsPtr + 0, this.audioContext.sampleRate, 'i32');
        this.Module.setValue(optionsPtr + 4, 0x8010, 'i16'); // S16LSB, signed 16-bit
        this.Module.setValue(optionsPtr + 6, 2, 'i8');       // stereo output
        this.Module.setValue(optionsPtr + 8, 4096, 'i16');   // buffer size

        const streamPtr = this.c.openMemoryStream(midiDataPtr, emptyMidi.length);
        this.realtimeSongPtr = this.c.loadSong(streamPtr, optionsPtr);

        this.c.closeStream(streamPtr);
        this.Module._free(midiDataPtr);
        this.Module._free(optionsPtr);

        if (this.realtimeSongPtr !== 0) {
            this.c.startSong(this.realtimeSongPtr);
        }
    }

    resendActiveNotes() {
        if (this.songPtr !== 0) {
            this.c.resendActiveNotes(this.songPtr);
        }
    }

    getControllerValueAtTick(channel, cc, tick) {
        if (this.songPtr !== 0) {
            return this.c.getControllerValueAtTick(this.songPtr, channel, cc, tick);
        }
        return -1;
    }

    /**
     * Loads a MIDI file into the player and prepares required patches.
     * @param {File|Uint8Array} midi - The MIDI file data to load.
     * @returns {Promise<boolean>} True if loaded successfully, false otherwise.
     */
    async load(midi) {
        if (!this.audioContext) {
            this.emit('error', "Player not initialized. Call init() first.");
            return false;
        }
        if (this.songPtr !== 0) {
            this.stop();
        }

        this.emit('onMidiLoading', midi);

        const midiData = (midi instanceof Uint8Array) ? midi : new Uint8Array(await midi.arrayBuffer()); // Handle File object or Uint8Array
        const midiDataPtr = this.Module._malloc(midiData.length);
        this.Module.HEAPU8.set(midiData, midiDataPtr);

        const optionsPtr = this.Module._malloc(12);
        this.Module.setValue(optionsPtr + 0, this.audioContext.sampleRate, 'i32');
        this.Module.setValue(optionsPtr + 4, 0x8010, 'i16'); // S16LSB, signed 16-bit
        this.Module.setValue(optionsPtr + 6, 2, 'i8');       // stereo output
        this.Module.setValue(optionsPtr + 8, 4096, 'i16');   // buffer size

        const streamPtr = this.c.openMemoryStream(midiDataPtr, midiData.length); // Create memory stream for MIDI data
        const patchListString = this.c.getRequiredPatches(streamPtr); // Analyze MIDI to get required patches
        console.log("Required patches:", patchListString);
        await this._loadRequiredPatches(patchListString);

        this.c.seekStream(streamPtr, 0, 0); // Rewind stream to beginning
        this.songPtr = this.c.loadSong(streamPtr, optionsPtr); // Load song

        if (this.songPtr !== 0) {
            const callbackPtr = this.Module.addFunction(this._handleMidiEvent.bind(this), 'viiiiiii');
            this.c.setEventCallback(this.songPtr, callbackPtr);
        }

        if (this.songPtr !== 0) {
            this.totalDuration = this.c.getTotalTime(this.songPtr) / 1000; // in seconds
            // Process initial events at tick 0 to set up mixer state
            if (this.isSyncEnabled) {
                this.seek(0);
            }
            this.emit('onMidiLoaded', midi);
            return true;
        } else {
            this.emit('error', "Failed to load MIDI file.");
            return false;
        }

        this.c.closeStream(streamPtr); // Close memory stream
        this.Module._free(midiDataPtr);
        this.Module._free(optionsPtr);
    }

    /**
     * Starts or resumes playback of the currently loaded MIDI song.
     * @param {number} [offset=0] - The time offset in seconds to start playing from.
     * @param {Object} [options={}] - Additional playback options.
     */
    async play(offset = 0, options = {}) {
        if (!this.audioContext || this.songPtr === 0) return;

        this.c.startSong(this.songPtr); // Prepare song for playback
        if (offset > 0) this.seek(offset); // Seek if offset is provided

        this.playingInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused && this.audioContext.state === 'running' && !this.isSeeking) {
                this.emit('onPlaying', this.c.getCurrentTick(this.songPtr), this.c.getTime(this.songPtr));
            }
        }, 1000); // Update every 1 second

        this.isPlaying = true;
        this.isPaused = false;
        this.emit('onPlay');

        this.resume();
    }

    async loadAndPlay(midi, offset = 0, options = {}) {
        if (await this.load(midi)) {
            await this.play(offset, options);
        }
    }

    /**
     * Resumes the audio context and playback.
     */
    resume() {
        if (!this.audioContext || this.songPtr === 0) return;

        const onResumed = () => {
            if (!this.isPlaying) this.emit('onPlay');
            else this.emit('onResume');
            this.isPlaying = true;
            this.isPaused = false;
        };

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(onResumed);
        } else {
            onResumed();
        }
    }

    /**
     * Pauses the playback without unloading the song.
     */
    pause() {
        if (!this.audioContext || this.songPtr === 0) return;

        this.isPaused = true;
        this.emit('onPause');
    }

    /**
     * Stops the playback, frees the loaded song from memory, and resets the player state.
     */
    stop() {
        if (this.songPtr !== 0) {
            if (this.playingInterval) clearInterval(this.playingInterval);
            this.playingInterval = null;
            this.c.freeSong(this.songPtr);
            this.songPtr = 0;
            this.emit('onStop');
            // After stopping a song, the real-time synth might also be affected.
            // We re-initialize it to ensure it's ready for the next input.
            // This is a crucial step to ensure MIDI controller remains responsive.
            this._reinitRealtimeSong();
        }
    }

    shutdown() {
        this.stop();
        this.c.exit(); // Shutdown libTiMidity
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    /**
     * Seeks to a specific time within the loaded MIDI song.
     * @param {number} timeInSeconds - The time position to seek to, in seconds.
     */
    seek(timeInSeconds) {
        if (this.songPtr !== 0) {
            this.emit('onSeek', this.c.getCurrentTick(this.songPtr), timeInSeconds);
            this.c.seekSong(this.songPtr, timeInSeconds * 1000);
            this.emit('onSeek', this.c.getCurrentTick(this.songPtr), timeInSeconds);
        }
    }

    /**
     * Sends a MIDI Note On message to the real-time synthesizer.
     * @param {number} channel - The MIDI channel (0-15).
     * @param {number} program - The MIDI program (instrument) number.
     * @param {number} pitch - The MIDI note pitch (0-127).
     * @param {number} [velocity=100] - The note velocity (0-127).
     * @param {Object} [params={}] - Additional note parameters.
     */
    async noteOn(channel, program, pitch, velocity = 100, { bank = 0, pan = 64, bend = 8192, modulation = 0, chorus = 0, sustain = 0 } = {}) {
        if (!this.realtimeSongPtr || !this.audioContext || this.audioContext.state === 'closed') return;

        // If realtime synth was freed (e.g. after a stop()), re-initialize it.
        if (!this.realtimeSongPtr) {
            await this._reinitRealtimeSong();
        }

        if (this.audioContext?.state == 'suspended') {
            this.audioContext.resume();
        }

        // missingProgram could be the missing program number or drum key
        const missingProgram = this.c.noteOn(this.realtimeSongPtr, channel, bank, program, pitch, velocity, pan, bend, modulation, chorus, sustain);

        if (missingProgram > 0) {
            console.warn(`Instrument for program ${program} (bank ${bank}) is missing. Dynamically loading...`);

            // Load the instrument and then retry playing the note.
            const loaded = await this.setRealtimeInstrument(channel, program, bank);
            if (loaded) {
                console.log(`Retrying noteOn for program ${program}`);
                this.c.noteOn(this.realtimeSongPtr, channel, bank, program, pitch, velocity, pan, bend, modulation, chorus, sustain);
            }
        }
    }

    /**
     * Sends a MIDI Note Off message to the real-time synthesizer.
     * @param {number} channel - The MIDI channel (0-15).
     * @param {number} pitch - The MIDI note pitch (0-127) to stop.
     */
    noteOff(channel, pitch) {
        if (!this.realtimeSongPtr || !this.audioContext || this.audioContext.state !== 'running') {
            return;
        }
        this.c.noteOff(this.realtimeSongPtr, channel, pitch);
    }

    /**
     * Loads and sets an instrument program dynamically for the real-time synth.
     * @param {number} channel - The MIDI channel (0-15).
     * @param {number} program - The instrument program number.
     * @param {number} [bank=0] - The instrument bank number.
     * @returns {Promise<boolean>} True if successfully loaded.
     */
    async setRealtimeInstrument(channel, program, bank = 0) {
        if (!this.realtimeSongPtr) {
            console.warn("Realtime song not initialized, cannot set instrument.");
            return false;
        }

        // This function is now the central point for loading patches for the realtime player.
        const isDrum = channel === 9;
        const testProgram = isDrum ? 0 : program;
        const testNote = isDrum ? program : 60;

        // 1. Create a tiny dummy MIDI to discover which patch file corresponds to this program
        const midiBytes = [
            0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x78, // MThd
            0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x16, // MTrk (length 22)
            0x00, 0xFF, 0x51, 0x03, 0xFF, 0xFF, 0xFF, // Tempo
            0x00, (0xB0 | (isDrum ? 9 : 0)), 0x00, bank & 0x7F, // Bank Select MSB (Control Change 0)
            0x00, (0xC0 | (isDrum ? 9 : 0)), testProgram & 0x7F, // Program Change
            0x00, (0x90 | (isDrum ? 9 : 0)), testNote & 0x7F, 0x64, // Note On
            0x00, 0xFF, 0x2F, 0x00 // End of Track
        ];
        const dummyMidi = new Uint8Array(midiBytes);
        const dummyMidiPtr = this.Module._malloc(dummyMidi.length);
        this.Module.HEAPU8.set(dummyMidi, dummyMidiPtr);
        const streamPtr = this.c.openMemoryStream(dummyMidiPtr, dummyMidi.length);
        const patchListString = this.c.getRequiredPatches(streamPtr);
        this.c.closeStream(streamPtr);
        this.Module._free(dummyMidiPtr);

        // 2. Download the patch file(s) if not already downloaded
        if (patchListString) {
            await this._loadRequiredPatches(patchListString);
            // 3. Command C to load the patch into the active realtimeSongPtr
            return this.c.loadProgram(this.realtimeSongPtr, bank, program, isDrum) === 0;
        }
        return false;
    }

    /**
     * Broadcasts a general MIDI event (like Pitch Bend, CC) to the active synthesizers.
     * @param {number} eventType - The Timidity event type constant.
     * @param {number} channel - The MIDI channel.
     * @param {number} a - The first parameter of the event.
     * @param {number} [b=0] - The second parameter of the event.
     */
    sendEvent(eventType, channel, a, b = 0) {
        // Disabled saat render offline agar tidak merusak hasil render
        if (typeof OfflineAudioContext !== 'undefined' && this.audioContext instanceof OfflineAudioContext) {
            return;
        }

        // Send event to BOTH realtime and main song so it affects any active voices on that channel
        if (this.realtimeSongPtr !== 0) {
            this.c.sendEvent(this.realtimeSongPtr, eventType, channel, a, b);
        }
        if (this.songPtr !== 0) {
            this.c.sendEvent(this.songPtr, eventType, channel, a, b);
        }
    }

    /**
     * Processes a raw Web MIDI API message and routes it to the real-time synthesizer.
     * Automatically handles Note On, Note Off, Pitch Bend, and various Control Changes.
     * @param {number} selectedChannel - The active channel selected in the UI.
     * @param {number} bank - The active bank.
     * @param {number} program - The active program (instrument).
     * @param {MIDIMessageEvent} event - The Web MIDI API event object.
     * @param {boolean} [sendBack=false] - If true, emits the event back to UI listeners for visual feedback.
     */
    sendMessage(selectedChannel, bank, program, event, sendBack = false) {
        // Ekstrak command dari byte status MIDI
        const command = event.data[0] >> 4;

        // Gunakan channel yang dipilih di UI, jangan abaikan input jika channel aslinya berbeda
        const channel = selectedChannel;

        const note = event.data[1];
        const velocity = (event.data.length > 2) ? event.data[2] : 0;

        switch (command) {
            case 9: // Note On
                if (velocity > 0) {
                    player.noteOn(channel, program, note, velocity, { bank: bank });
                } else {
                    player.noteOff(channel, note);
                }
                break;
            case 8: // Note Off
                player.noteOff(channel, note);
                break;
            case 14: // Pitch Bend
                player.sendEvent(player.ME_PITCHWHEEL, channel, event.data[1], event.data[2]);
                break;
            case 11: // Control Change
                const cc = event.data[1];
                const val = event.data[2];
                if (cc === 7) { // Volume
                    player.sendEvent(player.ME_MAINVOLUME, channel, val);
                } else if (cc === 10) { // Pan
                    player.sendEvent(player.ME_PAN, channel, val);
                } else if (cc === 64) { // Sustain
                    player.sendEvent(player.ME_SUSTAIN, channel, val);
                } else if (cc === 11) { // Expression
                    player.sendEvent(player.ME_EXPRESSION, channel, val);
                }
                break;
        }

        if (sendBack) {
            if (command === 9) { // Note On
                if (velocity > 0) {
                    this.emit('onNoteOn', { tick: 0, channel: channel, pitch: note, velocity: velocity });
                } else {
                    this.emit('onNoteOff', { tick: 0, channel: channel, pitch: note });
                }
            } else if (command === 8) { // Note Off
                this.emit('onNoteOff', { tick: 0, channel: channel, pitch: note });
            }
        }
    }

    goTo(ticks) {
        // This is a simplified implementation. A more accurate one would need
        // to parse tempo changes to convert ticks to milliseconds.
        this.emit('error', 'goTo(ticks) is not accurately implemented yet.');
    }

    setVolume(volume) {
        if (this.songPtr !== 0) {
            this.c.setVolume(this.songPtr, volume); // Set volume (0-100)
        }
    }

    /**
     * Converts a Web Audio API AudioBuffer into a WAV file blob.
     * @param {AudioBuffer} buffer - The AudioBuffer to convert.
     * @returns {Blob} The generated WAV file as a Blob.
     */
    audioBufferToWav(buffer) {
        // Implementation from: https://github.com/mattdiamond/Recorderjs
        function interleave(inputL, inputR) {
            let length = inputL.length + inputR.length;
            let result = new Float32Array(length);
            let index = 0, inputIndex = 0;
            while (index < length) {
                result[index++] = inputL[inputIndex];
                result[index++] = inputR[inputIndex];
                inputIndex++;
            }
            return result;
        }

        function floatTo16BitPCM(output, offset, input) {
            for (let i = 0; i < input.length; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        }

        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        const interleaved = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        const dataView = new DataView(new ArrayBuffer(44 + interleaved.length * 2));

        writeString(dataView, 0, 'RIFF');
        dataView.setUint32(4, 36 + interleaved.length * 2, true);
        writeString(dataView, 8, 'WAVE');
        writeString(dataView, 12, 'fmt ');
        dataView.setUint32(16, 16, true);
        dataView.setUint16(20, 1, true);
        dataView.setUint16(22, 2, true);
        dataView.setUint32(24, buffer.sampleRate, true);
        dataView.setUint32(28, buffer.sampleRate * 4, true);
        dataView.setUint16(32, 4, true);
        dataView.setUint16(34, 16, true);
        writeString(dataView, 36, 'data');
        dataView.setUint32(40, interleaved.length * 2, true);
        floatTo16BitPCM(dataView, 44, interleaved);

        return new Blob([dataView], { type: 'audio/wav' });
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";

        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

}
