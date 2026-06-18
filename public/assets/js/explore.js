// js/explore.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentTab = 'suggested';
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let searchTimeout = null;

// Intersection Observer
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && hasMore) {
        loadUsers();
    }
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', async () => {
    if (!userToken) {
        window.location.href = '/login.html?redirect=/explore.html';
        return;
    }
    
    await loadCurrentUser();
    await loadUsers();
    setupEventListeners();
    
    const trigger = document.getElementById('load-more-trigger');
    if (trigger) observer.observe(trigger);
});

async function loadCurrentUser() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const user = await response.json();
            document.getElementById('user-avatar').src = user.profile?.avatar || '/assets/img/default-avatar.png';
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadUsers() {
    if (isLoading) return;
    isLoading = true;
    
    const searchQuery = document.getElementById('search-input')?.value || '';
    
    try {
        let url;
        if (searchQuery) {
            url = `${cleanApiUrl}/api/users/search?query=${encodeURIComponent(searchQuery)}&page=${currentPage}&limit=20`;
        } else {
            url = `${cleanApiUrl}/api/users/explore?type=${currentTab}&page=${currentPage}&limit=20`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        const container = document.getElementById('users-container');
        
        if (currentPage === 1) {
            container.innerHTML = '';
        }
        
        if (result.data.length === 0 && currentPage === 1) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class='bx bx-user-x text-6xl text-gray-400 mb-3'></i>
                    <p class="text-gray-500">No users found</p>
                    ${!searchQuery ? '<p class="text-sm text-gray-400 mt-2">Try following more users to get suggestions</p>' : ''}
                </div>
            `;
            hasMore = false;
            return;
        }
        
        result.data.forEach(user => {
            container.appendChild(createUserCard(user));
        });
        
        hasMore = result.data.length === 20;
        if (hasMore) currentPage++;
        else {
            const trigger = document.getElementById('load-more-trigger');
            if (trigger) observer.unobserve(trigger);
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    } finally {
        isLoading = false;
    }
}

function createUserCard(user) {
    const div = document.createElement('div');
    div.className = 'user-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden';
    
    const isFollowing = user.isFollowing || false;
    
    div.innerHTML = `
        <a href="/profile/${user.profile?.nickname || user.username}" class="block">
            <div class="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
                <img src="${user.profile?.coverImage || '/assets/img/default-cover.jpg'}" class="w-full h-full object-cover">
            </div>
            <div class="relative px-4 pb-4">
                <img src="${user.profile?.avatar || '/assets/img/default-avatar.png'}" 
                     class="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 -mt-10 mx-auto object-cover">
                <h3 class="text-center font-semibold mt-2">${escapeHtml(user.profile?.nickname || user.username)}</h3>
                <p class="text-center text-sm text-gray-500">${escapeHtml(user.profile?.jobTitle || '')}</p>
                
                <!-- Stats -->
                <div class="flex justify-around mt-3 text-center">
                    <div>
                        <p class="font-bold">${user.stats?.posts || 0}</p>
                        <p class="text-xs text-gray-500">Posts</p>
                    </div>
                    <div>
                        <p class="font-bold">${user.stats?.followers || 0}</p>
                        <p class="text-xs text-gray-500">Followers</p>
                    </div>
                    <div>
                        <p class="font-bold">${user.stats?.following || 0}</p>
                        <p class="text-xs text-gray-500">Following</p>
                    </div>
                </div>
            </div>
        </a>
        <div class="px-4 pb-4">
            <button onclick="toggleFollow('${user._id}', this)" 
                class="follow-btn w-full py-2 rounded-lg transition ${isFollowing ? 'following bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white">
                ${isFollowing ? 'Following' : 'Follow'}
            </button>
        </div>
    `;
    
    return div;
}

async function toggleFollow(userId, button) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/users/${userId}/follow`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (result.isFollowing) {
                button.textContent = 'Following';
                button.classList.add('following', 'bg-red-500');
                button.classList.remove('bg-blue-500');
                showToast('Followed successfully!', 'success');
            } else {
                button.textContent = 'Follow';
                button.classList.remove('following', 'bg-red-500');
                button.classList.add('bg-blue-500');
                showToast('Unfollowed', 'info');
            }
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        showToast('Failed to follow/unfollow', 'error');
    }
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab === currentTab) return;
            
            // Update active tab style
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('text-blue-600', 'border-blue-600');
                b.classList.add('text-gray-600', 'dark:text-gray-400');
            });
            btn.classList.add('text-blue-600', 'border-blue-600');
            btn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            currentTab = tab;
            currentPage = 1;
            hasMore = true;
            loadUsers();
        });
    });
    
    // Search with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentPage = 1;
                hasMore = true;
                loadUsers();
            }, 500);
        });
    }
}

function showToast(message, type = 'success') {
    Toastify({
        text: message,
        duration: 3000,
        style: { background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6' }
    }).showToast();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

async function fetchCsrfToken() {
    const response = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken;
}