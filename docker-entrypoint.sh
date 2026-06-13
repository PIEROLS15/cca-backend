#!/bin/sh
set -e

echo "Starting server..."
exec node src/server.js
