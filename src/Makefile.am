
AM_CPPFLAGS = -I$(top_srcdir)

SYM_VISIBILITY = @SYM_VISIBILITY@

# always define TIMIDITY_BUILD when building libtimidity
# regardless of static build or shared library build
AM_CFLAGS = -DTIMIDITY_BUILD=1 $(SYM_VISIBILITY)

lib_LTLIBRARIES = libtimidity.la

include_HEADERS = timidity.h

libtimidity_la_SOURCES = \
	common.c \
	common.h \
	dls1.h \
	dls2.h \
	filenames.h \
	instrum.c \
	instrum_dls.c \
	instrum_dls.h \
	instrum.h \
	mix.c \
	mix.h \
	options.h \
	output.c \
	output.h \
	playmidi.c \
	playmidi.h \
	readmidi.c \
	readmidi.h \
	resample.c \
	resample.h \
	stream.c \
	tables.c \
	tables.h \
	timi_endian.h \
	timidity.c \
	timidity.h \
	timidity_internal.h

libtimidity_la_LDFLAGS = -no-undefined -version-info @LIBTIMIDITY_LT_CURRENT@:@LIBTIMIDITY_LT_REVISION@:@LIBTIMIDITY_LT_AGE@
libtimidity_la_LIBADD = @LIBTIMIDITY_LIBS@
