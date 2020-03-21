# MetaParser

MetaParser is a meta compiler that generates parsers from metaparser grammar
files. It is loosely based on the META II and OMeta systems but produces a
different style of output.

The input grammar allows JavaScript action code to be placed fairly directly
into the production rules, while the output generated is an ES module format
JavaScript file containing a single parser classes.
