import { supabase } from './supabase.js'

// --- AUTH & INIT ---
async function initAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return window.location.href = '/'

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        alert("⛔ Access Denied")
        await supabase.auth.signOut()
        window.location.href = '/'
        return
    }

    loadUsers()
    loadWebsites()
}

// --- UI TABS ---
const tabUsers = document.getElementById('tab-users')
const tabWebsites = document.getElementById('tab-websites')
const panelUsers = document.getElementById('panel-users')
const panelWebsites = document.getElementById('panel-websites')

tabUsers.onclick = () => { switchTab(tabUsers, panelUsers, tabWebsites, panelWebsites) }
tabWebsites.onclick = () => { switchTab(tabWebsites, panelWebsites, tabUsers, panelUsers) }

function switchTab(activeTab, activePanel, inactiveTab, inactivePanel) {
    activeTab.classList.add('active', 'border-b-white', 'bg-white', 'text-blue-600')
    activeTab.classList.remove('bg-gray-100', 'text-gray-500')
    activePanel.classList.remove('hidden')
    
    inactiveTab.classList.remove('active', 'border-b-white', 'bg-white', 'text-blue-600')
    inactiveTab.classList.add('bg-gray-100', 'text-gray-500')
    inactivePanel.classList.add('hidden')
}

// ==========================================
// 👤 USERS MANAGEMENT
// ==========================================
async function loadUsers() {
    console.log("Fetching users..."); // Debug log

    const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

    // 1. Check for Errors in Console
    if (error) {
        console.error("Supabase Error:", error);
        alert("Error loading users! Check console (F12).");
        return;
    }

    console.log("Users found:", users); // Debug log

    const container = document.getElementById('users-list')
    
    if (users.length === 0) {
        container.innerHTML = `<div class="text-gray-400 text-center p-4">No users found in database.</div>`;
        return;
    }

    // 2. Render with DARK MODE colors (text-white, bg-slate-700)
    container.innerHTML = users.map(u => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-700 bg-slate-800/50 hover:bg-slate-700 transition rounded mb-2">
            <div class="mb-2 sm:mb-0">
                <div class="font-bold text-white flex items-center gap-2">
                    ${u.username || 'No Name'} 
                    <span class="text-xs font-normal text-gray-400 border border-gray-600 px-1 rounded">
                        ${u.role}
                    </span>
                </div>
                <div class="text-xs text-gray-400 font-mono">${u.email}</div>
            </div>
            
            <div class="flex items-center gap-3">
                <span class="px-2 py-1 text-xs rounded-full font-bold ${u.is_active ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}">
                    ${u.is_active ? 'ACTIVE' : 'DISABLED'}
                </span>

                <button onclick="window.toggleUser('${u.id}', ${!u.is_active})" 
                    class="px-3 py-1 text-xs font-semibold rounded border border-gray-600 hover:bg-slate-600 text-gray-300 transition">
                    ${u.is_active ? 'Disable' : 'Enable'}
                </button>

                <button onclick="window.deleteUser('${u.id}')" class="text-gray-500 hover:text-red-500 p-1 transition" title="Delete User">
                    🗑
                </button>
            </div>
        </div>
    `).join('')
}

window.toggleUser = async (id, status) => {
    await supabase.from('user_profiles').update({ is_active: status }).eq('id', id)
    loadUsers()
}

window.deleteUser = async (id) => {
    if (confirm('⚠️ PERMANENTLY DELETE USER?\nThis cannot be undone.')) {
        // We must delete from auth.users (requires Supabase Service Key usually), 
        // BUT Supabase 'On Delete Cascade' on profiles table will fail if we try to delete profile first.
        // NOTE: Standard RLS cannot delete from auth.users. 
        // Workaround: We delete the profile, effectively "ghosting" them, or use an Edge Function for real delete.
        // For this version: We delete the PROFILE.
        
        const { error } = await supabase.from('user_profiles').delete().eq('id', id)
        if (error) alert("Error: " + error.message)
        else loadUsers()
    }
}


// ==========================================
// 🌐 WEBSITES MANAGEMENT
// ==========================================
async function loadWebsites() {
    const { data: sites, error } = await supabase
        .from('websites')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return console.error(error)

    document.getElementById('websites-list').innerHTML = sites.map(s => `
        <div class="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 transition">
            <div>
                <h3 class="font-bold text-gray-800">${s.name}</h3>
                <code class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">${s.domain}</code>
            </div>
            <div class="flex items-center gap-3">
                 <span class="text-xs font-bold ${s.is_active ? 'text-green-600' : 'text-gray-400'}">
                    ${s.is_active ? '● Live' : '○ Offline'}
                </span>

                <button onclick="window.toggleWebsite('${s.id}', ${!s.is_active})" 
                    class="text-xs font-semibold underline ${s.is_active ? 'text-orange-500' : 'text-green-600'}">
                    ${s.is_active ? 'Pause' : 'Activate'}
                </button>

                <button onclick="window.deleteWebsite('${s.id}')" class="text-gray-400 hover:text-red-600 p-1">
                    🗑
                </button>
            </div>
        </div>
    `).join('')
}

window.toggleWebsite = async (id, status) => {
    await supabase.from('websites').update({ is_active: status }).eq('id', id)
    loadWebsites()
}

window.deleteWebsite = async (id) => {
    if (confirm('Remove this website from whitelist?')) {
        await supabase.from('websites').delete().eq('id', id)
        loadWebsites()
    }
}

// Add New Site
document.getElementById('add-site-btn').addEventListener('click', async () => {
    const name = document.getElementById('site-name').value
    const domain = document.getElementById('site-domain').value
    
    if (!name || !domain) return alert("Please fill details")

    const { error } = await supabase.from('websites').insert({ name, domain })
    if (error) alert(error.message)
    else {
        document.getElementById('site-name').value = ''
        document.getElementById('site-domain').value = ''
        loadWebsites()
    }
})

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
})

// Start
initAdmin()