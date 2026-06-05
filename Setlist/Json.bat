@echo off
setlocal enabledelayedexpansion

rem Root is the Setlist folder (where this bat lives)
set "root=%~dp0"
set "json=%root%Setlist.json"

rem --- NORMALIZE FOLDER NAMES (trim leading spaces) ---
for /d %%F in ("%root%*") do (
    set "name=%%~nxF"
    for /f "tokens=* delims= " %%X in ("!name!") do set "clean=%%X"
    if not "!name!"=="!clean!" ren "%%F" "!clean!"

    for /d %%A in ("%%F\*") do (
        set "sub=%%~nxA"
        for /f "tokens=* delims= " %%Y in ("!sub!") do set "subclean=%%Y"
        if not "!sub!"=="!subclean!" ren "%%A" "!subclean!"
    )
)

(
echo {
echo   "bands": [
) > "%json%"

set "firstBand=true"

for /d %%B in ("%root%*") do (
    if /i not "%%~nxB"=="Setlist.json" (

        if "!firstBand!"=="true" (
            set "firstBand=false"
        ) else (
            >> "%json%" echo   ,
        )

        rem ============================================================
        rem  BAND-LEVEL setlist.txt (audio + video + rar + vtt + srt)
        rem ============================================================

        rem --- detect if VTT exists ---
        set "hasVTT=false"
        for %%X in ("%%B\*.vtt") do set "hasVTT=true"

        (
          for %%T in ("%%B\*.mp3")  do echo %%~nxT
          for %%T in ("%%B\*.mp4")  do echo %%~nxT
          for %%T in ("%%B\*.flac") do echo %%~nxT
          for %%T in ("%%B\*.wav")  do echo %%~nxT
          for %%T in ("%%B\*.ogg")  do echo %%~nxT
          for %%T in ("%%B\*.m4a")  do echo %%~nxT
          for %%T in ("%%B\*.rar")  do echo %%~nxT

          rem --- write VTT if exists ---
          if "!hasVTT!"=="true" (
              for %%T in ("%%B\*.vtt") do echo %%~nxT
          ) else (
              rem --- no VTT → register SRT instead ---
              for %%T in ("%%B\*.srt") do echo %%~nxT
          )
        ) > "%%B\setlist.txt"


        >> "%json%" echo     {
        >> "%json%" echo       "name": "%%~nxB",
        >> "%json%" echo       "genre": ["unknown"],
        >> "%json%" echo       "cover": "Setlist/%%~nxB/%%~nxB.jpg",
        >> "%json%" echo       "albums": [

        set "firstAlbum=true"

        rem ============================================================
        rem  ALBUM-LEVEL setlist.txt (same logic)
        rem ============================================================
        setlocal disableDelayedExpansion
        for /d %%A in ("%%B\*") do (

            rem detect VTT inside album
            set "hasVTT=false"
            for %%X in ("%%A\*.vtt") do set "hasVTT=true"

            (
              for %%T in ("%%A\*.mp3")  do echo %%~nxT
              for %%T in ("%%A\*.mp4")  do echo %%~nxT
              for %%T in ("%%A\*.flac") do echo %%~nxT
              for %%T in ("%%A\*.wav")  do echo %%~nxT
              for %%T in ("%%A\*.ogg")  do echo %%~nxT
              for %%T in ("%%A\*.m4a")  do echo %%~nxT
              for %%T in ("%%A\*.rar")  do echo %%~nxT

              if "!hasVTT!"=="true" (
                  for %%T in ("%%A\*.vtt") do echo %%~nxT
              ) else (
                  for %%T in ("%%A\*.srt") do echo %%~nxT
              )
            ) > "%%A\setlist.txt"

            if defined firstAlbum (
                set "firstAlbum="
            ) else (
                >> "%json%" echo         ,
            )

            >> "%json%" echo         {
            >> "%json%" echo           "title": "%%~nxA",
            >> "%json%" echo           "cover": "Setlist/%%~nxB/%%~nxA/%%~nxA.jpg",
            >> "%json%" echo           "path": "Setlist/%%~nxB/%%~nxA/"
            >> "%json%" echo         }
        )
        endlocal

        >> "%json%" echo       ]
        >> "%json%" echo     }
    )
)

(
echo   ]
echo }
) >> "%json%"

endlocal