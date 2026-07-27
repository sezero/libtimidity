## Install emsdk

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
```

## Command to Convert

```bash
emcc common.c instrum.c mix.c output.c playmidi.c readmidi.c tables.c timidity.c stream.c resample.c -O0 -s WASM=0 -o ..\browser\libtimidity.js ^
  -s ASSERTIONS=1 ^
  -s EXPORTED_FUNCTIONS=["_mid_init_no_config","_mid_init","_mid_exit","_mid_get_version","_mid_song_load","_mid_song_free","_mid_dlspatches_load","_mid_dlspatches_free","_mid_song_load_dls","_mid_istream_open_mem","_mid_istream_close","_malloc","_free","_mid_song_read_wave","_mid_song_get_patch_names","_mid_istream_seek","_mid_song_get_required_patches","_mid_song_start"] ^
  -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap","getValue","setValue","UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAPU8","HEAP16","HEAP32"]

```

