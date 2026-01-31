import { html } from "hono/html";

export function renderDashboard() {
  return html`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comment Admin</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    </head>
    <body class="min-h-screen bg-slate-950 text-slate-100">
      <div class="max-w-6xl mx-auto px-6 py-10" x-data="dashboard()" x-init="init()">
        <header class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-semibold">Comment Control</h1>
            <p class="text-slate-400">Moderate, configure, and track engagement.</p>
          </div>
          <div class="text-sm text-slate-400">Admin UI</div>
        </header>

        <section class="grid md:grid-cols-3 gap-4 mb-10">
          <div class="rounded-xl bg-slate-900 p-5 border border-slate-800">
            <div class="text-slate-400 text-sm">Total Comments</div>
            <div class="text-3xl font-semibold" x-text="stats.totalComments"></div>
          </div>
          <div class="rounded-xl bg-slate-900 p-5 border border-slate-800">
            <div class="text-slate-400 text-sm">Pending Review</div>
            <div class="text-3xl font-semibold" x-text="stats.pendingComments"></div>
          </div>
          <div class="rounded-xl bg-slate-900 p-5 border border-slate-800">
            <div class="text-slate-400 text-sm">Top Likes</div>
            <template x-for="item in stats.topLikes" :key="item.articleId">
              <div class="flex justify-between text-sm mt-2">
                <span class="truncate" x-text="item.articleId"></span>
                <span class="font-semibold" x-text="item.likes"></span>
              </div>
            </template>
          </div>
        </section>

        <section class="grid lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 rounded-xl bg-slate-900 border border-slate-800 p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold">Comments</h2>
              <div class="space-x-2">
                <button class="px-3 py-1 rounded bg-slate-800 text-sm" @click="filterStatus('pending')">Pending</button>
                <button class="px-3 py-1 rounded bg-slate-800 text-sm" @click="filterStatus('approved')">Approved</button>
                <button class="px-3 py-1 rounded bg-slate-800 text-sm" @click="filterStatus('spam')">Spam</button>
                <button class="px-3 py-1 rounded bg-slate-800 text-sm" @click="filterStatus('')">All</button>
              </div>
            </div>
            <div class="flex items-center justify-between text-sm text-slate-400 mb-4">
              <div x-text="'Page ' + page + ' / ' + totalPages"></div>
              <div class="space-x-2">
                <button class="px-2 py-1 rounded bg-slate-800" @click="prevPage()" :disabled="page <= 1">Prev</button>
                <button class="px-2 py-1 rounded bg-slate-800" @click="nextPage()" :disabled="page >= totalPages">Next</button>
              </div>
            </div>
            <div class="space-y-4">
              <template x-for="comment in comments" :key="comment.id">
                <div class="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div class="flex justify-between text-sm text-slate-400">
                    <span x-text="comment.author_name + ' · ' + comment.author_email + ' · ' + comment.article_id"></span>
                    <span x-text="comment.status"></span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1" x-text="new Date(comment.created_at).toLocaleString()"></div>
                  <div class="mt-2 text-slate-200" x-html="comment.content"></div>
                  <div class="mt-3 flex gap-2">
                    <button class="px-3 py-1 rounded bg-emerald-600 text-sm" @click="updateStatus(comment.id, 'approved')">Approve</button>
                    <button class="px-3 py-1 rounded bg-amber-500 text-sm" @click="updateStatus(comment.id, 'spam')">Spam</button>
                    <button class="px-3 py-1 rounded bg-slate-700 text-sm" @click="openReply(comment)">Reply</button>
                    <button class="px-3 py-1 rounded bg-rose-600 text-sm" @click="removeComment(comment.id)">Delete</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <h2 class="text-xl font-semibold mb-4">Settings</h2>
            <form class="space-y-3" @submit.prevent="saveSettings">
              <template x-for="(value, key) in settings" :key="key">
                <label class="block text-sm">
                  <span class="text-slate-400" x-text="key"></span>
                  <input class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model="settings[key]" />
                </label>
              </template>
              <button class="w-full py-2 rounded bg-sky-600 text-sm">Save</button>
            </form>
          </div>
        </section>

        <div class="fixed inset-0 bg-black/70 flex items-center justify-center" x-show="replyModal" x-cloak>
          <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg">
            <h3 class="text-lg font-semibold mb-3">Reply</h3>
            <div class="text-sm text-slate-400 mb-2" x-text="replyTarget ? replyTarget.content : ''"></div>
            <label class="block text-sm mb-2">
              <span class="text-slate-400">Admin identity</span>
              <select class="mt-1 w-full rounded bg-slate-950 border border-slate-700 p-2" x-model="replyAdminId">
                <template x-for="admin in admins" :key="admin.email">
                  <option :value="admin.id || admin.email" x-text="admin.name + ' (' + admin.email + ')'" />
                </template>
              </select>
            </label>
            <textarea class="w-full rounded bg-slate-950 border border-slate-700 p-2 mb-3" rows="4" x-model="replyContent"></textarea>
            <div class="flex justify-end gap-2">
              <button class="px-3 py-1 rounded bg-slate-700" @click="closeReply()">Cancel</button>
              <button class="px-3 py-1 rounded bg-emerald-600" @click="submitReply()">Send</button>
            </div>
          </div>
        </div>
      </div>

      <script>
        function dashboard() {
          return {
            comments: [],
            settings: {},
            admins: [],
            stats: { totalComments: 0, pendingComments: 0, topLikes: [] },
            statusFilter: "pending",
            page: 1,
            pageSize: 20,
            total: 0,
            replyModal: false,
            replyTarget: null,
            replyContent: "",
            replyAdminId: "",
            async init() {
              await Promise.all([this.loadComments(), this.loadSettings(), this.loadStats(), this.loadAdmins()]);
            },
            async loadComments() {
              const params = new URLSearchParams();
              if (this.statusFilter) params.set("status", this.statusFilter);
              params.set("page", String(this.page));
              params.set("pageSize", String(this.pageSize));
              const res = await fetch("/admin/comments?" + params.toString());
              const data = await res.json();
              this.comments = data.data ?? [];
              this.total = data.total ?? 0;
            },
            async loadStats() {
              const res = await fetch("/admin/stats");
              const data = await res.json();
              this.stats = data.data ?? this.stats;
            },
            async loadSettings() {
              const res = await fetch("/admin/settings");
              const data = await res.json();
              this.settings = data.data ?? {};
            },
            async loadAdmins() {
              const res = await fetch("/admin/admins");
              const data = await res.json();
              this.admins = data.data ?? [];
              this.replyAdminId = this.admins[0]?.id || this.admins[0]?.email || "";
            },
            async filterStatus(status) {
              this.statusFilter = status;
              this.page = 1;
              await this.loadComments();
            },
            get totalPages() {
              return Math.max(Math.ceil(this.total / this.pageSize), 1);
            },
            async nextPage() {
              if (this.page >= this.totalPages) return;
              this.page += 1;
              await this.loadComments();
            },
            async prevPage() {
              if (this.page <= 1) return;
              this.page -= 1;
              await this.loadComments();
            },
            async updateStatus(id, status) {
              await fetch("/admin/comments/" + id, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status })
              });
              await this.loadComments();
              await this.loadStats();
            },
            async removeComment(id) {
              await fetch("/admin/comments/" + id, { method: "DELETE" });
              await this.loadComments();
              await this.loadStats();
            },
            async saveSettings() {
              await fetch("/admin/settings", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(this.settings)
              });
            },
            openReply(comment) {
              this.replyTarget = comment;
              this.replyContent = "";
              this.replyModal = true;
            },
            closeReply() {
              this.replyModal = false;
            },
            async submitReply() {
              if (!this.replyTarget) return;
              await fetch("/admin/comments/reply", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  articleId: this.replyTarget.article_id,
                  parentId: this.replyTarget.parent_id ?? this.replyTarget.id,
                  replyToId: this.replyTarget.id,
                  content: this.replyContent,
                  adminId: this.replyAdminId
                })
              });
              this.replyModal = false;
              await this.loadComments();
            }
          };
        }
      </script>
    </body>
  </html>`;
}
