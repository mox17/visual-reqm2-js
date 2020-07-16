#!/usr/bin/env python
from __future__ import print_function
import sys

if sys.version_info.major == 2:
    import SimpleHTTPServer
    print("Starting SimpleHTTPServer under python {}.{}".format(sys.version_info.major, sys.version_info.minor))
    SimpleHTTPServer.test()
else:
    import http.server
    print("Starting http.server under python {}.{}".format(sys.version_info.major, sys.version_info.minor))
    http.server.test()
