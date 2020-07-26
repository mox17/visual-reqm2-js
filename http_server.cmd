:: Check for Python Installation
@python --version 2>NUL
@if errorlevel 1 goto errorNoPython

@echo Keep this window running for Visual ReqM2
@python http_server.py
goto :eof

:errorNoPython
@((((echo Python not installed. v2.7 or v3.x needed) & echo No http server started on localhost) & echo.) & echo Visual ReqM2 will not run from localhost:8000)|MSG *
@echo.
@echo Error^: Python not installed - Visual ReqM2 will not work

