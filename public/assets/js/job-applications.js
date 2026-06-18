// js/job-applications.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let jobId = null;
let currentStatus = 'all';
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let selectedApplicationId = null;

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading && hasMore) {
        loadApplications();
    }
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    jobId = urlParams.get('jobId');
    
    if (!jobId) {
        window.location.href = '/my-jobs.html';
        return;
    }
    
    if (!userToken) {
        window.location.href = `/login.html?redirect=/job-applications.html?jobId=${jobId}`;
        return;
    }
    
    await loadCurrentUser();
    await loadJobInfo();
    await loadApplications();
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

async function loadJobInfo() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobId}`);
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('job-title').textContent = result.data.title;
            document.getElementById('company-name').textContent = result.data.companyName || 'Company';
        }
    } catch (error) {
        console.error('Error loading job info:', error);
    }
}

async function loadApplications() {
    if (isLoading) return;
    isLoading = true;
    
    try {
        let url = `${cleanApiUrl}/api/jobs/${jobId}/applications?page=${currentPage}&limit=20`;
        if (currentStatus !== 'all') {
            url += `&status=${currentStatus}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        const container = document.getElementById('applications-container');
        const totalCount = document.getElementById('total-count');
        
        if (currentPage === 1) {
            container.innerHTML = '';
            totalCount.textContent = result.pagination.total;
        }
        
        if (result.data.length === 0 && currentPage === 1) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                    <i class='bx bx-group text-6xl text-gray-400 mb-3'></i>
                    <h3 class="text-lg font-semibold mb-2">No applications yet</h3>
                    <p class="text-gray-500">When candidates apply, they'll appear here</p>
                </div>
            `;
            hasMore = false;
            return;
        }
        
        result.data.forEach(application => {
            container.appendChild(createApplicationCard(application));
        });
        
        hasMore = result.data.length === 20;
        if (hasMore) currentPage++;
        
    } catch (error) {
        console.error('Error loading applications:', error);
        showToast('Failed to load applications', 'error');
    } finally {
        isLoading = false;
    }
}

function createApplicationCard(application) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden';
    
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
                        <span class="status-badge ${statusColors[application.status]} px-2 py-1 rounded-full text-xs">${application.status}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div><i class='bx bx-envelope'></i> ${escapeHtml(application.email)}</div>
                        ${application.phone ? `<div><i class='bx bx-phone'></i> ${escapeHtml(application.phone)}</div>` : ''}
                        <div><i class='bx bx-calendar'></i> Applied: ${new Date(application.appliedAt).toLocaleDateString()}</div>
                        ${application.portfolio ? `<div><i class='bx bx-link'></i> <a href="${application.portfolio}" target="_blank" class="text-blue-500">Portfolio</a></div>` : ''}
                        ${application.linkedin ? `<div><i class='bx bxl-linkedin'></i> <a href="${application.linkedin}" target="_blank" class="text-blue-500">LinkedIn</a></div>` : ''}
                        ${application.github ? `<div><i class='bx bxl-github'></i> <a href="${application.github}" target="_blank" class="text-blue-500">GitHub</a></div>` : ''}
                    </div>
                    
                    ${application.coverLetter ? `
                        <div class="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p class="text-sm font-semibold mb-1">Cover Letter:</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(application.coverLetter.substring(0, 300))}${application.coverLetter.length > 300 ? '...' : ''}</p>
                            ${application.coverLetter.length > 300 ? `<button onclick="showFullCoverLetter('${application._id}')" class="text-xs text-blue-500 mt-1">Read more</button>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="flex flex-wrap gap-2 mt-4">
                        <button onclick="updateStatus('${application._id}', 'shortlisted')" class="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                            ⭐ Shortlist
                        </button>
                        <button onclick="openInterviewModal('${application._id}')" class="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600">
                            📅 Schedule Interview
                        </button>
                        <button onclick="updateStatus('${application._id}', 'accepted')" class="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                            ✅ Accept
                        </button>
                        <button onclick="updateStatus('${application._id}', 'rejected')" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                            ❌ Reject
                        </button>
                        ${application.resume?.url ? `
                            <a href="${application.resume.url}" target="_blank" class="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                                📄 Download Resume
                            </a>
                        ` : ''}
                        <button onclick="addNote('${application._id}')" class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                            📝 Add Note
                        </button>
                    </div>
                    
                    ${application.employerNotes ? `
                        <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p class="text-sm font-semibold mb-1">Your Note:</p>
                            <p class="text-sm">${escapeHtml(application.employerNotes)}</p>
                        </div>
                    ` : ''}
                    
                    ${application.interviews?.length > 0 ? `
                        <div class="mt-3">
                            <p class="text-sm font-semibold mb-2">Interview History:</p>
                            ${application.interviews.map(interview => `
                                <div class="text-sm p-2 bg-gray-100 dark:bg-gray-700 rounded mb-1">
                                    <span class="font-medium">${interview.type}:</span> ${new Date(interview.scheduledAt).toLocaleString()}
                                    ${interview.meetingLink ? `<a href="${interview.meetingLink}" target="_blank" class="text-blue-500 ml-2">Join</a>` : ''}
                                    <span class="text-xs text-gray-500 ml-2">(${interview.status})</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    return div;
}

async function updateStatus(applicationId, status) {
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
            await loadApplications();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showToast(error.message, 'error');
    }
}

async function addNote(applicationId) {
    const note = prompt('Add a note about this candidate:');
    if (note === null) return;
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/applications/${applicationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ employerNotes: note })
        });
        
        if (response.ok) {
            showToast('Note added successfully!', 'success');
            currentPage = 1;
            hasMore = true;
            await loadApplications();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error adding note:', error);
        showToast(error.message, 'error');
    }
}

function openInterviewModal(applicationId) {
    selectedApplicationId = applicationId;
    const modal = document.getElementById('interview-modal');
    modal.classList.add('flex');
    modal.classList.remove('hidden');
    
    // Set default datetime (tomorrow at 10 AM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    document.getElementById('interview-datetime').value = tomorrow.toISOString().slice(0, 16);
}

async function scheduleInterview() {
    if (!selectedApplicationId) return;
    
    const scheduledAt = document.getElementById('interview-datetime').value;
    const type = document.getElementById('interview-type').value;
    const meetingLink = document.getElementById('interview-link').value;
    
    if (!scheduledAt) {
        showToast('Please select date and time', 'error');
        return;
    }
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/applications/${selectedApplicationId}/interview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ scheduledAt, type, meetingLink })
        });
        
        if (response.ok) {
            showToast('Interview scheduled successfully!', 'success');
            closeInterviewModal();
            currentPage = 1;
            hasMore = true;
            await loadApplications();
        } else {
            const error = await response.json();
            throw new Error(error.error);
        }
    } catch (error) {
        console.error('Error scheduling interview:', error);
        showToast(error.message, 'error');
    }
}

function closeInterviewModal() {
    const modal = document.getElementById('interview-modal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    selectedApplicationId = null;
    document.getElementById('interview-link').value = '';
}

function setupEventListeners() {
    // Status filters
    document.querySelectorAll('.status-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            currentStatus = status;
            currentPage = 1;
            hasMore = true;
            
            // Update button styles
            document.querySelectorAll('.status-filter').forEach(b => {
                b.classList.remove('bg-blue-500', 'text-white');
                b.classList.add('bg-gray-200', 'dark:bg-gray-700');
            });
            btn.classList.add('bg-blue-500', 'text-white');
            btn.classList.remove('bg-gray-200', 'dark:bg-gray-700');
            
            loadApplications();
        });
    });
    
    // Interview modal
    document.getElementById('schedule-interview')?.addEventListener('click', scheduleInterview);
    document.getElementById('close-interview-modal')?.addEventListener('click', closeInterviewModal);
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