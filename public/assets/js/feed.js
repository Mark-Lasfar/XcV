// ============================================
// Feed Page - Complete JavaScript File
// Version: 2.0.0
// Description: Full feed functionality with infinite scroll, likes, comments, shares, saves, create post, notifications, and sidebars
// ============================================

const API_URL = window.ENV?.API_URL || 'https://mgzon-server.hf.space';
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentUser = null;
let unreadCountInterval = null;

// ============================================
// Load Site Settings (Logo, Site Name, Favicon)
// ============================================
async function loadSiteSettings() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/site-settings`);
        if (response.ok) {
            const data = await response.json();
            
            // Update logo
            const logoImg = document.querySelector('#nav-logo');
            if (logoImg && data.logo) {
                logoImg.src = data.logo;
                logoImg.onerror = () => logoImg.src = '/assets/img/logo.svg';
            }
            
            // Update site name
            const siteNameSpan = document.getElementById('site-name');
            if (siteNameSpan && data.siteName) {
                siteNameSpan.textContent = data.siteName;
            }
            
            // Update favicon
            const favicon = document.getElementById('dynamic-favicon');
            if (favicon && data.logo) {
                favicon.href = data.logo;
                favicon.onerror = () => favicon.href = '/assets/img/logo.svg';
            }
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
    }
}

// ============================================
// Load Current User Data
// ============================================
async function loadCurrentUser() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            
            // Update avatars
            document.getElementById('user-avatar').src = currentUser.profile?.avatar || '/assets/img/default-avatar.png';
            document.getElementById('create-post-avatar').src = currentUser.profile?.avatar || '/assets/img/default-avatar.png';
            document.getElementById('sidebar-avatar').src = currentUser.profile?.avatar || '/assets/img/default-avatar.png';
            
            // Update sidebar name and title
            document.getElementById('sidebar-name').textContent = currentUser.profile?.nickname || currentUser.username;
            document.getElementById('sidebar-title').textContent = currentUser.profile?.jobTitle || 'Professional';
            
            // Load user stats
            await loadUserStats();
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading current user:', error);
        return false;
    }
}

// ============================================
// Load User Statistics for Sidebar
// ============================================
async function loadUserStats() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/users/${currentUser.userId}/stats`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('profile-posts-count').textContent = stats.stats?.posts || 0;
            document.getElementById('profile-followers-count').textContent = stats.stats?.followers || 0;
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// ============================================
// Load Trending Topics
// ============================================
async function loadTrendingTopics() {
    const container = document.getElementById('trending-list');
    if (!container) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/trending/topics`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const topics = await response.json();
        
        if (topics && topics.length > 0) {
            container.innerHTML = topics.slice(0, 5).map((topic, i) => `
                <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition border-b dark:border-gray-700 last:border-0" onclick="searchByTopic('${escapeHtml(topic.topic || topic)}')">
                    <div class="font-semibold text-sm">${i + 1}. ${escapeHtml(topic.topic || topic)}</div>
                    <div class="text-xs text-gray-500">${topic.count ? topic.count.toLocaleString() : 'Trending'} posts</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="searchByTopic('Remote Jobs')">
                    <div class="font-semibold text-sm">1. Remote Jobs</div>
                    <div class="text-xs text-gray-500">1,234 posts</div>
                </div>
                <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="searchByTopic('AI in Tech')">
                    <div class="font-semibold text-sm">2. AI in Tech</div>
                    <div class="text-xs text-gray-500">892 posts</div>
                </div>
                <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="searchByTopic('Career Growth')">
                    <div class="font-semibold text-sm">3. Career Growth</div>
                    <div class="text-xs text-gray-500">654 posts</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading trending topics:', error);
        container.innerHTML = `
            <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="searchByTopic('Remote Jobs')">
                <div class="font-semibold text-sm">Remote Jobs</div>
                <div class="text-xs text-gray-500">Trending</div>
            </div>
            <div class="trending-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="searchByTopic('AI in Tech')">
                <div class="font-semibold text-sm">AI in Tech</div>
                <div class="text-xs text-gray-500">Trending</div>
            </div>
        `;
    }
}

// ============================================
// Load Suggested Users to Follow
// ============================================
async function loadSuggestions() {
    const container = document.getElementById('suggestions-list');
    if (!container) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/users/suggestions?limit=3`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        const suggestions = result.data || [];
        
        if (suggestions.length > 0) {
            container.innerHTML = suggestions.map(user => `
                <div class="suggestion-item flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b dark:border-gray-700 last:border-0">
                    <div class="flex items-center gap-3">
                        <img src="${user.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <div class="font-semibold text-sm">${escapeHtml(user.profile?.nickname || user.username)}</div>
                            <div class="text-xs text-gray-500">${escapeHtml(user.profile?.jobTitle || 'Professional')}</div>
                        </div>
                    </div>
                    <button onclick="followUser('${user._id}', this)" class="follow-btn-sm bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700 transition">
                        Follow
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No suggestions available</div>';
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
        container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No suggestions available</div>';
    }
}

// ============================================
// Load Recent Jobs for Sidebar
// ============================================
async function loadRecentJobs() {
    const container = document.getElementById('recent-jobs-list');
    if (!container) return;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs?limit=3`);
        const result = await response.json();
        const jobs = result.data || [];
        
        if (jobs.length > 0) {
            container.innerHTML = jobs.map(job => `
                <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition border-b dark:border-gray-700 last:border-0" onclick="window.location.href='/job-details.html?id=${job._id}'">
                    <div class="font-semibold text-sm">${escapeHtml(job.title)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(job.companyName || 'Company')} • ${escapeHtml(job.location)}</div>
                    <div class="text-xs text-green-600 mt-1">${job.salaryMin ? `$${job.salaryMin}k - $${job.salaryMax}k` : 'Salary not specified'}</div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No jobs found</div>';
        }
    } catch (error) {
        console.error('Error loading recent jobs:', error);
        container.innerHTML = '<div class="p-3 text-center text-gray-500 text-sm">No jobs found</div>';
    }
}

// ============================================
// Load Feed Posts with Infinite Scroll
// ============================================
async function loadFeed() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        const response = await fetch(`${cleanApiUrl}/api/posts/feed?page=${currentPage}&limit=10`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        const container = document.getElementById('feed-container');
        
        if (currentPage === 1) {
            container.innerHTML = '';
        }
        
        if (result.data.length === 0 && currentPage === 1) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                    <i class='bx bx-info-circle text-5xl text-gray-400 mb-3'></i>
                    <p class="text-gray-500">No posts yet. Follow some users to see their posts!</p>
                    <a href="/explore.html" class="inline-block mt-3 text-blue-500 hover:text-blue-600 font-medium">Explore users →</a>
                </div>
            `;
            hasMore = false;
            return;
        }
        
        result.data.forEach(post => {
            container.appendChild(createPostElement(post));
        });
        
        // Load comments for each post
        result.data.forEach(post => {
            loadCommentsForPost(post._id);
        });
        
        hasMore = result.data.length === 10;
        if (hasMore) currentPage++;
        
    } catch (error) {
        console.error('Error loading feed:', error);
        showToast('Failed to load feed', 'error');
    } finally {
        isLoading = false;
    }
}

// ============================================
// Create Post Element HTML
// ============================================
function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post-card bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden mb-4 transition-all hover:shadow-lg';
    div.dataset.postId = post._id;
    
    // Handle images
    let imagesHtml = '';
    if (post.images && post.images.length > 0) {
        const cols = Math.min(post.images.length, 3);
        imagesHtml = `
            <div class="image-gallery p-2" style="display: grid; gap: 8px; grid-template-columns: repeat(${cols}, 1fr);">
                ${post.images.map(img => `
                    <img src="${img.url}" class="rounded-xl cursor-pointer object-cover h-48 w-full" onclick="event.stopPropagation(); openImageModal('${img.url}')">
                `).join('')}
            </div>
        `;
    }
    
    // Handle tags
    let tagsHtml = '';
    if (post.tags && post.tags.length > 0) {
        tagsHtml = `
            <div class="flex flex-wrap gap-2 mt-3">
                ${post.tags.map(tag => `<span class="text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">#${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
    }
    
    div.innerHTML = `
        <div class="p-4">
            <!-- Post Header -->
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <img src="${post.userId?.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-12 h-12 rounded-full object-cover">
                    <div>
                        <a href="/profile/${post.userId?.profile?.nickname || post.userId?.username}" class="font-semibold hover:text-blue-500 transition">
                            ${escapeHtml(post.userId?.profile?.nickname || post.userId?.username)}
                        </a>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-500">${formatDate(post.createdAt)}</span>
                            ${post.visibility === 'followers' ? '<span class="text-xs text-gray-400"><i class="bx bx-group"></i> Followers</span>' : ''}
                            ${post.visibility === 'only-me' ? '<span class="text-xs text-gray-400"><i class="bx bx-lock-alt"></i> Only me</span>' : ''}
                        </div>
                    </div>
                </div>
                <button class="text-gray-500 hover:text-gray-700 transition" onclick="event.stopPropagation(); showPostMenu('${post._id}')">
                    <i class='bx bx-dots-horizontal-rounded text-xl'></i>
                </button>
            </div>
            
            <!-- Post Content -->
            <p class="text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap leading-relaxed">${escapeHtml(post.content)}</p>
            ${imagesHtml}
            ${tagsHtml}
            
            <!-- Post Actions -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t dark:border-gray-700">
                <div class="flex items-center gap-6">
                    <button class="like-btn flex items-center gap-2 transition ${post.isLiked ? 'liked' : 'text-gray-500 hover:text-red-500'}" onclick="event.stopPropagation(); toggleLike('${post._id}', this)">
                        <i class='bx ${post.isLiked ? 'bxs-heart' : 'bx-heart'} text-2xl'></i>
                        <span class="likes-count text-sm font-medium">${post.likesCount || 0}</span>
                    </button>
                    <button class="comment-btn flex items-center gap-2 text-gray-500 hover:text-blue-500 transition" onclick="event.stopPropagation(); focusCommentInput('${post._id}')">
                        <i class='bx bx-comment text-2xl'></i>
                        <span class="comments-count text-sm font-medium">${post.commentsCount || 0}</span>
                    </button>
                    <button class="share-btn flex items-center gap-2 text-gray-500 hover:text-green-500 transition" onclick="event.stopPropagation(); sharePost('${post._id}', this)">
                        <i class='bx bx-share-alt text-2xl'></i>
                        <span class="shares-count text-sm font-medium">${post.sharesCount || 0}</span>
                    </button>
                </div>
                <button class="save-btn transition ${post.isSaved ? 'saved' : 'text-gray-500 hover:text-yellow-500'}" onclick="event.stopPropagation(); toggleSave('${post._id}', this)">
                    <i class='bx ${post.isSaved ? 'bxs-bookmark' : 'bx-bookmark'} text-2xl'></i>
                </button>
            </div>
            
            <!-- Comments Section -->
            <div class="mt-4 pt-3 border-t dark:border-gray-700">
                <div class="comments-container space-y-3" id="comments-${post._id}">
                    <div class="text-center py-2"><div class="loader-small"></div></div>
                </div>
                <div class="flex gap-3 mt-3">
                    <img src="${currentUser?.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-8 h-8 rounded-full object-cover">
                    <div class="flex-1 flex gap-2">
                        <input type="text" id="comment-input-${post._id}" placeholder="Write a comment..." class="comment-input flex-1 p-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button onclick="event.stopPropagation(); addComment('${post._id}')" class="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition text-sm font-medium">
                            Post
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

// ============================================
// Load Comments for a Specific Post
// ============================================
async function loadCommentsForPost(postId) {
    try {
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (response.ok) {
            const container = document.getElementById(`comments-${postId}`);
            if (container) {
                const comments = result.data || [];
                
                if (comments.length === 0) {
                    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">No comments yet. Be the first!</p>';
                } else {
                    container.innerHTML = comments.slice(0, 2).map(comment => `
                        <div class="comment-item flex gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            <img src="${comment.userId?.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-8 h-8 rounded-full object-cover">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <a href="/profile/${comment.userId?.profile?.nickname || comment.userId?.username}" class="font-semibold text-sm hover:text-blue-500">
                                        ${escapeHtml(comment.userId?.profile?.nickname || comment.userId?.username)}
                                    </a>
                                    <span class="text-xs text-gray-500">${formatDate(comment.createdAt)}</span>
                                    ${comment.userId?._id === currentUser?.userId ? `
                                        <button onclick="deleteComment('${comment._id}', '${postId}')" class="text-red-500 text-xs hover:text-red-600 ml-auto">Delete</button>
                                    ` : ''}
                                </div>
                                <p class="text-gray-700 dark:text-gray-300 text-sm mt-1">${escapeHtml(comment.text)}</p>
                            </div>
                        </div>
                    `).join('');
                    
                    if (comments.length > 2) {
                        container.innerHTML += `<button onclick="viewAllComments('${postId}')" class="text-sm text-blue-500 hover:text-blue-600 mt-2 block text-center">View all ${comments.length} comments →</button>`;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// ============================================
// Add Comment to Post
// ============================================
async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    
    if (!text) {
        showToast('Please enter a comment', 'error');
        return;
    }
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            input.value = '';
            await loadCommentsForPost(postId);
            
            // Update comment count
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            const commentsSpan = postCard?.querySelector('.comments-count');
            if (commentsSpan) {
                const current = parseInt(commentsSpan.textContent) || 0;
                commentsSpan.textContent = current + 1;
            }
            showToast('Comment added!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// Delete Comment
// ============================================
async function deleteComment(commentId, postId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/comments/${postId}/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            await loadCommentsForPost(postId);
            
            // Update comment count
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            const commentsSpan = postCard?.querySelector('.comments-count');
            if (commentsSpan) {
                const current = parseInt(commentsSpan.textContent) || 0;
                commentsSpan.textContent = Math.max(0, current - 1);
            }
            showToast('Comment deleted', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// Toggle Like on Post
// ============================================
async function toggleLike(postId, button) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const icon = button.querySelector('i');
            const countSpan = button.querySelector('.likes-count');
            
            if (result.isLiked) {
                icon.className = 'bxs-heart text-2xl';
                button.classList.add('liked');
                button.classList.remove('text-gray-500', 'hover:text-red-500');
            } else {
                icon.className = 'bx-heart text-2xl';
                button.classList.remove('liked');
                button.classList.add('text-gray-500', 'hover:text-red-500');
            }
            
            countSpan.textContent = result.likesCount;
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to like post', 'error');
    }
}

// ============================================
// Toggle Save Post
// ============================================
async function toggleSave(postId, button) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}/save`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const icon = button.querySelector('i');
            
            if (result.isSaved) {
                icon.className = 'bxs-bookmark text-2xl';
                button.classList.add('saved');
                button.classList.remove('text-gray-500', 'hover:text-yellow-500');
                showToast('Post saved!', 'success');
            } else {
                icon.className = 'bx-bookmark text-2xl';
                button.classList.remove('saved');
                button.classList.add('text-gray-500', 'hover:text-yellow-500');
                showToast('Removed from saved', 'info');
            }
        }
    } catch (error) {
        console.error('Error toggling save:', error);
        showToast('Failed to save post', 'error');
    }
}

// ============================================
// Share Post
// ============================================
async function sharePost(postId, button) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}/share`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const countSpan = button.querySelector('.shares-count');
            if (countSpan) countSpan.textContent = result.sharesCount;
            showToast('Post shared!', 'success');
            
            // Copy link to clipboard
            const postUrl = `${window.location.origin}/post.html?id=${postId}`;
            await navigator.clipboard.writeText(postUrl);
            showToast('Link copied to clipboard!', 'success');
        }
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

// ============================================
// Create New Post
// ============================================
async function createPost() {
    const content = document.getElementById('post-content').value.trim();
    const visibility = document.getElementById('post-visibility').value;
    const tagsInput = document.getElementById('post-tags').value;
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    
    if (!content) {
        showToast('Please enter some content', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    formData.append('visibility', visibility);
    formData.append('tags', JSON.stringify(tags));
    
    const imageFiles = document.getElementById('post-images').files;
    for (let i = 0; i < imageFiles.length; i++) {
        formData.append('images', imageFiles[i]);
    }
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: formData
        });
        
        if (response.ok) {
            // Reset form
            document.getElementById('post-content').value = '';
            document.getElementById('post-tags').value = '';
            document.getElementById('post-images').value = '';
            document.getElementById('image-preview').innerHTML = '';
            
            // Close modal
            const modal = document.getElementById('create-post-modal');
            modal.style.display = 'none';
            modal.classList.remove('show');
            
            // Reset feed and reload
            currentPage = 1;
            hasMore = true;
            await loadFeed();
            
            showToast('Post created successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// Image Preview for Create Post
// ============================================
function setupImagePreview() {
    const imageInput = document.getElementById('post-images');
    const previewContainer = document.getElementById('image-preview');
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            previewContainer.innerHTML = '';
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'w-full h-24 object-cover rounded-lg';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }
}

// ============================================
// Load Notifications
// ============================================
async function loadNotifications() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/notifications?limit=10`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (response.ok) {
            const list = document.getElementById('notifications-list');
            const badge = document.getElementById('notif-badge');
            
            if (result.unreadCount > 0) {
                badge.textContent = result.unreadCount > 9 ? '9+' : result.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
            
            if (!list) return;
            
            if (result.data.length === 0) {
                list.innerHTML = '<div class="p-4 text-center text-gray-500">No notifications</div>';
                return;
            }
            
            list.innerHTML = result.data.map(notif => `
                <div class="notification-item p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" onclick="markNotificationRead('${notif._id}')">
                    <div class="flex gap-3">
                        <img src="${notif.actorId?.profile?.avatar || '/assets/img/default-avatar.png'}" class="w-10 h-10 rounded-full object-cover">
                        <div class="flex-1">
                            <p class="text-sm">
                                <span class="font-semibold">${escapeHtml(notif.actorId?.profile?.nickname || notif.actorId?.username || 'System')}</span>
                                ${escapeHtml(notif.content)}
                            </p>
                            <p class="text-xs text-gray-500 mt-1">${formatDate(notif.createdAt)}</p>
                        </div>
                        ${!notif.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>' : ''}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ============================================
// Mark Notification as Read
// ============================================
async function markNotificationRead(notificationId) {
    try {
        const csrfToken = await fetchCsrfToken();
        await fetch(`${cleanApiUrl}/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        await loadNotifications();
        await updateUnreadCount();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// ============================================
// Mark All Notifications as Read
// ============================================
async function markAllNotificationsRead() {
    try {
        const csrfToken = await fetchCsrfToken();
        await fetch(`${cleanApiUrl}/api/notifications/read-all`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        await loadNotifications();
        await updateUnreadCount();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

// ============================================
// Update Unread Count Badge
// ============================================
async function updateUnreadCount() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        const badge = document.getElementById('notif-badge');
        if (badge) {
            if (result.count > 0) {
                badge.textContent = result.count > 9 ? '9+' : result.count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
}

// ============================================
// Follow User
// ============================================
async function followUser(userId, button) {
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
                button.classList.add('bg-gray-500', 'hover:bg-gray-600');
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                showToast('Followed!', 'success');
            } else {
                button.textContent = 'Follow';
                button.classList.remove('bg-gray-500', 'hover:bg-gray-600');
                button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                showToast('Unfollowed', 'info');
            }
            // Reload suggestions to update list
            await loadSuggestions();
            await loadUserStats();
        }
    } catch (error) {
        console.error('Error following user:', error);
        showToast('Failed to follow user', 'error');
    }
}

// ============================================
// Search by Topic
// ============================================
function searchByTopic(topic) {
    window.location.href = `/search.html?q=${encodeURIComponent(topic)}`;
}

// ============================================
// View All Comments for Post
// ============================================
function viewAllComments(postId) {
    window.location.href = `/post.html?id=${postId}`;
}

// ============================================
// Focus Comment Input
// ============================================
function focusCommentInput(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ============================================
// Show Post Menu (Edit/Delete)
// ============================================
function showPostMenu(postId) {
    const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const isOwner = postCard?.querySelector('.post-menu-btn')?.getAttribute('data-is-owner') === 'true';
    
    const options = ['Cancel'];
    if (isOwner) {
        options.unshift('Delete Post', 'Edit Post');
    } else {
        options.unshift('Report Post');
    }
    
    const action = prompt('Select action:\n' + options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'));
    
    if (action === '1' && isOwner) {
        if (confirm('Are you sure you want to delete this post?')) {
            deletePost(postId);
        }
    } else if (action === '2' && isOwner) {
        editPost(postId);
    } else if (action === '1' && !isOwner) {
        reportPost(postId);
    }
}

// ============================================
// Delete Post
// ============================================
async function deletePost(postId) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            const postElement = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postElement) postElement.remove();
            showToast('Post deleted successfully', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// Edit Post
// ============================================
async function editPost(postId) {
    const newContent = prompt('Edit your post:');
    if (!newContent) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ content: newContent })
        });
        
        if (response.ok) {
            // Reload feed to show updated content
            currentPage = 1;
            hasMore = true;
            await loadFeed();
            showToast('Post updated', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error editing post:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// Report Post
// ============================================
async function reportPost(postId) {
    const reason = prompt('Why are you reporting this post?\n(spam, harassment, hate speech, violence, etc.)');
    if (!reason) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                targetType: 'post',
                targetId: postId,
                reason: reason,
                details: ''
            })
        });
        
        if (response.ok) {
            showToast('Report submitted. Thank you for helping keep our community safe.', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error reporting post:', error);
        showToast(error.message, 'error');
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
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif'
            }
        }).showToast();
    } else {
        console.log(message);
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

function openImageModal(url) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    if (img) img.src = url;
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

function startNotificationInterval() {
    if (unreadCountInterval) clearInterval(unreadCountInterval);
    updateUnreadCount();
    unreadCountInterval = setInterval(() => {
        updateUnreadCount();
        loadNotifications();
    }, 30000);
}

// ============================================
// Intersection Observer for Infinite Scroll
// ============================================
function setupIntersectionObserver() {
    const trigger = document.getElementById('load-more-trigger');
    if (!trigger) return;
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            loadFeed();
        }
    }, { threshold: 0.1, rootMargin: '100px' });
    
    observer.observe(trigger);
}


// ============================================
// SEARCH FUNCTIONALITY - Add this entire block
// ============================================

// Load search results for dropdown
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
                    <a href="/profile/${user.profile?.nickname || user.username || user._id}" 
                       class="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b dark:border-gray-700 last:border-0">
                        <img src="${user.profile?.avatar || '/assets/img/default-avatar.png'}" 
                             class="w-10 h-10 rounded-full object-cover">
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-sm truncate">${escapeHtml(user.profile?.nickname || user.username)}</div>
                            <div class="text-xs text-gray-500 truncate">${escapeHtml(user.profile?.jobTitle || 'Professional')}</div>
                            <div class="flex gap-2 mt-1">
                                ${user.stats?.posts ? `<span class="text-xs text-gray-400">📄 ${user.stats.posts}</span>` : ''}
                                ${user.stats?.followers ? `<span class="text-xs text-gray-400">👥 ${user.stats.followers}</span>` : ''}
                                ${user.isFollowing ? '<span class="text-xs text-green-500">● Following</span>' : ''}
                            </div>
                        </div>
                        <i class='bx bx-chevron-right text-gray-400'></i>
                    </a>
                `).join('');
                
                // Add "View all results" button if there are more results
                if (result.pagination?.total > 5) {
                    searchResults.innerHTML += `
                        <a href="/search.html?q=${encodeURIComponent(query)}" 
                           class="block p-3 text-center text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                            View all ${result.pagination.total} results →
                        </a>
                    `;
                }
            } else {
                searchResults.innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <i class='bx bx-user-x text-2xl mb-1'></i>
                        <p class="text-sm">No users found for "${escapeHtml(query)}"</p>
                        <a href="/search.html?q=${encodeURIComponent(query)}" 
                           class="text-blue-600 text-sm mt-1 inline-block">Search all →</a>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error searching users:', error);
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.innerHTML = '<div class="p-4 text-center text-red-500 text-sm">Error loading results</div>';
        }
    }
}

// ============================================
// Setup global search in navbar (UPDATED - Single handler)
// ============================================
function setupGlobalSearch() {
    const globalSearch = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');
    
    if (!globalSearch) return;
    
    let searchTimeout;
    
    // ✅ حدث واحد فقط للـ input
    globalSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        searchTimeout = setTimeout(() => {
            if (query.length >= 2) {
                // Show dropdown results
                loadSearchResults(query);
            } else {
                if (searchResults) searchResults.classList.add('hidden');
            }
        }, 300); // 300ms debounce أسرع قليلاً
    });
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (searchResults && !e.target.closest('#global-search') && !e.target.closest('#search-results')) {
            searchResults.classList.add('hidden');
        }
    });
    
    // ✅ Handle Enter key separately (go to search page)
    globalSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = globalSearch.value.trim();
            if (query.length >= 2) {
                window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
            }
        }
    });
    
    // ✅ Handle focus to show recent searches (optional)
    globalSearch.addEventListener('focus', () => {
        if (globalSearch.value.trim().length >= 2) {
            loadSearchResults(globalSearch.value.trim());
        }
    });
}

// ============================================
// Setup All Event Listeners
// ============================================
function setupEventListeners() {
    // Create Post Modal
    const createPostBtn = document.getElementById('create-post-btn');
    const createModal = document.getElementById('create-post-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const submitPostBtn = document.getElementById('submit-post');
    
    if (createPostBtn && createModal) {
        createPostBtn.addEventListener('click', () => {
            createModal.style.display = 'flex';
            createModal.classList.add('show');
        });
    }
    
    if (closeModalBtn && createModal) {
        closeModalBtn.addEventListener('click', () => {
            createModal.style.display = 'none';
            createModal.classList.remove('show');
        });
    }
    
    if (submitPostBtn) {
        submitPostBtn.addEventListener('click', createPost);
    }
    
    // Close modal on outside click
    if (createModal) {
        createModal.addEventListener('click', (e) => {
            if (e.target === createModal) {
                createModal.style.display = 'none';
                createModal.classList.remove('show');
            }
        });
    }
    
    // Notifications Dropdown
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
    
    // Mark all read button
    const markAllReadBtn = document.getElementById('mark-all-read');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsRead);
    }
    
    // Profile Dropdown
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
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'X-CSRF-Token': csrfToken
                    }
                });
                localStorage.removeItem('userToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/';
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
    
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        if (notifDropdown) notifDropdown.classList.add('hidden');
        if (profileDropdown) profileDropdown.classList.add('hidden');
    });
    
    // Theme toggle (if exists)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }


    setupGlobalSearch();
    
    // Image preview setup
    setupImagePreview();
}

// ============================================
// Initialize Page
// ============================================
async function init() {
    // Check authentication
    if (!userToken) {
        window.location.href = '/login.html?redirect=/feed.html';
        return;
    }
    
    // Load all data
    await loadSiteSettings();
    const userLoaded = await loadCurrentUser();
    
    if (!userLoaded) {
        window.location.href = '/login.html?redirect=/feed.html';
        return;
    }
    
    // Load sidebar data
    await loadTrendingTopics();
    await loadSuggestions();
    await loadRecentJobs();
    
    // Load feed
    await loadFeed();
    
    // Setup features
    setupEventListeners();
    setupIntersectionObserver();
    
    // Load notifications
    await loadNotifications();
    startNotificationInterval();
    
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
}

// Make functions globally available
window.toggleLike = toggleLike;
window.toggleSave = toggleSave;
window.sharePost = sharePost;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.focusCommentInput = focusCommentInput;
window.showPostMenu = showPostMenu;
window.viewAllComments = viewAllComments;
window.searchByTopic = searchByTopic;
window.followUser = followUser;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.markNotificationRead = markNotificationRead;

// Start the app
init();