#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ(2.59)
AC_INIT
AC_CONFIG_SRCDIR([src/playmidi.c])

LIBTIMIDITY_MAJOR_VERSION=0
LIBTIMIDITY_MINOR_VERSION=1
LIBTIMIDITY_MICRO_VERSION=0
BETA=""

LIBTIMIDITY_SO_RELEASE=0.1
LIBTIMIDITY_SO_VERSION=0:0:0

LIBTIMIDITY_VERSION=$LIBTIMIDITY_MAJOR_VERSION.$LIBTIMIDITY_MINOR_VERSION.$LIBTIMIDITY_MICRO_VERSION$BETA

AM_INIT_AUTOMAKE([libtimidity], [$LIBTIMIDITY_VERSION])
AM_CONFIG_HEADER([config.h])

AC_ARG_ENABLE([debug], [AS_HELP_STRING([--enable-debug],[enable debug mode [default=no]])],
[if test "$enableval" = "yes"
then
  enable_debug=yes
else
  enable_debug=no
fi])
if test x$enable_debug = xyes; then
	if test x$ac_cv_prog_cc_g = xyes; then
		CFLAGS="-g -O0"
	else
		CFLAGS="-O0"
	fi
	CFLAGS="$CFLAGS -Wall"
	AC_DEFINE([TIMIDITY_DEBUG], 1, [Debug mode])
fi

AC_ARG_ENABLE([dls], [AS_HELP_STRING([--enable-dls],[enable DLS instruments support [default=no]])],
[if test "$enableval" = "yes"
then
  enable_dls=yes
else
  enable_dls=no
fi])
if test x$enable_dls = xyes; then
	AC_DEFINE([TIMIDITY_USE_DLS], 1, [include DLS instruments support])
fi

# Checks for programs.
AC_PROG_CC
AC_PROG_LIBTOOL

# Checks for libraries.
LIBTIMIDITY_LIBS=""
AC_CHECK_LIB([m], [pow], [LIBTIMIDITY_LIBS="$TIMIDITY_LIBS -lm"])
have_ao=no
XIPH_PATH_AO([have_ao=yes])
AM_CONDITIONAL([HAVE_AO], [test $have_ao = yes])

# Checks for header files.
AC_HEADER_STDC
AC_CHECK_HEADERS([stdlib.h stdio.h string.h unistd.h math.h])

# Checks for typedefs, structures, and compiler characteristics.
AC_C_INLINE
AC_C_CONST
AC_TYPE_SIZE_T
AC_C_BIGENDIAN

# Checks for library functions.
AC_FUNC_MALLOC
AC_FUNC_MEMCMP
AC_CHECK_FUNCS([memset pow strchr])

AC_SUBST(LIBTIMIDITY_MAJOR_VERSION)
AC_SUBST(LIBTIMIDITY_MINOR_VERSION)
AC_SUBST(LIBTIMIDITY_MICRO_VERSION)
AC_SUBST(LIBTIMIDITY_VERSION)
AC_SUBST(LIBTIMIDITY_SO_RELEASE)
AC_SUBST(LIBTIMIDITY_SO_VERSION)

AC_SUBST(LIBTIMIDITY_LIBS)

AC_CONFIG_FILES([Makefile
		 libtimidity.pc
		 libtimidity.spec
		 src/Makefile
		 src/timidity.h
		 tests/Makefile])
AC_OUTPUT
