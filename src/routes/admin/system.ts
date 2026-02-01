import { html } from "hono/html";

export function renderSystemPage() {
  return html`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comment Admin - System</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    </head>
    <body class="min-h-screen bg-slate-950 text-slate-100">
      <div class="max-w-6xl mx-auto px-6 py-10" x-data="systemPage()" x-init="init()">
        <header class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-semibold">System</h1>
            <p class="text-slate-400">Settings, health, and audit logs.</p>
          </div>
          <div class="space-x-3 text-sm">
            <a class="text-slate-300 hover:text-white" href="/admin">Dashboard</a>
          </div>
        </header>

        <section class="grid lg:grid-cols-3 gap-6 mb-8">
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <h2 class="text-xl font-semibold mb-4">Settings</h2>
            <form class="space-y-4" @submit.prevent="saveSettings">
              <label class="flex items-center justify-between text-sm">
                <span>Auto approve</span>
                <input type="checkbox" x-model="settings.auto_approve" />
              </label>
              <label class="flex items-center justify-between text-sm">
                <span>Require email</span>
                <input type="checkbox" x-model="settings.require_email" />
              </label>
              <label class="block text-sm">
                <span class="text-slate-400">Min length</span>
                <input type="number" class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model.number="settings.min_comment_length" />
              </label>
              <label class="block text-sm">
                <span class="text-slate-400">Max length</span>
                <input type="number" class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model.number="settings.max_comment_length" />
              </label>
              <label class="block text-sm">
                <span class="text-slate-400">Auto approve threshold</span>
                <input type="number" step="0.01" class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model.number="settings.auto_approve_threshold" />
              </label>
              <label class="block text-sm">
                <span class="text-slate-400">Moderation email</span>
                <input type="email" class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model="settings.comment_moderation_email" />
              </label>
              <label class="flex items-center justify-between text-sm">
                <span>Email notifications</span>
                <input type="checkbox" x-model="settings.enable_email_notifications" />
              </label>
              <label class="flex items-center justify-between text-sm">
                <span>Approval emails</span>
                <input type="checkbox" x-model="settings.enable_approval_emails" />
              </label>
              <label class="flex items-center justify-between text-sm">
                <span>Nested reply emails</span>
                <input type="checkbox" x-model="settings.enable_nested_emails" />
              </label>
              <label class="flex items-center justify-between text-sm">
                <span>Telegram notifications</span>
                <input type="checkbox" x-model="settings.enable_telegram_notifications" />
              </label>
              <button class="w-full py-2 rounded bg-sky-600 text-sm">Save</button>
            </form>
          </div>

          <div class="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <h2 class="text-xl font-semibold mb-4">Health</h2>
            <div class="text-sm text-slate-400 space-y-2">
              <div>Integrity: <span class="text-slate-200" x-text="health.integrity"></span></div>
              <div>DB Size: <span class="text-slate-200" x-text="health.dbSize"></span></div>
              <div>WAL Size: <span class="text-slate-200" x-text="health.walSize"></span></div>
              <div>Backups: <span class="text-slate-200" x-text="health.backups ? 'ok' : 'missing'"></span></div>
              <div>Pending: <span class="text-slate-200" x-text="health.pending"></span></div>
              <div>Spam: <span class="text-slate-200" x-text="health.spam"></span></div>
            </div>
            <div class="mt-4 flex gap-2">
              <button class="px-3 py-1 rounded bg-slate-700" @click="runBackup()">Backup</button>
              <button class="px-3 py-1 rounded bg-rose-700" @click="runRestore()">Restore</button>
            </div>
          </div>

          <div class="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <h2 class="text-xl font-semibold mb-4">Audit Log</h2>
            <div class="space-y-2 text-xs text-slate-400">
              <template x-for="entry in audit" :key="entry.ts">
                <div class="rounded bg-slate-950 border border-slate-800 p-2">
                  <div x-text="entry.ts + ' ' + entry.event"></div>
                  <div x-text="entry.path ? ('path: ' + entry.path) : ''"></div>
                </div>
              </template>
            </div>
          </div>
        </section>
      </div>

      <script>
        function systemPage() {
          return {
            settings: {},
            audit: [],
            health: { integrity: "", dbSize: 0, walSize: 0, backups: false, pending: 0, spam: 0 },
            async init() {
              await Promise.all([this.loadSettings(), this.loadAudit(), this.loadHealth()]);
            },
            async loadSettings() {
              const res = await fetch("/admin/settings");
              const data = await res.json();
              this.settings = data.data ?? {};
            },
            async loadAudit() {
              const res = await fetch("/admin/audit?limit=50");
              const data = await res.json();
              this.audit = data.data ?? [];
            },
            async loadHealth() {
              const res = await fetch("/admin/health");
              const data = await res.json();
              this.health = data.data ?? this.health;
            },
            async saveSettings() {
              await fetch("/admin/settings", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(this.settings)
              });
            },
            async runBackup() {
              await fetch("/admin/backup", { method: "POST" });
              await this.loadHealth();
            },
            async runRestore() {
              await fetch("/admin/restore", { method: "POST" });
              await this.loadHealth();
            }
          };
        }
      </script>
    </body>
  </html>`;
}
