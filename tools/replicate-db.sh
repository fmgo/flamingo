#!/bin/sh

HOST="192.168.0.50"
PORT="27017"
REMOTE_DB="fmgo"
LOCAL_DB="fmgo-backtest"
#USER="giraffe"
#PASS="7hIs15MyPa5s"

## DUMP THE REMOTE DB
echo "Dumping '$HOST:$PORT/$REMOTE_DB'..."
mongodump --host $HOST:$PORT --db $REMOTE_DB #-u $USER -p $PASS

## RESTORE DUMP DIRECTORY
echo "Restoring to '$LOCAL_DB'..."
mongorestore --db $LOCAL_DB --drop dump/$REMOTE_DB

## REMOVE DUMP FILES
#echo "Removing dump files..."
#rm -r dump

echo "Done."