@echo off
rem The history downloader, kept running on this machine (docs/data-feed.md "The Theta history"): the Theta Terminal
rem must already be CONNECTED (scripts/theta-terminal.cmd runs it). Starts the downloader again whenever it stops
rem short — a crash, a network cut, the terminal signed out — and, when a run ends with everything down, asks again
rem an hour later for the sessions since. It STOPS when the downloader PAUSES (exit code 3: the projected disk
rem exceeds the free space — read .feed-cache\history\report.md, then HISTORY_FORCE=1 or a smaller scope). Register
rem THIS file with Task Scheduler to run at startup, whether or not anyone is logged on.
cd /d "%~dp0.."
if not exist .feed-cache mkdir .feed-cache
:loop
echo %date% %time% starting the history downloader >> .feed-cache\history.log
call npm run -s theta:history >> .feed-cache\history.log 2>&1
if %errorlevel%==3 (
  echo %date% %time% the downloader PAUSED: the projection exceeds the free disk — read .feed-cache\history\report.md >> .feed-cache\history.log
  goto end
)
if %errorlevel%==0 (
  echo %date% %time% the downloader finished its walk, asking again in an hour >> .feed-cache\history.log
  timeout /t 3600 /nobreak > nul
  goto loop
)
echo %date% %time% the downloader stopped (exit %errorlevel%), starting again in 60 s >> .feed-cache\history.log
timeout /t 60 /nobreak > nul
goto loop
:end
