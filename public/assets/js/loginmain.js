/home/mark/cv/frontend/public/assets/js/main.js

const API_URL = window.ENV.API_URL;
let userToken = localStorage.getItem('userToken');

// جلب CSRF Token
async function fetchCsrfToken() {
    try {
        const response = await fetch(`${API_URL}/api/csrf-token`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch CSRF token');
        }
        return data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        Toastify({
            text: `Failed to fetch CSRF token: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        return null;
    }
}

// تعديل روابط الـ Social Login
function setupSocialLoginLinks() {
    document.querySelectorAll('.social-login-btn').forEach(link => {
        const provider = link.href.split('/').pop();
        link.href = `${window.ENV.API_URL}/auth/${provider}?redirect_uri=${encodeURIComponent(window.ENV.REDIRECT_URI)}&success_redirect=${encodeURIComponent(window.ENV.SUCCESS_REDIRECT)}`;
    });
}

// دالة لتجديد الـ Token
async function refreshToken() {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');
        const response = await fetch(`${API_URL}/api/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid server response');
        }
        if (!response.ok) {
            throw new Error(data.error || 'Failed to refresh token');
        }
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        return data.token;
    } catch (error) {
        console.error('Refresh token error:', error);
        localStorage.removeItem('userToken');
        localStorage.removeItem('refreshToken');
        window.location.href = `${window.ENV.WEB_URL}/login.html?reason=${encodeURIComponent('Session expired, please login again')}`;
    }
}

// تحديث الـ Navigation Bar بناءً على حالة المستخدم
async function updateNav() {
    if (!userToken) {
        document.getElementById('login-link').style.display = window.location.pathname === '/login.html' ? 'none' : 'block';
        document.getElementById('register-link').style.display = window.location.pathname === '/register.html' ? 'none' : 'block';
        document.getElementById('profile-link').style.display = 'none';
        document.getElementById('logout-link').style.display = 'none';
        document.getElementById('admin-link').style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`${API_URL}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (!response.ok && response.status === 401) {
            userToken = await refreshToken();
            const retryResponse = await fetch(`${API_URL}/api/verify-token`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (!retryResponse.ok) throw new Error('Token verification failed');
            const data = await retryResponse.json();
            document.getElementById('login-link').style.display = 'none';
            document.getElementById('register-link').style.display = 'none';
            document.getElementById('profile-link').style.display = 'block';
            document.getElementById('logout-link').style.display = 'block';
            if (data.isAdmin) {
                document.getElementById('admin-link').style.display = 'block';
            }
        } else if (response.ok) {
            const data = await response.json();
            document.getElementById('login-link').style.display = 'none';
            document.getElementById('register-link').style.display = 'none';
            document.getElementById('profile-link').style.display = 'block';
            document.getElementById('logout-link').style.display = 'block';
            if (data.isAdmin) {
                document.getElementById('admin-link').style.display = 'block';
            }
        } else {
            throw new Error('Token verification failed');
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        document.getElementById('login-link').style.display = window.location.pathname === '/login.html' ? 'none' : 'block';
        document.getElementById('register-link').style.display = window.location.pathname === '/register.html' ? 'none' : 'block';
        document.getElementById('profile-link').style.display = 'none';
        document.getElementById('logout-link').style.display = 'none';
        document.getElementById('admin-link').style.display = 'none';
    }
}

// التعامل مع البحث
async function loadSearchResults(query) {
    try {
        const response = await fetch(`${API_URL}/api/users/search?query=${encodeURIComponent(query)}`, {
            headers: userToken ? { 'Authorization': `Bearer ${userToken}` } : {}
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch search results');
        }
        const users = await response.json();
        const searchResults = document.getElementById('search-results');
        searchResults.classList.remove('hidden');
        searchResults.innerHTML = users.length ? users.map(user => `
            <a href="${user.profileUrl}" class="block p-2 hover:bg-gray-200 dark:hover:bg-gray-700">
                <img src="${user.avatar || '/assets/img/default-avatar.png'}" alt="${user.nickname || user.username}" class="inline-block w-8 h-8 rounded-full mr-2">
                ${user.nickname || user.username}
            </a>
        `).join('') : '<p class="p-2">No users found.</p>';
    } catch (error) {
        console.error('Error searching users:', error);
        document.getElementById('search-results').innerHTML = '<p class="p-2">Error searching users: ' + error.message;
    }
}

// تهيئة الصفحة
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loader').style.display = 'none';
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.src = savedTheme === 'light' ? modeToggle.getAttribute('src-light') : modeToggle.getAttribute('src-dark');
    }
    setupSocialLoginLinks();
    updateNav();

    // التعامل مع البحث
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                loadSearchResults(query);
            } else {
                document.getElementById('search-results').classList.add('hidden');
            }
        });
    }

    // إغلاق نتائج البحث عند النقر خارجها
    document.addEventListener('click', (e) => {
        const searchResults = document.getElementById('search-results');
        if (searchResults && !e.target.closest('#search-input') && !e.target.closest('#search-results')) {
            searchResults.classList.add('hidden');
        }
    });

    // التعامل مع الـ Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            const modeToggle = document.getElementById('modeToggle');
            modeToggle.src = newTheme === 'light' ? modeToggle.getAttribute('src-light') : modeToggle.getAttribute('src-dark');
            document.body.classList.toggle('theme-transition');
            setTimeout(() => document.body.classList.remove('theme-transition'), 300);
        });
    }

    // التعامل مع الـ Mobile Menu
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            const navMenu = document.getElementById('nav-menu');
            navMenu.classList.toggle('show');
        });
    }

    // إغلاق القائمة عند النقر على رابط
    document.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', () => {
            const navMenu = document.getElementById('nav-menu');
            navMenu.classList.remove('show');
        });
    });

    // التعامل مع الـ Logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch(`${API_URL}/api/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
                });
                localStorage.removeItem('userToken');
                localStorage.removeItem('refreshToken');
                userToken = null;
                await updateNav();
                window.location.href = `${window.ENV.WEB_URL}/`;
            } catch (error) {
                console.error('Logout failed:', error);
                Toastify({
                    text: 'Error during logout',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
            }
        });
    }
});