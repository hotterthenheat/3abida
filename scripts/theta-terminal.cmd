@echo off
rem The Theta Terminal, kept running on this machine (docs/data-feed.md "Theta Data"): starts it again whenever it
rem stops. Register THIS file with Task Scheduler to run at startup, beside scripts\recorder.cmd. Needs Java 21.
cd /d "%~dp0.."
if not exist .theta mkdir .theta
:loop
echo %date% %time% starting the Theta Terminal >> .theta\terminal.log
call npm run -s theta:terminal >> .theta\terminal.log 2>&1
echo %date% %time% the Theta Terminal stopped, starting again in 10 s >> .theta\terminal.log
timeout /t 10 /nobreak > nul
goto loop
