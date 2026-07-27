// timidity-processor.js

class TimidityProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        // Get references to raw WebAssembly exports and memory buffer
        this.mid_read_wave_raw = options.processorOptions.mid_read_wave_raw;
        this.malloc_raw = options.processorOptions.malloc_raw;
        this.free_raw = options.processorOptions.free_raw;
        
        // Reconstruct HEAP views from the shared ArrayBuffer
        const wasmMemoryBuffer = options.processorOptions.wasmMemoryBuffer;
        this.HEAPU8 = new Uint8Array(wasmMemoryBuffer);
        this.HEAP16 = new Int16Array(wasmMemoryBuffer); // For 'i16'
        this.HEAP32 = new Int32Array(wasmMemoryBuffer); // For 'i32'

        // Implement getValue locally, operating on these HEAP views
        this.getValue = (ptr, type = 'i8') => {
            if (type.endsWith('*')) type = '*'; // Treat pointers as i32
            switch (type) {
                case 'i8': return this.HEAPU8[ptr];
                case 'i16': return this.HEAP16[ptr >> 1]; // Shift by 1 for 16-bit alignment
                case 'i32': return this.HEAP32[ptr >> 2]; // Shift by 2 for 32-bit alignment
                // Add other types if needed (float, double, etc.) based on libtimidity.js's getValue
                default: throw new Error(`Unsupported type for getValue: ${type}`);
            }
        };
        this.setValue = (ptr, value, type = 'i8') => {
            if (type.endsWith('*')) type = '*'; // Treat pointers as i32
            switch (type) {
                case 'i8': this.HEAPU8[ptr] = value; break;
                case 'i16': this.HEAP16[ptr >> 1] = value; break;
                case 'i32': this.HEAP32[ptr >> 2] = value; break;
                // Add other types if needed
                default: throw new Error(`Unsupported type for setValue: ${type}`);
            }
        };
        this.songPtr = options.processorOptions.songPtr;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const bufferSize = output[0].length;
        const channels = output.length;

        // Alokasikan buffer di heap Emscripten
        const bufferBytes = bufferSize * channels * 2; // 16-bit signed integer
        const pcmBufferPtr = this.malloc_raw(bufferBytes);

        // Baca data PCM dari libTiMidity
        const bytesRead = this.mid_read_wave_raw(this.songPtr, pcmBufferPtr, bufferBytes, 0);
        const samplesRead = bytesRead / 2 / channels;

        if (bytesRead > 0) {
            for (let ch = 0; ch < channels; ch++) {
                const channelData = output[ch];
                for (let i = 0; i < samplesRead; i++) {
                    // Baca 16-bit signed integer dari memori
                    const sample = this.getValue(pcmBufferPtr + (i * channels + ch) * 2, 'i16');
                    // Konversi ke float [-1.0, 1.0]
                    channelData[i] = sample / 32768.0;
                }
            }
        }

        // Jika lagu selesai, isi sisa buffer dengan keheningan dan kirim pesan
        if (samplesRead < bufferSize) {
            for (let ch = 0; ch < channels; ch++) {
                output[ch].fill(0, samplesRead);
            }
            // Beri tahu main thread bahwa lagu telah selesai
            this.port.postMessage('finished');
            // Kembalikan false untuk menghentikan prosesor setelah frame ini
            return false;
        }

        this.free_raw(pcmBufferPtr);
        // Kembalikan true untuk menjaga prosesor tetap aktif
        return true;
    }
}

registerProcessor('timidity-processor', TimidityProcessor);
