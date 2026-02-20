import { state } from './state.js';
import { showModal, closeModal, showErrorModal } from './modal.js';
import { signInWithProvider, sendSignInCode, verifySignInCode, isAuthenticated } from './auth.js';
import { loadUserPresets } from './cloud_presets.js';

export function updateAuthUI(user) {
    state.authUser = user;
    const shareSaveBtn = document.getElementById('share-save-btn');
    const toolbarSave = document.getElementById('toolbar-save');
    const toolbarShare = document.getElementById('toolbar-share');
    const toolbarAuth = document.getElementById('toolbar-auth');
    const mmSave = document.getElementById('mm-save');
    const mmShare = document.getElementById('mm-share');
    const mmAuth = document.getElementById('mm-auth');
    const mmUserEmail = document.getElementById('mm-user-email');

    if (user) {
        if (shareSaveBtn) shareSaveBtn.style.display = 'inline-block';
        if (toolbarSave) toolbarSave.disabled = false;
        if (toolbarShare) toolbarShare.disabled = false;
        if (mmSave) mmSave.disabled = false;
        if (mmShare) mmShare.disabled = false;

        if (toolbarAuth) {
            toolbarAuth.textContent = 'Sign Out';
            toolbarAuth.classList.remove('btn-primary');
            toolbarAuth.title = user.email || 'Sign Out';
        }
        if (mmAuth) mmAuth.innerHTML = '<span class="icon">👤</span> Sign Out';
        if (mmUserEmail) {
            mmUserEmail.textContent = user.email || '';
            mmUserEmail.style.display = user.email ? '' : 'none';
        }

        const authStatus = document.getElementById('auth-status');
        if (authStatus) authStatus.textContent = user.email;
        refreshCloudPresets();
    } else {
        if (shareSaveBtn) shareSaveBtn.style.display = 'none';
        if (toolbarSave) toolbarSave.disabled = true;
        if (toolbarShare) toolbarShare.disabled = true;
        if (mmSave) mmSave.disabled = true;
        if (mmShare) mmShare.disabled = true;

        if (toolbarAuth) {
            toolbarAuth.textContent = 'Sign In';
            toolbarAuth.classList.add('btn-primary');
            toolbarAuth.title = 'Sign In';
        }
        if (mmAuth) mmAuth.innerHTML = '<span class="icon">👤</span> Sign In';
        if (mmUserEmail) mmUserEmail.style.display = 'none';

        const authStatus = document.getElementById('auth-status');
        if (authStatus) authStatus.textContent = '';
        state.cloudPresets = [];
    }
}

export function showLoginModal() {
    const content = `
        <div class="login-modal-content">
            <p>Sign in or create an account to save instrument profiles to the cloud and share your designs.</p>
            <button class="login-btn" id="login-google">
                <span class="login-btn-icon">G</span>
                Sign in / Sign up with Google
            </button>
            <div class="login-divider"><span>or</span></div>
            <div id="email-step">
                <form id="email-form" class="magic-link-form">
                    <input type="email" id="magic-link-email" class="magic-link-input" placeholder="Enter your email" required />
                    <button type="submit" class="login-btn magic-link-btn">
                        <span class="login-btn-icon">&#9993;</span>
                        Send sign-in code
                    </button>
                </form>
            </div>
            <div id="code-step" style="display:none;">
                <p class="magic-link-status magic-link-success">Code sent! Check your email.</p>
                <form id="code-form" class="magic-link-form">
                    <input type="text" id="otp-code" class="magic-link-input otp-input" placeholder="Enter 6-digit code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required />
                    <button type="submit" class="login-btn magic-link-btn">Verify code</button>
                </form>
                <button id="otp-resend" class="otp-resend-btn">Resend code</button>
            </div>
            <p id="magic-link-status" class="magic-link-status" style="display:none;"></p>
        </div>
    `;
    showModal('Sign In / Sign Up', content);

    let pendingEmail = '';

    document.getElementById('login-google')?.addEventListener('click', async () => {
        closeModal();
        try { await signInWithProvider('google'); } catch (e) { showErrorModal('Sign In Failed', e.message); }
    });

    document.getElementById('email-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('magic-link-email');
        const statusEl = document.getElementById('magic-link-status');
        const email = emailInput.value.trim();
        if (!email) return;

        emailInput.disabled = true;
        e.target.querySelector('button').disabled = true;
        statusEl.style.display = 'none';

        try {
            await sendSignInCode(email);
            pendingEmail = email;
            document.getElementById('email-step').style.display = 'none';
            document.getElementById('code-step').style.display = 'block';
            document.getElementById('otp-code')?.focus();
        } catch (err) {
            statusEl.textContent = err.message || 'Failed to send code. Please try again.';
            statusEl.className = 'magic-link-status magic-link-error';
            statusEl.style.display = 'block';
            emailInput.disabled = false;
            e.target.querySelector('button').disabled = false;
        }
    });

    document.getElementById('code-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('otp-code');
        const statusEl = document.getElementById('magic-link-status');
        const code = codeInput.value.trim();
        if (!code || !pendingEmail) return;

        codeInput.disabled = true;
        e.target.querySelector('button').disabled = true;
        statusEl.style.display = 'none';

        try {
            await verifySignInCode(pendingEmail, code);
            closeModal();
        } catch (err) {
            statusEl.textContent = err.message || 'Invalid or expired code. Please try again.';
            statusEl.className = 'magic-link-status magic-link-error';
            statusEl.style.display = 'block';
            codeInput.disabled = false;
            codeInput.value = '';
            codeInput.focus();
            e.target.querySelector('button').disabled = false;
        }
    });

    document.getElementById('otp-resend')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('magic-link-status');
        const resendBtn = document.getElementById('otp-resend');
        resendBtn.disabled = true;

        try {
            await sendSignInCode(pendingEmail);
            statusEl.textContent = 'New code sent!';
            statusEl.className = 'magic-link-status magic-link-success';
            statusEl.style.display = 'block';
        } catch (err) {
            statusEl.textContent = err.message || 'Failed to resend code.';
            statusEl.className = 'magic-link-status magic-link-error';
            statusEl.style.display = 'block';
        } finally {
            resendBtn.disabled = false;
        }
    });
}

export async function refreshCloudPresets() {
    try {
        state.cloudPresets = await loadUserPresets();
    } catch (e) {
        console.error('[Cloud] Failed to load presets:', e);
        state.cloudPresets = [];
    }
}
