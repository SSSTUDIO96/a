@echo off
rem Makeup Pro - Cap quyen quan tri. Bam dup chuot de chay. Phan viec that nam o lib\cap-quyen.mjs (Node.js).
rem Tep nay chi kiem co Node.js chua, roi goi Node. Khong tu tai hay cai gi.
setlocal
title Makeup Pro - Cap quyen quan tri
cd /d "%~dp0..\.."
where node >nul 2>nul || goto :thieu_node
node "%~dp0lib\cap-quyen.mjs" %*
set "MA=%ERRORLEVEL%"
echo.
pause
exit /b %MA%

:thieu_node
echo.
echo [DUNG] May nay chua co Node.js, hoac vua cai xong ma chua mo lai cua so.
echo        Tai Node.js ban 22 LTS o trang chinh thuc: https://nodejs.org/en/download
echo        Cai xong, bam lai tep nay.
echo.
pause
exit /b 1
