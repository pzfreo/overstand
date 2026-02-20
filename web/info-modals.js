import * as ui from './ui.js';
import * as analytics from './analytics.js';
import { showModal } from './modal.js';
import { markdownToHtml } from './markdown-parser.js';
import { IS_MAC } from './constants.js';

export function showKeyboardShortcuts() {
    const mod = IS_MAC ? '⌘' : 'Ctrl';

    const content = `
        <div class="shortcuts-section">
            <h3>File Operations</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Generate Template</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">Enter</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Save Profile / Export JSON</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">S</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Load Profile / Import JSON</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">O</span>
                    </div>
                </li>
            </ul>
        </div>

        <div class="shortcuts-section">
            <h3>Zoom Controls</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Zoom In</span>
                    <div class="shortcut-keys">
                        <span class="key">+</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Zoom Out</span>
                    <div class="shortcut-keys">
                        <span class="key">-</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Reset Zoom</span>
                    <div class="shortcut-keys">
                        <span class="key">0</span>
                    </div>
                </li>
            </ul>
        </div>

        <div class="shortcuts-section">
            <h3>Navigation</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Close Menu/Dialogs</span>
                    <div class="shortcut-keys">
                        <span class="key">Esc</span>
                    </div>
                </li>
            </ul>
        </div>
    `;

    showModal('Keyboard Shortcuts', content);
}

export async function showAbout() {
    analytics.trackAboutViewed();
    try {
        const response = await fetch('about.md');
        if (!response.ok) {
            throw new Error('Failed to load about.md');
        }
        const markdown = await response.text();
        const content = markdownToHtml(markdown);

        const titleMatch = content.match(/<h1 class="about-title">(.*?)<\/h1>/);
        const title = titleMatch ? titleMatch[1] : 'About';

        showModal(title, content);
    } catch (error) {
        console.error('Error loading about:', error);
        showModal('About', '<p class="about-text">Unable to load about information.</p>');
    }
}

export async function clearCacheAndReload() {
    const confirmed = confirm(
        'This will clear all cached data and reload the app.\n\n' +
        'Use this if you\'re experiencing issues with outdated code or data.\n\n' +
        'Continue?'
    );

    if (!confirmed) return;

    try {
        ui.setStatus('loading', 'Clearing cache...');

        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[ClearCache] Deleted caches:', cacheNames);
        }

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('[ClearCache] Unregistered service workers:', registrations.length);
        }

        ui.setStatus('loading', 'Reloading...');
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        window.location.href = baseUrl + '?cache_bust=' + Date.now();

    } catch (error) {
        console.error('[ClearCache] Error:', error);
        alert('Failed to clear cache: ' + error.message + '\n\nTry manually clearing your browser cache.');
    }
}
