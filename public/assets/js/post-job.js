// js/post-job.js
const API_URL = window.ENV.API_URL;
const cleanApiUrl = API_URL.replace(/\/$/, '');
let userToken = localStorage.getItem('userToken');
let skills = [];
let descriptionQuill, requirementsQuill, responsibilitiesQuill;

// Initialize Quill editors
document.addEventListener('DOMContentLoaded', async () => {
    if (!userToken) {
        window.location.href = '/login.html?redirect=/post-job.html';
        return;
    }
    
    descriptionQuill = new Quill('#description-editor', {
        theme: 'snow',
        placeholder: 'Describe the job position, daily tasks, team culture...'
    });
    
    requirementsQuill = new Quill('#requirements-editor', {
        theme: 'snow',
        placeholder: 'List the qualifications, education, and experience required...'
    });
    
    responsibilitiesQuill = new Quill('#responsibilities-editor', {
        theme: 'snow',
        placeholder: 'Describe the day-to-day responsibilities...'
    });
    
    await loadCurrentUser();
    setupEventListeners();
    setDefaultDeadline();
});

async function loadCurrentUser() {
    try {
        const response = await fetch(`${cleanApiUrl}/api/verify-token`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const user = await response.json();
            document.getElementById('user-avatar').src = user.profile?.avatar || '/assets/img/default-avatar.png';
            document.getElementById('company-name').value = user.profile?.portfolioName || user.username;
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

function setDefaultDeadline() {
    const deadlineInput = document.getElementById('deadline');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    deadlineInput.value = defaultDate.toISOString().split('T')[0];
}

function setupEventListeners() {
    // Add skill
    document.getElementById('add-skill')?.addEventListener('click', () => {
        const input = document.getElementById('skill-input');
        const skill = input.value.trim();
        if (skill && !skills.includes(skill)) {
            skills.push(skill);
            updateSkillsUI();
            input.value = '';
        }
    });
    
    document.getElementById('skill-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('add-skill').click();
        }
    });
    
    // Form submission
    document.getElementById('job-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitJob('active');
    });
    
    // Save draft
    document.getElementById('save-draft')?.addEventListener('click', async () => {
        await submitJob('draft');
    });
}

function updateSkillsUI() {
    const container = document.getElementById('skills-container');
    container.innerHTML = skills.map(skill => `
        <span class="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-2">
            ${escapeHtml(skill)}
            <button type="button" onclick="removeSkill('${escapeHtml(skill)}')" class="hover:text-red-500">&times;</button>
        </span>
    `).join('');
    document.getElementById('skills').value = JSON.stringify(skills);
}

function removeSkill(skill) {
    skills = skills.filter(s => s !== skill);
    updateSkillsUI();
}

async function submitJob(status) {
    // Validate required fields
    const title = document.getElementById('title').value.trim();
    const category = document.getElementById('category').value;
    const jobType = document.getElementById('job-type').value;
    const experienceLevel = document.getElementById('experience-level').value;
    const location = document.getElementById('location').value.trim();
    const deadline = document.getElementById('deadline').value;
    const description = descriptionQuill.root.innerHTML;
    const requirements = requirementsQuill.root.innerHTML;
    
    if (!title || !category || !jobType || !experienceLevel || !location || !deadline || !description || !requirements) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const jobData = {
        title,
        category,
        jobType,
        experienceLevel,
        location,
        isRemote: document.getElementById('remote').checked,
        salaryMin: parseInt(document.getElementById('salary-min').value) || null,
        salaryMax: parseInt(document.getElementById('salary-max').value) || null,
        salaryCurrency: document.getElementById('salary-currency').value,
        isSalaryNegotiable: document.getElementById('salary-negotiable').checked,
        description,
        requirements,
        responsibilities: responsibilitiesQuill.root.innerHTML || '',
        requiredSkills: skills,
        vacancies: parseInt(document.getElementById('vacancies').value) || 1,
        deadline,
        companyName: document.getElementById('company-name').value || null,
        companyWebsite: document.getElementById('company-website').value || null,
        isFeatured: document.getElementById('is-featured').checked,
        status
    };
    
    try {
        const csrfToken = await fetchCsrfToken();
        const response = await fetch(`${cleanApiUrl}/api/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(jobData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(status === 'active' ? 'Job posted successfully!' : 'Job saved as draft', 'success');
            setTimeout(() => {
                window.location.href = '/my-jobs.html';
            }, 1500);
        } else {
            throw new Error(result.error || result.message);
        }
    } catch (error) {
        console.error('Error posting job:', error);
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

async function fetchCsrfToken() {
    const response = await fetch(`${cleanApiUrl}/api/csrf-token`, { credentials: 'include' });
    const data = await response.json();
    return data.csrfToken;
}   