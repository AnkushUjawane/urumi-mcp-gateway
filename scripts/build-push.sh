#!/usr/bin/env bash
set -e
for s in woo-mcp notes-mcp utils-mcp; do
  docker build -t localhost:5000/$s:0.1.0 services/$s
  docker push localhost:5000/$s:0.1.0
done
curl -s http://localhost:5000/v2/_catalog
echo
