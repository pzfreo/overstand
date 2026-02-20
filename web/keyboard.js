import { state, elements } from './state.js';
import { closeModal } from './modal.js';
import { isAuthenticated } from './auth.js';

// Actions injected by app.js to avoid circular imports
let _actions = {};

export function setKeyboardActions(actions) {
    _actions = actions;
}

export function initKeyboardShortcuts() {
    // Global shortcuts: Cmd+Enter, Cmd+S, Cmd+O
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!elements.genBtn.disabled && !state.isGenerating && _actions.generateNeck) _actions.generateNeck();
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (isAuthenticated()) {
                if (_actions.handleCloudSave) _actions.handleCloudSave();
            } else {
                if (_actions.saveParameters) _actions.saveParameters();
            }
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
            e.preventDefault();
            if (isAuthenticated()) {
                if (_actions.showLoadProfileModal) _actions.showLoadProfileModal();
            } else {
                if (elements.loadParamsInput) elements.loadParamsInput.click();
            }
        }

        if (e.key === 'Escape') {
            const shareOverlay = document.getElementById('share-profile-overlay');
            if (shareOverlay && shareOverlay.classList.contains('active')) {
                e.preventDefault();
                if (_actions.closeShareModal) _actions.closeShareModal();
                return;
            }

            const loadOverlay = document.getElementById('load-profile-overlay');
            if (loadOverlay && loadOverlay.classList.contains('active')) {
                e.preventDefault();
                if (_actions.closeLoadProfileModal) _actions.closeLoadProfileModal();
                return;
            }

            const modalOverlay = document.getElementById('modal-overlay');
            if (modalOverlay && modalOverlay.classList.contains('active')) {
                e.preventDefault();
                closeModal();
                return;
            }

            const appMenuOverlay = document.getElementById('app-menu-overlay');
            if (appMenuOverlay && appMenuOverlay.classList.contains('open')) {
                e.preventDefault();
                if (_actions.closeMenu) _actions.closeMenu();
                return;
            }

            const controlsPanel = document.getElementById('controls-panel');
            const paramsDrawerOverlay = document.getElementById('params-drawer-overlay');
            if (controlsPanel && controlsPanel.classList.contains('mobile-open')) {
                e.preventDefault();
                controlsPanel.classList.remove('mobile-open');
                if (paramsDrawerOverlay) paramsDrawerOverlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        }
    });

    // Warn before closing tab with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (state.parametersModified) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}
