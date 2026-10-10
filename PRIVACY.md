# DropZone Location Privacy

- Location is opt-in. The browser does not request permission on page load; the map explains the use before the user enables it.
- Precise device coordinates are evaluated in the browser to determine zone entry. When the active zone changes, the browser sends latitude and longitude rounded to three decimal places (roughly 100m, varying by latitude). The server does not store those coordinates.
- The server stores only the user's last known zone ID and zone state on their event membership. It does not record a location trail. Once enabled, the browser watch continues across app tabs so zone entry/exit can scope the feed; it stops when the page is closed or the user signs out.
- Simulated positions are marked as development-only and are ignored as simulations in production.
- Zone geometry and descriptive fields remain available until zone expiry, then are eligible for cleanup after a 30-day grace period. Explicit zone joins can be removed by leaving; expired zone joins are also eligible for cleanup after that grace period. Post expiry is enforced by the API. Database backups and infrastructure logs may retain copies under their own retention schedules.
- Users can deny location and select an active zone manually. Selecting a zone is not proof of physical presence; joining a zone remains an explicit action.
- Do not treat geofencing as an identity check, perfect anonymity, or a guarantee of complete deletion. Coarse location and indoor GPS inaccuracies can produce boundary errors.
- Public APIs do not return a user's coordinates or live position. Map location markers are rendered locally in the user's browser only.
