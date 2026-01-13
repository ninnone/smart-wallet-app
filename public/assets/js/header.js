import { initDatabase, getCurrentUser, getUserProfile, getUser, getTransactions, getLoans } from './database.js';

export function loadGlobalHeader() {
    initDatabase().then(function () {
        var currentUser = getCurrentUser();
        if (!currentUser) return;

        getUserProfile(currentUser).then(function (profile) {
            getUser(currentUser).then(function (user) {
                getTransactions(currentUser).then(function (transactions) {
                    getLoans(currentUser).then(function (loans) {
                        var fullName = (profile && profile.fullName) || (user && user.firstName) || currentUser;
                        var profilePic = (profile && profile.profilePic) || null;

                        var balanceValue = transactions.reduce(function (acc, t) {
                            var amt = parseFloat(t.amount) || 0;
                            if (t.type === 'income') return acc + amt;
                            if (t.type === 'expense') return acc - amt;
                            if (t.type === 'savings') return acc - amt;
                            return acc;
                        }, 0);

                        var totalLoans = loans.reduce(function (acc, l) { return acc + (parseFloat(l.amount) || 0); }, 0);
                        balanceValue += totalLoans;

                        var userNameElements = document.querySelectorAll('#userName, #headerUserName');
                        userNameElements.forEach(function (el) {
                            el.textContent = fullName;
                        });

                        var balanceElements = document.querySelectorAll('#headerBalance, #sidebarBalance');
                        balanceElements.forEach(function (el) {
                            el.textContent = balanceValue.toFixed(0) + ' XAF';
                        });

                        var profilePicContainers = document.querySelectorAll('.w-12.h-12.rounded-full, .header-profile-pic, #profilePreview');
                        profilePicContainers.forEach(function (container) {
                            if (profilePic) {
                                if (container.tagName === 'IMG') {
                                    container.src = profilePic;
                                } else {
                                    container.innerHTML = '<img src="' + profilePic + '" class="w-full h-full rounded-full object-cover" alt="Profile">';
                                    container.classList.remove('bg-gradient-to-br', 'from-primary-500', 'to-primary-600', 'flex', 'items-center', 'justify-center', 'text-white', 'font-bold', 'text-lg');
                                }
                            } else {
                                var initial = (fullName.charAt(0) || 'K').toUpperCase();
                                if (container.tagName !== 'IMG') {
                                    container.textContent = initial;
                                }
                            }
                        });

                        setupSidebarToggle();
                    });
                });
            });
        });
    });
}

function setupSidebarToggle() {
    var sidebar = document.querySelector('.sidebar');
    var toggleBtn = document.getElementById('sidebarToggle');

    var overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });

        overlay.addEventListener('click', function () {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlobalHeader);
} else {
    loadGlobalHeader();
}
