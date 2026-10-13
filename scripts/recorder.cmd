@echo off
rem The field's recorder, kept running on this machine (docs/data-feed.md "The recorder's home"): starts it again
rem whenever it stops — a crash, a network cut, a key refused. Register THIS file with Task Scheduler to run at
rem startup, whether or not anyone is logged on, and the recorder survives a reboot too.
cd /d "%~dp0.."
if not exist .feed-cache mkdir .feed-cache
:loop
echo %date% %time% starting the recorder >> .feed-cache\recorder.log
call npm run -s feed:recorder >> .feed-cache\recorder.log 2>&1
echo %date% %time% the recorder stopped, starting again in 10 s >> .feed-cache\recorder.log
timeout /t 10 /nobreak > nul
goto loop
