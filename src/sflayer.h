/* libTiMidity is licensed under the terms of the GNU Lesser General
 * Public License: see COPYING for details.
 *
 * Note that the included TiMidity source, based on timidity-0.2i, was
 * originally licensed under the GPL, but the author extended it so it
 * can also be used separately under the GNU LGPL or the Perl Artistic
 * License: see the notice by Tuukka Toivonen as it appears on the web
 * at http://ieee.uwaterloo.ca/sca/www.cgs.fi/tt/timidity/ .
 */

/*
 * TiMidity -- Experimental MIDI to WAVE converter
 * Copyright (C) 1995 Tuukka Toivonen <toivonen@clinet.fi>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or (at
 * your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

#ifndef SFLAYER_H_DEF /* sflayer.h: SoundFont layer structure */
#define SFLAYER_H_DEF

enum {
	SF_startAddrs,         /* sample start address -4 (0 to * 0xffffff) */
        SF_endAddrs,
        SF_startloopAddrs,     /* loop start address -4 (0 to * 0xffffff) */
        SF_endloopAddrs,       /* loop end address -3 (0 to * 0xffffff) */
        SF_startAddrsHi,       /* high word of startAddrs */
        SF_lfo1ToPitch,        /* main fm: lfo1-> pitch */
        SF_lfo2ToPitch,        /* aux fm:  lfo2-> pitch */
        SF_env1ToPitch,        /* pitch env: env1(aux)-> pitch */
        SF_initialFilterFc,    /* initial filter cutoff */
        SF_initialFilterQ,     /* filter Q */
        SF_lfo1ToFilterFc,     /* filter modulation: lfo1 -> filter * cutoff */
        SF_env1ToFilterFc,     /* filter env: env1(aux)-> filter * cutoff */
        SF_endAddrsHi,         /* high word of endAddrs */
        SF_lfo1ToVolume,       /* tremolo: lfo1-> volume */
        SF_env2ToVolume,       /* Env2Depth: env2-> volume */
        SF_chorusEffectsSend,  /* chorus */
        SF_reverbEffectsSend,  /* reverb */
        SF_panEffectsSend,     /* pan */
        SF_auxEffectsSend,     /* pan auxdata (internal) */
        SF_sampleVolume,       /* used internally */
        SF_unused3,
        SF_delayLfo1,          /* delay 0x8000-n*(725us) */
        SF_freqLfo1,           /* frequency */
        SF_delayLfo2,          /* delay 0x8000-n*(725us) */
        SF_freqLfo2,           /* frequency */
        SF_delayEnv1,          /* delay 0x8000 - n(725us) */
        SF_attackEnv1,         /* attack */
        SF_holdEnv1,             /* hold */
        SF_decayEnv1,            /* decay */
        SF_sustainEnv1,          /* sustain */
        SF_releaseEnv1,          /* release */
        SF_autoHoldEnv1,
        SF_autoDecayEnv1,
        SF_delayEnv2,            /* delay 0x8000 - n(725us) */
        SF_attackEnv2,           /* attack */
        SF_holdEnv2,             /* hold */
        SF_decayEnv2,            /* decay */
        SF_sustainEnv2,          /* sustain */
        SF_releaseEnv2,          /* release */
        SF_autoHoldEnv2,
        SF_autoDecayEnv2,
        SF_instrument,           /* */
        SF_nop,
        SF_keyRange,             /* */
        SF_velRange,             /* */
        SF_startloopAddrsHi,     /* high word of startloopAddrs */
        SF_keynum,               /* */
        SF_velocity,             /* */
        SF_instVol,              /* */
        SF_keyTuning,
        SF_endloopAddrsHi,       /* high word of endloopAddrs */
        SF_coarseTune,
        SF_fineTune,
        SF_sampleId,
        SF_sampleFlags,
        SF_samplePitch,          /* SF1 only */
        SF_scaleTuning,
        SF_keyExclusiveClass,
        SF_rootKey,
	SF_EOF,
};

#define SFPARM_SIZE	SF_EOF

#endif
