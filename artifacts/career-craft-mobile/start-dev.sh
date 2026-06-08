#!/bin/sh
# Start the Expo dev server with proper Replit expo-domain configuration.
# REACT_NATIVE_PACKAGER_HOSTNAME and EXPO_PACKAGER_PROXY_URL tell Metro to
# register with Replit's expo routing infrastructure so the platform can
# detect the service via REPLIT_EXPO_DEV_DOMAIN.
cd "$(dirname "$0")"
export EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN:-}"
export EXPO_PUBLIC_REPL_ID="${REPL_ID:-}"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_EXPO_DEV_DOMAIN:-localhost}"
export EXPO_PACKAGER_PROXY_URL="https://${REPLIT_EXPO_DEV_DOMAIN:-localhost}"
exec node_modules/.bin/expo start --port "${PORT:-25089}"
