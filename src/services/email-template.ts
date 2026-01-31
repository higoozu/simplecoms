export function newCommentTemplate(input: {
  articleId: string;
  authorName: string;
  content: string;
  approveUrl: string;
  deleteUrl: string;
}) {
  return `
    <h2>New comment pending</h2>
    <p><strong>${input.authorName}</strong> on <em>${input.articleId}</em></p>
    <div>${input.content}</div>
    <p>
      <a href="${input.approveUrl}">Approve</a> ·
      <a href="${input.deleteUrl}">Delete</a>
    </p>
  `;
}

export function commentApprovedTemplate(input: { authorName: string; articleId: string; content: string }) {
  return `
    <h2>Your comment is approved</h2>
    <p>Thanks ${input.authorName}! Your comment on <em>${input.articleId}</em> is now live.</p>
    <div>${input.content}</div>
  `;
}

export function replyNotificationTemplate(input: {
  parentAuthor: string;
  articleId: string;
  replyAuthor: string;
  replyContent: string;
}) {
  return `
    <h2>You have a new reply</h2>
    <p>${input.replyAuthor} replied on <em>${input.articleId}</em>.</p>
    <div>${input.replyContent}</div>
  `;
}

export function spamAlertTemplate(input: {
  articleId: string;
  authorName: string;
  reasons: string[];
  content: string;
}) {
  return `
    <h2>Spam detected</h2>
    <p>Possible spam on <em>${input.articleId}</em> by ${input.authorName}</p>
    <p>Reasons: ${input.reasons.join(", ")}</p>
    <div>${input.content}</div>
  `;
}
