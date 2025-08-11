// Headers Manager - Navigator Override Main Script
// Runs in MAIN world before page scripts

{
    const port = document.createElement('span');
    port.id = 'headers-manager-port';
    port.style.display = 'none';

    port.prepare = () => {
        if (port.dataset.str) {
            port.prefs = JSON.parse(decodeURIComponent(port.dataset.str));
            port.dataset.ready = 'true';
        }
    };

    document.documentElement.appendChild(port);

    // Check for data passed via server timing (from isolated script)
    for (const entry of performance.getEntriesByType('navigation')) {
        for (const timing of entry.serverTiming || []) {
            if (timing.name === 'headers-manager-data') {
                port.dataset.str = timing.description;
                break;
            }
        }
    }

    if (port.dataset.str) {
        port.prepare();
    }
}
