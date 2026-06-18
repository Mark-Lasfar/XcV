// js/apply-job.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let currentUser = null;

const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!userToken) {
        window.location.href = `/login.html?redirect=/apply-job.html?id=${jobId}`;
        return;
    }
    
    if (!jobId) {
        window.location.href = '/jobs.html';
        return;
    }
    
    await loadCurrentUser();
    await loadJobInfo();
    setupForm();
});

async function loadCurrentUser() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('full-name').value = currentUser.profile?.nickname || currentUser.username || '';
            document.getElementById('email').value = currentUser.email || '';
            document.getElementById('phone').value = currentUser.profile?.phone || '';
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
            document.getElementById('company-name').textContent = result.data.companyName || result.data.employerId?.profile?.nickname || 'Company';
        }
    } catch (error) {
        console.error('Error loading job:', error);
    }
}

async function setupForm() {
    const form = document.getElementById('application-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitApplication();
    });
}

async function submitApplication() {
    const formData = new FormData();
    formData.append('fullName', document.getElementById('full-name').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('coverLetter', document.getElementById('cover-letter').value);
    formData.append('portfolio', document.getElementById('portfolio').value);
    formData.append('linkedin', document.getElementById('linkedin').value);
    formData.append('github', document.getElementById('github').value);
    
    const resumeFile = document.getElementById('resume').files[0];
    if (resumeFile) {
        formData.append('resume', resumeFile);
    }
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs/${jobId}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Application submitted successfully!', 'success');
            setTimeout(() => {
                window.location.href = `/job-details.html?id=${jobId}`;
            }, 2000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error submitting application:', error);
        showToast(error.message, 'error');
    }
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