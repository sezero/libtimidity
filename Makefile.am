ACLOCAL_AMFLAGS = -I m4

SUBDIRS = src tests

pcdata_DATA= libtimidity.pc
pcdatadir = $(libdir)/pkgconfig

EXTRA_DIST = CHANGES README.timidity TODO

dist-hook:
	cp libtimidity.spec $(distdir)
