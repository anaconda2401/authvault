import { supabase } from './supabase.js'

const registerForm = document.getElementById('register-form')
const messageBox = document.getElementById('message')

// Keys from Env
const USER_KEY = import.meta.env.VITE_INVITE_KEY
const ADMIN_KEY = import.meta.env.VITE_ADMIN_INVITE_KEY

function showMessage(text, isError = false) {
    messageBox.textContent = text
    messageBox.className = `mb-6 p-4 rounded-lg text-sm text-center font-medium ${
        isError ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'
    }`
    messageBox.classList.remove('hidden')
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const username = document.getElementById('username').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const inputKey = document.getElementById('invite-key').value.trim()

    let role = 'user'

    // 1. Determine Role based on Key
    if (inputKey === ADMIN_KEY) {
        role = 'admin' // 👑 YOU ARE ADMIN
    } else if (inputKey === USER_KEY) {
        role = 'user'
    } else {
        return showMessage("❌ Invalid Invite Key.", true)
    }

    showMessage(`Creating ${role} account...`)

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    role: role // Passes role to SQL trigger
                }
            }
        })

        if (error) throw error

        showMessage("✅ Account created! Redirecting...")
        setTimeout(() => window.location.href = '/', 1500)

    } catch (err) {
        showMessage(`Error: ${err.message}`, true)
    }
})