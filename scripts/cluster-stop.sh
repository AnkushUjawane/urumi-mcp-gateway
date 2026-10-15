#!/usr/bin/env bash
# Run before shutting down your laptop.
k3d cluster stop urumi
echo "Cluster stopped cleanly. Safe to shut down."
