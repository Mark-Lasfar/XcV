// js/jobs.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentUser = null;

// Pagination
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentFilters = {};

// View mode
let viewMode = localStorage.getItem('jobsViewMode') || 'list';

// Observer for infinite scroll
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && hasMore) {
        loadJobs();
    }
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', async () => {
    if (!userToken) {
        window.location.href = '/login.html?redirect=/jobs.html';
        return;
    }
    
    await loadCurrentUser();
    await loadCategories();
    await loadJobs();
    setupEventListeners();
    
    const trigger = document.getElementById('load-more-trigger');
    if (trigger) observer.observe(trigger);
    
    // Apply saved view mode
    applyViewMode();
});

async function loadCurrentUser() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('user-avatar').src = currentUser.profile?.avatar || '/assets/img/default-avatar.png';
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs/categories`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const categorySelect = document.getElementById('filter-category');
            const originalOptions = categorySelect.innerHTML;
            
            result.data.forEach(cat => {
                if (!originalOptions.includes(cat.name)) {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = `${cat.icon ? '💻' : '📌'} ${cat.name} (${cat.count || 0})`;
                    categorySelect.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadJobs() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        // Build query string
        const params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('limit', 10);
        
        const searchInput = document.getElementById('search-input')?.value;
        if (searchInput) params.append('search', searchInput);
        
        const location = document.getElementById('location-input')?.value;
        if (location) params.append('location', location);
        
        const category = document.getElementById('filter-category')?.value;
        if (category) params.append('category', category);
        
        const jobType = document.getElementById('filter-job-type')?.value;
        if (jobType) params.append('jobType', jobType);
        
        const experience = document.getElementById('filter-experience')?.value;
        if (experience) params.append('experienceLevel', experience);
        
        const salaryMin = document.getElementById('filter-salary-min')?.value;
        if (salaryMin) params.append('salaryMin', salaryMin);
        
        const salaryMax = document.getElementById('filter-salary-max')?.value;
        if (salaryMax) params.append('salaryMax', salaryMax);
        
        const remote = document.getElementById('filter-remote')?.checked;
        if (remote) params.append('isRemote', 'true');
        
        const sortBy = document.getElementById('sort-by')?.value;
        if (sortBy) params.append('sortBy', sortBy);
        
        const response = await fetch(`${cleanApiUrl}/api/jobs?${params.toString()}`, {
            headers: userToken ? { 'Authorization': `Bearer ${userToken}` } : {}
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        const container = document.getElementById('jobs-container');
        const featuredContainer = document.getElementById('featured-jobs');
        const jobsCount = document.getElementById('jobs-count');
        
        if (currentPage === 1) {
            container.innerHTML = '';
            
            // Show featured jobs
            if (result.featured && result.featured.length > 0) {
                featuredContainer.innerHTML = `
                    <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
                        <i class='bx bx-star text-yellow-500'></i> Featured Jobs
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${result.featured.map(job => createJobCard(job, true)).join('')}
                    </div>
                `;
            } else {
                featuredContainer.innerHTML = '';
            }
            
            jobsCount.textContent = result.pagination.total;
        }
        
        if (result.data.length === 0 && currentPage === 1) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                    <i class='bx bx-briefcase-alt-2 text-6xl text-gray-400 mb-3'></i>
                    <h3 class="text-lg font-semibold mb-2">No jobs found</h3>
                    <p class="text-gray-500">Try adjusting your filters or search terms</p>
                </div>
            `;
            hasMore = false;
            return;
        }
        
        result.data.forEach(job => {
            container.appendChild(createJobCardElement(job));
        });
        
        hasMore = result.data.length === 10;
        if (hasMore) currentPage++;
        
    } catch (error) {
        console.error('Error loading jobs:', error);
        showToast('Failed to load jobs', 'error');
    } finally {
        isLoading = false;
    }
}

function createJobCardElement(job) {
    const div = document.createElement('div');
    div.className = `job-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${viewMode === 'grid' ? 'grid-view' : ''}`;
    div.innerHTML = createJobCard(job, false);
    
    // Add event listener for save button
    const saveBtn = div.querySelector('.save-job-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSaveJob(job._id, saveBtn);
        });
    }
    
    // Make card clickable
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.save-job-btn') && !e.target.closest('a')) {
            window.location.href = `/job-details.html?id=${job._id}`;
        }
    });
    div.style.cursor = 'pointer';
    
    return div;
}

function createJobCard(job, isFeatured = false) {
    const salaryText = job.salaryMin && job.salaryMax 
        ? `${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)} ${job.salaryCurrency}`
        : job.isSalaryNegotiable ? 'Salary negotiable' : 'Salary not specified';
    
    const postedDate = formatDate(job.postedAt);
    const deadlineDate = formatDate(job.deadline);
    const isDeadlineSoon = new Date(job.deadline) - new Date() < 7 * 24 * 60 * 60 * 1000;
    
    const jobTypeIcon = {
        'full-time': 'bx-briefcase',
        'part-time': 'bx-time',
        'contract': 'bx-file',
        'freelance': 'bx-user',
        'internship': 'bx-graduation',
        'remote': 'bx-wifi'
    }[job.jobType] || 'bx-briefcase';
    
    const levelColors = {
        'entry': 'bg-green-100 text-green-700',
        'junior': 'bg-blue-100 text-blue-700',
        'mid': 'bg-yellow-100 text-yellow-700',
        'senior': 'bg-orange-100 text-orange-700',
        'lead': 'bg-purple-100 text-purple-700',
        'executive': 'bg-red-100 text-red-700'
    };
    
    return `
        <div class="p-5">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap mb-2">
                        <h3 class="text-lg font-semibold hover:text-blue-500">${escapeHtml(job.title)}</h3>
                        ${isFeatured ? '<span class="featured-badge text-white text-xs px-2 py-1 rounded-full">Featured</span>' : ''}
                        ${job.isRemote ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">🌍 Remote</span>' : ''}
                        ${isDeadlineSoon ? '<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">⚠️ Deadline soon</span>' : ''}
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">${escapeHtml(job.companyName || job.employerId?.profile?.nickname || 'Company')}</p>
                    <div class="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                        <span><i class='bx ${jobTypeIcon}'></i> ${job.jobType}</span>
                        <span><i class='bx bx-map'></i> ${job.isRemote ? 'Remote' : job.location}</span>
                        <span><i class='bx bx-dollar-circle'></i> ${salaryText}</span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">${escapeHtml(job.description.substring(0, 150))}${job.description.length > 150 ? '...' : ''}</p>
                    <div class="flex flex-wrap gap-2 mb-3">
                        ${job.requiredSkills?.slice(0, 3).map(skill => `
                            <span class="bg-gray-100 dark:bg-gray-700 text-xs px-2 py-1 rounded-full">${escapeHtml(skill)}</span>
                        `).join('')}
                        ${job.requiredSkills?.length > 3 ? `<span class="text-xs text-gray-500">+${job.requiredSkills.length - 3}</span>` : ''}
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-xs text-gray-400">
                            <span>Posted ${postedDate}</span>
                            <span class="mx-2">•</span>
                            <span class="${isDeadlineSoon ? 'text-red-500' : ''}">Deadline ${deadlineDate}</span>
                        </div>
                        <div class="flex gap-2">
                            ${!job.hasApplied ? `
                                <a href="/apply-job.html?id=${job._id}" class="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition">
                                    Apply Now
                                </a>
                            ` : `
                                <span class="px-4 py-1.5 bg-gray-300 text-gray-600 rounded-lg text-sm">
                                    ${job.applicationStatus === 'accepted' ? '✅ Accepted' : 
                                      job.applicationStatus === 'rejected' ? '❌ Rejected' : 
                                      '📝 Applied'}
                                </span>
                            `}
                            <button class="save-job-btn p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${job.isSaved ? 'saved' : ''}">
                                <i class='bx ${job.isSaved ? 'bxs-bookmark' : 'bx-bookmark'} text-xl'></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function toggleSaveJob(jobId, button) {
    if (!userToken) {
        showToast('Please login to save jobs', 'error');
        return;
    }
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobId}/save`, {
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
                icon.className = 'bxs-bookmark text-xl';
                button.classList.add('saved');
                showToast('Job saved!', 'success');
            } else {
                icon.className = 'bx-bookmark text-xl';
                button.classList.remove('saved');
                showToast('Job removed from saved', 'info');
            }
        }
    } catch (error) {
        console.error('Error saving job:', error);
        showToast('Failed to save job', 'error');
    }
}

function setupEventListeners() {
    // Search
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            hasMore = true;
            loadJobs();
        });
    }
    
    // Filter inputs
    const filterInputs = ['filter-category', 'filter-job-type', 'filter-experience', 'filter-salary-min', 'filter-salary-max', 'filter-remote', 'sort-by'];
    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                currentPage = 1;
                hasMore = true;
                loadJobs();
            });
        }
    });
    
    // Location input with debounce
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
        let timeout;
        locationInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentPage = 1;
                hasMore = true;
                loadJobs();
            }, 500);
        });
    }
    
    // Search input with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentPage = 1;
                hasMore = true;
                loadJobs();
            }, 500);
        });
    }
    
    // Clear filters
    const clearFilters = document.getElementById('clear-filters');
    if (clearFilters) {
        clearFilters.addEventListener('click', () => {
            document.getElementById('filter-category').value = '';
            document.getElementById('filter-job-type').value = '';
            document.getElementById('filter-experience').value = '';
            document.getElementById('filter-salary-min').value = '';
            document.getElementById('filter-salary-max').value = '';
            document.getElementById('filter-remote').checked = false;
            document.getElementById('sort-by').value = 'latest';
            document.getElementById('search-input').value = '';
            document.getElementById('location-input').value = '';
            currentPage = 1;
            hasMore = true;
            loadJobs();
        });
    }
    
    // View mode
    const viewGrid = document.getElementById('view-grid');
    const viewList = document.getElementById('view-list');
    
    if (viewGrid) {
        viewGrid.addEventListener('click', () => {
            viewMode = 'grid';
            localStorage.setItem('jobsViewMode', 'grid');
            applyViewMode();
            currentPage = 1;
            hasMore = true;
            loadJobs();
        });
    }
    
    if (viewList) {
        viewList.addEventListener('click', () => {
            viewMode = 'list';
            localStorage.setItem('jobsViewMode', 'list');
            applyViewMode();
            currentPage = 1;
            hasMore = true;
            loadJobs();
        });
    }
    
    // Mobile filter
    const mobileToggle = document.getElementById('mobile-filter-toggle');
    const filterSidebar = document.querySelector('.filter-sidebar');
    const filterOverlay = document.getElementById('filter-overlay');
    const applyFiltersMobile = document.getElementById('apply-filters-mobile');
    
    if (mobileToggle && filterSidebar) {
        mobileToggle.addEventListener('click', () => {
            filterSidebar.classList.add('open');
            if (filterOverlay) filterOverlay.classList.add('open');
        });
    }
    
    if (applyFiltersMobile && filterSidebar) {
        applyFiltersMobile.addEventListener('click', () => {
            filterSidebar.classList.remove('open');
            if (filterOverlay) filterOverlay.classList.remove('open');
        });
    }
    
    if (filterOverlay) {
        filterOverlay.addEventListener('click', () => {
            filterSidebar?.classList.remove('open');
            filterOverlay.classList.remove('open');
        });
    }
}

function applyViewMode() {
    const container = document.getElementById('jobs-container');
    if (container) {
        if (viewMode === 'grid') {
            container.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
        } else {
            container.className = 'space-y-4';
        }
    }
}

// Utility functions
function formatSalary(amount) {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toString();
}

function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        if (hours < 1) return 'Just now';
        return `${hours}h ago`;
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}d ago`;
    }
    return d.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function showToast(message, type) {
    Toastify({
        text: message,
        duration: 3000,
        style: { background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6' }
    }).showToast();
}

async function fetchCsrfToken() {
    const response = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken;
}