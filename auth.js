const AUTH_TOKEN_KEY = 'constructor_hsr_auth_token';
const ANON_CREATOR_KEY = 'constructor_hsr_creator_key';

function getCreatorKey() {
    let key = localStorage.getItem(ANON_CREATOR_KEY);
    if (!key) {
        key = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '');
        localStorage.setItem(ANON_CREATOR_KEY, key);
    }
    return key;
}

function saveToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function isLoggedIn() {
    return !!getToken();
}

window.Auth = {
    getToken,
    isLoggedIn,
    getCreatorKey
};

const originalFetch = window.fetch.bind(window);
window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const token = getToken();
    const creatorKey = getCreatorKey();

    if (token && url.includes('/api/')) {
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        if (!headers.has('X-Constructor-HSR-Creator-Key')) {
            headers.set('X-Constructor-HSR-Creator-Key', creatorKey);
        }
        init.headers = headers;
    } else if (url.includes('/api/')) {
        const headers = new Headers(init.headers || {});
        if (!headers.has('X-Constructor-HSR-Creator-Key')) {
            headers.set('X-Constructor-HSR-Creator-Key', creatorKey);
        }
        init.headers = headers;
    }

    return originalFetch(input, init);
};

function parseApiError(payload, fallback) {
    if (!payload) return fallback;
    if (payload.error) return payload.error;
    if (payload.message) return payload.message;
    if (Array.isArray(payload.errors) && payload.errors[0]?.msg) return payload.errors[0].msg;
    return fallback;
}

function clearAuthError(form) {
    const errorEl = document.getElementById(`${form}Error`);
    if (errorEl) errorEl.textContent = '';
}

function showAuthError(form, message) {
    const errorEl = document.getElementById(`${form}Error`);
    if (errorEl) errorEl.textContent = message;
}

function closeAuthModal() {
    document.getElementById('loginModal')?.classList.remove('show');
    document.getElementById('registerModal')?.classList.remove('show');
    clearAuthError('login');
    clearAuthError('register');
}

function openLoginModal() {
    closeAuthModal();
    document.getElementById('loginModal')?.classList.add('show');
    document.getElementById('loginEmail')?.focus();
}

function openRegisterModal() {
    closeAuthModal();
    document.getElementById('registerModal')?.classList.add('show');
    document.getElementById('registerUsername')?.focus();
}

function switchToRegister() {
    openRegisterModal();
}

function switchToLogin() {
    openLoginModal();
}

function notifyAuthStateChanged() {
    if (typeof window.onAuthStateChanged === 'function') {
        window.onAuthStateChanged(isLoggedIn());
    }
}

async function fetchUserProfile() {
    if (!isLoggedIn()) return null;
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            if (res.status === 401) {
                clearToken();
                notifyAuthStateChanged();
            }
            return null;
        }
        return await res.json();
    } catch (err) {
        console.warn('Не удалось загрузить профиль:', err);
        return null;
    }
}

async function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const authProfile = document.getElementById('authProfile');
    const userUsername = document.getElementById('userUsername');

    if (!authButtons || !authProfile || !userUsername) return;

    if (!isLoggedIn()) {
        authButtons.classList.remove('hidden');
        authProfile.classList.add('hidden');
        userUsername.textContent = '';
        return;
    }

    const profile = await fetchUserProfile();
    if (!profile) {
        authButtons.classList.remove('hidden');
        authProfile.classList.add('hidden');
        userUsername.textContent = '';
        return;
    }

    userUsername.textContent = profile.username || profile.email || 'User';
    authButtons.classList.add('hidden');
    authProfile.classList.remove('hidden');
}

async function submitLogin() {
    clearAuthError('login');

    const email = (document.getElementById('loginEmail')?.value || '').trim();
    const password = document.getElementById('loginPassword')?.value || '';

    if (!email) return showAuthError('login', 'Введите email');
    if (!password) return showAuthError('login', 'Введите пароль');

    const btn = document.getElementById('loginSubmitBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Вход...';
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
            showAuthError('login', parseApiError(payload, 'Ошибка входа'));
            return;
        }

        saveToken(payload.token);
        await updateAuthUI();
        closeAuthModal();
        notifyAuthStateChanged();
    } catch (err) {
        showAuthError('login', 'Ошибка сети');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Вход';
        }
    }
}

async function submitRegister() {
    clearAuthError('register');

    const username = (document.getElementById('registerUsername')?.value || '').trim();
    const email = (document.getElementById('registerEmail')?.value || '').trim();
    const password = document.getElementById('registerPassword')?.value || '';
    const confirm = document.getElementById('registerPasswordConfirm')?.value || '';

    if (username.length < 3) return showAuthError('register', 'Ник должен быть 3+ символа');
    if (!email) return showAuthError('register', 'Введите email');
    if (password.length < 8) return showAuthError('register', 'Пароль должен быть 8+ символов');
    if (password !== confirm) return showAuthError('register', 'Пароли не совпадают');

    const btn = document.getElementById('registerSubmitBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Регистрация...';
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
            showAuthError('register', parseApiError(payload, 'Ошибка регистрации'));
            return;
        }

        saveToken(payload.token);
        await updateAuthUI();
        closeAuthModal();
        notifyAuthStateChanged();
    } catch (err) {
        showAuthError('register', 'Ошибка сети');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Зарегистрироваться';
        }
    }
}

async function submitLogout() {
    clearToken();
    await updateAuthUI();
    notifyAuthStateChanged();
}

window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.closeAuthModal = closeAuthModal;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.submitLogin = submitLogin;
window.submitRegister = submitRegister;
window.submitLogout = submitLogout;

window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('openLoginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('openRegisterBtn')?.addEventListener('click', openRegisterModal);
    document.getElementById('logoutBtn')?.addEventListener('click', submitLogout);

    document.getElementById('loginModal')?.addEventListener('click', e => {
        if (e.target.id === 'loginModal') closeAuthModal();
    });
    document.getElementById('registerModal')?.addEventListener('click', e => {
        if (e.target.id === 'registerModal') closeAuthModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAuthModal();
    });

    await updateAuthUI();
});
