#!/usr/bin/bash
git ls-remote . | perl -ne 'next if m<refs/tags/v\d+\.>;print'
