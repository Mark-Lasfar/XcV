// ============================================
// auth.js - ملف متكامل ومحدث
// ✅ لا يعيد تعريف API_URL أو cleanApiUrl
// ✅ يستخدم المتغيرات العامة من main.js
// ✅ متوافق تماماً مع main.js المحدث
// ============================================

/* ============================================
   ملاحظة: هذا الملف يعتمد على المتغيرات العامة التالية من main.js:
   - cleanApiUrl (مشتق من API_URL)
   - fetchCsrfToken() (دالة لجلب CSRF token)
   - userToken (لتخزين التوكن)
   - fetchWithRefresh() (دالة للطلبات مع تحديث التوكن)
   ============================================ */

// ============================================
// 1. تسجيل الدخول
// ============================================
async function handleLogin() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    const loader = document.getElementById('loader');

    // التحقق من صحة المدخلات
    if (!email || !password) {
        if (errorEl) errorEl.textContent = 'Please enter email and password.';
        return;
    }

    // تعطيل الزر وإظهار اللودر
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
    }
    if (loader) loader.style.display = 'flex';

    try {
        // جلب CSRF token (الدالة موجودة في main.js)
        let csrfToken;
        try {
            csrfToken = await fetchCsrfToken();
        } catch (e) {
            console.warn('fetchCsrfToken not available, using fallback');
            // Fallback إذا كانت الدالة غير متوفرة
            const csrfResponse = await fetch(`${cleanApiUrl}/api/csrf-token`, {
                method: 'GET',
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();
            csrfToken = csrfData.csrfToken;
        }
        
        if (!csrfToken) throw new Error('Failed to fetch CSRF token');

        // إرسال طلب تسجيل الدخول
        const response = await fetch(`${cleanApiUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ email, password })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Invalid credentials');
        }

        // معالجة الاستجابة
        if (data.message === 'OTP sent to your email') {
            if (errorEl) errorEl.textContent = '';
            const otpEmailSpan = document.getElementById('otp-email');
            if (otpEmailSpan) otpEmailSpan.textContent = email;
            const loginForm = document.getElementById('login-form');
            const otpForm = document.getElementById('otp-form');
            if (loginForm) loginForm.classList.add('hidden');
            if (otpForm) otpForm.classList.remove('hidden');
        } else if (data.token) {
            localStorage.setItem('userToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            window.location.href = `${window.ENV.WEB_URL}/profile/me`;
        } else {
            throw new Error(data.error || 'Unexpected response');
        }
    } catch (error) {
        console.error('Login error:', error);
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `Login failed: ${error.message}`,
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
        }
        if (errorEl) errorEl.textContent = error.message;
    } finally {
        if (loader) loader.style.display = 'none';
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }
}

// ============================================
// 2. التحقق من OTP
// ============================================
async function handleVerifyOtp() {
    const email = document.getElementById('email')?.value.trim();
    const otp = document.getElementById('otp')?.value.trim();
    const errorEl = document.getElementById('login-error');
    const verifyBtn = document.getElementById('verify-otp-btn');
    const loader = document.getElementById('loader');

    if (!otp) {
        if (errorEl) errorEl.textContent = 'Please enter the OTP.';
        return;
    }

    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`${cleanApiUrl}/api/login/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        if (!response.ok) {
            const text = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                throw new Error('Invalid server response');
            }
            throw new Error(errorData.error || 'Invalid OTP');
        }

        const data = await response.json();
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        window.location.href = `${window.ENV.WEB_URL}/profile/me`;
    } catch (error) {
        console.error('OTP verification error:', error);
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `OTP verification failed: ${error.message}`,
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
        }
        if (errorEl) errorEl.textContent = error.message;
    } finally {
        if (loader) loader.style.display = 'none';
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify OTP';
        }
    }
}

// ============================================
// 3. إرسال رمز إعادة تعيين كلمة المرور
// ============================================
async function handleForgotPassword() {
    const email = document.getElementById('forgot-email')?.value.trim();
    const errorEl = document.getElementById('login-error');
    const forgotBtn = document.getElementById('forgot-password-btn');
    const loader = document.getElementById('loader');

    if (!email) {
        if (errorEl) errorEl.textContent = 'Please enter your email.';
        return;
    }

    if (forgotBtn) {
        forgotBtn.disabled = true;
        forgotBtn.textContent = 'Sending...';
    }
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`${cleanApiUrl}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send reset code');
        }

        if (errorEl) errorEl.textContent = '';
        const resetEmailSpan = document.getElementById('reset-email');
        if (resetEmailSpan) resetEmailSpan.textContent = email;
        
        const forgotForm = document.getElementById('forgot-password-form');
        const resetForm = document.getElementById('reset-password-form');
        if (forgotForm) forgotForm.classList.add('hidden');
        if (resetForm) resetForm.classList.remove('hidden');

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: 'Reset code sent to your email!',
                duration: 3000,
                style: { background: '#10b981' }
            }).showToast();
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `Failed to send reset code: ${error.message}`,
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
        }
        if (errorEl) errorEl.textContent = error.message;
    } finally {
        if (loader) loader.style.display = 'none';
        if (forgotBtn) {
            forgotBtn.disabled = false;
            forgotBtn.textContent = 'Send Reset Code';
        }
    }
}

// ============================================
// 4. إعادة تعيين كلمة المرور (بعد استلام الكود)
// ============================================
async function handleResetPassword() {
    const emailElement = document.getElementById('reset-email');
    const email = emailElement?.textContent?.trim() || '';
    const otp = document.getElementById('reset-otp')?.value.trim();
    const newPassword = document.getElementById('new-password')?.value.trim();
    const errorEl = document.getElementById('login-error');
    const resetBtn = document.getElementById('reset-password-btn');
    const loader = document.getElementById('loader');

    if (!otp || !newPassword) {
        if (errorEl) errorEl.textContent = 'Please enter the reset code and new password.';
        return;
    }

    if (newPassword.length < 8) {
        if (errorEl) errorEl.textContent = 'Password must be at least 8 characters.';
        return;
    }

    if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.textContent = 'Resetting...';
    }
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`${cleanApiUrl}/api/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to reset password');
        }

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: 'Password reset successfully! Please login.',
                duration: 3000,
                style: { background: '#10b981' }
            }).showToast();
        }

        const resetForm = document.getElementById('reset-password-form');
        const loginForm = document.getElementById('login-form');
        if (resetForm) resetForm.classList.add('hidden');
        if (loginForm) loginForm.classList.remove('hidden');
        
        // مسح الحقول
        const resetOtpInput = document.getElementById('reset-otp');
        const newPasswordInput = document.getElementById('new-password');
        if (resetOtpInput) resetOtpInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        
    } catch (error) {
        console.error('Reset password error:', error);
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `Failed to reset password: ${error.message}`,
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
        }
        if (errorEl) errorEl.textContent = error.message;
    } finally {
        if (loader) loader.style.display = 'none';
        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.textContent = 'Reset Password';
        }
    }
}

// ============================================
// 5. تسجيل حساب جديد
// ============================================
async function handleRegister() {
    const username = document.getElementById('username')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    const errorEl = document.getElementById('register-error');
    const registerBtn = document.getElementById('register-btn');
    const loader = document.getElementById('loader');

    // التحقق من صحة المدخلات
    if (!username || !email || !password) {
        if (errorEl) errorEl.textContent = 'Please enter username, email, and password.';
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorEl) errorEl.textContent = 'Invalid email format.';
        return;
    }

    if (password.length < 8) {
        if (errorEl) errorEl.textContent = 'Password must be at least 8 characters long.';
        return;
    }

    if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Registering...';
    }
    if (loader) loader.style.display = 'flex';

    try {
        const response = await fetch(`${cleanApiUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        localStorage.setItem('userToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: 'Registration successful! Redirecting to profile...',
                duration: 3000,
                style: { background: '#10b981' }
            }).showToast();
        }

        setTimeout(() => {
            window.location.href = `${window.ENV.WEB_URL}/profile/me`;
        }, 1000);
    } catch (error) {
        console.error('Registration error:', error);
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: `Registration failed: ${error.message}`,
                duration: 3000,
                style: { background: '#ef4444' }
            }).showToast();
        }
        if (errorEl) errorEl.textContent = error.message;
    } finally {
        if (loader) loader.style.display = 'none';
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register';
        }
    }
}

// ============================================
// 6. تهيئة صفحة تسجيل الدخول
// ============================================
function initLoginPage() {
    // زر تسجيل الدخول
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        // إزالة المستمعين القدامى لتجنب التكرار
        const newLoginBtn = loginBtn.cloneNode(true);
        loginBtn.parentNode?.replaceChild(newLoginBtn, loginBtn);
        newLoginBtn.addEventListener('click', handleLogin);
    }

    // إظهار/إخفاء كلمة المرور
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        const newToggle = togglePassword.cloneNode(true);
        togglePassword.parentNode?.replaceChild(newToggle, togglePassword);
        newToggle.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const toggleIcon = newToggle.querySelector('i');
            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.classList.remove('bx-show');
                    toggleIcon.classList.add('bx-hide');
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.classList.remove('bx-hide');
                    toggleIcon.classList.add('bx-show');
                }
            }
        });
    }

    // زر التحقق من OTP
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    if (verifyOtpBtn) {
        const newVerifyBtn = verifyOtpBtn.cloneNode(true);
        verifyOtpBtn.parentNode?.replaceChild(newVerifyBtn, verifyOtpBtn);
        newVerifyBtn.addEventListener('click', handleVerifyOtp);
    }

    // رابط نسيت كلمة المرور
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        const newForgotLink = forgotPasswordLink.cloneNode(true);
        forgotPasswordLink.parentNode?.replaceChild(newForgotLink, forgotPasswordLink);
        newForgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            const loginForm = document.getElementById('login-form');
            const forgotForm = document.getElementById('forgot-password-form');
            if (loginForm) loginForm.classList.add('hidden');
            if (forgotForm) forgotForm.classList.remove('hidden');
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
        });
    }

    // رجوع إلى تسجيل الدخول من صفحة نسيت كلمة المرور
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        const newBackToLogin = backToLogin.cloneNode(true);
        backToLogin.parentNode?.replaceChild(newBackToLogin, backToLogin);
        newBackToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            const forgotForm = document.getElementById('forgot-password-form');
            const loginForm = document.getElementById('login-form');
            if (forgotForm) forgotForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
        });
    }

    // رجوع إلى تسجيل الدخول من صفحة إعادة تعيين كلمة المرور
    const backToLoginReset = document.getElementById('back-to-login-reset');
    if (backToLoginReset) {
        const newBackToLoginReset = backToLoginReset.cloneNode(true);
        backToLoginReset.parentNode?.replaceChild(newBackToLoginReset, backToLoginReset);
        newBackToLoginReset.addEventListener('click', (e) => {
            e.preventDefault();
            const resetForm = document.getElementById('reset-password-form');
            const loginForm = document.getElementById('login-form');
            if (resetForm) resetForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.textContent = '';
        });
    }

    // زر إرسال كود إعادة التعيين
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    if (forgotPasswordBtn) {
        const newForgotBtn = forgotPasswordBtn.cloneNode(true);
        forgotPasswordBtn.parentNode?.replaceChild(newForgotBtn, forgotPasswordBtn);
        newForgotBtn.addEventListener('click', handleForgotPassword);
    }

    // إظهار/إخفاء كلمة المرور الجديدة
    const toggleNewPassword = document.getElementById('toggle-new-password');
    if (toggleNewPassword) {
        const newToggleNew = toggleNewPassword.cloneNode(true);
        toggleNewPassword.parentNode?.replaceChild(newToggleNew, toggleNewPassword);
        newToggleNew.addEventListener('click', () => {
            const passwordInput = document.getElementById('new-password');
            const toggleIcon = newToggleNew.querySelector('i');
            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.classList.remove('bx-show');
                    toggleIcon.classList.add('bx-hide');
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.classList.remove('bx-hide');
                    toggleIcon.classList.add('bx-show');
                }
            }
        });
    }

    // زر إعادة تعيين كلمة المرور
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    if (resetPasswordBtn) {
        const newResetBtn = resetPasswordBtn.cloneNode(true);
        resetPasswordBtn.parentNode?.replaceChild(newResetBtn, resetPasswordBtn);
        newResetBtn.addEventListener('click', handleResetPassword);
    }

    // عرض رسالة خطأ من الـ URL
    const urlParams = new URLSearchParams(window.location.search);
    const reason = urlParams.get('reason');
    const errorEl = document.getElementById('login-error');
    if (reason && errorEl) {
        errorEl.textContent = decodeURIComponent(reason);
    }

    // إخفاء روابط تسجيل الدخول والتسجيل في صفحة login
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
}

// ============================================
// 7. تهيئة صفحة التسجيل
// ============================================
function initRegisterPage() {
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        const newRegisterBtn = registerBtn.cloneNode(true);
        registerBtn.parentNode?.replaceChild(newRegisterBtn, registerBtn);
        newRegisterBtn.addEventListener('click', handleRegister);
    }

    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        const newToggle = togglePassword.cloneNode(true);
        togglePassword.parentNode?.replaceChild(newToggle, togglePassword);
        newToggle.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const toggleIcon = newToggle.querySelector('i');
            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.classList.remove('bx-show');
                    toggleIcon.classList.add('bx-hide');
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.classList.remove('bx-hide');
                    toggleIcon.classList.add('bx-show');
                }
            }
        });
    }

    // إخفاء روابط معينة في صفحة التسجيل
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    if (registerLink) registerLink.style.display = 'none';
    if (loginLink) loginLink.style.display = 'block';
}

// ============================================
// 8. الانتظار حتى يتم تحميل main.js بالكامل
// ============================================
function waitForMainJs() {
    return new Promise((resolve) => {
        // التحقق من وجود الدوال المهمة من main.js
        const checkInterval = setInterval(() => {
            if (typeof cleanApiUrl !== 'undefined' && typeof fetchCsrfToken === 'function') {
                clearInterval(checkInterval);
                resolve(true);
            }
        }, 50);
        
        // مهلة 5 ثواني
        setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('Main.js not fully loaded after 5 seconds, continuing anyway');
            resolve(false);
        }, 5000);
    });
}

// ============================================
// 9. التشغيل عند تحميل الصفحة
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    // انتظر تحميل main.js
    await waitForMainJs();
    
    // تهيئة الصفحة حسب المسار
    const pathname = window.location.pathname;
    
    if (pathname === '/login.html') {
        initLoginPage();
    } else if (pathname === '/register.html') {
        initRegisterPage();
    }
});

// ============================================
// تصدير الدوال (للاستخدام في حالات خاصة)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleLogin,
        handleVerifyOtp,
        handleForgotPassword,
        handleResetPassword,
        handleRegister,
        initLoginPage,
        initRegisterPage
    };
}