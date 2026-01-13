import { getUser, initDatabase, getCurrentUser, logout, getUserProfile, upsertUserProfile, deleteUserAccount, updateUser } from './database.js';
import { getTranslation } from './i18n.js';

document.addEventListener('DOMContentLoaded', function () {
  initDatabase().then(function () {
    var currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '../../index.html';
      return;
    }

    // Initial Load
    loadProfile();

    // Mode Toggles
    window.toggleMode = function () {
      var viewMode = document.getElementById('viewMode');
      var editMode = document.getElementById('editMode');

      if (viewMode.classList.contains('hidden')) {
        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
      } else {
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');

        // Pre-fill edit form
        document.getElementById('editName').value = document.getElementById('viewName').textContent;
        var surname = document.getElementById('editSurname');
        if (surname) surname.value = document.getElementById('heroName').textContent.replace(document.getElementById('viewName').textContent, '').trim();
      }
    };

    // Logout Logic
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout();
        window.location.href = '../../index.html';
      });
    }

    // Profile Pic Upload Listeners
    var profileUpload = document.getElementById('profileUpload');
    var profilePreview = document.getElementById('profilePreview');

    if (profileUpload) {
      profileUpload.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            alert('Image size too large. Please select an image under 2MB.');
            return;
          }
          var reader = new FileReader();
          reader.onload = function (event) {
            if (profilePreview) {
              profilePreview.src = event.target.result;
              // Synchronize other images
              var headerPics = document.querySelectorAll('#headerProfilePic, .header-profile-pic, .w-12.h-12.rounded-full img');
              headerPics.forEach(function (img) {
                img.src = event.target.result;
              });
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Form Submissions
    var profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', handleProfileUpdate);
    }

    var deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteAccount);
    }
  });
});

function loadProfile() {
  var currentUser = getCurrentUser();
  getUser(currentUser).then(function (user) {
    getUserProfile(currentUser).then(function (profile) {
      var firstName = (profile && profile.fullName) || (user && user.firstName) || 'KAROAB';
      var surname = (profile && profile.surname) || (user && user.surname) || '';
      var email = (profile && profile.email) || (user && user.email) || '-';
      var phone = (profile && profile.phone) || (user && user.phone) || '-';
      var profilePic = (profile && profile.profilePic) || '../../assets/images/default-avatar.png';

      // Update View Mode
      var viewName = document.getElementById('viewName');
      var viewEmail = document.getElementById('viewEmail');
      var viewPhone = document.getElementById('viewPhone');
      var heroName = document.getElementById('heroName');
      var displayFullName = document.getElementById('displayFullName');
      var profilePreview = document.getElementById('profilePreview');

      if (viewName) viewName.textContent = firstName;
      if (viewEmail) viewEmail.textContent = email;
      if (viewPhone) viewPhone.textContent = phone;
      if (heroName) heroName.textContent = (firstName + ' ' + surname).trim();
      if (displayFullName) displayFullName.textContent = (firstName + ' ' + surname).trim();
      if (profilePreview) profilePreview.src = profilePic;

      // Pre-fill edit inputs
      var editName = document.getElementById('editName');
      var editSurname = document.getElementById('editSurname');
      var editEmail = document.getElementById('editEmail');
      var editPhone = document.getElementById('editPhone');

      if (editName) editName.value = firstName;
      if (editSurname) editSurname.value = surname;
      if (editEmail) editEmail.value = email;
      if (editPhone) editPhone.value = phone;
    });
  });
}

function handleProfileUpdate(e) {
  e.preventDefault();
  var currentUser = getCurrentUser();
  var name = document.getElementById('editName').value.trim();
  var surname = document.getElementById('editSurname').value.trim();
  var email = document.getElementById('editEmail').value.trim();
  var phone = document.getElementById('editPhone').value.trim();
  var currentPassword = document.getElementById('currentPassword').value;
  var newPassword = document.getElementById('newPassword').value;

  getUser(currentUser).then(function (user) {
    if (!user) {
      alert('User not found');
      return;
    }

    // Password Update Logic
    if (newPassword) {
      if (!currentPassword) {
        alert('Please enter your current password to set a new one.');
        return;
      }
      if (currentPassword !== user.password) {
        alert('Current password incorrect.');
        return;
      }
      if (newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
      }
      user.password = newPassword;
    }

    // Update User Store
    user.firstName = name;
    user.surname = surname;
    user.email = email;
    user.phone = phone;

    updateUser(user).then(function () {
      saveProfileData();
    }).catch(function (err) {
      console.error('Update user error:', err);
      alert('Failed to update user credentials.');
    });
  });

  function saveProfileData() {
    var profilePreview = document.getElementById('profilePreview');
    var currentProfilePic = profilePreview ? profilePreview.src : null;

    upsertUserProfile({
      username: currentUser,
      fullName: name,
      surname: surname,
      email: email,
      phone: phone,
      updatedAt: new Date(),
      profilePic: currentProfilePic
    }).then(function () {
      alert('Profile updated successfully!');
      location.reload();
    }).catch(function (error) {
      console.error('Update error:', error);
      alert('Failed to update profile');
    });
  }
}

function deleteAccount() {
  var warning = 'Are you sure? This action cannot be undone. All your financial data will be permanently deleted.';
  if (confirm(warning)) {
    if (confirm('FINAL WARNING: Please confirm you want to permanently delete your account.')) {
      var currentUser = getCurrentUser();
      deleteUserAccount(currentUser).then(function () {
        logout();
        window.location.href = '../../index.html';
      }).catch(function (error) {
        console.error('Delete error:', error);
        alert('Failed to delete account.');
      });
    }
  }
}
