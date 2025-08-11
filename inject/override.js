// Headers Manager - Navigator Override Script
// Runs in MAIN world to override navigator properties
{
    const override = (nav, eventDetail) => {
        const port = document.getElementById('headers-manager-port');
        if (!port || port.dataset.ready !== 'true' || !port.dataset.str) {
            return;
        }

        let prefs;
        try {
            prefs = JSON.parse(decodeURIComponent(port.dataset.str));
        } catch (error) {
            console.warn('Headers Manager: Failed to parse preferences', error);
            return;
        }

        // Get userAgentData from event detail if available
        const userAgentData = eventDetail ? eventDetail.userAgentData : null;

        try {
            // Override userAgent if specified
            if (prefs.userAgent && prefs.userAgent !== nav.userAgent) {
                nav.__defineGetter__('userAgent', () => prefs.userAgent);
            }

            // Override appVersion if specified
            if (prefs.appVersion && prefs.appVersion !== nav.appVersion) {
                nav.__defineGetter__('appVersion', () => prefs.appVersion);
            }

            // Override platform if specified
            if (prefs.platform && prefs.platform !== nav.platform) {
                nav.__defineGetter__('platform', () => prefs.platform);
            }

            // Override userAgentData if specified and original exists
            if (userAgentData && nav.userAgentData) {
                nav.__defineGetter__('userAgentData', () => userAgentData);
            }
            // Send success message to extension (no page console logging)

        } catch (error) {
            // Send error to extension console instead of page console
        }
    };

    const port = document.getElementById('headers-manager-port');
    if (port) {
        port.addEventListener('override', e => {
            override(navigator, e.detail);
        });
    }
}
