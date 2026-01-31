import DOMPurify from "isomorphic-dompurify";

const allowedTags = [
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code"
];

const allowedAttrs = ["href", "title", "rel", "target"];

export function sanitizeHtml(input: string) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: false
  });
}
