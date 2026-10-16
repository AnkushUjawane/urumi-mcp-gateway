{{- define "platform.secretName" -}}
{{ .Values.existingSecret | default "platform-secrets" }}
{{- end }}
