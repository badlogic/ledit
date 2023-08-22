#!/bin/bash
set -e
npm run build
rsync -avz ./site/ badlogic@marioslab.io:/home/badlogic/ledit.lol/data/web/
