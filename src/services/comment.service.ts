import type { CommentRow } from "../db/repositories/comment.repository.js";

export interface CommentNode extends CommentRow {
  children: CommentNode[];
  reply_to_name?: string;
}

export function buildCommentTree(rows: CommentRow[]) {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const node of map.values()) {
    if (node.reply_to_id && map.has(node.reply_to_id)) {
      node.reply_to_name = map.get(node.reply_to_id)!.author_name;
    }
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
