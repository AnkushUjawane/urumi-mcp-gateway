#!/usr/bin/env bash
# Creates/updates the llm-secrets Secret. Keys are typed hidden and never written to disk or shell history.
set -e
read -rsp "Gemini API key (blank to skip): " G; echo
read -rsp "Groq API key (blank to skip): " Q; echo
kubectl create secret generic llm-secrets -n platform \
  --from-file=gemini-api-key=<(printf '%s' "$G") \
  --from-file=groq-api-key=<(printf '%s' "$Q") \
  --dry-run=client -o yaml | kubectl apply -f -
unset G Q
