#!/usr/bin/env bash

weekNumber=45
DUMP_PATH="./dumps/fmgo-data-S$weekNumber/fmgo"
#LOCAL_DB="fmgo-s$weekNumber"
LOCAL_DB="fmgo-backtest"

## RESTORE DUMP DIRECTORY
echo "Restoring '$DUMP_PATH' to '$LOCAL_DB'..."
mongorestore --db $LOCAL_DB $DUMP_PATH