/* midi2raw -- MIDI to RAW WAVE data converter
 */

#include <stdio.h>
#include <stdlib.h>
#include "timidity.h"

void
print_usage()
{
  printf("Usage: midi2raw [-r rate] [-s sample_width] [-c channels]\n"
         "                [-v volume] [-o output_file] [midifile]\n");
}

int
main (int argc, char *argv[])
{
  int rate = 44100;
  int bits = 16;
  int channels = 2;
  int volume = 100;
  FILE * output = stdout;
  int arg;  
  MidIStream *stream;
  MidSongOptions options;
  MidSong *song;
  sint8 buffer[4096];
  size_t bytes_read;

  for (arg = 1; arg < argc; arg++)
    {
      if (!strcmp(argv[arg], "-r"))
	{
	  if (++arg >= argc) break;
	  rate = atoi (argv[arg]);
	  if (rate <= 0)
	    {
	      fprintf (stderr, "Invalid rate\n");
	      return 1;
	    }
	}
      else if (!strcmp(argv[arg], "-s"))
	{
	  if (++arg >= argc) break;
	  switch (argv[arg][0])
	  {
	    case 'b': bits = 8; break;
	    case 'w': bits = 16; break;
	    default:
              fprintf (stderr, "Invalid sample width\n");
	      return 1;
	  }
	}
      else if (!strcmp(argv[arg], "-c"))
	{
	  if (++arg >= argc) break;
	  channels = atoi (argv[arg]);
	  if (channels < 1 || channels > 2)
	    {
	      fprintf (stderr, "Invalid number of channels\n");
	      return 1;
	    }
	}
      else if (!strcmp(argv[arg], "-v"))
	{
	  if (++arg >= argc) break;
	  volume = atoi (argv[arg]);
	  if (volume < 0)
	    {
	      fprintf (stderr, "Invalid volume\n");
	      return 1;
	    }
	}
      else if (!strcmp(argv[arg], "-o"))
	{
	  if (++arg >= argc) break;
	  output = fopen (argv[arg], "wb");
	  if (output == NULL)
	    {
	      fprintf (stderr, "Could not open output file %s\n", argv[arg]);
	      return 1;
	    }
	}
      else if (!strcmp(argv[arg], "-h"))
	{
	  print_usage();
	  return 0;
	}
      else if (argv[arg][0] == '-')
	{
	  fprintf (stderr, "Unknown option: %s\n", argv[arg]);
	  print_usage();
	  return 1;
	}
      else break;
    }

  if (mid_init (NULL) < 0)
    {
      fprintf (stderr, "Could not initialise libTiMidity\n");
      return 1;
    }

  if (arg >= argc)
    {
      stream = mid_istream_open_fp (stdin, 0);
    }
  else
    {
      stream = mid_istream_open_file (argv[arg]);
      if (stream == NULL)
	{
	  fprintf (stderr, "Could not open file %s\n", argv[arg]);
	  mid_exit ();
	  return 1;
	}

    }

  options.rate = rate;
  options.format = (bits == 16) ? MID_AUDIO_S16LSB : MID_AUDIO_S8;
  options.channels = channels;
  options.buffer_size = sizeof (buffer) / (bits * channels / 8);

  song = mid_song_load (stream, &options);
  mid_istream_close (stream);

  if (song == NULL)
    {
      fprintf (stderr, "Invalid MIDI file\n");
      mid_exit ();
      return 1;
    }

  mid_song_set_volume (song, volume);
  mid_song_start (song);

  while ((bytes_read = mid_song_read_wave (song, buffer, sizeof (buffer))))
    fwrite (buffer, bytes_read, 1, output);

  mid_song_free (song);
  mid_exit ();

  fclose(output);

  return 0;
}
