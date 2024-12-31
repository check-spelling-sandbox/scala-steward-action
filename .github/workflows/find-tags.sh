#!/usr/bin/bash
git ls-remote . | perl -ne 'next unless m<refs/tags/v\d+>;print'
