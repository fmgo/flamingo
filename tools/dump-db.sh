#!/usr/bin/env bash

#Get Saturday two week ago...
from=`date -j -f "%Y-%m-%d" "$1"  "+%s"`

#Get Saturday Last week
to=`date -j -f "%Y-%m-%d" "$2"  "+%s"`

dumpName="$1_$2"

#Remote Host
HOST="192.168.0.50"
#Remote Port
PORT="27017"
#Remote DB
REMOTE_DB="fmgo"
## DUMP THE REMOTE DB
colls=( Tick )

for c in ${colls[@]}
do
    echo "Dumping $HOST:$PORT/$REMOTE_DB from $1 to $2..."
    mongodump -o "dumps/ticks-$dumpName" \
     -c $c \
     -h $HOST:$PORT \
     -d $REMOTE_DB \
     -q '{utm: { $gte: Date('$from'000), $lte: Date('$to'000) }}'
done