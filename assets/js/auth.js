import { initDatabase, addUser, getUser, setCurrentUser, upsertUserProfile } from './database.js';
import { setLanguage, getTranslation } from './i18n.js';

let isSignup = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDatabase();
  } catch (error) {
    console.error('Database initialization failed:', error);
    const specificError = error?.message || error?.name || '';
    const message = getTranslation('auth.dbInitError') + (specificError ? ` (${specificError})` : '');
    showError(message);
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const switchButton = document.getElementById('switchToSignup');

  loginForm.addEventListener('submit', handleLogin);
  switchButton.addEventListener('click', toggleSignup);
});

function toggleSignup() {
  isSignup = !isSignup;
  const title = document.getElementById('formTitle');
  const switchBtn = document.getElementById('switchToSignup');
  const switchText = document.getElementById('switchText');
  const submitBtn = document.getElementById('submitBtn');

  hideError();
  hideSuccess();
  clearFieldErrors();

  const signupFields = document.getElementById('signupFields');

  if (isSignup) {
    title.setAttribute('data-i18n', 'signup.title');
    title.textContent = getTranslation('signup.title');
    document.getElementById('formSubtitle').setAttribute('data-i18n', 'signup.subtitle_form');
    document.getElementById('formSubtitle').textContent = getTranslation('signup.subtitle_form');
    submitBtn.querySelector('span').setAttribute('data-i18n', 'signup.createAccount');
    submitBtn.querySelector('span').textContent = getTranslation('signup.createAccount');
    switchBtn.setAttribute('data-i18n', 'login.switchToSignin');
    switchBtn.textContent = getTranslation('login.switchToSignin');
    switchText.setAttribute('data-i18n', 'login.alreadyAccount');
    switchText.textContent = getTranslation('login.alreadyAccount');
    signupFields.classList.remove('hidden');
  } else {
    title.setAttribute('data-i18n', 'login.title');
    title.textContent = getTranslation('login.title');
    document.getElementById('formSubtitle').setAttribute('data-i18n', 'login.subtitle_form');
    document.getElementById('formSubtitle').textContent = getTranslation('login.subtitle_form');
    submitBtn.querySelector('span').setAttribute('data-i18n', 'login.signin');
    submitBtn.querySelector('span').textContent = getTranslation('login.signin');
    switchBtn.setAttribute('data-i18n', 'login.createAccount');
    switchBtn.textContent = getTranslation('login.createAccount');
    switchText.setAttribute('data-i18n', 'login.noAccount');
    switchText.textContent = getTranslation('login.noAccount');
    signupFields.classList.add('hidden');
  }

  document.getElementById('username').focus();
}

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  hideError();
  hideSuccess();
  clearFieldErrors();

  let hasError = false;

  if (!username) {
    showFieldError('username', getTranslation('auth.usernameRequired'));
    hasError = true;
  } else if (username.length < 3) {
    showFieldError('username', getTranslation('auth.usernameMinLength'));
    hasError = true;
  }

  if (!password) {
    showFieldError('password', getTranslation('auth.passwordRequired'));
    hasError = true;
  } else if (password.length < 6) {
    showFieldError('password', getTranslation('auth.passwordMinLength'));
    hasError = true;
  }

  if (isSignup) {
  }

  if (hasError) {
    showError(getTranslation('auth.fixErrors'));
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

  try {
    if (isSignup) {
      const existingUser = await getUser(username);
      if (existingUser) {
        showFieldError('username', getTranslation('auth.usernameExists'));
        showError(getTranslation('auth.usernameTaken'));
        return;
      }

      const fullName = document.getElementById('fullName').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();

      await addUser({
        username,
        password,
        firstName: fullName.split(' ')[0] || '',
        surname: fullName.split(' ').slice(1).join(' ') || '',
        email,
        phone,
        createdAt: new Date()
      });

      const defaultProfilePic = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232B9FD9"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z"/></svg>')}`;

      await upsertUserProfile({
        username,
        fullName: fullName,
        surname: '',
        email,
        phone,
        profilePic: defaultProfilePic,
        updatedAt: new Date()
      });

      showSuccess(getTranslation('auth.signupSuccess'));

      setTimeout(() => {
        toggleSignup();
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
      }, 1500);
    } else {
      const user = await getUser(username);
      if (!user) {
        showFieldError('username', getTranslation('auth.userNotFound'));
        showError(getTranslation('auth.invalidCredentials'));
        return;
      }

      if (user.password !== password) {
        showFieldError('password', getTranslation('auth.incorrectPassword'));
        showError(getTranslation('auth.invalidCredentials'));
        return;
      }

      setCurrentUser(username);
      showSuccess(getTranslation('auth.loginSuccess'));

      setTimeout(() => {
        window.location.href = 'src/pages/dashboard.html';
      }, 1000);
    }
  } catch (error) {
    console.error('Auth error:', error);
    showError(getTranslation('auth.genericError'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

function showError(message) {
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');

  errorMessage.textContent = message;
  errorAlert.classList.remove('hidden');

  errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.classList.add('hidden');
}

function showSuccess(message) {
  const successAlert = document.getElementById('successAlert');
  const successMessage = document.getElementById('successMessage');

  successMessage.textContent = message;
  successAlert.classList.remove('hidden');

  successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideSuccess() {
  const successAlert = document.getElementById('successAlert');
  successAlert.classList.add('hidden');
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(`${fieldId}Error`);

  field.classList.add('border-red-500', 'focus:ring-red-500');
  field.classList.remove('border-gray-200');

  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
}

function clearFieldErrors() {
  const fields = ['username', 'password'];
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);

    if (field) {
      field.classList.remove('border-red-500', 'focus:ring-red-500');
      field.classList.add('border-gray-200');
    }

    if (errorElement) {
      errorElement.classList.add('hidden');
    }
  });
}