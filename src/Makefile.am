
INCLUDES=-I$(top_srcdir)

lib_LTLIBRARIES = libtimidity.la

include_HEADERS = timidity.h

libtimidity_la_SOURCES = \
	common.c \
	common.h \
	dls1.h \
	dls2.h \
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
	timidity.c \
	timidity.h \
	timidity_internal.h

libtimidity_la_LDFLAGS = \
	@LIBTIMIDITY_LIBS@ \
	-release @LIBTIMIDITY_SO_RELEASE@ \
	-version-info @LIBTIMIDITY_SO_VERSION@
EXTRADIST = timidity.h.in
