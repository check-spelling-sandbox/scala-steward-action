#!/usr/bin/bash
perl -ne 'next if m<refs/tags/v\d+\.>;print' "$1"
