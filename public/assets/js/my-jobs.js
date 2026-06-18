// js/my-jobs.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentTab = 'active';
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let jobToDelete = null;

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && hasMore && currentTab !== 'applications') {
        loadJobs();
    }
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', async () => {
    if (!userToken) {
        window.location.href = '/login.html?redirect=/my-jobs.html';
        return;
    }
    
    await loadCurrentUser();
    await loadStats();
    await loadJobs();
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

async function loadStats() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs/my`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (response.ok) {
            const jobs = result.data;
            const activeJobs = jobs.filter(j => j.status === 'active' && new Date(j.deadline) > new Date());
            const totalApplications = jobs.reduce((sum, j) => sum + (j.applicationsCount || 0), 0);
            const pendingApplications = jobs.reduce((sum, j) => sum + (j.pendingCount || 0), 0);
            
            document.getElementById('total-jobs').textContent = jobs.length;
            document.getElementById('active-jobs').textContent = activeJobs.length;
            document.getElementById('total-applications').textContent = totalApplications;
            document.getElementById('pending-applications').textContent = pendingApplications;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadJobs() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        let url;
        if (currentTab === 'applications') {
            url = `${cleanApiUrl}/api/jobs/my/applications?page=${currentPage}&limit=20`;
        } else {
            let status = '';
            if (currentTab === 'active') status = 'active';
            url = `${cleanApiUrl}/api/jobs/my?page=${currentPage}&limit=10${status ? `&status=${status}` : ''}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        const container = document.getElementById('jobs-container');
        
        if (currentPage === 1) {
            container.innerHTML = '';
        }
        
        if (result.data.length === 0 && currentPage === 1) {
            if (currentTab === 'applications') {
                container.innerHTML = `
                    <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                        <i class='bx bx-group text-6xl text-gray-400 mb-3'></i>
                        <h3 class="text-lg font-semibold mb-2">No applications yet</h3>
                        <p class="text-gray-500">When candidates apply, you'll see them here</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                        <i class='bx bx-briefcase text-6xl text-gray-400 mb-3'></i>
                        <h3 class="text-lg font-semibold mb-2">No jobs posted yet</h3>
                        <p class="text-gray-500 mb-4">Post your first job to start receiving applications</p>
                        <a href="/post-job.html" class="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                            Post a Job
                        </a>
                    </div>
                `;
            }
            hasMore = false;
            return;
        }
        
        if (currentTab === 'applications') {
            result.data.forEach(application => {
                container.appendChild(createApplicationCard(application));
            });
        } else {
            result.data.forEach(job => {
                container.appendChild(createJobCard(job));
            });
        }
        
        hasMore = result.data.length === (currentTab === 'applications' ? 20 : 10);
        if (hasMore) currentPage++;
        
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load data', 'error');
    } finally {
        isLoading = false;
    }
}

function createJobCard(job) {
    const div = document.createElement('div');
    div.className = 'job-item bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden';
    
    const statusClass = `status-${job.status}`;
    const statusText = {
        'active': 'Active',
        'paused': 'Paused',
        'closed': 'Closed',
        'expired': 'Expired'
    }[job.status] || job.status;
    
    const isExpired = new Date(job.deadline) < new Date();
    const deadlineClass = isExpired ? 'text-red-500' : 'text-gray-500';
    
    div.innerHTML = `
        <div class="p-5">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-3 flex-wrap mb-2">
                        <h3 class="text-lg font-semibold hover:text-blue-500 cursor-pointer" onclick="viewJob('${job._id}')">${escapeHtml(job.title)}</h3>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                        ${job.isFeatured ? '<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full">⭐ Featured</span>' : ''}
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">${escapeHtml(job.companyName || 'Your Company')}</p>
                    <div class="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                        <span><i class='bx bx-map'></i> ${job.isRemote ? 'Remote' : job.location}</span>
                        <span><i class='bx bx-calendar'></i> Deadline: <span class="${deadlineClass}">${new Date(job.deadline).toLocaleDateString()}</span></span>
                        <span><i class='bx bx-group'></i> ${job.applicationsCount || 0} applicants</span>
                        <span><i class='bx bx-show'></i> ${job.views || 0} views</span>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="viewApplications('${job._id}')" class="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                            <i class='bx bx-group'></i> Applications (${job.applicationsCount || 0})
                        </button>
                        <button onclick="editJob('${job._id}')" class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                            <i class='bx bx-edit-alt'></i> Edit
                        </button>
                        <button onclick="duplicateJob('${job._id}')" class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                            <i class='bx bx-copy'></i> Duplicate
                        </button>
                        <button onclick="deleteJobPrompt('${job._id}')" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                            <i class='bx bx-trash'></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return div;
}

function createApplicationCard(application) {
    const div = document.createElement('div');
    div.className = 'job-item bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden';
    
    const statusColors = {
        'pending': 'bg-yellow-100 text-yellow-700',
        'reviewed': 'bg-blue-100 text-blue-700',
        'shortlisted': 'bg-purple-100 text-purple-700',
        'interview': 'bg-indigo-100 text-indigo-700',
        'accepted': 'bg-green-100 text-green-700',
        'rejected': 'bg-red-100 text-red-700'
    };
    
    div.innerHTML = `
        <div class="p-5">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center gap-3 flex-wrap mb-2">
                        <h3 class="text-lg font-semibold">${escapeHtml(application.fullName)}</h3>
                        <span class="status-badge ${statusColors[application.status]}">${application.status}</span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">
                        Applied for: <span class="font-medium">${escapeHtml(application.jobId?.title)}</span>
                    </p>
                    <div class="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                        <span><i class='bx bx-envelope'></i> ${escapeHtml(application.email)}</span>
                        ${application.phone ? `<span><i class='bx bx-phone'></i> ${escapeHtml(application.phone)}</span>` : ''}
                        <span><i class='bx bx-calendar'></i> Applied: ${new Date(application.appliedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="viewApplication('${application._id}')" class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                            <i class='bx bx-show'></i> View Details
                        </button>
                        <button onclick="updateApplicationStatus('${application._id}', 'shortlisted')" class="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                            Shortlist
                        </button>
                        <button onclick="updateApplicationStatus('${application._id}', 'interview')" class="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600">
                            Interview
                        </button>
                        ${application.resume?.url ? `
                            <a href="${application.resume.url}" target="_blank" class="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                                <i class='bx bx-file'></i> Resume
                            </a>
                        ` : ''}
                    </div>
                    ${application.employerNotes ? `
                        <div class="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                <span class="font-semibold">Your note:</span> ${escapeHtml(application.employerNotes)}
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    return div;
}

async function updateApplicationStatus(applicationId, status) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/applications/${applicationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showToast(`Application ${status} successfully!`, 'success');
            currentPage = 1;
            hasMore = true;
            await loadJobs();
            await loadStats();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showToast(error.message, 'error');
    }
}

async function deleteJobPrompt(jobId) {
    jobToDelete = jobId;
    const modal = document.getElementById('delete-modal');
    modal.classList.add('flex');
    modal.classList.remove('hidden');
}

async function confirmDeleteJob() {
    if (!jobToDelete) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            showToast('Job deleted successfully', 'success');
            currentPage = 1;
            hasMore = true;
            await loadJobs();
            await loadStats();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        showToast(error.message, 'error');
    } finally {
        closeDeleteModal();
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    jobToDelete = null;
}

async function duplicateJob(jobId) {
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobId}/duplicate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (response.ok) {
            showToast('Job duplicated successfully!', 'success');
            currentPage = 1;
            hasMore = true;
            await loadJobs();
            await loadStats();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error duplicating job:', error);
        showToast(error.message, 'error');
    }
}

function viewJob(jobId) {
    window.location.href = `/job-details.html?id=${jobId}`;
}

function viewApplications(jobId) {
    window.location.href = `/job-applications.html?jobId=${jobId}`;
}

function editJob(jobId) {
    window.location.href = `/edit-job.html?id=${jobId}`;
}

function viewApplication(applicationId) {
    window.location.href = `/application-details.html?id=${applicationId}`;
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab === currentTab) return;
            
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('text-blue-600', 'border-blue-600');
                b.classList.add('text-gray-600', 'dark:text-gray-400');
            });
            btn.classList.add('text-blue-600', 'border-blue-600');
            btn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            currentTab = tab;
            currentPage = 1;
            hasMore = true;
            loadJobs();
        });
    });
    
    // Delete modal
    document.getElementById('confirm-delete')?.addEventListener('click', confirmDeleteJob);
    document.getElementById('cancel-delete')?.addEventListener('click', closeDeleteModal);
}

function showToast(message, type) {
    Toastify({
        text: message,
        duration: 3000,
        style: { background: type === 'success' ? '#10b981' : '#ef4444' }
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