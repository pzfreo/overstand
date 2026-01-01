/**
 * PWA Manager
 *
 * Handles service worker registration and PWA installation prompts.
 * Implements environment-aware update strategies.
 */

let currentEnvironment = 'production';  // Default to production

/**
 * Fetch version info to detect environment
 */
async function fetchEnvironment() {
    try {
        const response = await fetch('version.json');
        const data = await response.json();
        currentEnvironment = data.environment || 'production';
        console.log(`[PWA] Environment: ${currentEnvironment}, Version: ${data.version}`);
        return data;
    } catch (error) {
        console.warn('[PWA] Could not fetch version.json, defaulting to production mode');
        return { environment: 'production' };
    }
}

/**
 * Show update notification to user (production mode)
 */
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4F46E5;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        gap: 16px;
        align-items: center;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    notification.innerHTML = `
        <span>✨ A new version is available!</span>
        <button id="update-btn" style="
            background: white;
            color: #4F46E5;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        ">Update Now</button>
        <button id="dismiss-btn" style="
            background: transparent;
            color: white;
            border: 1px solid white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        ">Later</button>
    `;

    document.body.appendChild(notification);

    document.getElementById('update-btn').addEventListener('click', () => {
        window.location.reload();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
        notification.remove();
    });
}

export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Fetch environment info first
        await fetchEnvironment();

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then((registration) => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);

                    // Handle updates based on environment
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[PWA] New service worker installed');

                                if (currentEnvironment === 'preview' || currentEnvironment === 'development') {
                                    // Preview/dev: Auto-update immediately for faster iteration
                                    console.log('[PWA] Preview/dev mode - auto-updating...');
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                    window.location.reload();
                                } else {
                                    // Production: Show user-friendly notification
                                    console.log('[PWA] Production mode - showing update notification');
                                    showUpdateNotification();
                                }
                            }
                        });
                    });

                    // Environment-specific update check frequency
                    const updateInterval = currentEnvironment === 'production'
                        ? 60 * 60 * 1000  // Production: Check every hour
                        : 5 * 60 * 1000;   // Preview/dev: Check every 5 minutes

                    setInterval(() => {
                        registration.update();
                    }, updateInterval);

                    console.log(`[PWA] Update check interval: ${updateInterval / 60000} minutes`);
                })
                .catch((error) => {
                    console.warn('ServiceWorker registration failed:', error);
                });
        });
    }
}

export function initInstallPrompt() {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;

        // Optionally, show a custom install button in your UI
        const installBtn = document.createElement('button');
        installBtn.id = 'install-btn';
        installBtn.className = 'btn btn-secondary';
        installBtn.style.position = 'fixed';
        installBtn.style.bottom = '20px';
        installBtn.style.right = '20px';
        installBtn.style.zIndex = '1000';
        installBtn.innerHTML = '✨ Install App';

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User ${outcome} the install prompt`);

            deferredPrompt = null;
            installBtn.remove();
        });

        document.body.appendChild(installBtn);
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        const installBtn = document.getElementById('install-btn');
        if (installBtn) installBtn.remove();
    });
}
