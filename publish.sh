#!/bin/bash
set -e
npm run build
rsync -avz ./site/ badlogic@marioslab.io:/home/badlogic/marioslab.io/data/web/projects/ledit/
