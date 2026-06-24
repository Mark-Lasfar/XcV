// ============================================
// Profile Page - Complete JavaScript File
// Version: 3.0.0
// Description: Full profile functionality with modern UI like feed.html
// ============================================

const API_URL = window.ENV?.API_URL || 'https://misty-dust-988c.marklasfar.workers.dev';
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentUser = null;
let profileUser = null;
let isFollowing = false;
let unreadCountInterval = null;

// ============================================
// Load Site Settings
// ============================================
async function loadSiteSettings() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/site-settings`);
        if (response.ok) {
            const data = await response.json();
            const logoImg = document.querySelector('#nav-logo');
            if (logoImg && data.logo) logoImg.src = data.logo;
            const siteNameSpan = document.getElementById('site-name');
            if (siteNameSpan && data.siteName) siteNameSpan.textContent = data.siteName;
            const favicon = document.getElementById('dynamic-favicon');
            if (favicon && data.logo) favicon.href = data.logo;
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
    }
}

// ============================================
// Load Current User Data
// ============================================
async function loadCurrentUser() {
    if (!userToken) return null;
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('user-avatar').src = currentUser.profile?.avatar || '/assets/img/default-avatar.png';
            return currentUser;
        }
    } catch (error) {
        console.error('Error loading current user:', error);
    }
    return null;
}

// ============================================
// Load Profile Data
// ============================================
async function loadProfileData() {
    const pathParts = window.location.pathname.split('/');
    let nickname = pathParts[pathParts.length - 1];

    if (!nickname || nickname === 'profile.html' || nickname === 'me' || nickname === 'profile') {
        if (userToken) {
            try {
                const response = await fetch(`${cleanApiUrl}/api/profile/me`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    nickname = data.profile.nickname || data.username;
                    if (nickname) {
                        window.history.replaceState({}, '', `/profile/${encodeURIComponent(nickname)}`);
                    }
                }
            } catch (error) {
                console.error('Error loading profile:', error);
                return null;
            }
        } else {
            return null;
        }
    }

    try {
        const response = await fetch(`${cleanApiUrl}/api/profile/${encodeURIComponent(nickname)}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        profileUser = data;
        
        // Check if current user follows this profile
        if (userToken && currentUser) {
            const followingRes = await fetch(`${cleanApiUrl}/api/users/me/following/ids`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (followingRes.ok) {
                const followingData = await followingRes.json();
                isFollowing = followingData.data.includes(profileUser.profile._id);
                updateFollowButton();
            }
        }
        
        return profileUser;
    } catch (error) {
        console.error('Error loading profile:', error);
        return null;
    }
}

// ============================================
// Update Follow Button
// ============================================
function updateFollowButton() {
    const followBtn = document.getElementById('follow-profile-btn');
    if (!followBtn) return;
    
    if (isFollowing) {
        followBtn.innerHTML = '<i class="bx bx-check mr-1"></i> Following';
        followBtn.classList.add('following');
        followBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    } else {
        followBtn.innerHTML = '<i class="bx bx-user-plus mr-1"></i> Follow';
        followBtn.classList.remove('following');
        followBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }
}

// ============================================
// Toggle Follow
// ============================================
async function toggleFollow() {
    if (!userToken) {
        showToast('Please login to follow users', 'error');
        window.location.href = '/login.html';
        return;
    }
    
    if (!profileUser) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/users/${profileUser.profile._id}/follow`, {
            method: isFollowing ? 'DELETE' : 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            isFollowing = !isFollowing;
            updateFollowButton();
            showToast(isFollowing ? 'Followed!' : 'Unfollowed', 'success');
            
            // Update stats
            const followersSpan = document.getElementById('stat-followers');
            if (followersSpan) {
                const current = parseInt(followersSpan.textContent) || 0;
                followersSpan.textContent = isFollowing ? current + 1 : Math.max(0, current - 1);
            }
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        showToast('Failed to follow/unfollow', 'error');
    }
}

// ============================================
// Render Profile UI
// ============================================
function renderProfile() {
    if (!profileUser) return;
    
    const profile = profileUser.profile;
    const username = profileUser.username;
    
    // Update title
    document.title = `${profile.nickname || username} - Profile | MGZon`;
    
    // Avatar and name
    document.getElementById('profile-avatar-large').src = profile.avatar || '/assets/img/default-avatar.png';
    document.getElementById('profile-name').textContent = profile.nickname || username;
    document.getElementById('profile-job').textContent = profile.jobTitle || 'Professional';
    document.getElementById('profile-bio').textContent = profile.bio || 'No bio available';
    document.getElementById('sidebar-name').textContent = profile.nickname || username;
    document.getElementById('sidebar-title').textContent = profile.jobTitle || 'Professional';
    document.getElementById('sidebar-avatar').src = profile.avatar || '/assets/img/default-avatar.png';
    
    // Location (if available)
    if (profile.location) {
        document.getElementById('profile-location').innerHTML = `<i class='bx bx-map'></i><span>${escapeHtml(profile.location)}</span>`;
    }
    
    // Stats
    const stats = profileUser.stats || {};
    document.getElementById('stat-posts').textContent = stats.posts || 0;
    document.getElementById('stat-followers').textContent = stats.followers || 0;
    document.getElementById('stat-following').textContent = stats.following || 0;
    document.getElementById('stat-projects').textContent = (profile.projects?.length || 0);
    document.getElementById('profile-posts-count').textContent = stats.posts || 0;
    document.getElementById('profile-followers-count').textContent = stats.followers || 0;
    
    // Skills
    renderSkills(profile.skills);
    
    // Education
    renderEducation(profile.education);
    
    // Experience
    renderExperience(profile.experience);
    
    // Certificates
    renderCertificates(profile.certificates);
    
    // Interests
    renderInterests(profile.interests);
    
    // Projects
    renderProjects(profile.projects);
}

// ============================================
// Render Skills
// ============================================
function renderSkills(skills) {
    const container = document.getElementById('profile-skills-list');
    if (!container) return;
    
    let skillsList = [];
    if (skills && typeof skills === 'object') {
        skillsList = Array.isArray(skills) ? skills : Object.values(skills);
    }
    
    if (skillsList.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No skills added yet.</p>';
        return;
    }
    
    container.innerHTML = skillsList.map(skill => `
        <span class="skill-tag group relative">
            ${escapeHtml(skill.name || skill)}
            ${skill.percentage ? `<span class="hidden group-hover:inline-block ml-1 text-xs">${skill.percentage}%</span>` : ''}
        </span>
    `).join('');
}

// ============================================
// Render Education
// ============================================
function renderEducation(education) {
    const container = document.getElementById('profile-education-list');
    if (!container) return;
    
    let eduList = [];
    if (education && typeof education === 'object') {
        eduList = Array.isArray(education) ? education : Object.values(education);
    }
    
    if (eduList.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No education added yet.</p>';
        return;
    }
    
    container.innerHTML = eduList.map(edu => `
        <div class="timeline-item-custom">
            <div class="font-semibold">${escapeHtml(edu.institution || '')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(edu.degree || '')}</div>
            <div class="text-xs text-gray-500">${escapeHtml(edu.year || '')}</div>
        </div>
    `).join('');
}

// ============================================
// Render Experience
// ============================================
function renderExperience(experience) {
    const container = document.getElementById('profile-experience-list');
    if (!container) return;
    
    let expList = [];
    if (experience && typeof experience === 'object') {
        expList = Array.isArray(experience) ? experience : Object.values(experience);
    }
    
    if (expList.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No experience added yet.</p>';
        return;
    }
    
    container.innerHTML = expList.map(exp => `
        <div class="timeline-item-custom">
            <div class="font-semibold">${escapeHtml(exp.company || '')}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(exp.role || '')}</div>
            <div class="text-xs text-gray-500">${escapeHtml(exp.duration || '')}</div>
        </div>
    `).join('');
}

// ============================================
// Render Certificates
// ============================================
function renderCertificates(certificates) {
    const container = document.getElementById('profile-certificates-list');
    if (!container) return;
    
    let certList = [];
    if (certificates && typeof certificates === 'object') {
        certList = Array.isArray(certificates) ? certificates : Object.values(certificates);
    }
    
    if (certList.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No certificates added yet.</p>';
        return;
    }
    
    container.innerHTML = certList.map(cert => `
        <div class="flex items-center gap-2 text-sm">
            <i class='bx bx-award text-yellow-500'></i>
            <span class="font-medium">${escapeHtml(cert.name || '')}</span>
            <span class="text-gray-500">- ${escapeHtml(cert.issuer || '')}</span>
            <span class="text-xs text-gray-400">(${escapeHtml(cert.year || '')})</span>
        </div>
    `).join('');
}

// ============================================
// Render Interests
// ============================================
function renderInterests(interests) {
    const container = document.getElementById('profile-interests-list');
    if (!container) return;
    
    let interestsList = [];
    if (interests && typeof interests === 'object') {
        interestsList = Array.isArray(interests) ? interests : Object.values(interests);
    }
    
    if (interestsList.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No interests added yet.</p>';
        return;
    }
    
    container.innerHTML = interestsList.map(interest => `
        <span class="skill-tag">${escapeHtml(interest)}</span>
    `).join('');
}

// ============================================
// Render Projects
// ============================================
function renderProjects(projects) {
    const container = document.getElementById('profile-projects-grid');
    if (!container) return;
    
    let projectsList = [];
    if (projects && typeof projects === 'object') {
        projectsList = Array.isArray(projects) ? projects : Object.values(projects);
    }
    
    if (projectsList.length === 0) {
        container.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">No projects added yet.</p>';
        return;
    }
    
    container.innerHTML = projectsList.map(project => `
        <div class="project-card-custom cursor-pointer" onclick="window.location.href='/project.html?id=${project._id}&owner=${encodeURIComponent(profileUser.profile.nickname || profileUser.username)}'">
            ${project.image ? `<img src="${project.image}" class="w-full h-40 object-cover" onerror="this.src='/assets/img/default-project.png'">` : 
                `<div class="w-full h-40 bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <i class='bx bx-code-alt text-4xl text-white'></i>
                </div>`}
            <div class="p-4">
                <h3 class="font-semibold">${escapeHtml(project.title)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">${escapeHtml((project.description || '').substring(0, 100))}${(project.description || '').length > 100 ? '...' : ''}</p>
                <div class="flex items-center gap-2 mt-2">
                    ${project.stars ? `<span class="text-yellow-500 text-sm">${'★'.repeat(Math.min(5, project.stars))}</span>` : ''}
                    ${project.rating ? `<span class="text-xs text-gray-500">${escapeHtml(project.rating)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// Load Interactions
// ============================================
async function loadInteractions() {
    const container = document.getElementById('profile-interactions-container');
    if (!container) return;
    
    const nickname = window.location.pathname.split('/').pop();
    if (!nickname || nickname === 'profile.html' || nickname === 'me') return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/profile/${encodeURIComponent(nickname)}/interactions`);
        const comments = await response.json();
        
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No interactions yet.</p>';
            return;
        }
        
        container.innerHTML = comments.slice(0, 5).map(comment => `
            <div class="interaction-comment p-3 rounded-lg border dark:border-gray-700 cursor-pointer" 
                 onclick="window.location.href='/project.html?id=${comment.projectId}&comment=${comment.commentId}'">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-semibold text-sm">${escapeHtml(comment.projectTitle || 'Unknown Project')}</div>
                        <div class="text-yellow-500 text-xs">${'★'.repeat(comment.rating)}${'☆'.repeat(5 - comment.rating)}</div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(comment.text.substring(0, 100))}${comment.text.length > 100 ? '...' : ''}</p>
                    </div>
                    <i class='bx bx-link-external text-gray-400'></i>
                </div>
            </div>
        `).join('');
        
        if (comments.length > 5) {
            container.innerHTML += `<button onclick="loadAllInteractions()" class="w-full mt-2 text-center text-blue-500 text-sm">View all ${comments.length} interactions →</button>`;
        }
    } catch (error) {
        console.error('Error loading interactions:', error);
        container.innerHTML = '<p class="text-red-500 text-center py-4">Error loading interactions.</p>';
    }
}

// ============================================
// Load Sidebar Data (Trending, Suggestions, Jobs)
// ============================================
async function loadTrendingTopics() {
    const container = document.getElementById('trending-list');
    if (!container) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/trending/topics`, {
            headers: userToken ? { 'Authorization': `Bearer ${userToken}` } : {}
        });
        const topics = await response.json();
        
        if (topics && topics.length > 0) {
            container.innerHTML = topics.slice(0, 5).map((topic, i) => `
                <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0" onclick="searchByTopic('${escapeHtml(topic.topic || topic)}')">
                    <div class="font-semibold text-sm">${i + 1}. ${escapeHtml(topic.topic || topic)}</div>
                    <div class="text-xs text-gray-500">${topic.count ? topic.count.toLocaleString() : 'Trending'} posts</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="p-3 hover:bg-gray-100 cursor-pointer" onclick="searchByTopic('Remote Jobs')">
                    <div class="font-semibold text-sm">1. Remote Jobs</div>
                    <div class="text-xs text-gray-500">Trending</div>
                </div>
                <div class="p-3 hover:bg-gray-100 cursor-pointer" onclick="searchByTopic('AI in Tech')">
                    <div class="font-semibold text-sm">2. AI in Tech</div>
                    <div class="text-xs text-gray-500">Trending</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading trending topics:', error);
    }
}

async function loadSuggestions() {
    const container = document.getElementById('suggestions-list');
    if (!container || !userToken) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/users/suggestions?limit=3`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        const suggestions = result.data || [];
        
        if (suggestions.length > 0) {
            container.innerHTML = suggestions.map(user => `
                <div class="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-0">
                    <div class="flex items-center gap-2">
                        <img src="${user.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-8 h-8 rounded-full object-cover">
                        <div>
                            <div class="font-semibold text-sm">${escapeHtml(user.profile?.nickname || user.username)}</div>
                            <div class="text-xs text-gray-500">${escapeHtml(user.profile?.jobTitle || 'Professional')}</div>
                        </div>
                    </div>
                    <button onclick="followFromSuggestion('${user._id}', this)" class="follow-btn-sm bg-blue-600 text-white px-3 py-1 rounded-full text-xs">Follow</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No suggestions</div>';
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

async function loadRecentJobs() {
    const container = document.getElementById('recent-jobs-list');
    if (!container) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs?limit=3`);
        const result = await response.json();
        const jobs = result.data || [];
        
        if (jobs.length > 0) {
            container.innerHTML = jobs.map(job => `
                <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-0" onclick="window.location.href='/job-details.html?id=${job._id}'">
                    <div class="font-semibold text-sm">${escapeHtml(job.title)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(job.companyName || 'Company')}</div>
                    <div class="text-xs text-green-600">${job.salaryMin ? `$${job.salaryMin}k - $${job.salaryMax}k` : ''}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No jobs found</div>';
        }
    } catch (error) {
        console.error('Error loading recent jobs:', error);
    }
}

// ============================================
// Search Functionality (Same as feed.html)
// ============================================
async function loadSearchResults(query) {
    if (!query || query.length < 2) {
        const searchResults = document.getElementById('search-results');
        if (searchResults) searchResults.classList.add('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/users/search?query=${encodeURIComponent(query)}&limit=5`, {
            headers: userToken ? { 'Authorization': `Bearer ${userToken}` } : {}
        });
        
        if (!response.ok) throw new Error('Failed to fetch search results');
        
        const result = await response.json();
        const users = result.data || [];
        const searchResults = document.getElementById('search-results');
        
        if (searchResults) {
            searchResults.classList.remove('hidden');
            
            if (users.length > 0) {
                searchResults.innerHTML = users.map(user => `
                    <a href="/profile/${user.profile?.nickname || user.username}" class="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-0">
                        <img src="${user.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-10 h-10 rounded-full object-cover">
                        <div class="flex-1">
                            <div class="font-semibold text-sm">${escapeHtml(user.profile?.nickname || user.username)}</div>
                            <div class="text-xs text-gray-500">${escapeHtml(user.profile?.jobTitle || 'Professional')}</div>
                            <div class="text-xs text-gray-400">📄 ${user.stats?.posts || 0} posts • 👥 ${user.stats?.followers || 0} followers</div>
                        </div>
                    </a>
                `).join('');
                
                if (result.pagination?.total > 5) {
                    searchResults.innerHTML += `<a href="/search.html?q=${encodeURIComponent(query)}" class="block p-3 text-center text-blue-600 hover:bg-gray-100">View all ${result.pagination.total} results →</a>`;
                }
            } else {
                searchResults.innerHTML = `<div class="p-4 text-center text-gray-500">No users found for "${escapeHtml(query)}"<br><a href="/search.html?q=${encodeURIComponent(query)}" class="text-blue-600 text-sm">Search all →</a></div>`;
            }
        }
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

// ============================================
// Utility Functions
// ============================================
function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function showToast(message, type = 'success') {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            style: {
                background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6',
                borderRadius: '12px'
            }
        }).showToast();
    }
}

async function fetchCsrfToken() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
        const data = await response.json();
        return data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return null;
    }
}

function searchByTopic(topic) {
    window.location.href = `/search.html?q=${encodeURIComponent(topic)}`;
}

async function followFromSuggestion(userId, btn) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/users/${userId}/follow`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}`, 'X-CSRF-Token': csrfToken }
        });
        if (response.ok) {
            btn.textContent = 'Following';
            btn.classList.add('bg-gray-500');
            btn.classList.remove('bg-blue-600');
            showToast('Followed!', 'success');
            await loadSuggestions();
        }
    } catch (error) {
        console.error('Error following:', error);
    }
}

function loadAllInteractions() {
    const nickname = window.location.pathname.split('/').pop();
    window.location.href = `/interactions.html?user=${encodeURIComponent(nickname)}`;
}

// ============================================
// Notifications (Same as feed.html)
// ============================================
async function loadNotifications() {
    if (!userToken) return;
    try {
        const response = await fetch(`${cleanApiUrl}/api/notifications?limit=10`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (response.ok) {
            const badge = document.getElementById('notif-badge');
            if (result.unreadCount > 0) {
                badge.textContent = result.unreadCount > 9 ? '9+' : result.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
            
            const list = document.getElementById('notifications-list');
            if (list && result.data.length > 0) {
                list.innerHTML = result.data.slice(0, 5).map(notif => `
                    <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700">
                        <div class="flex gap-2">
                            <img src="${notif.actorId?.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-8 h-8 rounded-full">
                            <div class="flex-1">
                                <p class="text-sm">${escapeHtml(notif.content)}</p>
                                <p class="text-xs text-gray-500">${formatDate(notif.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Follow button
    const followBtn = document.getElementById('follow-profile-btn');
    if (followBtn) {
        followBtn.addEventListener('click', toggleFollow);
    }
    
    // Global search
    const globalSearch = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');
    
    if (globalSearch) {
        let searchTimeout;
        globalSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            searchTimeout = setTimeout(() => {
                if (query.length >= 2) {
                    loadSearchResults(query);
                } else if (searchResults) {
                    searchResults.classList.add('hidden');
                }
            }, 500);
        });
        
        globalSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = globalSearch.value.trim();
                if (query.length >= 2) {
                    window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }
    
    // Close search results on outside click
    document.addEventListener('click', (e) => {
        if (searchResults && !e.target.closest('#global-search') && !e.target.closest('#search-results')) {
            searchResults.classList.add('hidden');
        }
    });
    
    // Notifications dropdown
    const notifBtn = document.getElementById('notifications-btn');
    const notifDropdown = document.getElementById('notifications-dropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('hidden');
            if (!notifDropdown.classList.contains('hidden')) {
                loadNotifications();
            }
        });
    }
    
    // Mark all read
    const markAllRead = document.getElementById('mark-all-read');
    if (markAllRead) {
        markAllRead.addEventListener('click', async () => {
            try {
                const csrfToken = await fetchCsrfToken();
                await fetch(`${cleanApiUrl}/api/notifications/read-all`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${userToken}`, 'X-CSRF-Token': csrfToken }
                });
                showToast('All notifications marked as read', 'success');
                loadNotifications();
                const badge = document.getElementById('notif-badge');
                if (badge) badge.classList.add('hidden');
            } catch (error) {
                console.error(error);
            }
        });
    }
    
    // Profile dropdown
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileMenuBtn && profileDropdown) {
        profileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const csrfToken = await fetchCsrfToken();
                await fetch(`${cleanApiUrl}/api/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${userToken}`, 'X-CSRF-Token': csrfToken }
                });
                localStorage.clear();
                window.location.href = '/';
            } catch (error) {
                console.error(error);
            }
        });
    }
    
    // Close dropdowns on outside click
    document.addEventListener('click', () => {
        if (notifDropdown) notifDropdown.classList.add('hidden');
        if (profileDropdown) profileDropdown.classList.add('hidden');
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
        });
    }
}

// ============================================
// Initialize Page
// ============================================
async function init() {
    await loadSiteSettings();
    
    if (userToken) {
        await loadCurrentUser();
        startNotificationInterval();
        loadNotifications();
    }
    
    await loadProfileData();
    
    if (profileUser) {
        renderProfile();
        await loadInteractions();
    } else {
        document.querySelector('.main-profile').innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
                <i class='bx bx-user-x text-6xl text-gray-400 mb-4'></i>
                <h2 class="text-2xl font-bold mb-2">Profile Not Found</h2>
                <p class="text-gray-500">The user you're looking for doesn't exist or has made their profile private.</p>
                <a href="/feed.html" class="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-full">Back to Feed</a>
            </div>
        `;
    }
    
    await loadTrendingTopics();
    await loadSuggestions();
    await loadRecentJobs();
    
    setupEventListeners();
    
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
}

function startNotificationInterval() {
    if (unreadCountInterval) clearInterval(unreadCountInterval);
    setInterval(() => {
        loadNotifications();
    }, 30000);
}

// Start the app
init();

// Make functions global
window.searchByTopic = searchByTopic;
window.followFromSuggestion = followFromSuggestion;
window.loadAllInteractions = loadAllInteractions;