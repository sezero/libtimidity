/* playmidi -- play MIDI files
 */

#include <stdio.h>
#include <stdlib.h>
#include <ao/ao.h>
#include "timidity.h"

void
print_usage()
{
  printf("Usage: playmidi [-r rate] [-s sample_width] [-c channels]\n"
         "                [-v volume] [-q] [midifile]\n");
}

int
main (int argc, char *argv[])
{
  int rate = 44100;
  int bits = 16;
  int channels = 2;
  int volume = 100;
  int quiet = 0;
  int arg;
  MidIStream *stream;
  MidSongOptions options;
  MidSong *song;
  long total_time;
  sint8 *buffer;
  size_t buffer_size;
  ao_device *device;
  ao_sample_format format;
  int default_driver;
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
      else if (!strcmp(argv[arg], "-q"))
	{
	  quiet = 1;
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
  options.buffer_size = rate;

  song = mid_song_load (stream, &options);
  mid_istream_close (stream);

  if (song == NULL)
    {
      fprintf (stderr, "Invalid MIDI file\n");
      mid_exit ();
      return 1;
    }

  total_time = mid_song_get_total_time (song);

  mid_song_set_volume (song, volume);
  mid_song_start (song);

  ao_initialize ();
  default_driver = ao_default_driver_id ();
  format.bits = bits;
  format.channels = channels;
  format.rate = rate;
  format.byte_format = AO_FMT_LITTLE;

  device = ao_open_live (default_driver, &format, NULL);
  if (device == NULL)
    {
      fprintf (stderr, "Error opening device.\n");
      ao_shutdown ();
      mid_song_free (song);
      mid_exit ();
      return 1;
    }

  if (!quiet)
    {
      char *title = mid_song_get_meta (song, MID_SONG_TEXT);
      if (title == NULL)
        {
	  if (arg < argc) title = argv[arg];
	  else title = "stdin";
	}
      printf ("Playing: %s\n", title);
    }

  buffer_size = bits * channels / 8 * rate;
  buffer = malloc (buffer_size);

  do
    {
      if (!quiet)
	{
	  long time = mid_song_get_time (song);
	  printf ("\rTime: %02ld:%02ld/%02ld:%02ld",
		  time / 60000, (time / 1000) % 60,
		  total_time / 60000, (total_time / 1000) % 60);
	  fflush (stdout);
	}
      bytes_read = mid_song_read_wave (song, buffer, buffer_size);
      ao_play (device, buffer, bytes_read);
    }
  while (bytes_read);

  free (buffer);

  if (!quiet)
    printf ("\n");

  ao_close (device);
  ao_shutdown ();
  mid_song_free (song);
  mid_exit ();

  return 0;
}
