#!/bin/bash
set -e
npm run build
rsync -avz ./site/ badlogic@marioslab.io:/home/badlogic/ledit.lol/data/web/
rsync -avz ./site/ badlogic@marioslab.io:/home/badlogic/mastoreader.io/data/web/

source_file="/home/badlogic/mastoreader.io/data/web/mastoreader.html"
destination_file="/home/badlogic/mastoreader.io/data/web/index.html"
scp "marioslab.io:$source_file" "marioslab.io:$destination_file"

ssh -t marioslab.io "cd mastoreader.io && ./reload.sh"
