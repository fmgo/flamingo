#!/usr/bin/env bash

# Create a dump of last week (From Saturday to Saturday)

#Get Saturday two week ago...
from=`date -v -Fri -v -Sat "+%s"`
pFrom=`date -j -f "%s" $from "+%Y-%m-%d"`

#Get Saturday Last week
to=`date -v -Sat "+%s"`
pTo=`date -j -f "%s" $to "+%Y-%m-%d"`

dumpName=`date -v -Sat "+%V"`

#Remote Host
HOST="192.168.0.10"
#Remote Port
PORT="27017"
#Remote DB
REMOTE_DB="fmgo"
## DUMP THE REMOTE DB
colls=( Tick Quote )

for c in ${colls[@]}
do
    echo "Dumping $HOST:$PORT/$REMOTE_DB from $pFrom to $pTo (S$dumpName)..."
    mongodump -o "dumps/fmgo-data-s"$dumpName \
     -c $c \
     -h $HOST:$PORT \
     -d $REMOTE_DB \
     -q '{utm: { $gte: Date('$from'000), $lte: Date('$to'000) }}'
done
