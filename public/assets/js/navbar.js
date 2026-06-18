// ============================================
// Navbar Component - ديناميكي مع تخزين مؤقت (Caching)
// ============================================

let siteSettings = null;
let userToken = localStorage.getItem('userToken');
let cachedUserData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 دقيقه

const API_URL = window.ENV?.API_URL || 'http://localhost:7860';
const cleanApiUrl = API_URL.replace(/\/$/, '');

// ============================================
// جلب إعدادات الموقع مع Cache
// ============================================
async function loadSiteSettings() {
    // ✅ حاول تجيب من localStorage الأول
    const cachedSettings = localStorage.getItem('siteSettings');
    const cachedTime = localStorage.getItem('siteSettingsTimestamp');
    
    if (cachedSettings && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_DURATION)) {
        try {
            siteSettings = JSON.parse(cachedSettings);
            console.log('📦 Using cached site settings');
            renderNavbar();
            return;
        } catch(e) {}
    }
    
    // ✅ لو مفيش Cache أو انتهى، اجب من API
    try {
        const response = await fetch(`${cleanApiUrl}/api/site-settings`);
        if (response.ok) {
            siteSettings = await response.json();
            // ✅ خزن في localStorage
            localStorage.setItem('siteSettings', JSON.stringify(siteSettings));
            localStorage.setItem('siteSettingsTimestamp', Date.now().toString());
            console.log('🌐 Fetched fresh site settings');
            renderNavbar();
        } else {
            siteSettings = {
                siteName: 'MGZon',
                logo: '/assets/img/logo.svg',
                navbarLinks: [{ label: 'Home', href: '/', order: 1 }]
            };
            renderNavbar();
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
        siteSettings = {
            siteName: 'MGZon',
            logo: '/assets/img/logo.svg',
            navbarLinks: [{ label: 'Home', href: '/', order: 1 }]
        };
        renderNavbar();
    }
}

// ============================================
// التحقق من المستخدم مع Cache
// ============================================
async function verifyUser() {
    // ✅ جيب التوكن من userToken أو adminToken
    userToken = localStorage.getItem('userToken') || localStorage.getItem('adminToken');
    
    if (!userToken) {
        cachedUserData = null;
        renderNavbar();
        return false;
    }
    
    // ✅ حاول تجيب من cache
    const cachedUser = localStorage.getItem('cachedUserData');
    const cachedUserTime = localStorage.getItem('cachedUserDataTimestamp');
    
    if (cachedUser && cachedUserTime && (Date.now() - parseInt(cachedUserTime) < CACHE_DURATION)) {
        try {
            cachedUserData = JSON.parse(cachedUser);
            console.log('📦 Using cached user data');
            renderNavbar();
            return true;
        } catch(e) {}
    }
    
    // ✅ لو مفيش Cache، اتحقق من API
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        if (response.ok) {
            cachedUserData = await response.json();
            localStorage.setItem('cachedUserData', JSON.stringify(cachedUserData));
            localStorage.setItem('cachedUserDataTimestamp', Date.now().toString());
            console.log('🌐 Fetched fresh user data');
            renderNavbar();
            return true;
        } else {
            localStorage.removeItem('userToken');
            localStorage.removeItem('adminToken');  // ✅ كمان امسح adminToken
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('cachedUserData');
            localStorage.removeItem('cachedUserDataTimestamp');
            userToken = null;
            cachedUserData = null;
            renderNavbar();
            return false;
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        renderNavbar();
        return false;
    }
}

// ============================================
// تحديث واجهة المستخدم (Navbar)
// ============================================
function renderNavbar() {
    const header = document.querySelector('header.l-header');
    if (!header) return;
    
    const siteName = siteSettings?.siteName || 'MGZon';
    const logo = siteSettings?.logo || '/assets/img/logo.svg';
    const navbarLinks = siteSettings?.navbarLinks || [];
    
    const isLoggedIn = !!(userToken && cachedUserData);
    const isAdmin = cachedUserData?.isAdmin || false;
    
    // ✅ الروابط الديناميكية (Home, Settings, etc.) - تظهر فقط للمسجلين
    let dynamicLinksHtml = '';
    if (isLoggedIn) {
        const sortedLinks = [...navbarLinks].sort((a, b) => a.order - b.order);
        dynamicLinksHtml = sortedLinks.map(link => `
            <li class="nav__item"><a href="${link.href}" class="nav__link">${link.label}</a></li>
        `).join('');
    }
    
    // ✅ Search box - يظهر فقط للمسجلين
    let searchHtml = '';
    if (isLoggedIn) {
        searchHtml = `
            <li class="nav__item">
                <input type="text" id="search-input" placeholder="Search users..." class="p-2 rounded-lg border border-gray-300 dark:border-gray-600">
                <div id="search-results" class="hidden"></div>
            </li>
        `;
    }
    
    // ✅ Theme toggle - يظهر فقط للمسجلين
    let themeHtml = '';
    if (isLoggedIn) {
        themeHtml = `
            <li class="nav__item"><a href="#" class="nav__link" id="theme-toggle">
                <img id="modeToggle" class="icon color-icon" src="/assets/img/theme_light.png" alt="Theme" />
            </a></li>
        `;
    }
    
    let authLinksHtml = '';
    if (isLoggedIn) {
        authLinksHtml = `
            <li class="nav__item"><a href="/profile/me" class="nav__link" id="profile-link">Profile</a></li>
            ${isAdmin ? '<li class="nav__item"><a href="/admin.html" class="nav__link" id="admin-link">Admin</a></li>' : ''}
            <li class="nav__item"><a href="#" class="nav__link" id="logout-link">Logout</a></li>
        `;
    } else {
        authLinksHtml = `
            <li class="nav__item"><a href="/login.html" class="nav__link" id="login-link">Login</a></li>
            <li class="nav__item"><a href="/register.html" class="nav__link" id="register-link">Register</a></li>
        `;
    }
    
    const navMenu = header.querySelector('.nav__menu');
    if (navMenu) {
        navMenu.innerHTML = `
            <ul class="nav__list">
                ${searchHtml}
                ${dynamicLinksHtml}
                ${authLinksHtml}
                ${themeHtml}
            </ul>
        `;
    }
    
    const logoLink = header.querySelector('.nav__logo');
    const logoImg = logoLink?.querySelector('img');
    const logoName = logoLink?.querySelector('span');
    
    if (logoImg) {
        logoImg.src = logo;
        logoImg.alt = siteName;
        logoImg.onerror = () => {
            logoImg.src = '/assets/img/logo.svg';
        };
    }
    if (logoName) logoName.textContent = siteName;
    
    bindNavbarEvents();
}
// ============================================
// ربط الأحداث (Logout, Theme, Search, Mobile menu)
// ============================================
function bindNavbarEvents() {
    const isLoggedIn = !!(userToken && cachedUserData);
    
    // Logout - فقط للمسجلين
    if (isLoggedIn) {
        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            const newLogoutLink = logoutLink.cloneNode(true);
            logoutLink.parentNode.replaceChild(newLogoutLink, logoutLink);
            
            newLogoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const csrfResponse = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
                    const csrfData = await csrfResponse.json();
                    await fetch(`${cleanApiUrl}/api/logout`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Authorization': `Bearer ${userToken}`,
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfData.csrfToken
                        },
                        body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
                    });
                    localStorage.removeItem('userToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('cachedUserData');
                    localStorage.removeItem('cachedUserDataTimestamp');
                    localStorage.removeItem('siteSettings');
                    localStorage.removeItem('siteSettingsTimestamp');
                    window.location.href = '/';
                } catch (error) {
                    console.error('Logout failed:', error);
                }
            });
        }
    }
    
    // Theme toggle - فقط للمسجلين
    if (isLoggedIn) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const newThemeToggle = themeToggle.cloneNode(true);
            themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
            
            newThemeToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                const modeToggle = document.getElementById('modeToggle');
                if (modeToggle) {
                    modeToggle.src = newTheme === 'light' ? modeToggle.getAttribute('src-light') : modeToggle.getAttribute('src-dark');
                }
            });
        }
    }
    
    // Search - فقط للمسجلين
    if (isLoggedIn) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            newSearchInput.addEventListener('input', debounce(async (e) => {
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    const users = await searchUsers(query);
                    displaySearchResults(users);
                } else {
                    hideSearchResults();
                }
            }, 300));
        }
    }
    
    // Mobile menu - للجميع (حتة للغير مسجلين)
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        const newNavToggle = navToggle.cloneNode(true);
        navToggle.parentNode.replaceChild(newNavToggle, navToggle);
        
        newNavToggle.addEventListener('click', () => {
            navMenu.classList.toggle('show');
        });
        
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('show');
            });
        });
    }
}

// ============================================
// باقي الدوال (searchUsers, displaySearchResults, etc.)
// ============================================
async function searchUsers(query) {
    try {
        const response = await fetch(`${cleanApiUrl}/api/users/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

function displaySearchResults(users) {
    let resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) {
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.parentNode) {
            const div = document.createElement('div');
            div.id = 'search-results';
            div.className = 'hidden absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border';
            searchInput.parentNode.style.position = 'relative';
            searchInput.parentNode.appendChild(div);
            resultsDiv = div;
        }
    }
    
    if (!resultsDiv) return;
    
    if (users.length === 0) {
        resultsDiv.innerHTML = '<p class="p-2 text-gray-600">No users found.</p>';
        resultsDiv.classList.remove('hidden');
        return;
    }
    
    resultsDiv.innerHTML = users.map(user => `
        <a href="/profile/${user.profile?.nickname || user.username}" class="block p-2 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2">
            <img src="${user.avatar || '/assets/img/default-avatar.png'}" class="w-8 h-8 rounded-full">
            <span>${escapeHtml(user.nickname || user.username)}</span>
        </a>
    `).join('');
    resultsDiv.classList.remove('hidden');
}

function hideSearchResults() {
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) resultsDiv.classList.add('hidden');
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

async function updateUserNav() {
    await verifyUser();
}

// ============================================
// بداية التشغيل
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // جلب إعدادات الموقع (من Cache أو API)
    await loadSiteSettings();
    
    // التحقق من المستخدم (من Cache أو API)
    await verifyUser();
    
    // مراقبة تغييرات الـ storage (للتسجيل من نوافذ أخرى)
    window.addEventListener('storage', (e) => {
        if (e.key === 'userToken') {
            verifyUser();
        }
        if (e.key === 'siteSettings') {
            loadSiteSettings();
        }
    });

    // اجعل المتغيرات عامة لكل الصفحات
window.cleanApiUrl = cleanApiUrl;
window.cachedUserData = cachedUserData;
window.userToken = userToken;
window.searchUsers = searchUsers;
window.displaySearchResults = displaySearchResults;
window.hideSearchResults = hideSearchResults;
window.escapeHtml = escapeHtml;
window.debounce = debounce;


});