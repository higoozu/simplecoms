(() => {
  const container = document.querySelector("[data-comment-root]");
  if (!container) return;

  const articleId = container.getAttribute("data-article-id") || window.location.pathname;
  const apiBase = container.getAttribute("data-api-base") || "";
  const likeKey = `comment-like-${articleId}`;

  const createEl = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  };

  const renderTree = (nodes, parent) => {
    const list = createEl("ul", "comment-list");
    nodes.forEach((node) => {
      const item = createEl("li", "comment-item");
      const adminBadge = node.is_admin ? '<span class="comment-badge">Author</span>' : "";
      const replyName = node.reply_to_name ? `@${node.reply_to_name} ` : "";
      const avatar = node.avatar_url
        ? `<img class="comment-avatar" src="${node.avatar_url}" alt="avatar" />`
        : "";
      item.innerHTML = `
        <div class="comment-header">
          ${avatar}
          <div>
            <div class="comment-meta">
              <strong>${node.author_name}</strong> ${adminBadge}
              <span>${new Date(node.created_at).toLocaleString()}</span>
            </div>
            <div class="comment-content">${replyName}${node.content}</div>
          </div>
        </div>
        <button class="comment-reply" data-reply-id="${node.id}" data-parent-id="${node.parent_id || node.id}" data-reply-name="${node.author_name}">Reply</button>
      `;
      if (node.children && node.children.length) {
        item.appendChild(renderTree(node.children, item));
      }
      list.appendChild(item);
    });
    parent.appendChild(list);
    return list;
  };

  const loadComments = async () => {
    const res = await fetch(`${apiBase}/articles/${encodeURIComponent(articleId)}/comments`);
    const data = await res.json();
    const tree = data.data || [];
    const target = container.querySelector(".comment-tree");
    target.innerHTML = "";
    renderTree(tree, target);
  };

  const setupLike = async () => {
    const likeBtn = container.querySelector(".comment-like-btn");
    if (!likeBtn) return;
    const liked = localStorage.getItem(likeKey);
    if (liked) {
      likeBtn.setAttribute("disabled", "true");
    }

    likeBtn.addEventListener("click", async () => {
      if (localStorage.getItem(likeKey)) return;
      const fingerprint = navigator.userAgent + ":" + navigator.language;
      const turnstileToken =
        window.turnstile && typeof window.turnstile.getResponse === "function"
          ? window.turnstile.getResponse()
          : "";
      const res = await fetch(`${apiBase}/articles/${encodeURIComponent(articleId)}/likes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fingerprint, turnstile: turnstileToken })
      });
      const data = await res.json();
      localStorage.setItem(likeKey, "1");
      likeBtn.setAttribute("disabled", "true");
      const count = container.querySelector(".comment-like-count");
      if (count) count.textContent = data.likes ?? "0";
    });
  };

  const setupForm = () => {
    const form = container.querySelector("form[data-comment-form]");
    if (!form) return;

    const replyToInput = () => {
      let input = form.querySelector("input[name='replyToId']");
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "replyToId";
        form.appendChild(input);
      }
      return input;
    };

    const parentIdInput = () => {
      let input = form.querySelector("input[name='parentId']");
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "parentId";
        form.appendChild(input);
      }
      return input;
    };

    container.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("comment-reply")) return;

      const replyId = target.getAttribute("data-reply-id");
      const parentId = target.getAttribute("data-parent-id");
      const replyName = target.getAttribute("data-reply-name") || "";
      replyToInput().value = replyId || "";
      parentIdInput().value = parentId || "";
      const content = form.querySelector("textarea[name='content']");
      if (content) {
        content.focus();
        if (replyName && !content.value.startsWith(`@${replyName}`)) {
          content.value = `@${replyName} ` + content.value;
        }
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const fingerprint = navigator.userAgent + ":" + navigator.language;
      payload.fingerprint = fingerprint;
      if (window.turnstile && typeof window.turnstile.getResponse === "function") {
        payload.turnstile = window.turnstile.getResponse();
      }

      await fetch(`${apiBase}/articles/${encodeURIComponent(articleId)}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      form.reset();
      await loadComments();
    });
  };

  const init = async () => {
    await loadComments();
    await setupLike();
    setupForm();
  };

  init();
})();
