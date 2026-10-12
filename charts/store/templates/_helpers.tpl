{{- define "store.secretName" -}}
{{ .Values.existingSecret | default "store-secrets" }}
{{- end }}

{{- define "store.url" -}}
{{ .Values.scheme }}://{{ .Values.ingress.host }}
{{- end }}

{{/* Env shared by the WordPress pod and the WP-CLI setup Job */}}
{{- define "store.wpEnv" -}}
- name: WORDPRESS_DB_HOST
  value: mariadb:3306
- name: WORDPRESS_DB_NAME
  value: wordpress
- name: WORDPRESS_DB_USER
  value: wordpress
- name: WORDPRESS_DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "store.secretName" . }}
      key: db-password
- name: WP_PUBLIC_URL
  value: {{ include "store.url" . | quote }}
{{- end }}
