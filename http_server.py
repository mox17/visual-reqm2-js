#!/usr/bin/env python
from __future__ import print_function
import sys
import runpy

if sys.version_info.major == 2:
    print("Starting SimpleHTTPServer under python {}.{}".format(sys.version_info.major, sys.version_info.minor))
    runpy.run_module('SimpleHTTPServer', run_name='__main__')
else:
    print("Starting http.server under python {}.{}".format(sys.version_info.major, sys.version_info.minor))
    import http.server
    import socketserver
    PORT = 8000
    Handler = http.server.SimpleHTTPRequestHandler
    # Override MIME mapping in case system does not recognize .js as javascript
    Handler.extensions_map.update({
          ".js": "application/javascript",
    });
    httpd = socketserver.TCPServer(("", PORT), Handler)
    httpd.serve_forever()
