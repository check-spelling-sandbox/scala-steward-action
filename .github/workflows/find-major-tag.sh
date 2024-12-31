#!/usr/bin/bash
git ls-remote . | perl -ne 'next unless m<refs/tags/v$ENV{major_version}$>;print'
