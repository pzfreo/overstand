(function() {
    if (window.location.search.includes('reset')) {
        // Show a message while clearing
        document.write('<div style="font-family:system-ui;padding:40px;text-align:center;">' +
            '<h2>Clearing cache...</h2><p>Please wait...</p></div>');

        // Clear everything aggressively
        var clearAll = [];

        // 1. Clear all service worker caches
        if ('caches' in window) {
            clearAll.push(caches.keys().then(function(names) {
                console.log('[Reset] Clearing caches:', names);
                return Promise.all(names.map(function(name) { return caches.delete(name); }));
            }));
        }

        // 2. Unregister ALL service workers
        if ('serviceWorker' in navigator) {
            clearAll.push(navigator.serviceWorker.getRegistrations().then(function(regs) {
                console.log('[Reset] Unregistering service workers:', regs.length);
                return Promise.all(regs.map(function(reg) { return reg.unregister(); }));
            }));
            // Also try to clear the service worker controller
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            }
        }

        // 3. Clear storage
        try { localStorage.clear(); } catch(e) {}
        try { sessionStorage.clear(); } catch(e) {}

        Promise.all(clearAll).then(function() {
            console.log('[Reset] Cache cleared, waiting before reload...');
            // Wait a moment to ensure everything is flushed
            return new Promise(function(r) { setTimeout(r, 500); });
        }).then(function() {
            // Hard reload with cache-busting and no-cache headers
            var cleanUrl = window.location.origin + window.location.pathname;
            // Remove trailing slash if present, then add cache buster
            cleanUrl = cleanUrl.replace(/\/$/, '') + '?_=' + Date.now();
            console.log('[Reset] Reloading to:', cleanUrl);
            window.location.replace(cleanUrl);
        }).catch(function(e) {
            console.error('Cache clear failed:', e.message);
            document.body.innerHTML = '<div style="font-family:system-ui;padding:40px;text-align:center;">' +
                '<h2>Cache clear failed</h2><p>' + e.message + '</p>' +
                '<p>Try: Settings &gt; Apps &gt; Chrome &gt; Storage &gt; Clear Cache</p></div>';
            setTimeout(function() {
                window.location.replace(window.location.origin + window.location.pathname);
            }, 3000);
        });

        // Stop the page from loading anything else
        window.stop();
    }
})();
