#!/bin/bash
cd "$(dirname "$0")"
rsync -av lib pages archive/$(date +"%Y-%m-%d_%H-%M-%S")/
