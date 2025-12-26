import { supabase } from './supabase.js'

const loginForm = document.getElementById('login-form')
const messageBox = document.getElementById('message')

function showMessage(text, isError = false) {
    messageBox.textContent = text
    messageBox.className = `mb-6 p-4 rounded-lg text-sm text-center font-medium ${
        isError ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'
    }`
    messageBox.classList.remove('hidden')
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value

    showMessage('Verifying credentials...')

    try {
        // 1. Authenticate
        const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error

        // 2. Check Role & Status (Security Gate)
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('is_active')
            .eq('id', user.id)
            .single()

        if (profileError || !profile || !profile.is_active) {
            await supabase.auth.signOut()
            throw new Error("Access Denied: Account is disabled or invalid.")
        }

        // 3. Process Redirect
        await handleRedirect(session.access_token)

    } catch (err) {
        showMessage(err.message, true)
    }
})

async function handleRedirect(token) {
    const params = new URLSearchParams(window.location.search)
    const redirectUrl = params.get('redirect')

    if (!redirectUrl) {
        // If no redirect, assume they want the admin dashboard
        window.location.href = '/admin/'
        return
    }

    // 4. Validate Redirect Domain (Whitelist Check)
    try {
        const targetHost = new URL(redirectUrl).host
        
        const { data: website } = await supabase
            .from('websites')
            .select('is_active')
            .eq('domain', targetHost)
            .single()

        if (!website || !website.is_active) {
            throw new Error(`Unauthorized Redirect: ${targetHost} is not in the whitelist.`)
        }

        // 5. Success - Forward User
        const finalUrl = new URL(redirectUrl)
        finalUrl.hash = `access_token=${token}`
        window.location.href = finalUrl.toString()

    } catch (err) {
        showMessage(err.message, true)
        await supabase.auth.signOut()
    }
}