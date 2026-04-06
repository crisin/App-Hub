<script lang="ts">
  import { invalidateAll } from '$app/navigation'

  let { data } = $props()

  // ─── State ──────────────────────────────────────────────────────────────────
  let users = $derived(data.users)
  let showCreateForm = $state(false)
  let newEmail = $state('')
  let newName = $state('')
  let newRole = $state<'admin' | 'user'>('user')
  let newPassword = $state('')
  let creating = $state(false)
  let createError = $state('')

  // Editing state
  let editingId = $state<string | null>(null)
  let editName = $state('')
  let editRole = $state('')
  let editPassword = $state('')
  let saving = $state(false)

  // Password setup for creator
  let settingPasswordFor = $state<string | null>(null)
  let passwordInput = $state('')
  let settingPassword = $state(false)

  let deleteConfirm = $state<string | null>(null)

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function createUser() {
    if (!newEmail || !newName) return
    creating = true
    createError = ''
    try {
      const res = await fetch('/api/dev/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
      })
      const json = await res.json()
      if (!json.ok) {
        createError = json.error ?? 'Failed to create user'
        return
      }
      // Set password if provided
      if (newPassword && json.data?.id) {
        await fetch(`/api/dev/users/${json.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword }),
        })
      }
      // Reset form
      newEmail = ''
      newName = ''
      newRole = 'user'
      newPassword = ''
      showCreateForm = false
      await invalidateAll()
    } finally {
      creating = false
    }
  }

  function startEdit(user: (typeof users)[0]) {
    editingId = user.id
    editName = user.name
    editRole = user.role
    editPassword = ''
  }

  function cancelEdit() {
    editingId = null
    editPassword = ''
  }

  async function saveEdit(userId: string) {
    saving = true
    try {
      const body: Record<string, string> = {}
      const original = users.find((u) => u.id === userId)
      if (editName !== original?.name) body.name = editName
      if (editRole !== original?.role) body.role = editRole
      if (editPassword) body.password = editPassword

      if (Object.keys(body).length > 0) {
        await fetch(`/api/dev/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      editingId = null
      editPassword = ''
      await invalidateAll()
    } finally {
      saving = false
    }
  }

  async function setPassword(userId: string) {
    if (!passwordInput) return
    settingPassword = true
    try {
      await fetch(`/api/dev/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })
      settingPasswordFor = null
      passwordInput = ''
      await invalidateAll()
    } finally {
      settingPassword = false
    }
  }

  async function deleteUser(userId: string) {
    await fetch(`/api/dev/users/${userId}`, { method: 'DELETE' })
    deleteConfirm = null
    await invalidateAll()
  }

  function roleBadgeClass(role: string) {
    if (role === 'creator') return 'role-creator'
    if (role === 'admin') return 'role-admin'
    return 'role-user'
  }
</script>

<div class="auth-settings">
  <div class="section-header">
    <h2>Auth & Users</h2>
    <button class="btn-primary btn-sm" onclick={() => (showCreateForm = !showCreateForm)}>
      {showCreateForm ? 'Cancel' : '+ New User'}
    </button>
  </div>
  <p class="section-desc">
    Manage accounts for the dev auth system. The Creator account cannot be deleted or demoted.
  </p>

  <!-- Create User Form -->
  {#if showCreateForm}
    <div class="create-form">
      <div class="form-row">
        <div class="form-field">
          <label for="new-email">Email</label>
          <input
            id="new-email"
            type="email"
            bind:value={newEmail}
            placeholder="user@example.com"
          />
        </div>
        <div class="form-field">
          <label for="new-name">Name</label>
          <input id="new-name" type="text" bind:value={newName} placeholder="Display name" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="new-role">Role</label>
          <select id="new-role" bind:value={newRole}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-field">
          <label for="new-password">Password</label>
          <input
            id="new-password"
            type="password"
            bind:value={newPassword}
            placeholder="Set initial password"
          />
        </div>
      </div>
      {#if createError}
        <p class="error-msg">{createError}</p>
      {/if}
      <button class="btn-primary btn-sm" onclick={createUser} disabled={creating || !newEmail || !newName}>
        {creating ? 'Creating...' : 'Create User'}
      </button>
    </div>
  {/if}

  <!-- User List -->
  <div class="user-list">
    {#each users as user (user.id)}
      <div class="user-card" class:editing={editingId === user.id}>
        {#if editingId === user.id}
          <!-- Edit Mode -->
          <div class="edit-form">
            <div class="edit-row">
              <div class="form-field">
                <label for="edit-name">Name</label>
                <input id="edit-name" type="text" bind:value={editName} />
              </div>
              <div class="form-field">
                <label for="edit-role">Role</label>
                {#if user.role === 'creator'}
                  <input type="text" value="Creator" disabled />
                {:else}
                  <select id="edit-role" bind:value={editRole}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                {/if}
              </div>
              <div class="form-field">
                <label for="edit-pw">New Password</label>
                <input
                  id="edit-pw"
                  type="password"
                  bind:value={editPassword}
                  placeholder="Leave blank to keep"
                />
              </div>
            </div>
            <div class="edit-actions">
              <button class="btn-primary btn-sm" onclick={() => saveEdit(user.id)} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button class="btn-ghost btn-sm" onclick={cancelEdit}>Cancel</button>
            </div>
          </div>
        {:else}
          <!-- Display Mode -->
          <div class="user-info">
            <div class="user-identity">
              <span class="user-name">{user.name}</span>
              <span class="role-badge {roleBadgeClass(user.role)}">{user.role}</span>
            </div>
            <span class="user-email">{user.email}</span>
          </div>
          <div class="user-actions">
            {#if settingPasswordFor === user.id}
              <div class="inline-password">
                <input
                  type="password"
                  bind:value={passwordInput}
                  placeholder="New password"
                  onkeydown={(e) => e.key === 'Enter' && setPassword(user.id)}
                />
                <button
                  class="btn-primary btn-xs"
                  onclick={() => setPassword(user.id)}
                  disabled={settingPassword || !passwordInput}
                >
                  Set
                </button>
                <button
                  class="btn-ghost btn-xs"
                  onclick={() => {
                    settingPasswordFor = null
                    passwordInput = ''
                  }}
                >
                  Cancel
                </button>
              </div>
            {:else}
              <button
                class="btn-ghost btn-xs"
                onclick={() => {
                  settingPasswordFor = user.id
                  passwordInput = ''
                }}
              >
                Set Password
              </button>
              <button class="btn-ghost btn-xs" onclick={() => startEdit(user)}>Edit</button>
              {#if user.role !== 'creator'}
                {#if deleteConfirm === user.id}
                  <span class="confirm-delete">
                    Delete?
                    <button class="btn-danger btn-xs" onclick={() => deleteUser(user.id)}>
                      Yes
                    </button>
                    <button class="btn-ghost btn-xs" onclick={() => (deleteConfirm = null)}>
                      No
                    </button>
                  </span>
                {:else}
                  <button class="btn-ghost btn-xs btn-danger-text" onclick={() => (deleteConfirm = user.id)}>
                    Delete
                  </button>
                {/if}
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if users.length === 0}
    <p class="empty-state">No users found. The creator account will be created on first launch.</p>
  {/if}
</div>

<style>
  .auth-settings {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0;
  }
  .section-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: -0.5rem 0 0;
  }

  /* ─── Create Form ─────────────────────────────────────────────────────── */
  .create-form {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .form-row {
    display: flex;
    gap: 0.75rem;
  }
  .form-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .form-field label {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  .form-field input,
  .form-field select {
    padding: 0.4rem 0.6rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.82rem;
    font-family: var(--font);
  }
  .form-field input:focus,
  .form-field select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .error-msg {
    color: var(--danger);
    font-size: 0.78rem;
  }

  /* ─── User List ───────────────────────────────────────────────────────── */
  .user-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .user-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.15s ease;
  }
  .user-card:hover {
    border-color: var(--text-muted);
  }
  .user-card.editing {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .user-identity {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .user-name {
    font-weight: 500;
    font-size: 0.9rem;
  }
  .user-email {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  /* Role badges */
  .role-badge {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .role-creator {
    background: var(--accent-subtle);
    color: var(--accent);
    border: 1px solid var(--accent-muted);
  }
  .role-admin {
    background: var(--warning-subtle);
    color: var(--warning);
    border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
  }
  .role-user {
    background: var(--bg-hover);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  /* ─── User Actions ────────────────────────────────────────────────────── */
  .user-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .inline-password {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .inline-password input {
    padding: 0.25rem 0.5rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.78rem;
    width: 140px;
  }
  .inline-password input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .confirm-delete {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--danger);
  }

  /* ─── Edit Form ───────────────────────────────────────────────────────── */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .edit-row {
    display: flex;
    gap: 0.75rem;
  }
  .edit-actions {
    display: flex;
    gap: 0.35rem;
  }

  /* ─── Buttons ─────────────────────────────────────────────────────────── */
  .btn-sm {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
  }
  .btn-xs {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }
  .btn-danger-text {
    color: var(--danger) !important;
  }
  .btn-danger-text:hover {
    background: var(--danger-subtle) !important;
  }
  .btn-danger {
    background: var(--danger) !important;
    color: white !important;
    border-color: var(--danger) !important;
  }

  .empty-state {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    padding: 2rem;
  }
</style>
