---
name: Expo artifact port detection
description: Platform port detection only works for specific supported ports; expo artifacts assigned unsupported ports (e.g. 25089) never start.
---

## Rule

When a Replit Expo (mobile) artifact is created, `createArtifact` assigns a port that may not be in the platform's detection whitelist. The `restart_workflow` tool will always time out with "didn't open port <N>" for any port outside:

**Supported ports:** 3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8099, 9000

**Why:** The platform's port-readiness check only probes ports on this whitelist. Even when Metro correctly binds to 0.0.0.0:<unsupported-port> and /proc/net/tcp confirms the port is open, `getWorkflowStatus` returns `openPorts: null` and the workflow is killed after 120 s.

**How to apply:** After `createArtifact({ artifactType: "expo" })`, immediately check the assigned `localPort` in `artifact.toml`. If it is not in the supported list, use `verifyAndReplaceArtifactToml` to change `localPort` and `services.env.PORT` to a supported port (e.g. 3000). This must be done BEFORE the first `restart_workflow` call.

Also keep `REACT_NATIVE_PACKAGER_HOSTNAME=${REPLIT_EXPO_DEV_DOMAIN}` in the dev script — this registers Metro with Replit's expo domain routing so the QR code URL is correct for Expo Go.
