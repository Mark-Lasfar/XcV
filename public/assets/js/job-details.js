// js/job-details.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentJob = null;

const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!jobId) {
        window.location.href = '/jobs.html';
        return;
    }
    
    await loadCurrentUser();
    await loadJobDetails();
    setupEventListeners();
});

async function loadCurrentUser() {
    if (!userToken) return;
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

async function loadJobDetails() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobId}`, {
            headers: userToken ? { 'Authorization': `Bearer ${userToken}` } : {}
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error);
        
        currentJob = result.data;
        renderJobDetails();
    } catch (error) {
        console.error('Error loading job:', error);
        showToast('Failed to load job details', 'error');
    }
}

function renderJobDetails() {
    const job = currentJob;
    
    document.title = `${job.title} - ${job.companyName || 'Job'} | MGZon`;
    
    document.getElementById('job-title').textContent = job.title;
    document.getElementById('company-name').textContent = job.companyName || job.employerId?.profile?.nickname || 'Company';
    
    // Meta info
    const metaHtml = `
        <div class="flex items-center gap-2"><i class='bx bx-briefcase'></i> ${job.jobType}</div>
        <div class="flex items-center gap-2"><i class='bx bx-map'></i> ${job.isRemote ? 'Remote' : job.location}</div>
        <div class="flex items-center gap-2"><i class='bx bx-dollar-circle'></i> ${formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.isSalaryNegotiable)}</div>
        <div class="flex items-center gap-2"><i class='bx bx-calendar'></i> Deadline: ${new Date(job.deadline).toLocaleDateString()}</div>
        <div class="flex items-center gap-2"><i class='bx bx-user'></i> ${job.experienceLevel}</div>
    `;
    document.getElementById('job-meta').innerHTML = metaHtml;
    
    // Description
    document.getElementById('job-description').innerHTML = `
        <h2 class="text-lg font-semibold mb-3">Job Description</h2>
        <div class="prose dark:prose-invert max-w-none">
            <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${escapeHtml(job.description)}</p>
        </div>
    `;
    
    // Requirements
    if (job.requirements) {
        document.getElementById('job-requirements').innerHTML = `
            <h2 class="text-lg font-semibold mb-3">Requirements</h2>
            <div class="prose dark:prose-invert max-w-none">
                <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${escapeHtml(job.requirements)}</p>
            </div>
        `;
    }
    
    // Responsibilities
    if (job.responsibilities) {
        document.getElementById('job-responsibilities').innerHTML = `
            <h2 class="text-lg font-semibold mb-3">Responsibilities</h2>
            <div class="prose dark:prose-invert max-w-none">
                <p class="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${escapeHtml(job.responsibilities)}</p>
            </div>
        `;
    }
    
    // Skills
    if (job.requiredSkills && job.requiredSkills.length > 0) {
        document.getElementById('job-skills').innerHTML = `
            <h2 class="text-lg font-semibold mb-3">Required Skills</h2>
            <div class="flex flex-wrap gap-2">
                ${job.requiredSkills.map(skill => `
                    <span class="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">${escapeHtml(skill)}</span>
                `).join('')}
            </div>
        `;
    }
    
    // Apply button
    const applyBtn = document.getElementById('apply-btn');
    if (job.hasApplied) {
        applyBtn.textContent = job.applicationStatus === 'accepted' ? '✅ Application Accepted' :
                              job.applicationStatus === 'rejected' ? '❌ Application Rejected' :
                              '📝 Already Applied';
        applyBtn.href = '#';
        applyBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (job.status !== 'active' || new Date(job.deadline) < new Date()) {
        applyBtn.textContent = 'Job Closed';
        applyBtn.href = '#';
        applyBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-500');
    } else {
        applyBtn.href = `/apply-job.html?id=${job._id}`;
    }
    
    // Save button
    const saveBtn = document.getElementById('save-job');
    const saveIcon = saveBtn.querySelector('i');
    if (job.isSaved) {
        saveIcon.className = 'bxs-bookmark text-2xl text-yellow-500';
    }
}

function setupEventListeners() {
    const saveBtn = document.getElementById('save-job');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!userToken) {
                showToast('Please login to save jobs', 'error');
                return;
            }
            await toggleSave();
        });
    }
    
    const shareBtn = document.getElementById('share-job');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const url = window.location.href;
            navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard!', 'success');
        });
    }
}

async function toggleSave() {
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
            const saveBtn = document.getElementById('save-job');
            const icon = saveBtn.querySelector('i');
            
            if (result.isSaved) {
                icon.className = 'bxs-bookmark text-2xl text-yellow-500';
                showToast('Job saved!', 'success');
            } else {
                icon.className = 'bx-bookmark text-2xl';
                showToast('Job removed from saved', 'info');
            }
        }
    } catch (error) {
        console.error('Error saving job:', error);
        showToast('Failed to save job', 'error');
    }
}

function formatSalary(min, max, currency, isNegotiable) {
    if (isNegotiable) return 'Negotiable';
    if (min && max) return `${formatNumber(min)} - ${formatNumber(max)} ${currency}`;
    if (min) return `From ${formatNumber(min)} ${currency}`;
    if (max) return `Up to ${formatNumber(max)} ${currency}`;
    return 'Not specified';
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function showToast(message, type) {
    Toastify({
        text: message,
        duration: 3000,
        style: { background: type === 'success' ? '#10b981' : '#ef4444' }
    }).showToast();
}

async function fetchCsrfToken() {
    const response = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken;
}