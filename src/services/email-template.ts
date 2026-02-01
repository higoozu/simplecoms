export function commentApprovedTemplate(input: {
  authorName: string;
  articleId: string;
  content: string;
  viewUrl: string;
}) {
  return `
    <h2>Comment approved</h2>
    <p>Hi ${input.authorName}, your comment is now live.</p>
    <h3>Original Comment</h3>
    <div>${input.content}</div>
    <p><a href="${input.viewUrl}">View on site</a></p>
  `;
}

export function replyNotificationTemplate(input: {
  parentAuthor: string;
  parentContent: string;
  articleId: string;
  replyAuthor: string;
  replyContent: string;
  viewUrl: string;
}) {
  return `
    <h2>New reply to your comment</h2>
    <p>${input.replyAuthor} replied on <em>${input.articleId}</em>.</p>
    <h3>Your Comment</h3>
    <div>${input.parentContent}</div>
    <h3>Reply</h3>
    <div>${input.replyContent}</div>
    <p><a href="${input.viewUrl}">View on site</a></p>
  `;
}
