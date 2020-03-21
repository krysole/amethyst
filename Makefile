#
# The Amethyst Programming Language
#
# Copyright 2020 Lorenz Pretterhofer <krysole@alexicalmistake.com>
#
# Permission to use, copy, modify, and distribute this work for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE WORK IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS WORK INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS WORK.
#

METAPARSER=./metaparser/metaparser

all: Parser.js

clean:
	rm -f Parser.js

Parser.js: Parser.g
	$(METAPARSER) --token -o $@ $<

.PHONY: all
