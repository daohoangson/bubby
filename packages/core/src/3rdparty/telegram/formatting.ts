import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function convertMarkdownToSafeHtml(markdown: string): string {
  const html = marked.parse(markdown);
  return sanitizeHtml(html, {
    allowedAttributes: {
      code: ["class"],
    },
    allowedTags: [
      // https://core.telegram.org/bots/api#formatting-options
      // <b>bold</b>, <strong>bold</strong>
      "b",
      "strong",
      // <i>italic</i>, <em>italic</em>
      "i",
      "em",
      // <u>underline</u>, <ins>underline</ins>
      "u",
      "ins",
      // <s>strikethrough</s>, <strike>strikethrough</strike>, <del>strikethrough</del>
      "s",
      "strike",
      "del",
      // <span class="tg-spoiler">spoiler</span>, <tg-spoiler>spoiler</tg-spoiler>
      "span",
      "tg-spoiler",
      // <a href="http://www.example.com/">inline URL</a>
      // <a href="tg://user?id=123456789">inline mention of a user</a>
      "a",
      // <tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>
      "tg-emoji",
      // <code>inline fixed-width code</code>
      "code",
      // <pre>pre-formatted fixed-width code block</pre>
      "pre",
    ],
  });
}
