const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');

let userToken = localStorage.getItem('userToken');
let translations = {};
let currentUserProfileData = null; // ✅ متغير جديد لتخزين بيانات البروفايل الحالية

async function fetchCsrfToken() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/csrf-token`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to fetch CSRF token');
        }
        const data = await response.json();
        const csrfInput = document.getElementById('csrf-token');
        if (csrfInput) csrfInput.value = data.csrfToken;
        return data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        Toastify({
            text: `Error fetching CSRF token: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        return null;
    }
}

async function fetchWithRefresh(url, options = {}, retries = 1) {
    try {
        let csrfToken = document.getElementById('csrf-token')?.value;
        if (!csrfToken) {
            csrfToken = await fetchCsrfToken();
        }
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${userToken}`,
            'X-CSRF-Token': csrfToken || ''
        };
        let response = await fetch(url, { ...options, timeout: 10000 });
        const newToken = response.headers.get('X-New-Token');
        if (newToken) {
            localStorage.setItem('userToken', newToken);
            userToken = newToken;
        }
        if (response.status === 401 && retries > 0) {
            const refreshedToken = await refreshToken();
            if (refreshedToken) {
                options.headers = { ...options.headers, 'Authorization': `Bearer ${refreshedToken}` };
                response = await fetch(url, options);
                const newTokenFromRetry = response.headers.get('X-New-Token');
                if (newTokenFromRetry) {
                    localStorage.setItem('userToken', newTokenFromRetry);
                    userToken = newTokenFromRetry;
                }
            } else {
                window.location.href = '/login.html?reason=token_refresh_failed';
                return null;
            }
        }
        return response;
    } catch (error) {
        console.error('Error in fetchWithRefresh:', error);
        if (error.message.includes('No refresh token') || error.message.includes('Failed to refresh token')) {
            localStorage.removeItem('userToken');
            localStorage.removeItem('refreshToken');
            userToken = null;
            window.location.href = '/login.html?reason=session_expired';
        }
        throw error;
    }
}

async function refreshToken() {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/refresh-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ refreshToken })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to refresh token');
        localStorage.setItem('userToken', data.accessToken || data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        userToken = data.accessToken || data.token;
        return userToken;
    } catch (error) {
        console.error('Error refreshing token:', error);
        Toastify({
            text: 'Session expired, please log in again.',
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        localStorage.removeItem('userToken');
        localStorage.removeItem('refreshToken');
        userToken = null;
        window.location.href = '/login.html?reason=session_expired';
        return null;
    }
}

async function loadNav() {
    try {
        const response = await fetch('/assets/js/templates/nav.html');
        if (!response.ok) throw new Error('Failed to load navigation bar');
        const navHtml = await response.text();
        document.querySelector('header.l-header')?.remove();
        document.body.insertAdjacentHTML('afterbegin', navHtml);
    } catch (error) {
        console.error('Error loading nav:', error);
    }
}

function setupSocialLoginLinks() {
    document.querySelectorAll('.social-login-btn').forEach(link => {
        const provider = link.href.split('/').pop();
        link.href = `${cleanApiUrl}/auth/${provider}?redirect_uri=${encodeURIComponent(window.ENV.REDIRECT_URI)}&success_redirect=${encodeURIComponent(window.ENV.SUCCESS_REDIRECT)}`;
    });
}

async function updateNav() {
    // ✅ منع أي طلبات في صفحات login/register تماماً
    const isAuthPage = window.location.pathname === '/login.html' || 
                       window.location.pathname === '/register.html';
    
    // إخفاء/إظهار الروابط حسب حالة المستخدم
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const logoutLink = document.getElementById('logout-link');
    const adminLink = document.getElementById('admin-link');
    
    if (!userToken) {
        if (loginLink) loginLink.style.display = isAuthPage ? 'none' : 'block';
        if (registerLink) registerLink.style.display = isAuthPage ? 'none' : 'block';
        if (profileLink) profileLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        
        // ✅ في صفحات المصادقة، لا نرسل أي طلب نهائياً
        if (isAuthPage) {
            return;
        }
    }
    
    // ✅ فقط إذا كان هناك توكن ولَسنا في صفحات المصادقة
    if (userToken && !isAuthPage) {
        try {
            const response = await fetchWithRefresh(`${cleanApiUrl}/api/verify-token`);
            if (response && response.ok) {
                const data = await response.json();
                if (loginLink) loginLink.style.display = 'none';
                if (registerLink) registerLink.style.display = 'none';
                if (profileLink) profileLink.style.display = 'block';
                if (logoutLink) logoutLink.style.display = 'block';
                const portfolioNameEl = document.getElementById('portfolio-name');
                if (portfolioNameEl) portfolioNameEl.textContent = DOMPurify.sanitize(data.profile?.portfolioName || 'Portfolio');
                if (adminLink && data.isAdmin) adminLink.style.display = 'block';
            } else if (response && !response.ok) {
                localStorage.removeItem('userToken');
                localStorage.removeItem('refreshToken');
                userToken = null;
                if (loginLink) loginLink.style.display = 'block';
                if (registerLink) registerLink.style.display = 'block';
                if (profileLink) profileLink.style.display = 'none';
                if (logoutLink) logoutLink.style.display = 'none';
            }
        } catch (error) {
            console.error('Error verifying token:', error);
        }
    }
}

async function loadSearchResults(query) {
    try {
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/users/search?query=${encodeURIComponent(query)}`, {
            headers: { 'X-CSRF-Token': await fetchCsrfToken() }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch search results');
        }
        const users = await response.json();
        const searchResults = document.getElementById('search-results');
        searchResults.classList.remove('hidden');
        searchResults.innerHTML = users.length ? users.map(user => `
            <div class="user-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 flex items-center space-x-4 cursor-pointer hover:shadow-lg transition-shadow duration-300" onclick="window.location.href='/profile/${encodeURIComponent(DOMPurify.sanitize(user.profile.nickname || user.username))}'">
                <img src="${DOMPurify.sanitize(user.profile.avatar || '/assets/img/default-avatar.png')}" alt="${DOMPurify.sanitize(user.profile.nickname || user.username)}" class="w-16 h-16 rounded-full object-cover">
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${DOMPurify.sanitize(user.profile.nickname || user.username)}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400"><strong>Job:</strong> ${DOMPurify.sanitize(user.profile.jobTitle || 'Not specified')}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400"><strong>Status:</strong> ${DOMPurify.sanitize(user.profile.status || 'Not available')}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400"><strong>Bio:</strong> ${DOMPurify.sanitize(user.profile.bio ? user.profile.bio.substring(0, 100) + (user.profile.bio.length > 100 ? '...' : '') : 'Not specified')}</p>
                    <div class="skills flex space-x-2 mt-2">
                        ${user.profile.skills?.length ? user.profile.skills.slice(0, 3).map(skill => `<span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">${DOMPurify.sanitize(skill.name)}</span>`).join('') : '<span class="text-xs text-gray-500">No skills</span>'}
                    </div>
                </div>
                <a href="${cleanApiUrl}/api/profile/pdf/${encodeURIComponent(DOMPurify.sanitize(user.profile.nickname || user.username))}" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">Download CV</a>
            </div>
        `).join('') : '<p class="text-center text-gray-600 dark:text-gray-400 p-4">No users found.</p>';
    } catch (error) {
        console.error('Error searching users:', error);
        Toastify({
            text: `Search error: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        document.getElementById('search-results').innerHTML = '<p class="p-2 text-gray-600 dark:text-gray-400">Error searching users.</p>';
    }
}

// ✅ تحسين دالة loadProfile بحيث تخزن البيانات في المتغير العام
async function loadProfile(nickname = null) {
    if (!userToken && !nickname) {
        Toastify({
            text: 'Please log in to view your profile',
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        window.location.href = '/login.html?reason=Please login to view your profile';
        return null;
    }
    try {
        const url = nickname ? `${cleanApiUrl}/api/profile/${encodeURIComponent(nickname)}` : `${cleanApiUrl}/api/profile/me`;
        const response = await fetchWithRefresh(url);
        if (!response.ok) {
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Invalid server response');
            }
            throw new Error(data.error || 'Failed to fetch profile');
        }
        const data = await response.json();
        if (!data.profile) {
            throw new Error('No profile data found');
        }

        // ✅ تخزين البيانات في المتغير العام
        if (!nickname) {
            currentUserProfileData = data;
        }

        // Update profile information
        document.getElementById('profile-nickname').textContent = DOMPurify.sanitize(data.profile.nickname || data.username);
        document.getElementById('profile-jobTitle').textContent = DOMPurify.sanitize(data.profile.jobTitle || '');
        document.getElementById('profile-bio').textContent = DOMPurify.sanitize(data.profile.bio || '');
        document.getElementById('profile-status').textContent = DOMPurify.sanitize(data.profile.status || 'Available');
        document.getElementById('portfolio-name').textContent = DOMPurify.sanitize(data.profile.portfolioName || 'Portfolio');

        // Update avatar
        const avatarContainer = document.getElementById('avatar-container');
        avatarContainer.innerHTML = '';
        if (data.profile.avatar) {
            const avatar = document.createElement('img');
            avatar.src = DOMPurify.sanitize(data.profile.avatar);
            avatar.className = `w-24 h-24 rounded-full object-cover ${data.profile.avatarDisplayType === 'svg' ? 'svg-avatar' : ''}`;
            avatar.style.backgroundColor = data.profile.avatarDisplayType === 'svg' ? DOMPurify.sanitize(data.profile.svgColor || '#000000') : 'transparent';
            avatar.onerror = () => {
                avatar.src = '/assets/img/default-avatar.png';
            };
            avatarContainer.appendChild(avatar);
        }

        // Update social links
        const socialLinksContainer = document.getElementById('social-links');
        socialLinksContainer.innerHTML = '';
        const socialLinks = data.profile.socialLinks || {};
        for (const [platform, url] of Object.entries(socialLinks)) {
            if (url) {
                const link = document.createElement('a');
                link.href = DOMPurify.sanitize(url);
                link.target = '_blank';
                link.className = `home__social-icon bx bxl-${platform} text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-500`;
                socialLinksContainer.appendChild(link);
            }
        }

        // Update education
        const educationContainer = document.getElementById('profile-education');
        educationContainer.innerHTML = data.profile.education?.length ? data.profile.education.map(edu => `
            <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(edu.institution)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(edu.degree)}</p>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(edu.year)}</p>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No education listed.</p>';

        // Update experience
        const experienceContainer = document.getElementById('profile-experience');
        experienceContainer.innerHTML = data.profile.experience?.length ? data.profile.experience.map(exp => `
            <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(exp.company)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(exp.role)}</p>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(exp.duration)}</p>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No experience listed.</p>';

        // Update certificates
        const certificateContainer = document.getElementById('profile-certificates');
        certificateContainer.innerHTML = data.profile.certificates?.length ? data.profile.certificates.map(cert => `
            <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(cert.name)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(cert.issuer)}</p>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(cert.year)}</p>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No certificates listed.</p>';

        // Update skills
        const skillsContainer = document.getElementById('profile-skills');
        skillsContainer.innerHTML = data.profile.skills?.length ? data.profile.skills.map(skill => `
            <div class="skills__data bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(skill.name)}</h4>
                <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div class="bg-blue-500 h-2.5 rounded-full" style="width: ${skill.percentage}%"></div>
                </div>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No skills listed.</p>';

        // Update projects
        const projectsContainer = document.getElementById('profile-projects');
        projectsContainer.innerHTML = data.profile.projects?.length ? data.profile.projects.map(project => `
            <div class="work__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(project.title)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(project.description)}</p>
                ${project.image ? `<img src="${DOMPurify.sanitize(project.image)}" class="w-full h-48 object-cover rounded-lg mt-2" onerror="this.src='/assets/img/default-project.png'" />` : ''}
                <p class="text-gray-600 dark:text-gray-400">Rating: ${DOMPurify.sanitize(project.rating)}</p>
                <p class="text-gray-600 dark:text-gray-400">Stars: ${'★'.repeat(project.stars)}</p>
                <div class="flex space-x-2 mt-2">
                    ${project.links?.map(link => `
                        <a href="${DOMPurify.sanitize(link.value)}" target="_blank" class="text-blue-500 hover:underline">${DOMPurify.sanitize(link.option)}</a>
                    `).join('') || ''}
                </div>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No projects listed.</p>';

        // Update GitHub repos
        const githubReposContainer = document.getElementById('github-repos');
        githubReposContainer.innerHTML = data.profile.githubRepos?.length ? data.profile.githubRepos.map(repo => `
            <div class="work__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(repo.name)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(repo.description)}</p>
                ${repo.image ? `<img src="${DOMPurify.sanitize(repo.image)}" class="w-full h-48 object-cover rounded-lg mt-2" onerror="this.src='/assets/img/default-project.png'" />` : ''}
                <a href="${DOMPurify.sanitize(repo.url)}" target="_blank" class="text-blue-500 hover:underline">View on GitHub</a>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No GitHub repositories listed.</p>';

        // Update custom fields
        const customFieldsContainer = document.getElementById('profile-customFields');
        customFieldsContainer.innerHTML = data.profile.customFields?.length ? data.profile.customFields.map(field => `
            <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                <h4 class="font-semibold">${DOMPurify.sanitize(field.name)}</h4>
                <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(field.value)}</p>
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No custom fields listed.</p>';

        // Update interests
        const interestsContainer = document.getElementById('profile-interests');
        interestsContainer.innerHTML = data.profile.interests?.length ? data.profile.interests.map(interest => `
            <span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded mr-2">${DOMPurify.sanitize(interest)}</span>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No interests listed.</p>';

        // Update download CV links
        const nickname = DOMPurify.sanitize(data.profile.nickname || data.username);
        document.getElementById('download-cv').href = `${cleanApiUrl}/api/profile/pdf/${encodeURIComponent(nickname)}`;
        document.getElementById('download-docx').href = `${cleanApiUrl}/api/profile/docx/${encodeURIComponent(nickname)}`;
        document.getElementById('contact-phone').href = data.profile.phone ? `tel:${DOMPurify.sanitize(data.profile.phone)}` : '#';

        return data;
    } catch (error) {
        console.error('Error loading profile:', error);
        Toastify({
            text: `Error loading profile: ${error.message}. Try refreshing the page.`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        return null;
    }
}

// ✅ تحسين دالة loadSettings بحيث تخزن البيانات في المتغير العام
async function loadSettings() {
    if (!userToken) {
        Toastify({
            text: 'Please log in to view your profile',
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        window.location.href = '/login.html?reason=Please login to view your profile';
        return null;
    }
    try {
        const verifyResponse = await fetchWithRefresh(`${cleanApiUrl}/api/verify-token`);
        if (!verifyResponse.ok) throw new Error('Invalid token');
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/profile/me`);
        if (!response.ok) {
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Invalid server response');
            }
            throw new Error(data.error || 'Failed to fetch profile');
        }
        const data = await response.json();
        
        // ✅ تخزين البيانات في المتغير العام
        currentUserProfileData = data;
        
        document.getElementById('portfolioName').value = DOMPurify.sanitize(data.profile.portfolioName || 'Portfolio');
        document.getElementById('portfolio-name').textContent = DOMPurify.sanitize(data.profile.portfolioName || 'Portfolio');
        document.getElementById('nickname').value = DOMPurify.sanitize(data.profile.nickname || '');
        document.getElementById('jobTitle').value = DOMPurify.sanitize(data.profile.jobTitle || '');
        document.getElementById('bio').value = DOMPurify.sanitize(data.profile.bio || '');
        document.getElementById('phone').value = DOMPurify.sanitize(data.profile.phone || '');
        document.getElementById('isPublic').value = DOMPurify.sanitize(data.profile.isPublic.toString());
        document.getElementById('status').value = DOMPurify.sanitize(data.profile.status || 'Available');
        document.getElementById('social-linkedin').value = DOMPurify.sanitize(data.profile.socialLinks?.linkedin || '');
        document.getElementById('social-behance').value = DOMPurify.sanitize(data.profile.socialLinks?.behance || '');
        document.getElementById('social-github').value = DOMPurify.sanitize(data.profile.socialLinks?.github || '');
        document.getElementById('social-whatsapp').value = DOMPurify.sanitize(data.profile.socialLinks?.whatsapp || '');
        document.getElementById('avatarDisplayType').value = DOMPurify.sanitize(data.profile.avatarDisplayType || 'normal');
        document.getElementById('svgColor').value = DOMPurify.sanitize(data.profile.svgColor || '#000000');
        document.getElementById('pdfFormat').value = DOMPurify.sanitize(data.profile.pdfFormat || 'jspdf');
        document.getElementById('pushNotifications').checked = data.profile.pushNotifications || false;
        toggleSvgColorField();
        if (data.profile.avatar) {
            const avatarPreview = document.createElement('img');
            avatarPreview.src = data.profile.avatar;
            avatarPreview.className = 'w-24 h-24 rounded-full mt-2';
            avatarPreview.onerror = () => {
                avatarPreview.src = '/assets/img/default-avatar.png';
                Toastify({
                    text: 'Failed to load profile picture, using default image.',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
            };
            const avatarInput = document.getElementById('avatar');
            const existingPreview = avatarInput?.parentElement.querySelector('img');
            if (existingPreview) existingPreview.remove();
            avatarInput?.after(avatarPreview);
        }
        if (data.hasTransparency) {
            document.getElementById('avatar-suggestion').classList.remove('hidden');
            document.getElementById('avatar-suggestion').textContent = 'Current image has a transparent background. Recommended to use "Inside SVG" for custom shapes and colors.';
        } else if (data.profile.avatar) {
            document.getElementById('avatar-suggestion').classList.remove('hidden');
            document.getElementById('avatar-suggestion').textContent = 'Current image has a background. Recommended to use "Normal Image" for best display.';
        }
        const educationContainer = document.getElementById('education-fields');
        educationContainer.innerHTML = '';
        data.profile.education?.forEach(edu => {
            addDynamicField('education-fields', `
                <input type="text" name="institution" placeholder="Institution" value="${edu.institution || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="degree" placeholder="Degree" value="${edu.degree || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="year" placeholder="Year" value="${edu.year || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const experienceContainer = document.getElementById('experience-fields');
        experienceContainer.innerHTML = '';
        data.profile.experience?.forEach(exp => {
            addDynamicField('experience-fields', `
                <input type="text" name="company" placeholder="Company" value="${exp.company || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="role" placeholder="Role" value="${exp.role || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="duration" placeholder="Duration" value="${exp.duration || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const certificateContainer = document.getElementById('certificate-fields');
        certificateContainer.innerHTML = '';
        data.profile.certificates?.forEach(cert => {
            addDynamicField('certificate-fields', `
                <input type="text" name="name" placeholder="Certificate Name" value="${cert.name || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="issuer" placeholder="Issuer" value="${cert.issuer || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="year" placeholder="Year" value="${cert.year || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const skillContainer = document.getElementById('skill-fields');
        skillContainer.innerHTML = '';
        data.profile.skills?.forEach(skill => {
            addDynamicField('skill-fields', `
                <input type="text" name="name" placeholder="Skill Name" value="${skill.name || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="number" name="percentage" placeholder="Percentage (0-100)" value="${skill.percentage || 0}" min="0" max="100" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const projectContainer = document.getElementById('project-fields');
        projectContainer.innerHTML = '';
        data.profile.projects?.forEach(project => {
            const field = document.createElement('div');
            field.className = 'dynamic-field';
            field.innerHTML = `
                <input type="checkbox" name="isPrivate" ${project.isPrivate ? 'checked' : ''} class="mb-2"> <label>Private Link</label>
                <input type="text" name="title" placeholder="Project Title" value="${project.title || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <textarea name="description" placeholder="Project Description" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" rows="3">${project.description || ''}</textarea>
                <input type="file" name="image" accept="image/jpeg,image/png" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-image add-btn">Remove Image</button>
                <input type="text" name="rating" placeholder="Rating (e.g., Good)" value="${project.rating || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="number" name="stars" placeholder="Stars (0-5)" value="${project.stars || 0}" min="0" max="5" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <div class="link-fields">
                    ${project.links?.map(link => `
                        <div class="link-field">
                            <input type="text" name="option" placeholder="Link Name (e.g., Demo)" value="${link.option || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                            <input type="url" name="value" placeholder="Link (e.g., https://example.com)" value="${link.value || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                            <button type="button" class="remove-link add-btn">Remove Link</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="add-link add-btn">Add Link</button>
                <button type="button" class="preview-project add-btn">Preview Project</button>
                <button type="button" class="remove-field add-btn">Remove Project</button>
            `;
            projectContainer.appendChild(field);
            if (project.image) {
                const imgPreview = document.createElement('img');
                imgPreview.src = project.image;
                imgPreview.className = 'w-24 h-24 rounded mt-2';
                imgPreview.onerror = () => {
                    imgPreview.src = '/assets/img/default-project.png';
                    Toastify({
                        text: 'Failed to load project image, using default image.',
                        duration: 3000,
                        style: { background: '#ef4444' }
                    }).showToast();
                };
                field.querySelector('[name="image"]').after(imgPreview);
            }
            field.querySelector('[name="image"]').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const imgPreview = field.querySelector('img') || document.createElement('img');
                    imgPreview.src = URL.createObjectURL(file);
                    imgPreview.className = 'w-24 h-24 rounded mt-2';
                    e.target.after(imgPreview);
                }
            });
            field.querySelector('.remove-field').addEventListener('click', () => field.remove());
            field.querySelector('.add-link').addEventListener('click', () => {
                const linkContainer = field.querySelector('.link-fields');
                const newLink = document.createElement('div');
                newLink.className = 'link-field';
                newLink.innerHTML = `
                    <input type="text" name="option" placeholder="Link Name (e.g., Demo)" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <input type="url" name="value" placeholder="Link (e.g., https://example.com)" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <button type="button" class="remove-link add-btn">Remove Link</button>
                `;
                linkContainer.appendChild(newLink);
                newLink.querySelector('.remove-link').addEventListener('click', () => newLink.remove());
            });
            field.querySelector('.remove-image')?.addEventListener('click', () => {
                const imageInput = field.querySelector('[name="image"]');
                imageInput.value = '';
                const imgPreview = field.querySelector('img');
                if (imgPreview) imgPreview.remove();
            });
            field.querySelector('.preview-project').addEventListener('click', () => {
                const projectData = {
                    title: field.querySelector('[name="title"]').value.trim(),
                    description: field.querySelector('[name="description"]').value.trim(),
                    image: field.querySelector('[name="image"]').files[0],
                    rating: field.querySelector('[name="rating"]').value.trim(),
                    stars: parseInt(field.querySelector('[name="stars"]').value) || 0,
                    links: []
                };
                field.querySelectorAll('.link-fields .link-field').forEach(link => {
                    const option = link.querySelector('[name="option"]').value.trim();
                    const value = link.querySelector('[name="value"]').value.trim();
                    if (option && value) {
                        projectData.links.push({ option, value });
                    }
                });
                const previewContent = document.getElementById('preview-content');
                previewContent.innerHTML = `
                    <div class="work__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(projectData.title)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(projectData.description)}</p>
                        ${projectData.image ? `<img src="${URL.createObjectURL(projectData.image)}" class="w-full h-48 object-cover rounded-lg mt-2" />` : ''}
                        <p class="text-gray-600 dark:text-gray-400">Rating: ${DOMPurify.sanitize(projectData.rating)}</p>
                        <p class="text-gray-600 dark:text-gray-400">Stars: ${'★'.repeat(projectData.stars)}</p>
                        <div class="flex space-x-2 mt-2">
                            ${projectData.links?.map(link => `
                                <a href="${DOMPurify.sanitize(link.value)}" target="_blank" class="text-blue-500 hover:underline">${DOMPurify.sanitize(link.option)}</a>
                            `).join('') || ''}
                        </div>
                    </div>
                `;
                document.getElementById('preview-modal').classList.remove('hidden');
            });
        });
        const githubContainer = document.getElementById('github-fields');
        githubContainer.innerHTML = '';
        data.profile.githubRepos?.forEach(repo => {
            addDynamicField('github-fields', `
                <input type="text" name="githubProjectId" placeholder="GitHub Project ID" value="${repo.id || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const customFieldsContainer = document.getElementById('custom-fields');
        customFieldsContainer.innerHTML = '';
        data.profile.customFields?.forEach(field => {
            addDynamicField('custom-fields', `
                <input type="text" name="name" placeholder="Field Name (e.g., Awards)" value="${field.name || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="text" name="value" placeholder="Field Value" value="${field.value || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        const interestContainer = document.getElementById('interest-fields');
        interestContainer.innerHTML = '';
        data.profile.interests?.forEach(interest => {
            addDynamicField('interest-fields', `
                <input type="text" name="interest" placeholder="Interest" value="${interest || ''}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        return data;
    } catch (error) {
        console.error('Error loading profile:', error);
        Toastify({
            text: `Error loading profile: ${error.message}. Try refreshing the page.`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
        return null;
    }
}

// Sidebar navigation
document.querySelectorAll('.sidebar-btn').forEach(button => {
    button.addEventListener('click', () => {
        const section = button.dataset.section;
        document.querySelectorAll('.settings-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(section).classList.remove('hidden');
        document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
        button.classList.add('bg-gray-200', 'dark:bg-gray-700');
    });
});

// Preview profile
document.getElementById('preview-profile')?.addEventListener('click', async () => {
    const formData = collectFormData();
    const previewContent = document.getElementById('preview-content');
    previewContent.innerHTML = `
        <div class="container">
            <h1 class="text-xl md:text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Profile Preview</h1>
            <div class="home__data">
                <h1 class="home__title">Hi, I'm <span class="home__title-color">${DOMPurify.sanitize(formData.nickname)}</span></h1>
                <h2 class="home__title">${DOMPurify.sanitize(formData.jobTitle)}</h2>
                <p class="home__subtitle">${DOMPurify.sanitize(formData.bio)}</p>
                <p class="home__subtitle">Status: ${DOMPurify.sanitize(formData.status)}</p>
                ${formData.avatar ? `<img src="${URL.createObjectURL(formData.avatar)}" class="w-24 h-24 rounded-full object-cover ${formData.avatarDisplayType === 'svg' ? 'svg-avatar' : ''}" style="background-color: ${formData.avatarDisplayType === 'svg' ? DOMPurify.sanitize(formData.svgColor) : 'transparent'}" />` : ''}
                <div class="home__social">
                    ${Object.entries(formData.socialLinks).map(([platform, url]) => url ? `<a href="${DOMPurify.sanitize(url)}" target="_blank" class="home__social-icon bx bxl-${platform} text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-500"></a>` : '').join('')}
                </div>
            </div>
            <div class="container">
                <h2 class="section-title">Education</h2>
                ${formData.education.length ? formData.education.map(edu => `
                    <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(edu.institution)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(edu.degree)}</p>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(edu.year)}</p>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No education listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Experience</h2>
                ${formData.experience.length ? formData.experience.map(exp => `
                    <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(exp.company)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(exp.role)}</p>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(exp.duration)}</p>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No experience listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Certificates</h2>
                ${formData.certificates.length ? formData.certificates.map(cert => `
                    <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(cert.name)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(cert.issuer)}</p>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(cert.year)}</p>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No certificates listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Skills</h2>
                ${formData.skills.length ? formData.skills.map(skill => `
                    <div class="skills__data bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(skill.name)}</h4>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div class="bg-blue-500 h-2.5 rounded-full" style="width: ${skill.percentage}%"></div>
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No skills listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Projects</h2>
                ${formData.projects.length ? formData.projects.map((project, index) => `
                    <div class="work__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(project.title)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(project.description)}</p>
                        ${formData.projectImages[index] ? `<img src="${URL.createObjectURL(formData.projectImages[index])}" class="w-full h-48 object-cover rounded-lg mt-2" />` : ''}
                        <p class="text-gray-600 dark:text-gray-400">Rating: ${DOMPurify.sanitize(project.rating)}</p>
                        <p class="text-gray-600 dark:text-gray-400">Stars: ${'★'.repeat(project.stars)}</p>
                        <div class="flex space-x-2 mt-2">
                            ${project.links?.map(link => `
                                <a href="${DOMPurify.sanitize(link.value)}" target="_blank" class="text-blue-500 hover:underline">${DOMPurify.sanitize(link.option)}</a>
                            `).join('') || ''}
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No projects listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">GitHub Repositories</h2>
                ${formData.githubRepos.length ? formData.githubRepos.map(repo => `
                    <div class="work__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(repo.name)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(repo.description)}</p>
                        ${repo.image ? `<img src="${DOMPurify.sanitize(repo.image)}" class="w-full h-48 object-cover rounded-lg mt-2" />` : ''}
                        <a href="${DOMPurify.sanitize(repo.url)}" target="_blank" class="text-blue-500 hover:underline">View on GitHub</a>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No GitHub repositories listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Custom Fields</h2>
                ${formData.customFields.length ? formData.customFields.map(field => `
                    <div class="about__item bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
                        <h4 class="font-semibold">${DOMPurify.sanitize(field.name)}</h4>
                        <p class="text-gray-600 dark:text-gray-400">${DOMPurify.sanitize(field.value)}</p>
                    </div>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No custom fields listed.</p>'}
            </div>
            <div class="container">
                <h2 class="section-title">Interests</h2>
                ${formData.interests.length ? formData.interests.map(interest => `
                    <span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded mr-2">${DOMPurify.sanitize(interest)}</span>
                `).join('') : '<p class="text-gray-600 dark:text-gray-400">No interests listed.</p>'}
            </div>
        </div>
    `;
    document.getElementById('preview-modal').classList.remove('hidden');
});


function collectFormData() {
    const formData = {
        portfolioName: document.getElementById('portfolioName').value.trim(),
        nickname: document.getElementById('nickname').value.trim(),
        jobTitle: document.getElementById('jobTitle').value.trim(),
        bio: document.getElementById('bio').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        isPublic: document.getElementById('isPublic').value,
        status: document.getElementById('status').value,
        pushNotifications: document.getElementById('pushNotifications').checked,
        socialLinks: {
            linkedin: document.getElementById('social-linkedin').value.trim(),
            behance: document.getElementById('social-behance').value.trim(),
            github: document.getElementById('social-github').value.trim(),
            whatsapp: document.getElementById('social-whatsapp').value.trim()
        },
        avatar: document.getElementById('avatar').files[0],
        avatarDisplayType: document.getElementById('avatarDisplayType').value,
        svgColor: document.getElementById('svgColor').value,
        pdfFormat: document.getElementById('pdfFormat').value,
        education: [],
        experience: [],
        certificates: [],
        skills: [],
        projects: [],
        projectImages: [],
        githubRepos: [],
        customFields: [],
        interests: []
    };

    document.querySelectorAll('#education-fields .dynamic-field').forEach(field => {
        const institution = field.querySelector('[name="institution"]').value.trim();
        const degree = field.querySelector('[name="degree"]').value.trim();
        const year = field.querySelector('[name="year"]').value.trim();
        if (institution && degree && year) {
            formData.education.push({ institution, degree, year });
        }
    });

    document.querySelectorAll('#experience-fields .dynamic-field').forEach(field => {
        const company = field.querySelector('[name="company"]').value.trim();
        const role = field.querySelector('[name="role"]').value.trim();
        const duration = field.querySelector('[name="duration"]').value.trim();
        if (company && role && duration) {
            formData.experience.push({ company, role, duration });
        }
    });

    document.querySelectorAll('#certificate-fields .dynamic-field').forEach(field => {
        const name = field.querySelector('[name="name"]').value.trim();
        const issuer = field.querySelector('[name="issuer"]').value.trim();
        const year = field.querySelector('[name="year"]').value.trim();
        if (name && issuer && year) {
            formData.certificates.push({ name, issuer, year });
        }
    });

    document.querySelectorAll('#skill-fields .dynamic-field').forEach(field => {
        const name = field.querySelector('[name="name"]').value.trim();
        const percentage = parseInt(field.querySelector('[name="percentage"]').value);
        if (name && !isNaN(percentage)) {
            formData.skills.push({ name, percentage });
        }
    });

    document.querySelectorAll('#project-fields .dynamic-field').forEach((field, index) => {
        const isPrivate = field.querySelector('[name="isPrivate"]').checked;
        const title = field.querySelector('[name="title"]').value.trim();
        const description = field.querySelector('[name="description"]').value.trim();
        const image = field.querySelector('[name="image"]').files[0];
        const rating = field.querySelector('[name="rating"]').value.trim();
        const stars = parseInt(field.querySelector('[name="stars"]').value);
        const links = [];
        field.querySelectorAll('.link-fields .link-field').forEach(link => {
            const option = link.querySelector('[name="option"]').value.trim();
            const value = link.querySelector('[name="value"]').value.trim();
            if (option && value) {
                links.push({ option, value });
            }
        });
        if (title && description && rating && !isNaN(stars)) {
            formData.projects.push({ isPrivate, title, description, links, rating, stars });
            if (image) formData.projectImages.push(image);
        }
    });

    document.querySelectorAll('#github-fields .dynamic-field').forEach(field => {
        const githubProjectId = field.querySelector('[name="githubProjectId"]').value.trim();
        if (githubProjectId) {
            formData.githubRepos.push({ id: githubProjectId });
        }
    });

    document.querySelectorAll('#custom-fields .dynamic-field').forEach(field => {
        const name = field.querySelector('[name="name"]').value.trim();
        const value = field.querySelector('[name="value"]').value.trim();
        if (name && value) {
            formData.customFields.push({ name, value });
        }
    });

    document.querySelectorAll('#interest-fields .dynamic-field').forEach(field => {
        const interest = field.querySelector('[name="interest"]').value.trim();
        if (interest) formData.interests.push(interest);
    });

    return formData;
}

// Handle preview modal buttons
document.getElementById('edit-profile')?.addEventListener('click', () => {
    document.getElementById('preview-modal').classList.add('hidden');
});

document.getElementById('confirm-save')?.addEventListener('click', async () => {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('profile-form').dispatchEvent(new Event('submit'));
});

// Sync GitHub repos
document.getElementById('sync-github')?.addEventListener('click', async () => {
    try {
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/github/repos`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to sync GitHub repositories');
        const repos = await response.json();
        const githubContainer = document.getElementById('github-fields');
        githubContainer.innerHTML = '';
        repos.forEach(repo => {
            addDynamicField('github-fields', `
                <input type="text" name="githubProjectId" placeholder="GitHub Project ID" value="${repo.id}" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-field add-btn">Remove</button>
            `);
        });
        Toastify({
            text: 'GitHub repositories synced successfully',
            duration: 3000,
            style: { background: '#10b981' }
        }).showToast();
    } catch (error) {
        console.error('Error syncing GitHub repos:', error);
        Toastify({
            text: `Error syncing GitHub repos: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
});

// ✅ تحسين دالة handleProfileSubmit - استخدام البيانات المخزنة بدل طلب جديد
async function handleProfileSubmit(e) {
    e.preventDefault();
    const formData = new FormData();
    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    try {
        const csrfToken = await fetchCsrfToken();
        if (!csrfToken) throw new Error('Failed to fetch CSRF token');
        formData.append('_csrf', csrfToken);
        const portfolioName = document.getElementById('portfolioName').value.trim();
        const nickname = document.getElementById('nickname').value.trim();
        const jobTitle = document.getElementById('jobTitle').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const isPublic = document.getElementById('isPublic').value;
        const socialLinks = {
            linkedin: document.getElementById('social-linkedin').value.trim(),
            behance: document.getElementById('social-behance').value.trim(),
            github: document.getElementById('social-github').value.trim(),
            whatsapp: document.getElementById('social-whatsapp').value.trim()
        };
        const avatarDisplayType = document.getElementById('avatarDisplayType').value;
        const svgColor = document.getElementById('svgColor').value;
        const pdfFormat = document.getElementById('pdfFormat').value;
        if (!nickname || !jobTitle || !bio) {
            Toastify({
                text: 'Nickname, job title, and bio are required.',
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
            return;
        }
        
        // ✅ استخدام البيانات المخزنة بدلاً من طلب جديد
        const currentNickname = currentUserProfileData?.profile?.nickname;
        
        if (nickname && nickname !== currentNickname) {
            const nicknameResponse = await fetchWithRefresh(`${cleanApiUrl}/api/check-nickname?nickname=${encodeURIComponent(nickname)}`);
            const nicknameData = await nicknameResponse.json();
            if (!nicknameData.available) {
                Toastify({
                    text: 'Nickname is already in use. Please choose another.',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
                return;
            }
        }
        const isValidPhone = (phone) => !phone || /^\+?[1-9]\d{1,14}$/.test(phone);
        if (!isValidPhone(phone)) {
            Toastify({
                text: 'Invalid phone number (e.g., +1234567890).',
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
            return;
        }
        const isValidUrl = (url) => {
            if (!url) return true;
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        };
        for (const [key, url] of Object.entries(socialLinks)) {
            if (url && !isValidUrl(url)) {
                Toastify({
                    text: `Invalid ${key} URL.`,
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
                return;
            }
        }
        formData.append('portfolioName', portfolioName);
        formData.append('nickname', nickname);
        formData.append('jobTitle', jobTitle);
        formData.append('bio', bio);
        formData.append('phone', phone);
        formData.append('isPublic', isPublic);
        formData.append('socialLinks', JSON.stringify(socialLinks));
        formData.append('avatarDisplayType', avatarDisplayType);
        formData.append('svgColor', svgColor);
        formData.append('pdfFormat', pdfFormat);
        const avatarFile = document.getElementById('avatar').files[0];
        if (avatarFile) {
            const maxSize = 5 * 1024 * 1024;
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(avatarFile.type)) {
                Toastify({
                    text: 'Only JPEG or PNG images are allowed for profile picture.',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
                return;
            }
            if (avatarFile.size > maxSize) {
                Toastify({
                    text: 'Profile picture size exceeds 5MB.',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
                return;
            }
            formData.append('avatar', avatarFile);
        }
        const education = [];
        let educationValid = true;
        document.querySelectorAll('#education-fields .dynamic-field').forEach(field => {
            const institution = field.querySelector('[name="institution"]').value.trim();
            const degree = field.querySelector('[name="degree"]').value.trim();
            const year = field.querySelector('[name="year"]').value.trim();
            if (institution || degree || year) {
                if (!institution || !degree || !year || isNaN(parseInt(year)) || parseInt(year) < 1900 || parseInt(year) > new Date().getFullYear()) {
                    educationValid = false;
                    Toastify({
                        text: 'All education fields (institution, degree, year) are required and year must be valid.',
                        duration: 3000,
                        style: { background: '#ef4444' }
                    }).showToast();
                    return;
                }
                education.push({ institution, degree, year });
            }
        });
        if (!educationValid) return;
        const experience = [];
        document.querySelectorAll('#experience-fields .dynamic-field').forEach(field => {
            const company = field.querySelector('[name="company"]').value.trim();
            const role = field.querySelector('[name="role"]').value.trim();
            const duration = field.querySelector('[name="duration"]').value.trim();
            if (company && role && duration) {
                experience.push({ company, role, duration });
            }
        });
        const certificates = [];
        document.querySelectorAll('#certificate-fields .dynamic-field').forEach(field => {
            const name = field.querySelector('[name="name"]').value.trim();
            const issuer = field.querySelector('[name="issuer"]').value.trim();
            const year = field.querySelector('[name="year"]').value.trim();
            if (name && issuer && year && !isNaN(parseInt(year)) && parseInt(year) >= 1900 && parseInt(year) <= new Date().getFullYear()) {
                certificates.push({ name, issuer, year });
            }
        });
        const skills = [];
        document.querySelectorAll('#skill-fields .dynamic-field').forEach(field => {
            const name = field.querySelector('[name="name"]').value.trim();
            const percentage = parseInt(field.querySelector('[name="percentage"]').value);
            if (name && !isNaN(percentage) && percentage >= 0 && percentage <= 100) {
                skills.push({ name, percentage });
            }
        });
        const projects = [];
        let hasInvalidUrl = false;
        document.querySelectorAll('#project-fields .dynamic-field').forEach((field, index) => {
            const isPrivate = field.querySelector('[name="isPrivate"]').checked;
            const title = field.querySelector('[name="title"]').value.trim();
            const description = field.querySelector('[name="description"]').value.trim();
            const imageFile = field.querySelector('[name="image"]').files[0];
            const rating = field.querySelector('[name="rating"]').value.trim();
            const stars = parseInt(field.querySelector('[name="stars"]').value);
            const links = [];
            field.querySelectorAll('.link-fields .link-field').forEach(link => {
                const option = link.querySelector('[name="option"]').value.trim();
                const value = link.querySelector('[name="value"]').value.trim();
                if (option && value) {
                    if (isValidUrl(value)) {
                        links.push({ option, value });
                    } else {
                        hasInvalidUrl = true;
                    }
                }
            });
            if (hasInvalidUrl) return;
            if (title && description && rating && !isNaN(stars) && stars >= 0 && stars <= 5) {
                projects.push({ isPrivate, title, description, links, rating, stars });
                if (imageFile) {
                    const maxSize = 5 * 1024 * 1024;
                    const allowedTypes = ['image/jpeg', 'image/png'];
                    if (!allowedTypes.includes(imageFile.type)) {
                        hasInvalidUrl = true;
                        Toastify({
                            text: `Only JPEG or PNG images are allowed for project ${index + 1}.`,
                            duration: 3000,
                            style: { background: '#ef4444' }
                        }).showToast();
                        return;
                    }
                    if (imageFile.size > maxSize) {
                        hasInvalidUrl = true;
                        Toastify({
                            text: `Project ${index + 1} image size exceeds 5MB.`,
                            duration: 3000,
                            style: { background: '#ef4444' }
                        }).showToast();
                        return;
                    }
                    formData.append(`projectImages[${index}]`, imageFile);
                }
            }
        });
        if (hasInvalidUrl) {
            Toastify({
                text: 'Invalid URL in project links or invalid image.',
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
            return;
        }
        const interests = [];
        document.querySelectorAll('#interest-fields .dynamic-field').forEach(field => {
            const interest = field.querySelector('[name="interest"]').value.trim();
            if (interest) interests.push(interest);
        });
        formData.append('education', JSON.stringify(education));
        formData.append('experience', JSON.stringify(experience));
        formData.append('certificates', JSON.stringify(certificates));
        formData.append('skills', JSON.stringify(skills));
        formData.append('projects', JSON.stringify(projects));
        formData.append('interests', JSON.stringify(interests));
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/profile`, {
            method: 'PUT',
            headers: { 'X-CSRF-Token': csrfToken },
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update profile');
        
        // ✅ تحديث البيانات المخزنة بعد الحفظ الناجح
        if (data.profile) {
            currentUserProfileData = { ...currentUserProfileData, profile: data.profile };
        } else {
            // لو الـ API ما رجعش البروفايل الكامل، نطلبه مرة واحدة بس
            const refreshResponse = await fetchWithRefresh(`${cleanApiUrl}/api/profile/me`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                currentUserProfileData = refreshData;
            }
        }
        
        if (data.hasTransparency) {
            document.getElementById('avatar-suggestion').classList.remove('hidden');
            document.getElementById('avatar-suggestion').textContent = 'Image contains transparent background. Recommended to use "Inside SVG" for custom shapes and colors.';
            document.getElementById('avatarDisplayType').value = 'svg';
            toggleSvgColorField();
        } else if (avatarFile) {
            document.getElementById('avatar-suggestion').classList.remove('hidden');
            document.getElementById('avatar-suggestion').textContent = 'Image contains a background. Recommended to use "Normal Image" for best display.';
            document.getElementById('avatarDisplayType').value = 'normal';
            toggleSvgColorField();
        }
        Toastify({
            text: 'Profile updated successfully!',
            duration: 3000,
            style: { background: '#10b981' }
        }).showToast();
        setTimeout(() => window.location.href = `/profile/${data.profile.nickname}`, 2000);
    } catch (error) {
        console.error('Error updating profile:', error);
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('CSRF')) {
            errorMessage = 'CSRF token validation failed. Please refresh the page.';
        }
        Toastify({
            text: `Error updating profile: ${errorMessage}`,
            duration: 5000,
            style: { background: '#ef4444' }
        }).showToast();
    } finally {
        loader.style.display = 'none';
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    try {
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/delete-account`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': await fetchCsrfToken() }
        });
        if (response.ok) {
            Toastify({
                text: 'Account deleted successfully.',
                duration: 3000,
                style: { background: '#10b981' }
            }).showToast();
            localStorage.removeItem('userToken');
            localStorage.removeItem('refreshToken');
            userToken = null;
            window.location.href = '/';
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete account');
        }
    } catch (error) {
        Toastify({
            text: `Error deleting account: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
}

async function loadSocialMedia() {
    if (!userToken) return;
    const socialMediaContainer = document.createElement('div');
    socialMediaContainer.className = 'mb-4';
    socialMediaContainer.innerHTML = `
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Social Media Accounts</h2>
        <div class="mb-2">
            <button type="button" id="link-facebook" class="add-btn w-full p-2.5 text-sm">Link Facebook Account</button>
            <div id="facebook-posts" class="mt-2"></div>
        </div>
        <div class="mb-2">
            <button type="button" id="link-github" class="add-btn w-full p-2.5 text-sm">Link GitHub Account</button>
            <div id="github-repos" class="mt-2"></div>
        </div>
    `;
    document.getElementById('profile-form')?.insertBefore(socialMediaContainer, document.getElementById('education-fields')?.parentElement);
    document.getElementById('link-facebook')?.addEventListener('click', () => {
        window.location.href = `${cleanApiUrl}/api/auth/facebook`;
    });
    document.getElementById('link-github')?.addEventListener('click', () => {
        window.location.href = `${cleanApiUrl}/api/auth/github`;
    });
    try {
        const facebookResponse = await fetchWithRefresh(`${cleanApiUrl}/api/facebook/posts`);
        if (facebookResponse.ok) {
            const data = await facebookResponse.json();
            const facebookContainer = document.getElementById('facebook-posts');
            facebookContainer.innerHTML = data.posts.length ? data.posts.map(post => `
                <div class="comment p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4">
                    <p><strong>Post:</strong> ${post.message}</p>
                    <p><strong>Likes:</strong> ${post.likes}</p>
                    <p><strong>Comments:</strong> ${post.comments}</p>
                    <p><strong>Shares:</strong> ${post.shares}</p>
                    <p><strong>Posted:</strong> ${new Date(post.created_time).toLocaleString()}</p>
                </div>
            `).join('') : '<p class="text-gray-600 dark:text-gray-400">No Facebook posts available.</p>';
        } else {
            document.getElementById('facebook-posts').innerHTML = '<p class="text-gray-600 dark:text-gray-400">Please link your Facebook account to view posts.</p>';
        }
    } catch (error) {
        console.error('Error loading Facebook posts:', error);
        document.getElementById('facebook-posts').innerHTML = '<p class="text-red-500">Error loading Facebook posts.</p>';
    }
    try {
        const githubResponse = await fetchWithRefresh(`${cleanApiUrl}/api/github/repos`);
        if (githubResponse.ok) {
            const data = await githubResponse.json();
            const githubContainer = document.getElementById('github-repos');
            githubContainer.innerHTML = data.length ? data.map(repo => `
                <div class="comment p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4">
                    <p><strong>Repository:</strong> ${repo.name}</p>
                    <p><strong>Description:</strong> ${repo.description || 'Not available'}</p>
                    <p><a href="${repo.url}" target="_blank" class="text-blue-500 hover:underline">View on GitHub</a></p>
                </div>
            `).join('') : '<p class="text-gray-600 dark:text-gray-400">No GitHub repositories available.</p>';
        } else {
            document.getElementById('github-repos').innerHTML = '<p class="text-gray-600 dark:text-gray-400">Please link your GitHub account to view repositories.</p>';
        }
    } catch (error) {
        console.error('Error loading GitHub repos:', error);
        document.getElementById('github-repos').innerHTML = '<p class="text-red-500">Error loading GitHub repositories.</p>';
    }
}

async function loadInteractions() {
    const interactionsContainer = document.getElementById('profile-interactions');
    if (!userToken) {
        interactionsContainer.innerHTML = '<p class="error">Please <a href="/login.html?reason=interactions" class="text-blue-500 hover:underline">log in</a> to view interactions.</p>';
        return;
    }
    try {
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/user-interactions`);
        if (!response.ok) throw new Error('Failed to fetch interactions');
        const comments = await response.json();
        interactionsContainer.innerHTML = comments.length ? comments.map(comment => `
            <div class="comment p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4">
                <strong>Project: ${comment.projectId?.title || 'Unknown'}</strong>
                <p>Rating: ${'★'.repeat(comment.rating)}</p>
                <p>Comment: ${comment.text}</p>
                ${comment.replies.map(reply => `<div class="reply">Admin: ${reply.text} (${new Date(reply.timestamp).toLocaleString()})</div>`).join('')}
            </div>
        `).join('') : '<p class="text-gray-600 dark:text-gray-400">No interactions yet.</p>';
    } catch (error) {
        console.error('Error loading interactions:', error);
        Toastify({
            text: `Error loading interactions: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
}

async function createCanvaDesign() {
    try {
        const response = await fetchWithRefresh(`${cleanApiUrl}/api/profile/canva`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': await fetchCsrfToken() }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to create Canva design');
        window.open(data.designUrl, '_blank');
        Toastify({
            text: 'Opening Canva editor...',
            duration: 3000,
            style: { background: '#10b981' }
        }).showToast();
    } catch (error) {
        Toastify({
            text: `Error: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
}

async function loadTranslations(lang) {
    if (translations[lang]) return translations[lang];
    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) throw new Error(`Failed to load translations for ${lang}`);
        translations[lang] = await response.json();
        return translations[lang];
    } catch (error) {
        console.error(`Error loading translations for ${lang}:`, error);
        Toastify({
            text: `Error loading translations: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
}

async function loadFooter() {
    try {
        const response = await fetch('/assets/js/templates/footer.html');
        if (!response.ok) throw new Error('Failed to load footer');
        const footerHtml = await response.text();
        document.querySelector('footer')?.remove();
        document.body.insertAdjacentHTML('beforeend', footerHtml);
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

function updateFooterContent(lang) {
    const translation = translations[lang];
    if (!translation) return;
    const footerCompanyDesc = document.getElementById('footer-company-desc');
    const footerRightsReserved = document.getElementById('footer-rights-reserved');
    const contactTitle = document.getElementById('contact-title');
    const resourcesTitle = document.getElementById('resources-title');
    const supportTitle = document.getElementById('support-title');
    const aboutTitle = document.getElementById('about-title');
    const mediaTitle = document.getElementById('media-title');
    const footerCards = Array.from(document.querySelectorAll('.footer-card'));
    if (footerCompanyDesc) footerCompanyDesc.textContent = translation.footer.companyDesc;
    if (footerRightsReserved) footerRightsReserved.textContent = translation.footer.rightsReserved;
    if (contactTitle) contactTitle.textContent = translation.footer.contact;
    if (resourcesTitle) resourcesTitle.textContent = translation.footer.resources;
    if (supportTitle) supportTitle.textContent = translation.footer.support;
    if (aboutTitle) aboutTitle.textContent = translation.footer.about;
    if (mediaTitle) mediaTitle.textContent = translation.footer.media;
    footerCards.forEach(card => {
        const detailsId = card.getAttribute('data-details');
        const titleId = card.querySelector('[id$="-title"]')?.id;
        const descId = card.querySelector('[id$="-desc"]')?.id;
        const detailsElement = card.querySelector('[id$="-details"]');
        if (titleId) card.querySelector(`#${titleId}`).textContent = translation.footer[titleId.replace('-title', '')];
        if (descId) card.querySelector(`#${descId}`).textContent = translation.footer[descId.replace('-desc', '_desc')];
        if (detailsElement) detailsElement.textContent = translation.footer[detailsId.replace('-details', '_details')];
        card.addEventListener('click', (e) => {
            if (detailsId.startsWith('dynamic-')) {
                window.location.href = `/article/${detailsId.replace('dynamic-', '')}.html`;
            } else {
                document.getElementById('modal-title').textContent = translation.footer[detailsId.replace('-details', '')];
                document.getElementById('modal-details').textContent = translation.footer[detailsId.replace('-details', '_details')];
                document.getElementById('footer-modal').classList.add('show');
            }
            e.stopPropagation();
        });
    });
}

async function loadArticles() {
    try {
        const response = await fetch('/api/articles?limit=5');
        if (!response.ok) throw new Error('Failed to fetch articles');
        const articles = await response.json();
        const mediaSection = document.getElementById('media-section');
        if (mediaSection) {
            mediaSection.innerHTML = articles.map(article => `
                <div class="footer-card bg-gray-700 p-6 rounded-lg shadow-lg hover:bg-gray-600 transition-all duration-300 cursor-pointer" data-details="dynamic-${article.slug}">
                    <div class="flex justify-center mb-4"><i class="bx bx-news text-4xl text-red-400"></i></div>
                    <h4>${article.title}</h4>
                    <p>${article.metaDescription.substring(0, 100)}...</p>
                </div>
            `).join('');
            document.querySelectorAll('.footer-card[data-details^="dynamic-"]').forEach(card => {
                card.addEventListener('click', () => {
                    window.location.href = `/article/${card.dataset.details.replace('dynamic-', '')}.html`;
                });
            });
        }
    } catch (error) {
        console.error('Error fetching articles:', error);
        Toastify({
            text: `Error fetching articles: ${error.message}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }
}

async function updateVisitCount() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/visits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to update visit count');
        const data = await response.json();
        const visitCountEl = document.querySelector('visit-count');
        if (visitCountEl) visitCountEl.textContent = data.visitCount;
    } catch (error) {
        console.error('Error updating visit count:', error);
    }
}


function updatePageContent(lang) {
    const translation = translations[lang];
    if (!translation) return;
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const keys = key.split('.');
        let value = translation;
        for (const k of keys) {
            value = value?.[k];
        }
        if (value) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = value;
            } else if (element.tagName === 'LABEL' || element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'BUTTON') {
                element.textContent = value;
            } else {
                element.innerHTML = value;
            }
        }
    });
}


function scrollActive() {
    const scrollY = window.pageYOffset;
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(current => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 50;
        const sectionId = current.getAttribute('id');
        const navLink = document.querySelector(`.nav__menu a[href*="${sectionId}"]`);
        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('active');
            } else {
                navLink.classList.remove('active');
            }
        }
    });
}

function updateNavContent(lang) {
    const translation = translations[lang];
    if (!translation) return;
    document.querySelectorAll('.nav__link[data-translate], #search-input[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const keys = key.split('.');
        let value = translation;
        for (const k of keys) {
            value = value?.[k];
        }
        if (value) {
            if (element.tagName === 'INPUT') {
                element.placeholder = value;
            } else {
                element.textContent = value;
            }
        }
    });
}

function toggleSvgColorField() {
    const avatarDisplayType = document.getElementById('avatarDisplayType').value;
    const svgColorContainer = document.getElementById('svgColorContainer');
    svgColorContainer.style.display = avatarDisplayType === 'svg' ? 'block' : 'none';
}

function addDynamicField(containerId, fieldTemplate, setupLinks = false) {
    const container = document.getElementById(containerId);
    const newField = document.createElement('div');
    newField.className = 'dynamic-field';
    newField.innerHTML = fieldTemplate;
    container.appendChild(newField);
    newField.querySelector('.remove-field')?.addEventListener('click', () => newField.remove());
    if (setupLinks) {
        const linkContainer = newField.querySelector('.link-fields');
        newField.querySelector('.add-link')?.addEventListener('click', () => {
            const newLink = document.createElement('div');
            newLink.className = 'link-field';
            newLink.innerHTML = `
                <input type="text" name="option" placeholder="Link Name (e.g., Demo)" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <input type="url" name="value" placeholder="Link (e.g., https://example.com)" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <button type="button" class="remove-link add-btn">Remove Link</button>
            `;
            linkContainer.appendChild(newLink);
            newLink.querySelector('.remove-link').addEventListener('click', () => newLink.remove());
        });
        newField.querySelector('.remove-image')?.addEventListener('click', () => {
            const imageInput = newField.querySelector('[name="image"]');
            imageInput.value = '';
            const imgPreview = newField.querySelector('img');
            if (imgPreview) imgPreview.remove();
        });
    }
}

// ✅ التعديل الرئيسي في DOMContentLoaded - تقليل عدد الطلبات
window.addEventListener('DOMContentLoaded', async () => {
    await loadNav();
    await loadFooter();
    document.getElementById('loader').style.display = 'none';
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.src = savedTheme === 'light' ? modeToggle.getAttribute('src-light') : modeToggle.getAttribute('src-dark');
    }
      setupSocialLoginLinks();
    await updateNav();
    await updateVisitCount();
    
    // ✅ التحقق من أننا لسنا في صفحة تسجيل الدخول أو التسجيل
    const isAuthPage = window.location.pathname === '/login.html' || 
                       window.location.pathname === '/register.html';
    
    // ✅ تحميل البيانات فقط إذا لم نكن في صفحات المصادقة
    if (!isAuthPage) {
        await Promise.all([
            loadTranslations('en'),
            loadTranslations('ar'),
            fetchCsrfToken(),
            loadSettings(),
            loadSocialMedia(),
            loadInteractions(),
            loadArticles()
        ]);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || 'ar';
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) languageSwitcher.value = lang;
    updateFooterContent(lang);
    updatePageContent(lang);

    if (urlParams.get('error')) {
        Toastify({
            text: `Error: ${decodeURIComponent(urlParams.get('error'))}`,
            duration: 3000,
            style: { background: '#ef4444' }
        }).showToast();
    }

    if (languageSwitcher) {
        languageSwitcher.addEventListener('change', (e) => {
            const lang = e.target.value;
            updateFooterContent(lang);
            updatePageContent(lang); 
            window.history.pushState({}, '', `?lang=${lang}`);
        });
    }

    const modal = document.getElementById('footer-modal');
    const closeBtn = document.getElementById('close-btn');
    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.remove('show'));
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }

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

    document.addEventListener('click', (e) => {
        const searchResults = document.getElementById('search-results');
        if (searchResults && !e.target.closest('#search-input') && !e.target.closest('#search-results')) {
            searchResults.classList.add('hidden');
        }
    });

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

    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            document.getElementById('nav-menu').classList.toggle('show');
        });
    }

    document.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('nav-menu').classList.remove('show');
        });
    });

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const csrfToken = await fetchCsrfToken();
                await fetchWithRefresh(`${cleanApiUrl}/api/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
                });
                localStorage.removeItem('userToken');
                localStorage.removeItem('refreshToken');
                userToken = null;
                await updateNav();
                window.location.href = '/';
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

    const createCanvaBtn = document.getElementById('create-canva');
    if (createCanvaBtn) {
        createCanvaBtn.addEventListener('click', createCanvaDesign);
    }

    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

    const avatarDisplayType = document.getElementById('avatarDisplayType');
    if (avatarDisplayType) {
        avatarDisplayType.addEventListener('change', toggleSvgColorField);
    }

    document.getElementById('add-education')?.addEventListener('click', () => {
        addDynamicField('education-fields', `
            <input type="text" name="institution" placeholder="Institution" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="degree" placeholder="Degree" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="year" placeholder="Year" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-field add-btn">Remove</button>
        `);
    });

    document.getElementById('add-experience')?.addEventListener('click', () => {
        addDynamicField('experience-fields', `
            <input type="text" name="company" placeholder="Company" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="role" placeholder="Role" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="duration" placeholder="Duration" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-field add-btn">Remove</button>
        `);
    });

    document.getElementById('add-certificate')?.addEventListener('click', () => {
        addDynamicField('certificate-fields', `
            <input type="text" name="name" placeholder="Certificate Name" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="issuer" placeholder="Issuer" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="text" name="year" placeholder="Year" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-field add-btn">Remove</button>
        `);
    });

    document.getElementById('add-skill')?.addEventListener('click', () => {
        addDynamicField('skill-fields', `
            <input type="text" name="name" placeholder="Skill Name" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="number" name="percentage" placeholder="Percentage (0-100)" min="0" max="100" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-field add-btn">Remove</button>
        `);
    });

    document.getElementById('add-project')?.addEventListener('click', () => {
        addDynamicField('project-fields', `
            <input type="checkbox" name="isPrivate" class="mb-2"> <label>Private Link</label>
            <input type="text" name="title" placeholder="Project Title" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <textarea name="description" placeholder="Project Description" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" rows="3"></textarea>
            <input type="file" name="image" accept="image/jpeg,image/png" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-image add-btn">Remove Image</button>
            <input type="text" name="rating" placeholder="Rating (e.g., Good)" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <input type="number" name="stars" placeholder="Stars (0-5)" min="0" max="5" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <div class="link-fields"></div>
            <button type="button" class="add-link add-btn">Add Link</button>
            <button type="button" class="remove-field add-btn">Remove Project</button>
        `, true);
    });

    document.getElementById('add-interest')?.addEventListener('click', () => {
        addDynamicField('interest-fields', `
            <input type="text" name="interest" placeholder="Interest" class="mb-2 w-full p-2.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <button type="button" class="remove-field add-btn">Remove</button>
        `);
    });

    document.addEventListener('change', (e) => {
        if (e.target.matches('#avatar, #project-fields input[name="image"]')) {
            const file = e.target.files[0];
            const maxSize = 5 * 1024 * 1024;
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (file) {
                if (!allowedTypes.includes(file.type)) {
                    Toastify({
                        text: `Only JPEG or PNG images are allowed for ${e.target.id === 'avatar' ? 'profile picture' : 'project'}.`,
                        duration: 3000,
                        style: { background: '#ef4444' }
                    }).showToast();
                    e.target.value = '';
                    return;
                }
                if (file.size > maxSize) {
                    Toastify({
                        text: `Image size for ${e.target.id === 'avatar' ? 'profile picture' : 'project'} exceeds 5MB.`,
                        duration: 3000,
                        style: { background: '#ef4444' }
                    }).showToast();
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.createElement('img');
                    preview.src = e.target.result;
                    preview.className = 'w-24 h-24 rounded-full mt-2';
                    const existingPreview = e.target.parentElement.querySelector('img');
                    if (existingPreview) existingPreview.remove();
                    e.target.after(preview);
                };
                reader.readAsDataURL(file);
            }
        }
    });

    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);

    document.getElementById('downloadCv')?.addEventListener('click', (e) => {
        e.preventDefault();
        const link = document.createElement('a');
        link.href = '/assets/ibrahim.pdf';
        link.download = 'ibrahim.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('nickname')?.addEventListener('blur', async () => {
        const nickname = document.getElementById('nickname').value;
        document.getElementById('download-docx').href = `${cleanApiUrl}/api/profile/docx/${encodeURIComponent(nickname)}`;
        if (nickname) {
            try {
                const currentNickname = currentUserProfileData?.profile?.nickname;
                if (nickname !== currentNickname) {
                    const response = await fetchWithRefresh(`${cleanApiUrl}/api/check-nickname?nickname=${encodeURIComponent(nickname)}`);
                    const data = await response.json();
                    if (!data.available) {
                        Toastify({
                            text: 'Nickname is already in use. Please choose another.',
                            duration: 3000,
                            style: { background: '#ef4444' }
                        }).showToast();
                    }
                }
            } catch (error) {
                console.error('Error checking nickname:', error);
                Toastify({
                    text: 'Error checking nickname',
                    duration: 3000,
                    style: { background: '#ef4444' }
                }).showToast();
            }
        }
    });

    window.addEventListener('scroll', scrollActive);

    const sr = ScrollReveal({
        origin: 'top',
        distance: '60px',
        duration: 2000,
        delay: 200
    });

    sr.reveal('.home__data, .about__img, .skills__subtitle, .skills__text', {});
    sr.reveal('.home__img, .about__subtitle, .about__text, .skills__img', { delay: 400 });
    sr.reveal('.home__social-icon', { interval: 200 });
    sr.reveal('.skills__data, .work__img, .contact__input', { interval: 200 });

    window.userToken = userToken;
    window.cleanApiUrl = cleanApiUrl;
    window.fetchCsrfToken = fetchCsrfToken;
    window.fetchWithRefresh = fetchWithRefresh;

});